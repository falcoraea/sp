import { store } from './store.js';
import { modOn } from './modules.js';
// Daftar halaman, siapa yang boleh membuka, dan susunan menu per jabatan.
export const PAGES = {
  dashboard:  { label: 'Dashboard', icon: 'home', roles: ['owner'], group: '' },
  masalah:    { label: 'Kecurangan & masalah', short: 'Masalah', icon: 'shield', roles: ['owner'], group: '' },
  catat:      { label: 'Catat pesanan', short: 'Catat', icon: 'barcode', roles: ['owner', 'admin', 'kepala_gudang'], group: 'Penjualan' },
  pesanan:    { label: 'Pesanan', icon: 'bag', roles: ['owner', 'admin', 'cs'], group: 'Penjualan' },
  komplain:   { label: 'Komplain & garansi', short: 'Komplain', icon: 'alert', roles: ['owner', 'admin', 'cs'], group: 'Penjualan', mod: 'komplain' },
  katalog:    { label: 'Katalog grosir', short: 'Katalog', icon: 'tag', roles: ['owner', 'marketing'], group: 'Penjualan', mod: 'katalog' },
  upload:     { label: 'Upload file', short: 'Upload', icon: 'upload', roles: ['owner', 'admin', 'kepala_gudang'], group: 'Penjualan' },
  retur:      { label: 'Retur & cancel', short: 'Retur', icon: 'ret', roles: ['owner', 'admin', 'kepala_gudang'], group: 'Penjualan' },
  rekap:      { label: 'Rekap harian', short: 'Rekap', icon: 'calendar', roles: ['owner', 'admin'], group: 'Penjualan' },
  beli:       { label: 'Beli WIN', icon: 'truck', roles: ['owner', 'admin', 'kepala_gudang'], group: 'Gudang' },
  tugas:      { label: 'Tugas ambil', short: 'Tugas', icon: 'truck', roles: ['sopir'], group: 'Gudang' },
  terima:     { label: 'Terima barang WIN', short: 'Terima', icon: 'inbox', roles: ['owner', 'kepala_gudang'], group: 'Gudang' },
  ambil:      { label: 'Ambil dari rak', short: 'Ambil', icon: 'cart', roles: ['owner', 'picker', 'kepala_gudang'], group: 'Gudang' },
  packing:    { label: 'Packing', icon: 'bag', roles: ['owner', 'packing'], group: 'Gudang' },
  cek:        { label: 'Cek barcode', short: 'Cek', icon: 'search', roles: ['*'], group: 'Gudang' },
  qc:         { label: 'Cek QC paket', short: 'QC', icon: 'check', roles: ['owner', 'qc'], group: 'Gudang', mod: 'role_qc' },
  stok:       { label: 'Stok & rak', short: 'Stok', icon: 'box', roles: ['owner', 'admin', 'kepala_gudang', 'marketing'], group: 'Gudang' },
  gudang:     { label: 'Multi gudang', short: 'Gudang', icon: 'box', roles: ['owner', 'kepala_gudang'], group: 'Gudang', mod: 'gudang' },
  saran:      { label: 'Saran belanja stok', short: 'Saran', icon: 'cart', roles: ['owner', 'admin', 'kepala_gudang'], group: 'Gudang', mod: 'saran' },
  barang:     { label: 'Master barang', short: 'Barang', icon: 'grid', roles: ['owner', 'admin', 'kepala_gudang'], group: 'Gudang' },
  harga:      { label: 'Atur harga', short: 'Harga', icon: 'tag', roles: ['owner'], group: 'Keuangan' },
  laba:       { label: 'Laba per barang', short: 'Laba', icon: 'chart', roles: ['owner'], group: 'Keuangan' },
  gaji:       { label: 'Gaji & operasional', short: 'Gaji', icon: 'wallet', roles: ['owner'], group: 'Keuangan' },
  kas:        { label: 'Keuangan & kas', short: 'Kas', icon: 'wallet', roles: ['owner', 'keuangan'], group: 'Keuangan', mod: 'kas' },
  laporan:    { label: 'Laporan premium', short: 'Laporan', icon: 'chart', roles: ['owner', 'keuangan'], group: 'Keuangan', mod: 'laporan' },
  pajak:      { label: 'Pajak UMKM', short: 'Pajak', icon: 'receipt', roles: ['owner', 'keuangan'], group: 'Keuangan', mod: 'pajak' },
  kinerja:    { label: 'Kinerja pegawai', short: 'Kinerja', icon: 'users', roles: ['owner', 'supervisor'], group: 'Pengaturan', mod: 'kinerja' },
  'laporan-tg': { label: 'Laporan Telegram', short: 'Lap. Telegram', icon: 'send', roles: ['owner'], group: 'Pengaturan', mod: 'tg_laporan' },
  pegawai:    { label: 'Pegawai & jabatan', short: 'Pegawai', icon: 'users', roles: ['owner'], group: 'Pengaturan' },
  log:        { label: 'Log aktivitas', short: 'Log', icon: 'clock', roles: ['owner'], group: 'Pengaturan' },
  pengumuman: { label: 'Pengumuman', short: 'Info', icon: 'bell', roles: ['owner'], group: 'Pengaturan' },
  pengaturan: { label: 'Pengaturan', icon: 'gear', roles: ['owner'], group: 'Pengaturan' },
  modul:      { label: 'Menu tambahan', short: 'Tambahan', icon: 'lock', roles: ['owner'], group: 'Pengaturan' },
  tagihan:    { label: 'Tagihan', icon: 'receipt', roles: ['owner'], group: 'Pengaturan', hidden: true },   // dibuka dari ikon tagihan di bar atas
  absen:      { label: 'Absen', icon: 'clock', roles: ['owner', 'admin', 'sopir', 'kepala_gudang', 'picker', 'packing', 'keuangan', 'qc', 'cs', 'marketing'], group: 'Saya' },
  notifikasi: { label: 'Notifikasi', icon: 'bell', roles: ['*'], group: 'Saya', hidden: true },
  'pengaturan-scanner': { label: 'Pengaturan scanner', short: 'Scanner', icon: 'bt', roles: ['*'], group: 'Saya' },
  superadmin: { label: 'Super admin', short: 'Super', icon: 'shield', roles: ['*'], group: 'Super admin', sa: true },
  panduan:    { label: 'Panduan aplikasi', short: 'Panduan', icon: 'compass', roles: ['*'], group: 'Saya' },
  akun:       { label: 'Akun saya', short: 'Akun', icon: 'user', roles: ['*'], group: 'Saya' },
  menu:       { label: 'Semua menu', short: 'Lainnya', icon: 'grid', roles: ['*'], group: '', hidden: true }
};

// menu ikon bawah di HP (maks 4 + "Lainnya")
export const TABS = {
  owner: ['dashboard', 'masalah', 'rekap', 'harga'],
  admin: ['pesanan', 'upload', 'beli', 'barang'],
  sopir: ['tugas', 'absen', 'notifikasi', 'akun'],
  kepala_gudang: ['catat', 'beli', 'terima', 'stok'],
  picker: ['ambil', 'absen', 'notifikasi', 'akun'],
  packing: ['packing', 'absen', 'notifikasi', 'akun'],
  keuangan: ['kas', 'laporan', 'pajak', 'absen'],
  supervisor: ['catat', 'stok', 'kinerja', 'gudang'],
  qc: ['qc', 'cek', 'absen', 'notifikasi'],
  cs: ['komplain', 'pesanan', 'absen', 'notifikasi'],
  marketing: ['katalog', 'stok', 'absen', 'notifikasi']
};

export const HOME = { owner: 'dashboard', admin: 'pesanan', sopir: 'tugas', kepala_gudang: 'catat', picker: 'ambil', packing: 'packing',
  keuangan: 'kas', supervisor: 'catat', qc: 'qc', cs: 'komplain', marketing: 'katalog' };

export function canOpen(page, role) {
  const k = page, p = PAGES[page];
  if (p?.sa && !store.superadmin) return false;
  if (!p) return false;
  if (k === 'absen' && role === 'supervisor') return true;
  return p.roles.includes('*') || p.roles.includes(role) || (role === 'supervisor' && (p.roles.includes('kepala_gudang') || p.roles.includes('supervisor')));
}

// halaman terkunci (menu tambahan belum dibuka)?
export const isLocked = (page) => !!PAGES[page]?.mod && !modOn(PAGES[page].mod);

// owner tetap melihat menu yang terkunci (dengan gembok) supaya bisa membukanya; jabatan lain tidak
export function menuFor(role) {
  return Object.entries(PAGES).filter(([k, p]) => !p.hidden && canOpen(k, role) && (role === 'owner' || !isLocked(k)))
    .map(([k, p]) => ({ key: k, ...p, locked: isLocked(k) }));
}
