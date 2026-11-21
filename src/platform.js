// Platform layer: the same code runs as the website (Netlify) and inside the iOS/Android apps (Capacitor).
// On the web nothing here changes behavior: storage stays in localStorage and the service worker runs.
// In the native apps, localStorage is only a fast cache: the OS may clear a web view's storage, so every
// saved value is mirrored to Capacitor Preferences (UserDefaults / SharedPreferences) and restored at launch.
import { Capacitor, SystemBars, SystemBarsStyle, registerPlugin } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { SplashScreen } from '@capacitor/splash-screen';
import { App } from '@capacitor/app';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { LocalNotifications } from '@capacitor/local-notifications';
import { TextZoom } from '@capacitor/text-zoom';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { NativePurchases, PURCHASE_TYPE } from '@capgo/native-purchases';

export const isNative = Capacitor.isNativePlatform();
// Lets the stylesheet treat the website differently (e.g. its maximum height on tall windows).
if (!isNative) document.documentElement.dataset.web = '';
export const platform = Capacitor.getPlatform(); // 'web' | 'ios' | 'android'

// Restore saved values into localStorage before the app reads them (native only).
export async function restoreSaved() {
  if (!isNative) return;
  try {
    const { keys } = await Preferences.keys();
    await Promise.all(keys.map(async key => {
      const { value } = await Preferences.get({ key });
      if (value !== null) localStorage.setItem(key, value);
    }));
  } catch (e) { console.warn('Could not restore saved values', e) }
}
// Mirror one localStorage write (native only). `value` null removes the key.
export function mirror(key, value) {
  if (!isNative) return;
  (value === null ? Preferences.remove({ key }) : Preferences.set({ key, value })).catch(() => {});
}

// Forget everything saved on this device (after "Delete my data").
export async function clearSaved(keep = []) {
  const kept = keep.map(k => [k, localStorage.getItem(k)]);
  try { localStorage.clear() } catch {}
  kept.forEach(([k, v]) => { if (v !== null) localStorage.setItem(k, v) });
  if (isNative) { try { await Preferences.clear(); await Promise.all(kept.filter(([, v]) => v !== null).map(([key, value]) => Preferences.set({ key, value }))) } catch {} }
}

// Save a text file the person asked for ("Download my data"): a download on the web, the share sheet in the apps.
export async function saveFile(name, text, mime = 'application/json') {
  if (!isNative) {
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([text], { type: mime })), download: name });
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    return;
  }
  const { uri } = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
  await Share.share({ title: name, files: [uri] });
}
export const canScan = !!navigator.mediaDevices?.getUserMedia;

// Supabase keeps its sign-in session here. On the web this stays undefined, so supabase-js keeps using
// localStorage under the same key as before and existing devices keep their identity.
export const authStorage = isNative ? {
  getItem: async key => (await Preferences.get({ key })).value,
  setItem: (key, value) => Preferences.set({ key, value }),
  removeItem: key => Preferences.remove({ key })
} : undefined;

// Status and navigation bar icons follow the theme: light icons on dark themes, dark icons on light ones.
// The app draws edge to edge; the page background shows behind the bars.
export function syncSystemBars(bg) {
  if (!isNative) return;
  const hex = (bg || '').replace('#', '');
  if (hex.length !== 6) return;
  const [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const dark = 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.5;
  SystemBars.setStyle({ style: dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => {});
}

// Called once the first screen is drawn. The timer is a safety net so the splash never stays up for good.
export function appReady() {
  if (isNative) SplashScreen.hide().catch(() => {});
}
if (isNative) setTimeout(appReady, 20000);

// Android back button / gesture: close Settings, else go back a screen, else leave the app.
export function onBackButton(handler) {
  if (platform !== 'android') return;
  App.addListener('backButton', () => { if (!handler()) App.minimizeApp() });
}

// The native app is going to the background (also fires visibilitychange in most web views; this is the sure one).
export function onAppPause(handler) {
  if (isNative) App.addListener('pause', handler);
}

// ---- Haptics: a light tap (native), or a short vibration where the browser supports it (Android web).
export const canVibrate = isNative || ('vibrate' in navigator && matchMedia('(pointer:coarse)').matches); // phones only
export function tap(strength = 'light') {
  if (isNative) return Haptics.impact({ style: strength === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light }).catch(() => {});
  try { navigator.vibrate?.(strength === 'medium' ? 25 : 12) } catch {}
}

// ---- Text size: the apps follow the phone's text-size setting (Dynamic Type / font scale).
// The website already follows the browser's own text size and zoom.
export async function followSystemTextSize() {
  if (!isNative) return;
  try { const { value } = await TextZoom.getPreferred(); await TextZoom.set({ value }) } catch {}
}

// ---- Gentle reminders (apps only): one weekly local notification per chosen day. Nothing goes through a server.
// days: 1 = Sunday ... 7 = Saturday. time: 'HH:MM'. Returns false if notifications aren't allowed.
export const canRemind = isNative;
const REMINDER_IDS = [101, 102, 103, 104, 105, 106, 107];
export async function scheduleReminders({ enabled, time, days }, messages, ask = false) {
  if (!isNative) return false;
  try {
    await LocalNotifications.cancel({ notifications: REMINDER_IDS.map(id => ({ id })) });
    if (!enabled || !days?.length) return true;
    let { display } = await LocalNotifications.checkPermissions();
    if (display !== 'granted' && ask) ({ display } = await LocalNotifications.requestPermissions());
    if (display !== 'granted') return false;
    if (!messages?.length) return true; // reminder copy comes from Supabase; scheduled once it has loaded
    const [hour, minute] = (time || '20:00').split(':').map(Number);
    const pool = messages;
    await LocalNotifications.schedule({
      notifications: days.map(d => ({
        id: 100 + d,
        title: 'Above Ground',
        body: pool[Math.floor(Math.random() * pool.length)].body,
        schedule: { on: { weekday: d, hour, minute }, allowWhileIdle: true }
      }))
    });
    return true;
  } catch (e) { console.warn('Could not schedule reminders', e); return false }
}

// ---- Where the person probably is, for choosing a crisis line: region from the language setting, e.g. en-US -> US.
export function guessCountry() {
  for (const tag of [...(navigator.languages || []), navigator.language, Intl.DateTimeFormat().resolvedOptions().locale]) {
    const m = /[-_]([A-Za-z]{2})\b/.exec(tag || '');
    if (m) return m[1].toUpperCase();
  }
  return '';
}

// ---- Deep links: aboveground://start?feeling=anxiety (widgets, Siri Shortcuts, Android shortcuts),
// aboveground://help. The website accepts the same as ?start=anxiety or ?help.
export function onDeepLink(handler) {
  const web = new URLSearchParams(location.search);
  if (web.has('start') || web.has('help')) handler({ route: web.has('help') ? 'help' : 'start', feeling: web.get('start') });
  // A sync link opened in the browser (https://aboveground.app/sync#word-word-...). Take the words out of the address bar.
  if (/\/sync\/?$/.test(location.pathname) && location.hash.length > 1) {
    const words = decodeURIComponent(location.hash.slice(1));
    history.replaceState(null, '', location.pathname.replace(/sync\/?$/, '') + location.search);
    handler({ route: 'sync', words });
  }
  if (!isNative) return;
  // aboveground://start?feeling=…, aboveground://help, aboveground://sync#words, and https://aboveground.app/… links.
  const parse = url => { try {
    const u = new URL(url), web = /^https?:$/.test(u.protocol);
    return { route: (web ? u.pathname : u.host || u.pathname).replace(/^\/+|\/+$/g, ''), feeling: u.searchParams.get('feeling'),
      words: u.hash.length > 1 ? decodeURIComponent(u.hash.slice(1)) : '' };
  } catch { return null } };
  App.getLaunchUrl().then(r => { const l = r?.url && parse(r.url); if (l) handler(l) }).catch(() => {});
  App.addListener('appUrlOpen', e => { const l = parse(e.url); if (l) handler(l) });
}

// ---- Mindful minutes: Apple Health (iOS) and Health Connect (Android 16+), through the app's own Health plugin.
const Health = registerPlugin('Health');
export async function healthAvailable() {
  if (!isNative) return false;
  try { return (await Health.isAvailable()).available } catch { return false }
}
export async function requestHealth() {
  try { return (await Health.requestAuthorization()).granted } catch { return false }
}
export async function logMindful(start, end) {
  if (!isNative || end - start < 10000) return; // ignore very short sessions
  try { await Health.logMindfulSession({ start, end }) } catch (e) { console.warn('Could not save mindful minutes', e) }
}

// ---- Tips: consumable in-app purchases in the apps (App Store / Google Play). Returns the store's products,
// with prices in the person's own currency, or [] when billing isn't available.
export async function tipProducts(ids) {
  if (!isNative || !ids.length) return [];
  try {
    if (!(await NativePurchases.isBillingSupported()).isBillingSupported) return [];
    return (await NativePurchases.getProducts({ productIdentifiers: ids, productType: PURCHASE_TYPE.INAPP })).products || [];
  } catch (e) { console.warn('Tip products unavailable', e); return [] }
}
// Resolves true when paid, false when the person cancelled; throws on other errors.
export async function buyTip(productId) {
  try {
    await NativePurchases.purchaseProduct({ productIdentifier: productId, productType: PURCHASE_TYPE.INAPP, quantity: 1, isConsumable: true });
    return true;
  } catch (e) { if (/cancel/i.test(String(e?.message || e?.code || e))) return false; throw e }
}
