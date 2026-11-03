import { store, loadNotifs, markRead } from '../store.js';
import { esc, chips, on, emptyState, ROLE_LABEL, icon, toast, toastErr } from '../ui.js';
import { pushSupported, pushPermission, enablePush, sendTestPush, subscribePush, isIOS, isStandalone } from '../push.js';
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
      <section class="card stack" id="push"></section>
      <div id="ch"></div><div class="card flush" id="list"></div></div>`;
    const paintPush = () => {
      const box = el.querySelector('#push');
      const perm = pushPermission();
      const iosNeedsHome = isIOS() && !isStandalone();
      const st = iosNeedsHome ? ['yellow', 'Tambahkan ke Layar Utama dulu'] : !pushSupported() ? ['gray', 'Tidak didukung di perangkat / browser ini'] : perm === 'granted' ? ['green', 'Aktif di perangkat ini'] : perm === 'denied' ? ['red', 'Diblokir'] : ['yellow', 'Belum diaktifkan'];
      box.innerHTML = `<div class="row between wrap"><div><h2 class="sec-title">${icon('bell', 18)} Notifikasi HP</h2><div class="small muted">Muncul di layar HP walau aplikasi ditutup, seperti pesan WhatsApp.</div></div><span class="tag ${st[0]}">${st[1]}</span></div>
        ${iosNeedsHome ? '<div class="alert yellow small">Di iPhone, notifikasi hanya bisa setelah aplikasi dipasang: buka di <b>Safari</b> › ketuk tombol <b>Bagikan</b> (kotak panah ke atas) › <b>Tambah ke Layar Utama</b> › Tambah. Lalu buka aplikasi dari ikon di layar utama dan aktifkan notifikasi di sini. Butuh iOS 16.4 atau lebih baru.</div>' : ''}
        ${perm === 'denied' ? '<div class="alert yellow small">Notifikasi diblokir. Buka <b>Setelan HP › Aplikasi › Stok Gudang (atau Chrome) › Notifikasi</b>, izinkan, lalu kembali ke sini.</div>' : ''}
        <div class="row wrap">${pushSupported() && perm !== 'granted' ? `<button class="btn btn-primary" id="pon">${icon('bell', 18)} Aktifkan notifikasi HP</button>` : ''}
        ${perm === 'granted' && store.superadmin ? `<button class="btn" id="ptest">Kirim notifikasi tes</button>` : ''}${perm === 'granted' ? `<button class="btn btn-ghost btn-sm" id="pre">Daftarkan ulang perangkat ini</button>` : ''}</div>`;
      box.querySelector('#pon')?.addEventListener('click', async (e) => { e.target.disabled = true; try { await enablePush(); toast('Notifikasi HP aktif', 'ok'); } catch (err) { toastErr(err); } paintPush(); });
      box.querySelector('#ptest')?.addEventListener('click', async (e) => { e.target.disabled = true; try { await subscribePush(); await sendTestPush(); toast('Tes dikirim. Tutup / kecilkan aplikasi, notifikasi muncul dalam beberapa detik.', 'ok'); } catch (err) { toastErr(err); } setTimeout(() => { e.target.disabled = false; }, 4000); });
      box.querySelector('#pre')?.addEventListener('click', async () => { try { await subscribePush(); toast('Perangkat terdaftar', 'ok'); } catch (err) { toastErr(err); } });
    };
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
    paintPush();
    paint();
    if (!store.notifs.length) { await loadNotifs().catch(() => {}); paint(); }
  },
  destroy() { refresh = null; }
};
