import { supa } from '../supa.js';
import { store } from '../store.js';
import { esc, todayStr, monthStart, fmtDate, fmtTime, longToday, toast, toastErr, emptyState, photoField, bindPhoto, modal, icon } from '../ui.js';

export default {
  async render(el) {
    const load = async () => {
      const { data } = await supa.from('attendance').select('*').eq('user_id', store.profile.id).gte('work_date', monthStart()).order('work_date', { ascending: false });
      const today = (data || []).find((a) => a.work_date === todayStr());
      el.innerHTML = `<div class="stack">
        <div class="hero"><div class="label">${esc(longToday())}</div>
          <div class="big">${today ? (today.check_out ? 'Sudah pulang' : 'Sudah masuk') : 'Belum absen'}</div>
          <div class="small" style="color:#C9CCC8">${today ? `Masuk ${fmtTime(today.check_in)}${today.check_out ? ' · pulang ' + fmtTime(today.check_out) : ''}` : 'Jam dicatat dari server, bukan dari HP.'}</div></div>
        ${!today ? `<button class="btn btn-primary btn-lg" id="in">${icon('clock', 20)} Absen masuk</button>` : !today.check_out ? `<button class="btn btn-dark btn-lg" id="out">${icon('logout', 20)} Absen pulang</button>` : ''}
        <div class="card flush"><div class="card-h"><h2>Bulan ini</h2><b>${(data || []).length} hari hadir</b></div>
          ${data?.length ? `<div class="list">${data.map((a) => `<div class="list-item"><span class="grow">${fmtDate(a.work_date, { weekday: 'short', day: 'numeric', month: 'short' })}</span><span class="small">${fmtTime(a.check_in)} – ${a.check_out ? fmtTime(a.check_out) : '…'}</span></div>`).join('')}</div>` : emptyState('Belum ada absen bulan ini.', 'clock')}</div></div>`;
      el.querySelector('#in')?.addEventListener('click', async () => {
        let get;
        const ok = await modal({ title: 'Absen masuk', body: `<p class="muted" style="margin-top:0">Foto selfie di tempat kerja (opsional).</p>${photoField('sf', 'Ketuk untuk selfie')}`,
          actions: [{ label: 'Batal', value: false }, { label: 'Absen sekarang', cls: 'btn-primary', value: true }], onOpen: (ov) => { get = bindPhoto(ov, 'sf', 'absen'); } });
        if (!ok) return;
        const { error } = await supa.from('attendance').insert({ user_id: store.profile.id, photo: get() });
        if (error) return toastErr(error);
        toast('Absen masuk tercatat', 'ok'); load();
      });
      el.querySelector('#out')?.addEventListener('click', async () => {
        const { error } = await supa.from('attendance').update({ check_out: new Date().toISOString() }).eq('id', today.id);
        if (error) return toastErr(error);
        toast('Absen pulang tercatat', 'ok'); load();
      });
    };
    load();
  }
};
