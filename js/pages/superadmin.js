import { rpc, supa } from '../supa.js';
import { SUPABASE_URL } from '../config.js';
import { billRow } from '../billing.js';
import { store } from '../store.js';
import { esc, num, rp, toast, toastErr, icon, modal, on, parseNum, todayStr, addDays, confirmBox, promptBox } from '../ui.js';
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
      <section class="card stack" id="billing"><h2 class="sec-title">${icon('receipt', 18)} Tagihan &amp; pembayaran (Mayar)</h2><div class="skeleton" style="height:120px"></div></section>
      <section class="card flush" id="bills"></section>
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
    loadBilling = billingUI(el); loadBilling();
  }
};

// ---------- tagihan: diatur super admin, dibayar owner ----------
function billingUI(root) {
  const box = root.querySelector('#billing'), list = root.querySelector('#bills');
  const load = async () => {
    let st, cfg;
    try {
      st = await rpc('billing_status');
      ({ data: cfg } = await supa.from('billing_config').select('*').eq('id', 1).single());
    } catch (e) { box.innerHTML = `<h2 class="sec-title">${icon('receipt', 18)} Tagihan &amp; pembayaran</h2><div class="alert yellow small">Jalankan <b>supabase/update-2.5.sql</b> dulu. (${esc(e.message)})</div>`; return; }
    const hook = `${SUPABASE_URL}/functions/v1/tagihan?hook=${st.hook_token || ''}`;
    box.innerHTML = `<h2 class="sec-title">${icon('receipt', 18)} Tagihan &amp; pembayaran (Mayar)</h2>
      <div class="small muted">Owner melihat & membayar tagihan di menu <b>Tagihan</b>. Tagihan bulanan dibuat otomatis setiap tanggal 1${st.cron ? '' : ' (penjadwal pg_cron belum aktif: tagihan dibuat saat aplikasi dibuka)'}, ditambah pengingat H-3, saat jatuh tempo, dan 3 hari setelah terlambat.</div>
      <h3 class="sub-title">Tagihan bulanan</h3>
      <div class="list-item" style="padding:0;border:0"><div class="grow"><b>Tagih setiap bulan</b><div class="small muted">Matikan kalau pelanggan belum mulai berlangganan.</div></div>
        <label class="switch"><input type="checkbox" id="b-on" ${cfg.active ? 'checked' : ''} aria-label="Tagihan bulanan aktif"><span></span></label></div>
      <div class="grid gauto fields-end">
        <label class="field">Nominal per bulan (Rp)<input class="input num" id="b-amt" data-money inputmode="numeric" value="${num(cfg.monthly_amount)}"></label>
        <label class="field">Jatuh tempo tanggal (1–28)<input class="input num" id="b-due" inputmode="numeric" value="${cfg.due_day}"></label>
        <label class="field">Mulai ditagih bulan<input class="input" type="month" id="b-start" value="${cfg.start_month ? cfg.start_month.slice(0, 7) : ''}"></label>
      </div>
      <label class="field">Judul tagihan (nama bulan ditambahkan otomatis)<input class="input" id="b-title" value="${esc(cfg.monthly_title)}"></label>
      <label class="field">Keterangan (tampil di tagihan owner)<textarea class="input" id="b-desc" rows="2" placeholder="mis. Server, backup harian, perawatan & dukungan">${esc(cfg.monthly_desc || '')}</textarea></label>
      <h3 class="sub-title">Data pembayar di invoice Mayar</h3>
      <div class="grid gauto fields-end">
        <label class="field">Nama (kosong = nama toko)<input class="input" id="b-pn" value="${esc(cfg.pay_name || '')}"></label>
        <label class="field">Email (kosong = email owner)<input class="input" id="b-pe" type="email" value="${esc(cfg.pay_email || '')}"></label>
        <label class="field">No. HP / WA (wajib di Mayar)<input class="input" id="b-pm" inputmode="tel" value="${esc(cfg.pay_mobile || '')}" placeholder="08xxxxxxxxxx"></label>
      </div>
      <h3 class="sub-title">Koneksi Mayar</h3>
      <div class="grid gauto fields-end">
        <label class="field">Mode<select class="input" id="b-mode"><option value="sandbox" ${cfg.mayar_mode !== 'production' ? 'selected' : ''}>Sandbox (uji coba, uang tidak sungguhan)</option><option value="production" ${cfg.mayar_mode === 'production' ? 'selected' : ''}>Production (pembayaran asli)</option></select></label>
        <label class="field">Kunci API Mayar ${st.mayar_ready ? '<span class="tag green">tersimpan</span>' : '<span class="tag red">belum ada</span>'}<input class="input mono" id="b-key" type="password" autocomplete="off" placeholder="${st.mayar_ready ? 'kosongkan = tetap pakai kunci lama' : 'tempel kunci API dari web.mayar.id/api-keys'}"></label>
      </div>
      <label class="field">Alamat webhook (tempel di Mayar › Integrasi › Webhook)<div class="row" style="flex-wrap:nowrap"><input class="input mono xs grow" id="b-hook" readonly value="${esc(hook)}"><button type="button" class="btn btn-sm" id="b-copy">Salin</button><button type="button" class="btn btn-sm btn-ghost" id="b-reset" title="Buat alamat baru (alamat lama tidak berlaku)">Ganti</button></div></label>
      <div class="row wrap" style="justify-content:flex-end"><button class="btn" id="b-now">Buat tagihan bulan ini sekarang</button><button class="btn btn-primary" id="b-save">Simpan pengaturan tagihan</button></div>
      <h3 class="sub-title">Tagihan khusus</h3>
      <div class="small muted">Tagihan sekali bayar, mis. pemasangan, aplikasi Android, tambahan fitur.</div>
      <div class="grid gauto fields-end">
        <label class="field">Judul<input class="input" id="k-title" placeholder="mis. Pembuatan aplikasi Android"></label>
        <label class="field">Nominal (Rp)<input class="input num" id="k-amt" data-money inputmode="numeric"></label>
        <label class="field">Jatuh tempo<input class="input" type="date" id="k-due" value="${addDays(todayStr(), 7)}"></label>
      </div>
      <label class="field">Keterangan<textarea class="input" id="k-desc" rows="2"></textarea></label>
      <div class="row" style="justify-content:flex-end"><button class="btn btn-dark" id="k-add">${icon('plus', 16)} Buat tagihan khusus</button></div>`;

    box.querySelector('#b-copy').onclick = async () => { try { await navigator.clipboard.writeText(hook); toast('Alamat webhook disalin', 'ok'); } catch (_) { box.querySelector('#b-hook').select(); } };
    box.querySelector('#b-reset').onclick = async () => {
      if (!(await confirmBox('Ganti alamat webhook?', 'Alamat lama tidak berlaku lagi. Tempel alamat baru di dashboard Mayar.'))) return;
      try { await rpc('sa_mayar_hook_reset'); load(); toast('Alamat webhook baru dibuat', 'ok'); } catch (e) { toastErr(e); }
    };
    box.querySelector('#b-save').onclick = async (e) => {
      const due = Math.round(+box.querySelector('#b-due').value);
      if (!(due >= 1 && due <= 28)) return toast('Tanggal jatuh tempo 1–28', 'err');
      e.target.disabled = true;
      try {
        await rpc('sa_billing_save', { p: {
          active: box.querySelector('#b-on').checked, monthly_amount: parseNum(box.querySelector('#b-amt').value), due_day: due,
          start_month: box.querySelector('#b-start').value ? box.querySelector('#b-start').value + '-01' : '',
          monthly_title: box.querySelector('#b-title').value, monthly_desc: box.querySelector('#b-desc').value,
          pay_name: box.querySelector('#b-pn').value, pay_email: box.querySelector('#b-pe').value, pay_mobile: box.querySelector('#b-pm').value,
          mayar_mode: box.querySelector('#b-mode').value } });
        const key = box.querySelector('#b-key').value.trim();
        if (key) await rpc('sa_mayar_key', { p_key: key });
        toast('Pengaturan tagihan tersimpan', 'ok'); load();
      } catch (err) { toastErr(err); } finally { e.target.disabled = false; }
    };
    box.querySelector('#b-now').onclick = async () => {
      try { const n = await rpc('billing_ensure'); toast(n ? 'Tagihan bulan ini dibuat & owner diberi notifikasi' : 'Tagihan bulan ini sudah ada (atau tagihan bulanan belum aktif / belum disimpan)', n ? 'ok' : ''); loadList(); } catch (e) { toastErr(e); }
    };
    box.querySelector('#k-add').onclick = async () => {
      const p = { title: box.querySelector('#k-title').value.trim(), amount: parseNum(box.querySelector('#k-amt').value), due_date: box.querySelector('#k-due').value, description: box.querySelector('#k-desc').value };
      if (!p.title) return toast('Isi judul tagihan', 'err');
      if (!(p.amount > 0)) return toast('Isi nominal', 'err');
      try { await rpc('sa_bill_create', { p }); toast('Tagihan khusus dibuat, owner diberi notifikasi', 'ok'); ['#k-title', '#k-amt', '#k-desc'].forEach((s) => { box.querySelector(s).value = ''; }); loadList(); } catch (e) { toastErr(e); }
    };
    loadList();
  };
  const loadList = async () => {
    const { data, error } = await supa.from('bills').select('*').order('created_at', { ascending: false }).limit(60);
    if (error) { list.innerHTML = ''; return; }
    list.innerHTML = `<div class="card-h"><h2>Semua tagihan</h2><span class="xs muted">${data.filter((b) => ['belum', 'menunggu'].includes(b.status)).length} belum lunas</span></div>` + (data.length ? `<div class="list">${data.map((b) => billRow(b,
      `<div class="row" style="gap:4px;justify-content:flex-end;flex-wrap:wrap">${['belum', 'menunggu'].includes(b.status) ? `<button class="btn btn-sm" data-ba="lunas" data-id="${b.id}">Tandai lunas</button><button class="btn btn-sm btn-ghost" data-ba="batal" data-id="${b.id}">Batalkan</button>` : `<button class="btn btn-sm btn-ghost" data-ba="buka" data-id="${b.id}">Buka lagi</button>`}${b.status !== 'lunas' ? `<button class="btn btn-sm btn-ghost" data-ba="hapus" data-id="${b.id}" style="color:var(--red)">Hapus</button>` : ''}</div>`)).join('')}</div>` : '<div class="muted small" style="padding:16px">Belum ada tagihan.</div>');
  };
  on(list, 'click', '[data-ba]', async (e, b) => {
    const act = b.dataset.ba; let note = null;
    if (act === 'lunas') { note = await promptBox('Tandai lunas', 'Dibayar lewat (mis. transfer BCA, tunai)', { required: false, value: 'Transfer manual' }); if (note === null) return; }
    else if (!(await confirmBox({ batal: 'Batalkan tagihan?', buka: 'Buka lagi tagihan ini?', hapus: 'Hapus tagihan?' }[act], act === 'buka' ? 'Status kembali menjadi belum dibayar.' : 'Owner tidak perlu membayar tagihan ini.', 'Ya', act === 'hapus'))) return;
    try { await rpc('sa_bill_action', { p_id: +b.dataset.id, p_action: act, p_note: note }); toast('Tersimpan', 'ok'); loadList(); } catch (err) { toastErr(err); }
  });
  return load;
}
let loadBilling = () => {};
