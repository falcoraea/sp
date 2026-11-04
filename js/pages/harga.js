import { supa, rpc, fetchAll } from '../supa.js';
import { store, nameOf } from '../store.js';
import { esc, rp, num, fmtDate, chips, on, modal, toast, toastErr, pageHead, emptyState, skeleton, debounce, icon, parseNum, confirmBox, todayStr } from '../ui.js';
import { downloadHargaExcel } from '../excel-harga.js';

const FIELDS = [['macallan', 'Macallan'], ['harga_5', 'Harga 5%'], ['harga_beli', 'Harga beli (25–30%)'], ['harga_shopee', 'Harga Shopee']];

export default {
  tour: [
    { sel: '#rules', title: 'Rumus otomatis', body: 'Harga 5% = Macallan − 5%, harga beli = Macallan − 25/30%. Harga Shopee bisa ikut file Excel atau rumus, mis. Macallan + Rp5.000. Ubah di sini, lalu tekan “Simpan rumus & hitung ulang”.' },
    { sel: '#tbl', title: 'Ubah harga per barang', body: 'Ketik langsung di tabel. Barang yang diubah manual otomatis dikunci supaya tidak tertimpa upload file berikutnya.' },
    { sel: '#savebar', title: 'Simpan dengan alasan', body: 'Setiap perubahan dicatat di riwayat: siapa, kapan, dan alasannya.' }
  ],
  async render(el) {
    let filter = 'all', search = '', products = [], changed = new Map(), sel = new Set();
    const s = { ...store.settings };
    el.innerHTML = `${pageHead('Atur harga', 'Harga bisa terisi otomatis dari upload Pricelist WIN & file Shopee, dan tetap bisa diubah manual di sini.',
      `<button class="btn" id="xl">${icon('download', 18)} Unduh Excel</button><a class="btn" href="#/upload?type=pricelist">${icon('upload', 18)} Upload Excel harga</a>`)}
      <div class="stack">
      <section class="card stack" id="rules"><div class="row between wrap"><h2 class="sec-title">Rumus otomatis (untuk barang yang tidak dikunci)</h2><span class="xs muted">Terakhir diubah ${fmtDate(s.updated_at)}</span></div>
        <div class="grid gauto fields-end">
          <label class="field">Harga 5%: Macallan dikurangi (%)<input class="input num" id="r5" value="${s.potongan_5_pct}" inputmode="decimal"></label>
          <label class="field">Harga beli barang biasa: Macallan dikurangi (%)<input class="input num" id="rb" value="${s.diskon_beli_pct}" inputmode="decimal"></label>
          <label class="field">Harga beli bagian khusus: Macallan dikurangi (%)<input class="input num" id="rs" value="${s.diskon_set_pct ?? 30}" inputmode="decimal"></label>
          <label class="field">Kata kunci judul bagian khusus<input class="input" id="rk" value="${esc(s.diskon_set_keyword || 'COMPLETE SET')}"></label>
        </div>
        <h3 class="sub-title">Harga Shopee</h3>
        <div class="grid gauto fields-end">
          <label class="field">Harga Shopee diambil dari<select class="input" id="rm">
            <option value="file" ${s.harga_shopee_mode === 'file' ? 'selected' : ''}>Ikut data Excel / file Shopee</option>
            <option value="rumus" ${s.harga_shopee_mode === 'rumus' ? 'selected' : ''}>Rumus dari Macallan</option>
            <option value="manual" ${s.harga_shopee_mode === 'manual' ? 'selected' : ''}>Isi manual (file hanya memberi tanda)</option></select></label>
          <label class="field rumus-f">Macallan ditambah (Rp)<input class="input num" id="rp" data-money="neg" inputmode="text" value="${num(s.shopee_plus_rp || 0)}"></label>
          <label class="field rumus-f">Ditambah lagi (%)<input class="input num" id="rpc" value="${s.shopee_plus_pct || 0}" inputmode="decimal"></label>
          <label class="field rumus-f">Bulatkan ke atas<select class="input" id="rr">${[[1, 'Tidak dibulatkan'], [100, 'Kelipatan Rp100'], [500, 'Kelipatan Rp500'], [1000, 'Kelipatan Rp1.000']].map(([v, l]) => `<option value="${v}" ${Number(s.shopee_round || 1) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <label class="field">Est. potongan Shopee sebelum cair (%)<input class="input num" id="rf" value="${s.shopee_fee_pct}" inputmode="decimal"></label>
        </div>
        <div class="alert green small rumus-f" id="rprev"></div>
        <div class="alert yellow small">Pricelist WIN dibaca per bagian (judul <b>***...***</b>). Barang di bagian yang judulnya mengandung kata kunci (mis. <b>***COMPLETE SET BODY HONDA***</b>) memakai diskon bagian khusus. Barang lain memakai diskon barang biasa. Setelah mengubah kata kunci, upload ulang pricelist supaya bagian barang terbaca ulang.</div>
        <div class="alert blue small">Harga yang diubah manual diberi <b>kunci</b>. Upload pricelist WIN / file Shopee berikutnya <b>tidak menimpa</b> harga yang dikunci, hanya memberi tanda “Beda dengan file baru”.</div>
        <div class="row wrap" style="justify-content:flex-end"><button class="btn btn-dark" id="saveRules">Simpan rumus & hitung ulang</button></div></section>
      <div class="row wrap between"><div id="filters"></div><input class="input" id="q" placeholder="Cari nama / kode" style="max-width:280px" aria-label="Cari"></div>
      <div class="row wrap hidden" id="bulk"><span class="small"><b id="bn">0</b> dipilih:</span><button class="btn btn-sm" data-bulk="disk">Set diskon beli %</button><button class="btn btn-sm" data-bulk="lock">Kunci</button><button class="btn btn-sm" data-bulk="unlock">Buka kunci</button></div>
      <div class="card flush" id="tbl">${skeleton()}</div>
      <div class="card dark stack hidden" id="savebar"><b><span id="cn">0</span> barang diubah</b><div class="small" style="color:#E4E2DB">Harga baru berlaku untuk pesanan mulai sekarang. Laporan hari sebelumnya tidak ikut berubah.</div>
        <label class="field" style="color:#C9CCC8">Alasan (masuk ke riwayat)<input class="input" id="reason" placeholder="mis. harga naik dari WIN"></label>
        <div class="row"><button class="btn grow" id="undo">Batalkan perubahan</button><button class="btn btn-primary grow" id="save">Simpan &amp; kunci harga</button></div></div>
      <section class="card flush" id="hist"></section></div>`;

    const counts = () => ({
      all: products.length, locked: products.filter((p) => p.price_locked).length, pending: products.filter((p) => p.pending_price).length,
      zero: products.filter((p) => !Number(p.harga_beli)).length,
      thin: products.filter((p) => Number(p.harga_shopee) > 0 && (p.harga_shopee * (1 - s.shopee_fee_pct / 100) - p.harga_beli) / p.harga_shopee < 0.1).length
    });
    const paintFilters = () => {
      const c = counts();
      el.querySelector('#filters').innerHTML = chips('f', [['all', `Semua (${c.all})`], ['locked', `Dikunci (${c.locked})`], ['pending', `Beda dengan file baru (${c.pending})`], ['zero', `Modal kosong (${c.zero})`], ['thin', `Margin < 10% (${c.thin})`]], filter);
    };
    const visible = () => products.filter((p) => {
      if (search && !(p.name.toLowerCase().includes(search) || p.sku.toLowerCase().includes(search))) return false;
      if (filter === 'locked') return p.price_locked;
      if (filter === 'pending') return !!p.pending_price;
      if (filter === 'zero') return !Number(p.harga_beli);
      if (filter === 'thin') return Number(p.harga_shopee) > 0 && (p.harga_shopee * (1 - s.shopee_fee_pct / 100) - p.harga_beli) / p.harga_shopee < 0.1;
      return true;
    });
    const val = (p, f) => (changed.get(p.id)?.[f] ?? p[f]);
    const margin = (p) => { const sp = +val(p, 'harga_shopee'), b = +val(p, 'harga_beli'); return sp ? Math.round(sp * (1 - s.shopee_fee_pct / 100) - b) : null; };
    const paint = () => {
      const list = visible().slice(0, 1000);
      el.querySelector('#tbl').innerHTML = list.length ? `<div class="table-wrap"><table class="tbl" style="min-width:1080px"><thead><tr><th><input type="checkbox" class="check" id="all" aria-label="Pilih semua"></th><th>Kode · Barang</th>${FIELDS.map(([, l]) => `<th class="right">${l}</th>`).join('')}<th class="right">Est. margin</th><th>Sumber</th></tr></thead><tbody>
        ${list.map((p) => {
          const ch = changed.has(p.id), m = margin(p), pend = p.pending_price;
          return `<tr class="${ch || sel.has(p.id) ? 'hl' : ''}" data-row="${p.id}"><td><input type="checkbox" class="check" data-sel="${p.id}" ${sel.has(p.id) ? 'checked' : ''} aria-label="Pilih"></td>
            <td><b>${esc(p.name)}</b><div class="xs muted mono">${esc(p.sku)}${p.diskon_pct != null ? ` · diskon ${p.diskon_pct}%` : p.price_group === 'set' ? ` · <span class="tag yellow">${esc(s.diskon_set_keyword || 'COMPLETE SET')} ${s.diskon_set_pct ?? 30}%</span>` : ''}</div></td>
            ${FIELDS.map(([f]) => `<td class="right"><input class="input sm num ${p.price_locked || ch ? 'locked' : f === 'harga_5' || f === 'harga_beli' || (f === 'harga_shopee' && s.harga_shopee_mode === 'rumus') ? 'calc' : ''}" style="width:104px" data-f="${f}" data-id="${p.id}" data-money value="${num(val(p, f))}" inputmode="numeric" aria-label="${f}"></td>`).join('')}
            <td class="num"><b class="${m == null ? '' : m < 0 ? 'neg' : 'pos'}">${m == null ? '–' : rp(m)}</b></td>
            <td>${pend ? `<button class="tag yellow" style="border:0;cursor:pointer" data-pend="${p.id}">Beda: ${esc(pend.sumber)} ${pend.macallan ? 'Macallan ' + num(pend.macallan) : ''}${pend.harga_shopee ? ' Shopee ' + num(pend.harga_shopee) : ''}</button>`
              : p.price_locked ? '<span class="tag dark">Dikunci owner</span>' : !Number(p.harga_beli) ? '<span class="tag red">Modal kosong</span>' : '<span class="tag">Otomatis</span>'}</td></tr>`;
        }).join('')}</tbody></table></div>${visible().length > 1000 ? `<div class="xs muted" style="padding:8px 16px">Menampilkan 1.000 dari ${visible().length} barang. Gunakan pencarian / filter untuk barang lainnya.</div>` : ''}` : emptyState('Tidak ada barang di filter ini.', 'tag');
      el.querySelector('#savebar').classList.toggle('hidden', !changed.size);
      el.querySelector('#cn').textContent = changed.size;
      el.querySelector('#bulk').classList.toggle('hidden', !sel.size);
      el.querySelector('#bn').textContent = sel.size;
    };
    const load = async () => {
      let data;
      try { data = await fetchAll(() => supa.from('products').select('id, sku, name, category, macallan, harga_5, harga_beli, harga_shopee, diskon_pct, price_group, price_locked, pending_price').eq('active', true).order('name').order('id')); }
      catch (error) { return toastErr(error); }
      products = data; changed.clear(); sel.clear(); paintFilters(); paint(); paintRumus();
    };
    const hist = async () => {
      const { data } = await supa.from('price_history').select('*, products(name)').order('created_at', { ascending: false }).limit(25);
      const L = { macallan: 'Macallan', harga_5: 'Harga 5%', harga_beli: 'Harga beli', harga_shopee: 'Harga Shopee' };
      el.querySelector('#hist').innerHTML = `<div class="card-h"><h2>Riwayat perubahan harga</h2></div>${data?.length ? `<div class="list">${data.map((h) => `<div class="list-item"><div class="grow small">${esc(h.products?.name || '')} · ${L[h.field]} ${num(h.old_value)} → <b>${num(h.new_value)}</b>${h.reason ? ` <span class="muted">(${esc(h.reason)})</span>` : ''}</div>
        <span class="xs muted nowrap">${h.source === 'owner' ? esc(nameOf(h.user_id)) : h.source === 'pricelist' ? 'Pricelist WIN' : h.source === 'shopee' ? 'File Shopee' : 'Rumus'} · ${fmtDate(h.created_at, { day: 'numeric', month: 'short' })}</span></div>`).join('')}</div>` : emptyState('Belum ada perubahan.', 'tag')}`;
    };

    on(el, 'click', '[data-chips="f"] .chip', (e, b) => { filter = b.dataset.v; paintFilters(); paint(); });
    el.querySelector('#q').addEventListener('input', debounce((e) => { search = e.target.value.trim().toLowerCase(); paint(); }, 250));
    on(el, 'change', '[data-f]', (e, inp) => {
      const id = +inp.dataset.id, f = inp.dataset.f, p = products.find((x) => x.id === id);
      const c = changed.get(id) || {};
      c[f] = parseNum(inp.value);
      if (f === 'macallan' && !p.price_locked) {
        const d = p.diskon_pct ?? (p.price_group === 'set' ? (s.diskon_set_pct ?? 30) : s.diskon_beli_pct);
        c.harga_5 = Math.round(c.macallan * (1 - s.potongan_5_pct / 100)); c.harga_beli = Math.round(c.macallan * (1 - d / 100));
        if (s.harga_shopee_mode === 'rumus' && c.harga_shopee === undefined) c.harga_shopee = shopeeOf(c.macallan);
      }
      changed.set(id, c); paint();
    });
    on(el, 'change', '[data-sel]', (e, c) => { c.checked ? sel.add(+c.dataset.sel) : sel.delete(+c.dataset.sel); paint(); });
    on(el, 'change', '#all', (e, c) => { visible().forEach((p) => (c.checked ? sel.add(p.id) : sel.delete(p.id))); paint(); });
    on(el, 'click', '[data-bulk]', async (e, b) => {
      const ids = [...sel]; const k = b.dataset.bulk;
      try {
        if (k === 'disk') {
          const v = await modal({ title: 'Diskon harga beli', body: `<label class="field">Diskon dari Macallan (%) untuk ${ids.length} barang<input class="input num" id="dv" value="25" inputmode="decimal"></label>`, actions: [{ label: 'Batal', value: null }, { label: 'Terapkan', cls: 'btn-primary', onClick: (ov) => +ov.querySelector('#dv').value }] });
          if (v == null) return;
          await rpc('update_prices', { p: { reason: `Diskon beli ${v}%`, rows: ids.map((id) => { const p = products.find((x) => x.id === id); return { id, diskon_pct: v, harga_beli: Math.round(p.macallan * (1 - v / 100)) }; }) } });
        } else {
          await rpc('update_prices', { p: { reason: k === 'lock' ? 'Kunci harga' : 'Buka kunci', rows: ids.map((id) => ({ id, lock: k === 'lock' })) } });
        }
        toast('Tersimpan', 'ok'); load(); hist();
      } catch (err) { toastErr(err); }
    });
    on(el, 'click', '[data-pend]', async (e, b) => {
      const p = products.find((x) => x.id === +b.dataset.pend), pend = p.pending_price;
      const r = await modal({ title: 'Harga berbeda dari file baru', body: `<p style="margin-top:0"><b>${esc(p.name)}</b> dikunci owner. ${esc(pend.sumber)} (${esc(pend.tanggal || '')}) membawa harga berbeda:</p>
        ${pend.macallan ? `<div class="line-row"><span>Macallan</span><span>${num(p.macallan)} → <b>${num(pend.macallan)}</b></span></div>` : ''}${pend.harga_shopee ? `<div class="line-row"><span>Harga Shopee</span><span>${num(p.harga_shopee)} → <b>${num(pend.harga_shopee)}</b></span></div>` : ''}`,
        actions: [{ label: 'Abaikan (tetap harga sekarang)', value: 'no' }, { label: 'Pakai harga baru', cls: 'btn-primary', value: 'yes' }] });
      if (!r) return;
      const row = { id: p.id, clear_pending: true };
      if (r === 'yes') {
        if (pend.macallan) { const d = p.diskon_pct ?? (p.price_group === 'set' ? (s.diskon_set_pct ?? 30) : s.diskon_beli_pct); Object.assign(row, { macallan: pend.macallan, harga_5: Math.round(pend.macallan * (1 - s.potongan_5_pct / 100)), harga_beli: Math.round(pend.macallan * (1 - d / 100)) }); }
        if (pend.macallan && s.harga_shopee_mode === 'rumus') row.harga_shopee = shopeeOf(pend.macallan);
        if (pend.harga_shopee) row.harga_shopee = pend.harga_shopee;
      }
      try { await rpc('update_prices', { p: { reason: r === 'yes' ? 'Terima harga dari ' + pend.sumber : 'Abaikan harga ' + pend.sumber, rows: [row] } }); toast('Tersimpan', 'ok'); load(); hist(); } catch (err) { toastErr(err); }
    });
    el.querySelector('#undo').onclick = () => { changed.clear(); paint(); };
    el.querySelector('#save').onclick = async (e) => {
      e.target.disabled = true;
      try {
        await rpc('update_prices', { p: { reason: el.querySelector('#reason').value.trim() || 'Diubah owner', rows: [...changed].map(([id, c]) => ({ id, ...c, lock: true })) } });
        toast(changed.size + ' harga tersimpan & dikunci', 'ok'); load(); hist();
      } catch (err) { toastErr(err); } finally { e.target.disabled = false; }
    };
    // rumus harga Shopee: Macallan × (1 + %) + Rp, dibulatkan ke atas
    const rumusIn = () => ({ rp: parseNum(el.querySelector('#rp').value), pct: parseFloat(String(el.querySelector('#rpc').value).replace(',', '.')) || 0, round: +el.querySelector('#rr').value || 1 });
    const shopeeOf = (mac, r = { rp: Number(s.shopee_plus_rp || 0), pct: Number(s.shopee_plus_pct || 0), round: Number(s.shopee_round || 1) }) => {
      if (!(mac > 0)) return 0;
      const v = mac * (1 + r.pct / 100) + r.rp;
      return r.round > 1 ? Math.ceil(v / r.round) * r.round : Math.round(v);
    };
    const paintRumus = () => {
      const on = el.querySelector('#rm').value === 'rumus';
      el.querySelectorAll('.rumus-f').forEach((x) => x.classList.toggle('hidden', !on));
      const r = rumusIn(), ex = products.find((p) => Number(p.macallan) > 0);
      const mac = ex ? Number(ex.macallan) : 100000;
      el.querySelector('#rprev').innerHTML = `Rumus: Harga Shopee = Macallan${r.pct ? ` + ${r.pct}%` : ''}${r.rp ? ` ${r.rp < 0 ? '−' : '+'} ${rp(Math.abs(r.rp))}` : ''}${r.round > 1 ? `, dibulatkan ke atas kelipatan ${rp(r.round)}` : ''}.<br>Contoh${ex ? ' ' + esc(ex.name) : ''}: Macallan ${rp(mac)} → <b>Harga Shopee ${rp(shopeeOf(mac, r))}</b>. Berlaku untuk barang yang tidak dikunci, dan otomatis dipakai setiap upload pricelist.`;
    };
    el.querySelector('#rules').addEventListener('input', paintRumus);
    el.querySelector('#rules').addEventListener('change', paintRumus);
    paintRumus();
    el.querySelector('#saveRules').onclick = async () => {
      const r = rumusIn();
      const upd = { potongan_5_pct: +el.querySelector('#r5').value, diskon_beli_pct: +el.querySelector('#rb').value, diskon_set_pct: +el.querySelector('#rs').value, diskon_set_keyword: el.querySelector('#rk').value.trim() || 'COMPLETE SET', harga_shopee_mode: el.querySelector('#rm').value, shopee_fee_pct: +el.querySelector('#rf').value, shopee_plus_rp: r.rp, shopee_plus_pct: r.pct, shopee_round: r.round, updated_at: new Date().toISOString() };
      if (!(await confirmBox('Simpan rumus?', `Harga 5% dan harga beli semua barang yang <b>tidak dikunci</b> akan dihitung ulang.${upd.harga_shopee_mode === 'rumus' ? ' Harga Shopee juga dihitung ulang dari Macallan.' : ''}`))) return;
      try {
        const { error } = await supa.from('settings').update(upd).eq('id', 1); if (error) throw error;
        Object.assign(store.settings, upd); Object.assign(s, upd);
        const n = await rpc('recalc_prices'); toast(`Rumus tersimpan. ${n} barang dihitung ulang.`, 'ok'); load(); hist();
      } catch (err) { toastErr(err); }
    };
    el.querySelector('#xl').onclick = async () => {
      const d = await modal({ title: 'Unduh Excel pricelist & toko', body: `<div class="stack">
        <div class="small muted">Tab pertama <b>PRICELIST</b> (harga terbaru + ringkasan jumlah barang & kategori). Tab berikutnya satu per toko untuk tanggal di bawah, dengan total modal, harga Shopee, pendapatan & margin di bagian atas. Baris kosong bisa diisi manual: ketik resi & kode, harga terisi otomatis.</div>
        <label class="field">Tanggal resi<input type="date" class="input" id="xd" value="${todayStr()}" max="${todayStr()}"></label></div>`,
        actions: [{ label: 'Batal', value: null }, { label: 'Unduh Excel', cls: 'btn-primary', onClick: (ov) => ov.querySelector('#xd').value || todayStr() }] });
      if (!d) return;
      const b = el.querySelector('#xl'); b.disabled = true; toast('Menyiapkan Excel…');
      try { const r = await downloadHargaExcel({ date: d, products }); toast(`Excel siap: ${num(r.products)} barang, ${r.stores} toko, ${r.resi} resi`, 'ok'); }
      catch (err) { toastErr(err); } finally { b.disabled = false; }
    };
    load(); hist();
  }
};
