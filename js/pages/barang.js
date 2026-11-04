import { fetchAll, supa } from '../supa.js';
import { store } from '../store.js';
import { esc, rp, on, modal, toast, toastErr, pageHead, emptyState, skeleton, debounce, icon, parseNum } from '../ui.js';
import { openProduct, printLabels } from './stok.js';

export default {
  tour: [
    { sel: '#unk', title: 'Kode belum terdaftar', body: 'Kode dari file pesanan Shopee yang belum ada di master. Tambahkan supaya modal & stoknya tercatat.' },
    { sel: '#add', title: 'Tambah barang', body: 'Tambah barang baru atau varian baru (mis. memecah “lampu alis + lain-lain” jadi beberapa kode).' }
  ],
  async render(el, { params }) {
    const canEdit = ['owner', 'admin', 'kepala_gudang'].includes(store.role);
    const seePrice = ['owner', 'admin'].includes(store.role);
    let search = params.q || '', sel = new Set(), unkList = [];
    el.innerHTML = `${pageHead('Master barang', 'Kode barcode, nama, rak, dan stok minimum. Harga diatur owner di menu Atur harga.',
      `${canEdit ? `<button class="btn btn-primary" id="add">${icon('plus', 18)} Tambah barang</button>` : ''}<button class="btn" id="lbl">${icon('print', 18)} Cetak label (yang dicentang / semua)</button><a class="btn" href="#/upload">${icon('upload', 18)} Upload pricelist WIN</a>`)}
      <div class="stack"><div id="unk"></div>
      <input class="input" id="q" placeholder="Cari nama / kode" value="${esc(search)}" aria-label="Cari barang">
      <div class="card flush" id="list">${skeleton()}</div></div>`;

    const unknown = async () => {
      const { data } = await supa.from('order_items').select('sku, name').is('product_id', null).limit(500);
      const m = new Map(); (data || []).forEach((r) => { const k = r.sku || r.name; if (!m.has(k)) m.set(k, { ...r, n: 0 }); m.get(k).n++; });
      const list = [...m.values()];
      el.querySelector('#unk').innerHTML = list.length ? `<div class="card warn stack"><b>${list.length} kode dari pesanan Shopee belum terdaftar di master</b>
        <div class="list">${list.slice(0, 15).map((u, i) => `<div class="list-item" style="padding:8px 0"><div class="grow"><span class="mono small">${esc(u.sku || '(tanpa kode)')}</span><div class="xs muted">${esc(u.name)} · ${u.n} baris pesanan</div></div>${canEdit ? `<button class="btn btn-sm" data-addu="${i}">Tambahkan</button>` : ''}</div>`).join('')}</div></div>` : '';
      unkList = list;
    };

    const load = async () => {
      let data;
      try {
        data = await fetchAll(() => { let qy = supa.from('products').select('*').order('name').order('id'); if (search) qy = qy.or(`name.ilike.%${search}%,sku.ilike.%${search}%`); return qy; });
      } catch (error) { return toastErr(error); }
      el.querySelector('#list').innerHTML = data.length ? `<div class="table-wrap"><table class="tbl" style="min-width:${seePrice ? 860 : 600}px"><thead><tr><th></th><th>Kode · Barang</th><th>Kategori</th><th>Rak</th><th class="right">Stok</th><th class="right">Min.</th>${seePrice ? '<th class="right">Macallan</th><th class="right">Harga beli</th><th class="right">Harga Shopee</th>' : ''}<th></th></tr></thead><tbody>
        ${data.map((p) => `<tr class="${p.active ? '' : 'bad'}"><td><input type="checkbox" class="check" data-sel="${p.id}" ${sel.has(p.id) ? 'checked' : ''} aria-label="Pilih"></td>
          <td><b>${esc(p.name)}</b>${p.price_locked ? ' <span class="tag dark">dikunci</span>' : ''}<div class="xs muted mono">${esc(p.sku)}</div></td><td class="small">${esc(p.category || '')}</td><td class="mono">${esc(p.rack_code || '—')}</td>
          <td class="num"><b>${p.stock}</b></td><td class="num">${p.min_stock}</td>
          ${seePrice ? `<td class="num">${rp(p.macallan)}</td><td class="num ${!Number(p.harga_beli) ? 'neg' : ''}">${rp(p.harga_beli)}</td><td class="num">${rp(p.harga_shopee)}</td>` : ''}
          <td class="nowrap"><button class="btn btn-sm" data-hist="${p.id}">Riwayat</button>${canEdit ? ` <button class="btn btn-sm" data-edit="${p.id}">Ubah</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div>` : emptyState('Belum ada barang. Upload Pricelist WIN atau tambah manual.', 'list');
      el._data = data;
    };

    async function edit(p, preset = {}) {
      const isNew = !p;
      const { data: racks } = await supa.from('racks').select('code').order('code');
      const s = store.settings;
      const r = await modal({
        title: isNew ? 'Tambah barang' : 'Ubah barang',
        body: `<div class="grid g2">
          <label class="field" style="grid-column:1/-1">Kode / barcode *<input class="input mono" id="f-sku" value="${esc(p?.sku || preset.sku || '')}" ${isNew ? '' : 'readonly'}></label>
          <label class="field" style="grid-column:1/-1">Nama barang *<input class="input" id="f-name" value="${esc(p?.name || preset.name || '')}"></label>
          <label class="field">Kategori<input class="input" id="f-cat" value="${esc(p?.category || '')}" placeholder="mis. Panel, Lampu"></label>
          <label class="field">Rak<input class="input mono" id="f-rack" list="racklist" value="${esc(p?.rack_code || '')}" autocapitalize="characters"><datalist id="racklist">${(racks || []).map((x) => `<option value="${esc(x.code)}">`).join('')}</datalist></label>
          <label class="field">Stok minimum<input class="input num" id="f-min" inputmode="numeric" value="${p?.min_stock ?? 0}"></label>
          ${isNew && seePrice ? `<label class="field">Macallan (harga WIN)<input class="input num" id="f-mac" inputmode="numeric" data-money value="0"></label>
            <div class="small muted" style="grid-column:1/-1">Harga 5% & harga beli dihitung otomatis (−${s.potongan_5_pct}% dan −${s.diskon_beli_pct}%).</div>` : ''}
          ${!isNew ? `<label class="check" style="grid-column:1/-1"><input type="checkbox" id="f-act" ${p.active ? 'checked' : ''}> Barang aktif</label>` : ''}
        </div>`,
        actions: [{ label: 'Batal', value: null }, { label: 'Simpan', cls: 'btn-primary', onClick: async (ov) => {
          const v = (id) => ov.querySelector('#' + id)?.value.trim();
          const row = { name: v('f-name'), category: v('f-cat') || null, min_stock: parseInt(v('f-min'), 10) || 0 };
          if (!row.name) { toast('Nama wajib diisi', 'err'); return false; }
          const rack = (v('f-rack') || '').toUpperCase() || null;
          if (rack) await supa.from('racks').upsert({ code: rack }, { onConflict: 'code', ignoreDuplicates: true });
          row.rack_code = rack;
          if (isNew) {
            row.sku = v('f-sku'); if (!row.sku) { toast('Kode wajib diisi', 'err'); return false; }
            const mac = parseNum(v('f-mac')) || 0;
            Object.assign(row, { macallan: mac, harga_5: Math.round(mac * (1 - s.potongan_5_pct / 100)), harga_beli: Math.round(mac * (1 - s.diskon_beli_pct / 100)) });
            const { data: ins, error } = await supa.from('products').insert(row).select().single();
            if (error) throw error;
            if (preset.sku || preset.name) {
              let uq = supa.from('order_items').update({ product_id: ins.id, unit_cost: ins.harga_beli }).is('product_id', null);
              uq = preset.sku ? uq.eq('sku', preset.sku) : uq.eq('name', preset.name);
              await uq;
            }
          } else {
            row.active = ov.querySelector('#f-act').checked;
            const { error } = await supa.from('products').update(row).eq('id', p.id);
            if (error) throw error;
          }
          return true;
        } }]
      });
      if (r) { toast('Tersimpan', 'ok'); load(); unknown(); }
    }

    el.querySelector('#q').addEventListener('input', debounce((e) => { search = e.target.value.trim().replace(/[,%()]/g, ''); load(); }, 300));
    el.querySelector('#add')?.addEventListener('click', () => edit(null));
    on(el, 'click', '[data-edit]', (e, b) => edit(el._data.find((x) => x.id === +b.dataset.edit)));
    on(el, 'click', '[data-hist]', (e, b) => openProduct(+b.dataset.hist, load));
    on(el, 'change', '[data-sel]', (e, c) => { c.checked ? sel.add(+c.dataset.sel) : sel.delete(+c.dataset.sel); });
    el.querySelector('#lbl').onclick = () => {
      const items = (el._data || []).filter((p) => sel.has(p.id));
      printLabels(items.length ? items : (el._data || []));
    };
    on(el, 'click', '[data-addu]', (e, b) => edit(null, unkList[+b.dataset.addu]));
    unknown(); load();
  }
};
