// Above Ground app. Built by Vite; runs as the website and inside the iOS/Android apps (see platform.js).
import '@fontsource/lora/400.css';
import '@fontsource/lora/500.css';
import '@fontsource/alegreya-sans/400.css';
import '@fontsource/alegreya-sans/500.css';
import '@fontsource/source-sans-3/400.css';
import '@fontsource/source-sans-3/500.css';
import { createClient } from '@supabase/supabase-js';
import { isNative, restoreSaved, mirror, authStorage, syncSystemBars, appReady, onBackButton } from './platform.js';

// In the native apps, bring back saved settings, content and the event queue before anything reads them.
await restoreSaved();

// ---- Config: Supabase project URL and anon (public) key.
// Supabase is the only source of content (exercises, affirmations, completion messages, greetings).
// The app keeps a copy of the last content it loaded so it still works offline; it never ships its own.
const CFG = { url: 'https://ahamlyfqmwfpggntigjy.supabase.co', key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW1seWZxbXdmcGdnbnRpZ2p5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyODQxODYsImV4cCI6MjEwODg2MDE4Nn0.IdcPXm_zto2EDPAWUcsqmoIjTOrIRCsXZ9Oaw4-3tiA' };
const CACHE_KEY = 'content-v2';

// ---- Helpers
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } }, set: (k, v) => { try { const s = JSON.stringify(v); localStorage.setItem(k, s); mirror(k, s) } catch {} } };
const rnd = (a, notId) => { const p = a.length > 1 ? a.filter(x => x.id !== notId) : a; return p[Math.floor(Math.random() * p.length)] };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ICON = {
  back: '<path d="M15 5l-7 7 7 7"/>',
  gear: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5"/>',
  up: '<path d="M7 11v9H4v-9zM7 11l4-7c2 0 2.5 1.5 2 3l-.5 3H19a1 1 0 0 1 1 1.2l-1.2 6A2 2 0 0 1 16.8 20H7"/>'
};
const svg = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;

// ---- Hand-drawn circle: a circle whose radius wobbles a little, so the edge looks drawn by hand
function wobblyCircle(r, wobbles, phase) {
  const pts = [], n = 160;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    let k = 1;
    for (const [freq, amp] of wobbles) k += amp * Math.sin(freq * t + phase * freq);
    pts.push([(Math.cos(t) * r * k).toFixed(2), (Math.sin(t) * r * k).toFixed(2)]);
  }
  return 'M' + pts.map(p => p.join(' ')).join('L') + 'Z';
}
const BLOB = `<div class="blob" aria-hidden="true"><div class="float"><div class="breathe">
  <svg viewBox="-100 -100 200 200">
    <path class="halo" d="${wobblyCircle(94, [[5, .022], [9, .018], [14, .011]], 1.7)}"/>
    <path class="core" d="${wobblyCircle(88, [[7, .026], [11, .018], [17, .01]], 0.4)}"/>
  </svg></div></div></div>`;

// ---- Welcome greetings (rows in the Supabase `greetings` table). Each row's `contexts` says when it fits:
// time of day, weekend, first visit / returning / returned the same day. Context-specific greetings are
// favored by these weights, and the last greeting shown is never repeated.
const GW = { any: 1, earlyMorning: 3, morning: 3, afternoon: 3, evening: 3, lateNight: 5, weekend: 2, firstVisit: 6, returning: 2, returnedToday: 4 };
function pickGreeting(now = new Date()) {
  const h = now.getHours(), day = now.getDay(), last = store.get('lastVisit', 0);
  const tags = new Set(['any', h >= 5 && h < 9 ? 'earlyMorning' : h < 12 && h >= 9 ? 'morning' : h >= 12 && h < 17 ? 'afternoon' : h >= 17 && h < 22 ? 'evening' : 'lateNight']);
  if (day === 0 || day === 6) tags.add('weekend');
  tags.add(!last ? 'firstVisit' : new Date(last).toDateString() === now.toDateString() ? 'returnedToday' : 'returning');
  store.set('lastVisit', now.getTime());
  const prev = store.get('lastGreeting', '');
  let pool = (data?.greetings || []).filter(g => (g.contexts || []).some(t => tags.has(t)))
    .map(g => [g.body, Math.max(...g.contexts.filter(t => tags.has(t)).map(t => GW[t] ?? 1))]);
  if (!pool.length) return '';
  if (pool.length > 1) pool = pool.filter(p => p[0] !== prev);
  let r = Math.random() * pool.reduce((s, p) => s + p[1], 0);
  const text = (pool.find(p => (r -= p[1]) < 0) || pool[0])[0];
  store.set('lastGreeting', text);
  return text;
}
const NEEDS = [['anxiety', "I'm feeling anxious"], ['depression', "I'm feeling depressed"], ['grounding', 'I need some grounding']];

// ---- State
const KEY = { exercise: 'ex', affirmation: 'af', message: 'msg' };
const COLL = { exercise: 'exercises', affirmation: 'affirmations', message: 'messages' };
const S = { screen: 'welcome', cat: null, greeting: '', ex: null, af: null, msg: null, votes: {} };
let data = store.get(CACHE_KEY, null), sb = null, deviceId = null, deviceName = null, tick, ready = Promise.resolve();
let version = store.get('version', null);
const sessionId = crypto.randomUUID();
const cur = () => S[KEY[S.screen]];

// ---- Exercise renderers: each exercise's `kind` picks one; its `body` (jsonb) supplies the process. Add new kinds here.
const R = {
  steps: b => (b.intro ? `<p>${esc(b.intro)}</p>` : '') + `<ol>${(b.steps || []).map(s => `<li>${esc(s)}</li>`).join('')}</ol>`,
  list_input: b => `<p>${esc(b.intro || '')}</p>` + (b.groups || [{ label: b.label, count: b.count, placeholder: b.placeholder }]).map(g =>
    `<h2>${esc(g.label || '')}</h2>` + Array.from({ length: g.count || 3 }, (_, i) =>
    `<input aria-label="${esc(g.label || 'Item')} ${i + 1}" placeholder="${esc(g.placeholder || '')}" autocomplete="off">`).join('')).join(''), // typed text stays on the device
  timer: b => R.steps(b) + `<button class="soft" data-a="timer" data-s="${+b.seconds || 60}">Start ${+b.seconds || 60} seconds</button>`
};
function startTimer(btn) {
  clearInterval(tick);
  let n = +btn.dataset.s;
  const go = () => { btn.textContent = n > 0 ? n + ' seconds left' : 'Time is up. Take one more slow breath.'; if (n-- <= 0) clearInterval(tick) };
  go(); tick = setInterval(go, 1000);
}

// ---- Rendering
function render() {
  clearInterval(tick);
  const k = S.screen, it = cur(), main = $('#main'), foot = $('#foot');
  $('#back').style.visibility = k === 'affirmation' || k === 'exercise' ? 'visible' : 'hidden';
  main.className = k === 'exercise' ? '' : k === 'affirmation' ? 'center has-blob' : 'center';
  if (k === 'welcome' && !data) {
    // No content yet: first launch with no connection. Nothing is shipped in the app, so ask to try again.
    main.innerHTML = `<div class="screen welcome"><p class="msg">I can't reach the exercises right now.</p>
      <p class="lead">Check your connection, then try again.</p><button class="soft" data-a="retry">Try again</button></div>`;
    foot.innerHTML = '';
    return;
  }
  if (k === 'welcome') {
    main.innerHTML = `<div class="screen welcome">${S.greeting ? `<h1>${esc(S.greeting)}</h1>` : ''}<div class="needs">${NEEDS.map(n =>
      `<button class="need" data-a="need" data-c="${n[0]}">${esc(n[1])}</button>`).join('')}</div></div>`;
    foot.innerHTML = '';
    main.scrollTop = 0;
    return;
  }
  const vote = v => S.votes[k + it.id] === v;
  if (k === 'exercise') main.innerHTML = `<div class="screen"><h1>${esc(it.title)}</h1>${(R[it.kind] || R.steps)(it.body || {})}</div>`;
  if (k === 'affirmation') main.innerHTML = `<div class="screen said-on-blob">${BLOB}<div class="said"><p class="lead">Repeat after me:</p><div class="aff">${it.body_html}</div></div></div>`;
  if (k === 'message') main.innerHTML = `<div class="screen"><p class="msg">${esc(it.body)}</p></div>`;
  if (k === 'message') {
    foot.innerHTML = `<button class="cta" data-a="restart">Restart</button>`;
  } else {
    foot.innerHTML = `<div class="tools">
      <button class="tool" data-a="refresh" aria-label="Show a different one">${svg('refresh')}</button>
      <button class="tool" data-a="up" aria-label="Vote up" aria-pressed="${vote(1)}">${svg('up')}</button>
      <button class="tool flip" data-a="down" aria-label="Vote down" aria-pressed="${vote(-1)}">${svg('up')}</button></div>
      <button class="cta" data-a="${k === 'exercise' ? 'next' : 'done'}">${k === 'exercise' ? 'Next' : 'Done'}</button>`;
  }
  main.scrollTop = 0;
}
// ---- Picking. Exercises and affirmations come from the server's device-weighted picker (pick_content),
// which only looks at THIS device's history: favors unseen + up-voted items, disfavors down-voted and
// often-shuffled ones. For exercises it also learns tag taste: once a tag has 2+ net votes, unseen exercises
// sharing up-voted tags are favored and unvoted ones sharing down-voted tags are disfavored (rarer tags count more). Offline / signed-out / slow network falls back to a plain random pick in the category.
const inCat = (list, cat) => { const f = list.filter(x => !cat || !x.category || x.category.includes(cat)); return f.length ? f : list };
const timeout = (ms) => new Promise(r => setTimeout(() => r(null), ms));
async function pick(k, notId) {
  const local = () => rnd(inCat(data[COLL[k]], S.cat), notId);
  if (k === 'message' || !sb || !navigator.onLine) return local();
  try {
    await Promise.race([ready, timeout(2500)]); // let the anonymous device sign-in finish so weighting applies
    await flush();                              // so the shuffle/vote just made counts toward this pick
    const r = await Promise.race([
      sb.rpc('pick_content', { p_content_type: k, p_category: S.cat, p_exclude: UUID.test(notId || '') ? [notId] : [] }),
      timeout(3000)
    ]);
    return r && !r.error && r.data ? r.data : local();
  } catch { return local() }
}
let busy = false;
async function go(k, fresh) {
  if (busy) return;
  if (fresh && k !== 'welcome') {
    busy = true; $('#main').setAttribute('aria-busy', 'true');
    try { S[KEY[k]] = await pick(k, S[KEY[k]]?.id); log('view', S[KEY[k]], k) }
    finally { busy = false; $('#main').removeAttribute('aria-busy') }
  }
  if (k === 'welcome') S.greeting = pickGreeting();
  S.screen = k;
  render();
}
function vote(k, it, v) {
  const key = k + it.id, nv = S.votes[key] === v ? 0 : v;
  S.votes[key] = nv;
  log(nv === 1 ? 'vote_up' : nv === -1 ? 'vote_down' : 'vote_clear', it, k);
  $('[data-a=up]').setAttribute('aria-pressed', nv === 1);
  $('[data-a=down]').setAttribute('aria-pressed', nv === -1);
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  const a = b.dataset.a, k = S.screen, it = cur();
  if (a === 'settings') return openSettings();
  if (a === 'timer') return startTimer(b);
  if (busy) return;
  if (a === 'retry') { b.disabled = true; b.textContent = 'Trying…'; if (sb) loadWithWait().then(() => go('welcome')); else location.reload(); return }
  if (a === 'need') { S.cat = b.dataset.c; S.ex = S.af = null; go('exercise', true) }
  if (a === 'up' || a === 'down') return vote(k, it, a === 'up' ? 1 : -1);
  if (a === 'refresh') { log('refresh', it, k); go(k, true) }
  if (a === 'next') { log('next', it, 'exercise'); go('affirmation', true) }
  if (a === 'back' && k === 'affirmation') { log('back', it, 'affirmation'); go('exercise', false) }
  if (a === 'back' && k === 'exercise') { log('back', it, 'exercise'); go('welcome') }
  if (a === 'done') { log('complete', S.ex, 'exercise'); log('complete', S.af, 'affirmation'); go('message', true) }
  if (a === 'restart') { log('restart', it, 'message'); S.votes = {}; go('welcome') }
});

// ---- Settings: theme (stored as prefs.palette) + font
const P = [['hearth', 'Hearth', '#d8c6b2', '#6f4a33'], ['moss', 'Moss', '#cfd6c8', '#4f6b50'], ['tide', 'Tide', '#cdd8de', '#3f6477'], ['pine', 'Pine', '#1f2a27', '#8fb8a3'], ['dusk', 'Dusk', '#2b2830', '#b9a7c9']];
// [key, label shown in settings, CSS font family]
const F = [['lora', 'Lora', 'Lora'], ['alegreya', 'Alegreya', 'Alegreya Sans'], ['source', 'Source Sans', 'Source Sans 3']];
const prefs = store.get('prefs', { palette: 'hearth', font: 'lora' });
function applyPrefs() {
  const d = document.documentElement;
  if (!P.some(p => p[0] === prefs.palette)) prefs.palette = 'hearth'; // e.g. a saved palette that no longer exists
  d.dataset.palette = prefs.palette; d.dataset.font = prefs.font; store.set('prefs', prefs);
  const bg = getComputedStyle(d).getPropertyValue('--bg').trim();
  $('meta[name=theme-color]').content = bg;
  syncSystemBars(bg);
}
function buildSettings() {
  $('#settings .body').innerHTML = `<h2>Theme</h2><div class="opts">${P.map(p =>
    `<button class="opt" data-p="${p[0]}" aria-pressed="${prefs.palette === p[0]}"><span class="sw" style="background:linear-gradient(135deg,${p[2]} 50%,${p[3]} 50%)"></span>${p[1]}</button>`).join('')}</div>
    <h2>Font</h2><div class="opts">${F.map(f =>
    `<button class="opt text" data-f="${f[0]}" aria-pressed="${prefs.font === f[0]}" style="font-family:'${f[2]}',sans-serif">${f[1]}</button>`).join('')}</div>
    <p class="small">Device: ${deviceId ? (deviceName ? `${esc(deviceName)} (${deviceId.slice(0, 8)})` : deviceId.slice(0, 8)) : 'offline mode'}<br>
    Last Updated: ${version ? `${esc(fmtRelease(version.releasedAt))} (${esc(version.version)})` : 'unknown'}</p>
    <button class="soft" data-close>Close</button>`;
}
// "12:48pm Nov 4, 2026", in the viewer's own time zone
function fmtRelease(iso) {
  const d = new Date(iso); if (isNaN(d)) return 'unknown';
  const t = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(/\s?(AM|PM)$/i, (_, m) => m.toLowerCase());
  return `${t} ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}
function openSettings() { buildSettings(); $('#settings').showModal() }
$('#settings').addEventListener('click', e => {
  const dlg = e.currentTarget, p = e.target.closest('[data-p]'), f = e.target.closest('[data-f]');
  if (e.target === dlg || e.target.closest('[data-close]')) return dlg.close();
  if (p) prefs.palette = p.dataset.p;
  if (f) prefs.font = f.dataset.f;
  if (p || f) { applyPrefs(); buildSettings() }
});

// ---- Analytics: events are queued locally and sent to Supabase when online.
function log(type, item, kind, meta = {}) {
  if (!deviceId || !item || !UUID.test(item.id)) return; // only real Supabase rows (uuid ids) are logged
  const q = store.get('q', []);
  q.push({ device_id: deviceId, session_id: sessionId, content_type: kind, content_id: item.id, event_type: type, meta, created_at: new Date().toISOString() });
  store.set('q', q); flush();
}
let flushing = null;
function flush() {
  if (flushing) return flushing;
  if (!sb || !navigator.onLine) return Promise.resolve();
  const q = store.get('q', []); if (!q.length) return Promise.resolve();
  flushing = (async () => {
    try { const { error } = await sb.from('events').insert(q); if (!error) store.set('q', store.get('q', []).slice(q.length)) } catch {}
    flushing = null;
  })();
  return flushing;
}
addEventListener('online', flush);

// ---- Startup
async function loadContent() {
  // Content is public, so it loads whether or not the device has signed in.
  const [x, a, m, g] = await Promise.all([
    sb.from('exercises').select('id,title,kind,body,category').eq('is_active', true),
    sb.from('affirmations').select('id,body_html,category').eq('is_active', true),
    sb.from('completion_messages').select('id,body').eq('is_active', true),
    sb.from('greetings').select('id,body,contexts').eq('is_active', true)
  ]);
  const err = x.error || a.error || m.error || g.error;
  if (err) throw err;
  if (x.data?.length && a.data?.length && m.data?.length) {
    data = { exercises: x.data, affirmations: a.data, messages: m.data, greetings: g.data || [] };
    store.set(CACHE_KEY, data);
    try { localStorage.removeItem('content'); mirror('content', null) } catch {} // copy saved by the previous app version
  }
}
// First launch waits longer (there is nothing saved to show); later launches show saved content after 4 seconds.
async function loadWithWait() {
  const wait = data ? 4000 : 15000;
  await Promise.race([loadContent().catch(e => console.warn('Content load failed, using saved content', e)), timeout(wait)]);
}
async function registerDevice() {
  let { data: { session } } = await sb.auth.getSession();
  if (!session) {
    const r = await sb.auth.signInAnonymously();
    if (r.error) throw r.error;
    session = r.data.session;
  }
  deviceId = session.user.id;
  const up = await sb.from('devices').upsert({ id: deviceId }, { ignoreDuplicates: true });
  if (up.error) throw up.error;
  // The database assigns each device a permanent name ("Kind Cookie Pony") on first sign-in.
  const me = await sb.from('devices').select('name').eq('id', deviceId).maybeSingle();
  if (me.data?.name) { deviceName = me.data.name; store.set('deviceName', { id: deviceId, name: deviceName }) }
  sb.from('devices').update({ last_seen_at: new Date().toISOString() }).eq('id', deviceId).then(() => {});
  flush();
}
// version.json is written at deploy time by scripts/stamp-version.mjs: { version, releasedAt, commit }
async function loadVersion() {
  try {
    const r = await fetch('version.json', { cache: 'no-store' });
    if (r.ok) { version = await r.json(); store.set('version', version) }
  } catch {}
}
async function init() {
  $('#back').innerHTML = svg('back'); $('#gear').innerHTML = svg('gear');
  applyPrefs();
  loadVersion();
  if (CFG.url) {
    // Web: default storage (localStorage), so existing devices keep their sign-in. Native: Preferences.
    sb = createClient(CFG.url, CFG.key, { auth: { storage: authStorage, detectSessionInUrl: !isNative } });
    await loadWithWait();
    ready = registerDevice().catch(e => console.warn('Device sign-in failed, events will not be recorded', e));
    // Offline: show the name saved for this device last time.
    sb.auth.getSession().then(({ data: { session } }) => {
      const saved = store.get('deviceName', null);
      if (session && !deviceId) deviceId = session.user.id;
      if (!deviceName && saved && saved.id === session?.user.id) deviceName = saved.name;
    }).catch(() => {});
  }
  go('welcome');
  appReady();
}
// Android back button: close Settings, else step back a screen, else leave the app.
onBackButton(() => {
  if ($('#settings').open) { $('#settings').close(); return true }
  if ($('#back').style.visibility === 'visible') { $('#back').click(); return true }
  return false;
});
init();
// The service worker gives the website offline support. The native apps already ship their files inside the app,
// and iOS app web views don't run service workers.
if (!isNative && 'serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
