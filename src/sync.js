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

// QR code as an SVG string, drawn in the theme's ink color.
export async function qrSvg(text, color) {
  const QR = (await import('qrcode')).default;
  return QR.toString(text, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: color || '#000', light: '#0000' } });
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
