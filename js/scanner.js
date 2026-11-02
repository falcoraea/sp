import { esc, icon, toast } from './ui.js';

// Kolom scan untuk 3 cara:
// 1) Scanner Bluetooth / USB (langsung atau lewat OTG converter): alat bekerja seperti keyboard,
//    mengetik kode sangat cepat lalu Enter / Tab / tanpa akhiran. Semua didukung.
// 2) Ketik manual + Enter.
// 3) Kamera HP.
// Scan tetap tertangkap walau kolom tidak sedang dipilih (selama tidak sedang mengetik di kolom lain).
let active = null;          // handler scan halaman yang sedang tampil
const KB_KEY = 'scan-hide-keyboard';

export function scanBox(id, placeholder = 'Scan / ketik barcode lalu Enter') {
  let hide = false; try { hide = localStorage.getItem(KB_KEY) === '1'; } catch (_) {}
  return `<form class="scanbox" id="${id}" autocomplete="off">
    <input class="input grow" name="code" placeholder="${esc(placeholder)}" inputmode="${hide ? 'none' : 'text'}" enterkeyhint="go" aria-label="${esc(placeholder)}" autocapitalize="characters" autocorrect="off" spellcheck="false">
    <button type="button" class="btn" data-kb title="Sembunyikan / tampilkan keyboard HP saat memakai scanner Bluetooth" aria-label="Keyboard HP">${icon(hide ? 'scan' : 'list', 18)}<span class="hide-mobile">${hide ? 'Mode scanner' : 'Mode ketik'}</span></button>
    <button type="button" class="btn btn-dark" data-cam aria-label="Scan pakai kamera">${icon('camera')}<span class="hide-mobile">Kamera</span></button>
  </form>`;
}

export function bindScan(root, id, onScan, { autofocus = true } = {}) {
  const form = root.querySelector('#' + id);
  const inp = form.querySelector('input');
  let busy = false, times = [], idleTimer = null;
  const fire = async (code) => {
    code = String(code || '').replace(/[\r\n\t]/g, '').trim();
    if (!code || busy) return;
    busy = true;
    try {
      const ok = await onScan(code);
      form.classList.remove('scan-flash', 'bad'); void form.offsetWidth;
      form.classList.add('scan-flash'); if (ok === false) form.classList.add('bad');
    } finally { busy = false; }
  };
  const submit = () => { clearTimeout(idleTimer); const v = inp.value; inp.value = ''; times = []; fire(v); };
  form.addEventListener('submit', (e) => { e.preventDefault(); submit(); });
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && inp.value.trim()) { e.preventDefault(); submit(); return; }   // scanner dengan akhiran Tab
    if (e.key.length === 1) times.push(performance.now());
  });
  // scanner tanpa akhiran: huruf masuk sangat cepat lalu berhenti -> kirim otomatis
  inp.addEventListener('input', () => {
    clearTimeout(idleTimer);
    const n = times.length;
    if (n >= 4 && (times[n - 1] - times[0]) / (n - 1) < 35) idleTimer = setTimeout(submit, 120);
  });
  form.querySelector('[data-cam]').addEventListener('click', () => openCamera(fire));
  form.querySelector('[data-kb]').addEventListener('click', (e) => {
    const hide = inp.getAttribute('inputmode') !== 'none';
    try { localStorage.setItem(KB_KEY, hide ? '1' : '0'); } catch (_) {}
    inp.setAttribute('inputmode', hide ? 'none' : 'text');
    e.currentTarget.innerHTML = `${icon(hide ? 'scan' : 'list', 18)}<span class="hide-mobile">${hide ? 'Mode scanner' : 'Mode ketik'}</span>`;
    toast(hide ? 'Mode scanner: keyboard HP disembunyikan' : 'Mode ketik: keyboard HP muncul');
    inp.blur(); setTimeout(() => inp.focus(), 50);
  });
  active = { fire, inp };
  if (autofocus && (window.matchMedia('(min-width: 900px)').matches || inp.getAttribute('inputmode') === 'none')) setTimeout(() => inp.focus(), 60);
  return { focus: () => inp.focus(), fire };
}

// tangkap scan dari alat walau kolom scan tidak sedang dipilih
let buf = '', bufTimes = [], bufTimer = null;
document.addEventListener('keydown', (e) => {
  if (!active || !document.body.contains(active.inp)) { active = null; return; }
  const t = e.target;
  if (t === active.inp) return;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
  if (document.querySelector('.overlay, .camera, .tour-block')) return;
  if (e.ctrlKey || e.altKey || e.metaKey) return;
  const now = performance.now();
  if ((e.key === 'Enter' || e.key === 'Tab') && buf.length >= 3) {
    const fast = bufTimes.length > 1 && (bufTimes[bufTimes.length - 1] - bufTimes[0]) / (bufTimes.length - 1) < 35;
    if (fast) { e.preventDefault(); const code = buf; buf = ''; bufTimes = []; active.fire(code); }
    return;
  }
  if (e.key.length !== 1) return;
  if (bufTimes.length && now - bufTimes[bufTimes.length - 1] > 80) { buf = ''; bufTimes = []; }
  buf += e.key; bufTimes.push(now);
  clearTimeout(bufTimer);
  bufTimer = setTimeout(() => {   // tanpa akhiran
    const n = bufTimes.length;
    if (buf.length >= 4 && n > 1 && (bufTimes[n - 1] - bufTimes[0]) / (n - 1) < 35) active?.fire(buf);
    buf = ''; bufTimes = [];
  }, 150);
});

const FORMATS = ['code_128', 'ean_13', 'ean_8', 'code_39', 'code_93', 'upc_a', 'upc_e', 'itf', 'codabar', 'qr_code', 'data_matrix'];

// Kamera HP. Dibuat lebih tahan untuk barcode panjang (Code128 13+ karakter):
// resolusi tinggi, fokus otomatis terus-menerus, zoom, area tengah diperbesar,
// dan dua mesin pembaca (bawaan Chrome + ZXing) dipakai bergantian.
export async function openCamera(onCode, { continuous = true, title = 'Arahkan kamera ke barcode' } = {}) {
  if (!navigator.mediaDevices?.getUserMedia) { toast('Kamera tidak didukung di browser ini', 'err'); return; }
  const wrap = document.createElement('div');
  wrap.className = 'camera';
  wrap.innerHTML = `<video playsinline muted></video><div class="frame"></div>
    <div class="cam-top"><span>${esc(title)}</span><button class="btn btn-sm" data-close>Tutup</button></div>
    <div class="cam-bar"><div class="cam-tip">Isi kotak kuning dengan barcode (jarak ±10–20 cm). Dari layar laptop, miringkan HP sedikit supaya tidak ada garis-garis.</div>
      <div class="cam-last" aria-live="polite"></div>
      <div class="row"><button class="btn grow" data-torch style="display:none">Senter</button><button class="btn grow" data-zoom style="display:none">Zoom 2×</button><button class="btn btn-primary grow" data-close>Selesai</button></div></div>`;
  document.body.appendChild(wrap);
  const video = wrap.querySelector('video');
  const last = wrap.querySelector('.cam-last');
  let stream, stopped = false, lastCode = '', lastAt = 0;

  const stop = () => {
    stopped = true;
    stream && stream.getTracks().forEach((t) => t.stop());
    wrap.remove();
  };
  wrap.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', stop));

  const handle = async (code) => {
    const now = Date.now();
    if (!code || (code === lastCode && now - lastAt < 1800)) return;
    lastCode = code; lastAt = now;
    last.textContent = code;
    await onCode(code);
    if (!continuous) stop();
  };

  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: {
      facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 },
      advanced: [{ focusMode: 'continuous' }] } });
  } catch (e) {
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }); }
    catch (_) { stop(); toast('Izin kamera ditolak. Izinkan kamera di pengaturan browser.', 'err'); return; }
  }
  video.srcObject = stream;
  await video.play().catch(() => {});

  const track = stream.getVideoTracks()[0];
  const caps = track.getCapabilities ? track.getCapabilities() : {};
  const apply = (c) => track.applyConstraints({ advanced: [c] }).catch(() => {});
  if (caps.focusMode && caps.focusMode.includes('continuous')) apply({ focusMode: 'continuous' });
  if (caps.torch) {
    const tb = wrap.querySelector('[data-torch]'); tb.style.display = '';
    let on = false;
    tb.addEventListener('click', () => { on = !on; apply({ torch: on }); tb.textContent = on ? 'Senter mati' : 'Senter'; });
  }
  if (caps.zoom && caps.zoom.max >= 1.5) {
    const zb = wrap.querySelector('[data-zoom]'); zb.style.display = '';
    let z = 1;
    zb.addEventListener('click', () => { z = z === 1 ? Math.min(2, caps.zoom.max) : 1; apply({ zoom: z }); zb.textContent = z === 1 ? 'Zoom 2×' : 'Zoom 1×'; });
  }

  // potongan tengah gambar (sesuai kotak kuning), diperbesar supaya garis tipis terbaca
  const canvas = document.createElement('canvas');
  const cx = canvas.getContext('2d', { willReadFrequently: true });
  const crop = () => {
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh) return null;
    const w = Math.round(vw * 0.9), h = Math.round(vh * 0.45);
    const scale = Math.min(2, 1600 / w);
    canvas.width = Math.round(w * scale); canvas.height = Math.round(h * scale);
    cx.imageSmoothingEnabled = false;
    cx.drawImage(video, (vw - w) / 2, (vh - h) / 2, w, h, 0, 0, canvas.width, canvas.height);
    return canvas;
  };

  let detector = null;
  if ('BarcodeDetector' in window) {
    try {
      const supported = await window.BarcodeDetector.getSupportedFormats();
      const f = FORMATS.filter((x) => supported.includes(x));
      if (f.length) detector = new window.BarcodeDetector({ formats: f });
    } catch (_) { detector = null; }
  }
  let zx = null, zxLoading = false;
  const loadZx = async () => {
    if (zx || zxLoading) return; zxLoading = true;
    try {
      const lib = await import('https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/+esm');
      const hints = new Map();
      hints.set(lib.DecodeHintType.TRY_HARDER, true);
      hints.set(lib.DecodeHintType.POSSIBLE_FORMATS, [lib.BarcodeFormat.CODE_128, lib.BarcodeFormat.EAN_13, lib.BarcodeFormat.EAN_8, lib.BarcodeFormat.CODE_39, lib.BarcodeFormat.UPC_A, lib.BarcodeFormat.ITF, lib.BarcodeFormat.QR_CODE]);
      const reader = new lib.MultiFormatReader(); reader.setHints(hints);
      zx = (c) => {
        const { width: w, height: h } = c;
        const px = cx.getImageData(0, 0, w, h).data;
        const lum = new Uint8ClampedArray(w * h);
        for (let i = 0, j = 0; i < lum.length; i++, j += 4) lum[i] = (px[j] * 299 + px[j + 1] * 587 + px[j + 2] * 114) / 1000;
        try { return reader.decode(new lib.BinaryBitmap(new lib.HybridBinarizer(new lib.RGBLuminanceSource(lum, w, h)))).getText(); }
        catch (_) { return null; }
      };
    } catch (e) { console.error(e); if (!detector) toast('Pembaca barcode gagal dimuat. Ketik kodenya atau pakai scanner.', 'err'); }
  };
  if (!detector) loadZx();
  const started = Date.now();
  let tick = 0;
  const loop = async () => {
    if (stopped) return;
    try {
      if (video.readyState >= 2) {
        tick++;
        let code = null;
        if (detector) {
          const src = tick % 2 ? crop() : video;      // bergantian: area tengah diperbesar & gambar penuh
          const r = src ? await detector.detect(src) : [];
          if (r.length) code = r[0].rawValue;
          if (!code && Date.now() - started > 2500) loadZx();   // belum terbaca -> bantu dengan ZXing
        }
        if (!code && zx && (!detector || tick % 3 === 0)) { const c = crop(); if (c) code = zx(c); }
        if (code) await handle(code);
      }
    } catch (_) {}
    setTimeout(loop, detector ? 90 : 160);
  };
  loop();
}
