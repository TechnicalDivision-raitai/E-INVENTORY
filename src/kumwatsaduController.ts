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
    $('catList').innerHTML = allCats()
      .map((c) => `<option value="${esc(c)}">`)
      .join('');
  }

  const THEMES: Array<[string, string]> = [
    ['#d0f4de', 'เขียวมิ้นต์ (#D0F4DE เริ่มต้น)'],
    ['#1d4e7a', 'น้ำเงิน'],
    ['#1f6f78', 'เขียวน้ำทะเล'],
    ['#2f6b3f', 'เขียวเข้ม'],
    ['#5b3f8c', 'ม่วง'],
    ['#8a2f3b', 'แดงเลือดหมู'],
    ['#8a5a1c', 'น้ำตาลทอง'],
  ];
  const hex2rgb = (h: string) => {
    h = h.replace('#', '');
    return [0, 2, 4].map((i) => parseInt(h.substr(i, 2), 16));
  };
  const rgb2hex = (a: number[]) =>
    '#' + a.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
  const cmix = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);
  const clum = (a: number[]) => {
    const c = a.map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  function applyTheme(h?: string) {
    let st = document.getElementById('themeStyle');
    if (!st) {
      st = document.createElement('style');
      st.id = 'themeStyle';
      document.head.appendChild(st);
    }
    if (!h || !/^#[0-9a-f]{6}$/i.test(h) || h.toLowerCase() === '#d0f4de') {
      st.textContent = '';
      return;
    }
    let a = hex2rgb(h);
    let k = 0;
    while (1.05 / (clum(a) + 0.05) < 4.5 && k < 30) {
      a = cmix(a, [0, 0, 0], 0.08);
      k++;
    }
    const W = [255, 255, 255];
    const L = `--ink:${rgb2hex(a)};--ink-soft:${rgb2hex(cmix(a, W, 0.88))};`;
    st.textContent = `@media screen{:root{${L}}}`;
  }
  function renderSwatches() {
    const sw = $('swatches');
    if (!sw) return;
    const cur = (settings.theme || THEMES[0][0]).toLowerCase();
    sw.innerHTML =
      THEMES.map(
        ([c, n]) =>
          `<button type="button" class="sw" data-theme-c="${c}" aria-pressed="${c === cur}" style="--c:${c}"><i></i>${n}</button>`
      ).join('') +
      (THEMES.some((t) => t[0] === cur)
        ? ''
        : `<button type="button" class="sw" aria-pressed="true" style="--c:${esc(cur)}"><i></i>สีที่เลือกเอง</button>`);
    if ($('themeCustom')) $('themeCustom').value = cur;
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
    applyTheme(d.theme);
    renderSwatches();
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
  let editIn: string | null = null;
  let editOut: string | null = null;
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

  fillSelect($('inSrc'), Object.entries(SRC));
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
    if (mv.kind === 'in') {
      showTab('in');
      resetIn(mv);
    } else {
      showTab('out');
      resetOut(mv);
    }
    window.scrollTo({ top: 0 });
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

  function renderStock() {
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
  function addLine(kind: 'in' | 'out', l?: any) {
    const box = $(kind + 'Lines');
    if (!materials.length) {
      toast('ยังไม่มีวัสดุในทะเบียน เพิ่มได้ที่แท็บ “ทะเบียนวัสดุ”');
      return;
    }
    const row = document.createElement('div');
    row.className = 'ln';
    row.innerHTML =
      kind === 'in'
        ? '<select aria-label="วัสดุ"></select><input type="number" min="0" step="any" placeholder="จำนวน" aria-label="จำนวน"><input type="number" min="0" step="any" placeholder="ราคา/หน่วย" aria-label="ราคาต่อหน่วย"><span class="tot">0.00</span><button type="button" class="btn small" aria-label="ลบบรรทัด">ลบ</button>'
        : '<select aria-label="วัสดุ"></select><input type="number" min="0" step="any" placeholder="จำนวน" aria-label="จำนวน"><span class="bal"></span><button type="button" class="btn small" aria-label="ลบบรรทัด">ลบ</button>';
    const sel = row.querySelector('select') as HTMLSelectElement;
    const ins = row.querySelectorAll('input');
    fillSelect(sel, matOpts(false));
    if (l) {
      sel.value = l.mid;
      ins[0].value = l.qty;
      if (kind === 'in') ins[1].value = l.price ?? '';
    } else if (kind === 'in') {
      const last = lastPrice(sel.value);
      if (last) ins[1].value = String(last);
    }
    const upd = () => {
      if (kind === 'in') {
        row.querySelector('.tot')!.textContent = fmtB(r2((+ins[0].value || 0) * (+ins[1].value || 0)));
        sumIn();
      } else {
        const m = matById(sel.value),
          avail = availFor(sel.value);
        const balEl = row.querySelector('.bal')!;
        balEl.textContent = m ? 'เหลือ ' + fmtQ(avail) + ' ' + m.unit : '';
        balEl.className = 'bal' + ((+ins[0].value || 0) > avail ? ' out' : '');
      }
    };
    sel.addEventListener('change', () => {
      if (kind === 'in' && !ins[1].value) {
        const p = lastPrice(sel.value);
        if (p) ins[1].value = String(p);
      }
      upd();
    });
    ins.forEach((i) => i.addEventListener('input', upd));
    row.querySelector('button')!.addEventListener('click', () => {
      row.remove();
      if (kind === 'in') sumIn();
    });
    box.appendChild(row);
    upd();
    if (!l) sel.focus();
  }
  function lastPrice(mid: string) {
    const rows = (L.get(mid) || []).filter((r) => r.mv.kind === 'in' && r.price);
    return rows.length ? rows[rows.length - 1].price : '';
  }
  function oldQty(mv: any, mid: string) {
    return mv ? (mv.lines || []).filter((l: any) => l.mid === mid).reduce((s: number, l: any) => s + (+l.qty || 0), 0) : 0;
  }
  function availFor(mid: string) {
    const mv = editOut && moves.find((x) => x.id === editOut);
    return r2(current(mid).q + oldQty(mv, mid));
  }
  function readLines(kind: string) {
    return [...$(kind + 'Lines').querySelectorAll('.ln')]
      .map((r: HTMLElement) => {
        const s = r.querySelector('select') as HTMLSelectElement;
        const i = r.querySelectorAll('input');
        const o: any = { mid: s.value, qty: +i[0].value || 0 };
        if (kind === 'in') o.price = +i[1].value || 0;
        return o;
      })
      .filter((l) => l.mid && l.qty > 0);
  }
  function clearLines(kind: string) {
    $(kind + 'Lines')
      ?.querySelectorAll('.ln')
      .forEach((r: HTMLElement) => r.remove());
  }
  function sumIn() {
    $('inSum').textContent = fmtB(readLines('in').reduce((s, l) => s + r2(l.qty * l.price), 0));
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

  function resetIn(mv: any) {
    editIn = mv ? mv.id : null;
    msg('inMsg', '');
    delete $('inNo').dataset.touched;
    $('inTitle').textContent = mv ? 'แก้ไขใบรับเลขที่ ' + mv.no : 'บันทึกรับวัสดุเข้าคลัง';
    $('inDel').hidden = !mv;
    const d = mv?.date || todayISO();
    $('inDate').value = d;
    $('inNo').value = mv ? mv.no : fmtNo(nextSeq('in', fyOf(d)), fyOf(d));
    $('inSrc').value = mv?.src || 'purchase';
    $('inInspect').value = mv?.inspectDate || '';
    $('inPo').value = mv?.poNo || '';
    $('inVendor').value = mv?.vendor || '';
    $('inInvoice').value = mv?.invoiceNo || '';
    $('inNote').value = mv?.note || '';
    clearLines('in');
    if (mv) (mv.lines || []).forEach((l: any) => addLine('in', l));
    else if (materials.length) addLine('in');
    sumIn();
    srcUi();
  }
  function srcUi() {
    const o = $('inSrc').value === 'opening';
    $('inPoLbl').hidden = o;
    $('inInspectLbl').hidden = o;
    $('inInspect').required = !o;
    $('inVendor').required = !o;
    $('inVendorReq').hidden = o;
    $('inVendorTxt').textContent = o ? 'ยกมาจาก' : 'ผู้ขาย / รับจาก';
  }
  $('inSrc')?.addEventListener('change', srcUi);
  $('inDate')?.addEventListener('change', () => {
    if (editIn) return;
    const fy = fyOf($('inDate').value);
    if (fy) $('inNo').value = fmtNo(nextSeq('in', fy), fy);
  });
  $('inAdd')?.addEventListener('click', () => addLine('in'));
  $('inReset')?.addEventListener('click', () => resetIn(null));
  $('inForm')?.addEventListener('submit', async (e: Event) => {
    e.preventDefault();
    if (!db) return msg('inMsg', 'เบราว์เซอร์นี้บันทึกข้อมูลไม่ได้', 1);
    const lines = readLines('in');
    if (!lines.length) return msg('inMsg', 'เพิ่มรายการวัสดุอย่างน้อย 1 รายการ และใส่จำนวน', 1);
    const date = $('inDate').value,
      n = parseNo($('inNo').value, 'in', date),
      opening = $('inSrc').value === 'opening';
    if (!opening && !$('inVendor').value.trim()) {
      $('inVendor').focus();
      return msg('inMsg', 'กรอกชื่อผู้ขาย / รับจาก', 1);
    }
    if (!opening && !$('inInspect').value) {
      $('inInspect').focus();
      return msg('inMsg', 'กรอกวันที่ตรวจรับ', 1);
    }
    if (moves.some((m) => m.kind === 'in' && m.no === n.no && m.id !== editIn))
      return msg('inMsg', 'เลขที่ใบรับ ' + n.no + ' ซ้ำกับใบที่มีอยู่แล้ว', 1);
    const old = editIn && moves.find((x) => x.id === editIn);
    if (old) {
      for (const l of old.lines || []) {
        const after = r2(
          current(l.mid).q -
            oldQty(old, l.mid) +
            lines.filter((x) => x.mid === l.mid).reduce((s, x) => s + x.qty, 0)
        );
        if (after < 0) {
          const m = matById(l.mid);
          return msg(
            'inMsg',
            `แก้ไม่ได้: ${m?.name || 'วัสดุ'} ถูกเบิกไปแล้ว ยอดจะติดลบ ${fmtQ(-after)} ${m?.unit || ''}`,
            1
          );
        }
      }
    }
    const now = new Date().toISOString();
    const body = {
      kind: 'in',
      no: n.no,
      seq: n.seq,
      fy: n.fy,
      date,
      src: $('inSrc').value,
      inspectDate: opening ? '' : $('inInspect').value,
      poNo: $('inPo').value.trim(),
      vendor: $('inVendor').value.trim(),
      invoiceNo: $('inInvoice').value.trim(),
      note: $('inNote').value.trim(),
      lines,
      createdAt: old?.createdAt || now,
      updatedAt: now,
    };
    const btn = $('inSave');
    btn.disabled = true;
    msg('inMsg', 'กำลังบันทึก…');
    try {
      const id = editIn || db.collection('moves').doc().id;
      await db.doc('moves/' + id).set(body);
      toast('บันทึกใบรับ ' + n.no + ' แล้ว');
      resetIn(null);
    } catch (err) {
      msg('inMsg', errText(err), 1);
    } finally {
      btn.disabled = false;
    }
  });
  $('inDel')?.addEventListener('click', async () => {
    const mv = moves.find((x) => x.id === editIn);
    if (!mv) return;
    for (const l of mv.lines || []) {
      if (r2(current(l.mid).q - oldQty(mv, l.mid)) < 0) {
        const m = matById(l.mid);
        return msg('inMsg', `ลบไม่ได้: ${m?.name || 'วัสดุ'} ถูกเบิกไปแล้ว ยอดจะติดลบ ลบใบเบิกที่เกี่ยวข้องก่อน`, 1);
      }
    }
    if (!confirmClick('delin', $('inDel'), 'กดอีกครั้งเพื่อลบใบรับ')) return;
    try {
      await db.doc('moves/' + mv.id).delete();
      toast('ลบใบรับ ' + mv.no + ' แล้ว');
      resetIn(null);
    } catch (err) {
      msg('inMsg', errText(err), 1);
    }
  });
  function renderIn() {
    if (!$('inLines').querySelector('.ln') && !editIn && materials.length) addLine('in');
    if (!editIn) {
      const fy = fyOf($('inDate').value || todayISO());
      if (!$('inDate').value) $('inDate').value = todayISO();
      if (!$('inNo').dataset.touched) $('inNo').value = fmtNo(nextSeq('in', fy), fy);
    }
    const q = $('inQ').value.trim().toLowerCase(),
      fy = $('inFy').value;
      const rows = moves
      .filter((m) => m.kind === 'in' && (fy === 'all' || String(m.fy || fyOf(m.date)) === fy))
      .filter(
        (m) =>
          !q ||
          [m.no, m.vendor, m.poNo, m.invoiceNo, m.note, linesText(m)].join(' ').toLowerCase().includes(q)
      )
      .sort((a, b) => mvSort(b, a));
    $('inRows').innerHTML = rows
      .map(
        (m) => `<tr><td class="no">${esc(m.no)}</td><td style="white-space:nowrap">${esc(thDate(m.date))}</td>
    <td>${esc(m.vendor || '—')}<div class="sub">${esc(SRC[m.src] || '')}${
          m.invoiceNo ? ' · ใบส่งของ ' + esc(m.invoiceNo) : ''
        }</div></td><td>${esc(m.poNo || '')}</td>
    <td style="min-width:200px">${esc(linesText(m))}</td><td class="num">${fmtB(moveValue(m))}</td>
    <td><button class="btn small" data-edin="${esc(m.id)}">${canWrite ? 'แก้ไข' : 'ดู'}</button></td></tr>`
      )
      .join('');
    const em = $('emptyIn');
    em.hidden = !!rows.length;
    em.innerHTML = moves.some((m) => m.kind === 'in')
      ? '<b>ไม่พบใบรับตามเงื่อนไข</b>ลองเปลี่ยนปีงบหรือคำค้นหา'
      : '<b>ยังไม่มีการรับวัสดุ</b>บันทึกยอดยกมาหรือการรับจากการจัดซื้อด้วยฟอร์มด้านบน';
  }
  $('inNo')?.addEventListener('input', () => ($('inNo').dataset.touched = 1));
  $('inQ')?.addEventListener('input', renderIn);
  $('inFy')?.addEventListener('change', () => {
    const fyVal = $('inFy').value;
    if (!editIn && fyVal !== 'all') {
      const targetFy = +fyVal;
      if (targetFy && fyOf($('inDate').value) !== targetFy) {
        $('inDate').value = targetFy === CUR_FY ? todayISO() : targetFy - 544 + '-10-01';
      }
      if (targetFy && !$('inNo').dataset.touched) {
        $('inNo').value = fmtNo(nextSeq('in', targetFy), targetFy);
      }
    }
    renderIn();
  });
  $('inRows')?.addEventListener('click', (e: Event) => {
    const b = (e.target as HTMLElement).closest('[data-edin]') as HTMLElement | null;
    if (b) {
      resetIn(moves.find((m) => m.id === b.dataset.edin));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  function resetOut(mv: any) {
    editOut = mv ? mv.id : null;
    msg('outMsg', '');
    delete $('outNo').dataset.touched;
    $('outTitle').textContent = mv ? 'แก้ไขใบเบิกเลขที่ ' + mv.no : 'ออกใบเบิกวัสดุ';
    $('outDel').hidden = !mv;
    const d = mv?.date || todayISO();
    $('outDate').value = d;
    $('outNo').value = mv ? mv.no : fmtNo(nextSeq('out', fyOf(d)), fyOf(d));
    $('outReq').value = mv?.requester || '';
    $('outPos').value = mv?.reqPos || '';
    $('outPurpose').value = mv?.purpose || '';
    $('outNote').value = mv?.note || '';
    clearLines('out');
    if (mv) (mv.lines || []).forEach((l: any) => addLine('out', l));
    else if (materials.length) addLine('out');
  }
  $('outDate')?.addEventListener('change', () => {
    if (editOut) return;
    const fy = fyOf($('outDate').value);
    if (fy) $('outNo').value = fmtNo(nextSeq('out', fy), fy);
  });
  $('outAdd')?.addEventListener('click', () => addLine('out'));
  $('outReset')?.addEventListener('click', () => resetOut(null));
  $('outReq')?.addEventListener('change', () => {
    if ($('outPos').value) return;
    const p = moves
      .filter((m) => m.kind === 'out' && m.requester === $('outReq').value.trim() && m.reqPos)
      .sort(mvSort)
      .pop();
    if (p) $('outPos').value = p.reqPos;
  });
  $('outForm')?.addEventListener('submit', async (e: SubmitEvent) => {
    e.preventDefault();
    const print = (e.submitter as HTMLElement | null)?.dataset.print === '1';
    if (!db) return msg('outMsg', 'เบราว์เซอร์นี้บันทึกข้อมูลไม่ได้', 1);
    const lines = readLines('out');
    if (!lines.length) return msg('outMsg', 'เพิ่มรายการวัสดุอย่างน้อย 1 รายการ และใส่จำนวน', 1);
    const need: Record<string, number> = {};
    lines.forEach((l) => (need[l.mid] = (need[l.mid] || 0) + l.qty));
    for (const mid in need) {
      const a = availFor(mid);
      if (need[mid] > a + 1e-9) {
        const m = matById(mid);
        return msg('outMsg', `${m?.name || 'วัสดุ'} คงเหลือ ${fmtQ(a)} ${m?.unit || ''} ไม่พอเบิก ${fmtQ(need[mid])}`, 1);
      }
    }
    const date = $('outDate').value,
      n = parseNo($('outNo').value, 'out', date);
    if (moves.some((m) => m.kind === 'out' && m.no === n.no && m.id !== editOut))
      return msg('outMsg', 'เลขที่ใบเบิก ' + n.no + ' ซ้ำกับใบที่มีอยู่แล้ว', 1);
    const old = editOut && moves.find((x) => x.id === editOut),
      now = new Date().toISOString();
    const body = {
      kind: 'out',
      no: n.no,
      seq: n.seq,
      fy: n.fy,
      date,
      requester: $('outReq').value.trim(),
      reqPos: $('outPos').value.trim(),
      purpose: $('outPurpose').value.trim(),
      note: $('outNote').value.trim(),
      lines,
      createdAt: old?.createdAt || now,
      updatedAt: now,
    };
    const btns = $('outForm').querySelectorAll('button[type=submit]');
    btns.forEach((b: HTMLButtonElement) => (b.disabled = true));
    msg('outMsg', 'กำลังบันทึก…');
    try {
      const id = editOut || db.collection('moves').doc().id;
      await db.doc('moves/' + id).set(body);
      toast('บันทึกใบเบิก ' + n.no + ' และตัดยอดคงเหลือแล้ว');
      resetOut(null);
      if (print) {
        openPrint({ ...body, id });
        doPrintSlip(true);
      }
    } catch (err) {
      msg('outMsg', errText(err), 1);
    } finally {
      btns.forEach((b: HTMLButtonElement) => (b.disabled = false));
    }
  });
  $('outDel')?.addEventListener('click', async () => {
    const mv = moves.find((x) => x.id === editOut);
    if (!mv) return;
    if (!confirmClick('delout', $('outDel'), 'กดอีกครั้ง: ลบใบเบิกและคืนวัสดุเข้าคลัง')) return;
    try {
      await db.doc('moves/' + mv.id).delete();
      toast('ลบใบเบิก ' + mv.no + ' แล้ว วัสดุคืนเข้าคลัง');
      resetOut(null);
    } catch (err) {
      msg('outMsg', errText(err), 1);
    }
  });
  function renderOut() {
    if (!$('outLines').querySelector('.ln') && !editOut && materials.length) addLine('out');
    $('outLines')
      .querySelectorAll('.ln input')
      .forEach((i: HTMLInputElement) => i.dispatchEvent(new Event('input')));
    if (!$('outDate').value) $('outDate').value = todayISO();
    if (!editOut && !$('outNo').dataset.touched) {
      const fy = fyOf($('outDate').value);
      $('outNo').value = fmtNo(nextSeq('out', fy), fy);
    }
    const people = [...new Set(moves.filter((m) => m.kind === 'out').map((m) => m.requester).filter(Boolean))];
    const pos = [...new Set(moves.filter((m) => m.kind === 'out').map((m) => m.reqPos).filter(Boolean))];
    $('peopleList').innerHTML = people.map((p) => `<option value="${esc(p)}">`).join('');
    $('posList').innerHTML = pos.map((p) => `<option value="${esc(p)}">`).join('');
    const q = $('outQ').value.trim().toLowerCase(),
      fy = $('outFy').value;
    const rows = moves
      .filter((m) => m.kind === 'out' && (fy === 'all' || String(m.fy || fyOf(m.date)) === fy))
      .filter((m) => !q || [m.no, m.requester, m.purpose, m.note, linesText(m)].join(' ').toLowerCase().includes(q))
      .sort((a, b) => mvSort(b, a));
    $('outRows').innerHTML = rows
      .map(
        (m) => `<tr><td class="no">${esc(m.no)}</td><td style="white-space:nowrap">${esc(thDate(m.date))}</td>
    <td>${esc(m.requester)}${m.reqPos ? `<div class="sub">${esc(m.reqPos)}</div>` : ''}</td><td style="min-width:180px">${esc(
          m.purpose
        )}</td>
    <td style="min-width:180px">${esc(linesText(m))}</td><td class="num">${fmtB(moveValue(m))}</td>
    <td><div class="rowact"><button class="btn small primary" data-prn="${esc(
      m.id
    )}">พิมพ์</button><button class="btn small" data-slip="${esc(m.id)}">Word</button><button class="btn small" data-edout="${esc(
          m.id
        )}">${canWrite ? 'แก้ไข' : 'ดู'}</button></div></td></tr>`
      )
      .join('');
    const em = $('emptyOut');
    em.hidden = !!rows.length;
    em.innerHTML = moves.some((m) => m.kind === 'out')
      ? '<b>ไม่พบใบเบิกตามเงื่อนไข</b>ลองเปลี่ยนปีงบหรือคำค้นหา'
      : '<b>ยังไม่มีใบเบิกวัสดุ</b>ออกใบเบิกใบแรกด้วยฟอร์มด้านบน ระบบจะรันเลขที่ใบเบิกตามปีงบประมาณให้';
  }
  $('outNo')?.addEventListener('input', () => ($('outNo').dataset.touched = 1));
  $('outQ')?.addEventListener('input', renderOut);
  $('outFy')?.addEventListener('change', () => {
    const fyVal = $('outFy').value;
    if (!editOut && fyVal !== 'all') {
      const targetFy = +fyVal;
      if (targetFy && fyOf($('outDate').value) !== targetFy) {
        $('outDate').value = targetFy === CUR_FY ? todayISO() : targetFy - 544 + '-10-01';
      }
      if (targetFy && !$('outNo').dataset.touched) {
        $('outNo').value = fmtNo(nextSeq('out', targetFy), targetFy);
      }
    }
    renderOut();
  });
  $('outRows')?.addEventListener('click', (e: Event) => {
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
      resetOut(moves.find((m) => m.id === b.dataset.edout));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

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
    b.push(P(R('ใบเบิกวัสดุ', { b: 1, sz: 40 }), { jc: 'center' }));
    b.push(P([R('ใบเบิกที่ '), F(d.no, 12)], { jc: 'right', after: 80 }));
    b.push(P([R('เรื่อง  ขออนุมัติเบิก'), F(I.subj, 44)]));
    b.push(P([R('เรียน  '), F(I.appr.p, 44)]));
    b.push(P([R('ข้าพเจ้า'), F(I.req.n, 32), R('ขอเบิกวัสดุ'), F(I.kind, 28)], { first: 720 }));
    b.push(P([R('เพื่อใช้ในการปฏิบัติราชการงาน'), F(d.purpose, 40), R('ดังต่อไปนี้')], { after: 120 }));
    const W = [1000, 4256, 1450, 1450, 1350];
    const items = I.items.slice();
    while (items.length < 10) items.push(null);
    let t = `<w:tbl><w:tblPr><w:tblW w:w="${W.reduce((a, c) => a + c, 0)}" w:type="dxa"/>${bd(
      1
    )}<w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>${W.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>`;
    t +=
      '<w:tr>' +
      ['ลำดับที่', 'รายการ', 'จำนวนเบิก', 'จำนวนอนุมัติ', 'หมายเหตุ']
        .map((h, i) => tc(W[i], cellP(h, { b: 1, jc: 'center' }), { fill: 'EEEEEE', bd: 1 }))
        .join('') +
      '</w:tr>';
    items.forEach((it: any, i: number) => {
      t +=
        '<w:tr><w:trPr><w:trHeight w:val="380" w:hRule="atLeast"/></w:trPr>' +
        [
          tc(W[0], cellP(it ? String(i + 1) : '', { jc: 'center' }), { bd: 1 }),
          tc(W[1], cellP(it ? it.name : ''), { bd: 1 }),
          tc(W[2], cellP(it ? it.qty : '', { jc: 'center' }), { bd: 1 }),
          tc(W[3], cellP(it ? it.qty : '', { jc: 'center' }), { bd: 1 }),
          tc(W[4], cellP(it && i === 0 && d.note ? d.note : ''), { bd: 1 }),
        ].join('') +
        '</w:tr>';
    });
    t += '</w:tbl>';
    b.push(t);
    const TAB = '<w:r><w:tab/></w:r>';
    const TP = (runs: any, pos: number, o: any = {}) =>
      `<w:p><w:pPr><w:tabs><w:tab w:val="${
        o.tv || 'left'
      }" w:leader="dot" w:pos="${pos}"/></w:tabs><w:spacing w:before="${o.before || 0}" w:after="0"/>${
        o.ind ? `<w:ind w:left="${o.ind}"/>` : ''
      }</w:pPr>${[].concat(runs).join('')}</w:p>`;
    const C = (xStr: string, o: any = {}) => P(R(xStr, o), { jc: o.jc || 'center', before: o.before || 0 });
    const SLn = (tt: string, bf: number) => TP([R('(ลงชื่อ)'), TAB, R(tt || '')], 3350, { ind: 200, before: bf });
    const nm = (n: string) => (n ? C('(' + n + ')') : TP([R('('), TAB, R(')')], 3900, { ind: 600 })),
      ps = (p: string) => (p ? C('ตำแหน่ง ' + p) : TP([R('ตำแหน่ง'), TAB], 3900, { ind: 600 }));
    const DL = () => TP(TAB, 4550);
    const opin = (h: string, o: any, bf: number) =>
      [C(h, { b: 1, jc: 'left', before: bf }), DL(), DL(), SLn('', 100), nm(o.n), ps(o.p)].join('');
    const sg = (tt: string, o: any, bf: number) => [SLn(tt, bf), nm(o.n), ps(o.p)].join('');
    const Lc =
      (sigOn('staff') ? opin('ความเห็นของเจ้าหน้าที่', I.staff, 160) : '') +
      (sigOn('head') ? opin('ความเห็นหัวหน้าเจ้าหน้าที่', I.head, 160) : '') +
      (sigOn('appr') ? SLn('', 240) + nm(I.appr.n) + ps(I.appr.p) + C('ผู้อนุมัติ') : '');
    const Rt =
      (sigOn('req') ? sg('ผู้เบิก', I.req, 160) : '') +
      (sigOn('recv')
        ? C('ได้รับของถูกต้องแล้ว', { before: 160 }) +
          (I.date ? P([R('วันที่ '), F(I.date, 20)], { jc: 'center' }) : TP([R('วันที่'), TAB], 3600, { ind: 900 })) +
          sg('ผู้รับของ', I.req, 160)
        : '') +
      (sigOn('payer') ? sg('ผู้จ่ายของ', I.payer, 160) : '');
    const cols = [Lc, Rt].filter(Boolean),
      SW = cols.length === 2 ? [4753, 4753] : [9506];
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
    ['staff', 'ความเห็นเจ้าหน้าที่'],
    ['head', 'ความเห็นหัวหน้าเจ้าหน้าที่'],
    ['appr', 'ผู้อนุมัติ'],
    ['req', 'ผู้เบิก'],
    ['recv', 'ผู้รับของ'],
    ['payer', 'ผู้จ่ายของ'],
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
  function slipInfo(mv: any) {
    const ms = (mv.lines || []).map((l: any) => matById(l.mid)).filter(Boolean);
    const cats = [...new Set(ms.map((m: any) => m.cat).filter(Boolean))];
    const st = settings.staff
      ? { n: settings.staff, p: settings.staffPos }
      : { n: settings.payer, p: settings.staffPos || settings.payerPos };
    return {
      subj: cats.length ? cats.join(', ') : 'วัสดุ',
      kind: cats
        .map((c: any) => String(c).replace(/^วัสดุ\s*/, ''))
        .filter(Boolean)
        .join(', '),
      items: (mv.lines || []).map((l: any) => {
        const m = matById(l.mid);
        const q = fmtQ(l.qty) + (m?.unit ? ' ' + m.unit : '');
        return { name: m ? matLabel(m) : '', qty: q };
      }),
      staff: st,
      head: { n: settings.head, p: settings.headPos },
      appr: { n: settings.appr, p: settings.apprPos },
      payer: { n: settings.payer, p: settings.payerPos },
      req: { n: mv.requester, p: mv.reqPos },
      date: mv.date ? thDateFull(mv.date) : '',
    };
  }
  function slipHtml(mv: any) {
    const I = slipInfo(mv);
    const F = (v: any, w: number) => `<span class="fl" style="min-width:${w}px">${esc(v || '') || '&nbsp;'}</span>`;
    const items = I.items.slice();
    while (items.length < 10) items.push(null);
    const dt = (w: number) => `<span class="dt" style="width:${w}em"></span>`,
      D = dt(8),
      SL = '(ลงชื่อ)' + dt(9);
    const nm = (n: string) => `(${n ? esc(n) : dt(10)})`,
      ps = (p: string) => `ตำแหน่ง ${p ? esc(p) : dt(8)}`;
    const opin = (h: string, o: any) =>
      `<div class="blk"><div class="hd">${h}</div><div class="dl"></div><div class="dl"></div><div style="margin-top:8px">${SL}</div><div>${nm(
        o.n
      )}</div><div>${ps(o.p)}</div></div>`;
    const sg = (t: string, o: any) =>
      `<div class="blk"><div>${SL}${t}</div><div>${nm(o.n)}</div><div>${ps(o.p)}</div></div>`;
    return `${settings.logo ? `<img class="lg" src="${esc(settings.logo)}" alt="">` : ''}
  <p class="ttl">ใบเบิกวัสดุ</p>
  <p class="r" style="margin-bottom:6px">ใบเบิกที่ ${F(mv.no, 110)}</p>
  <div class="rq"><p>เรื่อง&nbsp; ขออนุมัติเบิก ${F(I.subj, 300)}</p>
  <p>เรียน&nbsp; ${F(I.appr.p, 300)}</p>
  <p style="text-indent:48px">ข้าพเจ้า ${F(I.req.n, 220)} ขอเบิกวัสดุ ${F(I.kind, 200)}</p>
  <p>เพื่อใช้ในการปฏิบัติราชการงาน ${F(mv.purpose, 300)} ดังต่อไปนี้</p></div>
  <table class="sl"><thead><tr><th style="width:72px;white-space:nowrap">ลำดับที่</th><th>รายการ</th><th style="width:112px">จำนวนเบิก</th><th style="width:112px">จำนวนอนุมัติ</th><th style="width:110px">หมายเหตุ</th></tr></thead>
  <tbody>${items
    .map(
      (it: any, i: number) =>
        `<tr><td class="cn">${it ? i + 1 : ''}</td><td>${it ? esc(it.name) : ''}</td><td class="cn">${
          it ? esc(it.qty) : ''
        }</td><td class="cn">${it ? esc(it.qty) : ''}</td><td>${it && i === 0 && mv.note ? esc(mv.note) : ''}</td></tr>`
    )
    .join('')}</tbody></table>
  ${(() => {
    const Lc =
      (sigOn('staff') ? opin('ความเห็นของเจ้าหน้าที่', I.staff) : '') +
      (sigOn('head') ? opin('ความเห็นหัวหน้าเจ้าหน้าที่', I.head) : '') +
      (sigOn('appr')
        ? `<div class="blk" style="margin-top:6px"><div>${SL}</div><div>${nm(I.appr.n)}</div><div>${ps(
            I.appr.p
          )}</div><div>ผู้อนุมัติ</div></div>`
        : '');
    const Rc =
      (sigOn('req') ? sg('ผู้เบิก', I.req) : '') +
      (sigOn('recv')
        ? `<div class="blk"><div>ได้รับของถูกต้องแล้ว</div><div>วันที่ ${
            I.date ? F(I.date, 170) : D
          }</div></div>${sg('ผู้รับของ', I.req)}`
        : '') +
      (sigOn('payer') ? sg('ผู้จ่ายของ', I.payer) : '');
    const cs = [Lc, Rc].filter(Boolean);
    return cs.length
      ? `<div class="sg2" style="grid-template-columns:${
          cs.length === 2 ? 'minmax(0,1fr) minmax(0,1fr)' : 'minmax(0,1fr)'
        }">${cs
          .map(
            (c) => `<div class="col"${cs.length === 1 ? ' style="max-width:420px;margin:0 auto;width:100%"' : ''}>${c}</div>`
          )
          .join('')}</div>`
      : '';
  })()}`;
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

  function resetMat(m: any) {
    editMat = m ? m.id : null;
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

  let vsParts: any[] = [],
    vsHeadLoaded = false;
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
  const thNum = (v: any) => String(v ?? '').replace(/[๐-๙]/g, (d) => String('๐๑๒๓๔๕๖๗๘๙'.indexOf(d)));
  function orgParts() {
    const o = String(settings.org || ''),
      m = o.match(/^(.*?)\s*(?:อำเภอ|อ\.)\s*(\S+)\s*(?:จังหวัด|จ\.)\s*(\S+)/);
    return m ? { name: m[1].trim(), amp: m[2], chw: m[3] } : { name: o, amp: '', chw: '' };
  }
  function vsDefaults() {
    const op = orgParts(),
      n = op.name;
    const pal = 'ปลัด' + n;
    const exe = /^เทศบาล/.test(n) ? 'นายกเทศมนตรี' + n.replace(/^เทศบาล/, '') : 'นายก' + n;
    return {
      org: n,
      amp: op.amp,
      chw: op.chw,
      zip: '',
      co: '',
      coPos: '',
      tel: '',
      fax: '',
      mk: '',
      mkPos: '',
      fin: '',
      finPos: 'ผู้อำนวยการกองคลัง',
      pal: '',
      palPos: pal,
      exe: '',
      exePos: exe,
    };
  }
  function vsHead() {
    return {
      ...vsDefaults(),
      ...Object.fromEntries(Object.entries(settings.vs || {}).filter(([, v]) => v !== '' && v != null)),
    };
  }
  const VSF: Record<string, string> = {
    org: 'vOrg',
    amp: 'vAmp',
    chw: 'vChw',
    zip: 'vZip',
    co: 'vCo',
    coPos: 'vCoPos',
    tel: 'vTel',
    fax: 'vFax',
    mk: 'vMk',
    mkPos: 'vMkPos',
    fin: 'vFin',
    finPos: 'vFinPos',
    pal: 'vPal',
    palPos: 'vPalPos',
    exe: 'vExe',
    exePos: 'vExePos',
  };
  function fillVsHead() {
    const h: any = vsHead();
    Object.entries(VSF).forEach(([k, id]) => ($(id).value = h[k] || ''));
    vsHeadLoaded = true;
  }
  function readVsHead() {
    const h: Record<string, string> = {};
    Object.entries(VSF).forEach(([k, id]) => (h[k] = $(id).value.trim()));
    return h;
  }
  $('vHeadSave')?.addEventListener('click', async () => {
    if (!db) return;
    const vs = readVsHead();
    try {
      await db.doc('settings/main').set({ ...settings, vs });
      msg('vHeadMsg', 'บันทึกแล้ว');
      toast('บันทึกข้อมูลหัวรายงานแล้ว');
    } catch (err) {
      msg('vHeadMsg', errText(err), 1);
    }
  });
  const divName = () => settings.div || 'กองนี้';
  function vsDate() {
    return $('vDate').value || fyEnd(+$('rFy').value || CUR_FY);
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
  function vsAllItems() {
    const parts: any[] = [];
    if ($('vSelf').checked) parts.push({ div: divName(), items: vsSelfItems() });
    vsParts.forEach((p) => parts.push(p));
    let rows: any[] = [];
    parts.forEach((p) =>
      p.items.forEach((it: any) => rows.push({ ...it, note: [p.div, it.note].filter(Boolean).join(' · ') }))
    );
    if ($('vMerge').checked) {
      const g = new Map<string, any>();
      rows.forEach((r) => {
        const k =
          r.name.replace(/\s+/g, ' ').trim().toLowerCase() +
          '|' +
          String(r.unit || '').trim() +
          '|' +
          r2(r.price);
        const o = g.get(k);
        if (o) {
          o.qty = r2(o.qty + r.qty);
          o.amt = r2(o.amt + r.amt);
          o.divs.add(r.note.split(' · ')[0]);
        } else g.set(k, { ...r, divs: new Set([r.note.split(' · ')[0]]) });
      });
      rows = [...g.values()].map((o) => ({
        name: o.name,
        qty: o.qty,
        unit: o.unit,
        price: o.qty ? o.amt / o.qty : 0,
        amt: o.amt,
        note: [...o.divs].join(', '),
      }));
    }
    return { parts, rows };
  }
  function renderVs() {
    if (!vsHeadLoaded) fillVsHead();
    const fy = +$('rFy').value || CUR_FY;
    if (!$('vDate').value || $('vDate').dataset.fy !== String(fy)) {
      $('vDate').value = fyEnd(fy);
      $('vDate').dataset.fy = String(fy);
    }
    const h: any = vsHead();
    $('vHeadSum').textContent = '· ' + [h.org, h.amp && 'อ.' + h.amp, h.chw && 'จ.' + h.chw].filter(Boolean).join(' ');
    $('vDivName').textContent = divName();
    $('vDivName2').textContent = divName();
    const own = vsSelfItems();
    $('vSelfSum').textContent = `วัสดุคงเหลือ ${own.length} รายการ · ${fmtB(sumAmt(own))} บาท`;
    const rows: string[] = [];
    if ($('vSelf').checked)
      rows.push(
        `<tr><td><b>${esc(divName())}</b></td><td class="vsrc">ข้อมูลในเครื่องนี้</td><td class="num">${
          own.length
        }</td><td class="num">${fmtB(sumAmt(own))}</td><td></td></tr>`
      );
    vsParts.forEach((p, i) =>
      rows.push(
        `<tr><td><input data-vdiv="${i}" value="${esc(
          p.div
        )}" style="min-width:170px"></td><td class="vsrc">${esc(p.file)}</td><td class="num">${
          p.items.length
        }</td><td class="num">${fmtB(sumAmt(p.items))}</td><td><button class="btn small" data-vdel="${i}">เอาออก</button></td></tr>`
      )
    );
    $('vParts').innerHTML =
      rows.join('') ||
      '<tr><td colspan="5" class="sub">ยังไม่มีข้อมูล ติ๊กรวมข้อมูลในเครื่องนี้ หรือแนบไฟล์ของแต่ละกอง</td></tr>';
    if ($('vSelf').checked && vsParts.some((p) => p.div.trim() === divName()))
      msg(
        'vMsg',
        '⚠️ มีไฟล์ของ ' + divName() + ' และติ๊กรวมข้อมูลในเครื่องนี้ด้วย ข้อมูลจะซ้ำ 2 เท่า ให้เอาออกอย่างใดอย่างหนึ่ง',
        1
      );
    const A = vsAllItems();
    $('vPartsFt').innerHTML = `<tr><td colspan="2">รวมทั้งหน่วยงาน (${
      A.parts.length
    } ส่วนราชการ)</td><td class="num">${A.rows.length}</td><td class="num">${fmtB(sumAmt(A.rows))}</td><td></td></tr>`;
  }
  $('vDate')?.addEventListener('change', renderVs);
  $('vSelf')?.addEventListener('change', renderVs);
  $('vMerge')?.addEventListener('change', renderVs);
  $('vParts')?.addEventListener('input', (e: Event) => {
    const target = e.target as HTMLInputElement;
    const i = target.dataset.vdiv;
    if (i != null) vsParts[+i].div = target.value;
  });
  $('vParts')?.addEventListener('change', (e: Event) => {
    const target = e.target as HTMLInputElement;
    if (target.dataset.vdiv != null) renderVs();
  });
  $('vParts')?.addEventListener('click', (e: Event) => {
    const b = (e.target as HTMLElement).closest('[data-vdel]') as HTMLElement | null;
    if (b) {
      vsParts.splice(+b.dataset.vdel!, 1);
      renderVs();
    }
  });
  function parseVsRows(rows: any[][], fname: string) {
    const T = (c: any) =>
      String(c ?? '')
        .replace(/\s+/g, ' ')
        .trim();
    const h = rows.findIndex((r) => r.some((c) => /รายการ/.test(T(c))) && r.some((c) => /ปริมาณ|จำนวน/.test(T(c))));
    if (h < 0) throw new Error('ไม่พบหัวตาราง “รายการ / ปริมาณ”');
    const map: Record<string, number> = {};
    rows[h].forEach((c, i) => {
      const t = T(c);
      if (map.name == null && /รายการ/.test(t)) map.name = i;
      else if (map.qty == null && /ปริมาณ|^จำนวน$|จำนวนคงเหลือ/.test(t)) map.qty = i;
      else if (map.unit == null && /หน่วยนับ|^หน่วย$/.test(t)) map.unit = i;
      else if (map.price == null && /ราคา/.test(t)) map.price = i;
      else if (map.amt == null && /จำนวนเงิน|มูลค่า/.test(t)) map.amt = i;
      else if (map.note == null && /หมายเหตุ/.test(t)) map.note = i;
    });
    if (map.name == null || map.qty == null) throw new Error('ไม่พบคอลัมน์ รายการ / ปริมาณ');
    let div = '';
    for (const r of rows.slice(0, h))
      for (const c of r) {
        const m = T(c).match(/^ส่วนราชการ\s*[:：]?\s*(.+)$/);
        if (m && !/^\.+$/.test(m[1])) {
          div = m[1].replace(/\.+$/, '').trim();
          break;
        }
      }
    const items: any[] = [];
    for (const r of rows.slice(h + 1)) {
      const g = (k: string) => (map[k] == null ? '' : r[map[k]]);
      const name = T(g('name'));
      const line = r.map(T).join(' ');
      if (/รวมทั้งสิ้น|^รวม$/.test(name) || /ลงชื่อ/.test(line)) break;
      if (!name || /^\(บาท\)$/.test(name)) continue;
      const qty = numOf(thNum(g('qty'))),
        price = numOf(thNum(g('price')));
      let amt = numOf(thNum(g('amt')));
      if (!amt && qty && price) amt = r2(qty * price);
      if (!qty && !amt) continue;
      items.push({
        name,
        qty: r2(qty),
        unit: T(g('unit')),
        price: price || (qty ? amt / qty : 0),
        amt: r2(amt),
        note: T(g('note')),
      });
    }
    if (!items.length) throw new Error('ไม่มีรายการวัสดุในไฟล์');
    return { div: div || fname.replace(/\.[^.]+$/, ''), file: fname, items };
  }
  $('vFiles')?.addEventListener('change', async () => {
    const fs = [...$('vFiles').files];
    $('vFiles').value = '';
    const bad: string[] = [];
    let ok = 0;
    for (const f of fs) {
      try {
        if (!/\.xlsx$/i.test(f.name)) throw new Error('ใช้ได้เฉพาะ .xlsx');
        const p = parseVsRows(await readXlsxRows(await f.arrayBuffer()), f.name);
        const k = vsParts.findIndex((x) => x.file === f.name);
        if (k >= 0) vsParts[k] = p;
        else vsParts.push(p);
        ok++;
      } catch (err: any) {
        bad.push(f.name + ': ' + (err?.message || err));
      }
    }
    msg('vMsg', (ok ? `แนบแล้ว ${ok} ไฟล์` : '') + (bad.length ? (ok ? ' · ' : '') + 'อ่านไม่ได้ ' + bad.join(' / ') : ''), !!bad.length);
    renderVs();
  });
  function vsTitleLines(h: any, date: string, sub: string) {
    return {
      form: 'แบบ อปท. - วส.',
      title: 'รายงานวัสดุคงเหลือ',
      date: 'ณ วันที่ ' + thDateFull(date),
      sub,
      l1: 'ชื่อหน่วยงาน ' + (h.org || '....................'),
      l2:
        'อำเภอ ' +
        (h.amp || '..............') +
        '      จังหวัด ' +
        (h.chw || '..............') +
        '      รหัสไปรษณีย์ ' +
        (h.zip || '..........'),
      l3:
        'ชื่อเจ้าหน้าที่ประสานงาน ' +
        (h.co || '..............................') +
        '      ตำแหน่ง ' +
        (h.coPos || '....................'),
      l4: 'โทรศัพท์ ' + (h.tel || '....................') + '      โทรสาร ' + (h.fax || '....................'),
    };
  }
  function vsSigs(h: any) {
    const D = '..................................................';
    return [
      ['ลงชื่อ' + D + 'ผู้จัดทำ', '(' + (h.mk || D) + ')', 'ตำแหน่ง ' + (h.mkPos || '..............................'), 'วันที่ ..............................'],
      ['ลงชื่อ' + D, '(' + (h.fin || D) + ')', 'ตำแหน่ง ' + (h.finPos || '..............................'), 'วันที่ ..............................'],
      ['ลงชื่อ' + D, '(' + (h.pal || D) + ')', 'ตำแหน่ง ' + (h.palPos || '..............................'), 'วันที่ ..............................'],
      ['ลงชื่อ' + D, '(' + (h.exe || D) + ')', 'ตำแหน่ง ' + (h.exePos || '..............................'), 'วันที่ ..............................'],
    ];
  }
  function vsHtml(rows: any[], sub: string) {
    const h = { ...vsHead(), ...(vsHeadLoaded ? readVsHead() : {}) },
      L = vsTitleLines(h, vsDate(), sub),
      tot = sumAmt(rows);
    return `<div class="vsform"><p class="fm">${L.form}</p><p class="ttl">${L.title}</p><p class="c">${esc(
      L.date
    )}</p>${sub ? `<p class="c">${esc(sub)}</p>` : ''}
  <div class="hd" style="margin-top:10px"><p>${esc(L.l1)}</p><p>${esc(L.l2)}</p><p>${esc(L.l3)}</p><p>${esc(
      L.l4
    )}</p></div>
  <table><thead><tr><th style="width:46px">ลำดับ</th><th>รายการ</th><th style="width:76px">ปริมาณ</th><th style="width:72px">หน่วยนับ</th><th style="width:92px">ราคาต่อหน่วย<br>(บาท)</th><th style="width:104px">จำนวนเงิน<br>(บาท)</th><th style="width:128px">หมายเหตุ</th></tr></thead>
  <tbody>${
    rows
      .map(
        (r, i) =>
          `<tr><td class="cn">${i + 1}</td><td>${esc(r.name)}</td><td class="n">${fmtQ(
            r.qty
          )}</td><td class="cn">${esc(r.unit)}</td><td class="n">${fmtB(r.price)}</td><td class="n">${fmtB(
            r.amt
          )}</td><td>${esc(r.note)}</td></tr>`
      )
      .join('') || '<tr><td colspan="7" class="cn">ไม่มีวัสดุคงเหลือ</td></tr>'
  }</tbody>
  <tfoot><tr><td></td><td class="cn"><b>รวมทั้งสิ้น</b></td><td colspan="3"></td><td class="n"><b>${fmtB(
    tot
  )}</b></td><td></td></tr></tfoot></table>
  <div class="vsig">${vsSigs(h)
    .map((s) => `<div>${s.map(esc).join('<br>')}</div>`)
    .join('')}</div></div>`;
  }
  function vsSheet(rows: any[], sub: string) {
    const h = { ...vsHead(), ...readVsHead() },
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
    aoa.push([
      { v: '', s: 'tdb' },
      { v: 'รวมทั้งสิ้น', s: 'totl' },
      { v: '', s: 'tdb' },
      { v: '', s: 'tdb' },
      { v: '', s: 'tdb' },
      rows.length ? { f: `SUM(F${first}:F${last})`, v: sumAmt(rows), s: 'tot' } : { v: 0, s: 'tot' },
      { v: '', s: 'tdb' },
    ]);
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
  function vsSave(fname: string, rows: any[], sub: string, parts?: any[]) {
    if (typeof XLSX === 'undefined') {
      toast('โหลดตัวสร้างไฟล์ Excel ไม่สำเร็จ');
      return;
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, vsSheet(rows, sub), 'แบบ อปท. วส.');
    if (parts) {
      const a: any[][] = [
        [{ v: 'สรุปวัสดุคงเหลือแยกตามส่วนราชการ ณ วันที่ ' + thDateFull(vsDate()), s: 'bold' }],
        [],
        ['ลำดับ', 'ส่วนราชการ', 'จำนวนรายการ', 'จำนวนเงิน (บาท)'].map((v) => ({ v, s: 'th' })),
      ];
      parts.forEach((p, i) =>
        a.push([
          { v: i + 1, s: 'tdc' },
          { v: p.div, s: 'td' },
          { v: p.items.length, s: 'qtyi' },
          { v: sumAmt(p.items), s: 'num' },
        ])
      );
      a.push([
        { v: '', s: 'tdb' },
        { v: 'รวม', s: 'totl' },
        { v: parts.reduce((t, p) => t + p.items.length, 0), s: 'qtyi' },
        { v: r2(parts.reduce((t, p) => t + sumAmt(p.items), 0)), s: 'tot' },
      ]);
      const ws = XLSX.utils.aoa_to_sheet(a);
      ws['!cols'] = [{ wch: 8 }, { wch: 40 }, { wch: 16 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, ws, 'สรุปแยกส่วนราชการ');
    }
    saveFile(fname, XLSX.write(wb, { type: 'array', bookType: 'xlsx' }), 'ส่งออกไฟล์ Excel แล้ว');
  }
  const vsFy = () => fyOf(vsDate());
  $('vSelfXlsx')?.addEventListener('click', () =>
    vsSave(`อปท.วส_${divName()}_ปีงบ${vsFy()}.xlsx`, vsSelfItems(), 'ส่วนราชการ ' + divName())
  );
  $('vSelfPrint')?.addEventListener('click', () =>
    openPaper('แบบ อปท.-วส. ' + divName(), vsHtml(vsSelfItems(), 'ส่วนราชการ ' + divName()), false)
  );
  $('vAllXlsx')?.addEventListener('click', () => {
    const A = vsAllItems();
    if (!A.parts.length) return msg('vMsg', 'ยังไม่มีข้อมูลให้รวม', 1);
    vsSave(`อปท.วส_รวมทั้งหน่วยงาน_ปีงบ${vsFy()}.xlsx`, A.rows, '', A.parts);
  });
  $('vAllPrint')?.addEventListener('click', () => {
    const A = vsAllItems();
    if (!A.parts.length) return msg('vMsg', 'ยังไม่มีข้อมูลให้รวม', 1);
    openPaper('แบบ อปท.-วส. รวมทั้งหน่วยงาน', vsHtml(A.rows, ''), false);
  });

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
    const staffName = settings.staff || settings.payer || '';
    const staffPos = settings.staff ? settings.staffPos || settings.payerPos || '' : settings.payerPos || '';
    const headName = settings.head || settings.appr || '';
    const headPos = settings.head ? settings.headPos || settings.apprPos || '' : settings.apprPos || '';
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

  function cardPaperHtml(ids: string[], p: any, rowsPerPage = 12) {
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
      box.innerHTML = `<div class="official-ledger-preview">${cardPaperHtml(ids, p, 12)}</div>`;
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
      'นายกองค์การบริหารส่วนตำบล',
      'รองนายกองค์การบริหารส่วนตำบล',
      'ปลัดองค์การบริหารส่วนตำบล',
      'รองปลัดองค์การบริหารส่วนตำบล',
      'หัวหน้าสำนักปลัด',
      'ผู้อำนวยการกองคลัง',
      'ผู้อำนวยการกองช่าง',
      'ผู้อำนวยการกองการศึกษา ศาสนาและวัฒนธรรม',
      'ผู้อำนวยการกองสาธารณสุขและสิ่งแวดล้อม',
      'ผู้อำนวยการกองสวัสดิการสังคม',
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
  function renderSet() {
    const s = settings;
    $('gDiv').value = s.div || '';
    $('gWork').value = s.work || '';
    $('gOrg').value = s.org || '';
    $('gAppr').value = s.appr || '';
    posSet('gApprPos', s.apprPos);
    $('gPayer').value = s.payer || '';
    $('gPayerPos').value = s.payerPos || '';
    $('gStaff').value = s.staff || '';
    $('gStaffPos').value = s.staffPos || '';
    $('gHead').value = s.head || '';
    $('gHeadPos').value = s.headPos || '';
    $('gSigs').innerHTML = SIGS.map(
      ([k, l]) => `<label><input type="checkbox" data-gsig="${k}"${sigOn(k) ? ' checked' : ''}> ${l}</label>`
    ).join('');
  }
  $('setForm')?.addEventListener('submit', async (e: Event) => {
    e.preventDefault();
    if (!db) return msg('gMsg', 'เบราว์เซอร์นี้บันทึกข้อมูลไม่ได้', 1);
    const body = {
      logo: settings.logo || '',
      theme: settings.theme || '',
      div: $('gDiv').value.trim(),
      work: $('gWork').value.trim(),
      org: $('gOrg').value.trim() || DEF_SET.org,
      appr: $('gAppr').value.trim(),
      apprPos: posGet('gApprPos'),
      payer: $('gPayer').value.trim(),
      payerPos: $('gPayerPos').value.trim(),
      staff: $('gStaff').value.trim(),
      staffPos: $('gStaffPos').value.trim(),
      head: $('gHead').value.trim(),
      headPos: $('gHeadPos').value.trim(),
      vs: settings.vs || null,
      customFys: Array.isArray(settings.customFys) ? settings.customFys : [],
      slipSigs: Object.fromEntries(
        [...document.querySelectorAll('[data-gsig]')].map((x: any) => [x.dataset.gsig, x.checked])
      ),
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
  async function saveTheme(c: string) {
    if (!db) {
      msg('gMsg', 'ยังบันทึกไม่ได้', 1);
      return;
    }
    applyTheme(c);
    try {
      await db.doc('settings/main').set({ ...settings, theme: c });
      applySet({ ...settings, theme: c });
      toast(c ? 'เปลี่ยนสีแล้ว' : 'กลับเป็นสีเริ่มต้นแล้ว');
    } catch (err) {
      msg('gMsg', errText(err), 1);
    }
  }
  $('swatches')?.addEventListener('click', (e: Event) => {
    const b = (e.target as HTMLElement).closest('[data-theme-c]') as HTMLElement | null;
    if (b) saveTheme(b.dataset.themeC === THEMES[0][0] ? '' : b.dataset.themeC!);
  });
  $('themeCustom')?.addEventListener('input', (e: Event) => applyTheme((e.target as HTMLInputElement).value));
  $('themeCustom')?.addEventListener('change', (e: Event) => saveTheme((e.target as HTMLInputElement).value));
  $('themeReset')?.addEventListener('click', () => saveTheme(''));
  $('logoDel')?.addEventListener('click', () => {
    if (confirmClick('dellogo', $('logoDel'), 'กดอีกครั้งเพื่อลบโลโก้')) saveLogo('');
  });

  resetIn(null);
  resetOut(null);
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
        if (!$('inLines')?.querySelector('.ln') && !editIn) resetIn(null);
        if (!$('outLines')?.querySelector('.ln') && !editOut) resetOut(null);
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
        const targetFy = +fyVal;
        if (targetFy) {
          if (!editIn && $('inDate')) {
            if (fyOf($('inDate').value) !== targetFy) {
              $('inDate').value = targetFy === CUR_FY ? todayISO() : targetFy - 544 + '-10-01';
            }
            if (!$('inNo')?.dataset.touched && $('inNo')) {
              $('inNo').value = fmtNo(nextSeq('in', targetFy), targetFy);
            }
          }
          if (!editOut && $('outDate')) {
            if (fyOf($('outDate').value) !== targetFy) {
              $('outDate').value = targetFy === CUR_FY ? todayISO() : targetFy - 544 + '-10-01';
            }
            if (!$('outNo')?.dataset.touched && $('outNo')) {
              $('outNo').value = fmtNo(nextSeq('out', targetFy), targetFy);
            }
          }
        }
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
