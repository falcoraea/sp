import { supa } from '../supa.js';
import { store } from '../store.js';
import { esc, toast, toastErr, pageHead, icon, on, promptBox, confirmBox, num, parseNum } from '../ui.js';
import { APP_VERSION } from '../config.js';

export default {
  async render(el) {
    const s = store.settings;
    el.innerHTML = `${pageHead('Pengaturan', 'Berlaku untuk semua pegawai.')}
      <form class="stack" id="f">
        <section class="card stack"><h2 class="sec-title">Toko</h2>
          <label class="field">Nama toko (tampil di menu)<input class="input" name="nama_toko" value="${esc(s.nama_toko || '')}"></label></section>
        <section class="card stack"><h2 class="sec-title">Cara pesanan masuk</h2>
          <div class="list-item" style="padding:0;border:0"><div class="grow"><b>Upload file pesanan (pencocokan otomatis SKU)</b>
            <div class="small muted">Nyalakan kalau marketplace memakai SKU / kode barang yang sama dengan pricelist. Matikan kalau tidak ada SKU: pesanan dicatat kepala gudang di menu <b>Catat pesanan</b> (scan resi + scan barang).</div></div>
            <label class="switch"><input type="checkbox" name="upload_pesanan" ${s.upload_pesanan !== false ? 'checked' : ''} aria-label="Upload file pesanan"><span></span></label></div></section>
        <section class="card stack" id="stores"><div class="row between wrap"><h2 class="sec-title">Toko / marketplace</h2><button type="button" class="btn btn-sm" id="addstore">${icon('plus', 16)} Tambah toko</button></div>
          <div class="small muted">Dipilih kepala gudang saat scan resi. Rekap harian bisa dilihat per toko.</div><div id="storelist"></div></section>
        <section class="card stack"><h2 class="sec-title">Biaya & laba</h2><div class="grid gauto">
          <label class="field">Biaya bahan packing per resi<input class="input num" name="packing_cost" inputmode="numeric" data-money value="${num(s.packing_cost)}"></label>
          <label class="field">Hari kerja per bulan (pembagi gaji harian)<input class="input num" name="hari_kerja" inputmode="numeric" value="${s.hari_kerja}"></label>
          <label class="field">Estimasi potongan Shopee (%)<input class="input num" name="shopee_fee_pct" inputmode="decimal" value="${s.shopee_fee_pct}"></label></div>
          <div class="small muted">Rumus Harga 5% & harga beli diatur di menu <a href="#/harga">Atur harga</a>.</div></section>
        <section class="card stack"><h2 class="sec-title">Aturan deteksi masalah</h2><div class="grid gauto">
          <label class="field">Jam kerja mulai<input class="input" type="time" name="jam_mulai" value="${(s.jam_mulai || '07:00').slice(0, 5)}"></label>
          <label class="field">Jam kerja selesai<input class="input" type="time" name="jam_selesai" value="${(s.jam_selesai || '18:00').slice(0, 5)}"></label>
          <label class="field">Batas retur / cancel belum kembali (hari)<input class="input num" name="retur_grace_days" inputmode="numeric" value="${s.retur_grace_days}"></label></div>
          <label class="check"><input type="checkbox" name="wajib_foto_packing" ${s.wajib_foto_packing ? 'checked' : ''}> Wajib foto paket sebelum packing selesai</label>
          <div class="small muted">Stok yang diubah manual di luar jam kerja dilaporkan ke owner.</div></section>
        <button class="btn btn-primary btn-lg">Simpan pengaturan</button>
        <div class="xs muted">Versi aplikasi ${APP_VERSION}</div>
      </form>`;
    el.querySelector('#f').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const upd = {
        nama_toko: fd.get('nama_toko').trim() || 'Stok Gudang', packing_cost: parseNum(fd.get('packing_cost')) || 0, hari_kerja: +fd.get('hari_kerja') || 26,
        shopee_fee_pct: +fd.get('shopee_fee_pct') || 0, jam_mulai: fd.get('jam_mulai'), jam_selesai: fd.get('jam_selesai'),
        retur_grace_days: +fd.get('retur_grace_days') || 2, wajib_foto_packing: fd.get('wajib_foto_packing') === 'on', upload_pesanan: fd.get('upload_pesanan') === 'on', updated_at: new Date().toISOString()
      };
      const { error } = await supa.from('settings').update(upd).eq('id', 1);
      if (error) return toastErr(error);
      Object.assign(store.settings, upd); toast('Pengaturan tersimpan', 'ok');
    });

    // ---------- toko ----------
    const loadStores = async () => {
      const box = el.querySelector('#storelist');
      const { data, error } = await supa.from('stores').select('*').order('sort').order('name');
      if (error) { box.innerHTML = '<div class="alert yellow small">Jalankan <b>supabase/update-2.0.sql</b> dulu untuk memakai toko.</div>'; return; }
      box.innerHTML = data.length ? `<div class="list no-page">${data.map((t) => `<div class="list-item" style="padding:8px 0">
          <div class="grow"><b>${esc(t.name)}</b> <span class="tag">${esc(t.marketplace)}</span> ${t.active ? '' : '<span class="tag red">nonaktif</span>'}</div>
          <button type="button" class="btn btn-sm" data-sedit="${t.id}">Ubah</button><button type="button" class="btn btn-sm btn-ghost" data-stog="${t.id}" data-v="${t.active ? 0 : 1}">${t.active ? 'Nonaktifkan' : 'Aktifkan'}</button></div>`).join('')}</div>` : '<div class="muted small">Belum ada toko.</div>';
      el._stores = data;
    };
    const askStore = async (t = {}) => {
      const name = await promptBox(t.id ? 'Ubah toko' : 'Tambah toko', 'Nama toko (mis. AYRA)', { value: t.name || '' });
      if (!name) return null;
      const mk = await promptBox('Marketplace', 'Shopee / TikTok Shop / Tokopedia / Lazada / lainnya', { value: t.marketplace || 'Shopee' });
      if (!mk) return null;
      return { name: name.trim().toUpperCase(), marketplace: mk.trim() };
    };
    el.querySelector('#addstore').onclick = async () => {
      const v = await askStore(); if (!v) return;
      const { error } = await supa.from('stores').insert({ ...v, sort: (el._stores?.length || 0) + 1 });
      if (error) return toastErr(error); toast('Toko ditambahkan', 'ok'); loadStores();
    };
    on(el, 'click', '[data-sedit]', async (e, b) => {
      const t = el._stores.find((x) => x.id === +b.dataset.sedit); const v = await askStore(t); if (!v) return;
      const { error } = await supa.from('stores').update(v).eq('id', t.id); if (error) return toastErr(error); loadStores();
    });
    on(el, 'click', '[data-stog]', async (e, b) => {
      const { error } = await supa.from('stores').update({ active: b.dataset.v === '1' }).eq('id', +b.dataset.stog); if (error) return toastErr(error); loadStores();
    });
    loadStores();
  }
};
