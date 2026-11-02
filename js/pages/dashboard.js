import { supa, rpc } from '../supa.js';
import { store } from '../store.js';
import { esc, rp, pct, todayStr, addDays, monthStart, longToday, icon, chips, on, toastErr, ago, fmtDate } from '../ui.js';

const PERIODS = [['today', 'Hari ini'], ['yesterday', 'Kemarin'], ['7', '7 hari'], ['month', 'Bulan ini'], ['30', '30 hari']];
function range(p) {
  const t = todayStr();
  if (p === 'yesterday') return [addDays(t, -1), addDays(t, -1)];
  if (p === '7') return [addDays(t, -6), t];
  if (p === '30') return [addDays(t, -29), t];
  if (p === 'month') return [monthStart(t), t];
  return [t, t];
}
const LV = { tinggi: ['Tinggi', 'solid-red'], sedang: ['Sedang', 'solid-yellow'], info: ['Info', ''] };

export default {
  tour: [
    { sel: '[data-chips="period"]', title: 'Pilih periode', body: 'Lihat angka hari ini, kemarin, 7 hari, atau bulan ini.' },
    { sel: '#kpi', title: 'Omzet sampai laba bersih', body: 'Omzet penjualan, omzet sudah terbayar (lunas), profit kotor, rugi hilang/rusak, dan laba bersih setelah gaji & operasional.' },
    { sel: '#fraud', title: 'Indikasi kecurangan', body: 'Kejadian yang tidak sesuai alur scan, lengkap dengan bukti, pegawai terkait, dan nilainya.' },
    { sel: '#flow', title: 'Kepatuhan alur scan', body: 'Persentase langkah yang dijalankan dengan benar. Angka rendah = ada langkah yang sering dilewati.' }
  ],
  async render(el) {
    let period = sessionStorage.getItem('dash-period') || 'today';
    el.innerHTML = `<div class="stack" style="gap:16px">
      <div class="row between wrap"><div class="muted small">${esc(longToday())}</div>${chips('period', PERIODS, period)}</div>
      <div id="kpi"></div>
      <section class="card flush danger" id="fraud"></section>
      <div class="grid gauto-lg">
        <section class="card" id="breakdown"></section>
        <section class="card" id="chart"></section>
      </div>
      <div class="grid gauto-lg">
        <section class="card" id="flow"></section>
        <section class="card" id="files"></section>
      </div>
    </div>`;
    on(el, 'click', '[data-chips="period"] .chip', (e, b) => {
      period = b.dataset.v; sessionStorage.setItem('dash-period', period);
      el.querySelectorAll('[data-chips="period"] .chip').forEach((c) => c.classList.toggle('on', c === b));
      load();
    });
    rpc('run_checks').catch(() => {});

    const load = async () => {
      const [from, to] = range(period);
      el.querySelector('#kpi').innerHTML = '<div class="skeleton" style="height:110px"></div>';
      try {
        const s = await rpc('get_summary', { p_from: from, p_to: to });
        el.querySelector('#kpi').innerHTML = `<div class="grid gkpi">
          <div class="card kpi"><div class="label">Omzet penjualan</div><div class="value">${rp(s.omzet)}</div><div class="sub">${s.resi} resi · ${s.proses} masih diproses</div></div>
          <div class="card kpi"><div class="label">Omzet terbayar (lunas)</div><div class="value pos">${rp(s.omzet_lunas)}</div><div class="sub">belum cair ${rp(s.belum_cair)}</div></div>
          <div class="card kpi"><div class="label">Profit kotor</div><div class="value">${rp(s.profit_kotor)}</div><div class="sub">dana Shopee − modal WIN</div></div>
          <div class="card kpi" style="border:1.5px solid var(--red)"><div class="label">Rugi hilang &amp; rusak</div><div class="value neg">${rp(s.rugi)}</div><div class="sub">opname, retur rusak, ongkir retur</div></div>
          <div class="card kpi dark wide-m"><div class="label">Laba bersih</div><div class="value">${rp(s.laba_bersih)}</div><div class="sub" style="color:#9FD6B8">setelah gaji &amp; operasional</div></div>
        </div>`;
        el.querySelector('#breakdown').innerHTML = `<h2 class="sec-title" style="margin-bottom:10px">Dari omzet ke laba bersih</h2>
          <div class="line-row"><span>Omzet penjualan</span><b>${rp(s.omzet)}</b></div>
          <div class="line-row"><span>Potongan Shopee (selisih ke dana cair / estimasi)</span><span>${rp(-(s.omzet - s.dana_shopee))}</span></div>
          <div class="line-row"><span>Modal barang (WIN)</span><span>${rp(-s.modal)}</span></div>
          <div class="line-row total"><span>Profit kotor</span><span>${rp(s.profit_kotor)}</span></div>
          <div class="line-row"><span>Bahan packing</span><span>${rp(-s.packing)}</span></div>
          <div class="line-row"><span>Rugi hilang, rusak &amp; retur</span><span class="neg">${rp(-s.rugi)}</span></div>
          <div class="line-row"><span>Gaji pegawai (porsi periode ini)</span><span>${rp(-s.gaji)}</span></div>
          <div class="line-row"><span>Operasional</span><span>${rp(-s.operasional)}</span></div>
          <div class="line-row total" style="color:var(--green)"><span>Laba bersih</span><span>${rp(s.laba_bersih)}</span></div>`;
        const k = s.kepatuhan || {};
        const bar = (label, v) => `<div style="margin-bottom:12px"><div class="line-row"><span>${label}</span><b>${pct(v)}</b></div>
          <div class="progress"><div style="width:${v ?? 0}%;background:${v == null ? 'var(--line)' : v >= 95 ? 'var(--green)' : v >= 80 ? 'var(--accent)' : 'var(--red)'}"></div></div></div>`;
        el.querySelector('#flow').innerHTML = `<h2 class="sec-title" style="margin-bottom:12px">Kepatuhan alur scan</h2>
          ${bar('Packing scan resi + barang', k.packing_scan)}${bar('Barang WIN diterima lengkap', k.terima_lengkap)}
          ${bar('Retur di-scan kembali', k.retur_scan)}${bar('Foto paket diambil', k.foto_paket)}
          <div class="muted xs">“–” berarti belum ada data di periode ini.</div>`;
      } catch (e) { toastErr(e); el.querySelector('#kpi').innerHTML = '<div class="alert red">Gagal memuat ringkasan.</div>'; }
    };

    const loadFraud = async () => {
      const box = el.querySelector('#fraud');
      const { data, error } = await supa.from('anomalies').select('*').eq('resolved', false).order('created_at', { ascending: false }).limit(8);
      if (error) return toastErr(error);
      const total = (data || []).reduce((a, b) => a + Number(b.value || 0), 0);
      const cnt = (l) => data.filter((d) => d.level === l).length;
      box.innerHTML = `<div class="card-h" style="background:#F9E8E4;flex-wrap:wrap">
          <div class="row">${icon('shield', 24)}<div><h2 style="font-size:17px;color:#6E2418">Indikasi kecurangan &amp; masalah</h2><div class="small" style="color:#6E2418">Belum ditangani · nilai berisiko <b>${rp(total)}</b></div></div></div>
          <div class="row"><span class="tag solid-red">${cnt('tinggi')} tinggi</span><span class="tag solid-yellow">${cnt('sedang')} sedang</span><span class="tag">${cnt('info')} info</span></div></div>
        ${data.length ? `<div class="table-wrap"><table class="tbl" style="min-width:760px"><thead><tr><th>Tingkat</th><th>Kejadian</th><th>Bukti dari sistem</th><th>Terkait</th><th class="right">Nilai</th><th></th></tr></thead><tbody>
          ${data.map((a) => `<tr><td><span class="tag ${LV[a.level][1]}">${LV[a.level][0]}</span></td><td><b>${esc(a.title)}</b><div class="xs muted">${ago(a.created_at)}</div></td>
            <td class="small muted">${esc(a.evidence || '')}</td><td class="nowrap small">${esc(store.profilesById[a.related_user]?.full_name || '–')}</td>
            <td class="num"><b>${rp(a.value)}</b></td><td><a href="#/masalah?id=${a.id}" class="nowrap">Lihat</a></td></tr>`).join('')}
          </tbody></table></div><a href="#/masalah" class="btn btn-ghost btn-block" style="border-top:1px solid var(--line);border-radius:0">Lihat semua</a>`
          : '<div class="empty">Tidak ada masalah yang belum ditangani. 👍</div>'}`;
    };

    const loadChart = async () => {
      const box = el.querySelector('#chart');
      try {
        const rows = await rpc('daily_series', { p_days: 14 });
        const max = Math.max(1, ...rows.map((r) => Math.abs(Number(r.laba_bersih))));
        box.innerHTML = `<h2 class="sec-title">Laba bersih 14 hari</h2><div class="muted xs" style="margin-bottom:10px">Merah = rugi di hari itu</div>
          <div class="bars">${rows.map((r, i) => `<div class="b" title="${fmtDate(r.d)}: ${rp(r.laba_bersih)}"><i class="${i === rows.length - 1 ? 'today' : ''} ${Number(r.laba_bersih) < 0 ? 'neg' : ''}" style="height:${Math.max(2, Math.abs(Number(r.laba_bersih)) / max * 100)}%"></i><span>${String(r.d).slice(8)}</span></div>`).join('')}</div>`;
      } catch (e) { console.error(e); box.innerHTML = '<div class="muted">Grafik gagal dimuat.</div>'; }
    };

    const loadFiles = async () => {
      const box = el.querySelector('#files');
      const { data } = await supa.from('uploads').select('type, created_at, user_id').order('created_at', { ascending: false }).limit(60);
      const last = {};
      (data || []).forEach((u) => { if (!last[u.type]) last[u.type] = u; });
      const row = (t, l, warnDays) => {
        const u = last[t];
        if (!u) return `<div class="line-row"><span>${l}</span><span class="neg">belum pernah</span></div>`;
        const days = Math.floor((Date.now() - new Date(u.created_at)) / 864e5);
        const cls = days >= warnDays ? 'neg' : days >= 1 ? 'warn-t' : 'pos';
        return `<div class="line-row"><span>${l}</span><span class="${cls}">${days === 0 ? 'hari ini' : days + ' hari lalu'} · ${esc(store.profilesById[u.user_id]?.full_name || '')}</span></div>`;
      };
      box.innerHTML = `<h2 class="sec-title" style="margin-bottom:10px">Status file Shopee</h2>
        ${row('pesanan', 'Pesanan', 2)}${row('pembatalan', 'Pembatalan', 3)}${row('pengembalian', 'Pengembalian / retur', 4)}${row('penghasilan', 'Penghasilan (dana cair)', 5)}${row('pricelist', 'Pricelist WIN', 30)}
        <a href="#/upload" class="btn btn-primary" style="margin-top:14px">Buka upload file Shopee</a>`;
    };

    load(); loadFraud(); loadChart(); loadFiles();
  }
};
