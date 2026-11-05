import { store } from '../store.js';
import { TABS, menuFor } from '../nav.js';
import { esc, icon, debounce } from '../ui.js';
import { versionLabel } from '../version.js';

// Halaman "Lainnya" (HP): semua menu sebagai ikon per kategori, seperti menu di aplikasi marketplace.
export const GROUP_STYLE = {
  '': ['Utama', '#4A524D', '#1A1D1B'], Penjualan: ['Penjualan', '#F0765E', '#B8402A'], Gudang: ['Gudang', '#34B377', '#16663F'],
  Keuangan: ['Keuangan', '#F7C548', '#D58A00'], Pengaturan: ['Pengaturan', '#5A8DE0', '#22488F'], Saya: ['Saya', '#9C7BE0', '#5B3E9A'], 'Super admin': ['Super admin', '#E2614C', '#8A2E20']
};
const DESC = {
  catat: 'Scan resi & barang', pesanan: 'Daftar pesanan', upload: 'File Shopee & pricelist', retur: 'Retur & cancel', rekap: 'Rekap per toko',
  beli: 'Belanja ke WIN', terima: 'Barang datang', ambil: 'Ambil dari rak', packing: 'Kemas paket', cek: 'Cek kode', stok: 'Stok & rak', barang: 'Master barang',
  harga: 'Rumus harga', laba: 'Laba per barang', gaji: 'Gaji & biaya', pegawai: 'Akun pegawai', log: 'Riwayat aktivitas', pengumuman: 'Info ke pegawai', pengaturan: 'Pengaturan toko',
  absen: 'Absen harian', 'pengaturan-scanner': 'Scanner & kamera', panduan: 'Cara pakai', akun: 'Profil & password', dashboard: 'Ringkasan', masalah: 'Kecurangan', tugas: 'Tugas sopir', notifikasi: 'Notifikasi', superadmin: 'Alat teknis'
};

export default {
  async render(el) {
    const tabs = new Set(TABS[store.role] || []);
    const all = menuFor(store.role).filter((m) => m.key !== 'menu');
    el.innerHTML = `<div class="stack menu-page">
      <input class="input menu-search" id="mq" placeholder="Cari menu…" aria-label="Cari menu" autocomplete="off">
      <div id="mg"></div>
      <div class="menu-foot"><button class="btn" id="m-lo">${icon('logout', 18)} Keluar</button><button class="btn btn-ghost" id="m-ver">${icon('refresh', 16)} Versi ${esc(versionLabel())}</button></div>
    </div>`;
    const paint = (q = '') => {
      q = q.trim().toLowerCase();
      // menu di bar bawah tetap ditampilkan juga, supaya halaman ini lengkap
      const list = all.filter((m) => !q || (m.label + ' ' + (m.short || '') + ' ' + (DESC[m.key] || '')).toLowerCase().includes(q));
      const groups = [];
      list.forEach((m) => { const g = m.group || ''; let x = groups.find((y) => y.g === g); if (!x) groups.push((x = { g, items: [] })); x.items.push(m); });
      el.querySelector('#mg').innerHTML = groups.length ? groups.map(({ g, items }) => {
        const [label, c1, c2] = GROUP_STYLE[g] || [g, '#6B706C', '#3A403C'];
        return `<section class="menu-cat"><h3><i style="background:${c1}"></i>${esc(label)}</h3><div class="menu-grid">${items.map((m) => `<a class="menu-tile" href="#/${m.key}">
          <span class="mt-ic" style="--c1:${c1};--c2:${c2}">${icon(m.icon, 24, 2.1)}${tabs.has(m.key) ? '<span class="mt-pin" title="Ada di menu bawah"></span>' : ''}</span>
          <span class="mt-lbl">${esc(m.short || m.label)}</span></a>`).join('')}</div></section>`;
      }).join('') : '<div class="muted small" style="text-align:center;padding:24px">Menu tidak ditemukan.</div>';
    };
    el.querySelector('#mq').addEventListener('input', debounce((e) => paint(e.target.value), 120));
    // tombol keluar & versi memakai tombol yang sama dengan menu samping
    el.querySelector('#m-lo').onclick = () => document.querySelector('[data-logout]')?.click();
    el.querySelector('#m-ver').onclick = () => document.querySelector('.side-ver[data-ver]')?.click();
    paint();
  }
};
