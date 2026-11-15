import React from 'react';
import {
  Download,
  Monitor,
  FileCode,
  CheckCircle2,
  Database,
  Sparkles,
  HardDriveDownload,
  FolderCheck,
} from 'lucide-react';
import { usePWAInstall, useOnlineStatus } from './usePWAInstall';

interface InstallAndPortableProps {
  onDownloadStandaloneHtml: (withCurrentData: boolean) => void;
  onLoadSampleData?: () => void;
  hasMaterials?: boolean;
}

export const InstallAndPortableSection: React.FC<InstallAndPortableProps> = ({
  onDownloadStandaloneHtml,
  onLoadSampleData,
  hasMaterials,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const isOnline = useOnlineStatus();

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

      {/* Standalone HTML Download Card */}
      <div className="card">
        <div className="cardhead">
          <div>
            <h3 className="flex items-center gap-2">
              <HardDriveDownload className="h-5 w-5 text-[var(--ink)]" />
              <span>1. ดาวน์โหลดระบบเป็นไฟล์ .html เดี่ยว (พกพา / เปิดได้ทันที)</span>
            </h3>
            <span className="sub">
              บันทึกเป็นไฟล์ .html ไฟล์เดียวจบ สามารถนำไปเก็บไว้ในโฟลเดอร์เครื่องคอมพิวเตอร์หรือแฟลชไดรฟ์แล้วดับเบิลคลิกเปิดใช้งานได้ทันที
            </span>
          </div>
        </div>
        <p className="hint">
          เหมาะสำหรับนำไปเปิดใช้งานบนคอมพิวเตอร์เครื่องอื่น หรือเก็บเป็นไฟล์ระบบประจำเครื่องโดยไม่ต้องติดตั้งโปรแกรมเพิ่มเติม
          แนะนำให้เปิดด้วยเบราว์เซอร์ <b>Google Chrome</b> หรือ <b>Microsoft Edge</b>
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            onClick={() => onDownloadStandaloneHtml(true)}
            className="btn primary flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            <span>ดาวน์โหลดไฟล์ .html (พร้อมข้อมูลปัจจุบันในเครื่อง)</span>
          </button>
          <button
            type="button"
            onClick={() => onDownloadStandaloneHtml(false)}
            className="btn flex items-center gap-2"
          >
            <FileCode className="h-4 w-4 text-[var(--ink)]" />
            <span>ดาวน์โหลดไฟล์ .html (ไฟล์เปล่าสำหรับเริ่มใหม่)</span>
          </button>
        </div>
      </div>

      {/* PWA Desktop Installation Card */}
      <div className="card">
        <div className="cardhead">
          <div>
            <h3 className="flex items-center gap-2">
              <Monitor className="h-5 w-5 text-[var(--ink)]" />
              <span>2. ติดตั้งเป็นโปรแกรมบนเครื่องคอมพิวเตอร์ (PWA Desktop App)</span>
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

        {isInstallable && !isInstalled && (
          <div className="mb-4 rounded-xl border border-[var(--line-strong)] bg-[var(--ink-soft)] p-4">
            <div className="font-semibold text-[var(--fg)]" style={{ fontFamily: 'var(--f-display)' }}>
              เบราว์เซอร์ของคุณรองรับการติดตั้งลงเครื่องโดยตรง
            </div>
            <p className="mt-1 mb-3 text-sm text-[var(--muted)]">
              กดปุ่มด้านล่างเพื่อติดตั้ง “ระบบคุมวัสดุ” ลงในเครื่องคอมพิวเตอร์ของคุณทันที:
            </p>
            <button
              type="button"
              onClick={() => install()}
              className="btn primary flex items-center gap-2"
            >
              <Monitor className="h-4 w-4" />
              <span>ติดตั้งโปรแกรมลงเครื่องทันที</span>
            </button>
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
                คลิกปุ่ม <strong>“ติดตั้งโปรแกรมลงเครื่องทันที”</strong> ด้านบน หรือคลิกไอคอนรูปหน้าจอคอมพิวเตอร์{' '}
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
                <span>3. ข้อมูลตัวอย่างสำหรับทดลองใช้งานระบบ</span>
              </h3>
              <span className="sub">
                สร้างรายการวัสดุตัวอย่าง 5 รายการ พร้อมใบรับวัสดุและใบเบิกตัวอย่าง เพื่อทดสอบการคำนวณ FIFO และรายงาน
              </span>
            </div>
          </div>
          <p className="hint">
            {hasMaterials
              ? 'ขณะนี้มีรายการวัสดุอยู่ในระบบแล้ว หากกดปุ่มด้านล่าง ระบบจะเพิ่มหรืออัปเดตเฉพาะรายการตัวอย่างโดยไม่ลบรายการอื่นที่คุณบันทึกไว้'
              : 'ยังไม่มีรายการวัสดุในเครื่อง สามารถกดปุ่มด้านล่างเพื่อเพิ่มข้อมูลตัวอย่างสำหรับทดลองใช้งานได้ทันที'}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onLoadSampleData}
              className="btn flex items-center gap-2"
            >
              <FolderCheck className="h-4 w-4 text-[var(--ink)]" />
              <span>โหลดข้อมูลตัวอย่างทดลองใช้</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
