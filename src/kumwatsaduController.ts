/* eslint-disable @typescript-eslint/no-explicit-any */
import { initMiniLibsAndDb } from './kumwatsaduRuntime';

export function bootKumWatsaduApp(onMaterialsChange?: (count: number) => void) {
  if ((window as any).__kumwatsadu_app_booted) return;
  (window as any).__kumwatsadu_app_booted = true;

  const localDb = initMiniLibsAndDb();
  const XLSX = (window as any).XLSX;
  const JSZip = (window as any).JSZip;

  const CATS = [
    'วัสดุก่อสร้าง',
    'วัสดุไฟฟ้าและวิทยุ',
    'วัสดุประปา',
    'วัสดุยานพาหนะและขนส่ง',
    'วัสดุเชื้อเพลิงและหล่อลื่น',
    'วัสดุสำนักงาน',
    'วัสดุงานบ้านงานครัว',
    'วัสดุการเกษตร',
    'วัสดุวิทยาศาสตร์หรือการแพทย์',
    'วัสดุเครื่องแต่งกาย',
    'วัสดุคอมพิวเตอร์',
    'วัสดุการศึกษา',
    'วัสดุอื่น',
  ];

  let db: any = null;
  let canWrite = true;
  let materials: any[] = [];
  let moves: any[] = [];
  const DEF_SET = {
    div: 'กองช่าง',
    org: 'ชื่อหน่วยงาน (แก้ได้ที่แท็บตั้งค่า)',
    appr: '',
    apprPos: 'ผู้อำนวยการกองช่าง',
    payer: '',
    payerPos: '',
  };
  let settings: any = { ...DEF_SET };

  const $ = (id: string) => document.getElementById(id) as any;
  const esc = (s: any) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const todayISO = () => {
    const d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  };
  const fyOf = (iso: string) => {
    if (!iso) return 0;
    const y = +iso.slice(0, 4) + 543;
    const m = +iso.slice(5, 7);
    return m >= 10 ? y + 1 : y;
  };
  const fyRange = (fy: number) => [fy - 544 + '-10-01', fy - 543 + '-09-30'];
  const TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const TH_MF = [
    'มกราคม',
    'กุมภาพันธ์',
    'มีนาคม',
    'เมษายน',
    'พฤษภาคม',
    'มิถุนายน',
    'กรกฎาคม',
    'สิงหาคม',
    'กันยายน',
    'ตุลาคม',
    'พฤศจิกายน',
    'ธันวาคม',
  ];
  const thDate = (iso: string) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return +d + ' ' + TH_M[+m - 1] + ' ' + String(+y + 543).slice(2);
  };
  const thDateFull = (iso: string) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return +d + ' ' + TH_MF[+m - 1] + ' ' + (+y + 543);
  };
  const r2 = (n: any) => Math.round((+n || 0) * 100) / 100;
  const fmtQ = (n: any) => (+n || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 });
  const fmtB = (n: any) => (+n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const CUR_FY = fyOf(todayISO());
  const fmtNo = (seq: number, fy: number) => String(seq).padStart(3, '0') + '/' + fy;

  const SRC: Record<string, string> = {
    purchase: 'จัดซื้อ/จัดจ้าง',
    opening: 'ยอดยกมา',
    transfer: 'รับโอน/บริจาค',
    other: 'อื่น ๆ',
  };

  const allCats = () => [...new Set([...CATS, ...materials.map((m) => m.cat).filter(Boolean)])];
  function fillSelect(sel: HTMLSelectElement, opts: Array<[string, string]>, keepFirst?: boolean) {
    if (!sel) return;
    const first = keepFirst ? sel.querySelector('option') : null;
    sel.innerHTML = '';
    if (first) sel.appendChild(first);
    opts.forEach(([v, l]) => {
      const o = document.createElement('option');
      o.value = v;
      o.textContent = l;
      sel.appendChild(o);
    });
  }
  function refreshCats() {
    const sCat = $('sCat');
    if (!sCat) return;
    const v = sCat.value;
    fillSelect(
      sCat,
      allCats().map((c) => [c, c]),
      true
    );
    sCat.value = [...sCat.options].some((o: any) => o.value === v) ? v : '';
    if ($('catList')) {
      $('catList').innerHTML = allCats()
        .map((c) => `<option value="${esc(c)}">`)
        .join('');
    }
  }

  const fullOrg = () => [settings.work, settings.div, settings.org].filter(Boolean).join(' ');
  function renderLogo() {
    const p = $('logoPrev');
    if (!p) return;
    p.innerHTML = settings.logo ? '<img alt="โลโก้หน่วยงาน">' : 'ยังไม่มีโลโก้';
    if (settings.logo && p.firstChild) (p.firstChild as HTMLImageElement).src = settings.logo;
    if ($('logoDel')) $('logoDel').hidden = !settings.logo;
  }
  function applySet(raw: any) {
    raw = raw || {};
    const d = { ...DEF_SET, ...raw };
    if (!('div' in raw) && raw.org) {
      const m = String(raw.org).match(/^((?:กอง|สำนัก)\S*)\s+(.+)$/);
      if (m) {
        d.div = m[1];
        d.org = m[2];
      } else d.div = '';
    }
    settings = d;
    document.getElementById('themeStyle')?.remove();
    if ($('mastOrg')) $('mastOrg').textContent = [d.work, d.div, d.org].filter(Boolean).join(' · ');
    const lg = $('mastLogo');
    const lgFb = $('mastLogoFallback');
    if (lg) {
      if (d.logo) {
        lg.src = d.logo;
        lg.hidden = false;
        if (lgFb) lgFb.hidden = true;
      } else {
        lg.hidden = true;
        lg.removeAttribute('src');
        if (lgFb) lgFb.hidden = false;
      }
    }
    renderLogo();
    refreshFy();
    refreshCntFy();
  }

  let L = new Map<string, any[]>();
  let editMat: string | null = null;
  let armed: string | null = null;
  let repKind = 'sum';
  let restoreData: any = null;

  let toastTimer: any = null;
  function toast(t: string) {
    const el = $('toast');
    if (!el) return;
    el.textContent = t;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.hidden = true), 3000);
  }
  function notice(t: string) {
    const el = $('notice');
    if (!el) return;
    el.textContent = t || '';
    el.hidden = !t;
  }
  function msg(id: string, t: string, err?: boolean | number) {
    const el = $(id);
    if (!el) return;
    el.textContent = t || '';
    el.classList.toggle('err', !!err);
  }
  function confirmClick(key: string, btn: HTMLElement, label?: string) {
    if (armed === key) {
      armed = null;
      return true;
    }
    armed = key;
    const old = btn.textContent;
    btn.textContent = label || 'กดอีกครั้งเพื่อยืนยัน';
    setTimeout(() => {
      if (armed === key) armed = null;
      btn.textContent = old;
    }, 4000);
    return false;
  }
  function errText(err: any) {
    const c = err?.code;
    if (c === 'invalid_argument') {
      canWrite = false;
      return 'บัญชีนี้ดูได้อย่างเดียว ไม่มีสิทธิ์บันทึก';
    }
    if (c === 'quota_exceeded')
      return 'พื้นที่ฐานข้อมูลเต็ม ดาวน์โหลดไฟล์สำรองเก็บไว้ แล้วลบรายการเก่าที่ไม่ใช้';
    return 'บันทึกไม่สำเร็จ (' + (c || 'error') + ') ลองอีกครั้ง';
  }

  const matById = (id: string) => materials.find((m) => m.id === id);
  const kindOrder = (k: string) => (k === 'in' ? 0 : 1);
  const mvSort = (a: any, b: any) =>
    (a.date || '').localeCompare(b.date || '') ||
    kindOrder(a.kind) - kindOrder(b.kind) ||
    (+a.seq || 0) - (+b.seq || 0) ||
    (a.createdAt || '').localeCompare(b.createdAt || '');

  function rebuildLedgers() {
    L = new Map();
    materials.forEach((m) => L.set(m.id, []));
    const sorted = moves.slice().sort(mvSort);
    const run: Record<string, any> = {};
    const lv = (lots: any[]) => r2(lots.reduce((t, l) => t + l.q * l.price, 0));
    sorted.forEach((mv) =>
      (mv.lines || []).forEach((l: any) => {
        if (!L.has(l.mid)) return;
        const s = run[l.mid] || (run[l.mid] = { lots: [], q: 0, last: 0 });
        const qty = +l.qty || 0;
        const row: any = { mv, date: mv.date, inQ: 0, inV: 0, outQ: 0, outV: 0, price: 0, parts: null };
        if (mv.kind === 'in') {
          row.inQ = qty;
          row.price = +l.price || 0;
          row.inV = r2(qty * row.price);
          s.last = row.price;
          const tail = s.lots[s.lots.length - 1];
          if (tail && tail.q < 0) {
            tail.q = r2(tail.q + qty);
            if (tail.q >= 0) {
              const left = tail.q;
              s.lots.pop();
              if (left > 0) s.lots.push({ q: left, price: row.price, date: mv.date, no: mv.no });
            }
          } else if (qty > 0) s.lots.push({ q: qty, price: row.price, date: mv.date, no: mv.no });
          s.q = r2(s.q + qty);
        } else {
          let need = qty;
          const parts: any[] = [];
          while (need > 1e-9 && s.lots.length && s.lots[0].q > 0) {
            const lt = s.lots[0];
            const t = Math.min(need, lt.q);
            parts.push({ q: r2(t), price: lt.price, v: r2(t * lt.price), no: lt.no });
            lt.q = r2(lt.q - t);
            need = r2(need - t);
            if (lt.q <= 1e-9) s.lots.shift();
          }
          if (need > 1e-9) {
            parts.push({ q: need, price: s.last, v: r2(need * s.last), no: '' });
            s.lots.push({ q: -need, price: s.last, date: mv.date, no: '' });
          }
          let bq = s.q;
          let bv = lv(s.lots) + parts.reduce((t, p) => t + p.v, 0);
          parts.forEach((p) => {
            bq = r2(bq - p.q);
            bv = r2(bv - p.v);
            p.balQ = bq;
            p.balV = bv;
          });
          row.parts = parts;
          row.outQ = qty;
          row.outV = r2(parts.reduce((t, p) => t + p.v, 0));
          row.price = parts.length === 1 ? parts[0].price : qty ? row.outV / qty : 0;
          s.q = r2(s.q - qty);
        }
        row.balQ = s.q;
        row.balV = lv(s.lots);
        row.lots = s.lots.map((x: any) => ({ q: x.q, price: x.price, date: x.date, no: x.no }));
        L.get(l.mid)!.push(row);
      })
    );
  }

  const EMPTY = { q: 0, v: 0, lots: [] as any[] };
  function stateBefore(mid: string, iso: string) {
    const rows = L.get(mid) || [];
    let s = EMPTY;
    for (const r of rows) {
      if (r.date < iso) s = { q: r.balQ, v: r.balV, lots: r.lots };
      else break;
    }
    return s;
  }
  function stateUpto(mid: string, iso: string) {
    const rows = L.get(mid) || [];
    let s = EMPTY;
    for (const r of rows) {
      if (r.date <= iso) s = { q: r.balQ, v: r.balV, lots: r.lots };
      else break;
    }
    return s;
  }
  function current(mid: string) {
    const rows = L.get(mid) || [];
    const r = rows[rows.length - 1];
    return r ? { q: r.balQ, v: r.balV, lots: r.lots } : EMPTY;
  }
  function priceGroups(lots: any[]) {
    const g: any[] = [];
    (lots || []).forEach((l) => {
      if (l.q <= 0) return;
      const o = g.find((x) => Math.abs(x.price - l.price) < 1e-9);
      if (o) o.q = r2(o.q + l.q);
      else g.push({ price: l.price, q: l.q });
    });
    g.forEach((x) => (x.v = r2(x.q * x.price)));
    return g;
  }
  function fifoValue(lots: any[], q: number) {
    let need = q;
    let v = 0;
    for (const l of lots || []) {
      if (need <= 0) break;
      if (l.q <= 0) continue;
      const t = Math.min(need, l.q);
      v += t * l.price;
      need -= t;
    }
    if (need > 0) {
      const last = (lots || []).filter((l) => l.q > 0).pop();
      v += need * (last ? last.price : 0);
    }
    return r2(v);
  }
  const priceCell = (lots: any[], html?: boolean) => {
    const g = priceGroups(lots);
    if (!g.length) return '—';
    if (g.length === 1) return fmtB(g[0].price);
    return html
      ? g.map((x) => `${fmtB(x.price)} <span class="sub">×${fmtQ(x.q)}</span>`).join('<br>')
      : g.map((x) => fmtB(x.price) + ' ×' + fmtQ(x.q)).join(', ');
  };
  function stockState(m: any, q: number): [string, string] {
    if (q <= 0) return ['st-out', 'หมด'];
    if (m.min != null && q <= m.min) return ['st-low', 'ต่ำกว่าอย่างต่ำ'];
    if (m.max != null && q > m.max) return ['st-over', 'เกินอย่างสูง'];
    return ['st-ok', 'มีในคลัง'];
  }
  const numOrNull = (v: any) => {
    v = String(v ?? '')
      .replace(/,/g, '')
      .trim();
    if (v === '') return null;
    const n = +v;
    return isFinite(n) && n >= 0 ? n : null;
  };
  const mmText = (m: any) =>
    [m.max != null ? 'อย่างสูง ' + fmtQ(m.max) : '', m.min != null ? 'อย่างต่ำ ' + fmtQ(m.min) : '']
      .filter(Boolean)
      .join(' · ');
  const matSort = (a: any, b: any) => a.name.localeCompare(b.name, 'th');
  const matLabel = (m: any) => m.name;
  const linesText = (mv: any) =>
    (mv.lines || [])
      .map((l: any) => {
        const m = matById(l.mid);
        return (m ? m.name : '(วัสดุถูกลบ)') + ' ' + fmtQ(l.qty) + ' ' + (m?.unit || '');
      })
      .join(', ');
  function moveValue(mv: any) {
    if (mv.kind === 'in')
      return (mv.lines || []).reduce((s: number, l: any) => s + r2((+l.qty || 0) * (+l.price || 0)), 0);
    let v = 0;
    (mv.lines || []).forEach((l: any) => {
      const r = (L.get(l.mid) || []).find((x) => x.mv === mv);
      if (r) v += r.outV;
    });
    return v;
  }

  if ($('fyStamp')) $('fyStamp').textContent = 'ปีงบประมาณ ' + CUR_FY;

  function sortFyCurrentFirst(years: number[]) {
    return [...years].sort((a, b) => {
      if (a === CUR_FY) return -1;
      if (b === CUR_FY) return 1;
      if (a > CUR_FY && b > CUR_FY) return a - b;
      if (a > CUR_FY) return -1;
      if (b > CUR_FY) return 1;
      return b - a;
    });
  }
  function fyList() {
    const custom = Array.isArray(settings?.customFys)
      ? settings.customFys.map(Number).filter((y: number) => y >= 2500 && y <= 2700)
      : [];
    const fromMoves = moves.map((m) => +(m.fy || fyOf(m.date)) || 0).filter(Boolean);
    const s = new Set<number>([CUR_FY, ...custom, ...fromMoves]);
    return sortFyCurrentFirst([...s].filter(Boolean));
  }
  function refreshFy(preferredFy?: string) {
    const list = fyList();
    (
      [
        ['topFySelect', true, 'ทุกปีงบประมาณ'],
        ['sFy', true, 'ทุกปีงบประมาณ'],
        ['inFy', true, 'ทุกปีงบประมาณ'],
        ['outFy', true, 'ทุกปีงบประมาณ'],
        ['rFy', false, ''],
      ] as Array<[string, boolean, string]>
    ).forEach(([id, all, allLbl]) => {
      const s = $(id);
      if (!s) return;
      const targetVal =
        preferredFy && (preferredFy === 'all' ? all : true)
          ? preferredFy
          : s.value || String(CUR_FY);
      fillSelect(s, [
        ...list.map((y): [string, string] => [
          String(y),
          'ปีงบ ' + y + (y === CUR_FY ? ' (ปัจจุบัน)' : ''),
        ]),
        ...(all ? ([['all', allLbl]] as Array<[string, string]>) : []),
      ]);
      s.value = [...s.options].some((o: any) => o.value === targetVal) ? targetVal : String(CUR_FY);
    });
    if ($('fyStamp')) {
      const activeFy = $('sFy')?.value || String(CUR_FY);
      $('fyStamp').textContent = activeFy === 'all' ? 'ทุกปีงบประมาณ' : 'ปีงบประมาณ ' + activeFy;
    }
  }

  const TAB_META: Record<string, { en: string; crumb: string; title: string; sub: string }> = {
    stock: {
      en: 'INVENTORY & MATERIAL MANAGEMENT',
      crumb: 'ภาพรวม',
      title: 'ภาพรวมงานควบคุมวัสดุ',
      sub: 'ติดตามมูลค่าวัสดุคงเหลือ รับเข้า เบิกจ่าย และสถานะสต็อกในที่เดียว',
    },
    in: {
      en: 'MATERIAL RECEIVING & LOTS',
      crumb: 'รับเข้าวัสดุ',
      title: 'รับวัสดุเข้าคลัง',
      sub: 'บันทึกใบรับวัสดุจากการจัดซื้อ ยอดยกมา หรือรับโอน พร้อมคำนวณต้นทุนแบบ FIFO',
    },
    out: {
      en: 'MATERIAL REQUISITION',
      crumb: 'ใบเบิกวัสดุ',
      title: 'ออกใบเบิกวัสดุ',
      sub: 'บันทึกการเบิกจ่าย ตัดสต็อกอัตโนมัติ และพิมพ์ใบเบิกวัสดุหรือส่งออกไฟล์ Word',
    },
    mat: {
      en: 'MATERIAL MASTER REGISTRY',
      crumb: 'ทะเบียนวัสดุ',
      title: 'ทะเบียนวัสดุทั้งหมด',
      sub: 'จัดการรายการวัสดุ กำหนดจุดเตือนขั้นต่ำ-ขั้นสูง และนำเข้าข้อมูลจากไฟล์ Excel',
    },
    report: {
      en: 'LEDGER & OFFICIAL REPORTS',
      crumb: 'รายงานพัสดุ',
      title: 'รายงานและบัญชีวัสดุ',
      sub: 'สรุปรับ-จ่าย-คงเหลือ บัญชีวัสดุรายตัว สรุปการเบิก และรายงานแบบ อปท.-วส.',
    },
    cnt: {
      en: 'ANNUAL PHYSICAL COUNT',
      crumb: 'ตรวจนับประจำปี',
      title: 'ตรวจนับวัสดุประจำปี',
      sub: 'บันทึกผลการตรวจนับคงเหลือสิ้นปีงบประมาณและพิมพ์รายงานคณะกรรมการตรวจนับ',
    },
    set: {
      en: 'SYSTEM SETTINGS & BACKUP',
      crumb: 'ตั้งค่า / สำรองข้อมูล',
      title: 'ตั้งค่าระบบและสำรองข้อมูล',
      sub: 'กำหนดชื่อหน่วยงาน ผู้ลงนาม สีของระบบ และจัดการไฟล์สำรองข้อมูลในเครื่อง',
    },
    install: {
      en: 'PORTABLE HTML & APP INSTALL',
      crumb: 'ไฟล์ .html / ติดตั้งแอป',
      title: 'ไฟล์ .html และการติดตั้งแอป',
      sub: 'ดาวน์โหลดระบบเป็นไฟล์ .html เดี่ยวสำหรับพกพา หรือติดตั้งเป็นโปรแกรมลงเครื่องคอมพิวเตอร์ (PWA)',
    },
  };

  function showTab(t: string) {
    if (!TAB_META[t]) t = 'stock';
    document.querySelectorAll('nav.tabs button').forEach((b: any) => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
    ['stock', 'in', 'out', 'mat', 'report', 'cnt', 'set', 'install'].forEach((k) => {
      const el = $('view-' + k);
      if (el) el.hidden = k !== t;
    });
    const meta = TAB_META[t];
    if (meta) {
      if ($('activeViewEn')) $('activeViewEn').textContent = meta.en;
      if ($('breadcrumbCurrent')) $('breadcrumbCurrent').textContent = meta.crumb;
      if ($('activeViewTitle')) $('activeViewTitle').textContent = meta.title;
      if ($('activeViewSub')) $('activeViewSub').textContent = meta.sub;
    }
    closeMatSugs();
    renderTab(t);
  }
  (window as any).showKumWatsaduTab = showTab;
  const curTab = () => (document.querySelector('nav.tabs button[aria-selected="true"]') as any)?.dataset.tab || 'stock';
  function renderTab(t: string) {
    const map: Record<string, () => void> = {
      stock: renderStock,
      in: renderIn,
      out: renderOut,
      mat: renderMat,
      report: renderReport,
      cnt: renderCount,
      set: renderSet,
      install: () => {},
    };
    map[t]?.();
  }

  document.querySelectorAll('nav.tabs button').forEach((b: any) => b.addEventListener('click', () => showTab(b.dataset.tab)));

  function renderAll() {
    rebuildLedgers();
    refreshCats();
    refreshFy();
    if ($('navCntStock')) $('navCntStock').textContent = String(materials.length);
    if ($('navCntIn')) $('navCntIn').textContent = String(moves.filter((m) => m.kind === 'in').length);
    if ($('navCntOut')) $('navCntOut').textContent = String(moves.filter((m) => m.kind === 'out').length);
    if ($('navCntMat')) $('navCntMat').textContent = String(materials.length);
    renderTab(curTab());
    onMaterialsChange?.(materials.length);
  }

  function getStockForFy(mid: string, fyVal: string) {
    if (!fyVal || fyVal === 'all') return current(mid);
    const [, fe] = fyRange(+fyVal || CUR_FY);
    return stateUpto(mid, fe);
  }

  function renderDash() {
    const fyVal = $('sFy')?.value || String(CUR_FY);
    const isAll = fyVal === 'all';
    const selFy = isAll ? CUR_FY : +fyVal || CUR_FY;
    const [fs, fe] = isAll ? ['0000-01-01', '9999-12-31'] : fyRange(selFy);
    const em = materials.slice();
    let val = 0;
    const outs: any[] = [];
    em.forEach((m) => {
      const c = getStockForFy(m.id, fyVal);
      val += c.v;
      if (c.q <= 0 || (m.min != null && c.q <= m.min)) outs.push(m);
    });
    const fyMoves = moves.filter((m) => {
      if (isAll) return true;
      const mFy = +(m.fy || fyOf(m.date));
      return mFy === selFy || (m.date >= fs && m.date <= fe);
    });
    const ins = fyMoves.filter((m) => m.kind === 'in' && m.src !== 'opening');
    const outsM = fyMoves.filter((m) => m.kind === 'out');
    const inV = ins.reduce((t, m) => t + moveValue(m), 0);
    const outV = outsM.reduce((t, m) => t + moveValue(m), 0);
    if ($('kValK')) {
      $('kValK').textContent = isAll
        ? 'มูลค่าวัสดุคงเหลือ (ทั้งหมด)'
        : selFy === CUR_FY
        ? 'มูลค่าวัสดุคงเหลือ'
        : 'มูลค่าคงเหลือ (ปีงบ ' + selFy + ')';
    }
    if ($('kInK')) {
      $('kInK').textContent = isAll
        ? 'รับเข้า (ทุกปีงบ)'
        : selFy === CUR_FY
        ? 'รับเข้า ปีงบนี้ (' + selFy + ')'
        : 'รับเข้า ปีงบ ' + selFy;
    }
    if ($('kOutValK')) {
      $('kOutValK').textContent = isAll
        ? 'เบิกจ่าย (ทุกปีงบ)'
        : selFy === CUR_FY
        ? 'เบิกจ่าย ปีงบนี้ (' + selFy + ')'
        : 'เบิกจ่าย ปีงบ ' + selFy;
    }
    $('kVal').innerHTML = esc(fmtB(val)) + '<small>บาท</small>';
    $('kValD').textContent = 'วัสดุในทะเบียน ' + em.length + ' รายการ';
    $('kIn').innerHTML = esc(fmtB(inV)) + '<small>บาท</small>';
    $('kInD').textContent = ins.length + ' ใบรับ (ไม่รวมยอดยกมา)';
    $('kOut').innerHTML = esc(fmtB(outV)) + '<small>บาท</small>';
    $('kOutD').textContent = outsM.length + ' ใบเบิก';
    $('kEmpty').innerHTML = outs.length + '<small>รายการ</small>';
    $('kOutBox').classList.toggle('alert', outs.length > 0);
    $('kOutK').textContent = (outs.length ? '⚠ ' : '') + 'วัสดุหมด / ใกล้หมด';
    $('kEmptyD').textContent = outs.length ? 'ควรจัดหาเพิ่ม' : 'ทุกรายการมีของพอ';

    const chartFy = isAll ? fyList()[0] || CUR_FY : selFy;
    const [cfs, cfe] = fyRange(chartFy);
    const chartMoves = isAll
      ? moves.filter((m) => (+(m.fy || fyOf(m.date)) === chartFy || (m.date >= cfs && m.date <= cfe)))
      : fyMoves;
    $('chTitle').textContent = 'มูลค่ารับเข้า-เบิกจ่ายรายเดือน ปีงบ ' + chartFy;
    const MO = [10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((m) => {
      const y = m >= 10 ? chartFy - 544 : chartFy - 543;
      return { key: y + '-' + pad2(m), lbl: TH_M[m - 1], full: TH_MF[m - 1] + ' ' + (y + 543), i: 0, o: 0, ni: 0, no: 0 };
    });
    const byKey = Object.fromEntries(MO.map((x) => [x.key, x]));
    chartMoves.forEach((m) => {
      const b = byKey[m.date.slice(0, 7)];
      if (!b || m.src === 'opening') return;
      const v = moveValue(m);
      if (m.kind === 'in') {
        b.i += v;
        b.ni++;
      } else {
        b.o += v;
        b.no++;
      }
    });
    drawMonthly(MO);

    const top = em
      .map((m) => ({ m, v: getStockForFy(m.id, fyVal).v, q: getStockForFy(m.id, fyVal).q }))
      .filter((x) => x.v > 0)
      .sort((a, b) => b.v - a.v)
      .slice(0, 6);
    const mx = top[0]?.v || 1;
    $('topVal').innerHTML = top.length
      ? top
          .map(
            (x) =>
              `<div class="hb" title="${esc(x.m.name)}: คงเหลือ ${fmtQ(x.q)} ${esc(x.m.unit)} มูลค่า ${fmtB(
                x.v
              )} บาท"><div class="t"><span>${esc(x.m.name)}</span><span>${fmtB(
                x.v
              )}</span></div><div class="track"><div class="fill" style="width:${Math.max(
                1.5,
                (x.v / mx) * 100
              )}%"></div></div><div class="sub">คงเหลือ ${fmtQ(x.q)} ${esc(x.m.unit)}</div></div>`
          )
          .join('')
      : '<div class="dempty">ยังไม่มีวัสดุคงเหลือ บันทึกรับเข้าที่แท็บ “รับเข้า”</div>';

    const recent = fyMoves
      .slice()
      .sort((a, b) => mvSort(b, a))
      .slice(0, 6);
    $('feed').innerHTML = recent.length
      ? recent
          .map(
            (m) =>
              `<li data-open="${esc(m.id)}" tabindex="0"><span class="kind ${m.kind}">${
                m.kind === 'in' ? 'รับเข้า' : 'เบิก'
              }</span><div style="min-width:0"><div class="ft">${esc(
                m.kind === 'in' ? m.vendor || SRC[m.src] || '' : m.requester + (m.purpose ? ' · ' + m.purpose : '')
              )}</div><div class="fs">${esc(thDate(m.date))} · ${m.kind === 'in' ? 'ใบรับ' : 'ใบเบิก'} ${esc(
                m.no
              )} · ${esc(linesText(m))}</div></div><span class="fv">${fmtB(moveValue(m))}</span></li>`
          )
          .join('')
      : '<div class="dempty">ยังไม่มีการรับหรือเบิกวัสดุ</div>';

    $('outCnt').textContent = outs.length ? outs.length + ' รายการ' : '';
    $('outList').innerHTML = outs.length
      ? outs
          .sort(matSort)
          .slice(0, 8)
          .map((m) => {
            const q = current(m.id).q;
            return q <= 0
              ? `<li><span>${esc(m.name)}</span><span class="pill st-out">หมด</span></li>`
              : `<li><span>${esc(m.name)} <span class="sub">เหลือ ${fmtQ(q)} / อย่างต่ำ ${fmtQ(m.min)} ${esc(
                  m.unit
                )}</span></span><span class="pill st-low">ใกล้หมด</span></li>`;
          })
          .join('') + (outs.length > 8 ? `<li class="sub">และอีก ${outs.length - 8} รายการ</li>` : '')
      : '<div class="dempty">✓ ไม่มีวัสดุหมดหรือต่ำกว่าจำนวนอย่างต่ำ</div>';
  }

  function niceMax(v: number) {
    if (v <= 0) return 1000;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
  }
  const fmtAxis = (v: number) =>
    v >= 1e6 ? (v / 1e6).toLocaleString('th-TH', { maximumFractionDigits: 1 }) + ' ล้าน' : v.toLocaleString('th-TH');

  function drawMonthly(MO: any[]) {
    const W = 640,
      H = 230,
      L = 58,
      Rr = 8,
      T = 10,
      B = 26,
      ih = H - T - B,
      iw = W - L - Rr,
      mx = niceMax(Math.max(...MO.map((m) => Math.max(m.i, m.o)))),
      y = (v: number) => T + ih - (v / mx) * ih,
      cw = iw / 12,
      bw = Math.min(16, (cw - 10) / 2);
    const bar = (x: number, v: number, c: string) => {
      if (v <= 0) return '';
      const h = Math.max(1.5, (v / mx) * ih),
        r = Math.min(4, h, bw / 2),
        yt = T + ih - h;
      return `<path d="M${x},${T + ih}V${yt + r}Q${x},${yt} ${x + r},${yt}H${x + bw - r}Q${x + bw},${yt} ${x + bw},${
        yt + r
      }V${T + ih}Z" fill="var(${c})"/>`;
    };
    let g = '';
    for (let k = 0; k <= 4; k++) {
      const v = (mx * k) / 4,
        yy = y(v);
      g += `<line x1="${L}" x2="${W - Rr}" y1="${yy}" y2="${yy}" stroke="var(--grid)" stroke-width="1"/><text x="${
        L - 8
      }" y="${yy + 4}" text-anchor="end">${fmtAxis(v)}</text>`;
    }
    let b = '',
      hit = '';
    MO.forEach((m, i) => {
      const cx = L + cw * i + cw / 2;
      b +=
        bar(cx - bw - 1, m.i, '--s-in') +
        bar(cx + 1, m.o, '--s-out') +
        `<text x="${cx}" y="${H - 8}" text-anchor="middle">${m.lbl}</text>`;
      hit += `<rect x="${L + cw * i}" y="${T}" width="${cw}" height="${ih}" fill="transparent" data-m="${i}" style="cursor:default"/>`;
    });
    const empty = MO.every((m) => !m.i && !m.o);
    $('chMonthly').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="กราฟแท่งมูลค่ารับเข้าและเบิกจ่ายรายเดือน">${g}<line x1="${L}" x2="${
      W - Rr
    }" y1="${T + ih}" y2="${T + ih}" stroke="var(--line)"/>${b}<rect id="hov" x="0" y="${T}" width="${cw}" height="${ih}" fill="var(--fg)" opacity="0" />${hit}${
      empty
        ? `<text x="${L + iw / 2}" y="${T + ih / 2}" text-anchor="middle" style="font-size:13px">ยังไม่มีการรับ-จ่ายในปีงบนี้</text>`
        : ''
    }</svg>`;
    const svg = $('chMonthly').querySelector('svg');
    const tip = $('vtip');
    const hov = svg.querySelector('#hov');
    const show = (e: MouseEvent) => {
      const r = (e.target as HTMLElement).closest('[data-m]') as HTMLElement | null;
      if (!r) {
        tip.hidden = true;
        hov.setAttribute('opacity', 0);
        return;
      }
      const m = MO[+r.dataset.m!];
      hov.setAttribute('x', r.getAttribute('x'));
      hov.setAttribute('opacity', 0.05);
      const box = $('chMonthly').getBoundingClientRect(),
        card = $('chMonthly').parentElement.getBoundingClientRect(),
        sc = box.width / W,
        cx = (+r.getAttribute('x')! + cw / 2) * sc + box.left - card.left;
      tip.innerHTML = `<b>${esc(m.full)}</b><br><i style="background:var(--s-in)"></i>รับเข้า ${fmtB(m.i)} บาท (${
        m.ni
      } ใบ)<br><i style="background:var(--s-out)"></i>เบิกจ่าย ${fmtB(m.o)} บาท (${m.no} ใบ)`;
      tip.hidden = false;
      const tw = tip.offsetWidth;
      tip.style.left = Math.min(card.width - tw / 2 - 6, Math.max(tw / 2 + 6, cx)) + 'px';
      tip.style.top = box.top - card.top + Math.max(T, y(Math.max(m.i, m.o)) - 10) * sc + 'px';
    };
    svg.addEventListener('mousemove', show);
    svg.addEventListener('mouseleave', () => {
      tip.hidden = true;
      hov.setAttribute('opacity', 0);
    });
  }

  function openDoc(id: string) {
    const mv = moves.find((m) => m.id === id);
    if (!mv) return;
    showTab(mv.kind === 'in' ? 'in' : 'out');
    openMoveDetail(mv);
  }
  document.addEventListener('click', (e) => {
    const li = (e.target as HTMLElement).closest('#feed [data-open]') as HTMLElement | null;
    if (li && li.dataset.open) openDoc(li.dataset.open);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const li = (e.target as HTMLElement).closest?.('#feed [data-open]') as HTMLElement | null;
      if (li && li.dataset.open) openDoc(li.dataset.open);
    }
  });

  let stockSubTab: 'dash' | 'list' = 'dash';
  function setStockSubTab(tab: 'dash' | 'list') {
    stockSubTab = tab;
    const isList = tab === 'list';
    document.querySelectorAll('[data-st]').forEach((b: any) => {
      const active = b.dataset.st === tab;
      b.setAttribute('aria-pressed', String(active));
      b.setAttribute('aria-selected', String(active));
    });
    if ($('stockDashPanel')) $('stockDashPanel').hidden = isList;
    if ($('stockListPanel')) $('stockListPanel').hidden = !isList;
    ['ofCat', 'ofState', 'ofSearch'].forEach((id) => {
      if ($(id)) $(id).hidden = !isList;
    });
  }
  document.querySelectorAll('[data-st]').forEach((b: any) =>
    b.addEventListener('click', () => {
      const next = b.dataset.st === 'list' ? 'list' : 'dash';
      setStockSubTab(next);
      renderStock();
    })
  );

  function renderStock() {
    setStockSubTab(stockSubTab);
    renderDash();
    const fyVal = $('sFy')?.value || String(CUR_FY);
    $('tCount').textContent =
      materials.length + ' รายการ · ' + (fyVal === 'all' ? 'ทุกปีงบประมาณ' : 'ปีงบประมาณ ' + fyVal);
    const q = $('sQ').value.trim().toLowerCase(),
      cat = $('sCat').value,
      st = $('sState').value;
    const rows = materials
      .slice()
      .sort(matSort)
      .filter((m) => {
        if (cat && m.cat !== cat) return false;
        const s = stockState(m, getStockForFy(m.id, fyVal).q)[0];
        if (st && s !== 'st-' + st) return false;
        if (q && !(m.name + ' ' + (m.cat || '') + ' ' + (m.note || '')).toLowerCase().includes(q)) return false;
        return true;
      });
    $('stockRows').innerHTML = rows
      .map((m) => {
        const c = getStockForFy(m.id, fyVal),
          [cls, lbl] = stockState(m, c.q);
        return `<tr>
    <td>${esc(m.name)}<div class="sub">${esc(m.cat || '')}</div></td><td>${esc(m.unit)}</td>
    <td class="num"><b>${fmtQ(c.q)}</b>${mmText(m) ? `<div class="sub">${esc(mmText(m))}</div>` : ''}</td><td class="num">${
          c.q > 0 ? priceCell(c.lots, true) : '—'
        }</td><td class="num">${fmtB(c.v)}</td>
    <td><span class="pill ${cls}">${lbl}</span></td>
    <td><div class="rowact"><button class="btn small" data-card="${esc(m.id)}">บัญชีวัสดุ</button></div></td></tr>`;
      })
      .join('');
    const em = $('emptyStock');
    if (!db) {
      em.hidden = false;
      em.innerHTML = '<b>กำลังโหลดข้อมูล…</b>ถ้าข้อความนี้ค้างอยู่ ให้เปิดไฟล์นี้ด้วย Chrome หรือ Edge';
    } else if (!materials.length) {
      em.hidden = false;
      em.innerHTML =
        '<b>ยังไม่มีวัสดุในทะเบียน</b>เริ่มที่แท็บ “ทะเบียนวัสดุ” เพิ่มรายการ เช่น ยางมะตอยสำเร็จรูป แล้วบันทึกยอดยกมาที่แท็บ “รับเข้า” (หรือกดปุ่ม “โหลดข้อมูลตัวอย่างทดลองใช้” ด้านบน)';
    } else if (!rows.length) {
      em.hidden = false;
      em.innerHTML = '<b>ไม่พบวัสดุตามเงื่อนไข</b>ลองล้างคำค้นหาหรือเปลี่ยนตัวกรอง';
    } else em.hidden = true;
  }

  ['sQ', 'sCat', 'sState'].forEach((id) => {
    $(id)?.addEventListener('input', renderStock);
    $(id)?.addEventListener('change', renderStock);
  });
  $('sFy')?.addEventListener('change', () => {
    const v = $('sFy').value;
    if ($('topFySelect')) $('topFySelect').value = v;
    renderStock();
  });
  $('sReset')?.addEventListener('click', () => {
    if ($('sQ')) $('sQ').value = '';
    if ($('sCat')) $('sCat').value = '';
    if ($('sState')) $('sState').value = '';
    if ($('sFy')) $('sFy').value = String(CUR_FY);
    if ($('topFySelect')) $('topFySelect').value = String(CUR_FY);
    renderStock();
    toast('รีเฟรชและล้างตัวกรองแล้ว');
  });
  document.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('[data-card]') as HTMLElement | null;
    if (!b) return;
    repKind = 'card';
    setRepSeg();
    const fyVal = $('sFy')?.value;
    if (fyVal && fyVal !== 'all' && $('rFy')) {
      $('rFy').value = fyVal;
      fillRepSelects();
    }
    showTab('report');
    $('rMat').value = b.dataset.card;
    renderReport();
  });

  function matOpts(withBal?: boolean): Array<[string, string]> {
    return materials
      .slice()
      .sort(matSort)
      .map((m) => [
        m.id,
        matLabel(m) + (withBal ? ' (เหลือ ' + fmtQ(current(m.id).q) + ' ' + m.unit + ')' : ''),
      ]);
  }
  function lastPrice(mid: string) {
    const rows = (L.get(mid) || []).filter((r) => r.mv.kind === 'in' && r.price);
    return rows.length ? rows[rows.length - 1].price : '';
  }
  function oldQty(mv: any, mid: string) {
    return mv ? (mv.lines || []).filter((l: any) => l.mid === mid).reduce((s: number, l: any) => s + (+l.qty || 0), 0) : 0;
  }
  function nextSeq(kind: string, fy: number) {
    return moves.filter((m) => m.kind === kind && m.fy === fy).reduce((x, m) => Math.max(x, +m.seq || 0), 0) + 1;
  }
  function parseNo(v: string, kind: string, date: string) {
    const s = String(v || '').trim(),
      m = s.match(/^(\d+)\s*\/\s*(\d{4})$/);
    if (m) return { seq: +m[1], fy: +m[2], no: fmtNo(+m[1], +m[2]) };
    const fy = fyOf(date);
    if (!s) {
      const seq = nextSeq(kind, fy);
      return { seq, fy, no: fmtNo(seq, fy) };
    }
    return { seq: 0, fy, no: s };
  }
  const ICO_EYE =
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
  const ICO_PRINT =
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>';
  const ICO_WORD =
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M8.5 13.5 10 18l2-3.5 2 3.5 1.5-4.5"/></svg>';
  const ICO_EDIT =
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';

  let modalMvId: string | null = null;
  let modalFormKind: 'in' | 'out' | null = null;
  let modalOpenedFromView = false;

  function closeMoveDetail() {
    const mod = $('mvDetailModal');
    if (mod) mod.hidden = true;
    modalMvId = null;
    modalFormKind = null;
    modalOpenedFromView = false;
  }
  $('mvDetailClose')?.addEventListener('click', closeMoveDetail);
  $('mvDetailModal')?.addEventListener('click', (e: MouseEvent) => {
    if (e.target === $('mvDetailModal')) closeMoveDetail();
  });
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape' && $('mvDetailModal') && !$('mvDetailModal').hidden) {
      closeMoveDetail();
    }
  });

  function openMoveDetail(mv: any) {
    if (!mv) return;
    modalMvId = mv.id;
    modalFormKind = mv.kind === 'out' ? 'out' : 'in';
    modalOpenedFromView = false;
    const isOut = mv.kind === 'out';
    const titleEl = $('mvDetailTitle');
    const subEl = $('mvDetailSub');
    const bodyEl = $('mvDetailBody');
    const footEl = $('mvDetailFoot');
    if (!bodyEl || !footEl) return;

    if (titleEl) {
      titleEl.textContent = (isOut ? 'รายละเอียดใบเบิกวัสดุ เลขที่ ' : 'รายละเอียดใบรับวัสดุ เลขที่ ') + (mv.no || '—');
    }
    if (subEl) {
      subEl.textContent = `ปีงบประมาณ ${mv.fy || fyOf(mv.date)} · วันที่ ${thDateFull(mv.date) || '—'} · ${(mv.lines || []).length} รายการ`;
    }

    const kvItems: Array<{ k: string; v: string; full?: boolean }> = isOut
      ? [
          { k: 'เลขที่ใบเบิก', v: mv.no || '—' },
          { k: 'วันที่เบิก', v: thDateFull(mv.date) || '—' },
          { k: 'ผู้ขอเบิก', v: mv.requester || '—' },
          { k: 'ตำแหน่งผู้เบิก', v: mv.reqPos || '—' },
          { k: 'เพื่อใช้ในงาน', v: mv.purpose || '—', full: true },
          { k: 'หมายเหตุ', v: mv.note || '—', full: true },
        ]
      : [
          { k: 'เลขที่ใบรับ', v: mv.no || '—' },
          { k: 'วันที่รับ', v: thDateFull(mv.date) || '—' },
          { k: 'ประเภทการรับ', v: SRC[mv.src] || '—' },
          { k: 'วันที่ตรวจรับ', v: mv.src === 'opening' ? '—' : thDateFull(mv.inspectDate) || '—' },
          { k: 'ที่มา / ผู้ขาย', v: mv.vendor || '—' },
          { k: 'เลขที่ใบสั่งซื้อ/จ้าง', v: mv.poNo || '—' },
          { k: 'เลขที่ใบส่งของ', v: mv.invoiceNo || '—' },
          { k: 'หมายเหตุ', v: mv.note || '—', full: true },
        ];

    const kvHtml = `<div class="mv-kv-grid">${kvItems
      .map(
        (it) =>
          `<div class="mv-kv${it.full ? ' full' : ''}"><span class="mv-kv-k">${esc(it.k)}</span><span class="mv-kv-v">${esc(
            it.v
          )}</span></div>`
      )
      .join('')}</div>`;

    const lines = mv.lines || [];
    const linesRowsHtml = lines
      .map((l: any, idx: number) => {
        const m = matById(l.mid);
        const name = m ? m.name : '(วัสดุถูกลบ)';
        const unit = m?.unit || '';
        const metaParts = [m?.code ? `รหัส ${m.code}` : '', m?.cat || '', m?.loc ? `ที่เก็บ ${m.loc}` : ''].filter(Boolean);
        let unitPrice = +l.price || 0;
        let lineTotal = r2((+l.qty || 0) * unitPrice);
        if (isOut) {
          const led = (L.get(l.mid) || []).find((x) => x.mv === mv);
          lineTotal = led ? led.outV : 0;
          unitPrice = (+l.qty || 0) > 0 ? lineTotal / +l.qty : 0;
        }
        return `<tr>
          <td class="num" style="width:52px">${idx + 1}</td>
          <td><div>${esc(name)}</div>${metaParts.length ? `<div class="sub">${esc(metaParts.join(' · '))}</div>` : ''}</td>
          <td class="num">${fmtQ(l.qty)}${unit ? ' ' + esc(unit) : ''}</td>
          <td class="num">${fmtB(unitPrice)}</td>
          <td class="num">${fmtB(lineTotal)}</td>
        </tr>`;
      })
      .join('');

    const totalVal = moveValue(mv);
    const linesHtml = `<div>
      <div class="mv-lines-title">รายการวัสดุทั้งหมด (${lines.length} รายการ)</div>
      <div class="tablebox">
        <table>
          <thead>
            <tr>
              <th class="num" style="width:52px">ลำดับ</th>
              <th>ชื่อหรือชนิดวัสดุ</th>
              <th class="num">${isOut ? 'จำนวนเบิก' : 'จำนวนรับ'}</th>
              <th class="num">${isOut ? 'ราคาเฉลี่ย/หน่วย (บาท)' : 'ราคา/หน่วย (บาท)'}</th>
              <th class="num">จำนวนเงิน (บาท)</th>
            </tr>
          </thead>
          <tbody>${linesRowsHtml || '<tr><td colspan="5" style="text-align:center;color:var(--muted)">ไม่มีรายการวัสดุ</td></tr>'}</tbody>
          <tfoot>
            <tr>
              <td colspan="4" style="text-align:right">รวมมูลค่าทั้งสิ้น</td>
              <td class="num">${fmtB(totalVal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>`;

    bodyEl.innerHTML = kvHtml + linesHtml;

    const btns: string[] = [];
    if (isOut) {
      btns.push(`<button type="button" class="btn primary" data-md-prn="${esc(mv.id)}">พิมพ์ใบเบิก</button>`);
      btns.push(`<button type="button" class="btn" data-md-slip="${esc(mv.id)}">ดาวน์โหลด Word</button>`);
    }
    if (canWrite) {
      btns.push(`<button type="button" class="btn" data-md-edit="${esc(mv.id)}">แก้ไขข้อมูล</button>`);
    }
    btns.push(`<button type="button" class="btn" data-md-close="1">ปิดหน้าต่าง</button>`);
    footEl.innerHTML = btns.join('');

    $('mvDetailModal').hidden = false;
  }

  function openMoveForm(kind: 'in' | 'out', mv: any | null, fromView = false) {
    if (!canWrite) {
      if (mv) return openMoveDetail(mv);
      toast('บัญชีนี้ดูได้อย่างเดียว ไม่มีสิทธิ์บันทึก');
      return;
    }
    const isNew = !mv;
    const isOut = kind === 'out';
    modalMvId = mv ? mv.id : null;
    modalFormKind = kind;
    modalOpenedFromView = !isNew && fromView;

    const titleEl = $('mvDetailTitle');
    const subEl = $('mvDetailSub');
    const bodyEl = $('mvDetailBody');
    const footEl = $('mvDetailFoot');
    if (!bodyEl || !footEl) return;

    const fySelVal = $(isOut ? 'outFy' : 'inFy')?.value;
    let defaultDate = todayISO();
    if (isNew && fySelVal && fySelVal !== 'all') {
      const targetFy = +fySelVal;
      if (targetFy && fyOf(defaultDate) !== targetFy) {
        defaultDate = targetFy === CUR_FY ? todayISO() : targetFy - 544 + '-10-01';
      }
    }
    const docDate = mv?.date || defaultDate;
    const docNo = mv ? mv.no || '' : fmtNo(nextSeq(kind, fyOf(docDate)), fyOf(docDate));
    const docSrc = mv?.src || 'purchase';
    const docInspect = mv ? mv.inspectDate || '' : '';

    if (titleEl) {
      if (isNew) {
        titleEl.textContent = isOut ? 'ออกใบเบิกวัสดุ' : 'บันทึกรับวัสดุเข้าคลัง';
      } else {
        titleEl.textContent = (isOut ? 'แก้ไขใบเบิกวัสดุ เลขที่ ' : 'แก้ไขใบรับวัสดุ เลขที่ ') + (mv.no || '');
      }
    }
    if (subEl) {
      if (isNew) {
        subEl.textContent = isOut
          ? 'บันทึกแล้วตัดยอดคงเหลืออัตโนมัติ และสามารถสั่งพิมพ์หรือส่งออกเป็นไฟล์ Word ได้ทันที'
          : 'ราคาต่อหน่วยใช้คิดมูลค่าในบัญชีวัสดุตามลำดับรับเข้า (FIFO)';
      } else {
        subEl.textContent = 'แก้ไขรายละเอียดและรายการวัสดุทั้งหมดในหน้านี้ แล้วกดบันทึกการแก้ไข';
      }
    }

    const headerFormHtml = isOut
      ? `<div class="mv-edit-section"><div class="grid">
          <label class="f c4">เลขที่ใบเบิก<input id="mdNo" placeholder="001/2570" value="${esc(docNo)}" /></label>
          <label class="f c4">วันที่เบิก <span class="req">*</span><input id="mdDate" type="date" value="${esc(
            docDate
          )}" /></label>
          <label class="f c4">ผู้เบิก <span class="req">*</span><input id="mdReq" list="peopleList" placeholder="ชื่อ-นามสกุล ผู้ขอเบิก" value="${esc(
            mv?.requester || ''
          )}" /></label>
          <label class="f c4">ตำแหน่ง<input id="mdPos" list="posList" placeholder="ตำแหน่งของผู้เบิก" value="${esc(
            mv?.reqPos || ''
          )}" /></label>
          <label class="f c8">เพื่อใช้ในงาน <span class="req">*</span><input id="mdPurpose" placeholder="เช่น ซ่อมแซมถนนลาดยาง หมู่ 3 ตามคำร้องเลขรับ 012/2570" value="${esc(
            mv?.purpose || ''
          )}" /></label>
          <label class="f c12">หมายเหตุ<input id="mdNote" placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)" value="${esc(
            mv?.note || ''
          )}" /></label>
        </div></div>`
      : `<div class="mv-edit-section"><div class="grid">
          <label class="f c4">ที่มา<select id="mdSrc">${Object.entries(SRC)
            .map(([k, v]) => `<option value="${esc(k)}"${k === docSrc ? ' selected' : ''}>${esc(v)}</option>`)
            .join('')}</select></label>
          <label class="f c4">เลขที่ใบรับ<input id="mdNo" placeholder="001/2570" value="${esc(docNo)}" /></label>
          <label class="f c4">วันที่รับ <span class="req">*</span><input id="mdDate" type="date" value="${esc(
            docDate
          )}" /></label>
          <label class="f c6"><span id="mdVendorTxt">ผู้ขาย / รับจาก</span> <span class="req" id="mdVendorReq">*</span><input id="mdVendor" placeholder="ชื่อร้านค้า / หน่วยงาน" value="${esc(
            mv?.vendor || ''
          )}" /></label>
          <label class="f c3" id="mdInspectLbl">วันที่ตรวจรับ <span class="req">*</span><input id="mdInspect" type="date" value="${esc(
            docInspect
          )}" /></label>
          <label class="f c3" id="mdPoLbl">เลขที่ใบสั่งซื้อ/สัญญา<input id="mdPo" placeholder="เช่น 45/2570" value="${esc(
            mv?.poNo || ''
          )}" /></label>
          <label class="f c4">เลขที่ใบส่งของ/ใบกำกับ<input id="mdInv" placeholder="ระบุเลขที่ใบส่งของ (ถ้ามี)" value="${esc(
            mv?.invoiceNo || ''
          )}" /></label>
          <label class="f c8">หมายเหตุ<input id="mdNote" placeholder="เช่น โครงการซ่อมแซมถนนในตำบล" value="${esc(
            mv?.note || ''
          )}" /></label>
        </div></div>`;

    const linesSectionHtml = `<div class="mv-edit-section">
      <div class="mv-lines-title">${isOut ? 'รายการวัสดุที่ขอเบิก' : 'รายการวัสดุที่รับเข้า'}</div>
      <div class="lines ${isOut ? 'out' : 'in'}" id="mdEditLines">
        <div class="lnhead">${
          isOut
            ? '<span>วัสดุ</span><span>จำนวนเบิก</span><span>คงเหลือในคลัง</span><span></span>'
            : '<span>วัสดุ</span><span>จำนวน</span><span>ราคา/หน่วย (บาท)</span><span>รวมเงิน</span><span></span>'
        }</div>
      </div>
      <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;margin-top:10px">
        <button type="button" class="btn small" id="mdAddLine">+ เพิ่มรายการวัสดุ</button>
        ${isOut ? '' : '<div class="linesum">รวมเป็นเงินทั้งสิ้น <span id="mdInSum">0.00</span> บาท</div>'}
      </div>
      <div class="mv-edit-msg" id="mdEditMsg"></div>
    </div>`;

    bodyEl.innerHTML = headerFormHtml + linesSectionHtml;

    const mdLinesBox = $('mdEditLines');
    const sumMdIn = () => {
      if (isOut || !$('mdInSum')) return;
      const tot = [...mdLinesBox.querySelectorAll('.ln')].reduce((s: number, r: any) => {
        const i = r.querySelectorAll('input');
        return s + r2((+i[0].value || 0) * (+i[1].value || 0));
      }, 0);
      $('mdInSum').textContent = fmtB(tot);
    };
    const addMdLine = (l?: any, focusNew = false) => {
      if (!materials.length) {
        toast('ยังไม่มีวัสดุในทะเบียน เพิ่มได้ที่แท็บ “ทะเบียนวัสดุ”');
        return;
      }
      const row = document.createElement('div');
      row.className = 'ln';
      row.innerHTML = isOut
        ? '<select aria-label="วัสดุ"></select><input type="number" min="0" step="any" placeholder="จำนวน" aria-label="จำนวน"><span class="bal"></span><button type="button" class="btn small" aria-label="ลบบรรทัด">ลบ</button>'
        : '<select aria-label="วัสดุ"></select><input type="number" min="0" step="any" placeholder="จำนวน" aria-label="จำนวน"><input type="number" min="0" step="any" placeholder="ราคา/หน่วย" aria-label="ราคาต่อหน่วย"><span class="tot">0.00</span><button type="button" class="btn small" aria-label="ลบบรรทัด">ลบ</button>';
      const sel = row.querySelector('select') as HTMLSelectElement;
      const ins = row.querySelectorAll('input');
      fillSelect(sel, matOpts(false));
      if (l) {
        sel.value = l.mid;
        ins[0].value = l.qty;
        if (!isOut) ins[1].value = l.price ?? '';
      } else if (!isOut) {
        const last = lastPrice(sel.value);
        if (last) ins[1].value = String(last);
      }
      const upd = () => {
        if (!isOut) {
          row.querySelector('.tot')!.textContent = fmtB(r2((+ins[0].value || 0) * (+ins[1].value || 0)));
          sumMdIn();
        } else {
          const m = matById(sel.value);
          const avail = r2(current(sel.value).q + oldQty(mv, sel.value));
          const balEl = row.querySelector('.bal')!;
          balEl.textContent = m ? 'เหลือ ' + fmtQ(avail) + ' ' + m.unit : '';
          balEl.className = 'bal' + ((+ins[0].value || 0) > avail ? ' out' : '');
        }
      };
      sel.addEventListener('change', () => {
        if (!isOut && !ins[1].value) {
          const p = lastPrice(sel.value);
          if (p) ins[1].value = String(p);
        }
        upd();
      });
      ins.forEach((i) => i.addEventListener('input', upd));
      row.querySelector('button')!.addEventListener('click', () => {
        row.remove();
        if (!isOut) sumMdIn();
      });
      mdLinesBox.appendChild(row);
      upd();
      if (focusNew) sel.focus();
    };

    if (mv && (mv.lines || []).length) {
      mv.lines.forEach((l: any) => addMdLine(l, false));
    } else if (materials.length) {
      addMdLine(undefined, false);
    }

    const syncMdSrc = () => {
      if (isOut || !$('mdSrc')) return;
      const opening = $('mdSrc').value === 'opening';
      if ($('mdPoLbl')) $('mdPoLbl').hidden = opening;
      if ($('mdInspectLbl')) $('mdInspectLbl').hidden = opening;
      if ($('mdVendorReq')) $('mdVendorReq').hidden = opening;
      if ($('mdVendorTxt')) $('mdVendorTxt').textContent = opening ? 'ยกมาจาก' : 'ผู้ขาย / รับจาก';
    };
    syncMdSrc();
    $('mdSrc')?.addEventListener('change', syncMdSrc);
    $('mdAddLine')?.addEventListener('click', () => addMdLine(undefined, true));

    $('mdNo')?.addEventListener('input', () => {
      if ($('mdNo')) $('mdNo').dataset.touched = '1';
    });
    if (isNew) {
      $('mdDate')?.addEventListener('change', () => {
        if ($('mdNo')?.dataset.touched) return;
        const fy = fyOf($('mdDate')?.value);
        if (fy && $('mdNo')) $('mdNo').value = fmtNo(nextSeq(kind, fy), fy);
      });
    }
    if (isOut) {
      $('mdReq')?.addEventListener('change', () => {
        if ($('mdPos')?.value) return;
        const reqVal = ($('mdReq')?.value || '').trim();
        if (!reqVal) return;
        const p = moves
          .filter((m) => m.kind === 'out' && m.requester === reqVal && m.reqPos)
          .sort(mvSort)
          .pop();
        if (p && $('mdPos')) $('mdPos').value = p.reqPos;
      });
    }

    const footParts: string[] = [];
    if (!isNew) {
      footParts.push(`<button type="button" class="btn danger" id="mdDelBtn">${isOut ? 'ลบใบเบิกนี้ (คืนคลัง)' : 'ลบใบรับนี้'}</button>`);
    }
    footParts.push('<span class="sp"></span>');
    footParts.push(`<button type="button" class="btn" id="mdCancelBtn">${!isNew && fromView ? 'กลับหน้ารายละเอียด' : 'ยกเลิก'}</button>`);
    if (isNew && isOut) {
      footParts.push('<button type="button" class="btn" id="mdSaveBtn">บันทึกใบเบิก</button>');
      footParts.push('<button type="button" class="btn primary" id="mdSavePrintBtn">บันทึกและพิมพ์ใบเบิก</button>');
    } else if (isNew) {
      footParts.push('<button type="button" class="btn primary" id="mdSaveBtn">บันทึกรับเข้า</button>');
    } else {
      footParts.push('<button type="button" class="btn primary" id="mdSaveBtn">บันทึกการแก้ไข</button>');
    }
    footEl.innerHTML = footParts.join('');

    $('mvDetailModal').hidden = false;
  }

  function openMoveEdit(mv: any, fromView = false) {
    if (!mv) return;
    openMoveForm(mv.kind === 'out' ? 'out' : 'in', mv, fromView);
  }

  $('mvDetailFoot')?.addEventListener('click', async (e: Event) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-md-close]')) {
      closeMoveDetail();
      return;
    }
    const pr = t.closest('[data-md-prn]') as HTMLElement | null;
    if (pr) {
      const mv = moves.find((m) => m.id === pr.dataset.mdPrn);
      closeMoveDetail();
      if (mv) {
        openPrint(mv);
        doPrintSlip(true);
      }
      return;
    }
    const sl = t.closest('[data-md-slip]') as HTMLElement | null;
    if (sl) {
      const mv = moves.find((m) => m.id === sl.dataset.mdSlip);
      if (mv) downloadSlip(mv);
      return;
    }
    const ed = t.closest('[data-md-edit]') as HTMLElement | null;
    if (ed) {
      const mv = moves.find((m) => m.id === ed.dataset.mdEdit);
      if (mv) openMoveEdit(mv, true);
      return;
    }
    if (t.closest('#mdCancelBtn')) {
      const mv = modalMvId ? moves.find((m) => m.id === modalMvId) : null;
      if (modalOpenedFromView && mv) openMoveDetail(mv);
      else closeMoveDetail();
      return;
    }
    if (t.closest('#mdDelBtn')) {
      const mv = modalMvId ? moves.find((m) => m.id === modalMvId) : null;
      const delBtn = $('mdDelBtn');
      if (!mv || !delBtn) return;
      if (mv.kind === 'in') {
        for (const l of mv.lines || []) {
          if (r2(current(l.mid).q - oldQty(mv, l.mid)) < 0) {
            const m = matById(l.mid);
            return msg('mdEditMsg', `ลบไม่ได้: ${m?.name || 'วัสดุ'} ถูกเบิกไปแล้ว ยอดจะติดลบ ลบใบเบิกที่เกี่ยวข้องก่อน`, 1);
          }
        }
        if (!confirmClick('delmdin', delBtn, 'กดอีกครั้งเพื่อลบใบรับ')) return;
        try {
          await db.doc('moves/' + mv.id).delete();
          toast('ลบใบรับ ' + mv.no + ' แล้ว');
          closeMoveDetail();
        } catch (err) {
          msg('mdEditMsg', errText(err), 1);
        }
      } else {
        if (!confirmClick('delmdout', delBtn, 'กดอีกครั้ง: ลบใบเบิกและคืนวัสดุเข้าคลัง')) return;
        try {
          await db.doc('moves/' + mv.id).delete();
          toast('ลบใบเบิก ' + mv.no + ' แล้ว วัสดุคืนเข้าคลัง');
          closeMoveDetail();
        } catch (err) {
          msg('mdEditMsg', errText(err), 1);
        }
      }
      return;
    }
    const wantPrint = !!t.closest('#mdSavePrintBtn');
    if (t.closest('#mdSaveBtn') || wantPrint) {
      if (!db) return msg('mdEditMsg', 'เบราว์เซอร์นี้บันทึกข้อมูลไม่ได้', 1);
      const mv = modalMvId ? moves.find((m) => m.id === modalMvId) : null;
      const kind: 'in' | 'out' = mv ? (mv.kind === 'out' ? 'out' : 'in') : modalFormKind || 'in';
      const isOut = kind === 'out';
      const mdLinesBox = $('mdEditLines');
      const lines = [...(mdLinesBox?.querySelectorAll('.ln') || [])]
        .map((r: any) => {
          const s = r.querySelector('select') as HTMLSelectElement;
          const i = r.querySelectorAll('input');
          const o: any = { mid: s.value, qty: +i[0].value || 0 };
          if (!isOut) o.price = +i[1].value || 0;
          return o;
        })
        .filter((l) => l.mid && l.qty > 0);
      if (!lines.length) return msg('mdEditMsg', 'เพิ่มรายการวัสดุอย่างน้อย 1 รายการ และใส่จำนวน', 1);

      const date = $('mdDate')?.value;
      if (!date) return msg('mdEditMsg', 'ระบุวันที่เอกสาร', 1);
      const n = parseNo($('mdNo')?.value, kind, date);
      if (moves.some((m) => m.kind === kind && m.no === n.no && m.id !== mv?.id)) {
        return msg('mdEditMsg', `เลขที่${isOut ? 'ใบเบิก' : 'ใบรับ'} ${n.no} ซ้ำกับใบที่มีอยู่แล้ว`, 1);
      }

      const now = new Date().toISOString();
      let body: any;
      if (!isOut) {
        const src = $('mdSrc')?.value || 'purchase';
        const opening = src === 'opening';
        const vendor = ($('mdVendor')?.value || '').trim();
        const inspectDate = opening ? '' : $('mdInspect')?.value || '';
        if (!opening && !vendor) {
          $('mdVendor')?.focus();
          return msg('mdEditMsg', 'กรอกชื่อผู้ขาย / รับจาก', 1);
        }
        if (!opening && !inspectDate) {
          $('mdInspect')?.focus();
          return msg('mdEditMsg', 'กรอกวันที่ตรวจรับ', 1);
        }
        if (mv) {
          for (const l of mv.lines || []) {
            const after = r2(
              current(l.mid).q -
                oldQty(mv, l.mid) +
                lines.filter((x) => x.mid === l.mid).reduce((s, x) => s + x.qty, 0)
            );
            if (after < 0) {
              const m = matById(l.mid);
              return msg('mdEditMsg', `แก้ไม่ได้: ${m?.name || 'วัสดุ'} ถูกเบิกไปแล้ว ยอดจะติดลบ ${fmtQ(-after)} ${m?.unit || ''}`, 1);
            }
          }
        }
        body = {
          kind: 'in',
          no: n.no,
          seq: n.seq,
          fy: n.fy,
          date,
          src,
          inspectDate,
          poNo: ($('mdPo')?.value || '').trim(),
          vendor,
          invoiceNo: ($('mdInv')?.value || '').trim(),
          note: ($('mdNote')?.value || '').trim(),
          lines,
          createdAt: mv?.createdAt || now,
          updatedAt: now,
        };
      } else {
        const requester = ($('mdReq')?.value || '').trim();
        const purpose = ($('mdPurpose')?.value || '').trim();
        if (!requester) {
          $('mdReq')?.focus();
          return msg('mdEditMsg', 'กรอกชื่อผู้เบิก', 1);
        }
        if (!purpose) {
          $('mdPurpose')?.focus();
          return msg('mdEditMsg', 'กรอกวัตถุประสงค์เพื่อใช้ในงาน', 1);
        }
        const need: Record<string, number> = {};
        lines.forEach((l) => (need[l.mid] = (need[l.mid] || 0) + l.qty));
        for (const mid in need) {
          const avail = r2(current(mid).q + oldQty(mv, mid));
          if (need[mid] > avail + 1e-9) {
            const m = matById(mid);
            return msg('mdEditMsg', `${m?.name || 'วัสดุ'} คงเหลือ ${fmtQ(avail)} ${m?.unit || ''} ไม่พอเบิก ${fmtQ(need[mid])}`, 1);
          }
        }
        body = {
          kind: 'out',
          no: n.no,
          seq: n.seq,
          fy: n.fy,
          date,
          requester,
          reqPos: ($('mdPos')?.value || '').trim(),
          purpose,
          note: ($('mdNote')?.value || '').trim(),
          lines,
          createdAt: mv?.createdAt || now,
          updatedAt: now,
        };
      }

      const saveBtn = $('mdSaveBtn');
      const savePrintBtn = $('mdSavePrintBtn');
      if (saveBtn) saveBtn.disabled = true;
      if (savePrintBtn) savePrintBtn.disabled = true;
      msg('mdEditMsg', 'กำลังบันทึก…');
      try {
        const id = mv ? mv.id : db.collection('moves').doc().id;
        await db.doc('moves/' + id).set(body);
        if (mv) {
          toast((isOut ? 'บันทึกการแก้ไขใบเบิก ' : 'บันทึกการแก้ไขใบรับ ') + n.no + ' แล้ว');
          const updatedMv = moves.find((m) => m.id === id) || { ...body, id };
          openMoveDetail(updatedMv);
        } else {
          toast(isOut ? 'บันทึกใบเบิก ' + n.no + ' และตัดยอดคงเหลือแล้ว' : 'บันทึกใบรับ ' + n.no + ' แล้ว');
          closeMoveDetail();
          if (wantPrint && isOut) {
            openPrint({ ...body, id });
            doPrintSlip(true);
          }
        }
      } catch (err) {
        msg('mdEditMsg', errText(err), 1);
      } finally {
        if (saveBtn) saveBtn.disabled = false;
        if (savePrintBtn) savePrintBtn.disabled = false;
      }
    }
  });

  function renderIn() {
    if ($('btnNewIn')) $('btnNewIn').hidden = !canWrite;
    const q = $('inQ').value.trim().toLowerCase(),
      fy = $('inFy').value;
    const rows = moves
      .filter((m) => m.kind === 'in' && (fy === 'all' || String(m.fy || fyOf(m.date)) === fy))
      .filter(
        (m) =>
          !q ||
          [m.no, SRC[m.src], m.vendor, m.poNo, m.invoiceNo, m.note, linesText(m)].join(' ').toLowerCase().includes(q)
      )
      .sort((a, b) => mvSort(b, a));
    $('inRows').innerHTML = rows
      .map(
        (m) => `<tr><td class="no col-no">${esc(m.no)}</td><td class="col-date">${esc(thDate(m.date))}</td>
    <td class="col-src">${esc(SRC[m.src] || '—')}</td>
    <td class="col-party">${esc(m.vendor || '—')}${
          m.invoiceNo ? `<div class="sub">ใบส่งของ ${esc(m.invoiceNo)}</div>` : ''
        }</td><td class="col-po">${esc(m.poNo || '—')}</td>
    <td class="num col-val">${fmtB(moveValue(m))}</td>
    <td class="col-act"><div class="rowact-stack cols-1"><button type="button" class="btn icon-btn" data-viewmv="${esc(
      m.id
    )}" title="ดูรายละเอียดทั้งหมด" aria-label="ดูข้อมูล">${ICO_EYE}</button>${
          canWrite
            ? `<button type="button" class="btn icon-btn" data-edin="${esc(
                m.id
              )}" title="แก้ไขในหน้ารายละเอียด" aria-label="แก้ไข">${ICO_EDIT}</button>`
            : ''
        }</div></td></tr>`
      )
      .join('');
    const em = $('emptyIn');
    em.hidden = !!rows.length;
    em.innerHTML = moves.some((m) => m.kind === 'in')
      ? '<b>ไม่พบใบรับตามเงื่อนไข</b>ลองเปลี่ยนปีงบหรือคำค้นหา'
      : '<b>ยังไม่มีการรับวัสดุ</b>บันทึกยอดยกมาหรือการรับจากการจัดซื้อด้วยปุ่ม “+ รับเข้าวัสดุ” ด้านบน';
  }
  $('inQ')?.addEventListener('input', renderIn);
  $('inFy')?.addEventListener('change', renderIn);
  $('btnNewIn')?.addEventListener('click', () => openMoveForm('in', null, false));
  $('inRows')?.addEventListener('click', (e: Event) => {
    const v = (e.target as HTMLElement).closest('[data-viewmv]') as HTMLElement | null;
    if (v) {
      openMoveDetail(moves.find((m) => m.id === v.dataset.viewmv));
      return;
    }
    const b = (e.target as HTMLElement).closest('[data-edin]') as HTMLElement | null;
    if (b) {
      openMoveEdit(moves.find((m) => m.id === b.dataset.edin), false);
    }
  });

  function renderOut() {
    if ($('btnNewOut')) $('btnNewOut').hidden = !canWrite;
    const people = [...new Set(moves.filter((m) => m.kind === 'out').map((m) => m.requester).filter(Boolean))];
    const pos = [...new Set(moves.filter((m) => m.kind === 'out').map((m) => m.reqPos).filter(Boolean))];
    if ($('peopleList')) $('peopleList').innerHTML = people.map((p) => `<option value="${esc(p)}">`).join('');
    if ($('posList')) $('posList').innerHTML = pos.map((p) => `<option value="${esc(p)}">`).join('');
    const q = $('outQ').value.trim().toLowerCase(),
      fy = $('outFy').value;
    const rows = moves
      .filter((m) => m.kind === 'out' && (fy === 'all' || String(m.fy || fyOf(m.date)) === fy))
      .filter((m) => !q || [m.no, m.requester, m.purpose, m.note, linesText(m)].join(' ').toLowerCase().includes(q))
      .sort((a, b) => mvSort(b, a));
    $('outRows').innerHTML = rows
      .map(
        (m) => `<tr><td class="no col-no">${esc(m.no)}</td><td class="col-date">${esc(thDate(m.date))}</td>
    <td class="col-party">${esc(m.requester)}${m.reqPos ? `<div class="sub">${esc(m.reqPos)}</div>` : ''}</td><td class="col-work">${esc(
          m.purpose || '—'
        )}</td>
    <td class="num col-val">${fmtB(moveValue(m))}</td>
    <td class="col-act"><div class="rowact-stack cols-2"><button type="button" class="btn icon-btn" data-viewmv="${esc(
      m.id
    )}" title="ดูรายละเอียดทั้งหมด" aria-label="ดูข้อมูล">${ICO_EYE}</button><button type="button" class="btn icon-btn primary" data-prn="${esc(
          m.id
        )}" title="พิมพ์ใบเบิก" aria-label="พิมพ์">${ICO_PRINT}</button><button type="button" class="btn icon-btn" data-slip="${esc(
          m.id
        )}" title="ดาวน์โหลดไฟล์ Word (.docx)" aria-label="ดาวน์โหลด Word">${ICO_WORD}</button>${
          canWrite
            ? `<button type="button" class="btn icon-btn" data-edout="${esc(
                m.id
              )}" title="แก้ไขในหน้ารายละเอียด" aria-label="แก้ไข">${ICO_EDIT}</button>`
            : ''
        }</div></td></tr>`
      )
      .join('');
    const em = $('emptyOut');
    em.hidden = !!rows.length;
    em.innerHTML = moves.some((m) => m.kind === 'out')
      ? '<b>ไม่พบใบเบิกตามเงื่อนไข</b>ลองเปลี่ยนปีงบหรือคำค้นหา'
      : '<b>ยังไม่มีใบเบิกวัสดุ</b>ออกใบเบิกใบแรกด้วยปุ่ม “+ ใบเบิกวัสดุ” ด้านบน ระบบจะรันเลขที่ใบเบิกตามปีงบประมาณให้';
  }
  $('outQ')?.addEventListener('input', renderOut);
  $('outFy')?.addEventListener('change', renderOut);
  $('btnNewOut')?.addEventListener('click', () => openMoveForm('out', null, false));
  $('outRows')?.addEventListener('click', (e: Event) => {
    const v = (e.target as HTMLElement).closest('[data-viewmv]') as HTMLElement | null;
    if (v) {
      openMoveDetail(moves.find((m) => m.id === v.dataset.viewmv));
      return;
    }
    const pr = (e.target as HTMLElement).closest('[data-prn]') as HTMLElement | null;
    if (pr) {
      openPrint(moves.find((m) => m.id === pr.dataset.prn));
      doPrintSlip(true);
      return;
    }
    const s = (e.target as HTMLElement).closest('[data-slip]') as HTMLElement | null;
    if (s) {
      downloadSlip(moves.find((m) => m.id === s.dataset.slip));
      return;
    }
    const b = (e.target as HTMLElement).closest('[data-edout]') as HTMLElement | null;
    if (b) {
      openMoveEdit(moves.find((m) => m.id === b.dataset.edout), false);
    }
  });
  (window as any).openKumWatsaduCreate = (kind: 'in' | 'out') => openMoveForm(kind, null, false);

  function buildSlipDocx(d: any) {
    const x = (s: any) =>
      String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    const R = (t: string, o: any = {}) =>
      `<w:r><w:rPr>${o.b ? '<w:b/><w:bCs/>' : ''}${
        o.sz ? `<w:sz w:val="${o.sz}"/><w:szCs w:val="${o.sz}"/>` : ''
      }${o.u ? '<w:u w:val="dotted"/>' : ''}</w:rPr><w:t xml:space="preserve">${x(t)}</w:t></w:r>`;
    const F = (v: any, min: number) => {
      let s = String(v ?? '').trim();
      if (!s) return R('.'.repeat(Math.round(min * 1.6)));
      s = ' ' + s + ' ';
      const p = Math.max(0, min - s.length);
      return R(' '.repeat(Math.ceil(p / 2)) + s + ' '.repeat(Math.floor(p / 2)), { u: 1 });
    };
    const P = (runs: any, o: any = {}) =>
      `<w:p><w:pPr><w:spacing w:before="${o.before || 0}" w:after="${o.after || 0}"/>${
        o.first ? `<w:ind w:firstLine="${o.first}"/>` : ''
      }${o.jc ? `<w:jc w:val="${o.jc}"/>` : ''}</w:pPr>${[].concat(runs).join('')}</w:p>`;
    const cellP = (t: string, o: any = {}) => P(R(t, o), { jc: o.jc || 'left' });
    const cb =
      '<w:tcBorders>' +
      ['top', 'left', 'bottom', 'right']
        .map((k) => `<w:${k} w:val="single" w:sz="6" w:space="0" w:color="000000"/>`)
        .join('') +
      '</w:tcBorders>';
    const tc = (w: number, inner: string, o: any = {}) =>
      `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${o.bd ? cb : ''}${
        o.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.fill}"/>` : ''
      }<w:vAlign w:val="center"/></w:tcPr>${inner}</w:tc>`;
    const bd = (v: any) =>
      `<w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
        .map((s) => (v ? `<w:${s} w:val="single" w:sz="6" w:space="0" w:color="000000"/>` : `<w:${s} w:val="nil"/>`))
        .join('')}</w:tblBorders>`;
    const b: string[] = [];
    const I = d.info;
    const org = I.orgName || '';
    const dp = I.dateParts || { day: '', month: '', year: '' };
    const Pl = (runs: any, o: any = {}) =>
      `<w:p><w:pPr><w:spacing w:before="${o.before || 0}" w:after="${o.after || 0}"/>${
        o.first ? `<w:ind w:firstLine="${o.first}"/>` : ''
      }${o.left ? `<w:ind w:left="${o.left}"/>` : ''}${o.jc ? `<w:jc w:val="${o.jc}"/>` : ''}</w:pPr>${[].concat(
        runs
      ).join('')}</w:p>`;
    const tcSpan = (w: number, span: number, inner: string, o: any = {}) =>
      `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${span > 1 ? `<w:gridSpan w:val="${span}"/>` : ''}${
        o.bd ? cb : ''
      }<w:vAlign w:val="center"/></w:tcPr>${inner}</w:tc>`;
    b.push(P(R('ใบเบิกวัสดุ', { b: 1, sz: 40 }), { jc: 'center', after: 160 }));
    b.push(
      `<w:tbl><w:tblPr><w:tblW w:w="9506" w:type="dxa"/>${bd(
        0
      )}<w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid><w:gridCol w:w="4000"/><w:gridCol w:w="5506"/></w:tblGrid><w:tr>${tc(
        4000,
        Pl([R('ใบเบิกที่ '), F(d.no, 16)])
      )}${tc(
        5506,
        Pl([R('เขียนที่'), org ? R(org) : R('.'.repeat(28))], { left: 1000 }) +
          Pl([R('วันที่ '), F(dp.day, 6), R(' เดือน '), F(dp.month, 16), R(' พ.ศ. '), F(dp.year, 8)], {
            before: 60,
          })
      )}</w:tr></w:tbl>`
    );
    b.push(P([R('เรียน  '), I.appr.p ? R(I.appr.p) : R('.'.repeat(30))], { before: 120, after: 100 }));
    b.push(
      P(
        [
          R('ด้วยข้าพเจ้า '),
          F(I.req.n, 28),
          R(' มีความประสงค์ขอเบิกวัสดุ'),
          org ? R(org) : R('.'.repeat(26)),
          R(' เพื่อใช้ในงาน '),
          F(d.purpose, 34),
          R(' ตามรายละเอียดดังต่อไปนี้'),
        ],
        { first: 720, after: 160 }
      )
    );
    const W = [900, 4656, 1950, 2000];
    const items = I.items.slice();
    while (items.length < 10) items.push(null);
    let t = `<w:tbl><w:tblPr><w:tblW w:w="9506" w:type="dxa"/>${bd(
      1
    )}<w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>${W.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>`;
    t +=
      '<w:tr><w:trPr><w:trHeight w:val="400" w:hRule="atLeast"/></w:trPr>' +
      ['ลำดับที่', 'รายการ', 'จำนวน', 'หมายเหตุ']
        .map((h, i) => tc(W[i], cellP(h, { b: 1, jc: 'center' }), { bd: 1 }))
        .join('') +
      '</w:tr>';
    items.forEach((it: any, i: number) => {
      t +=
        '<w:tr><w:trPr><w:trHeight w:val="380" w:hRule="atLeast"/></w:trPr>' +
        [
          tc(W[0], cellP(it ? String(i + 1) : '', { jc: 'center' }), { bd: 1 }),
          tc(W[1], cellP(it ? it.name : ''), { bd: 1 }),
          tc(W[2], cellP(it ? it.qty : '', { jc: 'center' }), { bd: 1 }),
          tc(W[3], cellP(it && i === 0 && d.note ? d.note : ''), { bd: 1 }),
        ].join('') +
        '</w:tr>';
    });
    t +=
      '<w:tr><w:trPr><w:trHeight w:val="400" w:hRule="atLeast"/></w:trPr>' +
      tcSpan(W[0] + W[1], 2, cellP('รวมทั้งหมด', { b: 1, jc: 'center' }), { bd: 1 }) +
      tc(W[2], cellP(I.totalQtyText || '', { b: 1, jc: 'center' }), { bd: 1 }) +
      tc(W[3], cellP(''), { bd: 1 }) +
      '</w:tr>';
    t += '</w:tbl>';
    b.push(t);
    const sigName = (n: string) => P(R('(' + (n || '.'.repeat(30)) + ')'), { jc: 'center' });
    const sigPosDot = (p: string) => P([R('ตำแหน่ง '), p ? R(p) : R('.'.repeat(28))], { jc: 'center' });
    const leftCol = sigOn('req')
      ? P(R('(ลงชื่อ)' + '.'.repeat(30) + 'ผู้เบิก'), { jc: 'center' }) + sigName(I.req.n) + sigPosDot(I.req.p)
      : '';
    const rightCol = sigOn('payer')
      ? P(R('(ลงชื่อ)' + '.'.repeat(30) + 'ผู้จ่าย'), { jc: 'center' }) + sigName(I.payer.n) + sigPosDot(I.payer.p)
      : '';
    const cols = [leftCol, rightCol].filter(Boolean);
    const SW = cols.length === 2 ? [4753, 4753] : [9506];
    if (cols.length)
      b.push(
        `<w:tbl><w:tblPr><w:tblW w:w="9506" w:type="dxa"/>${bd(
          0
        )}<w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>${SW.map((w) => `<w:gridCol w:w="${w}"/>`).join(
          ''
        )}</w:tblGrid><w:tr>${SW.map(
          (w, k) => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/></w:tcPr>${cols[k]}</w:tc>`
        ).join('')}</w:tr></w:tbl>`
      );
    if (sigOn('appr')) {
      b.push(P([R('(ลงชื่อ)' + '.'.repeat(32) + 'ผู้อนุมัติ')], { jc: 'center', before: 280 }));
      b.push(sigName(I.appr.n));
      b.push(P([R('ตำแหน่ง   '), I.appr.p ? R(I.appr.p) : R('.'.repeat(28))], { jc: 'center' }));
    }
    b.push(P(R('', { sz: 4 })));
    const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${b.join(
      ''
    )}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="851" w:right="1134" w:bottom="851" w:left="1266" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>`;
    const font = 'TH SarabunPSK';
    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:eastAsia="${font}" w:cs="${font}"/><w:sz w:val="32"/><w:szCs w:val="32"/><w:lang w:val="th-TH" w:bidi="th-TH"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`;
    const z = new JSZip();
    z.file(
      '[Content_Types].xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>'
    );
    z.file(
      '_rels/.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
    );
    z.file(
      'word/_rels/document.xml.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'
    );
    z.file('word/document.xml', doc);
    z.file('word/styles.xml', styles);
    return z;
  }

  async function saveFile(filename: string, data: any, okText: string) {
    try {
      const blob = data instanceof Blob ? data : new Blob([data]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast(okText);
      return true;
    } catch (err: any) {
      toast('บันทึกไฟล์ไม่สำเร็จ (' + (err?.message || 'error') + ')');
      return false;
    }
  }

  let printMv: any = null;
  const SIGS: Array<[string, string]> = [
    ['req', 'ผู้เบิก'],
    ['payer', 'ผู้จ่าย'],
    ['appr', 'ผู้อนุมัติ'],
  ];
  function sigOn(k: string) {
    return (settings.slipSigs || {})[k] !== false;
  }
  function renderPmSigs() {
    $('pmSigs').innerHTML =
      '<span class="sub">ช่องลงชื่อ:</span>' +
      SIGS.map(
        ([k, l]) => `<label><input type="checkbox" data-sig="${k}"${sigOn(k) ? ' checked' : ''}> ${l}</label>`
      ).join('');
  }
  function splitThaiDate(iso: string) {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return { day: '', month: '', year: '' };
    const [y, m, d] = iso.split('-');
    return {
      day: String(+d),
      month: TH_MF[+m - 1] || '',
      year: String(+y + 543),
    };
  }
  function slipInfo(mv: any) {
    const items = (mv.lines || []).map((l: any) => {
      const m = matById(l.mid);
      const rawQty = +l.qty || 0;
      const unit = m?.unit || '';
      const q = fmtQ(rawQty) + (unit ? ' ' + unit : '');
      return { name: m ? matLabel(m) : '', qty: q, rawQty, unit };
    });
    const units = [...new Set(items.map((it: any) => it.unit).filter(Boolean))];
    const totalQty = items.reduce((s: number, it: any) => s + it.rawQty, 0);
    const totalQtyText = !items.length
      ? ''
      : units.length <= 1
      ? fmtQ(totalQty) + (units[0] ? ' ' + units[0] : '')
      : items.length + ' รายการ';
    const orgName = orgParts().name;
    const payerPos = settings.staffPos || settings.payerPos || settings.vsMkPos || defaultControllerPos();
    const payerName = settings.staff || settings.payer || settings.vsMk || '';
    return {
      orgName,
      items,
      totalQtyText,
      dateParts: splitThaiDate(mv.date),
      staff: { n: payerName, p: payerPos },
      payer: { n: payerName, p: payerPos },
      appr: {
        n: settings.appr || settings.vsFin || settings.head || '',
        p: settings.apprPos || settings.vsFinPos || settings.headPos || defaultDivHeadPos(),
      },
      req: { n: mv.requester || '', p: mv.reqPos || '' },
      date: mv.date ? thDateFull(mv.date) : '',
    };
  }
  function slipHtml(mv: any) {
    const I = slipInfo(mv);
    const F = (v: any, w: number) => `<span class="sl-fl" style="min-width:${w}px">${esc(v || '') || '&nbsp;'}</span>`;
    const items = I.items.slice();
    while (items.length < 10) items.push(null);
    const dt = (w: number) => `<span class="dt" style="width:${w}em"></span>`;
    const org = I.orgName;
    const dp = I.dateParts;
    const topCols = [
      sigOn('req')
        ? `<div class="sl-sig-col">
            <div>(ลงชื่อ)${dt(10.5)}ผู้เบิก</div>
            <div>(${I.req.n ? `<span class="sl-sig-nm">${esc(I.req.n)}</span>` : dt(10.5)})</div>
            <div>ตำแหน่ง <span class="sl-sig-pos">${I.req.p ? esc(I.req.p) : '&nbsp;'}</span></div>
          </div>`
        : '',
      sigOn('payer')
        ? `<div class="sl-sig-col">
            <div>(ลงชื่อ)${dt(10.5)}ผู้จ่าย</div>
            <div>(${I.payer.n ? `<span class="sl-sig-nm">${esc(I.payer.n)}</span>` : dt(10.5)})</div>
            <div>ตำแหน่ง <span class="sl-sig-pos">${I.payer.p ? esc(I.payer.p) : '&nbsp;'}</span></div>
          </div>`
        : '',
    ].filter(Boolean);

    return `<div class="slform">
      <p class="ttl">ใบเบิกวัสดุ</p>
      <div class="sl-top-row">
        <div class="sl-no">ใบเบิกที่ ${F(mv.no, 120)}</div>
        <div class="sl-write">เขียนที่${org ? esc(org) : dt(12)}</div>
      </div>
      <div class="sl-date-row">
        <div></div>
        <div class="sl-date-parts">
          <span>วันที่</span><span class="sl-dval" style="flex:0.75">${esc(dp.day) || '&nbsp;'}</span>
          <span>เดือน</span><span class="sl-dval" style="flex:1.65">${esc(dp.month) || '&nbsp;'}</span>
          <span>พ.ศ.</span><span class="sl-dval" style="flex:0.9">${esc(dp.year) || '&nbsp;'}</span>
        </div>
      </div>
      <p class="sl-dear">เรียน&nbsp;&nbsp;${I.appr.p ? esc(I.appr.p) : dt(13)}</p>
      <p class="sl-intro">ด้วยข้าพเจ้า${F(I.req.n, 230)}มีความประสงค์ขอเบิกวัสดุ${
        org ? esc(org) : dt(12)
      } เพื่อใช้ในงาน${F(mv.purpose, 250)}ตามรายละเอียดดังต่อไปนี้</p>
      <table class="sl-table">
        <thead>
          <tr>
            <th style="width:66px;white-space:nowrap">ลำดับที่</th>
            <th>รายการ</th>
            <th style="width:120px">จำนวน</th>
            <th style="width:148px">หมายเหตุ</th>
          </tr>
        </thead>
        <tbody>${items
          .map(
            (it: any, i: number) =>
              `<tr><td class="cn">${it ? i + 1 : ''}</td><td>${it ? esc(it.name) : ''}</td><td class="cn">${
                it ? esc(it.qty) : ''
              }</td><td>${it && i === 0 && mv.note ? esc(mv.note) : ''}</td></tr>`
          )
          .join('')}</tbody>
        <tfoot>
          <tr>
            <td colspan="2" class="cn">รวมทั้งหมด</td>
            <td class="cn">${esc(I.totalQtyText)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
      ${
        topCols.length
          ? `<div class="sl-top-sigs" style="grid-template-columns:${
              topCols.length === 2 ? 'minmax(0,1fr) minmax(0,1fr)' : 'minmax(0,1fr)'
            }">${topCols.join('')}</div>`
          : ''
      }
      ${
        sigOn('appr')
          ? `<div class="sl-bot-appr">
              <div>(ลงชื่อ)${dt(11.5)}ผู้อนุมัติ</div>
              <div>(${I.appr.n ? `<span class="sl-sig-nm">${esc(I.appr.n)}</span>` : dt(11.5)})</div>
              <div>ตำแหน่ง ${
                I.appr.p ? `<span class="sl-sig-pos-plain">${esc(I.appr.p)}</span>` : dt(11.5)
              }</div>
            </div>`
          : ''
      }
    </div>`;
  }
  function hasTHS() {
    try {
      const c = document.createElement('canvas').getContext('2d')!;
      const t = 'ทดสอบภาษาไทย mmmwwwiii';
      c.font = '40px monospace';
      const a = c.measureText(t).width;
      c.font = '40px "TH SarabunPSK",monospace';
      const b = c.measureText(t).width;
      c.font = '40px "TH Sarabun New",monospace';
      const d = c.measureText(t).width;
      return Math.abs(a - b) > 1 || Math.abs(a - d) > 1;
    } catch {
      return false;
    }
  }
  let paperLandscape = false;
  function applyPrintPageRule(land: boolean) {
    let st = document.getElementById('repPage');
    if (!st) {
      st = document.createElement('style');
      st.id = 'repPage';
      document.head.appendChild(st);
    }
    st.textContent = land
      ? '@page{size:A4 landscape;margin:10mm 12mm}'
      : '@page{size:A4 portrait;margin:12mm 14mm 12mm 18mm}';
  }
  function openPrint(mv: any) {
    if (!mv) return;
    printMv = mv;
    paperLandscape = false;
    $('pmWord').hidden = false;
    renderPmSigs();
    $('pmSigs').hidden = false;
    $('paper').classList.remove('land');
    applyPrintPageRule(false);
    $('pmTitle').textContent = 'ใบเบิกวัสดุ เลขที่ ' + mv.no;
    $('paper').innerHTML = slipHtml(mv);
    $('paper').classList.toggle('ths', hasTHS());
    $('printModal').hidden = false;
    document.body.style.overflow = 'hidden';
    $('pmPdf').focus();
  }
  function closePrint() {
    $('printModal').hidden = true;
    document.body.style.overflow = '';
    document.body.classList.remove('pr-slip', 'pr-rep');
    printMv = null;
    paperLandscape = false;
    $('pmWord').hidden = false;
    $('paper').classList.remove('land');
    const st = document.getElementById('repPage');
    if (st) st.textContent = '';
  }
  $('pmClose')?.addEventListener('click', closePrint);
  $('pmSigs')?.addEventListener('change', async (e: Event) => {
    const target = e.target as HTMLInputElement;
    const k = target.dataset.sig;
    if (!k) return;
    const ss = { ...(settings.slipSigs || {}), [k]: target.checked };
    settings.slipSigs = ss;
    if (printMv) {
      $('paper').innerHTML = slipHtml(printMv);
      $('paper').classList.toggle('ths', hasTHS());
    }
    try {
      if (db) await db.doc('settings/main').set({ ...settings, slipSigs: ss });
    } catch (err) {
      toast(errText(err));
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('printModal').hidden) closePrint();
  });
  $('pmWord')?.addEventListener('click', () => downloadSlip(printMv));
  $('pmPdf')?.addEventListener('click', () => doPrintSlip(false));
  let autoClose = false;
  function doPrintSlip(auto: boolean) {
    autoClose = auto;
    applyPrintPageRule(printMv ? false : paperLandscape);
    document.body.classList.remove('pr-rep');
    document.body.classList.add('pr-slip');
    // Force synchronous layout flush before invoking native browser print within user gesture
    void $('paper')?.offsetHeight;
    window.print();
  }
  window.addEventListener('beforeprint', () => {
    if (!$('printModal')?.hidden && !document.body.classList.contains('pr-slip')) {
      applyPrintPageRule(printMv ? false : paperLandscape);
      document.body.classList.remove('pr-rep');
      document.body.classList.add('pr-slip');
    }
  });
  window.addEventListener('afterprint', () => {
    const was = document.body.classList.contains('pr-slip');
    document.body.classList.remove('pr-slip', 'pr-rep');
    if (was && autoClose) {
      closePrint();
    } else if ($('printModal')?.hidden) {
      const rp = document.getElementById('repPage');
      if (rp) rp.textContent = '';
    }
    autoClose = false;
  });
  $('btnPrintRep')?.addEventListener('click', () => {
    renderReport();
    if (repKind === 'card') {
      if (!materials.length) {
        toast('ยังไม่มีข้อมูลสำหรับพิมพ์บัญชีวัสดุ');
        return;
      }
      const p = period();
      const mid = $('rMat').value;
      const ids =
        mid === 'all'
          ? materials
              .slice()
              .sort(matSort)
              .map((m) => m.id)
          : [mid];
      openPaper('บัญชีวัสดุ — ' + p.label, cardPaperHtml(ids, p), true);
      return;
    }
    if (repKind === 'sum') {
      if (!materials.length) {
        toast('ยังไม่มีข้อมูลสำหรับพิมพ์รายงาน');
        return;
      }
      const p = period();
      openPaper('รายงานสรุปการรับ-จ่ายวัสดุ — ' + p.label, summaryPaperHtml(p), true);
      return;
    }
    if (repKind === 'req') {
      if (!materials.length) {
        toast('ยังไม่มีข้อมูลสำหรับพิมพ์รายงาน');
        return;
      }
      const p = period();
      const gl = GRP[$('rGroup')?.value || 'req'];
      openPaper('รายงานสรุปการเบิกวัสดุ แยกตาม' + gl + ' — ' + p.label, issuePaperHtml(p), true);
      return;
    }
    if (repKind === 'vs') {
      openPaper('แบบ อปท.-วส. ' + divName(), vsHtml(vsSelfItems(), 'ส่วนราชการ ' + divName()), false);
      return;
    }
    applyPrintPageRule(true);
    document.body.classList.add('pr-rep');
    void document.body.offsetHeight;
    window.print();
  });
  async function downloadSlip(mv: any) {
    if (!mv) return;
    if (typeof JSZip === 'undefined') {
      toast('โหลดตัวสร้างไฟล์ Word ไม่สำเร็จ ลองโหลดหน้าใหม่');
      return;
    }
    const d = { ...settings, ...mv, org: fullOrg(), info: slipInfo(mv) };
    const blob = await buildSlipDocx(d).generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    saveFile('ใบเบิกวัสดุ_' + mv.no.replace('/', '-') + '.docx', blob, 'ดาวน์โหลดใบเบิก ' + mv.no + ' แล้ว');
  }

  const RECENT_CATS_KEY = 'kumwatsadu-recent-cats-v1';
  const RECENT_UNITS_KEY = 'kumwatsadu-recent-units-v1';
  const MAT_SUGGESTIONS: Array<{ name: string; cat: string; unit: string }> = [
    // วัสดุก่อสร้าง
    { name: 'ยางมะตอยสำเร็จรูป', cat: 'วัสดุก่อสร้าง', unit: 'ถุง' },
    { name: 'ปูนซีเมนต์ปอร์ตแลนด์', cat: 'วัสดุก่อสร้าง', unit: 'ถุง' },
    { name: 'ปูนซีเมนต์สำเร็จรูป (มอร์ตาร์)', cat: 'วัสดุก่อสร้าง', unit: 'ถุง' },
    { name: 'ทรายหยาบ', cat: 'วัสดุก่อสร้าง', unit: 'คิว' },
    { name: 'หินคลุก', cat: 'วัสดุก่อสร้าง', unit: 'คิว' },
    { name: 'อิฐบล็อก', cat: 'วัสดุก่อสร้าง', unit: 'ก้อน' },
    { name: 'เหล็กเส้นกลม 6 มม.', cat: 'วัสดุก่อสร้าง', unit: 'เส้น' },
    { name: 'เหล็กเส้นข้ออ้อย 12 มม.', cat: 'วัสดุก่อสร้าง', unit: 'เส้น' },
    { name: 'ลวดผูกเหล็ก', cat: 'วัสดุก่อสร้าง', unit: 'กิโลกรัม' },
    { name: 'สีน้ำอะครีลิคทาภายนอก', cat: 'วัสดุก่อสร้าง', unit: 'ถัง' },
    { name: 'สีน้ำมันเคลือบเงา', cat: 'วัสดุก่อสร้าง', unit: 'กระป๋อง' },
    { name: 'แผ่นยิปซัมบอร์ด', cat: 'วัสดุก่อสร้าง', unit: 'แผ่น' },
    // วัสดุสำนักงาน
    { name: 'กระดาษถ่ายเอกสาร A4 80 แกรม', cat: 'วัสดุสำนักงาน', unit: 'รีม' },
    { name: 'กระดาษถ่ายเอกสาร A4 70 แกรม', cat: 'วัสดุสำนักงาน', unit: 'รีม' },
    { name: 'กระดาษโน้ตกาวในตัว', cat: 'วัสดุสำนักงาน', unit: 'เล่ม' },
    { name: 'ปากกาลูกลื่นหมึกน้ำเงิน', cat: 'วัสดุสำนักงาน', unit: 'ด้าม' },
    { name: 'ปากกาลูกลื่นหมึกแดง', cat: 'วัสดุสำนักงาน', unit: 'ด้าม' },
    { name: 'ปากกาเคมีลบไม่ได้', cat: 'วัสดุสำนักงาน', unit: 'ด้าม' },
    { name: 'ปากกาเน้นข้อความ', cat: 'วัสดุสำนักงาน', unit: 'ด้าม' },
    { name: 'ดินสอดำ 2B', cat: 'วัสดุสำนักงาน', unit: 'แท่ง' },
    { name: 'ยางลบดินสอ', cat: 'วัสดุสำนักงาน', unit: 'ก้อน' },
    { name: 'น้ำยาลบคำผิด', cat: 'วัสดุสำนักงาน', unit: 'ขวด' },
    { name: 'ลวดเย็บกระดาษ เบอร์ 10', cat: 'วัสดุสำนักงาน', unit: 'กล่อง' },
    { name: 'แฟ้มสันกว้าง 3 นิ้ว', cat: 'วัสดุสำนักงาน', unit: 'เล่ม' },
    { name: 'ซองเอกสารสีน้ำตาล A4', cat: 'วัสดุสำนักงาน', unit: 'ซอง' },
    { name: 'เทปใสแกนใหญ่', cat: 'วัสดุสำนักงาน', unit: 'ม้วน' },
    { name: 'กาวแท่ง', cat: 'วัสดุสำนักงาน', unit: 'แท่ง' },
    // วัสดุไฟฟ้าและวิทยุ
    { name: 'หลอดไฟ LED 18W', cat: 'วัสดุไฟฟ้าและวิทยุ', unit: 'หลอด' },
    { name: 'หลอดไฟ LED T8 18W', cat: 'วัสดุไฟฟ้าและวิทยุ', unit: 'หลอด' },
    { name: 'หลอดไฟถนน LED 50W', cat: 'วัสดุไฟฟ้าและวิทยุ', unit: 'หลอด' },
    { name: 'สายไฟ THW 1x2.5 ตร.มม.', cat: 'วัสดุไฟฟ้าและวิทยุ', unit: 'ม้วน' },
    { name: 'สายไฟ VAF 2x2.5 ตร.มม.', cat: 'วัสดุไฟฟ้าและวิทยุ', unit: 'ม้วน' },
    { name: 'เบรกเกอร์ 30A', cat: 'วัสดุไฟฟ้าและวิทยุ', unit: 'ตัว' },
    { name: 'ปลั๊กกราวด์คู่พร้อมหน้ากาก', cat: 'วัสดุไฟฟ้าและวิทยุ', unit: 'ชุด' },
    { name: 'สวิตช์ทางเดียว', cat: 'วัสดุไฟฟ้าและวิทยุ', unit: 'อัน' },
    { name: 'เทปพันสายไฟ', cat: 'วัสดุไฟฟ้าและวิทยุ', unit: 'ม้วน' },
    { name: 'รางสายไฟ PVC', cat: 'วัสดุไฟฟ้าและวิทยุ', unit: 'เส้น' },
    { name: 'ถ่านไฟฉาย AA', cat: 'วัสดุไฟฟ้าและวิทยุ', unit: 'ก้อน' },
    // วัสดุประปา
    { name: 'ท่อ PVC ขนาด 1/2 นิ้ว ชั้น 13.5', cat: 'วัสดุประปา', unit: 'ท่อน' },
    { name: 'ท่อ PVC ขนาด 1 นิ้ว ชั้น 13.5', cat: 'วัสดุประปา', unit: 'ท่อน' },
    { name: 'ท่อ PVC ขนาด 2 นิ้ว ชั้น 8.5', cat: 'วัสดุประปา', unit: 'ท่อน' },
    { name: 'ท่อ PVC ขนาด 4 นิ้ว ชั้น 8.5', cat: 'วัสดุประปา', unit: 'ท่อน' },
    { name: 'ข้อต่อตรง PVC 1/2 นิ้ว', cat: 'วัสดุประปา', unit: 'อัน' },
    { name: 'ข้องอ 90 องศา PVC 1/2 นิ้ว', cat: 'วัสดุประปา', unit: 'อัน' },
    { name: 'ก๊อกน้ำบอลวาล์ว 1/2 นิ้ว', cat: 'วัสดุประปา', unit: 'ตัว' },
    { name: 'เทปพันเกลียว', cat: 'วัสดุประปา', unit: 'ม้วน' },
    { name: 'กาวทาท่อ PVC', cat: 'วัสดุประปา', unit: 'กระป๋อง' },
    { name: 'ประตูน้ำทองเหลือง 1 นิ้ว', cat: 'วัสดุประปา', unit: 'ตัว' },
    // วัสดุคอมพิวเตอร์
    { name: 'หมึกพิมพ์เลเซอร์ดำ (Toner)', cat: 'วัสดุคอมพิวเตอร์', unit: 'ตลับ' },
    { name: 'หมึกเติมเครื่องพิมพ์อิงค์เจ็ท', cat: 'วัสดุคอมพิวเตอร์', unit: 'ขวด' },
    { name: 'แฟลชไดรฟ์ 32 GB', cat: 'วัสดุคอมพิวเตอร์', unit: 'อัน' },
    { name: 'เมาส์ไร้สาย', cat: 'วัสดุคอมพิวเตอร์', unit: 'อัน' },
    { name: 'คีย์บอร์ด USB', cat: 'วัสดุคอมพิวเตอร์', unit: 'อัน' },
    { name: 'สายแลน CAT6 สำเร็จรูป', cat: 'วัสดุคอมพิวเตอร์', unit: 'เส้น' },
    { name: 'ปลั๊กพ่วงป้องกันไฟกระชาก', cat: 'วัสดุคอมพิวเตอร์', unit: 'อัน' },
    { name: 'แผ่นรองเมาส์', cat: 'วัสดุคอมพิวเตอร์', unit: 'แผ่น' },
    // วัสดุงานบ้านงานครัว
    { name: 'น้ำยาล้างห้องน้ำ', cat: 'วัสดุงานบ้านงานครัว', unit: 'ขวด' },
    { name: 'น้ำยาถูพื้น', cat: 'วัสดุงานบ้านงานครัว', unit: 'แกลลอน' },
    { name: 'น้ำยาล้างจาน', cat: 'วัสดุงานบ้านงานครัว', unit: 'แกลลอน' },
    { name: 'ผงซักฟอก', cat: 'วัสดุงานบ้านงานครัว', unit: 'ถุง' },
    { name: 'ถุงขยะดำ 30x40 นิ้ว', cat: 'วัสดุงานบ้านงานครัว', unit: 'แพ็ค' },
    { name: 'กระดาษชำระม้วนใหญ่', cat: 'วัสดุงานบ้านงานครัว', unit: 'ม้วน' },
    { name: 'กระดาษเช็ดมือ', cat: 'วัสดุงานบ้านงานครัว', unit: 'ห่อ' },
    { name: 'ไม้กวาดดอกหญ้า', cat: 'วัสดุงานบ้านงานครัว', unit: 'ด้าม' },
    { name: 'ไม้ถูพื้นไมโครไฟเบอร์', cat: 'วัสดุงานบ้านงานครัว', unit: 'อัน' },
    { name: 'สเปรย์ปรับอากาศ', cat: 'วัสดุงานบ้านงานครัว', unit: 'กระป๋อง' },
    // วัสดุยานพาหนะและขนส่ง
    { name: 'น้ำมันเครื่องดีเซล 15W-40', cat: 'วัสดุยานพาหนะและขนส่ง', unit: 'ลิตร' },
    { name: 'น้ำมันเครื่องเบนซิน 10W-30', cat: 'วัสดุยานพาหนะและขนส่ง', unit: 'ลิตร' },
    { name: 'กรองน้ำมันเครื่อง', cat: 'วัสดุยานพาหนะและขนส่ง', unit: 'ลูก' },
    { name: 'กรองอากาศรถยนต์', cat: 'วัสดุยานพาหนะและขนส่ง', unit: 'อัน' },
    { name: 'ยางรถยนต์', cat: 'วัสดุยานพาหนะและขนส่ง', unit: 'เส้น' },
    { name: 'แบตเตอรี่รถยนต์ 12V', cat: 'วัสดุยานพาหนะและขนส่ง', unit: 'ลูก' },
    { name: 'ใบปัดน้ำฝน', cat: 'วัสดุยานพาหนะและขนส่ง', unit: 'อัน' },
    { name: 'น้ำยาหล่อเย็นหม้อน้ำ', cat: 'วัสดุยานพาหนะและขนส่ง', unit: 'แกลลอน' },
    // วัสดุเชื้อเพลิงและหล่อลื่น
    { name: 'น้ำมันดีเซล', cat: 'วัสดุเชื้อเพลิงและหล่อลื่น', unit: 'ลิตร' },
    { name: 'น้ำมันแก๊สโซฮอล์ 95', cat: 'วัสดุเชื้อเพลิงและหล่อลื่น', unit: 'ลิตร' },
    { name: 'น้ำมันแก๊สโซฮอล์ 91', cat: 'วัสดุเชื้อเพลิงและหล่อลื่น', unit: 'ลิตร' },
    { name: 'จาระบีหล่อลื่นอเนกประสงค์', cat: 'วัสดุเชื้อเพลิงและหล่อลื่น', unit: 'กิโลกรัม' },
    { name: 'น้ำมันไฮดรอลิค เบอร์ 68', cat: 'วัสดุเชื้อเพลิงและหล่อลื่น', unit: 'ถัง' },
    { name: 'น้ำมันอเนกประสงค์ (สเปรย์หล่อลื่น)', cat: 'วัสดุเชื้อเพลิงและหล่อลื่น', unit: 'กระป๋อง' },
    // วัสดุการเกษตร
    { name: 'ปุ๋ยเคมีสูตร 15-15-15', cat: 'วัสดุการเกษตร', unit: 'กระสอบ' },
    { name: 'ปุ๋ยอินทรีย์อัดเม็ด', cat: 'วัสดุการเกษตร', unit: 'กระสอบ' },
    { name: 'สายยางรดน้ำ 5/8 นิ้ว', cat: 'วัสดุการเกษตร', unit: 'เมตร' },
    { name: 'บัวรดน้ำพลาสติก', cat: 'วัสดุการเกษตร', unit: 'ใบ' },
    { name: 'ถุงเพาะชำสีดำ', cat: 'วัสดุการเกษตร', unit: 'แพ็ค' },
    { name: 'เอ็นตัดหญ้า', cat: 'วัสดุการเกษตร', unit: 'ม้วน' },
    { name: 'ใบมีดเครื่องตัดหญ้า', cat: 'วัสดุการเกษตร', unit: 'ใบ' },
    // วัสดุวิทยาศาสตร์หรือการแพทย์
    { name: 'หน้ากากอนามัยทางการแพทย์', cat: 'วัสดุวิทยาศาสตร์หรือการแพทย์', unit: 'กล่อง' },
    { name: 'แอลกอฮอล์ล้างมือ 70%', cat: 'วัสดุวิทยาศาสตร์หรือการแพทย์', unit: 'แกลลอน' },
    { name: 'ถุงมือยางตรวจโรค', cat: 'วัสดุวิทยาศาสตร์หรือการแพทย์', unit: 'กล่อง' },
    { name: 'ชุดปฐมพยาบาลเบื้องต้น', cat: 'วัสดุวิทยาศาสตร์หรือการแพทย์', unit: 'ชุด' },
    { name: 'น้ำยาฆ่าเชื้อ', cat: 'วัสดุวิทยาศาสตร์หรือการแพทย์', unit: 'แกลลอน' },
    { name: 'ชุดตรวจคลอรีนในน้ำ', cat: 'วัสดุวิทยาศาสตร์หรือการแพทย์', unit: 'ชุด' },
    // วัสดุเครื่องแต่งกาย
    { name: 'เสื้อสะท้อนแสงจราจร', cat: 'วัสดุเครื่องแต่งกาย', unit: 'ตัว' },
    { name: 'ถุงมือผ้าเคลือบยาง', cat: 'วัสดุเครื่องแต่งกาย', unit: 'คู่' },
    { name: 'รองเท้าบูทยางกันลื่น', cat: 'วัสดุเครื่องแต่งกาย', unit: 'คู่' },
    { name: 'หมวกนิรภัย (เซฟตี้)', cat: 'วัสดุเครื่องแต่งกาย', unit: 'ใบ' },
    { name: 'เสื้อกันฝน', cat: 'วัสดุเครื่องแต่งกาย', unit: 'ชุด' },
    { name: 'แว่นตานิรภัย', cat: 'วัสดุเครื่องแต่งกาย', unit: 'อัน' },
    // วัสดุการศึกษา
    { name: 'กระดาษฟลิปชาร์ท', cat: 'วัสดุการศึกษา', unit: 'ม้วน' },
    { name: 'ปากกาไวท์บอร์ด', cat: 'วัสดุการศึกษา', unit: 'ด้าม' },
    { name: 'แปรงลบกระดานไวท์บอร์ด', cat: 'วัสดุการศึกษา', unit: 'อัน' },
    { name: 'ฟิวเจอร์บอร์ด', cat: 'วัสดุการศึกษา', unit: 'แผ่น' },
    { name: 'กระดาษสี A4', cat: 'วัสดุการศึกษา', unit: 'รีม' },
    // วัสดุอื่น
    { name: 'กุญแจคล้องสายยู 50 มม.', cat: 'วัสดุอื่น', unit: 'ชุด' },
    { name: 'เชือกไนลอน', cat: 'วัสดุอื่น', unit: 'ม้วน' },
    { name: 'ผ้าใบกันฝน', cat: 'วัสดุอื่น', unit: 'ผืน' },
    { name: 'ป้ายไวนิลประชาสัมพันธ์', cat: 'วัสดุอื่น', unit: 'แผ่น' },
  ];
  const COMMON_UNITS = [
    'ถุง',
    'กระสอบ',
    'ถัง',
    'แกลลอน',
    'ลิตร',
    'ขวด',
    'กระป๋อง',
    'กิโลกรัม',
    'ตัน',
    'คิว',
    'ท่อน',
    'เส้น',
    'แผ่น',
    'ม้วน',
    'หลอด',
    'รีม',
    'ด้าม',
    'แท่ง',
    'ก้อน',
    'เล่ม',
    'กล่อง',
    'ตลับ',
    'ซอง',
    'ห่อ',
    'แพ็ค',
    'ชุด',
    'อัน',
    'ตัว',
    'ลูก',
    'ใบ',
    'คู่',
    'ผืน',
    'เมตร',
  ];

  function readRecentList(key: string): string[] {
    try {
      const raw = JSON.parse(localStorage.getItem(key) || '[]');
      if (!Array.isArray(raw)) return [];
      return raw.map((x) => String(x || '').trim()).filter(Boolean);
    } catch {
      return [];
    }
  }
  function writeRecentList(key: string, items: string[]) {
    try {
      localStorage.setItem(key, JSON.stringify(items.slice(0, 24)));
    } catch {}
  }
  function getRecentCats(): string[] {
    const stored = readRecentList(RECENT_CATS_KEY);
    const seen = new Set(stored);
    const fromMats = materials
      .slice()
      .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')))
      .map((m) => String(m.cat || '').trim())
      .filter((c) => c && !seen.has(c) && (seen.add(c), true));
    return [...stored, ...fromMats];
  }
  function touchRecentCat(cat: string) {
    const c = String(cat || '').trim().replace(/\s+/g, ' ');
    if (!c) return;
    const prev = readRecentList(RECENT_CATS_KEY).filter((x) => x !== c);
    writeRecentList(RECENT_CATS_KEY, [c, ...prev]);
  }
  function getRecentUnits(): string[] {
    const stored = readRecentList(RECENT_UNITS_KEY);
    const seen = new Set(stored);
    const fromMats = materials
      .slice()
      .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')))
      .map((m) => String(m.unit || '').trim())
      .filter((u) => u && !seen.has(u) && (seen.add(u), true));
    return [...stored, ...fromMats];
  }
  function touchRecentUnit(unit: string) {
    const u = String(unit || '').trim();
    if (!u) return;
    const prev = readRecentList(RECENT_UNITS_KEY).filter((x) => x !== u);
    writeRecentList(RECENT_UNITS_KEY, [u, ...prev]);
  }

  let unitAutoFilled = false;
  const matSugKeys: Array<{ inputId: string; boxId: string; btnId: string }> = [
    { inputId: 'mName', boxId: 'mNameSug', btnId: 'mNameSugBtn' },
    { inputId: 'mCat', boxId: 'mCatSug', btnId: 'mCatSugBtn' },
    { inputId: 'mUnit', boxId: 'mUnitSug', btnId: 'mUnitSugBtn' },
  ];
  let sugActiveIdx = -1;

  function closeMatSugs(exceptBoxId?: string) {
    matSugKeys.forEach(({ inputId, boxId, btnId }) => {
      if (boxId === exceptBoxId) return;
      const box = $(boxId);
      const inp = $(inputId);
      const btn = $(btnId);
      if (box) box.hidden = true;
      if (inp) inp.setAttribute('aria-expanded', 'false');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    });
    if (!exceptBoxId) sugActiveIdx = -1;
  }

  function highlightMatch(text: string, q: string) {
    const clean = q.trim();
    if (!clean) return esc(text);
    const lowText = text.toLowerCase();
    const lowQ = clean.toLowerCase();
    const idx = lowText.indexOf(lowQ);
    if (idx < 0) return esc(text);
    return (
      esc(text.slice(0, idx)) +
      `<mark class="sug-hl">${esc(text.slice(idx, idx + clean.length))}</mark>` +
      esc(text.slice(idx + clean.length))
    );
  }

  function categoryRankFn() {
    const recent = getRecentCats();
    const curCat = ($('mCat')?.value || '').trim().replace(/\s+/g, ' ');
    const rankMap = new Map<string, number>();
    let r = 10;
    recent.forEach((c) => {
      if (!rankMap.has(c)) rankMap.set(c, r++);
    });
    allCats().forEach((c) => {
      if (!rankMap.has(c)) rankMap.set(c, 500 + r++);
    });
    return (cat: string) => {
      if (curCat) {
        if (cat === curCat) return 0;
        if (cat.toLowerCase().includes(curCat.toLowerCase())) return 1;
      }
      return rankMap.get(cat) ?? 9999;
    };
  }

  function renderNameSug(showAll = false) {
    const box = $('mNameSug');
    const inp = $('mName');
    const btn = $('mNameSugBtn');
    if (!box || !inp) return;
    closeMatSugs('mNameSug');
    const q = showAll ? '' : inp.value.trim();
    const ql = q.toLowerCase();
    const recent = getRecentCats();
    const curCat = ($('mCat')?.value || '').trim().replace(/\s+/g, ' ');
    const rankCat = categoryRankFn();
    const existingByName = new Map<string, any>();
    materials.forEach((m) => existingByName.set(String(m.name || '').trim().toLowerCase(), m));

    const fresh = MAT_SUGGESTIONS.filter((s) => !existingByName.has(s.name.toLowerCase())).filter(
      (s) => !ql || s.name.toLowerCase().includes(ql) || s.cat.toLowerCase().includes(ql) || s.unit.toLowerCase().includes(ql)
    );
    const existingMatches = ql
      ? materials
          .filter((m) => String(m.name || '').toLowerCase().includes(ql) || String(m.cat || '').toLowerCase().includes(ql))
          .slice(0, 8)
      : [];

    fresh.sort((a, b) => rankCat(a.cat) - rankCat(b.cat));
    const grouped = new Map<string, Array<{ name: string; cat: string; unit: string; existingId?: string }>>();
    fresh.slice(0, ql ? 40 : 32).forEach((item) => {
      if (!grouped.has(item.cat)) grouped.set(item.cat, []);
      grouped.get(item.cat)!.push(item);
    });
    existingMatches.forEach((m) => {
      const cat = m.cat || 'วัสดุอื่น';
      if (!grouped.has(cat)) grouped.set(cat, []);
      grouped.get(cat)!.push({ name: m.name, cat, unit: m.unit || '', existingId: m.id });
    });

    const sortedGroups = [...grouped.entries()].sort((a, b) => rankCat(a[0]) - rankCat(b[0]));
    const recentHint = curCat ? `กำลังกรอง: ${curCat}` : recent[0] ? `ชนิดล่าสุด: ${recent[0]}` : 'เรียงตามชนิดมาตรฐาน';
    let bodyHtml = '';
    if (!sortedGroups.length) {
      bodyHtml = `<div class="sug-empty">ไม่พบชื่อแนะนำตรงกับ "${esc(q)}" — พิมพ์เพื่อเพิ่มชื่อวัสดุใหม่ได้ทันที</div>`;
    } else {
      bodyHtml = sortedGroups
        .map(([cat, items]) => {
          const rIdx = recent.indexOf(cat);
          const tag =
            curCat && cat === curCat
              ? 'ชนิดที่เลือก'
              : rIdx === 0
              ? 'เลือกล่าสุด'
              : rIdx > 0 && rIdx <= 3
              ? `ล่าสุด #${rIdx + 1}`
              : '';
          return (
            `<div class="sug-group"><span>${esc(cat)}</span>${tag ? `<span class="sug-group-tag">${esc(tag)}</span>` : ''}</div>` +
            items
              .map((it) =>
                it.existingId
                  ? `<button type="button" class="sug-item exists" role="option" data-existing-id="${esc(it.existingId)}"><span class="sug-main">${highlightMatch(
                      it.name,
                      q
                    )}</span><span class="sug-meta">มีในทะเบียน · คลิกแก้ไข</span></button>`
                  : `<button type="button" class="sug-item" role="option" data-sug-kind="name" data-name="${esc(it.name)}" data-cat="${esc(
                      it.cat
                    )}" data-unit="${esc(it.unit)}"><span class="sug-main">${highlightMatch(it.name, q)}</span><span class="sug-meta">${esc(
                      it.unit
                    )}</span></button>`
              )
              .join('')
          );
        })
        .join('');
    }
    box.innerHTML =
      `<div class="sug-head"><span>เสนอชื่อวัสดุ</span><span class="sug-head-recent">${esc(recentHint)}</span></div>` +
      `<div class="sug-list">${bodyHtml}</div>`;
    box.hidden = false;
    inp.setAttribute('aria-expanded', 'true');
    if (btn) btn.setAttribute('aria-expanded', 'true');
    sugActiveIdx = -1;
  }

  function renderCatSug(showAll = false) {
    const box = $('mCatSug');
    const inp = $('mCat');
    const btn = $('mCatSugBtn');
    if (!box || !inp) return;
    closeMatSugs('mCatSug');
    const q = showAll ? '' : inp.value.trim();
    const ql = q.toLowerCase();
    const recent = getRecentCats();
    const cats = allCats();
    const ordered = [
      ...recent.filter((c) => cats.includes(c) || c),
      ...cats.filter((c) => !recent.includes(c)),
    ].filter((c, i, a) => c && a.indexOf(c) === i);
    const filtered = ordered.filter((c) => !ql || c.toLowerCase().includes(ql));
    const countMap = new Map<string, number>();
    materials.forEach((m) => {
      const c = String(m.cat || '').trim();
      if (c) countMap.set(c, (countMap.get(c) || 0) + 1);
    });

    const recentHint = recent[0] ? `ล่าสุด: ${recent[0]}` : 'เรียงตามมาตรฐาน';
    const bodyHtml = filtered.length
      ? filtered
          .map((c) => {
            const rIdx = recent.indexOf(c);
            const cnt = countMap.get(c) || 0;
            const meta = rIdx === 0 ? 'เลือกล่าสุด' : rIdx > 0 && rIdx <= 3 ? `ล่าสุด #${rIdx + 1}` : cnt ? `${cnt} รายการ` : '';
            return `<button type="button" class="sug-item" role="option" data-sug-kind="cat" data-val="${esc(c)}"><span class="sug-main">${highlightMatch(
              c,
              q
            )}</span>${meta ? `<span class="sug-meta">${esc(meta)}</span>` : ''}</button>`;
          })
          .join('')
      : `<div class="sug-empty">ไม่พบประเภทที่ตรงกัน — ใช้ข้อความ "${esc(q)}" เป็นประเภทใหม่ได้</div>`;

    box.innerHTML =
      `<div class="sug-head"><span>ประเภทวัสดุ</span><span class="sug-head-recent">${esc(recentHint)}</span></div>` +
      `<div class="sug-list">${bodyHtml}</div>`;
    box.hidden = false;
    inp.setAttribute('aria-expanded', 'true');
    if (btn) btn.setAttribute('aria-expanded', 'true');
    sugActiveIdx = -1;
  }

  function renderUnitSug(showAll = false) {
    const box = $('mUnitSug');
    const inp = $('mUnit');
    const btn = $('mUnitSugBtn');
    if (!box || !inp) return;
    closeMatSugs('mUnitSug');
    const q = showAll ? '' : inp.value.trim();
    const ql = q.toLowerCase();
    const recentU = getRecentUnits();
    const recentC = getRecentCats();
    const curCat = ($('mCat')?.value || '').trim().replace(/\s+/g, ' ') || recentC[0] || '';
    const catUnits = curCat ? [...new Set(MAT_SUGGESTIONS.filter((s) => s.cat === curCat).map((s) => s.unit))] : [];
    const customUnits = materials.map((m) => String(m.unit || '').trim()).filter(Boolean);
    const ordered = [...new Set([...recentU, ...catUnits, ...COMMON_UNITS, ...customUnits])].filter(
      (u) => !ql || u.toLowerCase().includes(ql)
    );

    const hint = curCat ? `ชนิด: ${curCat}` : recentU[0] ? `ล่าสุด: ${recentU[0]}` : '';
    const bodyHtml = ordered.length
      ? ordered
          .map((u) => {
            const meta = recentU[0] === u ? 'ใช้ล่าสุด' : catUnits.includes(u) && curCat ? `แนะนำใน${curCat}` : '';
            return `<button type="button" class="sug-item" role="option" data-sug-kind="unit" data-val="${esc(u)}"><span class="sug-main">${highlightMatch(
              u,
              q
            )}</span>${meta ? `<span class="sug-meta">${esc(meta)}</span>` : ''}</button>`;
          })
          .join('')
      : `<div class="sug-empty">ไม่พบหน่วยนับ — ใช้ "${esc(q)}" เป็นหน่วยใหม่ได้</div>`;

    box.innerHTML =
      `<div class="sug-head"><span>หน่วยที่นับ</span>${hint ? `<span class="sug-head-recent">${esc(hint)}</span>` : ''}</div>` +
      `<div class="sug-list">${bodyHtml}</div>`;
    box.hidden = false;
    inp.setAttribute('aria-expanded', 'true');
    if (btn) btn.setAttribute('aria-expanded', 'true');
    sugActiveIdx = -1;
  }

  function applySugSelection(btnEl: HTMLElement) {
    if (btnEl.dataset.existingId) {
      const m = matById(btnEl.dataset.existingId);
      closeMatSugs();
      if (m) resetMat(m);
      return;
    }
    const kind = btnEl.dataset.sugKind;
    if (kind === 'name') {
      const name = btnEl.dataset.name || '';
      const cat = btnEl.dataset.cat || '';
      const unit = btnEl.dataset.unit || '';
      if ($('mName')) $('mName').value = name;
      if (cat && $('mCat')) {
        $('mCat').value = cat;
        touchRecentCat(cat);
      }
      if (unit && $('mUnit') && (!$('mUnit').value.trim() || unitAutoFilled)) {
        $('mUnit').value = unit;
        unitAutoFilled = true;
        touchRecentUnit(unit);
      }
      closeMatSugs();
    } else if (kind === 'cat') {
      const val = btnEl.dataset.val || '';
      if ($('mCat')) $('mCat').value = val;
      touchRecentCat(val);
      closeMatSugs();
    } else if (kind === 'unit') {
      const val = btnEl.dataset.val || '';
      if ($('mUnit')) $('mUnit').value = val;
      unitAutoFilled = false;
      touchRecentUnit(val);
      closeMatSugs();
    }
  }

  function wireMatSugField(
    inputId: string,
    boxId: string,
    btnId: string,
    renderFn: (showAll?: boolean) => void
  ) {
    const inp = $(inputId);
    const box = $(boxId);
    const btn = $(btnId);
    if (!inp || !box) return;

    inp.addEventListener('focus', () => renderFn(false));
    inp.addEventListener('click', () => {
      if (box.hidden) renderFn(false);
    });
    inp.addEventListener('input', () => {
      if (inputId === 'mUnit') unitAutoFilled = false;
      renderFn(false);
    });
    inp.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!box.hidden) {
          e.preventDefault();
          closeMatSugs();
        }
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (box.hidden) {
          renderFn(false);
        }
        const items = [...box.querySelectorAll('.sug-item')] as HTMLElement[];
        if (!items.length) return;
        e.preventDefault();
        if (e.key === 'ArrowDown') sugActiveIdx = (sugActiveIdx + 1) % items.length;
        else sugActiveIdx = (sugActiveIdx - 1 + items.length) % items.length;
        items.forEach((el, idx) => el.classList.toggle('active', idx === sugActiveIdx));
        items[sugActiveIdx]?.scrollIntoView({ block: 'nearest' });
        return;
      }
      if (e.key === 'Enter' && !box.hidden) {
        const items = [...box.querySelectorAll('.sug-item')] as HTMLElement[];
        const active = items[sugActiveIdx];
        if (active) {
          e.preventDefault();
          applySugSelection(active);
        }
      }
    });
    if (btn) {
      btn.addEventListener('mousedown', (e: MouseEvent) => e.preventDefault());
      btn.addEventListener('click', () => {
        if (box.hidden) {
          inp.focus();
          renderFn(true);
        } else {
          closeMatSugs();
        }
      });
    }
    box.addEventListener('mousedown', (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('.sug-item') as HTMLElement | null;
      if (target) {
        e.preventDefault();
        applySugSelection(target);
      }
    });
  }

  wireMatSugField('mName', 'mNameSug', 'mNameSugBtn', renderNameSug);
  wireMatSugField('mCat', 'mCatSug', 'mCatSugBtn', renderCatSug);
  wireMatSugField('mUnit', 'mUnitSug', 'mUnitSugBtn', renderUnitSug);

  document.addEventListener('mousedown', (e: MouseEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && !t.closest('.sug-wrap')) closeMatSugs();
  });

  function resetMat(m: any) {
    editMat = m ? m.id : null;
    unitAutoFilled = false;
    closeMatSugs();
    msg('mMsg', '');
    $('matTitle').textContent = m ? 'แก้ไขวัสดุ ' + m.name : 'เพิ่มวัสดุเข้าทะเบียน';
    $('mDel').hidden = !m;
    $('mName').value = m?.name || '';
    if ($('mCode')) $('mCode').value = m?.code || '';
    $('mCat').value = m?.cat || '';
    $('mUnit').value = m?.unit || '';
    if ($('mLoc')) $('mLoc').value = m?.loc || '';
    $('mNote').value = m?.note || '';
    $('mMax').value = m?.max ?? '';
    $('mMin').value = m?.min ?? '';
  }
  $('mReset')?.addEventListener('click', () => resetMat(null));
  $('matForm')?.addEventListener('submit', async (e: Event) => {
    e.preventDefault();
    if (!db) return msg('mMsg', 'เบราว์เซอร์นี้บันทึกข้อมูลไม่ได้', 1);
    const name = $('mName').value.trim();
    if (materials.some((m) => m.name === name && m.id !== editMat))
      return msg('mMsg', 'มีวัสดุชื่อนี้ในทะเบียนแล้ว', 1);
    const old = editMat && matById(editMat),
      now = new Date().toISOString();
    const body = {
      name,
      code: ($('mCode')?.value || '').trim(),
      cat: $('mCat').value.trim().replace(/\s+/g, ' ') || 'วัสดุอื่น',
      unit: $('mUnit').value.trim(),
      loc: ($('mLoc')?.value || '').trim(),
      note: $('mNote').value.trim(),
      max: numOrNull($('mMax').value),
      min: numOrNull($('mMin').value),
      createdAt: old?.createdAt || now,
      updatedAt: now,
    };
    if (body.max != null && body.min != null && body.min > body.max)
      return msg('mMsg', 'จำนวนอย่างต่ำต้องไม่มากกว่าจำนวนอย่างสูง', 1);
    try {
      const id = editMat || db.collection('materials').doc().id;
      await db.doc('materials/' + id).set(body);
      touchRecentCat(body.cat);
      touchRecentUnit(body.unit);
      toast('บันทึกวัสดุ ' + name + ' แล้ว');
      resetMat(null);
    } catch (err) {
      msg('mMsg', errText(err), 1);
    }
  });
  $('mDel')?.addEventListener('click', async () => {
    const m = matById(editMat!);
    if (!m) return;
    if (moves.some((mv) => (mv.lines || []).some((l: any) => l.mid === m.id)))
      return msg('mMsg', 'ลบไม่ได้ เพราะมีรายการรับ-จ่ายของวัสดุนี้แล้ว (ประวัติในบัญชีวัสดุต้องเก็บไว้)', 1);
    if (!confirmClick('delmat', $('mDel'), 'กดอีกครั้งเพื่อลบวัสดุ')) return;
    try {
      await db.doc('materials/' + m.id).delete();
      toast('ลบวัสดุแล้ว');
      resetMat(null);
    } catch (err) {
      msg('mMsg', errText(err), 1);
    }
  });
  function renderMat() {
    const rows = materials.slice().sort(matSort);
    $('matRows').innerHTML = rows
      .map(
        (m) =>
          `<tr><td>${esc(m.name)}${m.note ? `<div class="sub">${esc(m.note)}</div>` : ''}</td><td>${esc(
            m.code || '—'
          )}</td><td>${esc(m.cat || '')}</td><td>${esc(m.unit)}</td><td>${esc(
            m.loc || '—'
          )}</td><td class="num">${m.max != null ? fmtQ(m.max) : '—'}</td><td class="num">${
            m.min != null ? fmtQ(m.min) : '—'
          }</td><td><button class="btn small" data-edmat="${esc(m.id)}">${canWrite ? 'แก้ไข' : 'ดู'}</button></td></tr>`
      )
      .join('');
    const em = $('emptyMat');
    em.hidden = !!rows.length;
    em.innerHTML = '<b>ทะเบียนวัสดุยังว่าง</b>กรอกฟอร์มด้านบนเพื่อเพิ่มวัสดุรายการแรก';
  }
  $('matRows')?.addEventListener('click', (e: Event) => {
    const b = (e.target as HTMLElement).closest('[data-edmat]') as HTMLElement | null;
    if (b) {
      resetMat(matById(b.dataset.edmat!));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  async function unzipEntries(buf: ArrayBuffer) {
    const u = new Uint8Array(buf),
      dv = new DataView(buf);
    let e = -1;
    for (let i = u.length - 22; i >= Math.max(0, u.length - 70000); i--)
      if (dv.getUint32(i, true) === 0x06054b50) {
        e = i;
        break;
      }
    if (e < 0) throw new Error('ไม่ใช่ไฟล์ .xlsx');
    const n = dv.getUint16(e + 10, true);
    let o = dv.getUint32(e + 16, true);
    const out: Record<string, any> = {},
      td = new TextDecoder();
    for (let k = 0; k < n; k++) {
      const meth = dv.getUint16(o + 10, true),
        csz = dv.getUint32(o + 20, true),
        fl = dv.getUint16(o + 28, true),
        xl = dv.getUint16(o + 30, true),
        cl = dv.getUint16(o + 32, true),
        lo = dv.getUint32(o + 42, true);
      const name = td.decode(u.subarray(o + 46, o + 46 + fl));
      o += 46 + fl + xl + cl;
      out[name] = { meth, lo, csz };
    }
    return async (name: string) => {
      const f = out[name];
      if (!f) return null;
      const ln = dv.getUint16(f.lo + 26, true),
        lx = dv.getUint16(f.lo + 28, true);
      const data = u.subarray(f.lo + 30 + ln + lx, f.lo + 30 + ln + lx + f.csz);
      if (f.meth === 0) return td.decode(data);
      if (f.meth !== 8) throw new Error('รูปแบบบีบอัดไม่รองรับ');
      if (typeof DecompressionStream === 'undefined')
        throw new Error('เบราว์เซอร์นี้เก่าเกินไป ใช้ Chrome หรือ Edge รุ่นใหม่');
      const st = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return await new Response(st).text();
    };
  }
  async function readXlsxRows(buf: ArrayBuffer) {
    const get = await unzipEntries(buf),
      P = new DOMParser(),
      X = (t: string) => P.parseFromString(t, 'application/xml');
    let sheet = 'xl/worksheets/sheet1.xml';
    try {
      const wb = X((await get('xl/workbook.xml')) || ''),
        sh = wb.getElementsByTagName('sheet')[0],
        rid =
          sh &&
          (sh.getAttribute('r:id') ||
            [...sh.attributes].find((a) => a.localName === 'id')?.value);
      const rels = X((await get('xl/_rels/workbook.xml.rels')) || '');
      const r = [...rels.getElementsByTagName('Relationship')].find((x) => x.getAttribute('Id') === rid);
      if (r) {
        const t = r.getAttribute('Target') || '';
        sheet = t.startsWith('/') ? t.slice(1) : 'xl/' + t.replace(/^\.\//, '');
      }
    } catch {
      // ignore
    }
    const ssx = await get('xl/sharedStrings.xml'),
      ss = ssx
        ? [...X(ssx).getElementsByTagName('si')].map((si) =>
            [...si.getElementsByTagName('t')]
              .filter((t) => t.parentNode?.nodeName !== 'rPh')
              .map((t) => t.textContent)
              .join('')
          )
        : [];
    const sx = await get(sheet);
    if (!sx) throw new Error('ไม่พบแผ่นงานในไฟล์');
    const rows: any[] = [];
    [...X(sx).getElementsByTagName('row')].forEach((row, ri) => {
      const r = (+(row.getAttribute('r') || 0) || ri + 1) - 1,
        arr: any[] = [];
      let ci = 0;
      [...row.getElementsByTagName('c')].forEach((c) => {
        const ref = c.getAttribute('r');
        if (ref) {
          const m = ref.match(/^[A-Z]+/)![0];
          ci = [...m].reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 1;
        }
        const t = c.getAttribute('t'),
          v = c.getElementsByTagName('v')[0];
        let val = '';
        if (t === 's') val = ss[+(v?.textContent || 0)] ?? '';
        else if (t === 'inlineStr')
          val = [...c.getElementsByTagName('t')].map((x) => x.textContent).join('');
        else if (t === 'b') val = v?.textContent === '1' ? 'TRUE' : 'FALSE';
        else val = v ? v.textContent || '' : '';
        arr[ci] = val;
        ci++;
      });
      rows[r] = arr;
    });
    return Array.from(rows, (r) => (r ? Array.from(r, (c) => c ?? '') : []));
  }
  function parseCsv(txt: string) {
    const rows: string[][] = [];
    let row: string[] = [],
      f = '',
      q = false;
    txt = txt.replace(/^\uFEFF/, '');
    for (let i = 0; i < txt.length; i++) {
      const ch = txt[i];
      if (q) {
        if (ch === '"') {
          if (txt[i + 1] === '"') {
            f += '"';
            i++;
          } else q = false;
        } else f += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') {
        row.push(f);
        f = '';
      } else if (ch === '\n') {
        row.push(f);
        rows.push(row);
        row = [];
        f = '';
      } else if (ch !== '\r') f += ch;
    }
    if (f || row.length) {
      row.push(f);
      rows.push(row);
    }
    return rows;
  }
  const IMP_COLS: Array<[string, RegExp]> = [
    ['max', /อย่างสูง|สูงสุด/],
    ['min', /อย่างต่ำ|ต่ำสุด/],
    ['price', /ราคา/],
    ['qty', /ยกมา|คงเหลือ|จำนวน/],
    ['cat', /ประเภท/],
    ['note', /หมายเหตุ|ขนาด|ยี่ห้อ/],
    ['unit', /หน่วย/],
    ['name', /ชื่อ|รายการ/],
  ];
  const numOf = (v: any) => {
    const n = parseFloat(String(v ?? '').replace(/[,\s฿บาท]/g, ''));
    return isFinite(n) ? n : 0;
  };
  function mapImport(rows: any[][]) {
    let h = rows.findIndex(
      (r) => r.some((c) => /ชื่อ/.test(String(c || ''))) && r.some((c) => /หน่วย/.test(String(c || '')))
    );
    const map: Record<string, number> = {};
    if (h >= 0) {
      rows[h].forEach((c, i) => {
        const t = String(c || '').trim();
        for (const [k, re] of IMP_COLS) {
          if (map[k] == null && re.test(t)) {
            map[k] = i;
            break;
          }
        }
      });
    } else {
      h = -1;
      ['name', 'cat', 'unit', 'note', 'max', 'min', 'qty', 'price'].forEach((k, i) => (map[k] = i));
    }
    if (map.name == null || map.unit == null) return null;
    const have = new Set(materials.map((m) => m.name)),
      seen = new Set<string>(),
      out: any[] = [];
    rows.slice(h + 1).forEach((r, i) => {
      const g = (k: string) =>
        map[k] == null
          ? ''
          : String(r[map[k]] ?? '')
              .replace(/\s+/g, ' ')
              .trim();
      const it: any = {
        row: h + 2 + i,
        name: g('name'),
        cat: g('cat') || 'วัสดุอื่น',
        unit: g('unit'),
        note: g('note'),
        qty: numOf(g('qty')),
        price: numOf(g('price')),
        max: numOrNull(g('max')),
        min: numOrNull(g('min')),
      };
      if (!it.name && !it.unit && !it.note) return;
      if (!it.name || !it.unit) {
        it.st = 'bad';
        it.why = !it.name ? 'ไม่มีชื่อวัสดุ' : 'ไม่มีหน่วยนับ';
      } else if (have.has(it.name)) {
        it.st = 'skip';
        it.why = 'มีในทะเบียนแล้ว';
      } else if (seen.has(it.name)) {
        it.st = 'skip';
        it.why = 'ชื่อซ้ำในไฟล์';
      } else if (it.qty < 0 || it.price < 0) {
        it.st = 'bad';
        it.why = 'จำนวน/ราคาติดลบ';
      } else {
        it.st = 'ok';
        it.why = 'เพิ่มใหม่';
      }
      if (it.name) seen.add(it.name);
      out.push(it);
    });
    return out;
  }
  let impItems: any[] = [];
  function fyStart() {
    const fy = CUR_FY - 543;
    return fy - 1 + '-10-01';
  }
  function renderImport() {
    const ok = impItems.filter((x) => x.st === 'ok'),
      oq = ok.filter((x) => x.qty > 0);
    $('impRows').innerHTML = impItems
      .map(
        (x) =>
          `<tr><td class="sub">${x.row}</td><td>${esc(x.name)}</td><td>${esc(x.cat)}</td><td>${esc(
            x.unit
          )}</td><td class="sub">${esc(x.note)}</td><td class="num">${
            x.max != null || x.min != null
              ? (x.max != null ? fmtQ(x.max) : '-') + ' / ' + (x.min != null ? fmtQ(x.min) : '-')
              : ''
          }</td><td class="num">${x.qty ? fmtQ(x.qty) : ''}</td><td class="num">${
            x.price ? fmtB(x.price) : ''
          }</td><td><span class="st ${x.st}">${esc(x.why)}</span></td></tr>`
      )
      .join('');
    $('impOpen').hidden = !oq.length;
    if (oq.length && !$('impDate').value) $('impDate').value = fyStart();
    if (oq.length) {
      const fy = fyOf($('impDate').value);
      if (fy && !$('impNo').dataset.touched) $('impNo').value = fmtNo(nextSeq('in', fy), fy);
    }
    const sk = impItems.length - ok.length;
    msg(
      'impSum',
      `เพิ่มใหม่ ${ok.length} รายการ${
        oq.length
          ? ` · มียอดยกมา ${oq.length} รายการ มูลค่า ${fmtB(oq.reduce((s, x) => s + r2(x.qty * x.price), 0))} บาท`
          : ''
      }${sk ? ` · ข้าม ${sk} รายการ` : ''}`
    );
    $('impGo').disabled = !ok.length;
    $('impGo').textContent = ok.length ? `นำเข้า ${ok.length} รายการ` : 'ไม่มีรายการให้นำเข้า';
    $('impPrev').hidden = false;
  }
  function closeImport() {
    impItems = [];
    $('impPrev').hidden = true;
    $('impFile').value = '';
    $('impDate').value = '';
    $('impNo').value = '';
    delete $('impNo').dataset.touched;
    msg('impMsg', '');
  }
  $('impCancel')?.addEventListener('click', closeImport);
  $('impNo')?.addEventListener('input', () => ($('impNo').dataset.touched = 1));
  $('impDate')?.addEventListener('change', () => {
    if (impItems.length) renderImport();
  });
  $('impFile')?.addEventListener('change', async () => {
    const f = $('impFile').files[0];
    if (!f) return;
    msg('impMsg', 'กำลังอ่านไฟล์…');
    try {
      let rows;
      if (/\.xls$/i.test(f.name))
        throw new Error('ไฟล์ .xls รุ่นเก่า ให้เปิดใน Excel แล้วบันทึกเป็น .xlsx ก่อน');
      if (/\.csv$/i.test(f.name)) {
        const b = await f.arrayBuffer();
        let t = new TextDecoder('utf-8').decode(b);
        if (/\uFFFD/.test(t)) {
          try {
            t = new TextDecoder('windows-874').decode(b);
          } catch {
            // ignore
          }
        }
        rows = parseCsv(t);
      } else rows = await readXlsxRows(await f.arrayBuffer());
      const items = mapImport(rows);
      if (!items) throw new Error('ไม่พบคอลัมน์ “ชื่อวัสดุ” และ “หน่วยนับ” ในไฟล์');
      if (!items.length) throw new Error('ไม่มีรายการวัสดุในไฟล์');
      impItems = items;
      renderImport();
      msg('impMsg', f.name);
    } catch (err: any) {
      closeImport();
      msg('impMsg', 'อ่านไฟล์ไม่ได้: ' + (err?.message || err), 1);
    }
  });
  $('impGo')?.addEventListener('click', async () => {
    if (!db) return msg('impSum', 'เบราว์เซอร์นี้บันทึกข้อมูลไม่ได้', 1);
    const ok = impItems.filter((x) => x.st === 'ok' && !materials.some((m) => m.name === x.name));
    if (!ok.length) return;
    const oq = ok.filter((x) => x.qty > 0);
    let n: any = null,
      date = '';
    if (oq.length) {
      date = $('impDate').value;
      if (!date) {
        $('impDate').focus();
        return msg('impSum', 'เลือกวันที่ยอดยกมา', 1);
      }
      n = parseNo($('impNo').value, 'in', date);
      if (moves.some((m) => m.kind === 'in' && m.no === n.no))
        return msg('impSum', 'เลขที่ใบรับ ' + n.no + ' ซ้ำกับใบที่มีอยู่แล้ว', 1);
    }
    const b = $('impGo');
    b.disabled = true;
    b.textContent = 'กำลังนำเข้า…';
    const now = new Date().toISOString(),
      lines: any[] = [];
    let done = 0;
    try {
      for (const x of ok) {
        const id = db.collection('materials').doc().id;
        await db
          .doc('materials/' + id)
          .set({
            name: x.name,
            cat: x.cat,
            unit: x.unit,
            note: x.note,
            max: x.max,
            min: x.min,
            createdAt: now,
            updatedAt: now,
          });
        done++;
        if (x.qty > 0) lines.push({ mid: id, qty: x.qty, price: x.price });
      }
      if (lines.length) {
        const id = db.collection('moves').doc().id;
        await db.doc('moves/' + id).set({
          kind: 'in',
          no: n.no,
          seq: n.seq,
          fy: n.fy,
          date,
          src: 'opening',
          inspectDate: '',
          poNo: '',
          vendor: '',
          invoiceNo: '',
          note: 'นำเข้าจากไฟล์ Excel',
          lines,
          createdAt: now,
          updatedAt: now,
        });
      }
      closeImport();
      toast(`นำเข้าวัสดุ ${done} รายการแล้ว${lines.length ? ' พร้อมยอดยกมา' : ''}`);
    } catch (err) {
      msg('impSum', `นำเข้าได้ ${done} รายการ แล้วเกิดข้อผิดพลาด: ` + errText(err), 1);
      b.disabled = false;
      b.textContent = 'นำเข้า';
    }
  });
  $('impTpl')?.addEventListener('click', () => {
    if (typeof XLSX === 'undefined') {
      toast('โหลดตัวสร้างไฟล์ Excel ไม่สำเร็จ');
      return;
    }
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      [
        'ชื่อวัสดุ',
        'ประเภทวัสดุ',
        'หน่วยนับ',
        'หมายเหตุ / ขนาด / ยี่ห้อ',
        'จำนวนอย่างสูง',
        'จำนวนอย่างต่ำ',
        'จำนวนคงเหลือยกมา',
        'ราคาต่อหน่วย (บาท)',
      ],
    ]);
    ws['!cols'] = [
      { wch: 40 },
      { wch: 28 },
      { wch: 12 },
      { wch: 28 },
      { wch: 15 },
      { wch: 15 },
      { wch: 18 },
      { wch: 18 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'วัสดุ');
    const help = [
      ['วิธีกรอก'],
      ['กรอกในแผ่นงาน “วัสดุ” แถวละ 1 รายการ เริ่มแถวที่ 2'],
      ['ชื่อวัสดุ และ หน่วยนับ ต้องกรอก · ชื่อที่มีในทะเบียนแล้วจะถูกข้าม'],
      ['ประเภทวัสดุ เว้นว่างได้ (จะเป็น “วัสดุอื่น”) หรือพิมพ์ประเภทใหม่เองได้'],
      ['จำนวนอย่างสูง / จำนวนอย่างต่ำ เว้นว่างได้ (ระบบเตือนเมื่อเหลือไม่เกินจำนวนอย่างต่ำ)'],
      ['จำนวนคงเหลือยกมา และ ราคาต่อหน่วย เว้นว่างได้ ถ้ากรอก ระบบจะบันทึกใบรับยอดยกมาให้'],
      [''],
      ['ตัวอย่าง'],
      [
        'ชื่อวัสดุ',
        'ประเภทวัสดุ',
        'หน่วยนับ',
        'หมายเหตุ / ขนาด / ยี่ห้อ',
        'จำนวนอย่างสูง',
        'จำนวนอย่างต่ำ',
        'จำนวนคงเหลือยกมา',
        'ราคาต่อหน่วย (บาท)',
      ],
      ['กระดาษ A4 80 แกรม', 'วัสดุสำนักงาน', 'รีม', '', 50, 10, 20, 125],
      ['ทรายหยาบ', 'วัสดุก่อสร้าง', 'คิว', '', '', '', 3, 450],
      [''],
      ['ประเภทวัสดุที่มีในระบบ'],
      ...allCats().map((c) => [c]),
    ];
    const hs = XLSX.utils.aoa_to_sheet(help);
    hs['!cols'] = [
      { wch: 60 },
      { wch: 18 },
      { wch: 10 },
      { wch: 24 },
      { wch: 15 },
      { wch: 15 },
      { wch: 18 },
      { wch: 18 },
    ];
    XLSX.utils.book_append_sheet(wb, hs, 'วิธีกรอก');
    saveFile('แบบฟอร์มนำเข้าวัสดุ.xlsx', XLSX.write(wb, { type: 'array', bookType: 'xlsx' }), 'ดาวน์โหลดแบบฟอร์มแล้ว');
  });

  let counts: Record<string, any> = {},
    cDraft: any = null,
    cDirty = false,
    cTimer: any = null;
  const CONDS = ['ปกติ', 'ชำรุด', 'เสื่อมสภาพ', 'สูญไป', 'ไม่จำเป็นต้องใช้'];
  const CROLE = ['ประธานกรรมการ', 'กรรมการ', 'กรรมการ'];
  const fyEnd = (fy: number) => fy - 543 + '-09-30';
  function cFyVal() {
    return +$('cFy').value || CUR_FY - 1;
  }
  function loadDraft(fy: number) {
    const c = counts[String(fy)];
    cDraft = c
      ? JSON.parse(JSON.stringify(c))
      : { fy, date: fyEnd(fy), committee: CROLE.map(() => ({ n: '', p: '' })), items: {} };
    cDraft.items = cDraft.items || {};
    cDraft.committee = CROLE.map((_r, i) => (cDraft.committee || [])[i] || { n: '', p: '' });
    cDirty = false;
  }
  function countRows() {
    const fy = cDraft.fy,
      d = cDraft.date || fyEnd(fy),
      zero = $('cZero').checked;
    return materials
      .slice()
      .sort(matSort)
      .map((m) => {
        const b = stateUpto(m.id, d),
          it = cDraft.items[m.id] || {},
          q = it.q == null || it.q === '' ? null : +it.q;
        const gl = priceGroups(b.lots);
        return {
          m,
          bq: r2(b.q),
          bv: r2(b.v),
          lots: b.lots,
          pg: gl,
          pr: gl.length ? gl[gl.length - 1].price : 0,
          q,
          dif: q == null ? null : r2(q - b.q),
          cond: it.cond || 'ปกติ',
          note: it.note || '',
        };
      })
      .filter((r) => zero || r.bq !== 0 || r.q != null || r.note);
  }
  function countStats(rows: any[]) {
    const t = { n: rows.length, ok: 0, miss: 0, over: 0, todo: 0, bad: 0, bv: 0, mv: 0, ov: 0 };
    rows.forEach((r) => {
      t.bv += r.bv;
      if (r.q == null) t.todo++;
      else if (r.dif < 0) {
        t.miss++;
        t.mv = r2(t.mv + fifoValue(r.lots, -r.dif));
      } else if (r.dif > 0) {
        t.over++;
        t.ov = r2(t.ov + r.dif * r.pr);
      } else t.ok++;
      if (r.cond !== 'ปกติ') t.bad++;
    });
    return t;
  }
  function refreshCntFy(preferredFy?: string) {
    const s = $('cFy');
    if (!s) return;
    const v = preferredFy || s.value || String(CUR_FY);
    const list = sortFyCurrentFirst(
      [...new Set([CUR_FY, CUR_FY - 1, ...fyList(), ...Object.keys(counts).map(Number)])].filter(Boolean)
    );
    fillSelect(
      s,
      list.map((y) => [
        String(y),
        'ปีงบ ' + y + (counts[String(y)] ? ' ✓' : ''),
      ])
    );
    s.value = [...s.options].some((o: any) => o.value === v) ? v : String(CUR_FY);
  }
  const difTxt = (d: number | null) =>
    d == null ? '<span class="sub">ยังไม่นับ</span>' : d === 0 ? 'ตรง' : (d > 0 ? '+' : '') + fmtQ(d);
  function renderCntKpi(rows?: any[]) {
    const t = countStats(rows || countRows());
    $('cKpi').innerHTML = `<div class="kpi"><span class="k">วัสดุที่ต้องตรวจนับ</span><span class="v">${
      t.n
    }<small>รายการ</small></span><span class="sub">มูลค่าตามบัญชี ${fmtB(t.bv)} บาท</span></div>
  <div class="kpi"><span class="k">ตรงตามบัญชี</span><span class="v">${
    t.ok
  }<small>รายการ</small></span><span class="sub">ยังไม่นับ ${t.todo} รายการ</span></div>
  <div class="kpi"><span class="k">ขาดบัญชี</span><span class="v" style="color:${
    t.miss ? 'var(--bad)' : 'inherit'
  }">${t.miss}<small>รายการ</small></span><span class="sub">มูลค่า ${fmtB(t.mv)} บาท</span></div>
  <div class="kpi"><span class="k">เกินบัญชี / สภาพไม่ปกติ</span><span class="v">${t.over} / ${
      t.bad
    }<small>รายการ</small></span><span class="sub">เกินมูลค่า ${fmtB(t.ov)} บาท</span></div>`;
  }
  function renderCount() {
    refreshCntFy();
    const fy = cFyVal();
    if (!cDraft || cDraft.fy !== fy) loadDraft(fy);
    $('cDate').value = cDraft.date || fyEnd(fy);
    $('cCmt').innerHTML = cDraft.committee
      .map(
        (c: any, i: number) =>
          `<label class="f c6">${CROLE[i]}<input data-cn="${i}" value="${esc(
            c.n
          )}" placeholder="ชื่อ-สกุล"></label><label class="f c6">ตำแหน่ง<input data-cp="${i}" value="${esc(
            c.p
          )}"></label>`
      )
      .join('');
    const rows = countRows();
    $('cRows').innerHTML = rows
      .map(
        (r) =>
          `<tr data-mid="${esc(r.m.id)}" class="${r.dif! < 0 ? 'miss' : r.dif! > 0 ? 'over' : ''}"><td>${esc(
            r.m.name
          )}<div class="sub">${esc(r.m.cat || '')}</div></td><td>${esc(r.m.unit)}</td><td class="num">${fmtQ(
            r.bq
          )}</td><td class="num">${fmtB(r.bv)}</td>
    <td><input class="cq" type="number" min="0" step="any" inputmode="decimal" value="${
      r.q == null ? '' : r.q
    }" placeholder="—" aria-label="จำนวนที่นับได้ ${esc(r.m.name)}"></td>
    <td class="num dif ${r.dif! < 0 ? 'neg' : r.dif! > 0 ? 'pos' : ''}">${difTxt(r.dif)}</td>
    <td><select class="cc">${CONDS.map((c) => `<option${c === r.cond ? ' selected' : ''}>${c}</option>`).join(
      ''
    )}</select></td>
    <td><input class="cn" value="${esc(r.note)}"></td></tr>`
      )
      .join('');
    const em = $('cEmpty');
    em.hidden = !!rows.length;
    em.innerHTML = materials.length
      ? '<b>ไม่มีวัสดุคงเหลือ ณ วันที่ตรวจนับ</b>ติ๊ก “แสดงวัสดุที่ยอดเป็น 0 ด้วย” เพื่อดูทุกรายการ'
      : '<b>ยังไม่มีวัสดุในทะเบียน</b>';
    renderCntKpi(rows);
  }
  function cSchedule() {
    cDirty = true;
    $('cSave').textContent = 'กำลังบันทึก…';
    clearTimeout(cTimer);
    cTimer = setTimeout(cSaveNow, 700);
  }
  async function cSaveNow() {
    clearTimeout(cTimer);
    if (!cDraft || !db) return;
    const items: Record<string, any> = {};
    Object.entries(cDraft.items).forEach(([k, v]: [string, any]) => {
      if (v && ((v.q != null && v.q !== '') || v.note || (v.cond && v.cond !== 'ปกติ'))) items[k] = v;
    });
    const body = {
      fy: cDraft.fy,
      date: cDraft.date,
      committee: cDraft.committee,
      items,
      updatedAt: new Date().toISOString(),
    };
    try {
      await db.doc('counts/' + cDraft.fy).set(body);
      cDirty = false;
      $('cSave').textContent =
        'บันทึกอัตโนมัติแล้ว ' + new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    } catch (err) {
      $('cSave').textContent = '';
      msg('cMsg', errText(err), 1);
    }
  }
  function cItem(mid: string) {
    return (cDraft.items[mid] = cDraft.items[mid] || { q: null, cond: 'ปกติ', note: '' });
  }
  $('cRows')?.addEventListener('input', (e: Event) => {
    const target = e.target as HTMLInputElement;
    const tr = target.closest('tr[data-mid]') as HTMLElement | null;
    if (!tr || !cDraft) return;
    const it = cItem(tr.dataset.mid!);
    if (target.classList.contains('cq')) {
      const v = target.value.trim();
      it.q = v === '' ? null : Math.max(0, +v);
      const bq = r2(stateUpto(tr.dataset.mid!, cDraft.date).q),
        d = it.q == null ? null : r2(it.q - bq),
        td = tr.querySelector('.dif')!;
      td.innerHTML = difTxt(d);
      td.className = 'num dif ' + (d! < 0 ? 'neg' : d! > 0 ? 'pos' : '');
      tr.className = d! < 0 ? 'miss' : d! > 0 ? 'over' : '';
      renderCntKpi();
    } else if (target.classList.contains('cn')) it.note = target.value;
    cSchedule();
  });
  $('cRows')?.addEventListener('change', (e: Event) => {
    const target = e.target as HTMLSelectElement;
    if (!target.classList.contains('cc')) return;
    const tr = target.closest('tr[data-mid]') as HTMLElement | null;
    if (!tr) return;
    cItem(tr.dataset.mid!).cond = target.value;
    renderCntKpi();
    cSchedule();
  });
  $('cRows')?.addEventListener('keydown', (e: KeyboardEvent) => {
    const target = e.target as HTMLInputElement;
    if (e.key === 'Enter' && target.classList.contains('cq')) {
      e.preventDefault();
      const all = [...$('cRows').querySelectorAll('input.cq')] as HTMLInputElement[];
      const i = all.indexOf(target);
      if (all[i + 1]) {
        all[i + 1].focus();
        all[i + 1].select();
      }
    }
  });
  $('cCmt')?.addEventListener('input', (e: Event) => {
    if (!cDraft) return;
    const target = e.target as HTMLInputElement;
    const i = target.dataset.cn ?? target.dataset.cp;
    if (i == null) return;
    cDraft.committee[+i][target.dataset.cn != null ? 'n' : 'p'] = target.value;
    cSchedule();
  });
  $('cFy')?.addEventListener('change', async () => {
    if (cDirty) await cSaveNow();
    cDraft = null;
    msg('cMsg', '');
    renderCount();
  });
  $('cZero')?.addEventListener('change', renderCount);
  $('cDate')?.addEventListener('change', () => {
    if (!cDraft || !$('cDate').value) return;
    cDraft.date = $('cDate').value;
    cSchedule();
    renderCount();
  });
  $('cFill')?.addEventListener('click', () => {
    if (!cDraft) return;
    let n = 0;
    countRows().forEach((r) => {
      if (r.q == null) {
        cItem(r.m.id).q = r.bq;
        n++;
      }
    });
    if (!n) return msg('cMsg', 'ทุกรายการกรอกจำนวนแล้ว');
    msg('cMsg', `ใส่ยอดตามบัญชีให้ ${n} รายการ แก้เฉพาะรายการที่นับได้ไม่ตรง`);
    cSchedule();
    renderCount();
  });
  function countHtml(blank: boolean) {
    const rows = countRows(),
      fy = cDraft.fy,
      d = cDraft.date,
      t = countStats(rows);
    let tq = 0;
    const body = rows
      .map((r, i) => {
        tq += r.bv;
        const miss = !blank && r.dif! < 0 ? fmtQ(-r.dif!) : '',
          over = !blank && r.dif! > 0 ? fmtQ(r.dif!) : '';
        return `<tr><td class="cn">${i + 1}</td><td>${esc(r.m.name)}</td><td class="cn">${esc(
          r.m.unit
        )}</td><td class="n">${fmtQ(r.bq)}</td><td class="n">${
          r.bq > 0
            ? r.pg.length > 1
              ? r.pg.map((g: any) => fmtB(g.price) + ' ×' + fmtQ(g.q)).join('<br>')
              : fmtB(r.pr)
            : ''
        }</td><td class="n">${fmtB(r.bv)}</td>
    <td class="n">${blank || r.q == null ? '' : fmtQ(r.q)}</td><td class="n">${miss}</td><td class="n">${over}</td><td class="cn">${
          blank ? '' : r.cond === 'ปกติ' ? 'ใช้งานได้' : esc(r.cond)
        }</td><td>${blank ? '' : esc(r.note)}</td></tr>`;
      })
      .join('');
    const sig = cDraft.committee
      .map(
        (c: any, i: number) =>
          `<div>(ลงชื่อ)................................${CROLE[i]}<br>(${
            c.n ? esc(c.n) : '.........................................'
          })<br>ตำแหน่ง ${c.p ? esc(c.p) : '...................................'}</div>`
      )
      .join('');
    return `${settings.logo ? `<img class="lg" src="${esc(settings.logo)}" alt="" style="width:2cm;height:2cm">` : ''}
  <p class="ttl">${blank ? 'แบบตรวจนับวัสดุคงเหลือประจำปี' : 'รายงานผลการตรวจสอบพัสดุประจำปี (ประเภทวัสดุ)'}</p>
  <p class="c">${esc(fullOrg())}</p>
  <p class="c">ประจำปีงบประมาณ พ.ศ. ${fy} &nbsp;·&nbsp; ตรวจนับ ณ วันที่ ${esc(thDateFull(d))}</p>
  <table class="ct"><thead><tr><th rowspan="2" style="width:44px">ลำดับ<br>ที่</th><th rowspan="2">รายการ</th><th rowspan="2" style="width:62px">หน่วยนับ</th><th colspan="3">คงเหลือตามบัญชีวัสดุ</th><th rowspan="2" style="width:76px">ตรวจนับ<br>ได้จริง</th><th colspan="2">ผลต่าง</th><th rowspan="2" style="width:92px">สภาพ</th><th rowspan="2" style="width:${
      blank ? 150 : 130
    }px">หมายเหตุ</th></tr>
  <tr><th style="width:70px">จำนวน</th><th style="width:84px">ราคา/หน่วย</th><th style="width:96px">มูลค่า (บาท)</th><th style="width:56px">ขาด</th><th style="width:56px">เกิน</th></tr></thead>
  <tbody>${body || '<tr><td colspan="11" class="cn">ไม่มีรายการ</td></tr>'}</tbody>
  <tfoot><tr><td colspan="5" class="n">รวมมูลค่าวัสดุคงเหลือตามบัญชี</td><td class="n">${fmtB(
    tq
  )}</td><td colspan="5"></td></tr></tfoot></table>
  ${
    blank
      ? ''
      : `<p class="csum">ผลการตรวจนับวัสดุคงเหลือ จำนวนทั้งสิ้น ${t.n} รายการ มูลค่าตามบัญชี ${fmtB(
          t.bv
        )} บาท ปรากฏว่า ตรงตามบัญชี ${t.ok} รายการ ขาดบัญชี ${t.miss} รายการ${
          t.miss ? ` (มูลค่า ${fmtB(t.mv)} บาท)` : ''
        } เกินบัญชี ${t.over} รายการ${t.over ? ` (มูลค่า ${fmtB(t.ov)} บาท)` : ''}${
          t.todo ? ` ยังไม่ได้ตรวจนับ ${t.todo} รายการ` : ''
        } และมีวัสดุชำรุด เสื่อมสภาพ สูญไป หรือไม่จำเป็นต้องใช้ ${t.bad} รายการ</p>`
  }
  <div class="csig">${sig}</div>`;
  }
  function openPaper(title: string, html: string, land: boolean) {
    $('pmTitle').textContent = title;
    paperLandscape = !!land;
    const pp = $('paper');
    pp.innerHTML = html;
    pp.classList.toggle('land', !!land);
    pp.classList.toggle('ths', hasTHS());
    applyPrintPageRule(!!land);
    printMv = null;
    $('pmWord').hidden = true;
    $('pmSigs').hidden = true;
    $('printModal').hidden = false;
    document.body.style.overflow = 'hidden';
    $('pmPdf').focus();
  }
  $('cPrint')?.addEventListener('click', async () => {
    if (!cDraft) return;
    if (cDirty) await cSaveNow();
    openPaper('รายงานผลการตรวจนับวัสดุ ปีงบ ' + cDraft.fy, countHtml(false), true);
  });
  $('cBlank')?.addEventListener('click', () => {
    if (!cDraft) return;
    openPaper('แบบฟอร์มตรวจนับวัสดุ ปีงบ ' + cDraft.fy, countHtml(true), true);
  });
  $('cXlsx')?.addEventListener('click', () => {
    if (!cDraft) return;
    if (typeof XLSX === 'undefined') {
      toast('โหลดตัวสร้างไฟล์ Excel ไม่สำเร็จ');
      return;
    }
    const rows = countRows(),
      t = countStats(rows);
    const aoa = [
      [
        'ลำดับ',
        'รายการ',
        'ประเภท',
        'หน่วยนับ',
        'คงเหลือตามบัญชี',
        'ราคาต่อหน่วย',
        'มูลค่าตามบัญชี',
        'ตรวจนับได้จริง',
        'ขาด',
        'เกิน',
        'มูลค่าขาด',
        'สภาพ',
        'หมายเหตุ',
      ],
      ...rows.map((r, i) => [
        i + 1,
        r.m.name,
        r.m.cat || '',
        r.m.unit,
        r.bq,
        r.pg.length > 1 ? r.pg.map((g: any) => fmtB(g.price) + ' ×' + fmtQ(g.q)).join(', ') : r2(r.pr),
        r.bv,
        r.q == null ? '' : r.q,
        r.dif! < 0 ? -r.dif! : '',
        r.dif! > 0 ? r.dif! : '',
        r.dif! < 0 ? fifoValue(r.lots, -r.dif!) : '',
        r.cond,
        r.note,
      ]),
      [],
      ['', 'รวมมูลค่าตามบัญชี', '', '', '', '', r2(t.bv), '', '', '', r2(t.mv)],
      [],
      ['', 'ผลการตรวจนับ ปีงบประมาณ ' + cDraft.fy + ' ณ วันที่ ' + thDateFull(cDraft.date) + ' ' + fullOrg()],
      ['', 'ตรงบัญชี ' + t.ok + ' · ขาด ' + t.miss + ' · เกิน ' + t.over + ' · ยังไม่นับ ' + t.todo + ' · สภาพไม่ปกติ ' + t.bad + ' รายการ'],
      ...cDraft.committee.map((c: any, i: number) => ['', CROLE[i] + ': ' + (c.n || '-') + (c.p ? ' (' + c.p + ')' : '')]),
    ];
    const wb = XLSX.utils.book_new(),
      ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [
      { wch: 7 },
      { wch: 36 },
      { wch: 22 },
      { wch: 10 },
      { wch: 14 },
      { wch: 13 },
      { wch: 15 },
      { wch: 14 },
      { wch: 9 },
      { wch: 9 },
      { wch: 13 },
      { wch: 16 },
      { wch: 26 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'ตรวจนับ ' + cDraft.fy);
    saveFile('ตรวจนับวัสดุ_ปีงบ' + cDraft.fy + '.xlsx', XLSX.write(wb, { type: 'array', bookType: 'xlsx' }), 'ส่งออกไฟล์ Excel แล้ว');
  });

  const colName = (i: number) => {
    let s = '';
    i++;
    while (i > 0) {
      const m = (i - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      i = (i - 1 - m) / 26;
    }
    return s;
  };
  function orgParts() {
    const raw = String(settings.org || '').trim();
    const o = raw === DEF_SET.org ? '' : raw;
    const m = o.match(/^(.*?)\s*(?:อำเภอ|อ\.)\s*(\S+)\s*(?:จังหวัด|จ\.)\s*(\S+)/);
    return m ? { name: m[1].trim(), amp: m[2], chw: m[3] } : { name: o, amp: '', chw: '' };
  }
  function defaultDivHeadPos(divStr?: string) {
    const div = String(divStr ?? settings.div ?? '').trim();
    if (!div) return 'ผู้อำนวยการกอง';
    if (div === 'สำนักปลัด' || div.startsWith('สำนักปลัด')) return 'หัวหน้า' + div;
    if (/^(ผู้อำนวยการ|หัวหน้า)/.test(div)) return div;
    return 'ผู้อำนวยการ' + div;
  }
  function defaultControllerPos(divStr?: string) {
    const div = String(divStr ?? settings.div ?? '').trim();
    return div ? 'ผู้ควบคุมวัสดุ ' + div : 'ผู้ควบคุมวัสดุ กอง/สำนัก';
  }
  function defaultFinPos() {
    return defaultDivHeadPos();
  }
  function vsDefaults() {
    const op = orgParts(),
      n = op.name;
    const pal = n ? 'ปลัด' + n : 'ปลัดองค์กรปกครองส่วนท้องถิ่น';
    const exe = n
      ? /^เทศบาล/.test(n)
        ? 'นายกเทศมนตรี' + n.replace(/^เทศบาล/, '')
        : 'นายก' + n
      : 'ผู้บริหารองค์กรปกครองส่วนท้องถิ่น';
    const defStaff = settings.staff || settings.payer || '';
    const defStaffPos = settings.staff
      ? settings.staffPos || settings.payerPos || ''
      : settings.payerPos || settings.staffPos || '';
    const defFin = settings.appr || settings.head || '';
    const defFinPos = settings.apprPos || settings.headPos || defaultFinPos();
    return {
      org: n,
      amp: op.amp,
      chw: op.chw,
      zip: '',
      co: defStaff,
      coPos: defStaffPos,
      tel: '',
      fax: '',
      mk: defStaff,
      mkPos: defStaffPos,
      fin: defFin,
      finPos: defFinPos,
      pal: '',
      palPos: pal,
      exe: '',
      exePos: exe,
    };
  }
  function vsHead() {
    const def = vsDefaults();
    const vsLegacy = settings.vs || {};
    const pick = (k: string, primaryVal?: string) => {
      const v = String(primaryVal ?? vsLegacy[k] ?? '').trim();
      return v || (def as any)[k] || '';
    };
    const legacyFinPos =
      vsLegacy.finPos === 'ผู้อำนวยการกองคลัง' && String(settings.div || '').trim() !== 'กองคลัง'
        ? ''
        : vsLegacy.finPos;
    return {
      org: pick('org', orgParts().name),
      amp: pick('amp', settings.amp),
      chw: pick('chw', settings.chw),
      zip: pick('zip', settings.zip),
      co: pick('co', settings.co),
      coPos: pick('coPos', settings.coPos),
      tel: pick('tel', settings.tel),
      fax: pick('fax', settings.fax),
      mk: pick('mk', settings.vsMk),
      mkPos: pick('mkPos', settings.vsMkPos),
      fin: pick('fin', settings.vsFin),
      finPos: String(settings.vsFinPos ?? legacyFinPos ?? '').trim() || def.finPos,
      pal: pick('pal', settings.vsPal),
      palPos: pick('palPos', settings.vsPalPos),
      exe: pick('exe', settings.vsExe),
      exePos: pick('exePos', settings.vsExePos),
    };
  }
  const divName = () => settings.div || 'กองนี้';
  function vsDate() {
    return $('vDate')?.value || fyEnd(+$('rFy')?.value || CUR_FY);
  }
  function vsSelfItems() {
    const d = vsDate();
    return materials
      .slice()
      .sort((a, b) => (a.cat || '').localeCompare(b.cat || '', 'th') || matSort(a, b))
      .flatMap((m) => {
        const c = stateUpto(m.id, d);
        return c.q > 0
          ? priceGroups(c.lots).map((g) => ({
              name: matLabel(m),
              qty: g.q,
              unit: m.unit,
              price: g.price,
              amt: g.v,
              note: '',
            }))
          : [];
      });
  }
  const sumAmt = (it: any[]) => r2(it.reduce((t, x) => t + (+x.amt || 0), 0));
  function renderVs() {
    const fy = +$('rFy').value || CUR_FY;
    if ($('vDate') && (!$('vDate').value || $('vDate').dataset.fy !== String(fy))) {
      $('vDate').value = fyEnd(fy);
      $('vDate').dataset.fy = String(fy);
    }
    const h: any = vsHead();
    const div = divName();
    if ($('vHeadSum')) {
      $('vHeadSum').textContent =
        '· ' + ([h.org, h.amp && 'อ.' + h.amp, h.chw && 'จ.' + h.chw].filter(Boolean).join(' ') || 'ยังไม่ได้ตั้งค่าชื่อหน่วยงาน');
    }
    if ($('vDivName')) $('vDivName').textContent = div;
    const own = vsSelfItems();
    if ($('vSelfSum')) {
      $('vSelfSum').textContent = `วัสดุคงเหลือประจำ${div} ${own.length} รายการ · มูลค่ารวม ${fmtB(sumAmt(own))} บาท`;
    }
    const missEl = $('vMissingSet');
    if (missEl) {
      const missing: string[] = [];
      if (!h.org) missing.push('ชื่อหน่วยงาน (อปท.)');
      if (!h.amp || !h.chw || !h.zip) missing.push('อำเภอ/จังหวัด/รหัสไปรษณีย์');
      if (!h.co) missing.push('เจ้าหน้าที่ประสานงาน');
      if (!h.fin || !h.pal || !h.exe) missing.push('รายชื่อผู้ลงนาม (ผอ.ประจำกอง/ปลัด/ผู้บริหาร)');
      if (missing.length) {
        missEl.hidden = false;
        missEl.innerHTML = `ℹ️ ข้อมูลสำหรับแบบ อปท.-วส. ยังกรอกไม่ครบ (${esc(missing.join(', '))}) — คลิกปุ่ม <b>“แก้ไขข้อมูลหน่วยงาน / ผู้ลงนาม”</b> ด้านบนเพื่อตั้งค่าเพิ่มเติม`;
      } else {
        missEl.hidden = true;
      }
    }
    if ($('vsPreview')) {
      $('vsPreview').innerHTML = vsHtml(own, 'ส่วนราชการ ' + div);
    }
  }
  $('vDate')?.addEventListener('change', renderVs);
  function vsTitleLines(h: any, date: string, sub: string) {
    return {
      form: 'แบบ อปท. - วส.',
      title: 'รายงานวัสดุคงเหลือ',
      date: 'ณ วันที่ ' + thDateFull(date),
      sub,
      l1: 'ชื่อหน่วยงาน ' + (h.org || '................................................................................'),
      l2:
        'อำเภอ ' +
        (h.amp || '..............................') +
        '   จังหวัด ' +
        (h.chw || '..............................') +
        '   รหัสไปรษณีย์ ' +
        (h.zip || '...............'),
      l3:
        'ชื่อเจ้าหน้าที่ประสานงาน ' +
        (h.co || '..................................................') +
        '   ตำแหน่ง ' +
        (h.coPos || '........................................'),
      l4:
        'โทรศัพท์ ' +
        (h.tel || '........................................') +
        '   โทรสาร ' +
        (h.fax || '........................................'),
    };
  }
  function vsSigs(h: any) {
    const D = '..................................................';
    const DP = '........................................';
    return [
      [
        'ลงชื่อ ' + D + ' ผู้จัดทำ',
        '(' + (h.mk || D) + ')',
        'ตำแหน่ง ' + (h.mkPos || DP),
        'วันที่ ........................................',
      ],
      [
        'ลงชื่อ ' + D,
        '(' + (h.fin || D) + ')',
        'ตำแหน่ง ' + (h.finPos || defaultFinPos()),
        'วันที่ ........................................',
      ],
      [
        'ลงชื่อ ' + D,
        '(' + (h.pal || D) + ')',
        'ตำแหน่ง ' + (h.palPos || 'ปลัดองค์กรปกครองส่วนท้องถิ่น'),
        'วันที่ ........................................',
      ],
      [
        'ลงชื่อ ' + D,
        '(' + (h.exe || D) + ')',
        'ตำแหน่ง ' + (h.exePos || 'ผู้บริหารองค์กรปกครองส่วนท้องถิ่น'),
        'วันที่ ........................................',
      ],
    ];
  }
  function vsHtml(rows: any[], sub: string) {
    const h = vsHead(),
      L = vsTitleLines(h, vsDate(), sub),
      tot = sumAmt(rows);
    const minRows = 8;
    const padCount = Math.max(0, minRows - (rows.length || 1));
    const dataRowsHtml = rows.length
      ? rows
          .map(
            (r, i) =>
              `<tr><td class="cn">${i + 1}</td><td>${esc(r.name)}</td><td class="n">${fmtQ(
                r.qty
              )}</td><td class="cn">${esc(r.unit)}</td><td class="n">${fmtB(r.price)}</td><td class="n">${fmtB(
                r.amt
              )}</td><td>${esc(r.note)}</td></tr>`
          )
          .join('')
      : '<tr><td class="cn"></td><td class="cn">ไม่มีวัสดุคงเหลือ</td><td></td><td></td><td></td><td class="n">-</td><td></td></tr>';
    const blankRowsHtml = Array.from({ length: padCount })
      .map(() => '<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td class="n"></td><td></td></tr>')
      .join('');
    return `<div class="vsform">
      <p class="fm">${L.form}</p>
      <p class="ttl">${L.title}</p>
      <p class="c" style="margin-top:2px">${esc(L.date)}</p>
      ${sub ? `<p class="c" style="font-weight:600;margin-top:2px">${esc(sub)}</p>` : ''}
      <div class="vs-hd-lines">
        <div class="vs-hd-row">
          <span class="vs-hd-lbl">ชื่อหน่วยงาน</span>
          <span class="vs-hd-val">${esc(h.org || '')}</span>
        </div>
        <div class="vs-hd-row">
          <span class="vs-hd-lbl">อำเภอ</span>
          <span class="vs-hd-val">${esc(h.amp || '')}</span>
          <span class="vs-hd-lbl">จังหวัด</span>
          <span class="vs-hd-val">${esc(h.chw || '')}</span>
          <span class="vs-hd-lbl">รหัสไปรษณีย์</span>
          <span class="vs-hd-val" style="flex:0.55">${esc(h.zip || '')}</span>
        </div>
        <div class="vs-hd-row">
          <span class="vs-hd-lbl">ชื่อเจ้าหน้าที่ประสานงาน</span>
          <span class="vs-hd-val" style="flex:1.35">${esc(h.co || '')}</span>
          <span class="vs-hd-lbl">ตำแหน่ง</span>
          <span class="vs-hd-val">${esc(h.coPos || '')}</span>
        </div>
        <div class="vs-hd-row">
          <span class="vs-hd-lbl">โทรศัพท์</span>
          <span class="vs-hd-val">${esc(h.tel || '')}</span>
          <span class="vs-hd-lbl">โทรสาร</span>
          <span class="vs-hd-val">${esc(h.fax || '')}</span>
        </div>
      </div>
      <table class="vs-table">
        <thead>
          <tr>
            <th rowSpan="2" style="width:48px">ลำดับ</th>
            <th rowSpan="2">รายการ</th>
            <th rowSpan="2" style="width:74px">ปริมาณ</th>
            <th rowSpan="2" style="width:72px">หน่วยนับ</th>
            <th style="width:98px">ราคาต่อหน่วย</th>
            <th style="width:108px">จำนวนเงิน</th>
            <th rowSpan="2" style="width:120px">หมายเหตุ</th>
          </tr>
          <tr>
            <th>(บาท)</th>
            <th>(บาท)</th>
          </tr>
        </thead>
        <tbody>
          ${dataRowsHtml}
          ${blankRowsHtml}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan="5" style="text-align:right;padding-right:14px"><b>รวมทั้งสิ้น</b></td>
            <td class="n"><b>${rows.length ? fmtB(tot) : '-'}</b></td>
            <td class="vs-shade"></td>
          </tr>
        </tfoot>
      </table>
      <div class="vsig">${vsSigs(h)
        .map((s) => `<div>${s.map(esc).join('<br>')}</div>`)
        .join('')}</div>
    </div>`;
  }
  function vsSheet(rows: any[], sub: string) {
    const h = vsHead(),
      L = vsTitleLines(h, vsDate(), sub);
    const aoa: any[][] = [],
      mg: string[] = [];
    const M = (r: number, c1: number, c2: number) => mg.push(colName(c1) + (r + 1) + ':' + colName(c2) + (r + 1));
    const push = (row: any[], merge?: [number, number]) => {
      aoa.push(row);
      if (merge) M(aoa.length - 1, merge[0], merge[1]);
    };
    push([{ v: L.form, s: 'rightb' }, '', '', '', '', '', ''], [0, 6]);
    push([]);
    push([{ v: L.title, s: 'title' }], [0, 6]);
    push([{ v: L.date, s: 'center' }], [0, 6]);
    if (sub) push([{ v: sub, s: 'center' }], [0, 6]);
    push([]);
    [L.l1, L.l2, L.l3, L.l4].forEach((t) => push([{ v: t, s: 'left' }], [0, 6]));
    push([]);
    const h1 = aoa.length;
    aoa.push(['ลำดับ', 'รายการ', 'ปริมาณ', 'หน่วยนับ', 'ราคาต่อหน่วย', 'จำนวนเงิน', 'หมายเหตุ'].map((v) => ({ v, s: 'th' })));
    aoa.push(['', '', '', '', '(บาท)', '(บาท)', ''].map((v) => ({ v, s: 'th' })));
    [0, 1, 2, 3, 6].forEach((c) => mg.push(colName(c) + (h1 + 1) + ':' + colName(c) + (h1 + 2)));
    const first = aoa.length + 1;
    rows.forEach((r, i) => {
      const R = aoa.length + 1;
      aoa.push([
        { v: i + 1, s: 'tdc' },
        { v: r.name, s: 'td' },
        { v: r.qty, s: Number.isInteger(r.qty) ? 'qtyi' : 'num' },
        { v: r.unit, s: 'tdc' },
        { v: r.price, s: 'num' },
        { f: `C${R}*E${R}`, v: r2(r.qty * r.price), s: 'num' },
        { v: r.note, s: 'td' },
      ]);
    });
    const last = aoa.length;
    const totRowIdx = aoa.length;
    aoa.push([
      { v: 'รวมทั้งสิ้น', s: 'totl' },
      { v: '', s: 'tdb' },
      { v: '', s: 'tdb' },
      { v: '', s: 'tdb' },
      { v: '', s: 'tdb' },
      rows.length ? { f: `SUM(F${first}:F${last})`, v: sumAmt(rows), s: 'tot' } : { v: 0, s: 'tot' },
      { v: '', s: 'tdb' },
    ]);
    M(totRowIdx, 0, 4);
    aoa.push([]);
    aoa.push([]);
    const sg = vsSigs(h);
    [
      [0, 1],
      [2, 3],
    ].forEach(([a, b]) => {
      for (let k = 0; k < 4; k++) {
        const r = aoa.length;
        aoa.push([{ v: sg[a][k], s: 'center' }, '', '', '', { v: sg[b][k], s: 'center' }, '', '']);
        M(r, 0, 3);
        M(r, 4, 6);
      }
      aoa.push([]);
    });
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 6 }, { wch: 38 }, { wch: 9 }, { wch: 9 }, { wch: 12 }, { wch: 14 }, { wch: 20 }];
    ws['!merges'] = mg;
    ws['!page'] = { land: false, scale: 80 };
    ws['!titles'] = `$${h1 + 1}:$${h1 + 2}`;
    return ws;
  }
  function vsSave(fname: string, rows: any[], sub: string) {
    if (typeof XLSX === 'undefined') {
      toast('โหลดตัวสร้างไฟล์ Excel ไม่สำเร็จ');
      return;
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, vsSheet(rows, sub), 'แบบ อปท. วส.');
    saveFile(fname, XLSX.write(wb, { type: 'array', bookType: 'xlsx' }), 'ส่งออกไฟล์ Excel แล้ว');
  }
  const vsFy = () => fyOf(vsDate());
  $('vSelfXlsx')?.addEventListener('click', () =>
    vsSave(`อปท.วส_${divName()}_ปีงบ${vsFy()}.xlsx`, vsSelfItems(), 'ส่วนราชการ ' + divName())
  );
  $('vSelfPrint')?.addEventListener('click', () =>
    openPaper('แบบ อปท.-วส. ' + divName(), vsHtml(vsSelfItems(), 'ส่วนราชการ ' + divName()), false)
  );

  const GRP: Record<string, string> = { req: 'ผู้เบิก', purpose: 'เพื่อใช้ในงาน', cat: 'ประเภทวัสดุ' };
  function issueGroups(p: any) {
    const g = $('rGroup').value || 'req',
      map = new Map<string, any>();
    for (const [mid, rows] of L) {
      const m = matById(mid);
      if (!m) continue;
      for (const r of rows) {
        if (r.mv.kind !== 'out' || r.date < p.from || r.date > p.to) continue;
        const key =
          g === 'req'
            ? r.mv.requester || '(ไม่ระบุ)'
            : g === 'purpose'
            ? r.mv.purpose || '(ไม่ระบุ)'
            : m.cat || 'วัสดุอื่น';
        let G = map.get(key);
        if (!G) {
          G = {
            key,
            sub: new Set<string>(),
            slips: new Set<string>(),
            docNos: new Set<string>(),
            purposes: new Set<string>(),
            v: 0,
            items: new Map<string, any>(),
          };
          map.set(key, G);
        }
        if (g === 'req' && r.mv.reqPos) G.sub.add(r.mv.reqPos);
        if (r.mv.purpose) G.purposes.add(r.mv.purpose);
        if (r.mv.no) G.docNos.add(r.mv.no);
        G.slips.add(r.mv.id || r.mv.no);
        G.v = r2(G.v + r.outV);
        const it = G.items.get(mid) || { m, q: 0, v: 0 };
        it.q = r2(it.q + r.outQ);
        it.v = r2(it.v + r.outV);
        G.items.set(mid, it);
      }
    }
    return [...map.values()]
      .map((G) => ({
        ...G,
        sub: [...G.sub].join(', '),
        slips: G.slips.size,
        docNos: [...G.docNos],
        purposes: [...G.purposes],
        items: [...G.items.values()].sort((a, b) => b.v - a.v),
      }))
      .sort((a, b) => b.v - a.v);
  }

  function reportSignBlockHtml() {
    const staffName = settings.staff || settings.vsMk || settings.payer || '';
    const staffPos = settings.staff
      ? settings.staffPos || settings.vsMkPos || settings.payerPos || ''
      : settings.vsMkPos || settings.payerPos || settings.staffPos || '';
    const headName = settings.appr || settings.vsFin || settings.head || '';
    const headPos = settings.appr
      ? settings.apprPos || settings.vsFinPos || settings.headPos || ''
      : settings.vsFinPos || settings.headPos || settings.apprPos || defaultDivHeadPos();
    return `<div class="rp-sigs">
      <div class="rp-sig-col">
        <div>(ลงชื่อ) .................................................. ผู้จัดทำรายงาน</div>
        <div>(${staffName ? esc(staffName) : '..................................................'})</div>
        <div>ตำแหน่ง ${staffPos ? esc(staffPos) : '..................................................'}</div>
        <div>วันที่ ......../................/............</div>
      </div>
      <div class="rp-sig-col">
        <div>(ลงชื่อ) .................................................. ผู้ตรวจสอบ</div>
        <div>(${headName ? esc(headName) : '..................................................'})</div>
        <div>ตำแหน่ง ${headPos ? esc(headPos) : '..................................................'}</div>
        <div>วันที่ ......../................/............</div>
      </div>
    </div>`;
  }

  function summaryPaperHtml(p: any) {
    const rows = summaryRows(p);
    const T = rows.reduce(
      (t, r) => ({
        ov0: r2(t.ov0 + r.ov0),
        iv: r2(t.iv + r.iv),
        ov: r2(t.ov + r.ov),
        cv: r2(t.cv + r.cv),
      }),
      { ov0: 0, iv: 0, ov: 0, cv: 0 }
    );
    const govName = settings.org || '';
    const unitCtrl = [settings.work, settings.div].filter(Boolean).join(' ') || settings.div || '';
    const moveCount = rows.filter((r) => r.iq > 0 || r.oq > 0).length;

    return `<div class="rp-paper">
      <div class="rp-header">
        ${settings.logo ? `<img class="lg" src="${esc(settings.logo)}" alt="" style="width:1.8cm;height:1.8cm;margin-bottom:4px">` : ''}
        <p class="ttl" style="margin-bottom:4px">รายงานสรุปการรับ-จ่ายวัสดุ</p>
        <p class="c" style="font-weight:600">${esc(govName)}${unitCtrl ? ' · ' + esc(unitCtrl) : ''}</p>
        <p class="c">ประจำ${esc(p.label)}</p>
        <div class="rp-meta">
          <span><b>จำนวนรายการทั้งหมด:</b> ${rows.length} รายการ (มีการเคลื่อนไหว ${moveCount} รายการ)</span>
          <span><b>วิธีคำนวณต้นทุน:</b> เข้าก่อน-ออกก่อน (FIFO)</span>
          <span><b>วันที่พิมพ์รายงาน:</b> ${esc(thDateFull(todayISO()))}</span>
        </div>
      </div>

      <div class="rp-kpis">
        <div class="rp-kpi">
          <div class="rk-l">มูลค่ายอดยกมา</div>
          <div class="rk-v">${fmtB(T.ov0)} <small>บาท</small></div>
        </div>
        <div class="rp-kpi">
          <div class="rk-l">มูลค่ารับเข้าในช่วง</div>
          <div class="rk-v">${fmtB(T.iv)} <small>บาท</small></div>
        </div>
        <div class="rp-kpi">
          <div class="rk-l">มูลค่าเบิกจ่ายในช่วง</div>
          <div class="rk-v">${fmtB(T.ov)} <small>บาท</small></div>
        </div>
        <div class="rp-kpi">
          <div class="rk-l">มูลค่าคงเหลือสิ้นงวด</div>
          <div class="rk-v">${fmtB(T.cv)} <small>บาท</small></div>
        </div>
      </div>

      <table class="rp-table">
        <thead>
          <tr>
            <th rowSpan="2" style="width:42px">ลำดับ</th>
            <th rowSpan="2" style="width:76px">รหัส</th>
            <th rowSpan="2">รายการวัสดุ / ประเภท</th>
            <th rowSpan="2" style="width:62px">หน่วยนับ</th>
            <th colSpan="2">ยอดยกมา</th>
            <th colSpan="2">รับเข้า</th>
            <th colSpan="2">เบิกจ่าย</th>
            <th colSpan="2">คงเหลือสิ้นงวด</th>
            <th rowSpan="2" style="width:74px">สถานะ</th>
          </tr>
          <tr>
            <th style="width:64px">จำนวน</th>
            <th style="width:88px">มูลค่า</th>
            <th style="width:64px">จำนวน</th>
            <th style="width:88px">มูลค่า</th>
            <th style="width:64px">จำนวน</th>
            <th style="width:88px">มูลค่า</th>
            <th style="width:64px">จำนวน</th>
            <th style="width:92px">มูลค่า</th>
          </tr>
        </thead>
        <tbody>
          ${
            rows.length
              ? rows
                  .map((r, i) => {
                    const [, stLabel] = stockState(r.m, r.cq);
                    return `<tr>
                      <td class="c">${i + 1}</td>
                      <td class="c">${esc(r.m.code || '—')}</td>
                      <td><b>${esc(r.m.name)}</b>${
                        r.m.cat ? `<div class="rp-sub">${esc(r.m.cat)}</div>` : ''
                      }</td>
                      <td class="c">${esc(r.m.unit)}</td>
                      <td class="n">${fmtQ(r.oq0)}</td>
                      <td class="n">${fmtB(r.ov0)}</td>
                      <td class="n">${r.iq ? fmtQ(r.iq) : '—'}</td>
                      <td class="n">${r.iq ? fmtB(r.iv) : '—'}</td>
                      <td class="n">${r.oq ? fmtQ(r.oq) : '—'}</td>
                      <td class="n">${r.oq ? fmtB(r.ov) : '—'}</td>
                      <td class="n"><b>${fmtQ(r.cq)}</b></td>
                      <td class="n"><b>${fmtB(r.cv)}</b></td>
                      <td class="c">${esc(stLabel)}</td>
                    </tr>`;
                  })
                  .join('')
              : '<tr><td colspan="13" class="c">ไม่มีรายการวัสดุในช่วงเวลานี้</td></tr>'
          }
        </tbody>
        <tfoot>
          <tr>
            <td colspan="4" class="r"><b>รวมมูลค่าทั้งสิ้น (บาท)</b></td>
            <td></td>
            <td class="n"><b>${fmtB(T.ov0)}</b></td>
            <td></td>
            <td class="n"><b>${fmtB(T.iv)}</b></td>
            <td></td>
            <td class="n"><b>${fmtB(T.ov)}</b></td>
            <td></td>
            <td class="n"><b>${fmtB(T.cv)}</b></td>
            <td></td>
          </tr>
        </tfoot>
      </table>

      ${reportSignBlockHtml()}
    </div>`;
  }

  function issuePaperHtml(p: any) {
    const gs = issueGroups(p);
    const tot = r2(gs.reduce((t, g) => t + g.v, 0));
    const gl = GRP[$('rGroup').value || 'req'];
    const totalSlipsSet = new Set<string>();
    gs.forEach((g) => (g.docNos || []).forEach((d: string) => totalSlipsSet.add(d)));
    const totalSlips = totalSlipsSet.size || gs.reduce((t, g) => t + g.slips, 0);
    const totalItems = gs.reduce((t, g) => t + g.items.length, 0);
    const govName = settings.org || '';
    const unitCtrl = [settings.work, settings.div].filter(Boolean).join(' ') || settings.div || '';

    return `<div class="rp-paper">
      <div class="rp-header">
        ${settings.logo ? `<img class="lg" src="${esc(settings.logo)}" alt="" style="width:1.8cm;height:1.8cm;margin-bottom:4px">` : ''}
        <p class="ttl" style="margin-bottom:4px">รายงานสรุปการเบิกวัสดุ แยกตาม${esc(gl)}</p>
        <p class="c" style="font-weight:600">${esc(govName)}${unitCtrl ? ' · ' + esc(unitCtrl) : ''}</p>
        <p class="c">ประจำ${esc(p.label)}</p>
        <div class="rp-meta">
          <span><b>จัดกลุ่มตาม:</b> ${esc(gl)} (${gs.length} กลุ่ม)</span>
          <span><b>จำนวนใบเบิกทั้งหมด:</b> ${totalSlips} ใบ (${totalItems} รายการย่อย)</span>
          <span><b>วันที่พิมพ์รายงาน:</b> ${esc(thDateFull(todayISO()))}</span>
        </div>
      </div>

      <div class="rp-kpis rp-kpis-3">
        <div class="rp-kpi">
          <div class="rk-l">จำนวนกลุ่ม (${esc(gl)})</div>
          <div class="rk-v">${gs.length} <small>กลุ่ม</small></div>
        </div>
        <div class="rp-kpi">
          <div class="rk-l">จำนวนใบเบิกวัสดุรวม</div>
          <div class="rk-v">${totalSlips} <small>ใบ</small></div>
        </div>
        <div class="rp-kpi">
          <div class="rk-l">มูลค่าการเบิกรวมทั้งสิ้น</div>
          <div class="rk-v">${fmtB(tot)} <small>บาท</small></div>
        </div>
      </div>

      <table class="rp-table">
        <thead>
          <tr>
            <th style="width:48px">ลำดับ</th>
            <th>${esc(gl)} / รายการวัสดุที่เบิก</th>
            <th style="width:68px">หน่วยนับ</th>
            <th style="width:140px">ใบเบิก / เลขที่เอกสาร</th>
            <th style="width:84px">จำนวนที่เบิก</th>
            <th style="width:105px">มูลค่า (บาท)</th>
            <th style="width:68px">สัดส่วน</th>
            <th style="width:200px">วัตถุประสงค์ / รายละเอียดงาน</th>
          </tr>
        </thead>
        <tbody>
          ${
            gs.length
              ? gs
                  .map((g, gi) => {
                    const pct = tot ? ((g.v / tot) * 100).toFixed(1) : '0.0';
                    const docsStr = (g.docNos || []).slice(0, 6).join(', ') + ((g.docNos || []).length > 6 ? ' …' : '');
                    const purpStr = (g.purposes || []).slice(0, 3).join('; ') + ((g.purposes || []).length > 3 ? ' …' : '');
                    const grpRow = `<tr class="rp-grp-row">
                      <td class="c"><b>${gi + 1}</b></td>
                      <td><b>${esc(g.key)}</b>${g.sub ? `<div class="rp-sub">${esc(g.sub)}</div>` : ''}</td>
                      <td class="c">—</td>
                      <td class="c"><b>${g.slips} ใบ</b>${docsStr ? `<div class="rp-sub">${esc(docsStr)}</div>` : ''}</td>
                      <td class="n">—</td>
                      <td class="n"><b>${fmtB(g.v)}</b></td>
                      <td class="n"><b>${pct}%</b></td>
                      <td>${purpStr ? `<span class="rp-sub" style="color:#000">${esc(purpStr)}</span>` : '—'}</td>
                    </tr>`;
                    const itemRows = g.items
                      .map(
                        (it: any, ii: number) => `<tr>
                          <td class="c rp-sub">${gi + 1}.${ii + 1}</td>
                          <td style="padding-left:20px">${esc(it.m.name)}</td>
                          <td class="c">${esc(it.m.unit)}</td>
                          <td class="c"></td>
                          <td class="n">${fmtQ(it.q)}</td>
                          <td class="n">${fmtB(it.v)}</td>
                          <td class="n">${tot ? ((it.v / tot) * 100).toFixed(1) + '%' : '0.0%'}</td>
                          <td></td>
                        </tr>`
                      )
                      .join('');
                    return grpRow + itemRows;
                  })
                  .join('')
              : '<tr><td colspan="8" class="c">ไม่มีรายการเบิกวัสดุในช่วงเวลานี้</td></tr>'
          }
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3" class="r"><b>รวมมูลค่าการเบิกวัสดุทั้งสิ้น</b></td>
            <td class="c"><b>${totalSlips} ใบ</b></td>
            <td></td>
            <td class="n"><b>${fmtB(tot)}</b></td>
            <td class="n"><b>${gs.length ? '100.0%' : '0.0%'}</b></td>
            <td></td>
          </tr>
        </tfoot>
      </table>

      ${reportSignBlockHtml()}
    </div>`;
  }
  function renderIssueReport(p: any, box: HTMLElement) {
    const gs = issueGroups(p),
      tot = r2(gs.reduce((t, g) => t + g.v, 0)),
      mx = Math.max(1, ...gs.map((g) => g.v)),
      gl = GRP[$('rGroup').value || 'req'];
    box.innerHTML = `<div class="rephead"><h3>รายงานสรุปการเบิกวัสดุ แยกตาม${gl}</h3><div class="sub">${esc(
      p.label
    )} · ${gs.length} กลุ่ม · มูลค่าการเบิกรวม ${fmtB(tot)} บาท</div></div>
  <div class="tablebox"><table><thead><tr><th>${gl} / รายการวัสดุ</th><th>หน่วย</th><th class="num">ใบเบิก</th><th class="num">จำนวน</th><th class="num">มูลค่า (บาท)</th><th class="num">สัดส่วน</th></tr></thead>
  <tbody>${
    gs
      .map(
        (g) =>
          `<tr class="rg"><td>${esc(g.key)}${
            g.sub ? ` <span class="sub">· ${esc(g.sub)}</span>` : ''
          }</td><td></td><td class="num">${g.slips}</td><td></td><td class="num">${fmtB(g.v)}</td><td class="num">${
            tot ? ((g.v / tot) * 100).toFixed(1) : '0.0'
          }%<span class="bar" style="width:${Math.round((g.v / mx) * 60)}px"></span></td></tr>` +
          g.items
            .map(
              (it: any) =>
                `<tr><td class="ind">${esc(it.m.name)}</td><td>${esc(
                  it.m.unit
                )}</td><td></td><td class="num">${fmtQ(it.q)}</td><td class="num">${fmtB(it.v)}</td><td></td></tr>`
            )
            .join('')
      )
      .join('') || '<tr><td colspan="6" class="sub">ไม่มีการเบิกในช่วงนี้</td></tr>'
  }</tbody>
  <tfoot><tr><td colspan="4">รวมมูลค่าการเบิก (บาท)</td><td class="num">${fmtB(tot)}</td><td></td></tr></tfoot></table></div>`;
  }
  function issueXlsx(p: any, wb: any) {
    const gs = issueGroups(p),
      gl = GRP[$('rGroup').value || 'req'];
    const aoa: any[][] = [
      ['รายงานสรุปการเบิกวัสดุ แยกตาม' + gl + ' ' + fullOrg()],
      [p.label],
      [],
      [gl, 'ตำแหน่ง/รายละเอียด', 'รายการวัสดุ', 'หน่วย', 'จำนวน', 'มูลค่า (บาท)', 'ใบเบิก (ใบ)'],
    ];
    gs.forEach((g) => {
      aoa.push([g.key, g.sub, 'รวม', '', '', g.v, g.slips]);
      g.items.forEach((it: any) => aoa.push(['', '', it.m.name, it.m.unit, it.q, it.v, '']));
    });
    aoa.push([], ['รวมทั้งสิ้น', '', '', '', '', r2(gs.reduce((t, g) => t + g.v, 0)), '']);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 30 }, { wch: 24 }, { wch: 36 }, { wch: 9 }, { wch: 11 }, { wch: 15 }, { wch: 11 }];
    XLSX.utils.book_append_sheet(wb, ws, 'สรุปการเบิก');
    return 'สรุปการเบิกวัสดุ_แยก' + gl + '_' + p.label.split(' (')[0].replace(/\s+/g, '') + '.xlsx';
  }

  function setRepSeg() {
    document
      .querySelectorAll('[data-rk]')
      .forEach((b: any) => b.setAttribute('aria-pressed', String(b.dataset.rk === repKind)));
    const c = repKind === 'card',
      v = repKind === 'vs';
    $('rMat').hidden = !c;
    $('rMatLbl').hidden = !c;
    if ($('rSheetFmt')) $('rSheetFmt').hidden = !c;
    if ($('rSheetFmtLbl')) $('rSheetFmtLbl').hidden = !c;
    if ($('cardGuideBox')) $('cardGuideBox').hidden = !c;
    $('rMonth').hidden = c || v;
    $('rMonthLbl').hidden = c || v;
    $('view-report').classList.toggle('vsmode', v);
    $('vsPanel').hidden = !v;
    $('rep').hidden = v;
    const q = repKind === 'req';
    $('rGroup').hidden = !q;
    $('rGroupLbl').hidden = !q;
  }
  document.querySelectorAll('[data-rk]').forEach((b: any) =>
    b.addEventListener('click', () => {
      repKind = b.dataset.rk;
      setRepSeg();
      renderReport();
    })
  );
  ['rFy', 'rMonth', 'rMat', 'rGroup', 'rSheetFmt'].forEach((id) => $(id)?.addEventListener('change', renderReport));
  function period() {
    const fy = +$('rFy').value || CUR_FY,
      [s, e] = fyRange(fy),
      mv = $('rMonth').value;
    if (repKind === 'card' || !mv || mv === 'all')
      return { fy, from: s, to: e, label: 'ปีงบประมาณ ' + fy + ' (1 ต.ค. ' + (fy - 1) + ' – 30 ก.ย. ' + fy + ')' };
    const [y, m] = mv.split('-').map(Number),
      last = new Date(y, m, 0).getDate();
    return { fy, from: mv + '-01', to: mv + '-' + pad2(last), label: 'เดือน' + TH_MF[m - 1] + ' ' + (y + 543) };
  }
  function fillRepSelects() {
    const fy = +$('rFy').value || CUR_FY,
      mv = $('rMonth').value;
    const months: Array<[string, string]> = [10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((m) => {
      const y = m >= 10 ? fy - 544 : fy - 543;
      return [y + '-' + pad2(m), TH_MF[m - 1] + ' ' + (y + 543)];
    });
    fillSelect($('rMonth'), [['all', 'ทั้งปีงบประมาณ'], ...months]);
    $('rMonth').value = [...$('rMonth').options].some((o: any) => o.value === mv) ? mv : 'all';
    const mm = $('rMat').value;
    fillSelect($('rMat'), [
      ['all', 'ทุกรายการ (พิมพ์/ส่งออกครบทุกแผ่น)'],
      ...materials
        .slice()
        .sort(matSort)
        .map((m): [string, string] => [m.id, matLabel(m)]),
    ]);
    $('rMat').value = [...$('rMat').options].some((o: any) => o.value === mm)
      ? mm
      : materials.length
      ? materials.slice().sort(matSort)[0].id
      : 'all';
  }
  function summaryRows(p: any) {
    return materials
      .slice()
      .sort(matSort)
      .map((m) => {
        const o = stateBefore(m.id, p.from),
          c = stateUpto(m.id, p.to);
        let iq = 0,
          iv = 0,
          oq = 0,
          ov = 0;
        let bq = o.q,
          bv = o.v;
        (L.get(m.id) || []).forEach((r) => {
          if (r.date >= p.from && r.date <= p.to) {
            if (r.mv.src === 'opening') {
              bq += r.inQ;
              bv += r.inV;
            } else {
              iq += r.inQ;
              iv += r.inV;
            }
            oq += r.outQ;
            ov += r.outV;
          }
        });
        return { m, oq0: bq, ov0: r2(bv), iq, iv, oq, ov, cq: c.q, cv: c.v };
      });
  }

  /* Official Document Numbering per Instruction (8): ร.1, ร.2... for receiving and จ.1, จ.2... for issuing, resetting each fiscal year */
  function officialDocNo(mv: any) {
    if (!mv) return '';
    const raw = String(mv.no || '').trim();
    if (/^(ร\.|จ\.)/.test(raw)) return raw;
    const pfx = mv.kind === 'in' ? 'ร.' : 'จ.';
    if (+mv.seq > 0) return pfx + +mv.seq;
    const match = raw.match(/^0*(\d+)/);
    if (match && +match[1] > 0) return pfx + +match[1];
    const fy = +(mv.fy || fyOf(mv.date)) || CUR_FY;
    const sameFy = moves
      .filter((x) => x.kind === mv.kind && (+(x.fy || fyOf(x.date)) || CUR_FY) === fy)
      .sort(mvSort);
    const idx = sameFy.findIndex((x) => x.id === mv.id);
    return pfx + (idx >= 0 ? idx + 1 : 1);
  }

  /* Official Sheet Number Prefix per Instruction (1): 001 (ชนิด) or 01/001 (ประเภท/ชนิด) */
  function getSheetBaseNo(m: any) {
    const fmt = $('rSheetFmt')?.value || 'seq';
    const sortedMats = materials.slice().sort(matSort);
    if (fmt === 'cat') {
      const cats = allCats();
      const catName = m.cat || 'วัสดุอื่น';
      const catIdx = Math.max(1, cats.indexOf(catName) + 1);
      const inCat = sortedMats.filter((x) => (x.cat || 'วัสดุอื่น') === catName);
      const itemIdx = Math.max(1, inCat.findIndex((x) => x.id === m.id) + 1);
      return String(catIdx).padStart(2, '0') + '/' + String(itemIdx).padStart(3, '0');
    }
    const itemIdx = Math.max(1, sortedMats.findIndex((x) => x.id === m.id) + 1);
    return String(itemIdx).padStart(3, '0');
  }

  function cardRows(mid: string, p: any) {
    let o = stateBefore(mid, p.from);
    const inP = (L.get(mid) || []).filter((r) => r.date >= p.from && r.date <= p.to);
    while (inP.length && inP[0].mv.src === 'opening') {
      const r = inP.shift()!;
      o = { q: r.balQ, v: r.balV, lots: r.lots };
    }
    const rows: any[] = [];
    inP.forEach((r) => {
      const mv = r.mv;
      const inNoteParts = [
        mv.poNo ? 'ใบสั่งซื้อ/สัญญา ' + mv.poNo : '',
        mv.invoiceNo ? 'ใบส่งของ ' + mv.invoiceNo : '',
        mv.note || '',
      ].filter(Boolean);
      const outNoteParts = [mv.purpose || '', mv.note || ''].filter(Boolean);
      const base = {
        date: r.date,
        kind: mv.kind,
        party:
          mv.kind === 'in'
            ? mv.src === 'opening'
              ? 'ยอดยกมา' + (mv.vendor ? ' (' + mv.vendor + ')' : '')
              : mv.vendor || SRC[mv.src] || ''
            : mv.requester || '',
        doc: officialDocNo(mv),
        note: mv.kind === 'out' ? outNoteParts.join(' · ') : inNoteParts.join(' · '),
      };
      if (mv.kind === 'out' && r.parts && r.parts.length)
        r.parts.forEach((pt: any, k: number) =>
          rows.push({
            ...base,
            cont: k > 0,
            price: pt.price,
            inQ: 0,
            outQ: pt.q,
            balQ: pt.balQ,
            inV: 0,
            outV: pt.v,
            balV: pt.balV,
            note: k
              ? 'ตัดจากกองราคา ' + fmtB(pt.price)
              : r.parts.length > 1
              ? base.note + (base.note ? ' · ' : '') + 'ตัดหลายราคา (FIFO)'
              : base.note,
          })
        );
      else
        rows.push({
          ...base,
          price: r.price,
          inQ: r.inQ,
          outQ: r.outQ,
          balQ: r.balQ,
          inV: r.inV,
          outV: r.outV,
          balV: r.balV,
        });
    });
    return { open: o, openG: priceGroups(o.lots), rows };
  }

  function buildMaterialCardTableRows(c: any, p: any) {
    const all: any[] = [];
    let cq = 0;
    const openLots = c.openG.length ? c.openG : [{ price: 0, q: 0, v: 0 }];
    openLots.forEach((g: any, k: number) => {
      cq = r2(cq + g.q);
      all.push({
        isOpen: true,
        date: k ? '' : thDate(p.from),
        party: k ? '' : 'ยอดยกมา',
        doc: '',
        price: g.q > 0 ? fmtB(g.price) : '',
        inQ: g.q > 0 ? fmtQ(g.q) : '',
        outQ: '',
        balQ: fmtQ(cq),
        note: c.openG.length > 1 ? 'กองราคา ' + fmtB(g.price) : '',
      });
    });
    c.rows.forEach((r: any) => {
      all.push({
        isOpen: false,
        kind: r.kind,
        date: r.cont ? '' : thDate(r.date),
        party: r.cont ? '' : r.party,
        doc: r.cont ? '' : r.doc,
        price: fmtB(r.price),
        inQ: r.inQ ? fmtQ(r.inQ) : '',
        outQ: r.outQ ? fmtQ(r.outQ) : '',
        balQ: fmtQ(r.balQ),
        note: r.note || '',
      });
    });
    return all;
  }

  function renderOfficialLedgerSheetHtml(m: any, pageRows: any[], sheetNo: string, minRows: number) {
    const govName = settings.org || '';
    const unitCtrl = [settings.work, settings.div].filter(Boolean).join(' ') || settings.div || '';
    const maxTxt = m.max != null ? fmtQ(m.max) + (m.unit ? ' ' + m.unit : '') : '';
    const minTxt = m.min != null ? fmtQ(m.min) + (m.unit ? ' ' + m.unit : '') : '';
    const padCount = Math.max(0, minRows - pageRows.length);
    const blankRows = Array.from({ length: padCount })
      .map(
        () =>
          `<tr class="ls-blank-row"><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`
      )
      .join('');

    return `<div class="ledger-sheet">
      <div class="ls-title">บัญชีวัสดุ</div>
      <div class="ls-head-grid">
        <div class="ls-col-left">
          <div class="ls-field-row">
            <span class="ls-lbl">แผ่นที่</span>
            <span class="ls-val ls-center" style="max-width:220px">${esc(sheetNo)}</span>
          </div>
          <div class="ls-field-row">
            <span class="ls-lbl">ประเภท</span>
            <span class="ls-val" style="flex:0.9">${esc(m.cat || '')}</span>
            <span class="ls-lbl">ชื่อหรือชนิดวัสดุ</span>
            <span class="ls-val" style="flex:1.3">${esc(m.name || '')}</span>
          </div>
          <div class="ls-field-row">
            <span class="ls-lbl">ขนาดหรือลักษณะ</span>
            <span class="ls-val">${esc(m.note || '')}</span>
          </div>
          <div class="ls-field-row">
            <span class="ls-lbl">หน่วยที่นับ</span>
            <span class="ls-val ls-center" style="flex:0.65">${esc(m.unit || '')}</span>
            <span class="ls-lbl">ที่เก็บ</span>
            <span class="ls-val" style="flex:1.35">${esc(m.loc || '')}</span>
          </div>
        </div>
        <div class="ls-col-right">
          <div class="ls-field-row">
            <span class="ls-lbl">ส่วนราชการ</span>
            <span class="ls-val">${esc(govName)}</span>
          </div>
          <div class="ls-field-row">
            <span class="ls-lbl">หน่วยงาน</span>
            <span class="ls-val">${esc(unitCtrl)}</span>
          </div>
          <div class="ls-field-row">
            <span class="ls-lbl">รหัส</span>
            <span class="ls-val ls-center">${esc(m.code || '')}</span>
          </div>
          <div class="ls-field-row">
            <span class="ls-lbl">จำนวนอย่างสูง</span>
            <span class="ls-val ls-center">${esc(maxTxt)}</span>
          </div>
          <div class="ls-field-row">
            <span class="ls-lbl">จำนวนอย่างต่ำ</span>
            <span class="ls-val ls-center">${esc(minTxt)}</span>
          </div>
        </div>
      </div>
      <table class="ls-table">
        <thead>
          <tr>
            <th rowSpan="2" style="width:11%">วัน เดือน ปี</th>
            <th rowSpan="2" style="width:25%">รับจาก/จ่ายให้</th>
            <th rowSpan="2" style="width:10%">เลขที่เอกสาร</th>
            <th rowSpan="2" style="width:11%">ราคาต่อหน่วย<br><span style="font-weight:600;font-size:0.92em">บาท</span></th>
            <th colSpan="3" style="width:24%">จำนวน</th>
            <th rowSpan="2" style="width:19%">หมายเหตุ</th>
          </tr>
          <tr>
            <th style="width:8%">รับ</th>
            <th style="width:8%">จ่าย</th>
            <th style="width:8%">คงเหลือ</th>
          </tr>
        </thead>
        <tbody>
          ${pageRows
            .map(
              (r) =>
                `<tr class="${r.isOpen ? 'open' : r.kind === 'out' ? 'ls-out-row' : 'ls-in-row'}">
                  <td class="ls-c" style="white-space:nowrap">${esc(r.date)}</td>
                  <td>${esc(r.party)}</td>
                  <td class="ls-c ls-doc ${r.kind === 'out' ? 'doc-out' : r.kind === 'in' ? 'doc-in' : ''}">${esc(
                    r.doc
                  )}</td>
                  <td class="ls-n">${esc(r.price)}</td>
                  <td class="ls-n">${esc(r.inQ)}</td>
                  <td class="ls-n">${esc(r.outQ)}</td>
                  <td class="ls-n"><b>${esc(r.balQ)}</b></td>
                  <td>${esc(r.note)}</td>
                </tr>`
            )
            .join('')}
          ${blankRows}
        </tbody>
      </table>
    </div>`;
  }

  function cardPaperHtml(ids: string[], p: any, rowsPerPage = 10) {
    const sheets: string[] = [];
    ids.forEach((id) => {
      const m = matById(id);
      if (!m) return;
      const c = cardRows(id, p);
      const allRows = buildMaterialCardTableRows(c, p);
      const baseNo = getSheetBaseNo(m);
      const totalPages = Math.max(1, Math.ceil(allRows.length / rowsPerPage));
      for (let pg = 0; pg < totalPages; pg++) {
        const chunk = allRows.slice(pg * rowsPerPage, (pg + 1) * rowsPerPage);
        const sheetNo = `${baseNo}/${pg + 1}`;
        sheets.push(renderOfficialLedgerSheetHtml(m, chunk, sheetNo, rowsPerPage));
      }
    });
    return sheets.join('');
  }

  function renderReport() {
    fillRepSelects();
    setRepSeg();
    if (repKind === 'vs') {
      renderVs();
      return;
    }
    const p = period(),
      box = $('rep');
    if (repKind === 'req') {
      if (!materials.length) {
        box.innerHTML = '<div class="tablebox"><div class="empty"><b>ยังไม่มีข้อมูลสำหรับรายงาน</b></div></div>';
        return;
      }
      renderIssueReport(p, box);
      return;
    }
    if (!materials.length) {
      box.innerHTML =
        '<div class="tablebox"><div class="empty"><b>ยังไม่มีข้อมูลสำหรับรายงาน</b>เพิ่มวัสดุในทะเบียนและบันทึกรับ-จ่ายก่อน</div></div>';
      return;
    }
    if (repKind === 'sum') {
      const rows = summaryRows(p),
        T = rows.reduce(
          (t, r) => ({ ov0: t.ov0 + r.ov0, iv: t.iv + r.iv, ov: t.ov + r.ov, cv: t.cv + r.cv }),
          { ov0: 0, iv: 0, ov: 0, cv: 0 }
        );
      box.innerHTML = `<div class="rephead"><h3>รายงานสรุปการรับ-จ่ายวัสดุ</h3><div class="sub">${esc(
        p.label
      )}</div></div>
    <div class="tablebox"><table><thead><tr class="grp"><th colspan="2"></th><th colspan="2">ยกมา</th><th colspan="2">รับ</th><th colspan="2">จ่าย</th><th colspan="2">คงเหลือ</th></tr>
    <tr><th>รายการ</th><th>หน่วย</th>${'<th class="num">จำนวน</th><th class="num">มูลค่า</th>'.repeat(4)}</tr></thead>
    <tbody>${rows
      .map(
        (r) => `<tr><td>${esc(r.m.name)}</td><td>${esc(r.m.unit)}</td>
      <td class="num">${fmtQ(r.oq0)}</td><td class="num">${fmtB(r.ov0)}</td><td class="num in">${
          r.iq ? fmtQ(r.iq) : '—'
        }</td><td class="num">${r.iq ? fmtB(r.iv) : '—'}</td>
      <td class="num out">${r.oq ? fmtQ(r.oq) : '—'}</td><td class="num">${
          r.oq ? fmtB(r.ov) : '—'
        }</td><td class="num"><b>${fmtQ(r.cq)}</b></td><td class="num">${fmtB(r.cv)}</td></tr>`
      )
      .join('')}</tbody>
    <tfoot><tr><td colspan="2">รวมมูลค่า (บาท)</td><td></td><td class="num">${fmtB(
      T.ov0
    )}</td><td></td><td class="num">${fmtB(T.iv)}</td><td></td><td class="num">${fmtB(
        T.ov
      )}</td><td></td><td class="num">${fmtB(T.cv)}</td></tr></tfoot></table></div>`;
    } else {
      const mid = $('rMat').value;
      const ids =
        mid === 'all'
          ? materials
              .slice()
              .sort(matSort)
              .map((m) => m.id)
          : [mid];
      box.innerHTML = `<div class="official-ledger-preview">${cardPaperHtml(ids, p, 10)}</div>`;
    }
  }
  $('btnXlsx')?.addEventListener('click', () => {
    if (typeof XLSX === 'undefined') {
      toast('โหลดตัวสร้างไฟล์ Excel ไม่สำเร็จ');
      return;
    }
    if (!materials.length) {
      toast('ยังไม่มีข้อมูลให้ส่งออก');
      return;
    }
    const p = period(),
      wb = XLSX.utils.book_new();
    let fname: string;
    if (repKind === 'vs') {
      vsSave(`อปท.วส_${divName()}_ปีงบ${vsFy()}.xlsx`, vsSelfItems(), 'ส่วนราชการ ' + divName());
      return;
    }
    if (repKind === 'req') {
      fname = issueXlsx(p, wb);
      saveFile(fname, XLSX.write(wb, { type: 'array', bookType: 'xlsx' }), 'ส่งออกไฟล์ Excel แล้ว');
      return;
    }
    if (repKind === 'sum') {
      const aoa: any[][] = [
        ['รายงานสรุปการรับ-จ่ายวัสดุ ' + fullOrg()],
        [p.label],
        [],
        [
          'รายการ',
          'หน่วย',
          'ยกมา (จำนวน)',
          'ยกมา (มูลค่า)',
          'รับ (จำนวน)',
          'รับ (มูลค่า)',
          'จ่าย (จำนวน)',
          'จ่าย (มูลค่า)',
          'คงเหลือ (จำนวน)',
          'คงเหลือ (มูลค่า)',
        ],
      ];
      const rows = summaryRows(p);
      rows.forEach((r) =>
        aoa.push([r.m.name, r.m.unit, r.oq0, r2(r.ov0), r.iq, r2(r.iv), r.oq, r2(r.ov), r.cq, r2(r.cv)])
      );
      aoa.push([
        'รวมมูลค่า',
        '',
        '',
        r2(rows.reduce((s, r) => s + r.ov0, 0)),
        '',
        r2(rows.reduce((s, r) => s + r.iv, 0)),
        '',
        r2(rows.reduce((s, r) => s + r.ov, 0)),
        '',
        r2(rows.reduce((s, r) => s + r.cv, 0)),
      ]);
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = [{ wch: 34 }, { wch: 8 }, ...Array(8).fill({ wch: 13 })];
      XLSX.utils.book_append_sheet(wb, ws, 'สรุปรับจ่าย');
      fname = 'สรุปรับจ่ายวัสดุ_' + ($('rMonth').value === 'all' ? 'ปีงบ' + p.fy : $('rMonth').value) + '.xlsx';
    } else {
      const mid = $('rMat').value,
        ids =
          mid === 'all'
            ? materials
                .slice()
                .sort(matSort)
                .map((m) => m.id)
            : [mid],
        used = new Set<string>();
      const govName = settings.org || '';
      const unitCtrl = [settings.work, settings.div].filter(Boolean).join(' ') || settings.div || '';
      ids.forEach((id) => {
        const m = matById(id),
          c = cardRows(id, p),
          sheetNo = getSheetBaseNo(m) + '/1';
        const aoa: any[][] = [
          ['', '', '', 'บัญชีวัสดุ', '', '', '', ''],
          ['', '', '', '', '', 'ส่วนราชการ', govName, ''],
          ['แผ่นที่', sheetNo, '', '', '', 'หน่วยงาน', unitCtrl, ''],
          ['ประเภท', m.cat || '-', 'ชื่อหรือชนิดวัสดุ', matLabel(m), '', 'รหัส', m.code || '-', ''],
          ['ขนาดหรือลักษณะ', m.note || '-', '', '', '', 'จำนวนอย่างสูง', m.max != null ? fmtQ(m.max) + ' ' + (m.unit || '') : '-', ''],
          ['หน่วยที่นับ', m.unit || '-', 'ที่เก็บ', m.loc || '-', '', 'จำนวนอย่างต่ำ', m.min != null ? fmtQ(m.min) + ' ' + (m.unit || '') : '-', ''],
          [],
          [
            'วัน เดือน ปี',
            'รับจาก/จ่ายให้',
            'เลขที่เอกสาร',
            'ราคาต่อหน่วย (บาท)',
            'จำนวนรับ',
            'จำนวนจ่าย',
            'จำนวนคงเหลือ',
            'หมายเหตุ',
          ],
          ...(() => {
            let cq = 0;
            return (c.openG.length ? c.openG : [{ price: 0, q: 0, v: 0 }]).map((g: any, k: number) => {
              cq = r2(cq + g.q);
              return [
                k ? '' : thDate(p.from),
                k ? '' : 'ยอดยกมา',
                '',
                g.q > 0 ? g.price : '',
                g.q || '',
                '',
                cq,
                c.openG.length > 1 ? 'กองราคา ' + fmtB(g.price) : '',
              ];
            });
          })(),
        ];
        c.rows.forEach((r) =>
          aoa.push([
            r.cont ? '' : thDate(r.date),
            r.cont ? '' : r.party,
            r.cont ? '' : r.doc,
            r2(r.price),
            r.inQ || '',
            r.outQ || '',
            r.balQ,
            r.note,
          ])
        );
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        ws['!cols'] = [
          { wch: 13 },
          { wch: 28 },
          { wch: 13 },
          { wch: 15 },
          { wch: 12 },
          { wch: 12 },
          { wch: 13 },
          { wch: 28 },
        ];
        const nm = m.name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 28);
        let k = nm,
          i = 2;
        while (used.has(k)) k = nm.slice(0, 26) + '_' + i++;
        used.add(k);
        XLSX.utils.book_append_sheet(wb, ws, k);
      });
      fname =
        'บัญชีวัสดุ_ปีงบ' +
        p.fy +
        (mid === 'all' ? '_ทุกรายการ' : '_' + matById(mid).name.replace(/[\\/:*?"<>|]/g, '-')) +
        '.xlsx';
    }
    saveFile(fname, XLSX.write(wb, { type: 'array', bookType: 'xlsx' }), 'ส่งออกไฟล์ Excel แล้ว');
  });

  const POS: Record<string, string[]> = {
    gApprPos: [
      'ผู้อำนวยการกองคลัง',
      'ผู้อำนวยการกองช่าง',
      'ผู้อำนวยการกองสวัสดิการสังคม',
      'หัวหน้าสำนักปลัด',
      'ผู้อำนวยการกองการศึกษา ศาสนาและวัฒนธรรม',
      'ผู้อำนวยการกองสาธารณสุขและสิ่งแวดล้อม',
      'ปลัดองค์การบริหารส่วนตำบล',
      'รองปลัดองค์การบริหารส่วนตำบล',
      'นายกองค์การบริหารส่วนตำบล',
      'รองนายกองค์การบริหารส่วนตำบล',
      'หัวหน้าเจ้าหน้าที่',
    ],
  };
  const OTHER = '__other';
  Object.keys(POS).forEach((id) => {
    fillSelect($(id), [
      ['', '— ไม่ระบุ —'],
      ...POS[id].map((p): [string, string] => [p, p]),
      [OTHER, 'อื่น ๆ (กรอกเอง)'],
    ]);
    $(id)?.addEventListener('change', () => {
      const o = $(id).value === OTHER;
      $(id + 'X').hidden = !o;
      if (o) $(id + 'X').focus();
    });
  });
  function posSet(id: string, v: string) {
    v = v || '';
    const known = v === '' || POS[id].includes(v);
    $(id).value = known ? v : OTHER;
    $(id + 'X').value = known ? '' : v;
    $(id + 'X').hidden = known;
  }
  function posGet(id: string) {
    return $(id).value === OTHER ? $(id + 'X').value.trim() : $(id).value;
  }
  let lastDivForSync = '';
  $('gDiv')?.addEventListener('input', () => {
    const newDiv = $('gDiv').value.trim();
    const curPos = posGet('gApprPos');
    const prevDef = defaultDivHeadPos(lastDivForSync);
    if (!curPos || curPos === prevDef || curPos === 'ผู้อำนวยการกอง') {
      posSet('gApprPos', defaultDivHeadPos(newDiv));
    }
    lastDivForSync = newDiv;
  });
  function renderSet() {
    const s = settings;
    const vs = s.vs || {};
    const op = orgParts();
    $('gDiv').value = s.div || '';
    lastDivForSync = s.div || '';
    $('gWork').value = s.work || '';
    $('gOrg').value = s.org || '';
    if ($('gAmp')) $('gAmp').value = s.amp || vs.amp || op.amp || '';
    if ($('gChw')) $('gChw').value = s.chw || vs.chw || op.chw || '';
    if ($('gZip')) $('gZip').value = s.zip || vs.zip || '';
    if ($('gCo')) $('gCo').value = s.co || vs.co || '';
    if ($('gCoPos')) $('gCoPos').value = s.coPos || vs.coPos || '';
    if ($('gTel')) $('gTel').value = s.tel || vs.tel || '';
    if ($('gFax')) $('gFax').value = s.fax || vs.fax || '';
    $('gAppr').value = s.appr || s.vsFin || vs.fin || s.head || '';
    posSet('gApprPos', s.apprPos || s.vsFinPos || s.headPos || defaultDivHeadPos(s.div));
    $('gStaff').value = s.staff || s.payer || s.vsMk || vs.mk || '';
    $('gStaffPos').value = s.staffPos || s.payerPos || s.vsMkPos || vs.mkPos || '';
    if ($('gVsMk')) $('gVsMk').value = s.vsMk || vs.mk || '';
    if ($('gVsMkPos')) $('gVsMkPos').value = s.vsMkPos || vs.mkPos || '';
    if ($('gVsFin')) $('gVsFin').value = s.vsFin || vs.fin || '';
    if ($('gVsFinPos')) {
      const legacyFinPos =
        vs.finPos === 'ผู้อำนวยการกองคลัง' && String(s.div || '').trim() !== 'กองคลัง' ? '' : vs.finPos;
      $('gVsFinPos').value = s.vsFinPos || legacyFinPos || '';
    }
    if ($('gVsPal')) $('gVsPal').value = s.vsPal || vs.pal || '';
    if ($('gVsPalPos')) $('gVsPalPos').value = s.vsPalPos || vs.palPos || '';
    if ($('gVsExe')) $('gVsExe').value = s.vsExe || vs.exe || '';
    if ($('gVsExePos')) $('gVsExePos').value = s.vsExePos || vs.exePos || '';
    $('gSigs').innerHTML = SIGS.map(
      ([k, l]) => `<label><input type="checkbox" data-gsig="${k}"${sigOn(k) ? ' checked' : ''}> ${l}</label>`
    ).join('');
  }
  $('setForm')?.addEventListener('submit', async (e: Event) => {
    e.preventDefault();
    if (!db) return msg('gMsg', 'เบราว์เซอร์นี้บันทึกข้อมูลไม่ได้', 1);
    const orgVal = $('gOrg').value.trim() || DEF_SET.org;
    const ampVal = $('gAmp')?.value.trim() || '';
    const chwVal = $('gChw')?.value.trim() || '';
    const zipVal = $('gZip')?.value.trim() || '';
    const coVal = $('gCo')?.value.trim() || '';
    const coPosVal = $('gCoPos')?.value.trim() || '';
    const telVal = $('gTel')?.value.trim() || '';
    const faxVal = $('gFax')?.value.trim() || '';
    const apprVal = $('gAppr').value.trim();
    const apprPosVal = posGet('gApprPos');
    const staffVal = $('gStaff').value.trim();
    const staffPosVal = $('gStaffPos').value.trim();
    const vsMkVal = $('gVsMk')?.value.trim() || '';
    const vsMkPosVal = $('gVsMkPos')?.value.trim() || '';
    const vsFinVal = $('gVsFin')?.value.trim() || '';
    const vsFinPosVal = $('gVsFinPos')?.value.trim() || '';
    const vsPalVal = $('gVsPal')?.value.trim() || '';
    const vsPalPosVal = $('gVsPalPos')?.value.trim() || '';
    const vsExeVal = $('gVsExe')?.value.trim() || '';
    const vsExePosVal = $('gVsExePos')?.value.trim() || '';
    const body = {
      logo: settings.logo || '',
      theme: '',
      div: $('gDiv').value.trim(),
      work: $('gWork').value.trim(),
      org: orgVal,
      amp: ampVal,
      chw: chwVal,
      zip: zipVal,
      co: coVal,
      coPos: coPosVal,
      tel: telVal,
      fax: faxVal,
      appr: apprVal,
      apprPos: apprPosVal,
      payer: staffVal,
      payerPos: staffPosVal,
      staff: staffVal,
      staffPos: staffPosVal,
      head: apprVal,
      headPos: apprPosVal,
      vsMk: vsMkVal,
      vsMkPos: vsMkPosVal,
      vsFin: vsFinVal,
      vsFinPos: vsFinPosVal,
      vsPal: vsPalVal,
      vsPalPos: vsPalPosVal,
      vsExe: vsExeVal,
      vsExePos: vsExePosVal,
      vs: {
        org: orgVal === DEF_SET.org ? '' : orgVal,
        amp: ampVal,
        chw: chwVal,
        zip: zipVal,
        co: coVal,
        coPos: coPosVal,
        tel: telVal,
        fax: faxVal,
        mk: vsMkVal,
        mkPos: vsMkPosVal,
        fin: vsFinVal,
        finPos: vsFinPosVal,
        pal: vsPalVal,
        palPos: vsPalPosVal,
        exe: vsExeVal,
        exePos: vsExePosVal,
      },
      customFys: Array.isArray(settings.customFys) ? settings.customFys : [],
      slipSigs: {
        ...(settings.slipSigs || {}),
        ...Object.fromEntries(
          [...document.querySelectorAll('[data-gsig]')].map((x: any) => [x.dataset.gsig, x.checked])
        ),
      },
    };
    try {
      await db.doc('settings/main').set(body);
      msg('gMsg', 'บันทึกแล้ว');
      toast('บันทึกการตั้งค่าแล้ว');
    } catch (err) {
      msg('gMsg', errText(err), 1);
    }
  });
  $('btnBackup')?.addEventListener('click', () => {
    const data = {
      app: 'kongchang-stock',
      version: 1,
      exportedAt: new Date().toISOString(),
      settings,
      materials,
      moves,
      counts: Object.entries(counts).map(([id, c]) => ({ id, ...c })),
    };
    saveFile('สำรองข้อมูลคุมวัสดุ_' + todayISO() + '.json', JSON.stringify(data, null, 1), 'ดาวน์โหลดไฟล์สำรองแล้ว').then(
      (ok) => {
        if (ok) {
          localDb.meta('lastBackup', todayISO());
          backupNote();
        }
      }
    );
  });
  $('restoreFile')?.addEventListener('change', async () => {
    const f = $('restoreFile').files[0];
    restoreData = null;
    $('btnRestore').hidden = true;
    if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (d.app !== 'kongchang-stock' || !Array.isArray(d.materials) || !Array.isArray(d.moves)) throw 0;
      restoreData = d;
      $('restoreMsg').textContent = `ไฟล์ ${f.name}: วัสดุ ${d.materials.length} รายการ, ใบรับ-ใบเบิก ${
        d.moves.length
      } ใบ (สำรองเมื่อ ${thDate((d.exportedAt || '').slice(0, 10))})`;
      $('btnRestore').hidden = false;
    } catch {
      $('restoreMsg').textContent = 'ไฟล์นี้ไม่ใช่ไฟล์สำรองของระบบคุมวัสดุ';
    }
    $('restoreFile').value = '';
  });
  $('btnRestore')?.addEventListener('click', async () => {
    if (!restoreData || !db) return;
    if (!confirmClick('restore', $('btnRestore'), 'กดอีกครั้งเพื่อกู้คืน (เขียนทับรายการเดิมที่ซ้ำกัน)')) return;
    const d = restoreData,
      clean = (o: any) => {
        const { id, ...rest } = o;
        void id;
        return rest;
      };
    let n = 0;
    $('btnRestore').disabled = true;
    try {
      if (d.settings) {
        applySet(d.settings);
        await db.doc('settings/main').set({ ...settings });
      }
      for (const m of d.materials) {
        if (!m.id) continue;
        await db.doc('materials/' + m.id).set(clean(m));
        $('restoreMsg').textContent = 'กำลังกู้คืน… ' + ++n;
      }
      for (const mv of d.moves) {
        if (!mv.id) continue;
        await db.doc('moves/' + mv.id).set(clean(mv));
        $('restoreMsg').textContent = 'กำลังกู้คืน… ' + ++n;
      }
      for (const c of Array.isArray(d.counts) ? d.counts : []) {
        if (!c.id) continue;
        await db.doc('counts/' + c.id).set(clean(c));
        $('restoreMsg').textContent = 'กำลังกู้คืน… ' + ++n;
      }
      $('restoreMsg').textContent = 'กู้คืนเรียบร้อย ' + n + ' รายการ';
      $('btnRestore').hidden = true;
      restoreData = null;
      toast('กู้คืนข้อมูลแล้ว');
    } catch (err) {
      $('restoreMsg').textContent = errText(err);
    } finally {
      $('btnRestore').disabled = false;
    }
  });

  function shrinkImage(file: File, max: number): Promise<string> {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file),
        im = new Image();
      im.onload = () => {
        const k = Math.min(1, max / Math.max(im.width, im.height)),
          w = Math.max(1, Math.round(im.width * k)),
          h = Math.max(1, Math.round(im.height * k)),
          c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        c.getContext('2d')!.drawImage(im, 0, 0, w, h);
        URL.revokeObjectURL(url);
        let d = c.toDataURL('image/png');
        if (d.length > 180000) d = c.toDataURL('image/jpeg', 0.85);
        res(d);
      };
      im.onerror = () => {
        URL.revokeObjectURL(url);
        rej();
      };
      im.src = url;
    });
  }
  async function saveLogo(logo: string) {
    if (!db) {
      msg('gMsg', 'เบราว์เซอร์นี้บันทึกข้อมูลไม่ได้', 1);
      return;
    }
    try {
      await db.doc('settings/main').set({ ...settings, logo });
      applySet({ ...settings, logo });
      toast(logo ? 'บันทึกโลโก้แล้ว' : 'ลบโลโก้แล้ว');
    } catch (err) {
      msg('gMsg', errText(err), 1);
    }
  }
  $('logoFile')?.addEventListener('change', async () => {
    const f = $('logoFile').files[0];
    $('logoFile').value = '';
    if (!f) return;
    if (!/^image\//.test(f.type)) {
      msg('gMsg', 'ไฟล์ที่เลือกไม่ใช่รูปภาพ', 1);
      return;
    }
    try {
      saveLogo(await shrinkImage(f, 320));
    } catch {
      msg('gMsg', 'อ่านรูปนี้ไม่ได้ ลองใช้ไฟล์ PNG หรือ JPG', 1);
    }
  });
  $('logoDel')?.addEventListener('click', () => {
    if (confirmClick('dellogo', $('logoDel'), 'กดอีกครั้งเพื่อลบโลโก้')) saveLogo('');
  });

  resetMat(null);
  setRepSeg();
  renderAll();

  const autoBk = (() => {
    const SUP = typeof (window as any).showDirectoryPicker === 'function';
    const DBN = 'kumwatsadu-autobackup',
      ST = 'h',
      KEEP = 30,
      PFX = 'KumWatsadu-backup-';
    let dir: any = null,
      state = 'off',
      timer: any = null,
      lastSig: string | null = null,
      busy = false;
    const idb = (): Promise<IDBDatabase> =>
      new Promise((ok, no) => {
        const r = indexedDB.open(DBN, 1);
        r.onupgradeneeded = () => r.result.createObjectStore(ST);
        r.onsuccess = () => ok(r.result);
        r.onerror = () => no(r.error);
      });
    const idbGet = async (k: string) => {
      const d = await idb();
      return new Promise((ok) => {
        const t = d.transaction(ST).objectStore(ST).get(k);
        t.onsuccess = () => ok(t.result);
        t.onerror = () => ok(null);
      });
    };
    const idbSet = async (k: string, v: any) => {
      const d = await idb();
      return new Promise<void>((ok) => {
        const t = d.transaction(ST, 'readwrite');
        v === undefined ? t.objectStore(ST).delete(k) : t.objectStore(ST).put(v, k);
        t.oncomplete = () => ok();
        t.onerror = () => ok();
      });
    };
    const perm = async (ask: boolean) => {
      if (!dir) return 'none';
      try {
        if (typeof dir.queryPermission !== 'function') return 'granted';
        let p = await dir.queryPermission({ mode: 'readwrite' });
        if (p !== 'granted' && ask) p = await dir.requestPermission({ mode: 'readwrite' });
        return p;
      } catch {
        return 'denied';
      }
    };
    const data = () => ({
      app: 'kongchang-stock',
      version: 1,
      exportedAt: new Date().toISOString(),
      settings,
      materials,
      moves,
      counts: Object.entries(counts).map(([id, c]) => ({ id, ...c })),
    });
    const sig = () => {
      let m = '';
      for (const x of materials) if ((x.updatedAt || '') > m) m = x.updatedAt;
      for (const x of moves) if ((x.updatedAt || '') > m) m = x.updatedAt;
      for (const k in counts) {
        const u = counts[k].updatedAt || '';
        if (u > m) m = u;
      }
      return [materials.length, moves.length, Object.keys(counts).length, m, JSON.stringify(settings).length].join('|');
    };
    async function writeFile(name: string, text: string) {
      const fh = await dir.getFileHandle(name, { create: true });
      const w = await fh.createWritable();
      await w.write(text);
      await w.close();
    }
    async function prune() {
      const daily: string[] = [];
      for await (const [n, h] of dir.entries()) {
        if (h.kind === 'file' && /^KumWatsadu-backup-\d{4}-\d{2}-\d{2}\.json$/.test(n)) daily.push(n);
      }
      daily
        .sort()
        .reverse()
        .slice(KEEP)
        .forEach((n) => dir.removeEntry(n).catch(() => {}));
    }
    async function run(force?: boolean, prefix?: string) {
      if (!dir || busy) return false;
      if (!force && !materials.length && !moves.length) return false;
      if ((await perm(false)) !== 'granted') {
        state = 'ask';
        ui();
        return false;
      }
      busy = true;
      try {
        const txt = JSON.stringify(data(), null, 1);
        if (prefix) {
          await writeFile(PFX + prefix + '_' + todayISO() + '.json', txt);
        } else {
          await writeFile(PFX + 'latest.json', txt);
          await writeFile(PFX + todayISO() + '.json', txt);
          await prune();
        }
        localDb.meta('lastBackup', todayISO());
        localDb.meta('autoBackupAt', new Date().toISOString());
        state = 'on';
        lastSig = sig();
        ui();
        try {
          backupNote();
        } catch {
          // ignore
        }
        return true;
      } catch (err: any) {
        state = 'err';
        ui(err?.message || String(err));
        return false;
      } finally {
        busy = false;
      }
    }
    function changed() {
      if (state !== 'on') return;
      const s = sig();
      if (lastSig === null) {
        lastSig = s;
        const at = localDb.meta('autoBackupAt') || '';
        if (at.slice(0, 10) !== todayISO()) run();
        return;
      }
      if (s === lastSig) return;
      clearTimeout(timer);
      timer = setTimeout(() => run(), 3000);
    }
    function ui(errMsg?: string) {
      const el = $('abStatus');
      if (!el) return;
      const at = localDb.meta('autoBackupAt');
      const when = at
        ? new Date(at).toLocaleString('th-TH', {
            day: 'numeric',
            month: 'short',
            year: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })
        : '';
      $('abPick').textContent = dir ? 'เปลี่ยนโฟลเดอร์' : 'เลือกโฟลเดอร์สำรองอัตโนมัติ';
      $('abOff').hidden = !dir;
      $('abNow').hidden = state !== 'on';
      $('abAllow').hidden = state !== 'ask';
      el.className = 'abst ' + (state === 'on' ? 'ok' : state === 'off' ? '' : 'warn');
      el.innerHTML = !SUP
        ? 'เบราว์เซอร์นี้ไม่รองรับการสำรองอัตโนมัติ ให้ใช้ Google Chrome หรือ Microsoft Edge'
        : state === 'on'
        ? `✓ เปิดอยู่ · โฟลเดอร์ <b>${esc(dir.name)}</b>${when ? ' · สำรองล่าสุด ' + esc(when) : ''}`
        : state === 'ask'
        ? `⚠ ยังไม่ได้รับอนุญาตให้เขียนโฟลเดอร์ <b>${esc(dir.name)}</b> กด “อนุญาตสำรองอัตโนมัติ”`
        : state === 'err'
        ? `⚠ สำรองไม่สำเร็จ (${esc(errMsg || '')}) ลองกด “เปลี่ยนโฟลเดอร์”`
        : 'ปิดอยู่ · กดเลือกโฟลเดอร์เพื่อเริ่มสำรองอัตโนมัติ';
      const ab = $('abBanner');
      if (ab) ab.hidden = state !== 'ask';
      backupNote();
    }
    async function pick() {
      if (!SUP) return;
      try {
        const h = await (window as any).showDirectoryPicker({
          id: 'kumwatsadu-backup',
          mode: 'readwrite',
          startIn: 'documents',
        });
        dir = h;
        await idbSet('dir', h);
        state = 'on';
        lastSig = null;
        await run(true);
        toast('เปิดสำรองอัตโนมัติแล้ว');
      } catch (e: any) {
        if (e?.name !== 'AbortError') {
          state = 'err';
          ui(e?.message);
        }
      }
    }
    async function allow() {
      const p = await perm(true);
      if (p === 'granted') {
        state = 'on';
        lastSig = null;
        ui();
        await run();
        toast('เปิดสำรองอัตโนมัติแล้ว');
      } else {
        state = 'ask';
        ui();
      }
    }
    async function off() {
      dir = null;
      state = 'off';
      await idbSet('dir', undefined);
      ui();
      toast('ปิดสำรองอัตโนมัติแล้ว');
    }
    async function init() {
      if (!SUP) {
        ui();
        return;
      }
      try {
        dir = (await idbGet('dir')) || null;
      } catch {
        dir = null;
      }
      if (dir) {
        const p = await perm(false);
        state = p === 'granted' ? 'on' : 'ask';
      }
      ui();
      if (state === 'on') changed();
    }
    return {
      init,
      changed,
      pick,
      allow,
      off,
      run,
      ui,
      get on() {
        return state === 'on';
      },
      get hasDir() {
        return !!dir;
      },
      get state() {
        return state;
      },
    };
  })();

  $('abPick')?.addEventListener('click', () => autoBk.pick());
  $('abAllow')?.addEventListener('click', () => autoBk.allow());
  $('abBannerBtn')?.addEventListener('click', () => autoBk.allow());
  $('abOff')?.addEventListener('click', () => {
    if (confirmClick('aboff', $('abOff'), 'กดอีกครั้งเพื่อปิด')) autoBk.off();
  });
  $('abNow')?.addEventListener('click', async () => {
    if (!materials.length && !moves.length) {
      toast('ยังไม่มีข้อมูลให้สำรอง');
      return;
    }
    if (await autoBk.run(true)) toast('สำรองข้อมูลลงโฟลเดอร์แล้ว');
  });
  (window as any).autoBk = autoBk;
  (window as any).toast = toast;

  function backupNote() {
    const lb = localDb.meta('lastBackup');
    if ($('lastBackup')) $('lastBackup').textContent = lb ? '· สำรองล่าสุด ' + thDate(lb) : '· ยังไม่เคยสำรองข้อมูล';
    window.dispatchEvent(new CustomEvent('kumwatsadu-lastbackup-change', { detail: lb || '' }));
    if (!autoBk.hasDir && autoBk.state === 'off') {
      notice(
        'ยังไม่ได้เลือกการเก็บสำรองข้อมูลอัตโนมัติ ไปที่แท็บ “ตั้งค่า / สำรองข้อมูล” แล้วกด “เลือกโฟลเดอร์สำรองอัตโนมัติ”'
      );
    } else {
      notice('');
    }
  }

  (() => {
    if (!localDb.available()) {
      notice(
        'เบราว์เซอร์นี้บันทึกข้อมูลไม่ได้ (อาจเปิดในโหมดไม่ระบุตัวตน) ให้เปิดไฟล์ด้วย Chrome หรือ Edge แบบปกติ'
      );
      return;
    }
    db = localDb;
    const ready = { m: 0, v: 0 };
    autoBk.init();
    const after = () => {
      if (ready.m && ready.v) {
        renderAll();
        backupNote();
        autoBk.changed();
      }
    };
    db.collection('materials').onSnapshot((s: any) => {
      materials = s.docs.map((x: any) => ({ id: x.id, ...x.data() }));
      ready.m = 1;
      after();
      refreshLineSelects();
    });
    db.collection('moves').onSnapshot((s: any) => {
      moves = s.docs.map((x: any) => ({ id: x.id, ...x.data() }));
      ready.v = 1;
      after();
    });
    db.doc('settings/main').onSnapshot((s: any) => {
      applySet(s.exists ? s.data() : null);
      if (curTab() === 'set') renderSet();
    });
    db.collection('counts').onSnapshot((s: any) => {
      counts = {};
      s.docs.forEach((x: any) => (counts[x.id] = x.data()));
      if (ready.m && ready.v) autoBk.changed();
      if (!cDirty) cDraft = null;
      if (
        curTab() === 'cnt' &&
        !cDirty &&
        !$('cRows')?.contains(document.activeElement) &&
        !$('cCmt')?.contains(document.activeElement)
      )
        renderCount();
    });
  })();

  function refreshLineSelects() {
    document.querySelectorAll('.lines .ln select').forEach((sel: any) => {
      const v = sel.value;
      fillSelect(sel, matOpts(false));
      if ([...sel.options].some((o: any) => o.value === v)) sel.value = v;
    });
  }

  /* ---- Wipe Modal ---- */
  (() => {
    const KP = 'kumwatsadu-wipe-pass',
      M = $('wipeModal');
    let mode = '';
    const get = () => {
      try {
        return localStorage.getItem(KP) || '';
      } catch {
        return '';
      }
    };
    const hash = async (t: string) => {
      const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('kumwatsadu:' + t));
      return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
    };
    function show(m: string) {
      mode = m;
      ['wpSet', 'wpAsk', 'wpChg'].forEach((id) => ($(id).hidden = true));
      $('wpMsg').textContent = '';
      M.querySelectorAll('input').forEach((i: HTMLInputElement) => (i.value = ''));
      if (m === 'set') {
        $('wpSet').hidden = false;
        $('wpGo').textContent = 'ตั้งรหัส';
        $('wpGo').className = 'btn primary';
        $('wpChgBtn').hidden = true;
        $('wpNew1').focus();
      }
      if (m === 'ask') {
        $('wpAsk').hidden = false;
        $('wpGo').textContent = 'ล้างข้อมูล';
        $('wpGo').className = 'btn danger';
        $('wpChgBtn').hidden = false;
        $('wpAuto').textContent =
          typeof autoBk !== 'undefined' && autoBk.on
            ? 'ระบบจะบันทึกไฟล์สำรอง “ก่อนล้างข้อมูล” ลงโฟลเดอร์สำรองอัตโนมัติให้ก่อน'
            : 'แนะนำให้กด “ดาวน์โหลดไฟล์สำรอง” ก่อนล้างข้อมูล';
        $('wpPass').focus();
      }
      if (m === 'chg') {
        $('wpChg').hidden = false;
        $('wpGo').textContent = 'บันทึกรหัสใหม่';
        $('wpGo').className = 'btn primary';
        $('wpChgBtn').hidden = true;
        $('wpOld').focus();
      }
      M.hidden = false;
    }
    const close = () => {
      M.hidden = true;
    };
    $('btnWipe')?.addEventListener('click', () => show(get() ? 'ask' : 'set'));
    $('wpCancel')?.addEventListener('click', close);
    $('wpChgBtn')?.addEventListener('click', () => show('chg'));
    M?.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        $('wpGo').click();
      }
      if (e.key === 'Escape') close();
    });
    $('wpGo')?.addEventListener('click', async () => {
      const wmsg = (t: string) => ($('wpMsg').textContent = t);
      if (mode === 'set' || mode === 'chg') {
        if (mode === 'chg' && (await hash($('wpOld').value)) !== get()) return wmsg('รหัสเดิมไม่ถูกต้อง');
        const a = mode === 'set' ? $('wpNew1').value : $('wpC1').value,
          b = mode === 'set' ? $('wpNew2').value : $('wpC2').value;
        if (a.length < 4) return wmsg('รหัสต้องมีอย่างน้อย 4 ตัว');
        if (a !== b) return wmsg('รหัสสองช่องไม่ตรงกัน');
        try {
          localStorage.setItem(KP, await hash(a));
        } catch {
          return wmsg('บันทึกรหัสไม่ได้');
        }
        if (mode === 'chg') {
          close();
          toast('เปลี่ยนรหัสล้างข้อมูลแล้ว');
          return;
        }
        show('ask');
        wmsg('');
        $('wpAuto').textContent = 'ตั้งรหัสแล้ว · ใส่รหัสเพื่อยืนยันการล้างข้อมูล หรือกดยกเลิก';
        return;
      }
      if ((await hash($('wpPass').value)) !== get()) return wmsg('รหัสไม่ถูกต้อง');
      $('wpGo').disabled = true;
      $('wpGo').textContent = 'กำลังล้างข้อมูล…';
      try {
        if (typeof autoBk !== 'undefined' && autoBk.on) await autoBk.run(true, 'before-wipe');
      } catch {
        // ignore
      }
      try {
        localStorage.removeItem('kumwatsadu-db-v1');
        localStorage.removeItem('kumwatsadu-db-v1:lastBackup');
        localStorage.removeItem('kumwatsadu-db-v1:autoBackupAt');
      } catch {
        // ignore
      }
      location.reload();
    });
  })();

  /* ---- Fiscal Year Management & Global Filter Sync ---- */
  (() => {
    const M = $('fyModal');

    function syncAllFyFilters(fyVal: string) {
      refreshFy(fyVal);
      if (fyVal !== 'all') {
        refreshCntFy(fyVal);
        fillRepSelects();
        if (cDraft && String(cDraft.fy) !== fyVal) cDraft = null;
      }
      renderTab(curTab());
    }

    $('topFySelect')?.addEventListener('change', () => {
      syncAllFyFilters($('topFySelect').value);
    });

    function renderFyModal() {
      const list = fyList();
      const maxFy = list.length ? Math.max(...list) : CUR_FY;
      const nextFy = maxFy + 1;
      if ($('fyQuickNext')) {
        $('fyQuickNext').textContent = `+ เพิ่มปีงบประมาณถัดไป (พ.ศ. ${nextFy})`;
        $('fyQuickNext').dataset.nextFy = String(nextFy);
      }
      if ($('fyNewInput')) {
        $('fyNewInput').value = String(nextFy);
      }
      const activeFy = $('sFy')?.value || String(CUR_FY);
      const customSet = new Set(
        Array.isArray(settings?.customFys) ? settings.customFys.map(Number) : []
      );
      const box = $('fyManageList');
      if (!box) return;
      box.innerHTML =
        `<div class="fy-item ${activeFy === 'all' ? 'active' : ''}">
          <div>
            <div class="fy-item-title">ทุกปีงบประมาณ (รวมทั้งหมด)</div>
            <div class="sub">แสดงข้อมูลสะสมทุกปีงบประมาณรวมกัน</div>
          </div>
          <div class="rowact">
            <button type="button" class="btn small ${activeFy === 'all' ? 'primary' : ''}" data-select-fy="all">
              ${activeFy === 'all' ? '✓ กำลังเลือก' : 'เลือกดู'}
            </button>
          </div>
        </div>` +
        list
          .map((y) => {
            const inCnt = moves.filter((m) => m.kind === 'in' && +(m.fy || fyOf(m.date)) === y).length;
            const outCnt = moves.filter((m) => m.kind === 'out' && +(m.fy || fyOf(m.date)) === y).length;
            const hasDocs = inCnt > 0 || outCnt > 0 || !!counts[String(y)];
            const canDel = customSet.has(y) && !hasDocs && y !== CUR_FY;
            const isSel = activeFy === String(y);
            const tag =
              y === CUR_FY
                ? '<span class="pill st-ok" style="margin-left:6px">ปีปัจจุบัน</span>'
                : y > CUR_FY
                ? '<span class="pill st-over" style="margin-left:6px">อนาคต</span>'
                : '<span class="pill" style="margin-left:6px">ย้อนหลัง</span>';
            return `<div class="fy-item ${isSel ? 'active' : ''}">
              <div>
                <div class="fy-item-title">ปีงบประมาณ พ.ศ. ${y}${tag}</div>
                <div class="sub">1 ต.ค. ${y - 1} – 30 ก.ย. ${y} · ใบรับ ${inCnt} ใบ · ใบเบิก ${outCnt} ใบ</div>
              </div>
              <div class="rowact">
                ${
                  canDel
                    ? `<button type="button" class="btn small danger" data-del-fy="${y}" title="ลบปีงบประมาณที่เพิ่มไว้">ลบ</button>`
                    : ''
                }
                <button type="button" class="btn small ${isSel ? 'primary' : ''}" data-select-fy="${y}">
                  ${isSel ? '✓ กำลังเลือก' : 'เลือกดูปีงบนี้'}
                </button>
              </div>
            </div>`;
          })
          .join('');
    }

    async function addFy(rawFy: any) {
      const fy = Math.round(+rawFy || 0);
      if (fy < 2500 || fy > 2700) {
        msg('fyModalMsg', 'กรุณาระบุปีงบประมาณ พ.ศ. 4 หลัก (ระหว่าง 2500 - 2700)', 1);
        return;
      }
      const existing = Array.isArray(settings?.customFys) ? settings.customFys.map(Number) : [];
      const alreadyInList = fyList().includes(fy);
      const customFys = [...new Set([...existing, fy])].sort((a, b) => b - a);
      settings = { ...settings, customFys };
      if (db) {
        try {
          await db.doc('settings/main').set({ ...settings });
        } catch (err) {
          msg('fyModalMsg', errText(err), 1);
          return;
        }
      }
      msg('fyModalMsg', '');
      syncAllFyFilters(String(fy));
      renderFyModal();
      toast(
        alreadyInList
          ? `สลับตัวกรองไปยังปีงบประมาณ พ.ศ. ${fy} แล้ว`
          : `เพิ่มปีงบประมาณ พ.ศ. ${fy} และอัปเดตตัวกรองทุกหน้าแล้ว`
      );
    }

    async function removeCustomFy(fy: number) {
      const existing = Array.isArray(settings?.customFys) ? settings.customFys.map(Number) : [];
      const customFys = existing.filter((y: number) => y !== fy);
      settings = { ...settings, customFys };
      if (db) {
        try {
          await db.doc('settings/main').set({ ...settings });
        } catch (err) {
          msg('fyModalMsg', errText(err), 1);
          return;
        }
      }
      const curSelected = $('sFy')?.value;
      syncAllFyFilters(curSelected === String(fy) ? String(CUR_FY) : curSelected || String(CUR_FY));
      renderFyModal();
      toast(`ลบปีงบประมาณ พ.ศ. ${fy} ออกจากรายการแล้ว`);
    }

    function openFyModal() {
      if (!M) return;
      msg('fyModalMsg', '');
      renderFyModal();
      M.hidden = false;
      $('fyNewInput')?.focus();
    }

    function closeFyModal() {
      if (M) M.hidden = true;
    }

    document.addEventListener('click', (e: Event) => {
      const trigger = (e.target as HTMLElement).closest('[data-open-fy-modal]') as HTMLElement | null;
      if (trigger) {
        openFyModal();
        return;
      }
      const selBtn = (e.target as HTMLElement).closest('[data-select-fy]') as HTMLElement | null;
      if (selBtn && selBtn.dataset.selectFy) {
        const v = selBtn.dataset.selectFy;
        syncAllFyFilters(v);
        renderFyModal();
        closeFyModal();
        toast(v === 'all' ? 'แสดงข้อมูลทุกปีงบประมาณ' : `กรองข้อมูลปีงบประมาณ พ.ศ. ${v} แล้ว`);
        return;
      }
      const delBtn = (e.target as HTMLElement).closest('[data-del-fy]') as HTMLElement | null;
      if (delBtn && delBtn.dataset.delFy) {
        removeCustomFy(+delBtn.dataset.delFy);
      }
    });

    $('fyModalClose')?.addEventListener('click', closeFyModal);
    $('fyQuickNext')?.addEventListener('click', () => {
      const next = $('fyQuickNext')?.dataset.nextFy;
      if (next) addFy(+next);
    });
    $('fyAddBtn')?.addEventListener('click', () => {
      addFy($('fyNewInput')?.value);
    });
    $('fyNewInput')?.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addFy($('fyNewInput')?.value);
      }
    });
    M?.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeFyModal();
    });
  })();
}
