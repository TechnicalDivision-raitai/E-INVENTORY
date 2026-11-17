import React, { useState } from 'react';
import {
  Monitor,
  CheckCircle2,
  Database,
  Sparkles,
  FolderCheck,
  Trash2,
  Download,
  Info,
} from 'lucide-react';
import { usePWAInstall, useOnlineStatus } from './usePWAInstall';

export const TopbarPWAInstallButton: React.FC<{ onOpenInstallTab?: () => void }> = ({
  onOpenInstallTab,
}) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();

  if (isInstalled || !isInstallable) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => {
        void install().then((ok) => {
          if (!ok) onOpenInstallTab?.();
        });
      }}
      className="storage-pill"
      style={{
        background: 'var(--ink-soft)',
        color: 'var(--ink)',
        borderColor: 'var(--line-strong)',
        fontWeight: 600,
      }}
      title="ติดตั้งระบบคุมวัสดุเป็นโปรแกรมบนเครื่องคอมพิวเตอร์ (PWA Desktop App)"
    >
      <Download className="h-3.5 w-3.5" />
      <span>ติดตั้งแอป</span>
    </button>
  );
};

interface InstallAndPortableProps {
  onLoadSampleData?: () => void;
  onClearSampleData?: () => void;
  hasMaterials?: boolean;
}

export const InstallAndPortableSection: React.FC<InstallAndPortableProps> = ({
  onLoadSampleData,
  onClearSampleData,
  hasMaterials,
}) => {
  const { isInstallable, isInstalled, isIOS, isInIframe, install } = usePWAInstall();
  const isOnline = useOnlineStatus();
  const [confirmClear, setConfirmClear] = useState<boolean>(false);
  const [manualTipOpen, setManualTipOpen] = useState<boolean>(false);

  const handleInstallClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (!accepted) {
        setManualTipOpen(true);
      }
      return;
    }
    setManualTipOpen(true);
  };

  return (
    <div className="stack">
      {/* Status Banner Card */}
      <div className="card glow-badge-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="logo-fallback">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <div className="font-bold text-[var(--fg)]" style={{ fontFamily: 'var(--f-display)' }}>
                สถานะระบบออฟไลน์และฐานข้อมูลในเครื่อง (LocalStorage)
              </div>
              <div className="sub">
                {isOnline
                  ? 'เชื่อมต่อเครือข่ายปกติ · ข้อมูลทั้งหมดถูกบันทึกไว้ในเครื่องนี้โดยไม่ต้องใช้เซิร์ฟเวอร์ภายนอก'
                  : 'กำลังทำงานในโหมดออฟไลน์ · ข้อมูลทั้งหมดทำงานได้สมบูรณ์จากในเครื่อง'}
              </div>
            </div>
          </div>
          <span className="pill st-ok glow-pill">
            {isInstalled ? '✓ ติดตั้งเป็นแอปลงเครื่องแล้ว' : '✓ พร้อมใช้งานแบบออฟไลน์ 100%'}
          </span>
        </div>
      </div>

      {/* PWA Desktop Installation Card */}
      <div className="card">
        <div className="cardhead">
          <div>
            <h3 className="flex items-center gap-2">
              <Monitor className="h-5 w-5 text-[var(--ink)]" />
              <span>1. ติดตั้งเป็นโปรแกรมบนเครื่องคอมพิวเตอร์ (PWA Desktop App)</span>
            </h3>
            <span className="sub">
              สร้างไอคอนโปรแกรมไว้บนหน้าจอ Desktop หรือแถบ Taskbar เพื่อเปิดใช้งานได้เหมือนโปรแกรมทั่วไป
            </span>
          </div>
          {isInstalled && (
            <span className="pill st-ok glow-pill inline-flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>ติดตั้งลงเครื่องแล้ว</span>
            </span>
          )}
        </div>

        {!isInstalled && (
          <div className="mb-4 rounded-xl border border-[var(--line-strong)] bg-[var(--ink-soft)] p-4">
            <div className="font-semibold text-[var(--fg)]" style={{ fontFamily: 'var(--f-display)' }}>
              {isInstallable
                ? 'เบราว์เซอร์ของคุณรองรับการติดตั้งลงเครื่องโดยตรง'
                : 'ติดตั้งระบบคุมวัสดุเป็นโปรแกรมบนเครื่อง (PWA Desktop App)'}
            </div>
            <p className="mt-1 mb-3 text-sm text-[var(--muted)]">
              {isInstallable
                ? 'กดปุ่มด้านล่างเพื่อติดตั้ง “ระบบคุมวัสดุ” ลงในเครื่องคอมพิวเตอร์ของคุณทันที:'
                : 'กดปุ่มด้านล่างเพื่อเรียกหน้าต่างติดตั้งแอป หรือดูวิธีติดตั้งผ่านแถบเครื่องมือของเบราว์เซอร์:'}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleInstallClick()}
                className="btn primary flex items-center gap-2"
              >
                <Monitor className="h-4 w-4" />
                <span>
                  {isInstallable
                    ? 'ติดตั้งโปรแกรมลงเครื่องทันที'
                    : 'ติดตั้ง PWA Desktop App'}
                </span>
              </button>
            </div>

            {manualTipOpen && !isInstallable && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                <div>
                  {isIOS ? (
                    <span>
                      บน iPhone / iPad (Safari): แตะปุ่ม <strong>แชร์ (Share)</strong> ด้านล่าง แล้วเลือก{' '}
                      <strong>“เพิ่มไปยังหน้าจอโฮม” (Add to Home Screen)</strong>
                    </span>
                  ) : isInIframe ? (
                    <span>
                      ขณะนี้เว็บกำลังเปิดอยู่ในกรอบพรีวิว (iframe) เบราว์เซอร์จึงไม่อนุญาตให้เด้งหน้าต่างติดตั้งอัตโนมัติ
                      กรุณาเปิด URL เว็บแอปโดยตรงใน <strong>Google Chrome</strong> หรือ <strong>Microsoft Edge</strong>{' '}
                      แล้วกดปุ่มนี้อีกครั้ง หรือคลิกไอคอนติดตั้งที่ด้านขวาของช่องใส่ URL
                    </span>
                  ) : (
                    <span>
                      เบราว์เซอร์ยังไม่ส่งคำสั่งเด้งหน้าต่างติดตั้งอัตโนมัติ (อาจเคยกดปิดไว้ก่อนหน้า หรือติดตั้งไว้แล้ว):
                      ให้คลิกไอคอนรูปหน้าจอคอมพิวเตอร์ <strong>“ติดตั้ง”</strong> ที่ด้านขวาของช่องใส่ URL ด้านบน
                      หรือไปที่เมนู <code>⋮</code> มุมขวาบน &rarr; <strong>บันทึกและแชร์ / แอป</strong> &rarr;{' '}
                      <strong>ติดตั้งหน้านี้เป็นแอป</strong>
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="rounded-xl border border-[var(--line)] bg-[var(--sunk)] p-4">
          <div className="font-semibold text-[var(--fg)]" style={{ fontFamily: 'var(--f-display)' }}>
            ขั้นตอนการติดตั้งลงเครื่องคอมพิวเตอร์ (Chrome / Edge)
          </div>
          {isIOS ? (
            <p className="mt-2 text-sm text-[var(--muted)]">
              บน Safari (iPhone / iPad): แตะปุ่ม <strong>แชร์ (Share)</strong> ด้านล่าง แล้วเลือกเมนู{' '}
              <strong>“เพิ่มไปยังหน้าจอโฮม” (Add to Home Screen)</strong>
            </p>
          ) : (
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-[var(--muted)]">
              <li>
                เปิดหน้านี้ในเบราว์เซอร์ <strong>Google Chrome</strong> หรือ <strong>Microsoft Edge</strong>
              </li>
              <li>
                คลิกปุ่ม <strong>“ติดตั้งโปรแกรมลงเครื่องทันที / PWA Desktop App”</strong> ด้านบน หรือคลิกไอคอนรูปหน้าจอคอมพิวเตอร์{' '}
                <strong>“ติดตั้ง ระบบคุมวัสดุ”</strong> ที่ด้านขวาของช่องใส่ URL ด้านบน
              </li>
              <li>
                หรือไปที่เมนู <code>⋮</code> (มุมขวาบนของเบราว์เซอร์) &rarr; เลือก{' '}
                <strong>บันทึกและแชร์ / แอป (Apps)</strong> &rarr; เลือก <strong>ติดตั้งหน้านี้เป็นแอป</strong>
              </li>
              <li>
                เมื่อติดตั้งแล้ว จะมีไอคอน <strong>ระบบคุมวัสดุ</strong> บนหน้าจอ Desktop สามารถเปิดใช้งานได้ทันทีแม้ไม่มีอินเทอร์เน็ต
              </li>
            </ol>
          )}
        </div>
      </div>

      {/* Sample Data / Testing Card */}
      {onLoadSampleData && (
        <div className="card">
          <div className="cardhead">
            <div>
              <h3 className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-[var(--ink)]" />
                <span>2. ข้อมูลตัวอย่างสำหรับทดลองใช้งานระบบ</span>
              </h3>
              <span className="sub">
                สร้างรายการวัสดุตัวอย่าง 5 รายการ พร้อมใบรับวัสดุและใบเบิกตัวอย่าง เพื่อทดสอบการคำนวณ FIFO และรายงาน
              </span>
            </div>
          </div>
          <p className="hint">
            {hasMaterials
              ? 'ขณะนี้มีรายการวัสดุอยู่ในระบบแล้ว สามารถกดโหลดซ้ำเพื่ออัปเดตเฉพาะรายการตัวอย่าง หรือกดล้างข้อมูลตัวอย่างออกโดยไม่กระทบข้อมูลจริงที่คุณบันทึกไว้'
              : 'ยังไม่มีรายการวัสดุในเครื่อง สามารถกดปุ่มด้านล่างเพื่อเพิ่มข้อมูลตัวอย่างสำหรับทดลองใช้งานได้ทันที'}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setConfirmClear(false);
                onLoadSampleData();
              }}
              className="btn flex items-center gap-2"
            >
              <FolderCheck className="h-4 w-4 text-[var(--ink)]" />
              <span>โหลดข้อมูลตัวอย่างทดลองใช้</span>
            </button>

            {onClearSampleData && !confirmClear && (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="btn danger flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                <span>ล้างข้อมูลตัวอย่าง</span>
              </button>
            )}

            {onClearSampleData && confirmClear && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5">
                <span className="text-sm font-semibold text-red-800">
                  ยืนยันการลบเฉพาะข้อมูลตัวอย่างหรือไม่?
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmClear(false);
                    onClearSampleData();
                  }}
                  className="btn danger small"
                >
                  ยืนยันล้างข้อมูลตัวอย่าง
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="btn small"
                >
                  ยกเลิก
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
