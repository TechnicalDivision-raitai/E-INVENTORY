import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocFromServer,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  Unsubscribe,
  updateDoc,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

export const OWNER_ADMIN_EMAIL = 'farsaicra@gmail.com';
export const OFFLINE_GRACE_DAYS = 30;
export const OFFLINE_GRACE_MS = OFFLINE_GRACE_DAYS * 24 * 60 * 60 * 1000;
export const DEFAULT_MAX_DEVICES = 2;

const DEVICE_ID_STORAGE_KEY = 'kumwatsadu-license-device-id-v1';
const LICENSE_CACHE_STORAGE_KEY = 'kumwatsadu-license-cache-v1';
const LICENSE_IDB_NAME = 'kumwatsadu-license-idb';
const LICENSE_IDB_STORE = 'kv';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

const accessProvider = new GoogleAuthProvider();
accessProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

export type AccessStatus = 'pending' | 'approved' | 'rejected' | 'revoked';

export interface AccessRequestDoc {
  uid: string;
  email: string;
  fullName: string;
  orgName: string;
  position: string;
  phone: string;
  note: string;
  status: AccessStatus;
  maxDevices: number;
  pendingDeviceId: string;
  pendingDeviceLabel: string;
  approvedDeviceIds: string[];
  approvedDeviceLabels: string;
  expiresAt: string;
  reviewedBy: string;
  reviewedAt?: Timestamp | null;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface LocalLicenseCache {
  uid: string;
  email: string;
  fullName: string;
  orgName: string;
  isAdmin: boolean;
  deviceId: string;
  approvedDeviceIds: string[];
  approvedDeviceLabels: string;
  maxDevices: number;
  expiresAt: string;
  lastVerifiedAt: string;
  digest: string;
}

export interface LocalCacheCheckResult {
  valid: boolean;
  expired30Days: boolean;
  expiredLicense: boolean;
  daysRemaining: number;
  cache: LocalLicenseCache | null;
}

export function isOwnerAdminUser(user: User | null | undefined): boolean {
  if (!user) return false;
  return Boolean(user.emailVerified && user.email?.trim().toLowerCase() === OWNER_ADMIN_EMAIL);
}

export function isOfflineError(error: unknown): boolean {
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    !navigator.onLine ||
    msg.includes('offline') ||
    msg.includes('network') ||
    msg.includes('unavailable') ||
    msg.includes('failed to fetch')
  );
}

function openLicenseIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(LICENSE_IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const idb = req.result;
      if (!idb.objectStoreNames.contains(LICENSE_IDB_STORE)) {
        idb.createObjectStore(LICENSE_IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB open error'));
  });
}

async function idbGet(key: string): Promise<string | null> {
  try {
    const idb = await openLicenseIdb();
    return await new Promise((resolve) => {
      const tx = idb.transaction(LICENSE_IDB_STORE, 'readonly');
      const req = tx.objectStore(LICENSE_IDB_STORE).get(key);
      req.onsuccess = () => resolve(typeof req.result === 'string' ? req.result : null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function idbSet(key: string, value: string): Promise<void> {
  try {
    const idb = await openLicenseIdb();
    await new Promise<void>((resolve) => {
      const tx = idb.transaction(LICENSE_IDB_STORE, 'readwrite');
      tx.objectStore(LICENSE_IDB_STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // ignore storage fallback errors
  }
}

async function idbDel(key: string): Promise<void> {
  try {
    const idb = await openLicenseIdb();
    await new Promise<void>((resolve) => {
      const tx = idb.transaction(LICENSE_IDB_STORE, 'readwrite');
      tx.objectStore(LICENSE_IDB_STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // ignore
  }
}

function generateDeviceId(): string {
  const bytes = new Uint8Array(12);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `dev_${hex}`;
}

export async function getOrCreateDeviceId(): Promise<string> {
  const validRe = /^[a-zA-Z0-9_-]{8,80}$/;
  try {
    const lsVal = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (lsVal && validRe.test(lsVal)) {
      void idbSet(DEVICE_ID_STORAGE_KEY, lsVal);
      return lsVal;
    }
  } catch {
    // ignore
  }

  const idbVal = await idbGet(DEVICE_ID_STORAGE_KEY);
  if (idbVal && validRe.test(idbVal)) {
    try {
      localStorage.setItem(DEVICE_ID_STORAGE_KEY, idbVal);
    } catch {
      // ignore
    }
    return idbVal;
  }

  const nextId = generateDeviceId();
  try {
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, nextId);
  } catch {
    // ignore
  }
  await idbSet(DEVICE_ID_STORAGE_KEY, nextId);
  return nextId;
}

export function getDeviceLabel(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  let os = 'อุปกรณ์ทั่วไป';
  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iPhone/iPad';
  else if (/Mac OS X|Macintosh/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  let browser = 'Browser';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = 'Chrome';
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';

  const standalone =
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)')?.matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true);

  return `${os} · ${browser}${standalone ? ' (แอปติดตั้ง)' : ''}`.slice(0, 120);
}

async function computeDigest(payload: Omit<LocalLicenseCache, 'digest'>): Promise<string> {
  const raw = [
    payload.uid,
    payload.email,
    payload.deviceId,
    payload.isAdmin ? '1' : '0',
    payload.lastVerifiedAt,
    payload.expiresAt,
    'kumwatsadu-license-v1',
  ].join('|');

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
    return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
  }
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash * 31 + raw.charCodeAt(i)) | 0;
  }
  return `fb_${Math.abs(hash).toString(16)}`;
}

export function isLicenseDateExpired(expiresAt: string): boolean {
  const trimmed = (expiresAt || '').trim();
  if (!trimmed) return false;
  const endOfDay = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? Date.parse(`${trimmed}T23:59:59.999`)
    : Date.parse(trimmed);
  if (Number.isNaN(endOfDay)) return false;
  return Date.now() > endOfDay;
}

export async function saveLocalLicenseCache(
  input: Omit<LocalLicenseCache, 'digest' | 'lastVerifiedAt'>
): Promise<LocalLicenseCache> {
  const lastVerifiedAt = new Date().toISOString();
  const base: Omit<LocalLicenseCache, 'digest'> = {
    ...input,
    lastVerifiedAt,
  };
  const digest = await computeDigest(base);
  const full: LocalLicenseCache = { ...base, digest };
  const serialized = JSON.stringify(full);
  try {
    localStorage.setItem(LICENSE_CACHE_STORAGE_KEY, serialized);
  } catch {
    // ignore
  }
  await idbSet(LICENSE_CACHE_STORAGE_KEY, serialized);
  return full;
}

export async function clearLocalLicenseCache(): Promise<void> {
  try {
    localStorage.removeItem(LICENSE_CACHE_STORAGE_KEY);
  } catch {
    // ignore
  }
  await idbDel(LICENSE_CACHE_STORAGE_KEY);
}

export async function verifyLocalLicenseCache(
  deviceId: string,
  user: User | null
): Promise<LocalCacheCheckResult> {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(LICENSE_CACHE_STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (!raw) {
    raw = await idbGet(LICENSE_CACHE_STORAGE_KEY);
  }
  if (!raw) {
    return {
      valid: false,
      expired30Days: false,
      expiredLicense: false,
      daysRemaining: 0,
      cache: null,
    };
  }

  try {
    const parsed = JSON.parse(raw) as LocalLicenseCache;
    if (!parsed || parsed.deviceId !== deviceId) {
      return {
        valid: false,
        expired30Days: false,
        expiredLicense: false,
        daysRemaining: 0,
        cache: null,
      };
    }
    if (user && parsed.uid !== user.uid) {
      return {
        valid: false,
        expired30Days: false,
        expiredLicense: false,
        daysRemaining: 0,
        cache: null,
      };
    }
    const { digest, ...base } = parsed;
    const expected = await computeDigest(base);
    if (digest !== expected) {
      return {
        valid: false,
        expired30Days: false,
        expiredLicense: false,
        daysRemaining: 0,
        cache: null,
      };
    }

    if (isLicenseDateExpired(parsed.expiresAt)) {
      return {
        valid: false,
        expired30Days: false,
        expiredLicense: true,
        daysRemaining: 0,
        cache: parsed,
      };
    }

    const verifiedMs = Date.parse(parsed.lastVerifiedAt);
    if (Number.isNaN(verifiedMs)) {
      return {
        valid: false,
        expired30Days: true,
        expiredLicense: false,
        daysRemaining: 0,
        cache: parsed,
      };
    }

    const elapsedMs = Date.now() - verifiedMs;
    const remainingMs = OFFLINE_GRACE_MS - elapsedMs;
    const daysRemaining = Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
    if (elapsedMs > OFFLINE_GRACE_MS || elapsedMs < -24 * 60 * 60 * 1000) {
      return {
        valid: false,
        expired30Days: true,
        expiredLicense: false,
        daysRemaining: 0,
        cache: parsed,
      };
    }

    return {
      valid: true,
      expired30Days: false,
      expiredLicense: false,
      daysRemaining,
      cache: parsed,
    };
  } catch {
    return {
      valid: false,
      expired30Days: false,
      expiredLicense: false,
      daysRemaining: 0,
      cache: null,
    };
  }
}

export function subscribeAuthState(cb: (user: User | null) => void): Unsubscribe {
  return onAuthStateChanged(auth, cb);
}

export async function signInWithGoogleForAccess(): Promise<User> {
  const res = await signInWithPopup(auth, accessProvider);
  return res.user;
}

export async function signOutFromAccess(): Promise<void> {
  await clearLocalLicenseCache();
  await signOut(auth);
}

export async function fetchMyAccessRequest(uid: string): Promise<AccessRequestDoc | null> {
  const path = `access_requests/${uid}`;
  try {
    const snap = await getDocFromServer(doc(db, 'access_requests', uid));
    if (!snap.exists()) return null;
    return snap.data() as AccessRequestDoc;
  } catch (error) {
    if (isOfflineError(error)) throw error;
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export interface AccessRegistrationForm {
  fullName: string;
  orgName: string;
  position: string;
  phone: string;
  note: string;
}

export async function submitAccessRequest(
  user: User,
  form: AccessRegistrationForm,
  deviceId: string,
  deviceLabel: string,
  existingDoc: AccessRequestDoc | null
): Promise<AccessRequestDoc> {
  const path = `access_requests/${user.uid}`;
  const fullName = form.fullName.trim().slice(0, 120);
  const orgName = form.orgName.trim().slice(0, 180);
  const position = form.position.trim().slice(0, 120);
  const phone = form.phone.trim().slice(0, 40);
  const note = form.note.trim().slice(0, 300);
  const cleanLabel = deviceLabel.trim().slice(0, 120);

  if (fullName.length < 2) {
    throw new Error('กรุณาระบุชื่อ-นามสกุลอย่างน้อย 2 ตัวอักษร');
  }
  if (orgName.length < 2) {
    throw new Error('กรุณาระบุชื่อหน่วยงานหรือ อปท. อย่างน้อย 2 ตัวอักษร');
  }

  try {
    if (!existingDoc) {
      await setDoc(doc(db, 'access_requests', user.uid), {
        uid: user.uid,
        email: (user.email || '').slice(0, 120),
        fullName,
        orgName,
        position,
        phone,
        note,
        status: 'pending',
        maxDevices: DEFAULT_MAX_DEVICES,
        pendingDeviceId: deviceId,
        pendingDeviceLabel: cleanLabel,
        approvedDeviceIds: [],
        approvedDeviceLabels: '',
        expiresAt: '',
        reviewedBy: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else if (existingDoc.status === 'pending' || existingDoc.status === 'rejected') {
      await updateDoc(doc(db, 'access_requests', user.uid), {
        fullName,
        orgName,
        position,
        phone,
        note,
        pendingDeviceId: deviceId,
        pendingDeviceLabel: cleanLabel,
        status: 'pending',
        updatedAt: serverTimestamp(),
      });
    } else if (existingDoc.status === 'approved') {
      await updateDoc(doc(db, 'access_requests', user.uid), {
        pendingDeviceId: deviceId,
        pendingDeviceLabel: cleanLabel,
        note,
        updatedAt: serverTimestamp(),
      });
    } else {
      throw new Error('บัญชีนี้ถูกระงับสิทธิ์การใช้งาน กรุณาติดต่อเจ้าของระบบโดยตรง');
    }
    const fresh = await fetchMyAccessRequest(user.uid);
    if (!fresh) throw new Error('ไม่พบข้อมูลคำขอหลังบันทึก');
    return fresh;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('กรุณา')) throw error;
    if (error instanceof Error && error.message.startsWith('บัญชีนี้ถูกระงับ')) throw error;
    handleFirestoreError(error, existingDoc ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function requestDeviceBinding(
  user: User,
  deviceId: string,
  deviceLabel: string,
  note: string
): Promise<AccessRequestDoc> {
  const path = `access_requests/${user.uid}`;
  try {
    await updateDoc(doc(db, 'access_requests', user.uid), {
      pendingDeviceId: deviceId,
      pendingDeviceLabel: deviceLabel.trim().slice(0, 120),
      note: note.trim().slice(0, 300),
      updatedAt: serverTimestamp(),
    });
    const fresh = await fetchMyAccessRequest(user.uid);
    if (!fresh) throw new Error('ไม่พบข้อมูลคำขอ');
    return fresh;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function parseDeviceLabels(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(' | ')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function formatDeviceLabels(labels: string[]): string {
  return labels
    .map((l) => l.replace(/\s*\|\s*/g, ' ').trim())
    .filter(Boolean)
    .join(' | ')
    .slice(0, 300);
}

export function subscribeAllAccessRequests(
  onData: (items: AccessRequestDoc[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'access_requests';
  const q = query(collection(db, path), orderBy('updatedAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => d.data() as AccessRequestDoc);
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError?.(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function adminApproveRequest(
  req: AccessRequestDoc,
  options: { replaceIndex?: number; expiresAt?: string; maxDevices?: number } = {}
): Promise<void> {
  const adminEmail = auth.currentUser?.email || OWNER_ADMIN_EMAIL;
  const path = `access_requests/${req.uid}`;
  const maxDevices = Math.min(5, Math.max(1, options.maxDevices ?? req.maxDevices ?? DEFAULT_MAX_DEVICES));
  const ids = [...(req.approvedDeviceIds || [])];
  const labels = parseDeviceLabels(req.approvedDeviceLabels || '');

  while (labels.length < ids.length) labels.push('อุปกรณ์ที่ลงทะเบียน');

  const pendingId = req.pendingDeviceId;
  const pendingLbl = req.pendingDeviceLabel || 'อุปกรณ์ที่ขอสิทธิ์';

  if (pendingId) {
    const existingIdx = ids.indexOf(pendingId);
    if (existingIdx >= 0) {
      labels[existingIdx] = pendingLbl;
    } else if (options.replaceIndex !== undefined && options.replaceIndex >= 0 && options.replaceIndex < ids.length) {
      ids[options.replaceIndex] = pendingId;
      labels[options.replaceIndex] = pendingLbl;
    } else if (ids.length < maxDevices) {
      ids.push(pendingId);
      labels.push(pendingLbl);
    } else {
      throw new Error(`ครบโควต้า ${maxDevices} เครื่องแล้ว กรุณาเลือกเครื่องที่ต้องการแทนที่`);
    }
  }

  try {
    await updateDoc(doc(db, 'access_requests', req.uid), {
      status: 'approved',
      maxDevices,
      approvedDeviceIds: ids.slice(0, maxDevices),
      approvedDeviceLabels: formatDeviceLabels(labels.slice(0, maxDevices)),
      pendingDeviceId: '',
      pendingDeviceLabel: '',
      expiresAt: (options.expiresAt ?? req.expiresAt ?? '').trim().slice(0, 40),
      reviewedBy: adminEmail.slice(0, 120),
      reviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminRejectRequest(req: AccessRequestDoc, reason = ''): Promise<void> {
  const adminEmail = auth.currentUser?.email || OWNER_ADMIN_EMAIL;
  const path = `access_requests/${req.uid}`;
  try {
    await updateDoc(doc(db, 'access_requests', req.uid), {
      status: 'rejected',
      pendingDeviceId: '',
      pendingDeviceLabel: '',
      note: (reason || req.note || '').trim().slice(0, 300),
      reviewedBy: adminEmail.slice(0, 120),
      reviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminClearPendingDevice(req: AccessRequestDoc): Promise<void> {
  const adminEmail = auth.currentUser?.email || OWNER_ADMIN_EMAIL;
  const path = `access_requests/${req.uid}`;
  try {
    await updateDoc(doc(db, 'access_requests', req.uid), {
      pendingDeviceId: '',
      pendingDeviceLabel: '',
      reviewedBy: adminEmail.slice(0, 120),
      reviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminRevokeRequest(req: AccessRequestDoc, reason = ''): Promise<void> {
  const adminEmail = auth.currentUser?.email || OWNER_ADMIN_EMAIL;
  const path = `access_requests/${req.uid}`;
  try {
    await updateDoc(doc(db, 'access_requests', req.uid), {
      status: 'revoked',
      approvedDeviceIds: [],
      approvedDeviceLabels: '',
      pendingDeviceId: '',
      pendingDeviceLabel: '',
      note: (reason || req.note || '').trim().slice(0, 300),
      reviewedBy: adminEmail.slice(0, 120),
      reviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminRemoveBoundDevice(req: AccessRequestDoc, idx: number): Promise<void> {
  const adminEmail = auth.currentUser?.email || OWNER_ADMIN_EMAIL;
  const path = `access_requests/${req.uid}`;
  const ids = [...(req.approvedDeviceIds || [])];
  const labels = parseDeviceLabels(req.approvedDeviceLabels || '');
  while (labels.length < ids.length) labels.push('อุปกรณ์ที่ลงทะเบียน');
  if (idx >= 0 && idx < ids.length) {
    ids.splice(idx, 1);
    labels.splice(idx, 1);
  }
  try {
    await updateDoc(doc(db, 'access_requests', req.uid), {
      approvedDeviceIds: ids,
      approvedDeviceLabels: formatDeviceLabels(labels),
      reviewedBy: adminEmail.slice(0, 120),
      reviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminDeleteRequest(uid: string): Promise<void> {
  const path = `access_requests/${uid}`;
  try {
    await deleteDoc(doc(db, 'access_requests', uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
