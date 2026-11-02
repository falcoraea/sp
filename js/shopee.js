import { xlsx, parseNum } from './ui.js';

// Nama kolom yang dikenali dari file ekspor Shopee Seller Center & pricelist WIN.
// Kalau nama kolom di file kamu berbeda, pilih manual di layar upload (disimpan otomatis).
export const TYPES = {
  pesanan: {
    label: 'Pesanan', desc: 'Pesanan siap kirim. Jadi daftar picker & daftar beli WIN.',
    fields: {
      order_no: ['No. Pesanan', 'Nomor Pesanan', 'Order ID', 'No Pesanan'],
      resi: ['No. Resi', 'Nomor Resi', 'Tracking Number', 'No Resi'],
      status: ['Status Pesanan', 'Order Status', 'Status'],
      order_date: ['Waktu Pesanan Dibuat', 'Tanggal Pesanan', 'Order Creation Date', 'Waktu Pembuatan'],
      sku: ['Nomor Referensi SKU', 'SKU Induk', 'SKU Reference No.', 'Parent SKU', 'SKU', 'Kode Variasi'],
      name: ['Nama Produk', 'Product Name'],
      variant: ['Nama Variasi', 'Variation Name'],
      qty: ['Jumlah', 'Quantity', 'Qty'],
      price: ['Harga Setelah Diskon', 'Deal Price', 'Harga Awal', 'Original Price'],
      cancel_reason: ['Alasan Pembatalan', 'Cancel reason']
    },
    required: ['order_no', 'name', 'qty'],
    labels: { order_no: 'No. Pesanan', resi: 'No. Resi', status: 'Status', order_date: 'Tanggal', sku: 'Kode / SKU', name: 'Nama produk', variant: 'Variasi', qty: 'Jumlah', price: 'Harga jual', cancel_reason: 'Alasan batal' }
  },
  pembatalan: {
    label: 'Pembatalan', desc: 'Pesanan cancel. Barang yang sudah diambil dikembalikan ke rak.',
    fields: { order_no: ['No. Pesanan', 'Nomor Pesanan', 'Order ID'], reason: ['Alasan Pembatalan', 'Cancel reason', 'Alasan'] },
    required: ['order_no'], labels: { order_no: 'No. Pesanan', reason: 'Alasan' }
  },
  pengembalian: {
    label: 'Pengembalian / retur', desc: 'Retur pembeli. Dicocokkan dengan scan retur di gudang.',
    fields: {
      order_no: ['No. Pesanan', 'Nomor Pesanan', 'Order ID'], return_no: ['No. Pengembalian', 'Return ID', 'Nomor Pengembalian', 'ID Pengembalian'],
      reason: ['Alasan Pengembalian', 'Return Reason', 'Alasan'], received_at: ['Waktu Pengembalian Diterima', 'Tanggal Pengembalian', 'Waktu Pengajuan', 'Tanggal']
    },
    required: ['order_no'], labels: { order_no: 'No. Pesanan', return_no: 'No. Pengembalian', reason: 'Alasan', received_at: 'Tanggal' }
  },
  penghasilan: {
    label: 'Penghasilan', desc: 'Dana yang sudah cair per resi. Mengisi "harga selesai" & omzet lunas.',
    fields: {
      order_no: ['No. Pesanan', 'Nomor Pesanan', 'Order ID'],
      amount: ['Total Penghasilan', 'Jumlah Dana Dilepaskan', 'Total Dana Dilepaskan', 'Total Released Amount', 'Penghasilan', 'Jumlah'],
      paid_at: ['Tanggal Dana Dilepaskan', 'Waktu Dana Dilepaskan', 'Payout Completed Date', 'Tanggal']
    },
    required: ['order_no', 'amount'], labels: { order_no: 'No. Pesanan', amount: 'Dana cair', paid_at: 'Tanggal cair' }
  },
  rak: {
    label: 'Kode rak', desc: 'Daftar kode rak gudang (mis. A-01, A-02). Bisa juga dibuat manual di Stok & rak.',
    fields: { code: ['Kode Rak', 'Rak', 'Kode'], note: ['Keterangan', 'Catatan', 'Isi Rak'] },
    required: ['code'], labels: { code: 'Kode rak', note: 'Keterangan' }
  },
  stok_awal: {
    label: 'Stok fisik per rak', desc: 'Hasil hitung fisik awal: rak, kode barang, jumlah. Mengisi stok & lokasi rak sekaligus.',
    fields: { rack: ['Kode Rak', 'Rak', 'Lokasi'], sku: ['Part Number', 'Kode Barang', 'Kode', 'Barcode', 'SKU'], name: ['Nama Barang', 'Nama'], qty: ['Jumlah Fisik', 'Jumlah', 'Qty', 'Stok', 'Stock'] },
    required: ['rack', 'sku', 'qty'], labels: { rack: 'Kode rak', sku: 'Kode barang', name: 'Nama (tidak wajib)', qty: 'Jumlah fisik' }
  },
  pricelist: {
    label: 'Pricelist WIN', desc: 'Harga terbaru dari pabrik (Macallan). Harga 5% & harga beli dihitung otomatis.',
    fields: {
      sku: ['Kode', 'Kode Barang', 'Part Number', 'Part No', 'SKU', 'Barcode'], name: ['Nama Barang', 'Nama', 'Keterangan', 'Deskripsi'],
      macallan: ['Macallan', 'Harga WIN', 'HET', 'Harga'], harga_shopee: ['Harga Shopee'], category: ['Kategori', 'Category']
    },
    required: ['sku', 'macallan'], labels: { sku: 'Kode', name: 'Nama barang', macallan: 'Macallan', harga_shopee: 'Harga Shopee', category: 'Kategori' }
  }
};

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

export async function readSheet(file) {
  const X = await xlsx();
  const buf = await file.arrayBuffer();
  const wb = X.read(buf, { type: 'array', cellDates: false });
  // file bisa punya banyak sheet (mis. pricelist WIN: SAMPUL, Daftar Isi, ALL PRICELIST) -> pilih sheet yang paling mirip tabel data
  let best = null;
  for (const name of wb.SheetNames) {
    const rows = X.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, defval: '' });
    const d = detect(rows);
    const score = d.score * 100000 + rows.length;
    if (!best || score > best.score) best = { rows, score, name };
  }
  return best ? best.rows : [];
}

function scoreRow(row, type) {
  const cells = row.map(norm);
  let n = 0, missingReq = 0;
  for (const [f, aliases] of Object.entries(TYPES[type].fields)) {
    const hit = aliases.some((a) => cells.includes(norm(a)));
    if (hit) n++; else if (TYPES[type].required.includes(f)) missingReq++;
  }
  return n - missingReq * 2;
}

export function detect(rows) {
  let best = { type: null, headerRow: 0, score: 0 };
  for (let r = 0; r < Math.min(rows.length, 25); r++) {
    for (const t of Object.keys(TYPES)) {
      const s = scoreRow(rows[r], t) - (t === 'pesanan' ? 0 : 0.5);
      if (s > best.score) best = { type: t, headerRow: r, score: s };
    }
  }
  return best;
}

export function findHeaderRow(rows, type) {
  let best = 0, bestScore = -1;
  for (let r = 0; r < Math.min(rows.length, 25); r++) {
    const s = scoreRow(rows[r], type);
    if (s > bestScore) { best = r; bestScore = s; }
  }
  return best;
}

export function autoMap(headers, type, rows = [], headerRow = 0) {
  const saved = JSON.parse(localStorage.getItem('map-' + type) || '{}');
  const H = headers.map(norm);
  const map = {};
  const sample = rows.slice(headerRow + 1, headerRow + 80);
  const fill = (i) => sample.reduce((a, r) => a + String(r[i] ?? '').trim().length, 0);
  for (const [f, aliases] of Object.entries(TYPES[type].fields)) {
    if (saved[f] && headers.includes(saved[f])) { map[f] = headers.indexOf(saved[f]); continue; }
    let idx = -1;
    for (const a of aliases) {
      const all = H.map((h, i) => (h === norm(a) ? i : -1)).filter((i) => i > -1);
      if (all.length) { idx = all.length > 1 && sample.length ? all.sort((x, y) => fill(y) - fill(x))[0] : all[0]; break; }
    }
    if (idx === -1) for (const a of aliases) { idx = H.findIndex((h) => h && h.includes(norm(a))); if (idx > -1) break; }
    map[f] = idx;
  }
  return map;
}
export function saveMap(headers, type, map) {
  const o = {};
  for (const [f, i] of Object.entries(map)) if (i > -1) o[f] = headers[i];
  localStorage.setItem('map-' + type, JSON.stringify(o));
}

function toTs(v) {
  if (v === '' || v == null) return null;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}T${m[4] || '00'}:${m[5] || '00'}:${m[6] || '00'}+07:00`;
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}T${(m[4] || '0').padStart(2, '0')}:${m[5] || '00'}:00+07:00`; }
  const d = new Date(s);
  return isNaN(d) ? null : d.toISOString();
}
const isCancelStatus = (s) => /batal|cancel/i.test(s || '');

// ubah baris file menjadi data siap kirim ke database
export function build(rows, headerRow, type, map) {
  const data = rows.slice(headerRow + 1).filter((r) => r.some((c) => String(c).trim() !== ''));
  const get = (r, f) => (map[f] > -1 ? String(r[map[f]] ?? '').trim() : '');
  if (type === 'pesanan') {
    const orders = new Map(); const cancels = [];
    for (const r of data) {
      const no = get(r, 'order_no'); if (!no) continue;
      const status = get(r, 'status');
      if (isCancelStatus(status)) { if (!cancels.find((c) => c.order_no === no)) cancels.push({ order_no: no, reason: get(r, 'cancel_reason') || status }); continue; }
      if (!orders.has(no)) orders.set(no, { order_no: no, resi: get(r, 'resi'), order_date: toTs(get(r, 'order_date')), shopee_status: status, items: [] });
      const o = orders.get(no);
      if (!o.resi) o.resi = get(r, 'resi');
      const variant = get(r, 'variant');
      o.items.push({ sku: get(r, 'sku'), name: get(r, 'name') + (variant ? ' - ' + variant : ''), qty: Math.max(1, Math.round(parseNum(get(r, 'qty')) || 1)), price: parseNum(get(r, 'price')) });
    }
    return { orders: [...orders.values()], cancels };
  }
  if (type === 'pembatalan') return { rows: uniq(data.map((r) => ({ order_no: get(r, 'order_no'), reason: get(r, 'reason') })).filter((x) => x.order_no), 'order_no') };
  if (type === 'pengembalian') return { rows: data.map((r) => ({ order_no: get(r, 'order_no'), return_no: get(r, 'return_no'), reason: get(r, 'reason'), received_at: toTs(get(r, 'received_at')) })).filter((x) => x.order_no) };
  if (type === 'penghasilan') {
    const m = new Map();
    for (const r of data) {
      const no = get(r, 'order_no'); if (!no) continue;
      const prev = m.get(no);
      m.set(no, { order_no: no, amount: (prev?.amount || 0) + parseNum(get(r, 'amount')), paid_at: toTs(get(r, 'paid_at')) });
    }
    return { rows: [...m.values()] };
  }
  if (type === 'rak') return { rows: uniq(data.map((r) => ({ code: get(r, 'code').toUpperCase(), note: get(r, 'note') })).filter((x) => x.code), 'code') };
  if (type === 'stok_awal') {
    const m = new Map();
    for (const r of data) {
      const sku = get(r, 'sku'); if (!sku) continue;
      const rack = get(r, 'rack').toUpperCase(); const k = rack + '|' + sku;
      const prev = m.get(k);
      m.set(k, { rack, sku, name: get(r, 'name'), qty: (prev?.qty || 0) + Math.max(0, Math.round(parseNum(get(r, 'qty')))) });
    }
    return { rows: [...m.values()] };
  }
  if (type === 'pricelist') return { rows: uniq(data.map((r) => ({ sku: get(r, 'sku'), name: get(r, 'name'), macallan: parseNum(get(r, 'macallan')), harga_shopee: map.harga_shopee > -1 ? parseNum(get(r, 'harga_shopee')) : null, category: get(r, 'category') })).filter((x) => x.sku && x.macallan > 0), 'sku') };
  return {};
}
const uniq = (arr, k) => { const s = new Set(); return arr.filter((x) => (s.has(x[k]) ? false : s.add(x[k]))); };
