import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { Cloud, CloudUpload, RefreshCw, RotateCcw, Trash2, LogOut, Folder, FileJson, ShieldAlert, Check } from 'lucide-react';
import {
  clearAccessToken,
  deleteDriveBackup,
  downloadDriveBackup,
  DRIVE_BACKUP_FOLDER_NAME,
  DriveAuthExpiredError,
  DriveBackupFile,
  ensureDriveBackupFolder,
  getAccessToken,
  googleSignIn,
  initAuth,
  listDriveBackupFiles,
  logout,
  overwriteDriveBackup,
  uploadNewDriveBackup,
} from './googleDriveBackup';

interface ParsedBackupSummary {
  raw: Record<string, unknown>;
  materialsCount: number;
  movesCount: number;
  countsCount: number;
  exportedAt: string;
}

type ConfirmActionState =
  | {
      type: 'restore';
      file: DriveBackupFile;
      summary: ParsedBackupSummary;
      isAutoPrompt?: boolean;
      isDifferentUser?: boolean;
      localSummary?: { materials: number; moves: number; counts: number };
    }
  | { type: 'overwrite'; file: DriveBackupFile }
  | { type: 'delete'; file: DriveBackupFile }
  | null;

const DRIVE_AUTO_KEY = 'kumwatsadu-db-v1:driveAutoEnabled';
const DRIVE_AT_KEY = 'kumwatsadu-db-v1:driveBackupAt';
const DRIVE_EMAIL_KEY = 'kumwatsadu-db-v1:driveBackupEmail';

function formatBytes(rawSize?: string): string {
  const n = Number(rawSize || 0);
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function formatThaiDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return (
    d.toLocaleString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }) + ' น.'
  );
}

function makeTimestampFilename(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `KumWatsadu-backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(
    d.getMinutes()
  )}-${p(d.getSeconds())}.json`;
}

export function GoogleDriveBackupPanel() {
  const [needsAuth, setNeedsAuth] = useState<boolean>(true);
  const [user, setUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [isBusy, setIsBusy] = useState<boolean>(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState<boolean>(false);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [files, setFiles] = useState<DriveBackupFile[]>([]);
  const [statusMsg, setStatusMsg] = useState<{ text: string; kind: 'ok' | 'warn' | 'err' | 'muted' }>({
    text: '',
    kind: 'muted',
  });
  const [autoEnabled, setAutoEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(DRIVE_AUTO_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [lastDriveAt, setLastDriveAt] = useState<string>(() => {
    try {
      return localStorage.getItem(DRIVE_AT_KEY) || '';
    } catch {
      return '';
    }
  });
  const [lastDriveEmail, setLastDriveEmail] = useState<string>(() => {
    try {
      return localStorage.getItem(DRIVE_EMAIL_KEY) || '';
    } catch {
      return '';
    }
  });
  const [confirmAction, setConfirmAction] = useState<ConfirmActionState>(null);

  const lastSyncedSigRef = useRef<string | null>(null);
  const autoTimerRef = useRef<number | null>(null);
  const autoCheckedUidRef = useRef<string | null>(null);
  const prevEmailRef = useRef<string>(lastDriveEmail);

  const checkAutoRestoreOnConnect = useCallback(
    async (token: string, list: DriveBackupFile[], activeUser: User) => {
      if (autoCheckedUidRef.current === activeUser.uid) return;
      autoCheckedUidRef.current = activeUser.uid;

      const prevEmail = prevEmailRef.current;
      const activeEmail = activeUser.email || '';
      const isDifferentUser = Boolean(prevEmail && activeEmail && prevEmail.toLowerCase() !== activeEmail.toLowerCase());

      if (activeEmail) {
        prevEmailRef.current = activeEmail;
        try {
          localStorage.setItem(DRIVE_EMAIL_KEY, activeEmail);
          setLastDriveEmail(activeEmail);
        } catch {
          // ignore
        }
      }

      if (!list.length) return;
      const latestFile = list.find((f) => /\.json$/i.test(f.name)) || list[0];
      if (!latestFile) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const api = (window as any).kwBackupApi;
      if (!api) return;

      try {
        const rawText = await downloadDriveBackup(token, latestFile.id);
        const parsed = JSON.parse(rawText);
        if (parsed?.app !== 'kongchang-stock' || !Array.isArray(parsed?.materials) || !Array.isArray(parsed?.moves)) {
          return;
        }

        const hasLocal = Boolean(api.hasData?.());
        const localMs = Number(api.getLocalLatestModifiedMs?.() || 0);
        const driveMs = parsed.exportedAt
          ? Date.parse(parsed.exportedAt)
          : latestFile.modifiedTime
          ? Date.parse(latestFile.modifiedTime)
          : 0;
        const curSig = api.getDataSignature?.();
        const driveSig = api.getPayloadSignature?.(parsed);

        if (hasLocal && !isDifferentUser && curSig && driveSig && curSig === driveSig) {
          const syncIso = parsed.exportedAt || latestFile.modifiedTime || new Date().toISOString();
          api.recordExternalBackup?.('drive', syncIso, activeEmail);
          setLastDriveAt(syncIso);
          lastSyncedSigRef.current = curSig;
          setStatusMsg({
            text: `เชื่อมต่อบัญชี ${activeEmail || 'Google'} สำเร็จแล้ว (ข้อมูลในเครื่องตรงกับไฟล์สำรองล่าสุดบน Google Drive)`,
            kind: 'ok',
          });
          return;
        }

        if (!hasLocal || (!isDifferentUser && driveMs > localMs + 2000)) {
          const restoredCount = await api.restoreFromPayload?.(parsed, {
            replaceExisting: true,
            source: 'drive',
            email: activeEmail,
          });
          const expIso = parsed.exportedAt || latestFile.modifiedTime || new Date().toISOString();
          setLastDriveAt(expIso);
          lastSyncedSigRef.current = api.getDataSignature?.() || null;
          setStatusMsg({
            text: `ดึงข้อมูลที่เคยสำรองไว้จาก Google Drive (${latestFile.name}) เข้าสู่ระบบอัตโนมัติแล้ว (${restoredCount ?? 0} รายการ)`,
            kind: 'ok',
          });
          api.notifyToast?.(
            `ดึงข้อมูลที่เคยสำรองไว้จาก Google Drive เข้าสู่ระบบอัตโนมัติแล้ว (${parsed.materials.length} วัสดุ, ${parsed.moves.length} เอกสาร)`
          );
          return;
        }

        const localSummary = api.getCountsSummary?.() || { materials: 0, moves: 0, counts: 0 };
        setConfirmAction({
          type: 'restore',
          file: latestFile,
          isAutoPrompt: true,
          isDifferentUser,
          localSummary,
          summary: {
            raw: parsed,
            materialsCount: parsed.materials.length,
            movesCount: parsed.moves.length,
            countsCount: Array.isArray(parsed.counts) ? parsed.counts.length : 0,
            exportedAt: parsed.exportedAt || latestFile.modifiedTime || '',
          },
        });
      } catch (err) {
        console.warn('Auto-check Drive backup failed:', err);
      }
    },
    []
  );

  const refreshFiles = useCallback(
    async (tokenOverride?: string | null, opts?: { autoSyncOnConnect?: boolean; activeUser?: User | null }) => {
      const token = tokenOverride ?? (await getAccessToken());
      if (!token) {
        setNeedsAuth(true);
        return;
      }
      setIsLoadingFiles(true);
      try {
        const folder = await ensureDriveBackupFolder(token);
        setFolderId(folder.id);
        const list = await listDriveBackupFiles(token, folder.id);
        setFiles(list);
        setNeedsAuth(false);
        if (opts?.autoSyncOnConnect && opts.activeUser) {
          await checkAutoRestoreOnConnect(token, list, opts.activeUser);
        }
      } catch (err) {
        if (err instanceof DriveAuthExpiredError) {
          setNeedsAuth(true);
          setStatusMsg({ text: err.message, kind: 'warn' });
        } else {
          setStatusMsg({
            text: err instanceof Error ? err.message : 'ไม่สามารถโหลดรายการไฟล์จาก Google Drive ได้',
            kind: 'err',
          });
        }
      } finally {
        setIsLoadingFiles(false);
      }
    },
    [checkAutoRestoreOnConnect]
  );

  useEffect(() => {
    const unsubscribe = initAuth(
      (authUser, token) => {
        setUser(authUser);
        setNeedsAuth(false);
        void refreshFiles(token, { autoSyncOnConnect: true, activeUser: authUser });
      },
      (authUser) => {
        setUser(authUser);
        setNeedsAuth(true);
        setFolderId(null);
        if (!authUser) {
          autoCheckedUidRef.current = null;
        }
      }
    );
    return () => unsubscribe();
  }, [refreshFiles]);

  useEffect(() => {
    const onSnapshotRestored = (ev: Event) => {
      const detail = (ev as CustomEvent)?.detail;
      if (detail?.signature) {
        lastSyncedSigRef.current = String(detail.signature);
      }
    };
    window.addEventListener('kumwatsadu-snapshot-restored', onSnapshotRestored);
    return () => window.removeEventListener('kumwatsadu-snapshot-restored', onSnapshotRestored);
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setStatusMsg({ text: '', kind: 'muted' });
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setNeedsAuth(false);
        setStatusMsg({
          text: `เชื่อมต่อบัญชี ${result.user.email || result.user.displayName || 'Google'} สำเร็จแล้ว`,
          kind: 'ok',
        });
        await refreshFiles(result.accessToken, { autoSyncOnConnect: true, activeUser: result.user });
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setStatusMsg({ text: 'ยกเลิกการเข้าสู่ระบบด้วยบัญชี Google', kind: 'muted' });
      } else {
        setStatusMsg({
          text: err instanceof Error ? err.message : 'เข้าสู่ระบบ Google ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
          kind: 'err',
        });
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    setIsBusy(true);
    try {
      await logout();
      autoCheckedUidRef.current = null;
      setUser(null);
      setNeedsAuth(true);
      setFolderId(null);
      setFiles([]);
      setStatusMsg({
        text: 'ออกจากระบบบัญชี Google แล้ว · ผู้ใช้งานท่านอื่นสามารถกด Sign in with Google เพื่อใช้ Drive ของตนเองได้',
        kind: 'muted',
      });
    } finally {
      setIsBusy(false);
    }
  };

  const performBackupToNewFile = useCallback(
    async (silent = false): Promise<boolean> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const api = (window as any).kwBackupApi;
      if (!api) return false;
      const token = await getAccessToken();
      if (!token) {
        setNeedsAuth(true);
        if (!silent) {
          setStatusMsg({ text: 'กรุณากด Sign in with Google เพื่อเชื่อมต่อ Google Drive ก่อนสำรองข้อมูล', kind: 'warn' });
        }
        return false;
      }
      if (!api.hasData()) {
        if (!silent) {
          setStatusMsg({ text: 'ยังไม่มีข้อมูลวัสดุหรือใบรับ-ใบเบิกสำหรับสำรอง', kind: 'warn' });
          api.notifyToast?.('ยังไม่มีข้อมูลให้สำรอง');
        }
        return false;
      }

      if (!silent) setIsBusy(true);
      try {
        const fid = folderId || (await ensureDriveBackupFolder(token)).id;
        setFolderId(fid);
        const payload = api.getBackupJson();
        const jsonText = JSON.stringify(payload, null, 1);
        const fileName = makeTimestampFilename();
        await uploadNewDriveBackup(token, fid, fileName, jsonText);
        const nowIso = new Date().toISOString();
        setLastDriveAt(nowIso);
        if (user?.email) {
          setLastDriveEmail(user.email);
          prevEmailRef.current = user.email;
        }
        api.recordExternalBackup?.('drive', nowIso, user?.email || '');
        lastSyncedSigRef.current = api.getDataSignature?.() || null;
        if (!silent) {
          setStatusMsg({
            text: `บันทึกไฟล์ ${fileName} ลง Google Drive ของ ${user?.email || 'คุณ'} เรียบร้อยแล้ว`,
            kind: 'ok',
          });
          api.notifyToast?.('สำรองข้อมูลลง Google Drive เรียบร้อยแล้ว');
        }
        const updatedList = await listDriveBackupFiles(token, fid);
        setFiles(updatedList);
        return true;
      } catch (err) {
        if (err instanceof DriveAuthExpiredError) {
          clearAccessToken();
          setNeedsAuth(true);
          setStatusMsg({ text: err.message, kind: 'warn' });
        } else if (!silent) {
          setStatusMsg({
            text: err instanceof Error ? err.message : 'สำรองข้อมูลไปยัง Google Drive ไม่สำเร็จ',
            kind: 'err',
          });
        }
        return false;
      } finally {
        if (!silent) setIsBusy(false);
      }
    },
    [folderId, user?.email]
  );

  // Register global sync callback for header backup indicator
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    win.kwDriveIsReady = !needsAuth && Boolean(user);
    win.kwDriveSyncNow = async (silentToast = false) => {
      return await performBackupToNewFile(silentToast);
    };
    return () => {
      win.kwDriveIsReady = false;
      win.kwDriveSyncNow = undefined;
    };
  }, [needsAuth, user, performBackupToNewFile]);

  // Auto-backup on data changes when signed in & enabled
  useEffect(() => {
    const onDataChanged = (ev: Event) => {
      if (!autoEnabled || needsAuth) return;
      const sig = (ev as CustomEvent)?.detail?.signature as string | undefined;
      if (lastSyncedSigRef.current === null && sig) {
        lastSyncedSigRef.current = sig;
        return;
      }
      if (sig && sig === lastSyncedSigRef.current) return;
      if (autoTimerRef.current) window.clearTimeout(autoTimerRef.current);
      autoTimerRef.current = window.setTimeout(() => {
        void performBackupToNewFile(true);
      }, 4000);
    };
    window.addEventListener('kumwatsadu-data-changed', onDataChanged);
    return () => {
      window.removeEventListener('kumwatsadu-data-changed', onDataChanged);
      if (autoTimerRef.current) window.clearTimeout(autoTimerRef.current);
    };
  }, [autoEnabled, needsAuth, performBackupToNewFile]);

  const toggleAutoEnabled = () => {
    const next = !autoEnabled;
    setAutoEnabled(next);
    try {
      localStorage.setItem(DRIVE_AUTO_KEY, next ? '1' : '0');
    } catch {
      // ignore
    }
    setStatusMsg({
      text: next
        ? 'เปิดสำรองข้อมูลอัตโนมัติลง Google Drive แล้ว (ทำงานเมื่อลงชื่อเข้าใช้ในเซสชันนี้)'
        : 'ปิดการสำรองอัตโนมัติลง Google Drive แล้ว',
      kind: next ? 'ok' : 'muted',
    });
  };

  const prepareRestoreFromDrive = async (file: DriveBackupFile) => {
    const token = await getAccessToken();
    if (!token) {
      setNeedsAuth(true);
      setStatusMsg({ text: 'กรุณากด Sign in with Google เพื่อดึงไฟล์จาก Google Drive', kind: 'warn' });
      return;
    }
    setIsBusy(true);
    try {
      const rawText = await downloadDriveBackup(token, file.id);
      const parsed = JSON.parse(rawText);
      if (parsed?.app !== 'kongchang-stock' || !Array.isArray(parsed?.materials) || !Array.isArray(parsed?.moves)) {
        throw new Error('ไฟล์ที่เลือกไม่ใช่ไฟล์สำรองข้อมูลของระบบคุมวัสดุ');
      }
      setConfirmAction({
        type: 'restore',
        file,
        summary: {
          raw: parsed,
          materialsCount: parsed.materials.length,
          movesCount: parsed.moves.length,
          countsCount: Array.isArray(parsed.counts) ? parsed.counts.length : 0,
          exportedAt: parsed.exportedAt || file.modifiedTime || '',
        },
      });
    } catch (err) {
      if (err instanceof DriveAuthExpiredError) {
        setNeedsAuth(true);
        setStatusMsg({ text: err.message, kind: 'warn' });
      } else {
        setStatusMsg({
          text: err instanceof Error ? err.message : 'ไม่สามารถอ่านไฟล์สำรองจาก Google Drive ได้',
          kind: 'err',
        });
      }
    } finally {
      setIsBusy(false);
    }
  };

  const executeConfirmedAction = async () => {
    if (!confirmAction) return;
    const action = confirmAction;
    const token = await getAccessToken();
    if (!token) {
      setConfirmAction(null);
      setNeedsAuth(true);
      setStatusMsg({ text: 'สิทธิ์การเข้าถึงหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง', kind: 'warn' });
      return;
    }

    setIsBusy(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const api = (window as any).kwBackupApi;
      if (action.type === 'restore') {
        const restoredCount = await api?.restoreFromPayload?.(action.summary.raw, {
          replaceExisting: true,
          source: 'drive',
          email: user?.email || '',
        });
        const expIso = action.summary.exportedAt || action.file.modifiedTime || new Date().toISOString();
        setLastDriveAt(expIso);
        lastSyncedSigRef.current = api?.getDataSignature?.() || null;
        setConfirmAction(null);
        setStatusMsg({
          text: `กู้คืนข้อมูลจากไฟล์ ${action.file.name} สำเร็จ (${restoredCount ?? 0} รายการ)`,
          kind: 'ok',
        });
        api?.notifyToast?.('กู้คืนข้อมูลจาก Google Drive แล้ว');
      } else if (action.type === 'overwrite') {
        const payload = api?.getBackupJson?.();
        if (!payload) throw new Error('ไม่พบข้อมูลปัจจุบันสำหรับบันทึกทับ');
        await overwriteDriveBackup(token, action.file.id, JSON.stringify(payload, null, 1));
        const nowIso = new Date().toISOString();
        setLastDriveAt(nowIso);
        api?.recordExternalBackup?.('drive', nowIso, user?.email || '');
        lastSyncedSigRef.current = api?.getDataSignature?.() || null;
        setConfirmAction(null);
        setStatusMsg({
          text: `อัปเดตบันทึกทับไฟล์ ${action.file.name} ใน Google Drive เรียบร้อยแล้ว`,
          kind: 'ok',
        });
        api?.notifyToast?.('อัปเดตไฟล์ใน Google Drive แล้ว');
        await refreshFiles(token);
      } else if (action.type === 'delete') {
        await deleteDriveBackup(token, action.file.id);
        setConfirmAction(null);
        setStatusMsg({
          text: `ลบไฟล์สำรอง ${action.file.name} ออกจาก Google Drive แล้ว`,
          kind: 'ok',
        });
        api?.notifyToast?.('ลบไฟล์สำรองจาก Google Drive แล้ว');
        await refreshFiles(token);
      }
    } catch (err) {
      setConfirmAction(null);
      if (err instanceof DriveAuthExpiredError) {
        setNeedsAuth(true);
        setStatusMsg({ text: err.message, kind: 'warn' });
      } else {
        setStatusMsg({
          text: err instanceof Error ? err.message : 'ดำเนินการไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
          kind: 'err',
        });
      }
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="gdrive-section">
      <div className="gdrive-head">
        <div className="gdrive-title-wrap">
          <span className="gdrive-icon-badge" aria-hidden="true">
            <Cloud className="h-4 w-4" />
          </span>
          <div>
            <div className="gdrive-title">สำรองและกู้คืนข้อมูลบน Google Drive (ส่วนตัวตามบัญชีผู้ใช้)</div>
            <div className="sub">
              ผู้ใช้งานแต่ละคนลงชื่อเข้าใช้ด้วยบัญชี Google ของตนเอง หากมีไฟล์ที่เคยสำรองไว้ระบบจะดึงข้อมูลเข้ามาให้อัตโนมัติ
            </div>
          </div>
        </div>
      </div>

      {needsAuth ? (
        <div className="gdrive-auth-box">
          <div className="gdrive-auth-info">
            <div className="abst" style={{ margin: 0 }}>
              {lastDriveAt ? (
                <>
                  เคยสำรองข้อมูลบน Google Drive ล่าสุดเมื่อ <b>{formatThaiDateTime(lastDriveAt)}</b>
                  {lastDriveEmail ? ` (${lastDriveEmail})` : ''} · ลงชื่อเข้าใช้เพื่อซิงค์หรือดึงข้อมูลสำรองจาก Drive ของคุณ
                </>
              ) : (
                'ยังไม่ได้เชื่อมต่อบัญชี Google Drive ในเซสชันนี้ · กดปุ่มด้านขวาเพื่อเข้าสู่ระบบด้วยบัญชี Google ของคุณ'
              )}
            </div>
          </div>

          <button
            type="button"
            className="gsi-material-button"
            onClick={handleLogin}
            disabled={isLoggingIn}
            aria-label="Sign in with Google"
          >
            <div className="gsi-material-button-state"></div>
            <div className="gsi-material-button-content-wrapper">
              <div className="gsi-material-button-icon">
                <svg
                  version="1.1"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 48 48"
                  style={{ display: 'block' }}
                >
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                  ></path>
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                  ></path>
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                  ></path>
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  ></path>
                  <path fill="none" d="M0 0h48v48H0z"></path>
                </svg>
              </div>
              <span className="gsi-material-button-contents">
                {isLoggingIn ? 'กำลังเข้าสู่ระบบ...' : 'Sign in with Google'}
              </span>
              <span style={{ display: 'none' }}>Sign in with Google</span>
            </div>
          </button>
        </div>
      ) : (
        <div className="gdrive-connected">
          <div className="gdrive-user-bar">
            <div className="gdrive-user-meta">
              <div className="gdrive-user-badge">
                <Check className="h-3.5 w-3.5" />
                <span>เชื่อมต่อแล้ว</span>
              </div>
              <div className="gdrive-user-email">
                <b>{user?.displayName || 'บัญชี Google'}</b>
                {user?.email ? <span className="sub"> ({user.email})</span> : null}
              </div>
              <div className="gdrive-folder-tag">
                <Folder className="h-3.5 w-3.5" />
                <span>โฟลเดอร์: {DRIVE_BACKUP_FOLDER_NAME}</span>
                {lastDriveAt ? <span> · สำรองล่าสุด {formatThaiDateTime(lastDriveAt)}</span> : null}
              </div>
            </div>

            <div className="gdrive-user-actions">
              <button
                type="button"
                className="btn primary"
                onClick={() => void performBackupToNewFile(false)}
                disabled={isBusy}
              >
                <CloudUpload className="h-4 w-4" />
                <span>{isBusy ? 'กำลังบันทึก...' : 'สำรองไปยัง Google Drive เดี๋ยวนี้'}</span>
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => void refreshFiles()}
                disabled={isLoadingFiles || isBusy}
                title="รีเฟรชรายการไฟล์ใน Google Drive"
              >
                <RefreshCw className={`h-4 w-4${isLoadingFiles ? ' animate-spin' : ''}`} />
                <span>รีเฟรช</span>
              </button>
              <button
                type="button"
                className="btn"
                onClick={handleLogout}
                disabled={isBusy}
                title="ออกจากระบบหรือเปลี่ยนบัญชี Google"
              >
                <LogOut className="h-4 w-4" />
                <span>เปลี่ยนบัญชี / ออกจากระบบ</span>
              </button>
            </div>
          </div>

          <label className="gdrive-auto-toggle">
            <input type="checkbox" checked={autoEnabled} onChange={toggleAutoEnabled} />
            <span>สำรองอัตโนมัติลง Google Drive ทุกครั้งที่มีการแก้ไขข้อมูล (เฉพาะระหว่างที่ลงชื่อเข้าใช้)</span>
          </label>

          <div className="gdrive-files-box">
            <div className="gdrive-files-head">
              <span>ไฟล์สำรองใน Google Drive ของคุณ ({files.length} ไฟล์)</span>
              <span className="sub">บันทึกในโฟลเดอร์ “{DRIVE_BACKUP_FOLDER_NAME}”</span>
            </div>

            {isLoadingFiles && files.length === 0 ? (
              <div className="gdrive-empty">กำลังโหลดรายการไฟล์สำรองจาก Google Drive...</div>
            ) : files.length === 0 ? (
              <div className="gdrive-empty">
                ยังไม่มีไฟล์สำรองใน Google Drive ของบัญชีนี้ · กดปุ่ม “สำรองไปยัง Google Drive เดี๋ยวนี้” เพื่อสร้างไฟล์แรก
              </div>
            ) : (
              <div className="gdrive-file-list">
                {files.map((f) => (
                  <div className="gdrive-file-row" key={f.id}>
                    <div className="gdrive-file-main">
                      <FileJson className="h-4 w-4 gdrive-file-ic" />
                      <div className="gdrive-file-text">
                        <div className="gdrive-file-name" title={f.name}>
                          {f.name}
                        </div>
                        <div className="sub">
                          แก้ไขเมื่อ {formatThaiDateTime(f.modifiedTime || f.createdTime)} · ขนาด {formatBytes(f.size)}
                        </div>
                      </div>
                    </div>
                    <div className="gdrive-file-acts">
                      <button
                        type="button"
                        className="btn small"
                        onClick={() => void prepareRestoreFromDrive(f)}
                        disabled={isBusy}
                        title="กู้คืนข้อมูลจากไฟล์สำรองนี้ลงในเครื่อง"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>กู้คืน</span>
                      </button>
                      <button
                        type="button"
                        className="btn small"
                        onClick={() => setConfirmAction({ type: 'overwrite', file: f })}
                        disabled={isBusy}
                        title="บันทึกข้อมูลปัจจุบันทับไฟล์นี้ใน Google Drive"
                      >
                        <CloudUpload className="h-3.5 w-3.5" />
                        <span>บันทึกทับ</span>
                      </button>
                      <button
                        type="button"
                        className="btn small danger"
                        onClick={() => setConfirmAction({ type: 'delete', file: f })}
                        disabled={isBusy}
                        title="ลบไฟล์สำรองนี้ออกจาก Google Drive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>ลบ</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {statusMsg.text ? (
        <div
          className={`abst ${statusMsg.kind === 'ok' ? 'ok' : statusMsg.kind === 'warn' || statusMsg.kind === 'err' ? 'warn' : ''}`}
          style={{ marginTop: 10, marginBottom: 0 }}
        >
          {statusMsg.text}
        </div>
      ) : null}

      {/* Explicit Confirmation Modal for Mutating / Destructive Operations & Account-Switch Restore */}
      {confirmAction ? (
        <div
          className="modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gdConfirmTitle"
          style={{ alignItems: 'center', justifyContent: 'center' }}
        >
          <div className="mv-detail-box" style={{ width: 'min(500px, 100%)' }}>
            <div className="mv-detail-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <ShieldAlert
                  className="h-5 w-5"
                  style={{ color: confirmAction.type === 'delete' ? 'var(--bad)' : 'var(--warn)' }}
                />
                <div>
                  <h3 id="gdConfirmTitle">
                    {confirmAction.type === 'restore'
                      ? confirmAction.isAutoPrompt
                        ? confirmAction.isDifferentUser
                          ? 'พบบัญชี Google Drive ใหม่ที่มีไฟล์สำรองอยู่'
                          : 'พบไฟล์สำรองใน Google Drive ของคุณ'
                        : 'ยืนยันการกู้คืนข้อมูลจาก Google Drive'
                      : confirmAction.type === 'overwrite'
                      ? 'ยืนยันการบันทึกทับไฟล์บน Google Drive'
                      : 'ยืนยันการลบไฟล์สำรองจาก Google Drive'}
                  </h3>
                  <div className="sub">บัญชี: {user?.email || 'Google Drive ส่วนตัว'}</div>
                </div>
              </div>
            </div>
            <div className="mv-detail-body" style={{ gap: 10 }}>
              <div className="mv-kv-grid" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
                <div className="mv-kv">
                  <span className="mv-kv-k">ชื่อไฟล์ใน Google Drive</span>
                  <span className="mv-kv-v">{confirmAction.file.name}</span>
                </div>
                {confirmAction.type === 'restore' ? (
                  <>
                    <div className="mv-kv">
                      <span className="mv-kv-k">วันที่สำรองข้อมูลใน Drive</span>
                      <span className="mv-kv-v">{formatThaiDateTime(confirmAction.summary.exportedAt)}</span>
                    </div>
                    <div className="mv-kv">
                      <span className="mv-kv-k">ข้อมูลในไฟล์สำรองบน Drive</span>
                      <span className="mv-kv-v">
                        วัสดุ {confirmAction.summary.materialsCount} รายการ · ใบรับ-ใบเบิก {confirmAction.summary.movesCount}{' '}
                        ใบ · ตรวจนับ {confirmAction.summary.countsCount} ปีงบ
                      </span>
                    </div>
                    {confirmAction.localSummary ? (
                      <div className="mv-kv">
                        <span className="mv-kv-k">ข้อมูลที่มีอยู่ในเครื่องตอนนี้</span>
                        <span className="mv-kv-v">
                          วัสดุ {confirmAction.localSummary.materials} รายการ · ใบรับ-ใบเบิก{' '}
                          {confirmAction.localSummary.moves} ใบ · ตรวจนับ {confirmAction.localSummary.counts} ปีงบ
                        </span>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="mv-kv">
                    <span className="mv-kv-k">แก้ไขล่าสุด</span>
                    <span className="mv-kv-v">
                      {formatThaiDateTime(confirmAction.file.modifiedTime || confirmAction.file.createdTime)}
                    </span>
                  </div>
                )}
              </div>
              <p className="sub" style={{ margin: 0, lineHeight: 1.5 }}>
                {confirmAction.type === 'restore'
                  ? 'การดึงข้อมูลจาก Google Drive จะนำข้อมูลจากไฟล์สำรองนี้มาใช้งานแทนข้อมูลในเครื่องปัจจุบัน'
                  : confirmAction.type === 'overwrite'
                  ? 'เนื้อหาของไฟล์สำรองนี้บน Google Drive จะถูกเขียนทับด้วยข้อมูลล่าสุดจากเครื่องของคุณทันที'
                  : 'ไฟล์สำรองนี้จะถูกลบออกจาก Google Drive ของคุณ และอาจไม่สามารถกู้คืนได้'}
              </p>
            </div>
            <div className="mv-detail-foot">
              <button
                type="button"
                className="btn"
                onClick={() => setConfirmAction(null)}
                disabled={isBusy}
              >
                {confirmAction.type === 'restore' && confirmAction.isAutoPrompt ? 'คงข้อมูลในเครื่องไว้' : 'ยกเลิก'}
              </button>
              <button
                type="button"
                className={`btn ${confirmAction.type === 'delete' ? 'danger' : 'primary'}`}
                onClick={() => void executeConfirmedAction()}
                disabled={isBusy}
              >
                {isBusy
                  ? 'กำลังดำเนินการ...'
                  : confirmAction.type === 'restore'
                  ? 'ดึงข้อมูลจาก Google Drive มาใช้งาน'
                  : confirmAction.type === 'overwrite'
                  ? 'ยืนยันบันทึกทับไฟล์'
                  : 'ยืนยันลบไฟล์'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
