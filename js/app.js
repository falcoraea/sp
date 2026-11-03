import { supa, configured, rpc, logEvent, logPage } from './supa.js';
import { store, loadNotifs, unreadCount, markRead, loadProfiles, onEvt, emit } from './store.js';
import { PAGES, TABS, HOME, canOpen, menuFor } from './nav.js';
import { esc, icon, toast, toastErr, ago, ROLE_LABEL, ROLE_COLOR, modal } from './ui.js';
import { renderLogin, renderPending } from './auth.js';
import { runTour, mainSteps } from './tour.js';
import { APP_NAME } from './config.js';
import { setFallbackScan, showScanResult } from './scanner.js';
import { startPaging } from './paging.js';

const root = document.getElementById('app');
let current = { page: null, mod: null };
let channel = null;
let booted = false;
let routeSeq = 0;
let hashBound = false;
const SA_ROLES = [['owner', 'Semua menu, laporan, harga'], ['admin', 'Pesanan, upload, beli WIN'], ['kepala_gudang', 'Terima, stok, retur, opname'], ['picker', 'Ambil barang dari rak'], ['packing', 'Packing & scan resi'], ['sopir', 'Tugas ambil barang WIN']];

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
  setFallbackScan(null);
  Object.assign(store, { session: null, profile: null, role: null, superadmin: false, notifs: [], reads: new Set() });
}

async function boot(session) {
  store.session = session;
  try {
    const { data: profile, error } = await supa.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
    if (error) throw error;
    if (!profile || profile.role === 'pending' || !profile.active) return renderPending(root, profile);
    store.profile = profile;
    if (profile.role === 'superadmin') {
      // super admin: pilih mau masuk sebagai jabatan apa (berlaku sampai tab ditutup / ganti jabatan)
      let picked = null; try { picked = sessionStorage.getItem('sa-role'); } catch (_) {}
      if (!picked || picked !== profile.act_as) picked = await pickActAs();
      profile.act_as = picked; store.role = picked; store.superadmin = true;
    } else {
      store.role = profile.role; store.superadmin = false;
      let logged = null; try { logged = sessionStorage.getItem('logged-' + profile.id); } catch (_) {}
      if (!logged) { logEvent('login', 'Masuk aplikasi'); try { sessionStorage.setItem('logged-' + profile.id, '1'); } catch (_) {} }
    }
    const { data: settings } = await supa.from('settings').select('*').eq('id', 1).single();
    store.settings = settings || {};
    await loadProfiles().catch(() => {});
    renderShell();
    if (!hashBound) { window.addEventListener('hashchange', route); hashBound = true; }
    await route();
    subscribe();
    loadNotifs().catch(() => {});
    if (profile.tour_auto && !profile.tour_done?.main) setTimeout(() => startMainTour(true), 600);
  } catch (e) {
    toastErr(e);
    root.innerHTML = `<div class="boot"><div class="boot-logo">SG</div><div class="boot-text">Gagal memuat data. Periksa koneksi, lalu muat ulang.</div><button class="btn" onclick="location.reload()">Muat ulang</button></div>`;
  }
}

// ---------- super admin ----------
function pickActAs(current) {
  return new Promise((resolve) => {
    root.innerHTML = `<div class="sa-pick"><div class="card stack">
      <div><span class="tag" style="background:#A63A2A;color:#fff">Super admin</span><h2 style="font-size:22px;margin-top:10px">Masuk sebagai jabatan apa?</h2>
      <div class="small muted" style="margin-top:4px">Aplikasi akan tampil &amp; bekerja persis seperti jabatan itu. Semua tindakanmu tetap tercatat di Log aktivitas sebagai Super admin.</div></div>
      <div class="sa-grid">${SA_ROLES.map(([r, d]) => `<button class="sa-role" data-r="${r}" ${r === current ? 'style="border-color:var(--ink)"' : ''}><b>${esc(ROLE_LABEL[r])}</b><span>${esc(d)}</span></button>`).join('')}</div>
      <button class="btn btn-ghost" data-out>${icon('logout', 18)} Keluar</button></div></div>`;
    root.querySelector('[data-out]').onclick = () => supa.auth.signOut();
    root.querySelectorAll('[data-r]').forEach((b) => b.addEventListener('click', async () => {
      root.querySelectorAll('[data-r]').forEach((x) => { x.disabled = true; });
      try {
        await rpc('sa_act_as', { p_role: b.dataset.r });
        try { sessionStorage.setItem('sa-role', b.dataset.r); } catch (_) {}
        resolve(b.dataset.r);
      } catch (e) { toastErr(e); root.querySelectorAll('[data-r]').forEach((x) => { x.disabled = false; }); }
    }));
  });
}
async function switchActAs() {
  const r = await modal({ title: 'Ganti jabatan (super admin)', body: `<div class="sa-grid">${SA_ROLES.map(([k, d]) => `<button class="sa-role" data-r="${k}" ${k === store.role ? 'style="border-color:var(--ink)"' : ''}><b>${esc(ROLE_LABEL[k])}</b><span>${esc(d)}</span></button>`).join('')}</div>`,
    actions: [], onOpen: (ov, close) => ov.querySelectorAll('[data-r]').forEach((b) => b.addEventListener('click', () => close(b.dataset.r))) });
  if (!r || r === store.role) return;
  try { await rpc('sa_act_as', { p_role: r }); try { sessionStorage.setItem('sa-role', r); } catch (_) {} location.hash = ''; location.reload(); } catch (e) { toastErr(e); }
}

// ---------- shell ----------
const ini = (n) => (n || 'SG').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
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
      <div class="side-brand" data-me role="button" tabindex="0" title="Profil saya"><span class="logo">${esc(ini(store.settings.nama_toko || APP_NAME))}</span><div><b>${esc(store.settings.nama_toko || APP_NAME)}</b><span>${esc(ROLE_LABEL[role])} · ${esc(p.full_name)}</span></div></div>
      ${side}
      <div class="side-foot"><button class="side-link" data-logout style="background:none;border:0;cursor:pointer;width:100%">${icon('logout', 18)}<span>Keluar</span></button></div>
    </nav>
    <div class="main">
      <header class="topbar">
        <button class="tb-logo" data-me aria-label="Profil saya">${esc(ini(p.full_name))}</button>
        <div class="grow tb-text"><div class="t-sub" id="t-sub"><span class="crumb" id="t-crumb"></span><span class="who">${esc(ROLE_LABEL[role])} · ${esc(p.full_name)}</span></div><h1 id="t-title">${esc(APP_NAME)}</h1></div>
        <span class="tb-date">${icon('calendar', 16)}${esc(new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date()))}</span>
        <button class="icon-btn" data-help data-tour="help" aria-label="Bantuan halaman ini">${icon('help')}</button>
        <button class="icon-btn bell" data-bell data-tour="bell" aria-label="Notifikasi">${icon('bell')}<span class="badge-dot hidden" data-badge></span></button>
        <button class="tb-user" data-me aria-haspopup="menu" aria-label="Profil saya"><span class="av">${esc(ini(p.full_name))}</span><span class="tb-u-txt"><b>${esc(p.full_name)}</b><small>${esc(ROLE_LABEL[role])}</small></span>${icon('chev', 16)}</button>
      </header>
      ${store.superadmin ? `<div class="sa-bar">${icon('shield', 16)}<span><b>Mode super admin</b> · sedang sebagai <b>${esc(ROLE_LABEL[role])}</b></span><button class="btn" data-sa>Ganti jabatan</button></div>` : ''}
      <main class="view" id="view" tabindex="-1"></main>
    </div>
    <nav class="tabbar" aria-label="Menu bawah">${tabs}</nav>
  </div>`;

  root.querySelector('[data-logout]').onclick = logout;
  root.querySelector('[data-more]').onclick = openMore;
  root.querySelector('[data-bell]').onclick = toggleBell;
  root.querySelector('[data-sa]')?.addEventListener('click', switchActAs);
  root.querySelectorAll('[data-me]').forEach((b) => { b.onclick = (e) => toggleMe(e.currentTarget); b.onkeydown = (e) => { if (e.key === 'Enter') toggleMe(b); }; });
  startPaging(root.querySelector('.main'));
  root.querySelector('[data-help]').onclick = () => {
    if (current.mod?.tour?.length) runTour({ steps: current.mod.tour });
    else startMainTour(false);
  };
  onEvt('notifs', paintBadge);
  setFallbackScan(globalScan);
}

// scan alat (USB/Bluetooth) saat tidak ada kolom scan di halaman: tetap tampilkan pop-up keterangan kode
async function globalScan(code) {
  try {
    const r = await rpc('lookup_code', { p_code: code });
    logEvent('cek', 'Scan cek kode ' + code + ' → ' + (r.type === 'barang' ? r.name : r.type === 'resi' ? 'resi' : r.type === 'rak' ? 'rak ' + r.code : 'tidak dikenal'), code);
    if (r.type === 'barang') return { ok: true, title: r.name, info: `Barang · Rak ${r.rack || '-'} · stok ${r.stock}` };
    if (r.type === 'resi') return { ok: true, title: 'Resi ' + (r.resi || r.order_no), info: (r.items || []).map((i) => i.name + ' ×' + i.qty).join(', ') };
    if (r.type === 'rak') return { ok: true, title: 'Rak ' + r.code, info: (r.items || []).length + ' jenis barang' };
    return { ok: false, title: 'Kode tidak dikenal', info: 'Belum ada di master barang, pesanan, atau rak' };
  } catch (e) { return { ok: false, title: 'Gagal mengecek kode', info: e.message || String(e) }; }
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
    if (!store.superadmin) await Promise.race([supa.rpc('log_event', { p_kind: 'login', p_summary: 'Keluar aplikasi' }), new Promise((r) => setTimeout(r, 1500))]).catch(() => {});
    try { sessionStorage.removeItem('logged-' + store.profile.id); sessionStorage.removeItem('sa-role'); } catch (_) {}
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

// ---------- menu profil (pojok kanan atas / logo) ----------
function meMenuHtml() {
  const p = store.profile, role = store.role;
  const items = [['akun', 'user', 'Profil & ganti password'], ['panduan', 'compass', 'Panduan aplikasi'], ['notifikasi', 'bell', 'Semua notifikasi']];
  if (role === 'owner') items.push(['log', 'clock', 'Log aktivitas'], ['pengaturan', 'gear', 'Pengaturan toko'], ['pegawai', 'users', 'Pegawai & jabatan']);
  return `<div class="me-head"><span class="av">${esc(ini(p.full_name))}</span><div style="min-width:0"><b>${esc(p.full_name)}</b><div class="xs muted" style="overflow-wrap:anywhere">${esc(p.email || store.session?.user?.email || '')}</div><span class="tag dark" style="margin-top:6px">${esc(ROLE_LABEL[role])}</span></div></div>
    <div class="me-list">${store.superadmin ? `<button class="me-item" data-sa-switch style="color:#A63A2A">${icon('shield', 18)}<span>Ganti jabatan (super admin)</span></button>` : ''}${items.map(([k, ic, l]) => `<a class="me-item" href="#/${k}" data-close>${icon(ic, 18)}<span>${l}</span></a>`).join('')}
    <button class="me-item danger" data-lo>${icon('logout', 18)}<span>Keluar</span></button></div>`;
}
function toggleMe(btn) {
  document.getElementById('bell-panel')?.remove();
  if (window.matchMedia('(max-width: 899px)').matches) {
    modal({ title: 'Profil saya', body: `<div class="me-sheet">${meMenuHtml()}</div>`, actions: [], onOpen: (ov, close) => {
      ov.querySelectorAll('[data-close]').forEach((a) => a.addEventListener('click', () => close(null)));
      ov.querySelector('[data-lo]').onclick = () => { close(null); logout(); };
      ov.querySelector('[data-sa-switch]')?.addEventListener('click', () => { close(null); switchActAs(); });
    } });
    return;
  }
  const ex = document.getElementById('me-panel');
  if (ex) { ex.remove(); return; }
  const panel = document.createElement('div');
  panel.id = 'me-panel'; panel.className = 'me-panel'; panel.setAttribute('role', 'menu');
  panel.innerHTML = meMenuHtml();
  if (btn.closest('.sidebar')) panel.classList.add('from-side');
  document.body.appendChild(panel);
  panel.addEventListener('click', (e) => {
    e.stopPropagation();
    if (e.target.closest('[data-lo]')) { panel.remove(); logout(); return; }
    if (e.target.closest('[data-sa-switch]')) { panel.remove(); switchActAs(); return; }
    if (e.target.closest('a')) panel.remove();
  });
  setTimeout(() => document.addEventListener('click', function off(e) {
    if (!e.target.isConnected) return;
    if (!panel.contains(e.target) && !e.target.closest('[data-me]')) { panel.remove(); document.removeEventListener('click', off); }
  }), 0);
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
  document.getElementById('me-panel')?.remove();
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
    e.stopPropagation();
    const f = e.target.closest('[data-bf]');
    if (f) { bellFilter = f.dataset.bf; renderBellBody(panel); return; }
    if (e.target.closest('[data-readall]')) { markRead(store.notifs.map((n) => n.id)); return; }
    const a = e.target.closest('[data-nid]');
    if (a) markRead([+a.dataset.nid]);
    if (e.target.closest('a')) { panel.remove(); location.hash = e.target.closest('a').getAttribute('href'); }
  });
  setTimeout(() => document.addEventListener('click', function off(e) {
    if (!e.target.isConnected) return;
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
  const cr = document.getElementById('t-crumb'); if (cr) cr.textContent = (pg.group || 'Beranda') + '  ›  ' + pg.label;
  document.title = pg.label + ' · ' + APP_NAME;
  document.getElementById('me-panel')?.remove();
  // sisa jendela / panduan dari halaman sebelumnya (mis. tekan tombol Kembali HP) jangan sampai menutupi tombol
  document.querySelectorAll('.overlay, .tour-block, .tour-hole, .tour-tip, .tour-welcome').forEach((x) => x.remove());
  const seq = ++routeSeq;
  // ganti elemen halaman dengan yang baru supaya event dari halaman sebelumnya tidak ikut terbawa
  const oldView = document.getElementById('view');
  const view = oldView.cloneNode(false);
  oldView.replaceWith(view);
  view.innerHTML = '<div class="stack"><div class="skeleton" style="height:90px"></div><div class="skeleton" style="height:240px"></div></div>';
  try {
    current.mod?.destroy?.();
    const mod = (await import(`./pages/${page}.js`)).default;
    if (seq !== routeSeq) return;
    current = { page, mod };
    await mod.render(view, { params, go: (h) => (location.hash = h), store });
    logPage(page, pg.label);
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
