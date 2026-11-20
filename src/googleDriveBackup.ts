import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, User } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

export const SCOPES = ['https://www.googleapis.com/auth/drive.file'] as const;
export const DRIVE_BACKUP_FOLDER_NAME = 'KumWatsadu Backups';
export const DRIVE_BACKUP_PREFIX = 'KumWatsadu-backup-';
export const DRIVE_LATEST_FILENAME = `${DRIVE_BACKUP_PREFIX}latest.json`;
export const DRIVE_DAILY_KEEP_COUNT = 30;
export const DRIVE_DAILY_FILENAME_RE = /^KumWatsadu-backup-(\d{4}-\d{2}-\d{2})\.json$/;

const runtimeFirebaseConfig = {
  ...firebaseConfig,
  authDomain:
    (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined)?.trim() ||
    firebaseConfig.authDomain,
};

const app = getApps().length ? getApp() : initializeApp(runtimeFirebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));
provider.setCustomParameters({ prompt: 'select_account' });

// Flag to indicate if we are in the middle of a sign-in flow.
let isSigningIn = false;
// Cache the access token STRICTLY in memory (never localStorage/sessionStorage).
let cachedAccessToken: string | null = null;

export interface DriveBackupFile {
  id: string;
  name: string;
  size?: string;
  modifiedTime?: string;
  createdTime?: string;
  webViewLink?: string;
}

export class DriveAuthExpiredError extends Error {
  constructor(message = 'สิทธิ์การเชื่อมต่อ Google Drive หมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง') {
    super(message);
    this.name = 'DriveAuthExpiredError';
  }
}

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: (user: User | null) => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        onAuthSuccess?.(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        onAuthFailure?.(user);
      }
    } else {
      cachedAccessToken = null;
      onAuthFailure?.(null);
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('ไม่สามารถรับสิทธิ์เข้าถึง Google Drive ได้ กรุณาลองใหม่อีกครั้ง');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error('Google sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const clearAccessToken = () => {
  cachedAccessToken = null;
};

export const logout = async () => {
  cachedAccessToken = null;
  await auth.signOut();
};

async function driveFetch(url: string, accessToken: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);
  const res = await fetch(url, { ...init, headers });
  if (res.status === 401) {
    cachedAccessToken = null;
    throw new DriveAuthExpiredError();
  }
  if (!res.ok) {
    let errDetail = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      if (data?.error?.message) errDetail = data.error.message;
    } catch {
      // ignore non-json error body
    }
    throw new Error(`Google Drive API: ${errDetail}`);
  }
  return res;
}

export async function ensureDriveBackupFolder(accessToken: string): Promise<{ id: string; name: string }> {
  const q = `name='${DRIVE_BACKUP_FOLDER_NAME.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    q
  )}&fields=files(id,name)&spaces=drive&pageSize=1`;
  const searchRes = await driveFetch(searchUrl, accessToken);
  const searchData = await searchRes.json();
  if (Array.isArray(searchData.files) && searchData.files.length > 0) {
    return { id: searchData.files[0].id, name: searchData.files[0].name };
  }

  const createRes = await driveFetch('https://www.googleapis.com/drive/v3/files?fields=id,name', accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({
      name: DRIVE_BACKUP_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });
  const created = await createRes.json();
  return { id: created.id, name: created.name || DRIVE_BACKUP_FOLDER_NAME };
}

export async function listDriveBackupFiles(accessToken: string, folderId: string): Promise<DriveBackupFile[]> {
  const q = `'${folderId}' in parents and trashed=false and mimeType!='application/vnd.google-apps.folder'`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    q
  )}&orderBy=modifiedTime desc&pageSize=200&fields=files(id,name,size,modifiedTime,createdTime,webViewLink)`;
  const res = await driveFetch(url, accessToken);
  const data = await res.json();
  return Array.isArray(data.files) ? data.files : [];
}

export function sortDriveBackupFiles(files: DriveBackupFile[]): DriveBackupFile[] {
  return [...files].sort((a, b) => {
    const aLatest = a.name === DRIVE_LATEST_FILENAME ? 1 : 0;
    const bLatest = b.name === DRIVE_LATEST_FILENAME ? 1 : 0;
    if (aLatest !== bLatest) return bLatest - aLatest;
    const aMs = Date.parse(a.modifiedTime || a.createdTime || '') || 0;
    const bMs = Date.parse(b.modifiedTime || b.createdTime || '') || 0;
    if (aMs !== bMs) return bMs - aMs;
    return b.name.localeCompare(a.name);
  });
}

export async function uploadNewDriveBackup(
  accessToken: string,
  folderId: string,
  fileName: string,
  jsonContent: string
): Promise<DriveBackupFile> {
  const boundary = 'kumwatsadu_drive_' + Math.random().toString(36).slice(2);
  const metadata = {
    name: fileName,
    parents: [folderId],
    mimeType: 'application/json',
    description: 'ไฟล์สำรองข้อมูลระบบคุมวัสดุ (KumWatsadu JSON Backup)',
  };

  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${jsonContent}\r\n` +
    `--${boundary}--`;

  const res = await driveFetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,modifiedTime,createdTime,webViewLink',
    accessToken,
    {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );
  return await res.json();
}

export async function overwriteDriveBackup(
  accessToken: string,
  fileId: string,
  jsonContent: string
): Promise<DriveBackupFile> {
  const res = await driveFetch(
    `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(
      fileId
    )}?uploadType=media&fields=id,name,size,modifiedTime,createdTime,webViewLink`,
    accessToken,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: jsonContent,
    }
  );
  return await res.json();
}

export async function upsertDriveBackupFile(
  accessToken: string,
  folderId: string,
  fileName: string,
  jsonContent: string,
  existingFiles: DriveBackupFile[]
): Promise<DriveBackupFile> {
  const matches = existingFiles
    .filter((f) => f.name === fileName)
    .sort((a, b) => {
      const aMs = Date.parse(a.modifiedTime || a.createdTime || '') || 0;
      const bMs = Date.parse(b.modifiedTime || b.createdTime || '') || 0;
      return bMs - aMs;
    });

  if (matches.length > 0) {
    const updated = await overwriteDriveBackup(accessToken, matches[0].id, jsonContent);
    // Clean up any accidental duplicate files with the exact same target name
    for (const dup of matches.slice(1)) {
      try {
        await deleteDriveBackup(accessToken, dup.id);
      } catch {
        // ignore cleanup error
      }
    }
    return updated;
  }

  return await uploadNewDriveBackup(accessToken, folderId, fileName, jsonContent);
}

export async function pruneOldDailyDriveBackups(
  accessToken: string,
  files: DriveBackupFile[],
  keepCount: number = DRIVE_DAILY_KEEP_COUNT
): Promise<number> {
  const dailyFiles = files
    .filter((f) => DRIVE_DAILY_FILENAME_RE.test(f.name))
    .sort((a, b) => {
      const nameDiff = b.name.localeCompare(a.name);
      if (nameDiff !== 0) return nameDiff;
      const aMs = Date.parse(a.modifiedTime || a.createdTime || '') || 0;
      const bMs = Date.parse(b.modifiedTime || b.createdTime || '') || 0;
      return bMs - aMs;
    });

  // Deduplicate by daily filename (keep newest per day) and keep at most `keepCount` distinct days
  const keptDayNames = new Set<string>();
  const toDelete: DriveBackupFile[] = [];

  for (const file of dailyFiles) {
    if (keptDayNames.has(file.name)) {
      toDelete.push(file);
      continue;
    }
    if (keptDayNames.size < keepCount) {
      keptDayNames.add(file.name);
    } else {
      toDelete.push(file);
    }
  }

  let deletedCount = 0;
  for (const oldFile of toDelete) {
    try {
      await deleteDriveBackup(accessToken, oldFile.id);
      deletedCount += 1;
    } catch {
      // ignore individual delete failures so backup remains resilient
    }
  }
  return deletedCount;
}

export async function downloadDriveBackup(accessToken: string, fileId: string): Promise<string> {
  const res = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    accessToken
  );
  return await res.text();
}

export async function deleteDriveBackup(accessToken: string, fileId: string): Promise<void> {
  await driveFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`, accessToken, {
    method: 'DELETE',
  });
}
