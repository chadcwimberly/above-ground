// Platform layer: the same code runs as the website (Netlify) and inside the iOS/Android apps (Capacitor).
// On the web nothing here changes behavior: storage stays in localStorage and the service worker runs.
// In the native apps, localStorage is only a fast cache: the OS may clear a web view's storage, so every
// saved value is mirrored to Capacitor Preferences (UserDefaults / SharedPreferences) and restored at launch.
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { SplashScreen } from '@capacitor/splash-screen';
import { App } from '@capacitor/app';

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
