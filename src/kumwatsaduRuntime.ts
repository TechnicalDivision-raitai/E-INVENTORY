/* eslint-disable @typescript-eslint/no-explicit-any */

export function initMiniLibsAndDb() {
  if ((window as any).__kumwatsadu_libs_initialized) {
    return (window as any).localDb;
  }
  (window as any).__kumwatsadu_libs_initialized = true;

  /* ---- MiniZip: store-only ZIP writer (แทน JSZip, ไม่ต้องใช้อินเทอร์เน็ต) ---- */
  const T = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    T[n] = c >>> 0;
  }
  const crc = (b: Uint8Array) => {
    let c = 0xffffffff;
    for (let i = 0; i < b.length; i++) c = T[(c ^ b[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const enc = new TextEncoder();

  class MiniZip {
    f: Array<[string, Uint8Array]> = [];
    file(n: string, d: string | Uint8Array) {
      this.f.push([n, typeof d === 'string' ? enc.encode(d) : d]);
      return this;
    }
    generate() {
      const parts: Uint8Array[] = [];
      const cen: Uint8Array[] = [];
      let off = 0;
      const d = new Date();
      const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
      const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
      for (const [n, data] of this.f) {
        const nb = enc.encode(n);
        const c = crc(data);
        const h = new DataView(new ArrayBuffer(30));
        h.setUint32(0, 0x04034b50, true);
        h.setUint16(4, 20, true);
        h.setUint16(6, 0x0800, true);
        h.setUint16(8, 0, true);
        h.setUint16(10, time, true);
        h.setUint16(12, date, true);
        h.setUint32(14, c, true);
        h.setUint32(18, data.length, true);
        h.setUint32(22, data.length, true);
        h.setUint16(26, nb.length, true);
        h.setUint16(28, 0, true);
        parts.push(new Uint8Array(h.buffer), nb, data);
        const ch = new DataView(new ArrayBuffer(46));
        ch.setUint32(0, 0x02014b50, true);
        ch.setUint16(4, 20, true);
        ch.setUint16(6, 20, true);
        ch.setUint16(8, 0x0800, true);
        ch.setUint16(10, 0, true);
        ch.setUint16(12, time, true);
        ch.setUint16(14, date, true);
        ch.setUint32(16, c, true);
        ch.setUint32(20, data.length, true);
        ch.setUint32(24, data.length, true);
        ch.setUint16(28, nb.length, true);
        ch.setUint32(42, off, true);
        cen.push(new Uint8Array(ch.buffer), nb);
        off += 30 + nb.length + data.length;
      }
      const cs = cen.reduce((s, a) => s + a.length, 0);
      const e = new DataView(new ArrayBuffer(22));
      e.setUint32(0, 0x06054b50, true);
      e.setUint16(8, this.f.length, true);
      e.setUint16(10, this.f.length, true);
      e.setUint32(12, cs, true);
      e.setUint32(16, off, true);
      const all = [...parts, ...cen, new Uint8Array(e.buffer)];
      const out = new Uint8Array(all.reduce((s, a) => s + a.length, 0));
      let p = 0;
      all.forEach((a) => {
        out.set(a, p);
        p += a.length;
      });
      return out;
    }
    async generateAsync(o?: { mimeType?: string }) {
      return new Blob([this.generate()], { type: o?.mimeType || 'application/zip' });
    }
  }
  (window as any).JSZip = MiniZip;

  /* ---- MiniXLSX: เขียนไฟล์ Excel (.xlsx) แบบพื้นฐาน ---- */
  const x = (s: any) =>
    String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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
  const MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const PR = 'http://schemas.openxmlformats.org/package/2006/relationships';
  const ST: Record<string, number> = {
    title: 4,
    center: 5,
    th: 6,
    td: 7,
    tdc: 8,
    num: 9,
    qtyi: 10,
    tot: 11,
    totl: 12,
    rightb: 13,
    left: 14,
    n2: 15,
    bold: 16,
    tdb: 17,
  };
  (window as any).XLSX = {
    utils: {
      book_new: () => ({ sheets: [] }),
      aoa_to_sheet: (aoa: any[][]) => ({ aoa }),
      book_append_sheet: (wb: any, ws: any, name: string) => {
        ws.name = name;
        wb.sheets.push(ws);
      },
    },
    write(wb: any) {
      const z = new MiniZip();
      const S: any[] = wb.sheets;
      z.file(
        '[Content_Types].xml',
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${S.map(
          (_s, i) =>
            `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
        ).join('')}</Types>`
      );
      z.file(
        '_rels/.rels',
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${PR}"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`
      );
      z.file(
        'xl/workbook.xml',
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="${MAIN}" xmlns:r="${REL}"><sheets>${S.map(
          (s, i) => `<sheet name="${x(s.name || 'Sheet' + (i + 1))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`
        ).join('')}</sheets>${
          S.some((s) => s['!titles'])
            ? `<definedNames>${S.map((s, i) =>
                s['!titles']
                  ? `<definedName name="_xlnm.Print_Titles" localSheetId="${i}">'${x(
                      (s.name || 'Sheet' + (i + 1)).replace(/'/g, "''")
                    )}'!${s['!titles']}</definedName>`
                  : ''
              ).join('')}</definedNames>`
            : ''
        }</workbook>`
      );
      z.file(
        'xl/_rels/workbook.xml.rels',
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${PR}">${S.map(
          (_s, i) => `<Relationship Id="rId${i + 1}" Type="${REL}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
        ).join('')}<Relationship Id="rId${S.length + 1}" Type="${REL}/styles" Target="styles.xml"/></Relationships>`
      );
      z.file(
        'xl/styles.xml',
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="${MAIN}"><fonts count="3"><font><sz val="16"/><name val="TH SarabunPSK"/></font><font><b/><sz val="16"/><name val="TH SarabunPSK"/></font><font><b/><sz val="18"/><name val="TH SarabunPSK"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF2F2F2"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color auto="1"/></left><right style="thin"><color auto="1"/></right><top style="thin"><color auto="1"/></top><bottom style="thin"><color auto="1"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="18"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="4" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="3" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="4" fontId="1" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="right"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf><xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`
      );
      S.forEach((s, i) => {
        const cols = (s['!cols'] || [])
          .map((c: any, j: number) => `<col min="${j + 1}" max="${j + 1}" width="${(c && c.wch) || 10}" customWidth="1"/>`)
          .join('');
        const rows = (s.aoa || [])
          .map(
            (row: any[], r: number) =>
              `<row r="${r + 1}">${(row || [])
                .map((v, c) => {
                  const ref = colName(c) + (r + 1);
                  if (v && typeof v === 'object') {
                    const st = ST[v.s] != null ? ` s="${ST[v.s]}"` : '';
                    const val = v.v;
                    if (v.f)
                      return `<c r="${ref}"${st}><f>${x(v.f)}</f>${
                        typeof val === 'number' && isFinite(val) ? `<v>${val}</v>` : ''
                      }</c>`;
                    if (typeof val === 'number' && isFinite(val)) return `<c r="${ref}"${st}><v>${val}</v></c>`;
                    if (val === '' || val == null) return st ? `<c r="${ref}"${st}/>` : '';
                    return `<c r="${ref}"${st} t="inlineStr"><is><t xml:space="preserve">${x(val)}</t></is></c>`;
                  }
                  if (v === '' || v == null) return '';
                  if (typeof v === 'number' && isFinite(v))
                    return `<c r="${ref}" s="${Number.isInteger(v) ? 1 : 2}"><v>${v}</v></c>`;
                  return `<c r="${ref}" t="inlineStr"${r === 0 ? ' s="3"' : ''}><is><t xml:space="preserve">${x(
                    v
                  )}</t></is></c>`;
                })
                .join('')}</row>`
          )
          .join('');
        const mg = s['!merges'] || [];
        const ps = s['!page'];
        z.file(
          `xl/worksheets/sheet${i + 1}.xml`,
          `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${MAIN}" xmlns:r="${REL}">${
            ps ? '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>' : ''
          }${cols ? `<cols>${cols}</cols>` : ''}<sheetData>${rows}</sheetData>${
            mg.length ? `<mergeCells count="${mg.length}">${mg.map((m: string) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : ''
          }${
            ps
              ? `<pageMargins left="0.6" right="0.4" top="0.6" bottom="0.5" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="${
                  ps.land ? 'landscape' : 'portrait'
                }" fitToWidth="1" fitToHeight="0"/>`
              : ''
          }</worksheet>`
        );
      });
      return z.generate();
    },
  };

  /* ---- ฐานข้อมูลในเครื่อง (เก็บในเบราว์เซอร์นี้ LocalStorage) ---- */
  const KEY = 'kumwatsadu-db-v1';
  let store: Record<string, Record<string, any>> = {};
  let ok = true;
  function load() {
    try {
      store = JSON.parse(localStorage.getItem(KEY) || '{}') || {};
    } catch {
      store = {};
      ok = false;
    }
  }
  load();
  const subs: Array<{ c: string; id?: string; cb: (snap: any) => void }> = [];
  const clone = (v: any) => JSON.parse(JSON.stringify(v));
  const snapColl = (c: string) => {
    const o = store[c] || {};
    const docs = Object.keys(o).map((id) => ({ id, exists: true, data: () => o[id] }));
    return { docs, size: docs.length, empty: !docs.length };
  };
  const snapDoc = (c: string, id: string) => {
    const v = (store[c] || {})[id];
    return { id, exists: !!v, data: () => v };
  };
  const notify = (c: string) =>
    subs.forEach((s) => {
      if (s.c === c) s.cb(s.id ? snapDoc(c, s.id) : snapColl(c));
    });
  const gen = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(store));
    } catch (e) {
      throw { code: 'quota_exceeded', message: String(e) };
    }
  }
  function docRef(c: string, id: string) {
    return {
      id,
      async set(data: any) {
        store[c] = store[c] || {};
        const prev = store[c][id];
        store[c][id] = clone(data);
        try {
          persist();
        } catch (e) {
          if (prev === undefined) delete store[c][id];
          else store[c][id] = prev;
          throw e;
        }
        notify(c);
      },
      async delete() {
        if (!store[c] || !(id in store[c])) return;
        const prev = store[c][id];
        delete store[c][id];
        try {
          persist();
        } catch (e) {
          store[c][id] = prev;
          throw e;
        }
        notify(c);
      },
      onSnapshot(cb: (snap: any) => void) {
        const s = { c, id, cb };
        subs.push(s);
        setTimeout(() => cb(snapDoc(c, id)));
        return () => subs.splice(subs.indexOf(s), 1);
      },
    };
  }
  (window as any).localDb = {
    available: () => {
      try {
        const k = '__t';
        localStorage.setItem(k, '1');
        localStorage.removeItem(k);
        return ok;
      } catch {
        return false;
      }
    },
    collection(c: string) {
      return {
        doc: (id?: string) => docRef(c, id || gen()),
        onSnapshot(cb: (snap: any) => void) {
          const s = { c, cb };
          subs.push(s);
          setTimeout(() => cb(snapColl(c)));
          return () => subs.splice(subs.indexOf(s), 1);
        },
      };
    },
    doc(p: string) {
      const [c, id] = p.split('/');
      return docRef(c, id);
    },
    meta(k: string, v?: string) {
      const mk = KEY + ':' + k;
      try {
        if (v === undefined) return localStorage.getItem(mk);
        localStorage.setItem(mk, v);
      } catch {
        return null;
      }
    },
    reloadAll() {
      load();
      ['materials', 'moves', 'settings', 'counts'].forEach(notify);
    },
  };

  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      load();
      ['materials', 'moves', 'settings', 'counts'].forEach(notify);
    }
  });

  return (window as any).localDb;
}
