import React, { useMemo, useState } from 'react';
import {
  ShieldCheck,
  X,
  CheckCircle2,
  XCircle,
  Ban,
  Trash2,
  Laptop,
  Search,
  Clock,
  RefreshCw,
  KeyRound,
} from 'lucide-react';
import {
  AccessRequestDoc,
  adminApproveRequest,
  adminClearPendingDevice,
  adminDeleteRequest,
  adminRejectRequest,
  adminRemoveBoundDevice,
  adminResetUserPassword,
  adminRevokeRequest,
  parseDeviceLabels,
} from './accessControl';

interface AdminAccessModalProps {
  open: boolean;
  onClose: () => void;
  requests: AccessRequestDoc[];
  loading: boolean;
  errorMsg: string;
}

type FilterTab = 'pending' | 'approved' | 'blocked' | 'all';

function formatTs(ts: AccessRequestDoc['updatedAt']): string {
  if (!ts) return '—';
  try {
    const d = ts.toDate();
    return d.toLocaleString('th-TH', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return '—';
  }
}

export const AdminAccessModal: React.FC<AdminAccessModalProps> = ({
  open,
  onClose,
  requests,
  loading,
  errorMsg,
}) => {
  const [filter, setFilter] = useState<FilterTab>('pending');
  const [search, setSearch] = useState<string>('');
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string>('');
  const [expiryDrafts, setExpiryDrafts] = useState<Record<string, string>>({});
  const [confirmState, setConfirmState] = useState<{
    uid: string;
    title: string;
    message: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  const counts = useMemo(() => {
    const pending = requests.filter((r) => r.status === 'pending' || Boolean(r.pendingDeviceId)).length;
    const approved = requests.filter((r) => r.status === 'approved').length;
    const blocked = requests.filter((r) => r.status === 'rejected' || r.status === 'revoked').length;
    return { pending, approved, blocked, all: requests.length };
  }, [requests]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((r) => {
      if (filter === 'pending' && r.status !== 'pending' && !r.pendingDeviceId) return false;
      if (filter === 'approved' && r.status !== 'approved') return false;
      if (filter === 'blocked' && r.status !== 'rejected' && r.status !== 'revoked') return false;
      if (!q) return true;
      return [r.fullName, r.email, r.orgName, r.position, r.phone, r.pendingDeviceId]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [requests, filter, search]);

  if (!open) return null;

  const runAction = async (uid: string, fn: () => Promise<void>) => {
    setBusyUid(uid);
    setActionErr('');
    try {
      await fn();
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : 'ดำเนินการไม่สำเร็จ');
    } finally {
      setBusyUid(null);
    }
  };

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="adminAccessTitle">
      <div className="bar">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-700" />
          <strong id="adminAccessTitle">จัดการสิทธิ์ผู้ใช้งานและเครื่องที่ลงทะเบียน (Admin)</strong>
        </div>
        <button type="button" className="btn-ghost-sm" onClick={onClose}>
          <X className="h-4 w-4" />
          <span>ปิด</span>
        </button>
      </div>

      <div className="scroll">
        <div className="admin-access-wrap">
          <div className="admin-access-kpis">
            <div className="admin-kpi">
              <span>รออนุมัติ / ขอเพิ่มเครื่อง</span>
              <strong>{counts.pending}</strong>
            </div>
            <div className="admin-kpi">
              <span>อนุมัติแล้ว</span>
              <strong>{counts.approved}</strong>
            </div>
            <div className="admin-kpi">
              <span>ปฏิเสธ / ระงับสิทธิ์</span>
              <strong>{counts.blocked}</strong>
            </div>
            <div className="admin-kpi">
              <span>คำขอทั้งหมด</span>
              <strong>{counts.all}</strong>
            </div>
          </div>

          <div className="admin-access-toolbar">
            <div className="admin-filter-pills">
              <button
                type="button"
                className={filter === 'pending' ? 'is-active' : ''}
                onClick={() => setFilter('pending')}
              >
                รอดำเนินการ ({counts.pending})
              </button>
              <button
                type="button"
                className={filter === 'approved' ? 'is-active' : ''}
                onClick={() => setFilter('approved')}
              >
                ใช้งานอยู่ ({counts.approved})
              </button>
              <button
                type="button"
                className={filter === 'blocked' ? 'is-active' : ''}
                onClick={() => setFilter('blocked')}
              >
                ระงับ/ปฏิเสธ ({counts.blocked})
              </button>
              <button
                type="button"
                className={filter === 'all' ? 'is-active' : ''}
                onClick={() => setFilter('all')}
              >
                ทั้งหมด ({counts.all})
              </button>
            </div>
            <div className="admin-search-box">
              <Search className="h-4 w-4" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหาชื่อ, อีเมล, หน่วยงาน หรือรหัสเครื่อง..."
              />
            </div>
          </div>

          {(errorMsg || actionErr) && (
            <div className="access-alert is-error">
              <span>{actionErr || errorMsg}</span>
            </div>
          )}

          {loading ? (
            <div className="admin-empty-box">
              <RefreshCw className="h-5 w-5 animate-spin" />
              <span>กำลังโหลดรายการคำขอจากฐานข้อมูลกลาง...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="admin-empty-box">
              <Clock className="h-5 w-5" />
              <span>ไม่มีรายการในหมวดนี้</span>
            </div>
          ) : (
            <div className="admin-request-list">
              {filtered.map((req) => {
                const boundIds = req.approvedDeviceIds || [];
                const boundLabels = parseDeviceLabels(req.approvedDeviceLabels || '');
                const maxDev = req.maxDevices || 2;
                const isFull = boundIds.length >= maxDev;
                const expiryVal = expiryDrafts[req.uid] ?? req.expiresAt ?? '';
                const isBusy = busyUid === req.uid;

                return (
                  <div key={req.uid} className="admin-request-card">
                    <div className="admin-req-head">
                      <div>
                        <div className="admin-req-name">
                          {req.fullName} <span className="admin-req-org">· {req.orgName}</span>
                        </div>
                        <div className="admin-req-sub">
                          {req.email}
                          {req.position ? ` · ${req.position}` : ''}
                          {req.phone ? ` · โทร ${req.phone}` : ''}
                        </div>
                      </div>
                      <div className="admin-req-badges">
                        <span className={`admin-status-badge is-${req.status}`}>
                          {req.status === 'pending'
                            ? 'รออนุมัติ'
                            : req.status === 'approved'
                            ? 'อนุมัติแล้ว'
                            : req.status === 'rejected'
                            ? 'ปฏิเสธแล้ว'
                            : 'ระงับสิทธิ์'}
                        </span>
                        <span className="admin-dev-count">
                          ผูกแล้ว {boundIds.length}/{maxDev} เครื่อง
                        </span>
                      </div>
                    </div>

                    {req.note && <div className="admin-req-note">หมายเหตุ: {req.note}</div>}

                    <div className="admin-req-devices">
                      {boundIds.map((devId, idx) => (
                        <div key={devId} className="admin-dev-row">
                          <Laptop className="h-4 w-4 shrink-0 text-emerald-700" />
                          <span className="admin-dev-info">
                            เครื่องที่ {idx + 1}: <strong>{boundLabels[idx] || 'อุปกรณ์ที่ลงทะเบียน'}</strong> (
                            <code>{devId}</code>)
                          </span>
                          <button
                            type="button"
                            className="btn-mini-danger"
                            disabled={isBusy}
                            onClick={() =>
                              setConfirmState({
                                uid: req.uid,
                                title: 'ยืนยันถอดสิทธิ์เครื่องนี้',
                                message: `ต้องการถอดสิทธิ์เครื่องที่ ${idx + 1} (${boundLabels[idx] || devId}) ของคุณ ${req.fullName} หรือไม่?`,
                                onConfirm: () =>
                                  runAction(req.uid, () => adminRemoveBoundDevice(req, idx)),
                              })
                            }
                          >
                            ถอดเครื่องนี้
                          </button>
                        </div>
                      ))}

                      {req.pendingDeviceId && (
                        <div className="admin-dev-row is-pending">
                          <Clock className="h-4 w-4 shrink-0 text-amber-700" />
                          <span className="admin-dev-info">
                            <strong>คำขอเครื่องใหม่:</strong> {req.pendingDeviceLabel || 'อุปกรณ์ใหม่'} (
                            <code>{req.pendingDeviceId}</code>)
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="admin-req-footer">
                      <label className="admin-expiry-field">
                        <span>วันหมดอายุ (เว้นว่าง = ถาวร):</span>
                        <input
                          type="date"
                          value={expiryVal}
                          onChange={(e) =>
                            setExpiryDrafts((prev) => ({ ...prev, [req.uid]: e.target.value }))
                          }
                        />
                      </label>

                      <div className="admin-req-actions">
                        {req.pendingDeviceId && !isFull && (
                          <button
                            type="button"
                            className="btn-primary-emerald btn-sm"
                            disabled={isBusy}
                            onClick={() =>
                              void runAction(req.uid, () =>
                                adminApproveRequest(req, { expiresAt: expiryVal })
                              )
                            }
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>
                              {boundIds.length === 0 ? 'อนุมัติการใช้งาน' : `อนุมัติเพิ่มเครื่องที่ ${boundIds.length + 1}`}
                            </span>
                          </button>
                        )}

                        {req.pendingDeviceId && isFull && (
                          <>
                            {boundIds.map((_, idx) => (
                              <button
                                key={idx}
                                type="button"
                                className="btn-primary-emerald btn-sm"
                                disabled={isBusy}
                                onClick={() =>
                                  void runAction(req.uid, () =>
                                    adminApproveRequest(req, { replaceIndex: idx, expiresAt: expiryVal })
                                  )
                                }
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>อนุมัติแทนเครื่องที่ {idx + 1}</span>
                              </button>
                            ))}
                            <button
                              type="button"
                              className="btn-outline-emerald btn-sm"
                              disabled={isBusy}
                              onClick={() => void runAction(req.uid, () => adminClearPendingDevice(req))}
                            >
                              ปฏิเสธเครื่องใหม่
                            </button>
                          </>
                        )}

                        {!req.pendingDeviceId && req.status !== 'approved' && (
                          <button
                            type="button"
                            className="btn-primary-emerald btn-sm"
                            disabled={isBusy}
                            onClick={() =>
                              void runAction(req.uid, () =>
                                adminApproveRequest(req, { expiresAt: expiryVal })
                              )
                            }
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>เปิดใช้งานสิทธิ์</span>
                          </button>
                        )}

                        {req.status === 'approved' && !req.pendingDeviceId && expiryVal !== (req.expiresAt || '') && (
                          <button
                            type="button"
                            className="btn-outline-emerald btn-sm"
                            disabled={isBusy}
                            onClick={() =>
                              void runAction(req.uid, () =>
                                adminApproveRequest(req, { expiresAt: expiryVal })
                              )
                            }
                          >
                            บันทึกวันหมดอายุ
                          </button>
                        )}

                        {req.status === 'pending' && (
                          <button
                            type="button"
                            className="btn-mini-danger"
                            disabled={isBusy}
                            onClick={() =>
                              setConfirmState({
                                uid: req.uid,
                                title: 'ยืนยันปฏิเสธคำขอ',
                                message: `ต้องการปฏิเสธคำขอสิทธิ์ของ ${req.fullName} (${req.email}) หรือไม่?`,
                                onConfirm: () =>
                                  runAction(req.uid, () => adminRejectRequest(req)),
                              })
                            }
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            <span>ปฏิเสธ</span>
                          </button>
                        )}

                        {req.status === 'approved' && req.passwordMode === 'password' && (
                          <button
                            type="button"
                            className="btn-outline-emerald btn-sm"
                            disabled={isBusy}
                            onClick={() =>
                              setConfirmState({
                                uid: req.uid,
                                title: 'ยืนยันรีเซ็ตรหัสผ่านเข้าระบบ',
                                message: `ต้องการล้างรหัสผ่านส่วนตัวของคุณ ${req.fullName} (${req.email}) หรือไม่? เมื่อเปิดระบบครั้งถัดไป ระบบจะให้ผู้ใช้งานตั้งรหัสผ่านใหม่ได้เอง`,
                                onConfirm: () =>
                                  runAction(req.uid, () => adminResetUserPassword(req)),
                              })
                            }
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                            <span>รีเซ็ตรหัสผ่าน</span>
                          </button>
                        )}

                        {req.status === 'approved' && (
                          <button
                            type="button"
                            className="btn-mini-danger"
                            disabled={isBusy}
                            onClick={() =>
                              setConfirmState({
                                uid: req.uid,
                                title: 'ยืนยันระงับสิทธิ์ทันที',
                                message: `ต้องการระงับสิทธิ์ของ ${req.fullName} และล้างเครื่องที่ผูกไว้ทั้งหมดหรือไม่?`,
                                onConfirm: () =>
                                  runAction(req.uid, () => adminRevokeRequest(req)),
                              })
                            }
                          >
                            <Ban className="h-3.5 w-3.5" />
                            <span>ระงับสิทธิ์</span>
                          </button>
                        )}

                        <button
                          type="button"
                          className="btn-ghost-sm"
                          disabled={isBusy}
                          title="ลบข้อมูลคำขอ"
                          onClick={() =>
                            setConfirmState({
                              uid: req.uid,
                              title: 'ยืนยันลบข้อมูลคำขอ',
                              message: `ต้องการลบรายการของ ${req.fullName} (${req.email}) ออกจากระบบหรือไม่?`,
                              onConfirm: () =>
                                runAction(req.uid, () => adminDeleteRequest(req.uid)),
                            })
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="admin-req-meta">อัปเดตล่าสุด: {formatTs(req.updatedAt)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {confirmState && (
        <div className="admin-confirm-overlay" role="dialog" aria-modal="true">
          <div className="admin-confirm-box">
            <h3>{confirmState.title}</h3>
            <p>{confirmState.message}</p>
            <div className="admin-confirm-actions">
              <button
                type="button"
                className="btn-ghost-sm"
                onClick={() => setConfirmState(null)}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                className="btn-mini-danger"
                onClick={() => {
                  const fn = confirmState.onConfirm;
                  setConfirmState(null);
                  void fn();
                }}
              >
                ยืนยันดำเนินการ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
