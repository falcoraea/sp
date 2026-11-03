import { rpc } from '../supa.js';
import { store } from '../store.js';
import { esc, num, toast, toastErr, icon, modal } from '../ui.js';
import { pushPermission, subscribePush, sendTestPush, pushSupported } from '../push.js';
import { CURRENT, deviceLabel, fetchLatest } from '../version.js';

// Menu khusus super admin: alat teknis. Tidak terlihat oleh jabatan lain.
export default {
  async render(el) {
    if (!store.superadmin) { el.innerHTML = '<div class="alert red">Hanya untuk super admin.</div>'; return; }
    el.innerHTML = `<div class="stack" style="max-width:820px">
      <div class="alert yellow small">${icon('shield', 16)} Menu ini hanya terlihat oleh <b>super admin</b>. Semua tindakan di sini tercatat di Log aktivitas owner.</div>
      <section class="card stack" id="info"></section>
      <section class="card stack"><h2 class="sec-title">${icon('bell', 18)} Tes notifikasi HP</h2>
        <div class="small muted">Mengirim notifikasi tes ke perangkat ini. Tutup / kecilkan aplikasi setelah menekan tombol; notifikasi harus muncul dalam beberapa detik.</div>
        <div class="row wrap"><button class="btn btn-primary" id="ptest">Kirim notifikasi tes</button><button class="btn" id="preg">Daftarkan ulang perangkat ini</button></div>
        <div class="small" id="pst"></div></section>
      <section class="card stack danger-zone"><h2 class="sec-title" style="color:var(--red)">${icon('alert', 18)} Hapus semua data</h2>
        <div class="small">Menghapus <b>semua</b> barang, harga, rak, stok, pesanan, upload, beli WIN, retur, opname, notifikasi, kecurangan, log, absen, gaji, biaya, dan pengumuman.<br>
          <b>Tetap ada:</b> akun pegawai &amp; jabatan, pengaturan toko, daftar toko, dan pendaftaran notifikasi HP. <b>Tidak bisa dibatalkan.</b></div>
        <div id="keybox"></div></section>
    </div>`;

    const loadInfo = async () => {
      try {
        const [s, l] = await Promise.all([rpc('sa_status'), fetchLatest()]);
        el.querySelector('#info').innerHTML = `<h2 class="sec-title">Ringkasan data</h2>
          <div class="grid gkpi">${[['Barang', s.barang], ['Rak', s.rak], ['Pesanan', s.pesanan], ['Pergerakan stok', s.pergerakan_stok], ['Notifikasi', s.notifikasi], ['Log aktivitas', s.log], ['Pegawai', s.pegawai], ['HP terdaftar notifikasi', s.hp_notifikasi]].map(([k, v]) => `<div class="stat gray"><b>${num(v)}</b><span>${k}</span></div>`).join('')}</div>
          <div class="xs muted">Aplikasi v${esc(CURRENT.version)} (server v${esc(l?.version || '-')}) · ${esc(deviceLabel())} · masuk sebagai ${esc(store.role)}</div>`;
        paintKey(s.kunci_ada);
      } catch (e) { el.querySelector('#info').innerHTML = `<div class="alert yellow">Jalankan <b>supabase/update-2.1.sql</b> dulu. (${esc(e.message)})</div>`; }
    };

    const paintKey = (has) => {
      const box = el.querySelector('#keybox');
      box.innerHTML = has ? `<div class="grid g2">
          <label class="field">Kunci hapus<input class="input" id="k" type="password" autocomplete="off"></label>
          <label class="field">Ketik <b>HAPUS SEMUA DATA</b><input class="input" id="c" autocomplete="off" placeholder="HAPUS SEMUA DATA"></label></div>
        <div class="row wrap between"><button class="btn btn-ghost btn-sm" id="chg">Ganti kunci</button><button class="btn btn-dark" id="del" style="background:var(--red);border-color:var(--red)">Hapus semua data</button></div>`
        : `<div class="alert blue small">Buat <b>kunci hapus</b> dulu (minimal 8 karakter). Kunci ini disimpan teracak di server dan diminta setiap kali menghapus data. Simpan baik-baik: kalau lupa, hapus data tidak bisa dilakukan dari aplikasi.</div>
        <div class="grid g2"><label class="field">Kunci baru<input class="input" id="n1" type="password" autocomplete="new-password"></label><label class="field">Ulangi kunci<input class="input" id="n2" type="password" autocomplete="new-password"></label></div>
        <div class="row" style="justify-content:flex-end"><button class="btn btn-primary" id="mk">Simpan kunci</button></div>`;
      box.querySelector('#mk')?.addEventListener('click', async () => {
        const a = box.querySelector('#n1').value, b = box.querySelector('#n2').value;
        if (a.length < 8) return toast('Kunci minimal 8 karakter', 'err');
        if (a !== b) return toast('Kunci tidak sama', 'err');
        try { await rpc('sa_set_reset_key', { p_new: a }); toast('Kunci tersimpan', 'ok'); paintKey(true); } catch (e) { toastErr(e); }
      });
      box.querySelector('#chg')?.addEventListener('click', async () => {
        const r = await modal({ title: 'Ganti kunci hapus', body: `<div class="stack"><label class="field">Kunci lama<input class="input" id="o" type="password"></label><label class="field">Kunci baru (min. 8)<input class="input" id="n" type="password"></label></div>`,
          actions: [{ label: 'Batal', value: null }, { label: 'Simpan', cls: 'btn-primary', onClick: async (ov) => { await rpc('sa_set_reset_key', { p_new: ov.querySelector('#n').value, p_old: ov.querySelector('#o').value }); return true; } }] });
        if (r) toast('Kunci diganti', 'ok');
      });
      box.querySelector('#del')?.addEventListener('click', async (e) => {
        const key = box.querySelector('#k').value, conf = box.querySelector('#c').value;
        if (!key) return toast('Isi kunci hapus', 'err');
        if (conf.trim().toUpperCase() !== 'HAPUS SEMUA DATA') return toast('Ketik HAPUS SEMUA DATA', 'err');
        const ok = await modal({ title: 'Yakin hapus semua data?', body: '<p style="margin:0">Semua barang, stok, pesanan, dan laporan akan hilang permanen. Akun pegawai tetap ada.</p>',
          actions: [{ label: 'Batal', value: false }, { label: 'Ya, hapus permanen', cls: 'btn-dark', value: true }] });
        if (!ok) return;
        e.target.disabled = true;
        try { const r = await rpc('sa_reset_all', { p_key: key, p_confirm: conf }); toast(`Terhapus: ${r.barang} barang, ${r.pesanan} pesanan.`, 'ok'); loadInfo(); }
        catch (err) { toastErr(err); } finally { e.target.disabled = false; }
      });
    };

    el.querySelector('#ptest').onclick = async (e) => {
      if (!pushSupported()) return toast('Perangkat ini tidak mendukung notifikasi', 'err');
      if (pushPermission() !== 'granted') { const p = await Notification.requestPermission(); if (p !== 'granted') return toast('Izin notifikasi belum diberikan', 'err'); }
      e.target.disabled = true;
      try { await subscribePush(); await sendTestPush(); toast('Tes dikirim. Kecilkan aplikasi, tunggu beberapa detik.', 'ok'); el.querySelector('#pst').textContent = 'Terkirim ' + new Date().toLocaleTimeString('id-ID'); }
      catch (err) { toastErr(err); } finally { setTimeout(() => { e.target.disabled = false; }, 4000); }
    };
    el.querySelector('#preg').onclick = async () => { try { await subscribePush(); toast('Perangkat terdaftar', 'ok'); loadInfo(); } catch (err) { toastErr(err); } };
    loadInfo();
  }
};
