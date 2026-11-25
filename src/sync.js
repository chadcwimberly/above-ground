// Sync codes: 12 words from the BIP39 English list (128 random bits plus a checksum that catches typos).
// Devices that know the words can join the same profile. Only a SHA-256 hash of the words is sent to the server;
// the words themselves stay on the devices. The QR code holds a link whose words sit after the "#", which
// browsers never send to a server.
import { generateMnemonic, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

export const SITE = 'https://aboveground.app';
export { wordlist };

export const newCode = () => generateMnemonic(wordlist, 128);
// Words typed, pasted or scanned in any form ("1. Apple, 2. ...", "apple-banana-...") -> "apple banana ..."
export const normalize = s => String(s || '').toLowerCase().replace(/\d+[.)]/g, ' ').replace(/[^a-z]+/g, ' ').trim();
export const isValid = words => { try { return validateMnemonic(normalize(words), wordlist) } catch { return false } };
export async function hashCode(words) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalize(words)));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
export const syncLink = words => `${SITE}/sync#${normalize(words).replace(/ /g, '-')}`;
// The words in a scanned or opened sync link (or null).
export function wordsFromLink(text) {
  const m = String(text || '').match(/#([a-z-]+)\s*$/i);
  const w = m ? normalize(m[1]) : normalize(text);
  return isValid(w) ? w : null;
}

// QR code as an SVG string: round dots, with rounded "eyes" in three corners. Always dark on light (drawn on a light
// tile by the page) so every camera can read it, whatever the theme.
export async function qrSvg(text, color = '#2a211b') {
  const QR = (await import('qrcode')).default;
  const { size: n, data } = QR.create(text, { errorCorrectionLevel: 'M' }).modules;
  const q = 2, on = (x, y) => data[y * n + x];
  const eye = (x, y) => (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
  let dots = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++)
    if (on(x, y) && !eye(x, y)) dots += `<circle cx="${x + q + .5}" cy="${y + q + .5}" r=".43"/>`;
  const corner = (x, y) => `<rect x="${x + q + .5}" y="${y + q + .5}" width="6" height="6" rx="2" fill="none" stroke="${color}" stroke-width="1"/>` +
    `<rect x="${x + q + 2}" y="${y + q + 2}" width="3" height="3" rx="1"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n + 2 * q} ${n + 2 * q}" fill="${color}" shape-rendering="geometricPrecision">` +
    dots + corner(0, 0) + corner(n - 7, 0) + corner(0, n - 7) + '</svg>';
}

// Scan a QR code with the camera into `video`. Resolves with the text, or null if stopped.
// Uses the browser's own barcode reader where there is one, else jsQR (loaded only when scanning).
export async function scanQR(video, signal) {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
  video.srcObject = stream; video.setAttribute('playsinline', ''); await video.play();
  const stop = () => stream.getTracks().forEach(t => t.stop());
  signal?.addEventListener('abort', stop);
  const detector = 'BarcodeDetector' in window && (await BarcodeDetector.getSupportedFormats?.())?.includes('qr_code')
    ? new BarcodeDetector({ formats: ['qr_code'] }) : null;
  const jsQR = detector ? null : (await import('jsqr')).default;
  const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d', { willReadFrequently: true });
  try {
    while (!signal?.aborted) {
      await new Promise(r => setTimeout(r, 200));
      if (video.readyState < 2) continue;
      if (detector) {
        const [hit] = await detector.detect(video).catch(() => []);
        if (hit?.rawValue) return hit.rawValue;
      } else {
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        const hit = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
        if (hit?.data) return hit.data;
      }
    }
    return null;
  } finally { stop() }
}
