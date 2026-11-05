import { store } from '../store.js';
import { PAGES } from '../nav.js';
import { esc, icon, pageHead, on } from '../ui.js';
import { loadModules, modOn, modStatus, priceTxt, buyModule, MOD_ICON } from '../modules.js';

// Owner: daftar menu & jabatan tambahan, statusnya, dan tombol buka / perpanjang.
const pageOf = (code) => Object.entries(PAGES).find(([, p]) => p.mod === code)?.[0];

export default {
  tour: [{ sel: '#mods', title: 'Menu tambahan', body: 'Menu & jabatan yang bisa dibuka sesuai kebutuhan. Tekan "Buka sekarang", bayar lewat QRIS / transfer / e-wallet, lalu menu langsung aktif.' }],
  async render(el) {
    await loadModules().catch(() => {});
    const all = Object.values(store.modules);
    const card = (m) => {
      const on = modOn(m.code), [st, cls] = modStatus(m), pg = pageOf(m.code);
      return `<div class="mod-card ${on ? 'on' : ''}">
        <div class="mod-top"><span class="mod-ic">${icon(MOD_ICON[m.code] || 'grid', 22, 2)}${on ? '' : `<span class="pw-lock">${icon('lock', 11, 2.6)}</span>`}</span>
          <div class="grow" style="min-width:0"><b>${esc(m.name)}</b><div class="xs"><span class="tag ${cls}">${esc(st)}</span></div></div></div>
        <div class="small muted">${esc(m.description || '')}</div>
        ${m.features?.length ? `<ul class="pw-feat sm">${m.features.slice(0, 4).map((f) => `<li>${icon('check', 14, 2.6)}<span>${esc(f)}</span></li>`).join('')}</ul>` : ''}
        <div class="mod-foot"><span class="mod-price">${esc(priceTxt(m))}</span>
          ${on ? (pg ? `<a class="btn btn-sm" href="#/${pg}">Buka menu</a>` : m.kind === 'jabatan' ? '<a class="btn btn-sm" href="#/pegawai">Atur pegawai</a>' : '')
               + (m.period === 'bulanan' && !m.forever && Number(m.price) > 0 ? `<button class="btn btn-sm btn-ghost" data-buy="${esc(m.code)}">Perpanjang</button>` : '')
             : Number(m.price) > 0 ? `<button class="btn btn-sm btn-primary" data-buy="${esc(m.code)}">${icon('lock', 15)} ${m.active_until ? 'Perpanjang' : 'Buka sekarang'}</button>` : '<span class="xs muted">Hubungi pembuat aplikasi</span>'}
        </div></div>`;
    };
    const menus = all.filter((m) => m.kind === 'menu'), roles = all.filter((m) => m.kind === 'jabatan');
    el.innerHTML = `${pageHead('Menu tambahan', 'Buka menu & jabatan sesuai kebutuhan toko. Pembayaran lewat Mayar (QRIS, transfer bank / VA, e-wallet), menu terbuka otomatis setelah lunas.')}
      <div class="stack" id="mods">
        ${!all.length ? '<div class="alert yellow">Menu ini butuh update database. Jalankan <b>supabase/update-2.13.sql</b> di Supabase › SQL Editor.</div>' : ''}
        ${menus.length ? `<h3 class="sec-h">Menu</h3><div class="mod-grid">${menus.map(card).join('')}</div>` : ''}
        ${roles.length ? `<h3 class="sec-h">Jabatan</h3><div class="mod-grid">${roles.map(card).join('')}</div>` : ''}
        <div class="small muted">Langganan bulanan: tagihan perpanjangan dibuat otomatis 5 hari sebelum masa aktif habis. Kalau tidak diperpanjang, menu terkunci lagi (data tetap aman dan muncul kembali setelah dibuka).</div>
      </div>`;
    on(el, 'click', '[data-buy]', (e, b) => buyModule(b.dataset.buy, b));
  }
};
