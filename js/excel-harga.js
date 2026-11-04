// Excel "Pricelist + rekap per toko" (menu Atur harga › Unduh Excel)
// Tab 1 PRICELIST : pricelist terbaru + ringkasan (jumlah barang, kategori, dll).
// Tab berikutnya  : satu tab per toko untuk tanggal yang dipilih, format seperti rekap kertas.
//                   Ringkasan di atas memakai rumus: kalau resi & kode diketik manual di baris abu-abu,
//                   keterangan & harga terisi otomatis dari tab PRICELIST dan totalnya ikut berubah.
import { Book, colName } from './xlsx-writer.js';

const PINK = 'FF3EA5', PINK_SOFT = 'FDE3F1', RED_SOFT = 'F9E8E4', GREY = 'F3F2EE', MUTED = '6B6F6A';
const RP = '"Rp"#,##0';
export const EXTRA_ROWS = 50;   // baris kosong per toko untuk diisi manual
const PL_HEAD = 9;              // baris judul tabel di tab PRICELIST
const ST_HEAD = 8;              // baris judul tabel di tab toko

const sheetName = (s, used) => {
  let n = String(s || 'TOKO').replace(/[\\/?*[\]:']/g, ' ').trim().slice(0, 31) || 'TOKO';
  if (n.toUpperCase() === 'PRICELIST') n = 'TOKO ' + n;
  let k = n, i = 2;
  while (used.has(k.toUpperCase())) k = n.slice(0, 28) + ' ' + i++;
  used.add(k.toUpperCase());
  return k;
};

// data: { products, stores, rows (rekap_harian), settings, lastUpload, dateLabel, printedAt }
export function buildHargaBook({ products, stores = [], rows = [], settings = {}, lastUpload = null, dateLabel, printedAt }) {
  const s = settings;
  const kw = String(s.diskon_set_keyword || 'COMPLETE SET').toUpperCase();
  const wb = new Book();
  const st = {
    title: wb.style({ bold: true, size: 13, color: 'FFFFFF', fill: PINK, h: 'center', v: 'center' }),
    head: wb.style({ bold: true, color: 'FFFFFF', fill: PINK, border: true, h: 'center', v: 'center', wrap: true }),
    sub: wb.style({ italic: true, color: MUTED }),
    note: wb.style({ italic: true, size: 9, color: MUTED, wrap: true, v: 'top' }),
    lbl: wb.style({ bold: true, fill: PINK_SOFT, border: true, v: 'center' }),
    valN: wb.style({ bold: true, size: 12, border: true, h: 'right', fmt: '#,##0' }),
    valRp: wb.style({ bold: true, size: 12, border: true, h: 'right', fmt: RP }),
    valPct: wb.style({ bold: true, size: 12, border: true, h: 'right', fmt: '0.0%' }),
    valT: wb.style({ bold: true, size: 12, border: true, h: 'right' })
  };
  const cell = {};
  const cs = (o) => { const k = JSON.stringify(o); return (cell[k] ??= wb.style({ border: true, ...o })); };
  const summary = (ws, r, c1, c2, cv, label, value, vs) => {
    ws.merge(r, c1, r, c2);
    ws.set(r, c1, label, st.lbl); for (let c = c1 + 1; c <= c2; c++) ws.set(r, c, null, st.lbl);
    ws.set(r, cv, value, vs);
  };
  const title = (ws, text, last) => { ws.merge(1, 1, 1, last); ws.set(1, 1, text, st.title); for (let c = 2; c <= last; c++) ws.set(1, c, null, st.title); ws.height(1, 24); };
  const head = (ws, r, labels) => { labels.forEach((l, i) => ws.set(r, i + 1, l, st.head)); ws.height(r, 32); };

  // ---------------- tab PRICELIST ----------------
  const pl = [...products].sort((a, b) => String(a.category || '').localeCompare(String(b.category || '')) || String(a.name).localeCompare(String(b.name)));
  const ws = wb.sheet('PRICELIST', { cols: [6, 20, 44, 24, 14, 14, 18, 15, 11, 9], freezeRow: PL_HEAD });
  title(ws, 'PRICELIST WIN TERBARU', 10);
  ws.merge(2, 1, 2, 10);
  ws.set(2, 1, `Diunduh ${printedAt || ''}${lastUpload ? ` · pricelist terakhir diupload ${lastUpload}` : ''}`, st.sub);
  const cats = new Set(pl.map((p) => String(p.category || '').trim()).filter(Boolean));
  const nSet = pl.filter((p) => p.price_group === 'set').length;
  const nShp = pl.filter((p) => Number(p.harga_shopee) > 0).length;
  const sum = [
    ['Jumlah barang', pl.length, st.valN, 'Jumlah kategori / bagian', cats.size, st.valN],
    [`Bagian ${kw} (diskon beli ${s.diskon_set_pct ?? 30}%)`, nSet, st.valN, `Barang biasa (diskon beli ${s.diskon_beli_pct ?? 25}%)`, pl.length - nSet, st.valN],
    ['Sudah ada harga Shopee', nShp, st.valN, 'Belum ada harga Shopee', pl.length - nShp, st.valN],
    ['Harga dikunci owner', pl.filter((p) => p.price_locked).length, st.valN, 'Modal kosong (harga beli Rp0)', pl.filter((p) => !Number(p.harga_beli)).length, st.valN],
    ['Total Macallan (1 pcs tiap barang)', pl.reduce((a, p) => a + Number(p.macallan || 0), 0), st.valRp, 'Potongan harga 5% · est. potongan Shopee', `${s.potongan_5_pct ?? 5}% · ${s.shopee_fee_pct ?? 0}%`, st.valT]
  ];
  sum.forEach(([l1, v1, s1, l2, v2, s2], i) => { summary(ws, 3 + i, 2, 3, 4, l1, v1, s1); summary(ws, 3 + i, 5, 7, 8, l2, v2, s2); });
  head(ws, PL_HEAD, ['NO', 'KODE', 'KETERANGAN', 'KATEGORI', 'MACALLAN', 'HARGA 5%', 'HARGA BELI (25-30%)', 'HARGA SHOPEE', 'DISKON BELI', 'DIKUNCI']);
  const cN = cs({ h: 'center' }), cT = cs({ fmt: '@' }), cTx = cs({}), cR = cs({ fmt: RP }), cRz = cs({ fmt: RP, fill: RED_SOFT }), cP = cs({ fmt: '0%', h: 'center' });
  pl.forEach((p, i) => {
    const r = PL_HEAD + 1 + i;
    const d = p.diskon_pct ?? (p.price_group === 'set' ? (s.diskon_set_pct ?? 30) : (s.diskon_beli_pct ?? 25));
    ws.set(r, 1, i + 1, cN); ws.set(r, 2, String(p.sku || ''), cT); ws.set(r, 3, p.name || '', cTx); ws.set(r, 4, p.category || '', cTx);
    ws.set(r, 5, Number(p.macallan || 0), cR); ws.set(r, 6, Number(p.harga_5 || 0), cR); ws.set(r, 7, Number(p.harga_beli || 0), Number(p.harga_beli) ? cR : cRz);
    ws.set(r, 8, Number(p.harga_shopee || 0), cR); ws.set(r, 9, Number(d) / 100, cP); ws.set(r, 10, p.price_locked ? 'YA' : '', cN);
  });
  const plLast = PL_HEAD + Math.max(1, pl.length);
  ws.autoFilter(PL_HEAD, 1, plLast, 10);
  const PL = `PRICELIST!$B$${PL_HEAD + 1}:$H$${plLast}`;

  // ---------------- tab per toko ----------------
  const groups = new Map();
  stores.filter((t) => t.active !== false).forEach((t) => groups.set('id' + t.id, { name: t.name, orders: new Map() }));
  rows.forEach((r) => {
    const k = r.store_id ? 'id' + r.store_id : 'none';
    if (!groups.has(k)) groups.set(k, { name: r.store_name || 'TANPA TOKO', orders: new Map() });
    const g = groups.get(k).orders;
    if (!g.has(r.order_id)) g.set(r.order_id, []);
    g.get(r.order_id).push(r);
  });
  if (!groups.size) groups.set('none', { name: 'TOKO', orders: new Map() });
  const used = new Set(['PRICELIST']);
  const HEAD = ['NO', 'NO RESI', 'KODE', 'KETERANGAN', 'QTT', 'MACALLAN', 'HARGA 5%', 'HARGA BELI (25-30%)', 'HARGA SHOPEE', 'HARGA SELESAI', 'MARGIN', 'STATUS'];
  const C = (fill) => ({ n: cs({ h: 'center', ...(fill && { fill }) }), t: cs({ fmt: '@', ...(fill && { fill }) }), x: cs({ ...(fill && { fill }) }), r: cs({ fmt: RP, ...(fill && { fill }) }) });
  const norm = C(null), bad = C(RED_SOFT), grey = C(GREY);

  for (const { name, orders } of groups.values()) {
    const sh = wb.sheet(sheetName(name, used), { cols: [6, 22, 18, 42, 6, 13, 13, 17, 14, 15, 13, 12], freezeRow: ST_HEAD });
    title(sh, `${String(name).toUpperCase()} ${dateLabel}`, 12);
    head(sh, ST_HEAD, HEAD);
    let r = ST_HEAD + 1, n = 0;
    const tot = { resi: 0, qty: 0, mac: 0, beli: 0, shp: 0, sel: 0, mar: 0, bad: 0, lunas: 0 };
    for (const items of orders.values()) {
      n++; const o = items[0];
      const isBad = ['cancel', 'retur'].includes(o.status);
      const stt = o.status === 'cancel' ? 'CANCEL' : o.status === 'retur' ? 'RETUR' : o.paid ? 'LUNAS' : 'BELUM CAIR';
      tot.resi++; if (isBad) tot.bad++; if (stt === 'LUNAS') tot.lunas++;
      tot.mar += Number(o.margin || 0);
      const S = isBad ? bad : norm;
      items.forEach((i, k) => {
        const q = Number(i.qty || 1);
        const v = [Number(i.macallan || 0) * q, Number(i.harga_5 || 0) * q, Number(i.harga_beli || 0) * q, Number(i.harga_jual || 0) * q];
        tot.qty += q; tot.mac += v[0];
        if (!isBad) { tot.beli += v[2]; tot.shp += v[3]; if (k === 0) tot.sel += Number(o.harga_selesai || 0); }
        sh.set(r, 1, k === 0 ? n : null, S.n); sh.set(r, 2, k === 0 ? String(o.resi || o.order_no || '') : null, S.t); sh.set(r, 3, String(i.sku || ''), S.t);
        sh.set(r, 4, i.name || '', S.x); sh.set(r, 5, q, S.n);
        v.forEach((x, j) => sh.set(r, 6 + j, x, S.r));
        sh.set(r, 10, k === 0 ? Number(o.harga_selesai || 0) : null, S.r); sh.set(r, 11, k === 0 ? Number(o.margin || 0) : null, S.r);
        sh.set(r, 12, stt, S.n);
        r++;
      });
    }
    const first = ST_HEAD + 1;
    // baris kosong dengan rumus: isi NO RESI, KODE, QTT, HARGA SELESAI -> sisanya otomatis dari tab PRICELIST
    for (let k = 0; k < EXTRA_ROWS; k++, r++) {
      const key = `TRIM($C${r}&"")`, qty = `IF($E${r}="",1,$E${r})`;
      const look = (col) => ({ f: `IF($C${r}="","",IFERROR(VLOOKUP(${key},${PL},${col},FALSE)*${qty},0))`, v: '' });
      sh.set(r, 1, { f: `IF($B${r}="","",COUNTA($B$${first}:$B${r}))`, v: '' }, grey.n);
      sh.set(r, 2, null, norm.t); sh.set(r, 3, null, norm.t);
      sh.set(r, 4, { f: `IF($C${r}="","",IFERROR(VLOOKUP(${key},${PL},2,FALSE),"KODE TIDAK ADA DI PRICELIST"))`, v: '' }, grey.x);
      sh.set(r, 5, null, norm.n);
      [4, 5, 6, 7].forEach((col, j) => sh.set(r, 6 + j, look(col), grey.r));
      sh.set(r, 10, null, norm.r);
      sh.set(r, 11, { f: `IF($J${r}="","",$J${r}-$H${r})`, v: '' }, grey.r);
      sh.set(r, 12, null, norm.n);
    }
    const last = r - 1;
    const R = (col) => `$${col}$${first}:$${col}$${last}`;
    const ok = (col) => `SUMIFS(${R(col)},${R('L')},"<>CANCEL",${R('L')},"<>RETUR")`;
    summary(sh, 2, 2, 3, 4, 'Jumlah resi', { f: `COUNTA(${R('B')})`, v: tot.resi }, st.valN);
    summary(sh, 3, 2, 3, 4, 'Total barang (qty)', { f: `SUM(${R('E')})`, v: tot.qty }, st.valN);
    summary(sh, 4, 2, 3, 4, 'Total Macallan', { f: `SUM(${R('F')})`, v: tot.mac }, st.valRp);
    summary(sh, 5, 2, 3, 4, 'Resi cancel / retur', { f: `COUNTIFS(${R('L')},"CANCEL",${R('B')},"<>")+COUNTIFS(${R('L')},"RETUR",${R('B')},"<>")`, v: tot.bad }, st.valN);
    summary(sh, 6, 2, 3, 4, 'Resi sudah cair', { f: `COUNTIFS(${R('L')},"LUNAS",${R('B')},"<>")`, v: tot.lunas }, st.valN);
    summary(sh, 2, 6, 8, 9, 'Total modal (harga beli)', { f: ok('H'), v: tot.beli }, st.valRp);
    summary(sh, 3, 6, 8, 9, 'Total harga Shopee', { f: ok('I'), v: tot.shp }, st.valRp);
    summary(sh, 4, 6, 8, 9, 'Total harga selesai (pendapatan)', { f: ok('J'), v: tot.sel }, st.valRp);
    summary(sh, 5, 6, 8, 9, 'Total margin', { f: `SUM(${R('K')})`, v: tot.mar }, st.valRp);
    summary(sh, 6, 6, 8, 9, 'Margin dari pendapatan', { f: 'IFERROR(I5/I4,0)', v: tot.sel ? tot.mar / tot.sel : 0 }, st.valPct);
    sh.merge(2, 10, 6, 12);
    sh.set(2, 10, 'Baris abu-abu: cukup ketik NO RESI, KODE, QTT & HARGA SELESAI. Keterangan, harga & margin terisi otomatis dari tab PRICELIST, ringkasan di kiri ikut berubah. Resi berisi beberapa barang: tulis harga selesai di baris pertama.', st.note);
  }
  return { wb, stores: groups.size, products: pl.length, resi: new Set(rows.map((x) => x.order_id)).size, colName };
}

export async function downloadHargaExcel({ date, products }) {
  const [{ supa, rpc }, { store }, ui] = await Promise.all([import('./supa.js'), import('./store.js'), import('./ui.js')]);
  const [{ data: stores, error: e1 }, { data: lastPl }, rows] = await Promise.all([
    supa.from('stores').select('id, name, active').order('sort').order('name'),
    supa.from('uploads').select('created_at, filename').eq('type', 'pricelist').order('created_at', { ascending: false }).limit(1),
    rpc('rekap_harian', { p_date: date })
  ]);
  if (e1) throw e1;
  const lu = lastPl?.[0];
  const out = buildHargaBook({
    products, stores: stores || [], rows: rows || [], settings: store.settings || {},
    lastUpload: lu ? ui.fmtDate(lu.created_at) + (lu.filename ? ` (${lu.filename})` : '') : null,
    dateLabel: ui.fmtDate(date, { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase(),
    printedAt: ui.fmtDateTime(new Date())
  });
  const blob = await out.wb.toBlob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `pricelist-dan-toko-${date}.xlsx`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return out;
}
