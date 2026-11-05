import { supa, rpc } from '../supa.js';
import { store } from '../store.js';
import { esc, todayStr, monthStart, fmtDate, fmtTime, longToday, toast, toastErr, emptyState, photoField, bindPhoto, modal, icon, photoUrl, ROLE_LABEL, skeleton, num } from '../ui.js';
import { modOn } from '../modules.js';

// Absen harian. Dengan menu tambahan "Absen selfie + lokasi": selfie & GPS wajib, jarak dari gudang dicatat,
// absen di luar area ditandai dan owner diberi tahu.
const getPos = () => new Promise((resolve, reject) => {
  if (!navigator.geolocation) return reject(new Error('HP / browser ini tidak mendukung lokasi GPS'));
  navigator.geolocation.getCurrentPosition((p) => resolve(p.coords), (e) => reject(new Error(e.code === 1 ? 'Akses lokasi ditolak. Izinkan lokasi untuk aplikasi ini di pengaturan browser / HP, lalu coba lagi.' : 'Lokasi belum didapat. Pastikan GPS menyala lalu coba lagi.')), { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 });
});
const mapLink = (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`;

export default {
  async render(el) {
    const geo = modOn('absen_lokasi');
    if (store.role === 'owner') return rekap(el, geo, true);
    const load = async () => {
      const { data } = await supa.from('attendance').select('*').eq('user_id', store.profile.id).gte('work_date', monthStart()).order('work_date', { ascending: false });
      const today = (data || []).find((a) => a.work_date === todayStr());
      el.innerHTML = `<div class="stack">
        <div class="hero"><div class="label">${esc(longToday())}</div>
          <div class="big">${today ? (today.check_out ? 'Sudah pulang' : 'Sudah masuk') : 'Belum absen'}</div>
          <div class="small" style="color:#C9CCC8">${today ? `Masuk ${fmtTime(today.check_in)}${today.check_out ? ' · pulang ' + fmtTime(today.check_out) : ''}` : 'Jam dicatat dari server, bukan dari HP.'}</div></div>
        ${geo ? `<div class="alert blue small">${icon('camera', 16)} Absen wajib <b>selfie</b> dan <b>lokasi GPS</b>. Absen di luar area gudang akan ditandai.</div>` : ''}
        ${!today ? `<button class="btn btn-primary btn-lg" id="in">${icon('clock', 20)} Absen masuk</button>` : !today.check_out ? `<button class="btn btn-dark btn-lg" id="out">${icon('logout', 20)} Absen pulang</button>` : ''}
        <div class="card flush"><div class="card-h"><h2>Bulan ini</h2><b>${(data || []).length} hari hadir</b></div>
          ${data?.length ? `<div class="list">${data.map((a) => `<div class="list-item"><span class="grow">${fmtDate(a.work_date, { weekday: 'short', day: 'numeric', month: 'short' })}${a.outside ? ' <span class="tag red">di luar lokasi</span>' : ''}</span><span class="small">${fmtTime(a.check_in)} – ${a.check_out ? fmtTime(a.check_out) : '…'}</span></div>`).join('')}</div>` : emptyState('Belum ada absen bulan ini.', 'clock')}</div>
        <div id="rk"></div></div>`;
      const go = async (kind) => {
        let get, pos = null;
        const ok = await modal({ title: kind === 'masuk' ? 'Absen masuk' : 'Absen pulang', body: `<div class="stack">
            ${geo ? `<div class="small" id="gp">${icon('compass', 16)} Mengambil lokasi…</div>` : ''}
            <p class="muted" style="margin:0">${geo ? 'Ambil selfie di tempat kerja (wajib).' : 'Foto selfie di tempat kerja (opsional).'}</p>${photoField('sf', 'Ketuk untuk selfie')}</div>`,
          actions: [{ label: 'Batal', value: false }, { label: 'Absen sekarang', cls: 'btn-primary', onClick: () => {
            if (geo && !get()) { toast('Selfie wajib', 'err'); return false; }
            if (geo && !pos) { toast('Lokasi belum didapat. Tunggu sebentar / nyalakan GPS.', 'err'); return false; }
            return true;
          } }],
          onOpen: (ov) => {
            get = bindPhoto(ov, 'sf', 'absen');
            if (geo) getPos().then((c) => { pos = c; ov.querySelector('#gp').innerHTML = `${icon('check', 16)} Lokasi didapat (akurasi ±${Math.round(c.accuracy)} m)`; })
              .catch((e) => { const g = ov.querySelector('#gp'); if (g) g.innerHTML = `<span style="color:var(--red)">${esc(e.message)}</span>`; });
          } });
        if (!ok) return;
        try {
          const r = await rpc('absen', { p_kind: kind, p_lat: pos?.latitude ?? null, p_lng: pos?.longitude ?? null, p_acc: pos?.accuracy ?? null, p_photo: get() });
          toast(`Absen ${kind} tercatat${r?.dist != null ? ` · ±${num(r.dist)} m dari gudang` : ''}${r?.outside ? ' (di luar lokasi)' : ''}`, r?.outside ? 'err' : 'ok');
        } catch (e) {
          // database lama (sebelum 2.13): absen biasa
          if (!/absen\(|function|PGRST202/i.test(e.message || '') || geo) return toastErr(e);
          const { error } = kind === 'masuk' ? await supa.from('attendance').insert({ user_id: store.profile.id, photo: get() })
            : await supa.from('attendance').update({ check_out: new Date().toISOString() }).eq('id', today.id);
          if (error) return toastErr(error);
          toast(`Absen ${kind} tercatat`, 'ok');
        }
        load();
      };
      el.querySelector('#in')?.addEventListener('click', () => go('masuk'));
      el.querySelector('#out')?.addEventListener('click', () => go('pulang'));
      if (store.role === 'supervisor') rekap(el.querySelector('#rk'), geo, false);
    };
    load();
  }
};

// rekap absen semua pegawai (owner / supervisor) + lokasi gudang
async function rekap(box, geo, owner) {
  let date = todayStr();
  box.innerHTML = `<div class="stack">
    ${owner ? `<div class="page-head"><div><h2 style="font-size:22px">Absen pegawai</h2><div class="desc">Siapa yang sudah masuk / pulang hari ini${geo ? ', lengkap dengan selfie & jarak dari gudang' : ''}.</div></div></div>` : '<h3 class="sec-h">Absen semua pegawai</h3>'}
    ${owner && !geo ? `<a class="alert small" href="#/modul" style="display:block">${icon('lock', 15)} Ingin absen wajib selfie + lokasi GPS? Buka <b>Absen selfie + lokasi</b> di Menu tambahan.</a>` : ''}
    <div class="row"><input class="input" type="date" id="ad" value="${date}" style="max-width:200px"></div>
    <section class="card flush"><div class="card-h"><h2>Daftar hadir</h2><b id="an"></b></div><div id="al">${skeleton(2)}</div></section>
    ${owner && geo ? `<section class="card stack" id="loc"><h2 class="sec-title">${icon('compass', 18)} Lokasi gudang</h2>
      <div class="small muted" id="lc">${store.settings.office_lat ? `Titik: <a href="${mapLink(store.settings.office_lat, store.settings.office_lng)}" target="_blank" rel="noopener">${store.settings.office_lat}, ${store.settings.office_lng}</a>` : 'Belum diatur — jarak absen belum bisa dihitung.'}</div>
      <label class="field" style="max-width:240px">Radius area kerja (meter)<input class="input num" id="lr" type="number" min="30" value="${store.settings.office_radius || 150}"></label>
      <div class="row wrap"><button class="btn btn-primary" id="lh">${icon('compass', 16)} Pakai lokasi saya sekarang</button><button class="btn" id="ls">Simpan radius</button></div>
      <div class="xs muted">Tekan "Pakai lokasi saya sekarang" saat kamu berada di gudang. GPS HP biasanya meleset 10–50 m, jadi radius 100–200 m disarankan.</div></section>` : ''}</div>`;
  const load = async () => {
    let rows;
    try { rows = await rpc('absen_rekap', { p_date: date }); } catch (e) { box.querySelector('#al').innerHTML = `<div class="alert yellow small" style="margin:12px">${esc(e.message)}</div>`; return; }
    const urls = await Promise.all(rows.map((r) => (r.photo ? photoUrl(r.photo) : null)));
    box.querySelector('#an').textContent = `${rows.filter((r) => r.check_in).length} / ${rows.length} hadir`;
    box.querySelector('#al').innerHTML = rows.length ? `<div class="list no-page">${rows.map((r, i) => `<div class="list-item">
      ${urls[i] ? `<a href="${esc(urls[i])}" target="_blank" rel="noopener"><img class="av-photo" src="${esc(urls[i])}" alt="Selfie ${esc(r.name)}"></a>` : `<span class="av-photo none">${icon('user', 18)}</span>`}
      <div class="grow" style="min-width:0"><b>${esc(r.name)}</b> <span class="xs muted">${esc(ROLE_LABEL[r.role] || r.role)}</span>${r.outside ? ' <span class="tag red">di luar lokasi</span>' : ''}
        <div class="xs muted">${r.in_dist != null ? `masuk ±${num(r.in_dist)} m` : ''}${r.out_dist != null ? ` · pulang ±${num(r.out_dist)} m` : ''}${r.in_lat ? ` · <a href="${mapLink(r.in_lat, r.in_lng)}" target="_blank" rel="noopener">peta</a>` : ''}</div></div>
      <span class="small" style="text-align:right">${r.check_in ? `${fmtTime(r.check_in)} – ${r.check_out ? fmtTime(r.check_out) : '…'}` : '<span class="tag">belum absen</span>'}</span></div>`).join('')}</div>` : emptyState('Belum ada pegawai.', 'users');
  };
  box.querySelector('#ad').addEventListener('change', (e) => { date = e.target.value; load(); });
  box.querySelector('#lh')?.addEventListener('click', async (e) => {
    const b = e.currentTarget; b.disabled = true;
    try {
      const c = await getPos();
      await rpc('office_save', { p_lat: +c.latitude.toFixed(6), p_lng: +c.longitude.toFixed(6), p_radius: +box.querySelector('#lr').value || 150 });
      Object.assign(store.settings, { office_lat: +c.latitude.toFixed(6), office_lng: +c.longitude.toFixed(6), office_radius: +box.querySelector('#lr').value || 150 });
      box.querySelector('#lc').innerHTML = `Titik: <a href="${mapLink(store.settings.office_lat, store.settings.office_lng)}" target="_blank" rel="noopener">${store.settings.office_lat}, ${store.settings.office_lng}</a> (akurasi ±${Math.round(c.accuracy)} m)`;
      toast('Lokasi gudang tersimpan', 'ok');
    } catch (err) { toastErr(err); }
    b.disabled = false;
  });
  box.querySelector('#ls')?.addEventListener('click', async () => {
    if (!store.settings.office_lat) return toast('Atur titik lokasi dulu', 'err');
    try { await rpc('office_save', { p_lat: store.settings.office_lat, p_lng: store.settings.office_lng, p_radius: +box.querySelector('#lr').value || 150 }); store.settings.office_radius = +box.querySelector('#lr').value; toast('Radius tersimpan', 'ok'); } catch (err) { toastErr(err); }
  });
  load();
}
