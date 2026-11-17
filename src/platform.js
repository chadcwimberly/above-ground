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

export const isNative = Capacitor.isNativePlatform();
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
  if (!isNative) return;
  const parse = url => { try { const u = new URL(url); return { route: u.host || u.pathname.replace(/^\/+/, ''), feeling: u.searchParams.get('feeling') } } catch { return null } };
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
