import React, { useState } from 'react';
import { User } from 'firebase/auth';
import {
  ShieldCheck,
  Laptop,
  Smartphone,
  Clock,
  RefreshCw,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Copy,
  Check,
  Send,
  WifiOff,
} from 'lucide-react';
import {
  AccessRequestDoc,
  AccessRegistrationForm,
  OWNER_ADMIN_EMAIL,
  OFFLINE_GRACE_DAYS,
  parseDeviceLabels,
} from './accessControl';

export type GateReason =
  | 'loading'
  | 'unauthenticated'
  | 'unverified_email'
  | 'needs_registration'
  | 'pending'
  | 'rejected'
  | 'revoked'
  | 'expired'
  | 'device_unbound'
  | 'device_limit_reached'
  | 'offline_30d_expired'
  | 'offline_no_cache';

interface AccessGateProps {
  reason: GateReason;
  user: User | null;
  deviceId: string;
  deviceLabel: string;
  accessDoc: AccessRequestDoc | null;
  busy: boolean;
  errorMsg: string;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onRefreshStatus: () => Promise<void>;
  onSubmitRegistration: (form: AccessRegistrationForm) => Promise<void>;
  onRequestDeviceBind: (note: string) => Promise<void>;
}

export const AccessGate: React.FC<AccessGateProps> = ({
  reason,
  user,
  deviceId,
  deviceLabel,
  accessDoc,
  busy,
  errorMsg,
  onSignIn,
  onSignOut,
  onRefreshStatus,
  onSubmitRegistration,
  onRequestDeviceBind,
}) => {
  const [fullName, setFullName] = useState<string>(() => accessDoc?.fullName || user?.displayName || '');
  const [orgName, setOrgName] = useState<string>(() => accessDoc?.orgName || '');
  const [position, setPosition] = useState<string>(() => accessDoc?.position || '');
  const [phone, setPhone] = useState<string>(() => accessDoc?.phone || '');
  const [note, setNote] = useState<string>(() => accessDoc?.note || '');
  const [editingPending, setEditingPending] = useState<boolean>(false);
  const [deviceNote, setDeviceNote] = useState<string>('');
  const [copiedInfo, setCopiedInfo] = useState<boolean>(false);

  const boundIds = accessDoc?.approvedDeviceIds || [];
  const boundLabels = parseDeviceLabels(accessDoc?.approvedDeviceLabels || '');
  const maxDevices = accessDoc?.maxDevices || 2;
  const isThisDevicePending = Boolean(accessDoc?.pendingDeviceId && accessDoc.pendingDeviceId === deviceId);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmitRegistration({
      fullName: fullName || user?.displayName || '',
      orgName,
      position,
      phone,
      note,
    });
    setEditingPending(false);
  };

  const handleCopySummary = async () => {
    const lines = [
      'ขออนุมัติสิทธิ์เข้าใช้งานระบบคุมวัสดุ',
      `ชื่อ-สกุล: ${accessDoc?.fullName || fullName || '-'}`,
      `หน่วยงาน: ${accessDoc?.orgName || orgName || '-'}`,
      `ตำแหน่ง: ${accessDoc?.position || position || '-'}`,
      `อีเมล: ${user?.email || accessDoc?.email || '-'}`,
      `อุปกรณ์: ${deviceLabel}`,
      `รหัสเครื่อง: ${deviceId}`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopiedInfo(true);
      setTimeout(() => setCopiedInfo(false), 2500);
    } catch {
      // ignore clipboard errors
    }
  };

  if (reason === 'loading') {
    return (
      <div className="access-gate-shell">
        <div className="access-gate-card access-gate-loading">
          <div className="access-gate-badge">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h1>ระบบคุมวัสดุ</h1>
          <p>กำลังตรวจสอบสิทธิ์การเข้าใช้งานและรหัสเครื่อง...</p>
          <div className="access-spinner" aria-hidden="true" />
        </div>
      </div>
    );
  }

  return (
    <div className="access-gate-shell">
      <div className="access-gate-card">
        <div className="access-gate-header">
          <div className="access-gate-badge">
            <Lock className="h-6 w-6" />
          </div>
          <div>
            <div className="access-gate-eyebrow">ระบบควบคุมสิทธิ์การใช้งาน</div>
            <h1>ระบบคุมวัสดุ — ลงทะเบียนและยืนยันสิทธิ์</h1>
          </div>
        </div>

        <div className="access-device-strip">
          <div className="access-device-meta">
            {/Android|iPhone|iPad/i.test(deviceLabel) ? (
              <Smartphone className="h-4 w-4 shrink-0" />
            ) : (
              <Laptop className="h-4 w-4 shrink-0" />
            )}
            <span>
              เครื่องนี้: <strong>{deviceLabel}</strong>
            </span>
          </div>
          <code className="access-device-code" title="รหัสประจำเครื่องนี้">
            {deviceId}
          </code>
        </div>

        {errorMsg && (
          <div className="access-alert is-error" role="alert">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {reason === 'unauthenticated' && (
          <div className="access-gate-body">
            <div className="access-policy-box">
              <div className="access-policy-title">เงื่อนไขการเข้าใช้งานและปกป้องสิทธิ์ผู้พัฒนา</div>
              <ul>
                <li>
                  ต้องเข้าสู่ระบบด้วยบัญชี <strong>Google</strong> เพื่อลงทะเบียนและส่งคำขอสิทธิ์ไปยังเจ้าของระบบ (
                  <code>{OWNER_ADMIN_EMAIL}</code>)
                </li>
                <li>
                  จำกัดการใช้งานสูงสุด <strong>2 เครื่องต่อ 1 บัญชี</strong> (เช่น คอมพิวเตอร์ 1 + มือถือ 1)
                </li>
                <li>
                  เมื่อได้รับอนุมัติแล้ว ระบบจะจำสิทธิ์ไว้ในเครื่องนี้ให้ใช้งานได้ทันที รวมถึงแบบออฟไลน์ (บังคับต่อเน็ตยืนยันสิทธิ์ซ้ำทุก{' '}
                  <strong>{OFFLINE_GRACE_DAYS} วัน</strong>)
                </li>
              </ul>
            </div>

            <div className="access-signin-wrap">
              <button
                type="button"
                className="gsi-material-button access-google-btn"
                onClick={() => void onSignIn()}
                disabled={busy}
              >
                <div className="gsi-material-button-state" />
                <div className="gsi-material-button-content-wrapper">
                  <div className="gsi-material-button-icon">
                    <svg viewBox="0 0 48 48" width="20" height="20">
                      <path
                        fill="#EA4335"
                        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                      />
                      <path
                        fill="#4285F4"
                        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                      />
                      <path
                        fill="#34A853"
                        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                      />
                    </svg>
                  </div>
                  <span className="gsi-material-button-contents">
                    {busy ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบด้วย Google เพื่อขอสิทธิ์ / ใช้งาน'}
                  </span>
                </div>
              </button>
            </div>
          </div>
        )}

        {user && (
          <div className="access-account-bar">
            <div className="access-account-info">
              <div className="access-account-avatar">{(user.displayName || user.email || 'U').charAt(0).toUpperCase()}</div>
              <div>
                <div className="access-account-name">{user.displayName || 'ผู้ใช้งาน Google'}</div>
                <div className="access-account-email">{user.email}</div>
              </div>
            </div>
            <button type="button" className="btn-ghost-sm" onClick={() => void onSignOut()} disabled={busy}>
              <LogOut className="h-3.5 w-3.5" />
              <span>เปลี่ยนบัญชี</span>
            </button>
          </div>
        )}

        {reason === 'unverified_email' && (
          <div className="access-gate-body">
            <div className="access-alert is-warn">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>บัญชี Google นี้ยังไม่ได้ยืนยันอีเมล จึงไม่สามารถขอสิทธิ์เข้าใช้งานได้</span>
            </div>
          </div>
        )}

        {(reason === 'offline_30d_expired' || reason === 'offline_no_cache') && (
          <div className="access-gate-body">
            <div className="access-alert is-warn">
              <WifiOff className="h-5 w-5 shrink-0" />
              <div>
                <strong>
                  {reason === 'offline_30d_expired'
                    ? `ครบกำหนด ${OFFLINE_GRACE_DAYS} วันสำหรับการยืนยันสิทธิ์แบบออฟไลน์`
                    : 'ยังไม่มีข้อมูลการยืนยันสิทธิ์ของเครื่องนี้ในโหมดออฟไลน์'}
                </strong>
                <div className="text-sm mt-1">
                  กรุณาเชื่อมต่ออินเทอร์เน็ตแล้วกดปุ่ม “ตรวจสอบสิทธิ์ออนไลน์” เพื่อยืนยันสถานะล่าสุดกับฐานข้อมูลกลาง
                </div>
              </div>
            </div>
            <div className="access-actions-row">
              <button
                type="button"
                className="btn-primary-emerald"
                onClick={() => void onRefreshStatus()}
                disabled={busy}
              >
                <RefreshCw className={`h-4 w-4${busy ? ' animate-spin' : ''}`} />
                <span>{busy ? 'กำลังตรวจสอบ...' : 'ตรวจสอบสิทธิ์ออนไลน์'}</span>
              </button>
            </div>
          </div>
        )}

        {(reason === 'needs_registration' || reason === 'rejected' || (reason === 'pending' && editingPending)) && (
          <form className="access-gate-form" onSubmit={handleFormSubmit}>
            {reason === 'rejected' && (
              <div className="access-alert is-error">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <div>
                  <strong>คำขอครั้งก่อนไม่ได้รับการอนุมัติ</strong>
                  {accessDoc?.note ? <div className="text-sm mt-0.5">หมายเหตุ: {accessDoc.note}</div> : null}
                  <div className="text-sm mt-0.5">คุณสามารถแก้ไขข้อมูลด้านล่างแล้วส่งคำขอใหม่ได้</div>
                </div>
              </div>
            )}

            <div className="access-form-grid">
              <label>
                ชื่อ - นามสกุลผู้ใช้งาน <span className="req">*</span>
                <input
                  required
                  minLength={2}
                  maxLength={120}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="ระบุชื่อ-นามสกุลจริง"
                />
              </label>
              <label>
                ชื่อหน่วยงาน / อปท. <span className="req">*</span>
                <input
                  required
                  minLength={2}
                  maxLength={180}
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="เช่น องค์การบริหารส่วนตำบลไร่ใต้"
                />
              </label>
              <label>
                ตำแหน่ง
                <input
                  maxLength={120}
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  placeholder="เช่น เจ้าพนักงานพัสดุ"
                />
              </label>
              <label>
                เบอร์โทรศัพท์ติดต่อ
                <input
                  maxLength={40}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="เช่น 08x-xxx-xxxx"
                />
              </label>
              <label className="is-full">
                หมายเหตุถึงเจ้าของระบบ (ถ้ามี)
                <textarea
                  rows={2}
                  maxLength={300}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="ระบุรายละเอียดเพิ่มเติม เช่น ขอใช้บนเครื่องคอมพิวเตอร์สำนักงาน"
                />
              </label>
            </div>

            <div className="access-actions-row">
              <button type="submit" className="btn-primary-emerald" disabled={busy}>
                <Send className="h-4 w-4" />
                <span>{busy ? 'กำลังส่งคำขอ...' : 'ส่งคำขอสิทธิ์ไปยังเจ้าของระบบ'}</span>
              </button>
              {editingPending && (
                <button type="button" className="btn-ghost-sm" onClick={() => setEditingPending(false)}>
                  ยกเลิก
                </button>
              )}
            </div>
          </form>
        )}

        {reason === 'pending' && !editingPending && accessDoc && (
          <div className="access-gate-body">
            <div className="access-status-card is-pending">
              <div className="access-status-head">
                <Clock className="h-5 w-5" />
                <strong>ส่งคำขอสิทธิ์เรียบร้อยแล้ว — กำลังรอเจ้าของระบบอนุมัติ</strong>
              </div>
              <div className="access-status-details">
                <div>
                  <span>ผู้ขอสิทธิ์:</span> {accessDoc.fullName} ({accessDoc.orgName})
                </div>
                <div>
                  <span>บัญชี Google:</span> {accessDoc.email}
                </div>
                <div>
                  <span>รหัสเครื่องที่ขอ:</span> <code>{accessDoc.pendingDeviceId || deviceId}</code>
                </div>
                <div>
                  <span>ผู้พิจารณาสิทธิ์:</span> {OWNER_ADMIN_EMAIL}
                </div>
              </div>
            </div>

            <div className="access-actions-row">
              <button
                type="button"
                className="btn-primary-emerald"
                onClick={() => void onRefreshStatus()}
                disabled={busy}
              >
                <RefreshCw className={`h-4 w-4${busy ? ' animate-spin' : ''}`} />
                <span>{busy ? 'กำลังตรวจสอบ...' : 'ตรวจสอบสถานะล่าสุด'}</span>
              </button>
              <button type="button" className="btn-outline-emerald" onClick={() => void handleCopySummary()}>
                {copiedInfo ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span>{copiedInfo ? 'คัดลอกข้อมูลแล้ว' : 'คัดลอกข้อมูลแจ้งผู้ดูแลระบบ'}</span>
              </button>
              <button type="button" className="btn-ghost-sm" onClick={() => setEditingPending(true)}>
                แก้ไขข้อมูลคำขอ
              </button>
            </div>
          </div>
        )}

        {(reason === 'device_unbound' || reason === 'device_limit_reached') && accessDoc && (
          <div className="access-gate-body">
            <div className={`access-status-card ${reason === 'device_limit_reached' ? 'is-error' : 'is-warn'}`}>
              <div className="access-status-head">
                <AlertTriangle className="h-5 w-5" />
                <strong>
                  {reason === 'device_limit_reached'
                    ? `บัญชีนี้ใช้งานครบสิทธิ์ ${maxDevices}/${maxDevices} เครื่องแล้ว`
                    : `บัญชีได้รับอนุมัติแล้ว (${boundIds.length}/${maxDevices} เครื่อง) แต่เครื่องนี้ยังไม่ได้ผูกสิทธิ์`}
                </strong>
              </div>
              <div className="access-status-details">
                <div>
                  <span>ผู้ถือสิทธิ์:</span> {accessDoc.fullName} · {accessDoc.orgName}
                </div>
                <div>
                  <span>เครื่องที่ผูกสิทธิ์ไว้แล้ว:</span>
                  <ul className="access-bound-list">
                    {boundIds.map((id, idx) => (
                      <li key={id}>
                        เครื่องที่ {idx + 1}: <strong>{boundLabels[idx] || 'อุปกรณ์ที่ลงทะเบียน'}</strong> (
                        <code>{id}</code>)
                      </li>
                    ))}
                  </ul>
                </div>
                {isThisDevicePending && (
                  <div className="access-inline-ok">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>ส่งคำขอผูกเครื่องนี้ไปแล้ว กำลังรอเจ้าของระบบอนุมัติ</span>
                  </div>
                )}
              </div>
            </div>

            {!isThisDevicePending ? (
              <div className="access-gate-form">
                <label className="is-full">
                  หมายเหตุประกอบคำขอ{reason === 'device_limit_reached' ? 'ย้ายเครื่อง / เปลี่ยนเครื่อง' : 'เพิ่มเครื่องที่ 2'}
                  <input
                    maxLength={300}
                    value={deviceNote}
                    onChange={(e) => setDeviceNote(e.target.value)}
                    placeholder={
                      reason === 'device_limit_reached'
                        ? 'เช่น เปลี่ยนเครื่องคอมพิวเตอร์ใหม่ ขอแทนที่เครื่องเดิม'
                        : 'เช่น ขอเพิ่มการใช้งานบนมือถือส่วนตัว'
                    }
                  />
                </label>
                <div className="access-actions-row">
                  <button
                    type="button"
                    className="btn-primary-emerald"
                    disabled={busy}
                    onClick={() =>
                      void onRequestDeviceBind(
                        deviceNote ||
                          (reason === 'device_limit_reached'
                            ? 'ขอเปลี่ยน/ย้ายเครื่องแทนเครื่องเดิม'
                            : 'ขออนุมัติเพิ่มเครื่องที่ 2')
                      )
                    }
                  >
                    <Send className="h-4 w-4" />
                    <span>
                      {busy
                        ? 'กำลังส่งคำขอ...'
                        : reason === 'device_limit_reached'
                        ? 'ส่งคำขอย้ายเครื่องให้เจ้าของระบบอนุมัติ'
                        : 'ส่งคำขออนุมัติเพิ่มเครื่องที่ 2'}
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="access-actions-row">
                <button
                  type="button"
                  className="btn-primary-emerald"
                  onClick={() => void onRefreshStatus()}
                  disabled={busy}
                >
                  <RefreshCw className={`h-4 w-4${busy ? ' animate-spin' : ''}`} />
                  <span>{busy ? 'กำลังตรวจสอบ...' : 'ตรวจสอบสถานะการอนุมัติ'}</span>
                </button>
                <button type="button" className="btn-outline-emerald" onClick={() => void handleCopySummary()}>
                  {copiedInfo ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  <span>{copiedInfo ? 'คัดลอกข้อมูลแล้ว' : 'คัดลอกรหัสเครื่องแจ้งผู้ดูแล'}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {(reason === 'revoked' || reason === 'expired') && (
          <div className="access-gate-body">
            <div className="access-alert is-error">
              <Lock className="h-5 w-5 shrink-0" />
              <div>
                <strong>
                  {reason === 'revoked'
                    ? 'สิทธิ์การเข้าใช้งานของบัญชีนี้ถูกระงับแล้ว'
                    : `สิทธิ์การใช้งานหมดอายุแล้ว (${accessDoc?.expiresAt || ''})`}
                </strong>
                {accessDoc?.note ? <div className="text-sm mt-1">หมายเหตุ: {accessDoc.note}</div> : null}
                <div className="text-sm mt-1">กรุณาติดต่อเจ้าของระบบ ({OWNER_ADMIN_EMAIL}) เพื่อปลดล็อกหรือต่ออายุสิทธิ์</div>
              </div>
            </div>
            <div className="access-actions-row">
              <button
                type="button"
                className="btn-outline-emerald"
                onClick={() => void onRefreshStatus()}
                disabled={busy}
              >
                <RefreshCw className={`h-4 w-4${busy ? ' animate-spin' : ''}`} />
                <span>ตรวจสอบสถานะอีกครั้ง</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
