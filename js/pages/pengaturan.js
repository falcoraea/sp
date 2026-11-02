import { supa } from '../supa.js';
import { store } from '../store.js';
import { esc, toast, toastErr, pageHead } from '../ui.js';
import { APP_VERSION } from '../config.js';

export default {
  async render(el) {
    const s = store.settings;
    el.innerHTML = `${pageHead('Pengaturan', 'Berlaku untuk semua pegawai.')}
      <form class="stack" id="f">
        <section class="card stack"><h2 class="sec-title">Toko</h2>
          <label class="field">Nama toko (tampil di menu)<input class="input" name="nama_toko" value="${esc(s.nama_toko || '')}"></label></section>
        <section class="card stack"><h2 class="sec-title">Biaya & laba</h2><div class="grid gauto">
          <label class="field">Biaya bahan packing per resi<input class="input num" name="packing_cost" inputmode="numeric" value="${s.packing_cost}"></label>
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
        nama_toko: fd.get('nama_toko').trim() || 'Stok Gudang', packing_cost: +fd.get('packing_cost') || 0, hari_kerja: +fd.get('hari_kerja') || 26,
        shopee_fee_pct: +fd.get('shopee_fee_pct') || 0, jam_mulai: fd.get('jam_mulai'), jam_selesai: fd.get('jam_selesai'),
        retur_grace_days: +fd.get('retur_grace_days') || 2, wajib_foto_packing: fd.get('wajib_foto_packing') === 'on', updated_at: new Date().toISOString()
      };
      const { error } = await supa.from('settings').update(upd).eq('id', 1);
      if (error) return toastErr(error);
      Object.assign(store.settings, upd); toast('Pengaturan tersimpan', 'ok');
    });
  }
};
