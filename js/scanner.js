import { esc, icon, toast } from './ui.js';

// Kolom scan: bisa dipakai scanner gun (USB/Bluetooth, mengetik + Enter),
// ketik manual, atau tombol kamera.
export function scanBox(id, placeholder = 'Scan / ketik barcode lalu Enter') {
  return `<form class="scanbox" id="${id}" autocomplete="off">
    <input class="input grow" name="code" placeholder="${esc(placeholder)}" inputmode="text" enterkeyhint="go" aria-label="${esc(placeholder)}" autocapitalize="characters">
    <button type="button" class="btn btn-dark" data-cam aria-label="Scan pakai kamera">${icon('camera')}<span class="hide-mobile">Kamera</span></button>
  </form>`;
}

export function bindScan(root, id, onScan, { autofocus = true } = {}) {
  const form = root.querySelector('#' + id);
  const inp = form.querySelector('input');
  let busy = false;
  const fire = async (code) => {
    code = String(code || '').trim();
    if (!code || busy) return;
    busy = true;
    try {
      const ok = await onScan(code);
      form.classList.remove('scan-flash', 'bad'); void form.offsetWidth;
      form.classList.add('scan-flash'); if (ok === false) form.classList.add('bad');
    } finally { busy = false; }
  };
  form.addEventListener('submit', (e) => { e.preventDefault(); const v = inp.value; inp.value = ''; fire(v); });
  form.querySelector('[data-cam]').addEventListener('click', () => openCamera(fire));
  if (autofocus && window.matchMedia('(min-width: 900px)').matches) setTimeout(() => inp.focus(), 60);
  return { focus: () => inp.focus(), fire };
}

const FORMATS = ['code_128', 'ean_13', 'ean_8', 'code_39', 'code_93', 'upc_a', 'upc_e', 'itf', 'codabar', 'qr_code', 'data_matrix'];

export async function openCamera(onCode, { continuous = true, title = 'Arahkan kamera ke barcode' } = {}) {
  if (!navigator.mediaDevices?.getUserMedia) { toast('Kamera tidak didukung di browser ini', 'err'); return; }
  const wrap = document.createElement('div');
  wrap.className = 'camera';
  wrap.innerHTML = `<video playsinline muted></video><div class="frame"></div>
    <div class="cam-top"><span>${esc(title)}</span><button class="btn btn-sm" data-close>Tutup</button></div>
    <div class="cam-bar"><div class="cam-last" aria-live="polite"></div>
      <div class="row"><button class="btn grow" data-torch style="display:none">Senter</button><button class="btn btn-primary grow" data-close>Selesai</button></div></div>`;
  document.body.appendChild(wrap);
  const video = wrap.querySelector('video');
  const last = wrap.querySelector('.cam-last');
  let stream, stopped = false, zxingControls = null, lastCode = '', lastAt = 0;

  const stop = () => {
    stopped = true;
    try { zxingControls && zxingControls.stop(); } catch (_) {}
    stream && stream.getTracks().forEach((t) => t.stop());
    wrap.remove();
  };
  wrap.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', stop));

  const handle = async (code) => {
    const now = Date.now();
    if (code === lastCode && now - lastAt < 1800) return;
    lastCode = code; lastAt = now;
    last.textContent = code;
    await onCode(code);
    if (!continuous) stop();
  };

  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
  } catch (e) {
    stop(); toast('Izin kamera ditolak. Izinkan kamera di pengaturan browser.', 'err'); return;
  }
  video.srcObject = stream;
  await video.play().catch(() => {});

  const track = stream.getVideoTracks()[0];
  const caps = track.getCapabilities ? track.getCapabilities() : {};
  if (caps.torch) {
    const tb = wrap.querySelector('[data-torch]'); tb.style.display = '';
    let on = false;
    tb.addEventListener('click', () => { on = !on; track.applyConstraints({ advanced: [{ torch: on }] }).catch(() => {}); });
  }

  let detector = null;
  if ('BarcodeDetector' in window) {
    try {
      const supported = await window.BarcodeDetector.getSupportedFormats();
      detector = new window.BarcodeDetector({ formats: FORMATS.filter((f) => supported.includes(f)) });
    } catch (_) { detector = null; }
  }

  if (detector) {
    const loop = async () => {
      if (stopped) return;
      try {
        if (video.readyState >= 2) {
          const codes = await detector.detect(video);
          if (codes.length) await handle(codes[0].rawValue);
        }
      } catch (_) {}
      setTimeout(loop, 120);
    };
    loop();
  } else {
    // cadangan untuk iPhone / browser tanpa BarcodeDetector
    try {
      const { BrowserMultiFormatReader } = await import('https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm');
      const reader = new BrowserMultiFormatReader();
      stream.getTracks().forEach((t) => t.stop());
      zxingControls = await reader.decodeFromConstraints({ video: { facingMode: { ideal: 'environment' } } }, video, (res) => {
        if (res && !stopped) handle(res.getText());
      });
    } catch (e) {
      console.error(e);
      toast('Pembaca barcode gagal dimuat. Ketik kodenya atau pakai scanner gun.', 'err');
    }
  }
}
