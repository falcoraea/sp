import { store, loadNotifs, markRead } from '../store.js';
import { esc, chips, on, emptyState, ROLE_LABEL, icon } from '../ui.js';
import { notifItem } from '../app.js';

let refresh = null;
export default {
  get refresh() { return refresh; },
  async render(el) {
    let f = 'all';
    const isOwner = store.role === 'owner';
    const opts = [['all', 'Semua'], ['unread', 'Belum dibaca'], ['masalah', 'Masalah'], ['tugas', 'Tugas'], ...(isOwner ? ['admin', 'sopir', 'kepala_gudang', 'picker', 'packing'].map((r) => [r, ROLE_LABEL[r]]) : [])];
    el.innerHTML = `<div class="stack">
      <div class="row between wrap"><div class="small muted">${isOwner ? 'Owner menerima notifikasi dari <b>semua jabatan</b>.' : 'Tugas & info untuk jabatan ' + esc(ROLE_LABEL[store.role]) + '.'}</div>
        <div class="row"><button class="btn btn-sm" id="rf">${icon('refresh', 16)}</button><button class="btn btn-sm" id="ra">Tandai semua dibaca</button></div></div>
      <div id="ch"></div><div class="card flush" id="list"></div>
      ${'Notification' in window && Notification.permission === 'default' ? '<button class="btn" id="perm">Izinkan notifikasi muncul di HP / laptop</button>' : ''}</div>`;
    const paint = () => {
      el.querySelector('#ch').innerHTML = chips('f', opts, f);
      let list = store.notifs;
      if (f === 'unread') list = list.filter((n) => !store.reads.has(n.id));
      else if (f === 'masalah' || f === 'tugas') list = list.filter((n) => n.level === f);
      else if (f !== 'all') list = list.filter((n) => n.source_role === f || n.target_role === f);
      el.querySelector('#list').innerHTML = list.length ? list.map(notifItem).join('') : emptyState('Tidak ada notifikasi.', 'bell');
    };
    refresh = paint;
    on(el, 'click', '[data-chips="f"] .chip', (e, b) => { f = b.dataset.v; paint(); });
    on(el, 'click', '[data-nid]', (e, a) => markRead([+a.dataset.nid]));
    el.querySelector('#ra').onclick = () => markRead(store.notifs.map((n) => n.id));
    el.querySelector('#rf').onclick = async () => { await loadNotifs(); paint(); };
    el.querySelector('#perm')?.addEventListener('click', async (e) => { await Notification.requestPermission(); e.target.remove(); });
    paint();
    if (!store.notifs.length) { await loadNotifs().catch(() => {}); paint(); }
  },
  destroy() { refresh = null; }
};
