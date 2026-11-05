import { store } from './store.js';
// Daftar halaman, siapa yang boleh membuka, dan susunan menu per jabatan.
export const PAGES = {
  dashboard:  { label: 'Dashboard', icon: 'home', roles: ['owner'], group: '' },
  masalah:    { label: 'Kecurangan & masalah', short: 'Masalah', icon: 'shield', roles: ['owner'], group: '' },
  catat:      { label: 'Catat pesanan', short: 'Catat', icon: 'scan', roles: ['owner', 'admin', 'kepala_gudang'], group: 'Penjualan' },
  pesanan:    { label: 'Pesanan', icon: 'bag', roles: ['owner', 'admin'], group: 'Penjualan' },
  upload:     { label: 'Upload file', short: 'Upload', icon: 'upload', roles: ['owner', 'admin', 'kepala_gudang'], group: 'Penjualan' },
  retur:      { label: 'Retur & cancel', short: 'Retur', icon: 'ret', roles: ['owner', 'admin', 'kepala_gudang'], group: 'Penjualan' },
  rekap:      { label: 'Rekap harian', short: 'Rekap', icon: 'calendar', roles: ['owner', 'admin'], group: 'Penjualan' },
  beli:       { label: 'Beli WIN', icon: 'truck', roles: ['owner', 'admin', 'kepala_gudang'], group: 'Gudang' },
  tugas:      { label: 'Tugas ambil', short: 'Tugas', icon: 'truck', roles: ['sopir'], group: 'Gudang' },
  terima:     { label: 'Terima barang WIN', short: 'Terima', icon: 'scan', roles: ['owner', 'kepala_gudang'], group: 'Gudang' },
  ambil:      { label: 'Ambil dari rak', short: 'Ambil', icon: 'list', roles: ['owner', 'picker', 'kepala_gudang'], group: 'Gudang' },
  packing:    { label: 'Packing', icon: 'bag', roles: ['owner', 'packing'], group: 'Gudang' },
  cek:        { label: 'Cek barcode', short: 'Cek', icon: 'scan', roles: ['*'], group: 'Gudang' },
  stok:       { label: 'Stok & rak', short: 'Stok', icon: 'box', roles: ['owner', 'admin', 'kepala_gudang'], group: 'Gudang' },
  barang:     { label: 'Master barang', short: 'Barang', icon: 'list', roles: ['owner', 'admin', 'kepala_gudang'], group: 'Gudang' },
  harga:      { label: 'Atur harga', short: 'Harga', icon: 'tag', roles: ['owner'], group: 'Keuangan' },
  laba:       { label: 'Laba per barang', short: 'Laba', icon: 'chart', roles: ['owner'], group: 'Keuangan' },
  gaji:       { label: 'Gaji & operasional', short: 'Gaji', icon: 'wallet', roles: ['owner'], group: 'Keuangan' },
  pegawai:    { label: 'Pegawai & jabatan', short: 'Pegawai', icon: 'users', roles: ['owner'], group: 'Pengaturan' },
  log:        { label: 'Log aktivitas', short: 'Log', icon: 'clock', roles: ['owner'], group: 'Pengaturan' },
  pengumuman: { label: 'Pengumuman', short: 'Info', icon: 'bell', roles: ['owner'], group: 'Pengaturan' },
  pengaturan: { label: 'Pengaturan', icon: 'gear', roles: ['owner'], group: 'Pengaturan' },
  tagihan:    { label: 'Tagihan', icon: 'receipt', roles: ['owner'], group: 'Pengaturan' },
  absen:      { label: 'Absen', icon: 'clock', roles: ['admin', 'sopir', 'kepala_gudang', 'picker', 'packing'], group: 'Saya' },
  notifikasi: { label: 'Notifikasi', icon: 'bell', roles: ['*'], group: 'Saya', hidden: true },
  'pengaturan-scanner': { label: 'Pengaturan scanner', short: 'Scanner', icon: 'scan', roles: ['*'], group: 'Saya' },
  superadmin: { label: 'Super admin', short: 'Super', icon: 'shield', roles: ['*'], group: 'Super admin', sa: true },
  panduan:    { label: 'Panduan aplikasi', short: 'Panduan', icon: 'compass', roles: ['*'], group: 'Saya' },
  akun:       { label: 'Akun saya', short: 'Akun', icon: 'user', roles: ['*'], group: 'Saya' }
};

// menu ikon bawah di HP (maks 4 + "Lainnya")
export const TABS = {
  owner: ['dashboard', 'masalah', 'rekap', 'harga'],
  admin: ['pesanan', 'upload', 'beli', 'barang'],
  sopir: ['tugas', 'absen', 'notifikasi', 'akun'],
  kepala_gudang: ['catat', 'beli', 'terima', 'stok'],
  picker: ['ambil', 'absen', 'notifikasi', 'akun'],
  packing: ['packing', 'absen', 'notifikasi', 'akun']
};

export const HOME = { owner: 'dashboard', admin: 'pesanan', sopir: 'tugas', kepala_gudang: 'catat', picker: 'ambil', packing: 'packing' };

export function canOpen(page, role) {
  const p = PAGES[page];
  if (p?.sa && !store.superadmin) return false;
  return !!p && (p.roles.includes('*') || p.roles.includes(role));
}

export function menuFor(role) {
  return Object.entries(PAGES).filter(([k, p]) => !p.hidden && canOpen(k, role)).map(([k, p]) => ({ key: k, ...p }));
}
