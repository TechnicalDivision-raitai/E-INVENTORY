/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import {
  Boxes,
  PackagePlus,
  FileOutput,
  Layers,
  FileSpreadsheet,
  ClipboardCheck,
  Settings,
  Plus,
  Monitor,
  HardDrive,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FolderOpen,
  RotateCcw,
  CalendarPlus,
} from 'lucide-react';
import { bootKumWatsaduApp } from './kumwatsaduController';
import { InstallAndPortableSection } from './PWAInstallButton';

export default function App() {
  const [materialCount, setMaterialCount] = useState<number>(0);

  useEffect(() => {
    bootKumWatsaduApp((cnt) => setMaterialCount(cnt));
  }, []);

  const switchTab = (tab: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fn = (window as any).showKumWatsaduTab;
    if (typeof fn === 'function') {
      fn(tab);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleDownloadStandaloneHtml = async (withCurrentData: boolean) => {
    try {
      const res = await fetch('/assets/aistudio/KumWatsadu_5aecc5dc.html');
      if (!res.ok) throw new Error('ไม่สามารถโหลดไฟล์ต้นฉบับได้');
      let html = await res.text();

      // Remove v7.0 badge, developer credit, and support tab/section from standalone HTML
      html = html.replace(/<span class="ver"[^>]*>v7\.0<\/span>/g, '');
      html = html.replace(/<div class="devcredit">[\s\S]*?<\/div>/g, '');
      html = html.replace(/<button role="tab"[^>]*data-tab="sup"[^>]*>[\s\S]*?<\/button>/g, '');
      html = html.replace(/<!-- สนับสนุน -->[\s\S]*?<\/section>/g, '');

      if (withCurrentData) {
        const rawDb = localStorage.getItem('kumwatsadu-db-v1') || '{}';
        const lastBk = localStorage.getItem('kumwatsadu-db-v1:lastBackup') || '';
        const seedScript = `<script>
(function(){
  try {
    var existing = localStorage.getItem('kumwatsadu-db-v1');
    if (!existing || existing === '{}' || confirm('พบข้อมูลที่แนบมากับไฟล์ .html นี้ ต้องการนำเข้าข้อมูลลงในเบราว์เซอร์เครื่องนี้หรือไม่?')) {
      localStorage.setItem('kumwatsadu-db-v1', ${JSON.stringify(rawDb)});
      ${lastBk ? `localStorage.setItem('kumwatsadu-db-v1:lastBackup', ${JSON.stringify(lastBk)});` : ''}
    }
  } catch(e) {}
})();
</script>`;
        html = html.replace('</head>', `${seedScript}\n</head>`);
      }

      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const d = new Date().toISOString().slice(0, 10);
      a.download = withCurrentData ? `ระบบคุมวัสดุ_พร้อมข้อมูล_${d}.html` : 'ระบบคุมวัสดุ.html';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).toast?.(
        withCurrentData
          ? 'ดาวน์โหลดไฟล์ .html พร้อมข้อมูลปัจจุบันแล้ว'
          : 'ดาวน์โหลดไฟล์ ระบบคุมวัสดุ.html แล้ว'
      );
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).toast?.('ดาวน์โหลดไม่สำเร็จ: ' + ((err as any)?.message || err));
    }
  };

  const handleLoadSampleData = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (window as any).localDb;
    if (!db) return;
    const now = new Date().toISOString();
    const d = new Date();
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const fy = m >= 10 ? y + 544 : y + 543;
    const fyStartIso = `${fy - 544}-10-01`;
    const todayIso = d.toISOString().slice(0, 10);

    const sampleMats = [
      {
        id: 'mat_sample_1',
        name: 'ยางมะตอยสำเร็จรูป',
        code: 'CON-001',
        cat: 'วัสดุก่อสร้าง',
        unit: 'ถุง',
        loc: 'คลังพัสดุกองช่าง อาคาร 1',
        note: 'ถุงบรรจุ 20 กก. เกรดซ่อมผิวจราจรเร่งด่วน',
        max: 200,
        min: 30,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'mat_sample_2',
        name: 'หลอดไฟ LED Street Light 60W',
        code: 'ELE-001',
        cat: 'วัสดุไฟฟ้าและวิทยุ',
        unit: 'หลอด',
        loc: 'ตู้เก็บวัสดุไฟฟ้า กองช่าง',
        note: 'ขนาด 60 วัตต์ แสงขาว Daylight มอก.',
        max: 50,
        min: 10,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'mat_sample_3',
        name: 'ท่อพีวีซี ชั้น 8.5 ขนาด 2 นิ้ว',
        code: 'PLU-001',
        cat: 'วัสดุประปา',
        unit: 'ท่อน',
        loc: 'โรงเก็บวัสดุประปา',
        note: 'ความยาว 4 เมตร มาตรฐาน มอก.',
        max: 60,
        min: 15,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'mat_sample_4',
        name: 'กระดาษถ่ายเอกสาร A4 80 แกรม',
        code: 'OFF-001',
        cat: 'วัสดุสำนักงาน',
        unit: 'รีม',
        loc: 'ตู้พัสดุสำนักงาน',
        note: 'ขนาด A4 หนา 80 แกรม บรรจุ 500 แผ่น',
        max: 100,
        min: 15,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'mat_sample_5',
        name: 'ปูนซีเมนต์ปอร์ตแลนด์',
        code: 'CON-002',
        cat: 'วัสดุก่อสร้าง',
        unit: 'ถุง',
        loc: 'คลังพัสดุกองช่าง อาคาร 1',
        note: 'ถุงบรรจุ 50 กก. งานโครงสร้างและซ่อมบำรุง',
        max: 80,
        min: 20,
        createdAt: now,
        updatedAt: now,
      },
    ];

    const sampleMoves = [
      {
        id: 'mv_sample_open',
        kind: 'in',
        no: `001/${fy}`,
        seq: 1,
        fy,
        date: fyStartIso,
        src: 'opening',
        inspectDate: '',
        poNo: '',
        vendor: 'ยอดยกมาจากปีงบประมาณก่อน',
        invoiceNo: '',
        note: 'ยอดยกมาต้นปีงบประมาณ',
        lines: [
          { mid: 'mat_sample_1', qty: 80, price: 115 },
          { mid: 'mat_sample_2', qty: 18, price: 850 },
          { mid: 'mat_sample_3', qty: 25, price: 240 },
          { mid: 'mat_sample_4', qty: 30, price: 120 },
          { mid: 'mat_sample_5', qty: 12, price: 145 },
        ],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'mv_sample_in2',
        kind: 'in',
        no: `002/${fy}`,
        seq: 2,
        fy,
        date: todayIso,
        src: 'purchase',
        inspectDate: todayIso,
        poNo: `14/${fy}`,
        vendor: 'หจก. เจริญกิจวัสดุก่อสร้าง',
        invoiceNo: 'IV-69104',
        note: 'จัดซื้อวัสดุซ่อมแซมผิวจราจรและไฟฟ้าสาธารณะ',
        lines: [
          { mid: 'mat_sample_1', qty: 50, price: 120 },
          { mid: 'mat_sample_2', qty: 10, price: 890 },
        ],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'mv_sample_out1',
        kind: 'out',
        no: `001/${fy}`,
        seq: 1,
        fy,
        date: todayIso,
        requester: 'นายสมชาย สายช่าง',
        reqPos: 'นายช่างโยธาปฏิบัติงาน',
        purpose: 'ซ่อมแซมหลุมบ่อถนนลาดยางสายหลัก หมู่ที่ 3 และเปลี่ยนหลอดไฟสาธารณะ',
        note: 'ตามคำร้องประชาชน',
        lines: [
          { mid: 'mat_sample_1', qty: 25 },
          { mid: 'mat_sample_2', qty: 4 },
        ],
        createdAt: now,
        updatedAt: now,
      },
    ];

    for (const m of sampleMats) {
      const { id, ...rest } = m;
      await db.doc('materials/' + id).set(rest);
    }
    for (const mv of sampleMoves) {
      const { id, ...rest } = mv;
      await db.doc('moves/' + id).set(rest);
    }
    await db.doc('settings/main').set({
      div: 'กองช่าง',
      work: 'งานพัสดุ',
      org: 'องค์การบริหารส่วนตำบลตัวอย่าง อำเภอเมือง จังหวัดนครราชสีมา',
      appr: 'นายเกรียงไกร พัฒนาดี',
      apprPos: 'ผู้อำนวยการกองช่าง',
      payer: 'นางสาวสุดา รอบคอบ',
      payerPos: 'เจ้าพนักงานพัสดุชำนาญงาน',
      staff: 'นางสาวสุดา รอบคอบ',
      staffPos: 'เจ้าพนักงานพัสดุชำนาญงาน',
      head: 'นายเกรียงไกร พัฒนาดี',
      headPos: 'ผู้อำนวยการกองช่าง',
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).toast?.('โหลดข้อมูลตัวอย่างเรียบร้อยแล้ว (วัสดุ 5 รายการ, ใบรับ 2 ใบ, ใบเบิก 1 ใบ)');
  };

  return (
    <div className="kumwatsadu-root">
      <div className="app-shell">
        {/* Sidebar Navigation (Dark Deep Emerald-Forest matching reference layout) */}
        <aside className="app-sidebar no-print">
          <div className="sidebar-brand" onClick={() => switchTab('set')} style={{ cursor: 'pointer' }} title="คลิกเพื่อแก้ไขชื่อหน่วยงาน">
            <img className="logo" id="mastLogo" alt="โลโก้หน่วยงาน" hidden />
            <div className="logo-fallback" id="mastLogoFallback">
              <Boxes className="h-5 w-5" />
            </div>
            <div className="sidebar-brand-text">
              <div className="sidebar-title">ระบบคุมวัสดุ</div>
              <div className="sidebar-sub org" id="mastOrg">
                กองช่าง · ชื่อหน่วยงาน
              </div>
            </div>
          </div>

          <div className="sidebar-user-box">
            <div className="u-title">เจ้าหน้าที่พัสดุ</div>
            <div className="sidebar-quick">
              <button
                type="button"
                onClick={() => switchTab('in')}
                className="quick-btn"
                title="บันทึกรับวัสดุเข้าคลัง"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>รับเข้าวัสดุ</span>
              </button>
              <button
                type="button"
                onClick={() => switchTab('out')}
                className="quick-btn"
                title="ออกใบเบิกวัสดุ"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>ออกใบเบิก</span>
              </button>
            </div>
          </div>

          <div className="sidebar-sec-head">
            <span>พื้นที่ปฏิบัติงาน</span>
            <span className="sidebar-role-pill">Staff</span>
          </div>

          <nav className="tabs" role="tablist" aria-label="เมนูหลัก">
            <button role="tab" aria-selected="true" data-tab="stock">
              <Boxes className="nav-ic" />
              <span className="nav-lbl">ภาพรวม</span>
            </button>
            <button role="tab" aria-selected="false" data-tab="in">
              <PackagePlus className="nav-ic" />
              <span className="nav-lbl">รับเข้าวัสดุ</span>
            </button>
            <button role="tab" aria-selected="false" data-tab="out">
              <FileOutput className="nav-ic" />
              <span className="nav-lbl">ใบเบิกวัสดุ</span>
            </button>
            <button role="tab" aria-selected="false" data-tab="mat">
              <Layers className="nav-ic" />
              <span className="nav-lbl">ทะเบียนวัสดุทั้งหมด</span>
            </button>
            <button role="tab" aria-selected="false" data-tab="report">
              <FileSpreadsheet className="nav-ic" />
              <span className="nav-lbl">รายงานพัสดุ</span>
            </button>
            <button role="tab" aria-selected="false" data-tab="cnt">
              <ClipboardCheck className="nav-ic" />
              <span className="nav-lbl">ตรวจนับประจำปี</span>
            </button>

            <div className="nav-divider" />

            <button role="tab" aria-selected="false" data-tab="set">
              <Settings className="nav-ic" />
              <span className="nav-lbl">ตั้งค่า / สำรองข้อมูล</span>
            </button>
            <button role="tab" aria-selected="false" data-tab="install">
              <Monitor className="nav-ic" />
              <span className="nav-lbl">ไฟล์ .html / ติดตั้งแอป</span>
            </button>
          </nav>
        </aside>

        {/* Main Workspace Column */}
        <div className="main-area">
          {/* Top White Breadcrumb & Status Bar */}
          <div className="topbar no-print">
            <div className="breadcrumb">
              <span className="crumb-root">พื้นที่ทำงาน</span>
              <span className="crumb-sep">/</span>
              <span className="crumb-cur" id="breadcrumbCurrent">
                ภาพรวม
              </span>
            </div>
            <div className="topbar-right">
              <button
                type="button"
                onClick={() => switchTab('set')}
                className="storage-pill"
                title="คลิกเพื่อตั้งค่าการสำรองข้อมูล"
              >
                <HardDrive className="h-3.5 w-3.5" />
                <span>จัดเก็บในเบราว์เซอร์</span>
              </button>
              <div className="topbar-fy-group">
                <select
                  id="topFySelect"
                  className="topbar-fy-select"
                  aria-label="เลือกปีงบประมาณ"
                  title="กรองข้อมูลตามปีงบประมาณ"
                ></select>
                <button
                  type="button"
                  className="topbar-fy-add"
                  data-open-fy-modal="1"
                  title="เพิ่มหรือจัดการปีงบประมาณ"
                >
                  <CalendarPlus className="h-3.5 w-3.5" />
                  <span>เพิ่มปีงบ</span>
                </button>
              </div>
              <span className="topbar-role" id="fyStamp" hidden>
                ปีงบประมาณ —
              </span>
              <div className="topbar-avatar" title="เจ้าหน้าที่พัสดุ">
                พ
              </div>
            </div>
          </div>

          <div className="wrap">
            <header className="mast">
              <div className="brand">
                <div>
                  <div className="view-en no-print" id="activeViewEn">
                    INVENTORY &amp; MATERIAL MANAGEMENT
                  </div>
                  <h1 id="activeViewTitle">ภาพรวมงานควบคุมวัสดุ</h1>
                  <p className="view-sub no-print" id="activeViewSub">
                    ติดตามมูลค่าวัสดุคงเหลือ รับเข้า เบิกจ่าย และสถานะสต็อกในที่เดียว
                  </p>
                </div>
              </div>
            </header>

            <div
              className="notice"
              id="notice"
              hidden
              onClick={() => switchTab('set')}
              style={{ cursor: 'pointer' }}
              title="คลิกเพื่อไปที่หน้าตั้งค่าสำรองข้อมูลอัตโนมัติ"
            ></div>
            <div className="notice abbanner" id="abBanner" hidden>
              <span>💾 สำรองข้อมูลอัตโนมัติยังไม่ทำงาน ต้องกดอนุญาตให้เขียนโฟลเดอร์สำรองก่อน</span>
              <button className="btn small" id="abBannerBtn">
                อนุญาตสำรองอัตโนมัติ
              </button>
            </div>

            {/* วัสดุคงคลัง */}
            <section id="view-stock">
              <div className="repbar no-print" style={{ marginBottom: 14 }}>
                <div className="seg" role="tablist" aria-label="มุมมองภาพรวมงานควบคุมวัสดุ">
                  <button
                    type="button"
                    className="btn"
                    role="tab"
                    data-st="dash"
                    aria-selected="true"
                    aria-pressed="true"
                  >
                    ภาพรวม
                  </button>
                  <button
                    type="button"
                    className="btn"
                    role="tab"
                    data-st="list"
                    aria-selected="false"
                    aria-pressed="false"
                  >
                    รายการวัสดุคงคลังทั้งหมด
                  </button>
                </div>
              </div>

              {/* Filter Bar */}
              <div className="overview-filter-bar no-print">
                <div className="of-field">
                  <label htmlFor="sFy">ปีงบประมาณ</label>
                  <select id="sFy"></select>
                </div>
                <div className="of-field" id="ofCat" hidden>
                  <label htmlFor="sCat">ประเภทวัสดุ</label>
                  <select id="sCat">
                    <option value="">ทุกประเภทวัสดุ</option>
                  </select>
                </div>
                <div className="of-field" id="ofState" hidden>
                  <label htmlFor="sState">สถานะคงเหลือ</label>
                  <select id="sState">
                    <option value="">ทุกสถานะคงเหลือ</option>
                    <option value="out">หมดคลัง</option>
                    <option value="low">ต่ำกว่าจำนวนอย่างต่ำ</option>
                    <option value="over">เกินจำนวนอย่างสูง</option>
                    <option value="ok">ปกติ</option>
                  </select>
                </div>
                <div className="of-field of-search" id="ofSearch" hidden>
                  <label htmlFor="sQ">ค้นหา</label>
                  <input id="sQ" type="search" placeholder="ค้นหาชื่อวัสดุ ประเภท หรือหมายเหตุ..." />
                </div>
                <div className="of-actions">
                  <button type="button" className="btn" id="sReset" title="ล้างตัวกรองและรีเฟรชข้อมูล">
                    <RotateCcw className="h-3.5 w-3.5" style={{ marginRight: 5 }} />
                    รีเฟรช
                  </button>
                </div>
              </div>

              <div className="dash" id="stockDashPanel">
                <div className="kpis">
                  <div className="kpi">
                    <div className="kpi-top">
                      <div className="k" id="kValK">มูลค่าวัสดุคงเหลือ</div>
                      <span className="kpi-ic ic-mint">
                        <FolderOpen className="h-4 w-4" />
                      </span>
                    </div>
                    <div className="v" id="kVal">
                      0.00<small>บาท</small>
                    </div>
                    <div className="d" id="kValD">
                      วัสดุในทะเบียน 0 รายการ
                    </div>
                  </div>
                  <div className="kpi">
                    <div className="kpi-top">
                      <div className="k" id="kInK">รับเข้า ปีงบนี้</div>
                      <span className="kpi-ic ic-ok">
                        <CheckCircle2 className="h-4 w-4" />
                      </span>
                    </div>
                    <div className="v" id="kIn">
                      0.00<small>บาท</small>
                    </div>
                    <div className="d" id="kInD">
                      0 ใบรับ
                    </div>
                  </div>
                  <div className="kpi">
                    <div className="kpi-top">
                      <div className="k" id="kOutValK">เบิกจ่าย ปีงบนี้</div>
                      <span className="kpi-ic ic-amber">
                        <Clock className="h-4 w-4" />
                      </span>
                    </div>
                    <div className="v" id="kOut">
                      0.00<small>บาท</small>
                    </div>
                    <div className="d" id="kOutD">
                      0 ใบเบิก
                    </div>
                  </div>
                  <div className="kpi" id="kOutBox">
                    <div className="kpi-top">
                      <div className="k" id="kOutK">
                        วัสดุหมด / ใกล้หมด
                      </div>
                      <span className="kpi-ic ic-bad">
                        <AlertTriangle className="h-4 w-4" />
                      </span>
                    </div>
                    <div className="v" id="kEmpty">
                      0<small>รายการ</small>
                    </div>
                    <div className="d" id="kEmptyD">
                      ทุกรายการมีของในคลัง
                    </div>
                  </div>
                </div>
                <div className="drow">
                  <div className="dcard">
                    <div className="dh">
                      <div>
                        <h3 id="chTitle">มูลค่ารับเข้า-เบิกจ่ายรายเดือน</h3>
                        <span className="sub">เปรียบเทียบมูลค่ารับเข้าและเบิกจ่ายในแต่ละเดือนของปีงบประมาณ</span>
                      </div>
                      <div className="legend">
                        <span style={{ ['--c' as string]: 'var(--s-in)' }}>รับเข้า</span>
                        <span style={{ ['--c' as string]: 'var(--s-out)' }}>เบิกจ่าย</span>
                      </div>
                    </div>
                    <div className="chart" id="chMonthly"></div>
                    <div className="vtip" id="vtip" hidden></div>
                  </div>
                  <div className="dcard">
                    <div className="dh">
                      <div>
                        <h3>มูลค่าคงเหลือสูงสุด</h3>
                        <span className="sub">เรียงตามมูลค่าคงเหลือในคลัง (FIFO)</span>
                      </div>
                      <span className="card-badge">THB</span>
                    </div>
                    <div className="hbars" id="topVal"></div>
                  </div>
                </div>
                <div className="drow">
                  <div className="dcard">
                    <div className="dh">
                      <div>
                        <h3>ความเคลื่อนไหวล่าสุด</h3>
                        <span className="sub">คลิกที่รายการเพื่อเปิดดูหรือแก้ไขเอกสาร</span>
                      </div>
                      <span className="card-badge">ล่าสุด</span>
                    </div>
                    <ul className="feed" id="feed"></ul>
                  </div>
                  <div className="dcard">
                    <div className="dh">
                      <div>
                        <h3>วัสดุหมด / ต่ำกว่าจำนวนอย่างต่ำ</h3>
                        <span className="sub">รายการที่ควรพิจารณาดำเนินการจัดซื้อเพิ่มเติม</span>
                      </div>
                      <span className="card-badge" id="outCnt">0 รายการ</span>
                    </div>
                    <ul className="outlist" id="outList"></ul>
                  </div>
                </div>
              </div>

              <div className="stock-table-card card" id="stockListPanel" hidden>
                <div className="sechead">
                  <div>
                    <h3>รายการวัสดุคงคลังทั้งหมด</h3>
                    <span className="sub" id="tCount"></span>
                  </div>
                </div>
                <div className="tablebox">
                  <table>
                    <thead>
                      <tr>
                        <th>รายการวัสดุ</th>
                        <th>หน่วย</th>
                        <th className="num">คงเหลือ</th>
                        <th className="num">ราคา/หน่วย (FIFO)</th>
                        <th className="num">มูลค่าคงเหลือ</th>
                        <th>สถานะ</th>
                        <th>การจัดการ</th>
                      </tr>
                    </thead>
                    <tbody id="stockRows"></tbody>
                  </table>
                  <div className="empty" id="emptyStock" hidden></div>
                </div>
              </div>
            </section>

          {/* รับเข้า */}
          <section id="view-in" hidden>
            <div className="stack">
              <form className="card" id="inForm" autoComplete="off">
                <div className="cardhead">
                  <div>
                    <h3 id="inTitle">บันทึกรับวัสดุเข้าคลัง</h3>
                    <span className="sub">ราคาต่อหน่วยใช้คิดมูลค่าในบัญชีวัสดุตามลำดับรับเข้า (FIFO)</span>
                  </div>
                </div>
                <fieldset className="form-section">
                  <legend>ข้อมูลเอกสารใบรับ</legend>
                  <div className="grid">
                    <label className="f c3">
                      เลขที่ใบรับ
                      <input id="inNo" placeholder="001/2570" />
                    </label>
                    <label className="f c3">
                      วันที่รับ <span className="req">*</span>
                      <input id="inDate" type="date" required />
                    </label>
                    <label className="f c3">
                      ที่มา
                      <select id="inSrc"></select>
                    </label>
                    <label className="f c3" id="inInspectLbl">
                      วันที่ตรวจรับ <span className="req">*</span>
                      <input id="inInspect" type="date" required />
                    </label>
                    <label className="f c4" id="inPoLbl">
                      เลขที่ใบสั่งซื้อ/สัญญา
                      <input id="inPo" placeholder="เช่น 45/2570" />
                    </label>
                    <label className="f c4" id="inVendorLbl">
                      <span id="inVendorTxt">ผู้ขาย / รับจาก</span>{' '}
                      <span className="req" id="inVendorReq">
                        *
                      </span>
                      <input id="inVendor" required placeholder="ชื่อร้านค้า / หน่วยงาน" />
                    </label>
                    <label className="f c4">
                      เลขที่ใบส่งของ/ใบกำกับ
                      <input id="inInvoice" placeholder="ระบุเลขที่ใบส่งของ (ถ้ามี)" />
                    </label>
                    <label className="f c12">
                      หมายเหตุ
                      <input id="inNote" placeholder="เช่น โครงการซ่อมแซมถนนในตำบล" />
                    </label>
                  </div>
                </fieldset>
                <fieldset className="form-section">
                  <legend>รายการวัสดุที่รับเข้า</legend>
                  <div className="lines in" id="inLines">
                    <div className="lnhead">
                      <span>วัสดุ</span>
                      <span>จำนวน</span>
                      <span>ราคา/หน่วย (บาท)</span>
                      <span style={{ textAlign: 'right' }}>รวมเงิน</span>
                      <span></span>
                    </div>
                  </div>
                  <div className="repbar" style={{ margin: '10px 0 0' }}>
                    <button type="button" className="btn small" id="inAdd">
                      + เพิ่มรายการวัสดุ
                    </button>
                    <span className="sp"></span>
                    <div className="linesum">
                      รวมเป็นเงินทั้งสิ้น <span id="inSum">0.00</span> บาท
                    </div>
                  </div>
                </fieldset>
                <div className="formbar">
                  <span className="msg" id="inMsg"></span>
                  <button type="button" className="btn danger" id="inDel" hidden>
                    ลบใบรับนี้
                  </button>
                  <button type="button" className="btn" id="inReset">
                    ล้างฟอร์ม
                  </button>
                  <button type="submit" className="btn primary" id="inSave">
                    บันทึกรับเข้า
                  </button>
                </div>
              </form>

              <div className="card">
                <div className="cardhead">
                  <h3>ประวัติและทะเบียนใบรับวัสดุ</h3>
                  <div className="filters" style={{ margin: 0, flex: '0 1 420px' }}>
                    <input id="inQ" type="search" placeholder="ค้นหา เลขที่ใบรับ หรือผู้ขาย..." />
                    <select id="inFy"></select>
                  </div>
                </div>
                <div className="tablebox">
                  <table>
                    <thead>
                      <tr>
                        <th>เลขที่</th>
                        <th>วันที่รับ</th>
                        <th>ที่มา / ผู้ขาย</th>
                        <th>ใบสั่งซื้อ</th>
                        <th>รายการ</th>
                        <th className="num">มูลค่า (บาท)</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody id="inRows"></tbody>
                  </table>
                  <div className="empty" id="emptyIn" hidden></div>
                </div>
              </div>
            </div>
          </section>

          {/* ใบเบิก */}
          <section id="view-out" hidden>
            <div className="stack">
              <form className="card" id="outForm" autoComplete="off">
                <div className="cardhead">
                  <div>
                    <h3 id="outTitle">ออกใบเบิกวัสดุ</h3>
                    <span className="sub">บันทึกแล้วตัดยอดคงเหลืออัตโนมัติ และสามารถสั่งพิมพ์หรือส่งออกเป็นไฟล์ Word ได้ทันที</span>
                  </div>
                </div>
                <fieldset className="form-section">
                  <legend>ข้อมูลผู้เบิกและงานที่ใช้</legend>
                  <div className="grid">
                    <label className="f c3">
                      เลขที่ใบเบิก
                      <input id="outNo" placeholder="001/2570" />
                    </label>
                    <label className="f c3">
                      วันที่เบิก <span className="req">*</span>
                      <input id="outDate" type="date" required />
                    </label>
                    <label className="f c6">
                      ผู้เบิก <span className="req">*</span>
                      <input id="outReq" required list="peopleList" placeholder="ชื่อ-นามสกุล ผู้ขอเบิก" />
                    </label>
                    <label className="f c4">
                      ตำแหน่ง
                      <input id="outPos" list="posList" placeholder="ตำแหน่งของผู้เบิก" />
                    </label>
                    <label className="f c8">
                      เพื่อใช้ในงาน <span className="req">*</span>
                      <input
                        id="outPurpose"
                        required
                        placeholder="เช่น ซ่อมแซมถนนลาดยาง หมู่ 3 ตามคำร้องเลขรับ 012/2570"
                      />
                    </label>
                    <label className="f c12">
                      หมายเหตุ
                      <input id="outNote" placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)" />
                    </label>
                  </div>
                </fieldset>
                <datalist id="peopleList"></datalist>
                <datalist id="posList"></datalist>
                <fieldset className="form-section">
                  <legend>รายการวัสดุที่ขอเบิก</legend>
                  <div className="lines out" id="outLines">
                    <div className="lnhead">
                      <span>วัสดุ</span>
                      <span>จำนวนเบิก</span>
                      <span>คงเหลือในคลัง</span>
                      <span></span>
                    </div>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <button type="button" className="btn small" id="outAdd">
                      + เพิ่มรายการวัสดุ
                    </button>
                  </div>
                </fieldset>
                <div className="formbar">
                  <span className="msg" id="outMsg"></span>
                  <button type="button" className="btn danger" id="outDel" hidden>
                    ลบใบเบิกนี้ (คืนคลัง)
                  </button>
                  <button type="button" className="btn" id="outReset">
                    ล้างฟอร์ม
                  </button>
                  <button type="submit" className="btn" data-print="0">
                    บันทึกใบเบิก
                  </button>
                  <button type="submit" className="btn primary" data-print="1">
                    บันทึกและพิมพ์ใบเบิก
                  </button>
                </div>
              </form>

              <div className="card">
                <div className="cardhead">
                  <h3>ประวัติและทะเบียนใบเบิกวัสดุ</h3>
                  <div className="filters" style={{ margin: 0, flex: '0 1 420px' }}>
                    <input id="outQ" type="search" placeholder="ค้นหา เลขที่ ผู้เบิก หรือชื่องาน..." />
                    <select id="outFy"></select>
                  </div>
                </div>
                <div className="tablebox">
                  <table>
                    <thead>
                      <tr>
                        <th>เลขที่</th>
                        <th>วันที่</th>
                        <th>ผู้เบิก</th>
                        <th>เพื่อใช้ในงาน</th>
                        <th>รายการ</th>
                        <th className="num">มูลค่า (บาท)</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody id="outRows"></tbody>
                  </table>
                  <div className="empty" id="emptyOut" hidden></div>
                </div>
              </div>
            </div>
          </section>

          {/* ทะเบียนวัสดุ */}
          <section id="view-mat" hidden>
            <div className="stack">
              <form className="card" id="matForm" autoComplete="off">
                <div className="cardhead">
                  <div>
                    <h3 id="matTitle">เพิ่มวัสดุเข้าทะเบียน</h3>
                    <span className="sub">กำหนดชื่อ หน่วยนับ ประเภท และเกณฑ์แจ้งเตือนจำนวนอย่างสูง/อย่างต่ำ</span>
                  </div>
                </div>
                <div className="grid">
                  <div className="f c6">
                    <label htmlFor="mName">
                      ชื่อหรือชนิดวัสดุ <span className="req">*</span>
                    </label>
                    <div className="sug-wrap" id="mNameWrap">
                      <input
                        id="mName"
                        className="has-sug-btn"
                        required
                        autoComplete="off"
                        aria-autocomplete="list"
                        aria-controls="mNameSug"
                        aria-expanded="false"
                        placeholder="เช่น ยางมะตอยสำเร็จรูป, ดินสอดำ 2B"
                      />
                      <button
                        type="button"
                        className="sug-toggle"
                        id="mNameSugBtn"
                        tabIndex={-1}
                        aria-label="แสดงรายการเสนอชื่อวัสดุ"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
                      <div className="sug-box" id="mNameSug" role="listbox" hidden></div>
                    </div>
                  </div>
                  <div className="f c3">
                    <label htmlFor="mCat">ประเภทวัสดุ</label>
                    <div className="sug-wrap" id="mCatWrap">
                      <input
                        id="mCat"
                        className="has-sug-btn"
                        autoComplete="off"
                        aria-autocomplete="list"
                        aria-controls="mCatSug"
                        aria-expanded="false"
                        placeholder="เลือกจากรายการ หรือพิมพ์เอง"
                      />
                      <button
                        type="button"
                        className="sug-toggle"
                        id="mCatSugBtn"
                        tabIndex={-1}
                        aria-label="แสดงรายการประเภทวัสดุ"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
                      <div className="sug-box" id="mCatSug" role="listbox" hidden></div>
                    </div>
                  </div>
                  <label className="f c3">
                    รหัสวัสดุ (ถ้ามี)
                    <input id="mCode" placeholder="เช่น CON-001 (เว้นว่างได้)" />
                  </label>
                  <div className="f c3">
                    <label htmlFor="mUnit">
                      หน่วยที่นับ <span className="req">*</span>
                    </label>
                    <div className="sug-wrap" id="mUnitWrap">
                      <input
                        id="mUnit"
                        className="has-sug-btn"
                        required
                        autoComplete="off"
                        aria-autocomplete="list"
                        aria-controls="mUnitSug"
                        aria-expanded="false"
                        placeholder="เช่น ถุง, รีม, หลอด"
                      />
                      <button
                        type="button"
                        className="sug-toggle"
                        id="mUnitSugBtn"
                        tabIndex={-1}
                        aria-label="แสดงรายการหน่วยนับ"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
                      <div className="sug-box" id="mUnitSug" role="listbox" hidden></div>
                    </div>
                  </div>
                  <label className="f c5">
                    ขนาดหรือลักษณะ
                    <input id="mNote" placeholder="รายละเอียดขนาด ลักษณะ รุ่น หรือยี่ห้อ" />
                  </label>
                  <label className="f c4">
                    ที่เก็บ
                    <input id="mLoc" placeholder="เช่น คลังพัสดุกองช่าง, ตู้เก็บวัสดุ 1" />
                  </label>
                  <label className="f c4">
                    จำนวนอย่างสูง
                    <input id="mMax" type="number" min="0" step="any" inputMode="decimal" placeholder="เว้นว่างได้" />
                  </label>
                  <label className="f c4">
                    จำนวนอย่างต่ำ (จุดเตือนใกล้หมด)
                    <input id="mMin" type="number" min="0" step="any" inputMode="decimal" placeholder="เว้นว่างได้" />
                  </label>
                  <p className="sub c4" style={{ margin: 'auto 0 6px' }}>
                    ข้อมูลทั้งหมดใช้แสดงในหัวแบบฟอร์ม “บัญชีวัสดุ” ตามระเบียบพัสดุ
                  </p>
                </div>
                <div className="formbar" style={{ marginTop: 14 }}>
                  <span className="msg" id="mMsg"></span>
                  <button type="button" className="btn danger" id="mDel" hidden>
                    ลบวัสดุนี้
                  </button>
                  <button type="button" className="btn" id="mReset">
                    ล้างฟอร์ม
                  </button>
                  <button type="submit" className="btn primary">
                    บันทึกวัสดุ
                  </button>
                </div>
              </form>

              <div className="card" id="impCard">
                <div className="cardhead">
                  <div>
                    <h3>นำเข้าวัสดุจากไฟล์ Excel (.xlsx / .csv)</h3>
                    <span className="sub">เพิ่มทะเบียนวัสดุพร้อมยอดยกมาทีละหลายรายการอย่างรวดเร็ว</span>
                  </div>
                  <div className="imp-actions">
                    <button type="button" className="btn" id="impTpl">
                      ดาวน์โหลดแบบฟอร์ม Excel
                    </button>
                    <label className="btn primary" htmlFor="impFile" style={{ cursor: 'pointer' }}>
                      เลือกไฟล์ Excel เพื่อนำเข้า…
                    </label>
                    <input
                      id="impFile"
                      type="file"
                      accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                      hidden
                    />
                  </div>
                </div>
                <div className="msg imp-msg" id="impMsg"></div>
                <div id="impPrev" hidden>
                  <div className="tablebox impbox">
                    <table>
                      <thead>
                        <tr>
                          <th>แถว</th>
                          <th>ชื่อวัสดุ</th>
                          <th>ประเภท</th>
                          <th>หน่วย</th>
                          <th>หมายเหตุ</th>
                          <th className="num">อย่างสูง/ต่ำ</th>
                          <th className="num">ยกมา</th>
                          <th className="num">ราคา/หน่วย</th>
                          <th>สถานะ</th>
                        </tr>
                      </thead>
                      <tbody id="impRows"></tbody>
                    </table>
                  </div>
                  <div className="impopt" id="impOpen" hidden>
                    <label className="f" style={{ minWidth: 190 }}>
                      วันที่ยอดยกมา
                      <input id="impDate" type="date" />
                    </label>
                    <label className="f" style={{ minWidth: 150 }}>
                      เลขที่ใบรับ
                      <input id="impNo" />
                    </label>
                    <span className="sub" style={{ flex: '1 1 260px' }}>
                      รายการที่มีจำนวนยกมา จะถูกบันทึกเป็นใบรับ “ยอดยกมา” ให้อัตโนมัติ
                    </span>
                  </div>
                  <div className="formbar">
                    <span className="msg" id="impSum"></span>
                    <button type="button" className="btn" id="impCancel">
                      ยกเลิก
                    </button>
                    <button type="button" className="btn primary" id="impGo">
                      ยืนยันนำเข้าข้อมูล
                    </button>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="cardhead">
                  <h3>รายการในทะเบียนวัสดุทั้งหมด</h3>
                </div>
                <div className="tablebox">
                  <table>
                    <thead>
                      <tr>
                        <th>ชื่อหรือชนิดวัสดุ</th>
                        <th>รหัส</th>
                        <th>ประเภท</th>
                        <th>หน่วยนับ</th>
                        <th>ที่เก็บ</th>
                        <th className="num">อย่างสูง</th>
                        <th className="num">อย่างต่ำ</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody id="matRows"></tbody>
                  </table>
                  <div className="empty" id="emptyMat" hidden></div>
                </div>
              </div>
            </div>
          </section>

          {/* รายงาน */}
          <section id="view-report" hidden>
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="repbar" style={{ marginBottom: 12 }}>
                <div className="seg" role="group" aria-label="ประเภทรายงาน">
                  <button className="btn" data-rk="sum" aria-pressed="true">
                    สรุปรับ-จ่าย-คงเหลือ
                  </button>
                  <button className="btn" data-rk="card" aria-pressed="false">
                    บัญชีวัสดุ (รายตัว)
                  </button>
                  <button className="btn" data-rk="req" aria-pressed="false">
                    สรุปการเบิก (ผู้เบิก/งาน)
                  </button>
                  <button className="btn" data-rk="vs" aria-pressed="false">
                    แบบ อปท.-วส. (ประจำกอง)
                  </button>
                </div>
              </div>
              <div className="repbar repbar-toolbar" style={{ marginBottom: 0 }}>
                <div className="repbar-filters">
                  <label htmlFor="rFy" className="sub">
                    ปีงบประมาณ
                  </label>
                  <select id="rFy"></select>
                  <label htmlFor="rMonth" className="sub" id="rMonthLbl">
                    ช่วงเวลา
                  </label>
                  <select id="rMonth"></select>
                  <label htmlFor="rMat" className="sub" id="rMatLbl" hidden>
                    เลือกวัสดุ
                  </label>
                  <select id="rMat" hidden></select>
                  <label htmlFor="rSheetFmt" className="sub" id="rSheetFmtLbl" hidden>
                    รูปแบบแผ่นที่ (1)
                  </label>
                  <select id="rSheetFmt" hidden>
                    <option value="seq">001/1 (ลำดับชนิด/หน้า)</option>
                    <option value="cat">01/001/1 (ประเภท/ชนิด/หน้า)</option>
                  </select>
                  <label htmlFor="rGroup" className="sub" id="rGroupLbl" hidden>
                    จัดกลุ่มตาม
                  </label>
                  <select id="rGroup" hidden>
                    <option value="req">ผู้เบิก</option>
                    <option value="purpose">เพื่อใช้ในงาน</option>
                    <option value="cat">ประเภทวัสดุ</option>
                  </select>
                </div>
                <div className="repbar-actions">
                  <button className="btn" id="btnPrintRep">
                    พิมพ์รายงาน
                  </button>
                  <button className="btn primary" id="btnXlsx">
                    ส่งออก Excel
                  </button>
                </div>
              </div>
              <details className="vshead no-print" id="cardGuideBox" style={{ marginTop: 12 }} hidden>
                <summary>คำอธิบายวิธีทำบัญชีวัสดุ (1) – (8) ตามแบบฟอร์มราชการ</summary>
                <div className="sub" style={{ marginTop: 10, lineHeight: 1.65, color: 'var(--fg)' }}>
                  <p style={{ margin: '0 0 6px' }}>
                    <b>(1) แผ่นที่:</b> กรอกเลขแผ่นที่ตามลำดับชนิดของวัสดุ และทับด้วยลำดับหน้าบัญชีของวัสดุชนิดนั้น
                    ในกรณีใช้แผ่นเดียวไม่พอ เช่น แผ่นที่ 1 หน้า 1 กรอกว่า <code>001/1</code> หน้า 2 กรอกว่า{' '}
                    <code>001/2</code> หรือสำหรับหน่วยงานที่มีวัสดุจำนวนมากชนิด สามารถเลือกรูปแบบลำดับประเภท ชนิด
                    และหน้า เช่น <code>01/099/1</code>
                  </p>
                  <p style={{ margin: '0 0 6px' }}>
                    <b>(2) หน่วยงาน:</b> ระบุชื่อหน่วยงานซึ่งทำหน้าที่ควบคุมหรือเก็บรักษาวัสดุเพื่อจ่ายให้แก่หน่วยงานอื่น
                    (ตั้งค่าได้ที่แท็บ “ตั้งค่า / สำรองข้อมูล”)
                  </p>
                  <p style={{ margin: '0 0 6px' }}>
                    <b>(3) ประเภท:</b> ระบุประเภทของวัสดุตามที่กำหนดในหนังสือการจำแนกประเภทรายจ่ายตามงบประมาณของสำนักงบประมาณ
                  </p>
                  <p style={{ margin: '0 0 6px' }}>
                    <b>(4) ชื่อหรือชนิดวัสดุ:</b> ระบุชื่อหรือชนิดของวัสดุ เช่น ดินสอดำ ดินสอสี หรือแยกชนิดย่อย เช่น
                    ดินสอดำ 2B, ดินสอดำ 4B
                  </p>
                  <p style={{ margin: '0 0 6px' }}>
                    <b>(5) รหัส:</b> ระบุรหัสของวัสดุนั้น ๆ ตามที่กำหนดไว้ (ถ้ามี) กำหนดได้ที่แท็บ “ทะเบียนวัสดุทั้งหมด”
                  </p>
                  <p style={{ margin: '0 0 6px' }}>
                    <b>(6) หน่วยที่นับ:</b> ระบุหน่วยตามลักษณะของวัสดุและปริมาณที่ใช้ โดยหน่วยนับสำหรับช่องรับ ช่องจ่าย
                    และช่องคงเหลือจะต้องเป็นอย่างเดียวกัน
                  </p>
                  <p style={{ margin: '0 0 6px' }}>
                    <b>(7) จำนวนอย่างสูง / จำนวนอย่างต่ำ:</b> ระบุจำนวนอย่างสูงที่สมควรจะเก็บไว้ในคลังพัสดุ
                    และจำนวนอย่างต่ำที่หากไม่จัดหาเพิ่มเติมจะทำให้งานของทางราชการเสียหาย
                  </p>
                  <p style={{ margin: 0 }}>
                    <b>(8) เลขที่เอกสาร:</b> ลงเลขที่เอกสารตามลำดับที่รับหรือจ่าย แยกเป็นเอกสารฝ่ายรับ (<b>ร.1, ร.2, ร.3…</b>)
                    และเอกสารฝ่ายจ่าย (<b>จ.1, จ.2, จ.3…</b>) โดยเริ่มลำดับที่ 1 ใหม่เมื่อขึ้นปีงบประมาณใหม่
                  </p>
                </div>
              </details>
            </div>

            <div id="rep"></div>

            <div id="vsPanel" className="stack" hidden>
              <div className="card">
                <div className="cardhead">
                  <div>
                    <h3>
                      รายงานวัสดุคงเหลือประจำกอง (แบบ อปท. - วส.) — <span id="vDivName"></span>
                    </h3>
                    <span className="sub" id="vSelfSum"></span>
                  </div>
                  <div className="rowact no-print">
                    <button type="button" className="btn small" onClick={() => switchTab('set')}>
                      แก้ไขข้อมูลหน่วยงาน / ผู้ลงนาม
                    </button>
                  </div>
                </div>
                <p className="hint">
                  แสดงเฉพาะวัสดุที่มียอดคงเหลือประจำกองตามที่ตั้งค่าไว้ โดยแยกรายการตามราคาทุนที่รับเข้าจริง (FIFO)
                  ใช้ข้อมูลหน่วยงานและผู้ลงนามจากหน้า “ตั้งค่า / สำรองข้อมูล”
                </p>
                <div className="repbar" style={{ marginBottom: 10 }}>
                  <label htmlFor="vDate" className="sub">
                    ณ วันที่
                  </label>
                  <input id="vDate" type="date" style={{ width: 'auto' }} />
                  <span className="sub" id="vHeadSum"></span>
                  <span className="sp"></span>
                  <button type="button" className="btn" id="vSelfPrint">
                    ตัวอย่างก่อนพิมพ์ / พิมพ์รายงาน
                  </button>
                  <button type="button" className="btn primary" id="vSelfXlsx">
                    ส่งออก Excel (แบบ อปท.-วส.)
                  </button>
                </div>
                <div className="notice" id="vMissingSet" hidden style={{ marginBottom: 0 }}></div>
              </div>

              <div className="vs-preview-wrap">
                <div className="paper vs-preview-paper" id="vsPreview"></div>
              </div>
            </div>
          </section>

          {/* ตรวจนับประจำปี */}
          <section id="view-cnt" hidden>
            <div className="stack">
              <div className="card">
                <div className="cardhead">
                  <div>
                    <h3>ตรวจนับวัสดุคงเหลือประจำปี</h3>
                    <span className="sub" id="cSave"></span>
                  </div>
                </div>
                <p className="hint">
                  ตรวจนับวัสดุคงเหลือจริง ณ วันสิ้นปีงบประมาณ (30 กันยายน) เทียบกับยอดตามบัญชีวัสดุ
                  สามารถพิมพ์แบบฟอร์มไปตรวจนับ แล้วนำยอดที่นับได้มากรอกเพื่อคำนวณผลต่างและพิมพ์รายงานเสนอคณะกรรมการ
                </p>
                <div className="repbar">
                  <label htmlFor="cFy" className="sub">
                    ปีงบประมาณ
                  </label>
                  <select id="cFy"></select>
                  <label htmlFor="cDate" className="sub">
                    ตรวจนับ ณ วันที่
                  </label>
                  <input id="cDate" type="date" style={{ width: 'auto' }} />
                  <label className="sub" style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
                    <input type="checkbox" id="cZero" style={{ width: 'auto' }} /> แสดงวัสดุที่ยอดเป็น 0 ด้วย
                  </label>
                </div>
                <fieldset className="cmt">
                  <legend>คณะกรรมการตรวจสอบพัสดุประจำปี</legend>
                  <div className="grid" id="cCmt"></div>
                </fieldset>
                <div className="formbar" style={{ marginTop: 14 }}>
                  <span className="msg" id="cMsg"></span>
                  <button type="button" className="btn" id="cFill">
                    ใส่ยอดตามบัญชีในช่องที่ยังว่าง
                  </button>
                  <button type="button" className="btn" id="cBlank">
                    พิมพ์แบบฟอร์มตรวจนับ
                  </button>
                  <button type="button" className="btn" id="cXlsx">
                    ส่งออก Excel
                  </button>
                  <button type="button" className="btn primary" id="cPrint">
                    พิมพ์รายงานผลการตรวจนับ
                  </button>
                </div>
              </div>
              <div className="kpis" id="cKpi"></div>
              <div className="tablebox">
                <table className="ctab">
                  <thead>
                    <tr>
                      <th>รายการ</th>
                      <th>หน่วย</th>
                      <th className="num">คงเหลือตามบัญชี</th>
                      <th className="num">มูลค่า (บาท)</th>
                      <th style={{ width: 120 }}>ตรวจนับได้</th>
                      <th className="num">ผลต่าง</th>
                      <th style={{ width: 150 }}>สภาพ</th>
                      <th>หมายเหตุ</th>
                    </tr>
                  </thead>
                  <tbody id="cRows"></tbody>
                </table>
                <div className="empty" id="cEmpty" hidden></div>
              </div>
            </div>
          </section>

          {/* ตั้งค่า */}
          <section id="view-set" hidden>
            <div className="stack">
              <form className="card" id="setForm" autoComplete="off">
                <div className="cardhead">
                  <div>
                    <h3>ข้อมูลหน่วยงานและผู้ลงนาม</h3>
                    <span className="sub">
                      แสดงบนส่วนหัวของระบบ ใบเบิกวัสดุ และรายงานประจำปี (ชื่อผู้ลงนามเว้นว่างได้)
                    </span>
                  </div>
                </div>
                <fieldset className="form-section">
                  <legend>สังกัดและชื่อหน่วยงาน</legend>
                  <div className="grid">
                    <label className="f c6">
                      กอง / สำนัก <span className="req">*</span>
                      <input id="gDiv" required list="divList" placeholder="เช่น กองช่าง" />
                    </label>
                    <label className="f c6">
                      งาน / ฝ่าย
                      <input id="gWork" list="workList" placeholder="เช่น งานพัสดุ (เว้นว่างได้)" />
                    </label>
                    <datalist id="workList">
                      <option value="งานพัสดุ" />
                      <option value="งานการเงินและบัญชี" />
                      <option value="งานก่อสร้าง" />
                      <option value="งานออกแบบและควบคุมอาคาร" />
                      <option value="งานประสานสาธารณูปโภค" />
                      <option value="งานธุรการ" />
                    </datalist>
                    <label className="f c12">
                      ชื่อหน่วยงาน (องค์กรปกครองส่วนท้องถิ่น) <span className="req">*</span>
                      <input id="gOrg" required placeholder="เช่น องค์การบริหารส่วนตำบล... (ระบุชื่อ อปท.)" />
                    </label>
                    <label className="f c4">
                      อำเภอ
                      <input id="gAmp" placeholder="เช่น เมืองนครราชสีมา" />
                    </label>
                    <label className="f c4">
                      จังหวัด
                      <input id="gChw" placeholder="เช่น นครราชสีมา" />
                    </label>
                    <label className="f c4">
                      รหัสไปรษณีย์ (5 หลัก)
                      <input id="gZip" inputMode="numeric" maxLength={5} placeholder="เช่น 30000" />
                    </label>
                    <label className="f c6">
                      ชื่อเจ้าหน้าที่ประสานงาน
                      <input id="gCo" placeholder="เว้นว่าง = ใช้ชื่อเจ้าหน้าที่/ผู้จ่ายของ" />
                    </label>
                    <label className="f c6">
                      ตำแหน่งเจ้าหน้าที่ประสานงาน
                      <input id="gCoPos" placeholder="เว้นว่าง = ใช้ตำแหน่งเจ้าหน้าที่" />
                    </label>
                    <label className="f c6">
                      โทรศัพท์
                      <input id="gTel" placeholder="หมายเลขโทรศัพท์ติดต่อ" />
                    </label>
                    <label className="f c6">
                      โทรสาร
                      <input id="gFax" placeholder="หมายเลขโทรสาร (ถ้ามี)" />
                    </label>
                    <datalist id="divList">
                      <option value="สำนักปลัด" />
                      <option value="กองคลัง" />
                      <option value="กองช่าง" />
                      <option value="กองการศึกษา ศาสนาและวัฒนธรรม" />
                      <option value="กองสาธารณสุขและสิ่งแวดล้อม" />
                      <option value="กองสวัสดิการสังคม" />
                    </datalist>
                  </div>
                </fieldset>

                <fieldset className="form-section">
                  <legend>ผู้ลงนามในใบเบิกวัสดุและรายงาน</legend>
                  <div className="grid">
                    <label className="f c6">
                      ผู้อนุมัติ (ใบเบิกวัสดุ) / ผอ.กอง/สำนัก
                      <input id="gAppr" placeholder="เช่น นางสาวทัตพิชา ผาลี" />
                    </label>
                    <label className="f c6">
                      ตำแหน่งผู้อนุมัติ (แสดงหลัง "เรียน" และใต้ลายเซ็น)
                      <select id="gApprPos"></select>
                      <input id="gApprPosX" placeholder="พิมพ์ตำแหน่งผู้อนุมัติ / หัวหน้าส่วนราชการ" hidden />
                    </label>
                    <label className="f c6">
                      ผู้จ่าย / ผู้ควบคุมวัสดุ (และผู้จัดทำรายงาน)
                      <input id="gStaff" placeholder="เช่น นางสาวสุดา รอบคอบ" />
                    </label>
                    <label className="f c6">
                      ตำแหน่งผู้จ่าย / ผู้ควบคุมวัสดุ
                      <input id="gStaffPos" placeholder="เว้นว่าง = ผู้ควบคุมวัสดุ ตามชื่อกอง/สำนักที่ตั้งค่า" />
                    </label>
                  </div>
                  <div className="sub" style={{ marginTop: 8 }}>
                    ข้อมูลผู้อนุมัติ (ผอ.กอง/สำนัก) และผู้จ่าย (ผู้ควบคุมวัสดุ) ด้านบนจะเชื่อมโยงไปยังใบเบิกวัสดุ รายงานสรุป และเป็นค่าเริ่มต้นของ แบบ อปท. - วส. อัตโนมัติ
                  </div>
                  <div style={{ marginTop: 14 }}>
                    <div className="sub" style={{ fontWeight: 600, marginBottom: 8 }}>
                      ช่องลงชื่อที่ต้องการแสดงในใบเบิกวัสดุ
                    </div>
                    <div className="sigopts" id="gSigs"></div>
                  </div>
                </fieldset>

                <fieldset className="form-section">
                  <legend>ผู้ลงนามรายงานวัสดุคงเหลือ (แบบ อปท. - วส.)</legend>
                  <div className="grid">
                    <label className="f c6">
                      ผู้จัดทำรายงาน (ผู้ลงนามที่ 1)
                      <input id="gVsMk" placeholder="เว้นว่าง = ใช้ชื่อผู้จ่าย/ผู้ควบคุมวัสดุด้านบน" />
                    </label>
                    <label className="f c6">
                      ตำแหน่งผู้จัดทำ
                      <input id="gVsMkPos" placeholder="เว้นว่าง = ใช้ตำแหน่งผู้จ่าย/ผู้ควบคุมวัสดุด้านบน" />
                    </label>
                    <label className="f c6">
                      ผู้อำนวยการประจำกอง (ผู้ลงนามที่ 2)
                      <input id="gVsFin" placeholder="เว้นว่าง = ใช้ชื่อผู้อนุมัติ/ผอ.กองด้านบน" />
                    </label>
                    <label className="f c6">
                      ตำแหน่ง (ผู้ลงนามที่ 2)
                      <input id="gVsFinPos" placeholder="เว้นว่าง = ใช้ตำแหน่งผู้อนุมัติ/ผอ.กองด้านบน" />
                    </label>
                    <label className="f c6">
                      ปลัดองค์กรปกครองส่วนท้องถิ่น
                      <input id="gVsPal" placeholder="ชื่อ-สกุล ปลัด อปท." />
                    </label>
                    <label className="f c6">
                      ตำแหน่ง (ผู้ลงนามที่ 3)
                      <input id="gVsPalPos" placeholder="ค่าเริ่มต้น: ปลัดองค์กรปกครองส่วนท้องถิ่น" />
                    </label>
                    <label className="f c6">
                      ผู้บริหารองค์กรปกครองส่วนท้องถิ่น
                      <input id="gVsExe" placeholder="ชื่อ-สกุล นายก อปท." />
                    </label>
                    <label className="f c6">
                      ตำแหน่ง (ผู้ลงนามที่ 4)
                      <input id="gVsExePos" placeholder="ค่าเริ่มต้น: ผู้บริหารองค์กรปกครองส่วนท้องถิ่น" />
                    </label>
                  </div>
                </fieldset>

                <fieldset className="form-section">
                  <legend>โลโก้หน่วยงาน</legend>
                  <div className="logobox">
                    <div className="logoprev" id="logoPrev">
                      ยังไม่มีโลโก้
                    </div>
                    <div style={{ display: 'grid', gap: 8, minWidth: 0 }}>
                      <div className="rowact">
                        <label className="btn" htmlFor="logoFile" style={{ cursor: 'pointer' }}>
                          อัปโหลดรูปโลโก้…
                        </label>
                        <button type="button" className="btn danger" id="logoDel" hidden>
                          ลบโลโก้
                        </button>
                      </div>
                      <span className="sub">รองรับ PNG หรือ JPG (พื้นหลังโปร่งใสจะแสดงผลได้คมชัดที่สุด)</span>
                    </div>
                    <input id="logoFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden />
                  </div>
                </fieldset>

                <div className="formbar">
                  <span className="msg" id="gMsg"></span>
                  <button type="submit" className="btn primary">
                    บันทึกการตั้งค่า
                  </button>
                </div>
              </form>

              <div className="card">
                <div className="cardhead">
                  <div>
                    <h3>สำรองและกู้คืนข้อมูล (LocalStorage)</h3>
                    <span className="sub">จัดการไฟล์สำรองข้อมูลประจำเครื่องเพื่อความปลอดภัย</span>
                  </div>
                </div>
                <p className="hint">
                  <b>ข้อมูลทั้งหมดถูกจัดเก็บไว้ในเบราว์เซอร์ของเครื่องนี้ (LocalStorage)</b> แนะนำให้ดาวน์โหลดไฟล์สำรอง
                  (.json) เก็บไว้หรือเปิดระบบสำรองข้อมูลอัตโนมัติลงโฟลเดอร์ในเครื่อง <span id="lastBackup"></span>
                </p>
                <div className="repbar" style={{ margin: 0 }}>
                  <button className="btn primary" id="btnBackup">
                    ดาวน์โหลดไฟล์สำรอง (.json)
                  </button>
                  <label className="btn" htmlFor="restoreFile" style={{ cursor: 'pointer' }}>
                    เลือกไฟล์สำรองเพื่อกู้คืน…
                  </label>
                  <input id="restoreFile" type="file" accept=".json,application/json" hidden />
                  <button className="btn danger" id="btnRestore" hidden>
                    ยืนยันกู้คืนข้อมูล
                  </button>
                  <span className="sub" id="restoreMsg"></span>
                  <button className="btn danger" id="btnWipe" style={{ marginLeft: 'auto' }}>
                    ล้างข้อมูลทั้งหมด
                  </button>
                </div>
                <div className="abox">
                  <div className="abh">
                    <b>สำรองข้อมูลอัตโนมัติลงโฟลเดอร์ในเครื่อง</b>
                    <span className="sub">
                      บันทึกไฟล์สำรองอัตโนมัติทุกครั้งที่มีการแก้ไขข้อมูล (เก็บย้อนหลัง 30 วัน)
                    </span>
                  </div>
                  <div className="abst" id="abStatus"></div>
                  <div className="abbtn">
                    <button className="btn primary" id="abPick">
                      เลือกโฟลเดอร์สำรองอัตโนมัติ
                    </button>
                    <button className="btn" id="abAllow" hidden>
                      อนุญาตสำรองอัตโนมัติ
                    </button>
                    <button className="btn" id="abNow" hidden>
                      สำรองข้อมูลเดี๋ยวนี้
                    </button>
                    <button className="btn" id="abOff" hidden>
                      ปิดสำรองอัตโนมัติ
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ไฟล์ .html และการติดตั้งแอป */}
          <section id="view-install" hidden>
            <InstallAndPortableSection
              onDownloadStandaloneHtml={handleDownloadStandaloneHtml}
              onLoadSampleData={handleLoadSampleData}
              hasMaterials={materialCount > 0}
            />
          </section>

          <p className="foot no-print">
            คำนวณต้นทุนและมูลค่าคงเหลือตามวิธีเข้าก่อน-ออกก่อน (FIFO) · ปีงบประมาณเริ่มต้นวันที่ 1 ตุลาคม ถึง 30 กันยายน
          </p>
          </div>
        </div>
      </div>

      {/* Print Preview Modal */}
      <div className="modal" id="printModal" hidden role="dialog" aria-modal="true" aria-labelledby="pmTitle">
        <div className="bar">
          <h3 id="pmTitle">ใบเบิกวัสดุ</h3>
          <button className="btn primary" id="pmPdf">
            พิมพ์เอกสาร
          </button>
          <button className="btn" id="pmWord">
            ดาวน์โหลดไฟล์ Word (.docx)
          </button>
          <button className="btn" id="pmClose">
            ปิดหน้าต่าง
          </button>
          <div className="pmsigs" id="pmSigs" hidden></div>
        </div>
        <div className="scroll">
          <div className="paper" id="paper"></div>
        </div>
      </div>

      <div className="toast" id="toast" hidden></div>

      {/* Wipe Data Modal */}
      <div className="modal" id="wipeModal" hidden role="dialog" aria-modal="true" aria-labelledby="wpTitle">
        <div className="wpbox">
          <h3 id="wpTitle">ล้างข้อมูลทั้งหมดในเครื่อง</h3>
          <div id="wpSet" hidden>
            <p className="sub">
              กำหนดรหัสผ่านสำหรับยืนยันการล้างข้อมูล (อย่างน้อย 4 ตัวอักษร) เพื่อป้องกันการกดลบโดยไม่ตั้งใจ
            </p>
            <label className="f">
              ตั้งรหัสผ่าน
              <input type="password" id="wpNew1" autoComplete="new-password" />
            </label>
            <label className="f">
              ยืนยันรหัสผ่านอีกครั้ง
              <input type="password" id="wpNew2" autoComplete="new-password" />
            </label>
          </div>
          <div id="wpAsk" hidden>
            <p>
              ข้อมูลวัสดุ ใบรับ ใบเบิก และการตั้งค่าในเครื่องนี้จะถูกลบทั้งหมด <b>และไม่สามารถกู้คืนได้</b>{' '}
              หากไม่มีไฟล์สำรอง
            </p>
            <label className="f">
              กรอกรหัสผ่านเพื่อยืนยัน
              <input type="password" id="wpPass" autoComplete="current-password" />
            </label>
            <p className="sub" id="wpAuto"></p>
          </div>
          <div id="wpChg" hidden>
            <label className="f">
              รหัสผ่านเดิม
              <input type="password" id="wpOld" />
            </label>
            <label className="f">
              รหัสผ่านใหม่
              <input type="password" id="wpC1" />
            </label>
            <label className="f">
              ยืนยันรหัสผ่านใหม่
              <input type="password" id="wpC2" />
            </label>
          </div>
          <p className="msg err" id="wpMsg"></p>
          <div className="wpbar">
            <button className="btn" id="wpChgBtn" hidden>
              เปลี่ยนรหัสผ่าน
            </button>
            <span style={{ flex: 1 }}></span>
            <button className="btn" id="wpCancel">
              ยกเลิก
            </button>
            <button className="btn danger" id="wpGo">
              ล้างข้อมูล
            </button>
          </div>
        </div>
      </div>

      {/* Fiscal Year Management Modal */}
      <div className="modal" id="fyModal" hidden role="dialog" aria-modal="true" aria-labelledby="fyModalTitle">
        <div className="wpbox" style={{ width: 'min(480px, 94vw)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <h3 id="fyModalTitle" style={{ margin: 0 }}>
              จัดการและเพิ่มปีงบประมาณ
            </h3>
            <button type="button" className="btn small" id="fyModalClose">
              ปิดหน้าต่าง
            </button>
          </div>
          <p className="sub" style={{ margin: 0 }}>
            เพิ่มปีงบประมาณในอนาคตล่วงหน้า หรือเพิ่มปีงบประมาณย้อนหลัง เพื่อให้แสดงในตัวกรองปีงบประมาณทุกหน้าทันที
          </p>

          <div className="fy-quick-box">
            <button
              type="button"
              className="btn primary"
              id="fyQuickNext"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              + เพิ่มปีงบประมาณถัดไป
            </button>
            <div className="fy-custom-row">
              <label className="f" style={{ flex: 1 }}>
                ระบุปีงบประมาณ พ.ศ. (4 หลัก)
                <input
                  type="number"
                  id="fyNewInput"
                  min="2550"
                  max="2650"
                  step="1"
                  placeholder="เช่น 2571"
                />
              </label>
              <button type="button" className="btn" id="fyAddBtn" style={{ alignSelf: 'flex-end', height: 40 }}>
                + เพิ่มปีงบประมาณ
              </button>
            </div>
            <span className="msg" id="fyModalMsg"></span>
          </div>

          <div>
            <div className="sub" style={{ fontWeight: 700, marginBottom: 8 }}>
              ปีงบประมาณในระบบ (คลิกเพื่อสลับตัวกรองไปยังปีงบที่ต้องการ)
            </div>
            <div className="fy-manage-list" id="fyManageList"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
