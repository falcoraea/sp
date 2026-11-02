import { supa, configured } from './supa.js';
import { store, loadNotifs, unreadCount, markRead, loadProfiles, onEvt, emit } from './store.js';
import { PAGES, TABS, HOME, canOpen, menuFor } from './nav.js';
import { esc, icon, toast, toastErr, ago, ROLE_LABEL, ROLE_COLOR, modal } from './ui.js';
import { renderLogin, renderPending } from './auth.js';
import { runTour, mainSteps } from './tour.js';
import { APP_NAME } from './config.js';

const root = document.getElementById('app');
let current = { page: null, mod: null };
let channel = null;
let booted = false;

// ---------- PWA ----------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.__installPrompt = e;
  document.getElementById('install-btn')?.classList.remove('hidden');
  emit('installable');
});

// ---------- auth ----------
if (!configured) renderLogin(root);
else {
  supa.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') { booted = false; renderLogin(root, { recovery: true }); return; }
    if (event === 'SIGNED_OUT' || !session) { booted = false; teardown(); renderLogin(root); return; }
    if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && !booted) { booted = true; setTimeout(() => boot(session), 0); }
  });
}

function teardown() {
  if (channel) { supa.removeChannel(channel); channel = null; }
  Object.assign(store, { session: null, profile: null, role: null, notifs: [], reads: new Set() });
}

async function boot(session) {
  store.session = session;
  try {
    const { data: profile, error } = await supa.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
    if (error) throw error;
    if (!profile || profile.role === 'pending' || !profile.active) return renderPending(root, profile);
    store.profile = profile; store.role = profile.role;
    const { data: settings } = await supa.from('settings').select('*').eq('id', 1).single();
    store.settings = settings || {};
    await loadProfiles().catch(() => {});
    renderShell();
    window.addEventListener('hashchange', route);
    await route();
    subscribe();
    loadNotifs().catch(() => {});
    if (profile.tour_auto && !profile.tour_done?.main) setTimeout(() => startMainTour(true), 600);
  } catch (e) {
    toastErr(e);
    root.innerHTML = `<div class="boot"><div class="boot-logo">SG</div><div class="boot-text">Gagal memuat data. Periksa koneksi, lalu muat ulang.</div><button class="btn" onclick="location.reload()">Muat ulang</button></div>`;
  }
}

// ---------- shell ----------
function renderShell() {
  const role = store.role, p = store.profile;
  const menu = menuFor(role);
  let lastGroup = null;
  const side = menu.map((m) => {
    const g = m.group !== lastGroup && m.group ? `<div class="side-group">${esc(m.group)}</div>` : '';
    lastGroup = m.group;
    return `${g}<a class="side-link" href="#/${m.key}" data-nav="${m.key}" data-tour="nav-${m.key}">${icon(m.icon, 18)}<span>${esc(m.label)}</span><span class="cnt hidden" data-cnt="${m.key}"></span></a>`;
  }).join('');
  const tabs = (TABS[role] || []).map((k) => {
    const pg = PAGES[k];
    return `<a class="tab" href="#/${k}" data-nav="${k}" data-tour="nav-${k}"><span class="ic">${icon(pg.icon, 22)}${k === 'notifikasi' ? '<span class="badge-dot hidden" data-badge></span>' : ''}</span><span class="lbl">${esc(pg.short || pg.label)}</span></a>`;
  }).join('') + `<button class="tab" data-more data-tour="nav-lainnya"><span class="ic">${icon('more', 22)}</span><span class="lbl">Lainnya</span></button>`;

  root.innerHTML = `<div class="shell">
    <nav class="sidebar" aria-label="Menu utama">
      <div class="side-brand"><span class="logo">SG</span><div><b>${esc(store.settings.nama_toko || APP_NAME)}</b><span>${esc(ROLE_LABEL[role])} · ${esc(p.full_name)}</span></div></div>
      ${side}
      <div class="side-foot"><button class="side-link" data-logout style="background:none;border:0;cursor:pointer;width:100%">${icon('logout', 18)}<span>Keluar</span></button></div>
    </nav>
    <div class="main">
      <header class="topbar">
        <div class="grow"><div class="t-sub" id="t-sub">${esc(ROLE_LABEL[role])} · ${esc(p.full_name)}</div><h1 id="t-title">${esc(APP_NAME)}</h1></div>
        <button class="icon-btn" data-help data-tour="help" aria-label="Bantuan halaman ini">${icon('help')}</button>
        <button class="icon-btn bell" data-bell data-tour="bell" aria-label="Notifikasi">${icon('bell')}<span class="badge-dot hidden" data-badge></span></button>
      </header>
      <main class="view" id="view" tabindex="-1"></main>
    </div>
    <nav class="tabbar" aria-label="Menu bawah">${tabs}</nav>
  </div>`;

  root.querySelector('[data-logout]').onclick = logout;
  root.querySelector('[data-more]').onclick = openMore;
  root.querySelector('[data-bell]').onclick = toggleBell;
  root.querySelector('[data-help]').onclick = () => {
    if (current.mod?.tour?.length) runTour({ steps: current.mod.tour });
    else startMainTour(false);
  };
  onEvt('notifs', paintBadge);
}

function paintBadge() {
  const n = unreadCount();
  document.querySelectorAll('[data-badge]').forEach((b) => { b.textContent = n > 99 ? '99+' : n; b.classList.toggle('hidden', !n); });
  const pending = store.notifs.filter((x) => !store.reads.has(x.id) && x.level === 'masalah').length;
  const c = document.querySelector('[data-cnt="masalah"]');
  if (c) { c.textContent = pending; c.classList.toggle('hidden', !pending || store.role !== 'owner'); }
  const bp = document.getElementById('bell-panel');
  if (bp) renderBellBody(bp);
  if (current.page === 'notifikasi' && current.mod?.refresh) current.mod.refresh();
}

async function logout() {
  if (await modal({ title: 'Keluar dari aplikasi?', body: '<p style="margin:0">Kamu perlu login lagi dengan email &amp; password.</p>', actions: [{ label: 'Batal', value: false }, { label: 'Keluar', cls: 'btn-dark', value: true }] })) {
    await supa.auth.signOut();
    location.hash = '';
  }
}

function openMore() {
  const tabs = new Set(TABS[store.role] || []);
  const items = menuFor(store.role).filter((m) => !tabs.has(m.key));
  modal({
    title: 'Menu lainnya',
    body: `<div class="list sheet-menu card flush" style="margin:0 -4px">${items.map((m) => `<a class="list-item" href="#/${m.key}" data-close>${icon(m.icon, 20)}<span class="grow">${esc(m.label)}</span>${icon('chev', 18)}</a>`).join('')}
      <button class="list-item" data-lo>${icon('logout', 20)}<span class="grow">Keluar</span></button></div>`,
    actions: [],
    onOpen: (ov, close) => {
      ov.querySelectorAll('[data-close]').forEach((a) => a.addEventListener('click', () => close(null)));
      ov.querySelector('[data-lo]').onclick = () => { close(null); logout(); };
    }
  });
}

// ---------- notifikasi ----------
function notifItem(n) {
  const color = n.level === 'masalah' ? 'var(--red)' : n.level === 'tugas' ? 'var(--accent)' : 'var(--blue)';
  const role = n.source_role || 'sistem';
  return `<a class="notif ${store.reads.has(n.id) ? '' : 'unread'}" href="${esc(n.link || '#/notifikasi')}" data-nid="${n.id}">
    <span class="dot" style="background:${color}"></span>
    <div class="grow">${store.role === 'owner' ? `<div class="n-role" style="color:${ROLE_COLOR[role] || '#1A1D1B'}">${esc(ROLE_LABEL[role] || role)}</div>` : ''}
      <div class="n-title">${esc(n.title)}</div>${n.body ? `<div class="n-body">${esc(n.body)}</div>` : ''}</div>
    <span class="n-time">${ago(n.created_at)}</span></a>`;
}
export { notifItem };

let bellFilter = 'all';
function renderBellBody(panel) {
  const roles = ['admin', 'sopir', 'kepala_gudang', 'picker', 'packing'];
  let list = store.notifs;
  if (bellFilter === 'masalah') list = list.filter((n) => n.level === 'masalah');
  else if (bellFilter !== 'all') list = list.filter((n) => n.source_role === bellFilter || n.target_role === bellFilter);
  panel.querySelector('.bp-body').innerHTML = (store.role === 'owner' ? `<div class="chips" style="padding:10px 16px">${[['all', 'Semua jabatan'], ['masalah', 'Masalah'], ...roles.map((r) => [r, ROLE_LABEL[r]])].map(([v, l]) => `<button class="chip ${bellFilter === v ? 'on' : ''}" data-bf="${v}" style="min-height:30px;padding:0 10px">${l}</button>`).join('')}</div>` : '')
    + (list.slice(0, 30).map(notifItem).join('') || '<div class="empty">Belum ada notifikasi</div>');
}

function toggleBell() {
  if (window.matchMedia('(max-width: 899px)').matches) { location.hash = '#/notifikasi'; return; }
  const ex = document.getElementById('bell-panel');
  if (ex) { ex.remove(); return; }
  const panel = document.createElement('div');
  panel.id = 'bell-panel'; panel.className = 'bell-panel';
  panel.innerHTML = `<div class="bp-head"><b>Notifikasi</b><button class="btn btn-ghost btn-sm" data-readall style="color:var(--blue)">Tandai semua dibaca</button></div><div class="bp-body"></div>
    <a href="#/notifikasi" class="btn btn-ghost" style="border-top:1px solid var(--line);border-radius:0">Lihat semua notifikasi</a>`;
  document.querySelector('.topbar').appendChild(panel);
  renderBellBody(panel);
  panel.addEventListener('click', (e) => {
    const f = e.target.closest('[data-bf]');
    if (f) { bellFilter = f.dataset.bf; renderBellBody(panel); return; }
    if (e.target.closest('[data-readall]')) { markRead(store.notifs.map((n) => n.id)); return; }
    const a = e.target.closest('[data-nid]');
    if (a) markRead([+a.dataset.nid]);
    if (e.target.closest('a')) panel.remove();
  });
  setTimeout(() => document.addEventListener('click', function off(e) {
    if (!panel.contains(e.target) && !e.target.closest('[data-bell]')) { panel.remove(); document.removeEventListener('click', off); }
  }), 0);
}

function subscribe() {
  channel = supa.channel('notif-' + store.profile.id)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
      const n = payload.new;
      if (store.notifs.find((x) => x.id === n.id)) return;
      store.notifs.unshift(n);
      emit('notifs');
      if (n.source_user !== store.profile.id) {
        toast((n.level === 'masalah' ? '⚠ ' : '') + n.title);
        if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
          navigator.serviceWorker?.ready.then((r) => r.showNotification(n.title, { body: n.body || '', icon: 'assets/icon-192.png', tag: 'n' + n.id, data: { link: n.link } })).catch(() => {});
        }
      }
    })
    .subscribe();
}

// ---------- router ----------
async function route() {
  const hash = location.hash.replace(/^#\/?/, '');
  const [pageRaw, qs] = hash.split('?');
  let page = pageRaw || HOME[store.role];
  if (!canOpen(page, store.role)) page = HOME[store.role];
  const params = Object.fromEntries(new URLSearchParams(qs || ''));
  document.getElementById('bell-panel')?.remove();
  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('on', a.dataset.nav === page));
  const pg = PAGES[page];
  document.getElementById('t-title').textContent = pg.label;
  document.title = pg.label + ' · ' + APP_NAME;
  const view = document.getElementById('view');
  view.innerHTML = '<div class="stack"><div class="skeleton" style="height:90px"></div><div class="skeleton" style="height:240px"></div></div>';
  try {
    current.mod?.destroy?.();
    const mod = (await import(`./pages/${page}.js`)).default;
    current = { page, mod };
    await mod.render(view, { params, go: (h) => (location.hash = h), store });
  } catch (e) {
    toastErr(e);
    view.innerHTML = `<div class="card"><b>Halaman gagal dimuat.</b><div class="muted small" style="margin-top:6px">${esc(e.message || e)}</div><button class="btn" style="margin-top:12px" onclick="location.reload()">Muat ulang</button></div>`;
  }
  view.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

// ---------- panduan ----------
export async function startMainTour(firstLogin) {
  const role = store.role;
  const status = await runTour({
    steps: mainSteps(role),
    welcome: firstLogin ? { title: `Selamat datang, ${store.profile.full_name}`, body: `Kamu login sebagai <b>${esc(ROLE_LABEL[role])}</b>. Kami tunjukkan menu penting dalam ±1 menit. Bisa dilewati kapan saja dan diputar ulang dari <b>Panduan aplikasi</b>.` } : null
  });
  const done = { ...(store.profile.tour_done || {}), main: status, at: new Date().toISOString() };
  store.profile.tour_done = done;
  await supa.from('profiles').update({ tour_done: done }).eq('id', store.profile.id);
  if (firstLogin) toast(status === 'selesai' ? 'Panduan selesai. Bisa diputar ulang di menu Panduan.' : 'Panduan dilewati. Nyalakan lagi di menu Panduan.');
}
window.__startMainTour = startMainTour;
