// Above Ground app. Built by Vite; runs as the website and inside the iOS/Android apps (see platform.js).
import '@fontsource/lora/400.css';
import '@fontsource/lora/500.css';
import '@fontsource/alegreya-sans/400.css';
import '@fontsource/alegreya-sans/500.css';
import '@fontsource/source-sans-3/400.css';
import '@fontsource/source-sans-3/500.css';
import { createClient } from '@supabase/supabase-js';
import { isNative, platform, restoreSaved, mirror, authStorage, syncSystemBars, appReady, onBackButton, onAppPause,
  canVibrate, tap, followSystemTextSize, canRemind, scheduleReminders, guessCountry,
  onDeepLink, healthAvailable, requestHealth, logMindful } from './platform.js';

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
  const pacing = S.ex?.body?.pacing;
  if (pacing) startPacer(pacing);
  announce(`Timer started: ${n} seconds.`);
  const go = () => {
    btn.textContent = n > 0 ? n + ' seconds left' : 'Time is up. Take one more slow breath.';
    if (n === 10) announce('10 seconds left.');
    if (n-- <= 0) { clearInterval(tick); stopPacer(); announce('Time is up.'); if (prefs.haptics !== false) tap('medium') }
  };
  go(); tick = setInterval(go, 1000);
}
// Screen-reader announcements that don't move focus (timer start, 10 seconds left, done).
function announce(text) { const el = $('#sr'); el.textContent = ''; setTimeout(() => { el.textContent = text }, 50) }

// ---- Breathing guide: an exercise whose body has `pacing` ({ phases: [{ label, seconds, motion: in|hold|out }] })
// gets a breathing circle that grows on "in", rests on "hold" and shrinks on "out", with a light tap at each phase.
let pacer = null;
function startPacer(pacing) {
  stopPacer();
  const box = $('.pacer'), phases = (pacing.phases || []).filter(p => p.seconds > 0);
  if (!box || !phases.length) return;
  box.hidden = false;
  const circle = box.querySelector('.breath'), label = box.querySelector('.phase');
  let i = 0;
  const step = () => {
    const p = phases[i % phases.length]; i++;
    label.textContent = p.label;
    circle.style.transitionDuration = p.seconds + 's';
    if (p.motion === 'in') circle.dataset.m = 'in';
    if (p.motion === 'out') circle.dataset.m = 'out';
    if (prefs.haptics !== false) tap(p.motion === 'in' ? 'medium' : 'light');
    pacer = setTimeout(step, p.seconds * 1000);
  };
  circle.dataset.m = 'out';
  pacer = setTimeout(step, 50);
  const b = $('[data-a=pace]'); if (b) { b.textContent = 'Stop breathing guide'; b.dataset.on = '1' }
}
function stopPacer() {
  clearTimeout(pacer); pacer = null;
  const box = $('.pacer'); if (box) box.hidden = true;
  const b = $('[data-a=pace]'); if (b) { b.textContent = 'Start breathing guide'; delete b.dataset.on }
}
// Recorded guide (exercises.audio_url), played on request.
function toggleAudio(btn) {
  const a = $('#guide-audio'); if (!a) return;
  if (a.paused) { a.play().catch(() => {}); btn.textContent = 'Pause the recording' }
  else { a.pause(); btn.textContent = 'Listen to the recording' }
  a.onended = () => { btn.textContent = 'Listen to the recording' };
}
// Extras under an exercise: breathing guide, recording, and "Why this works" with its sources.
function extras(it) {
  const b = it.body || {};
  let h = '';
  if (b.pacing?.phases?.length) {
    if (it.kind !== 'timer') h += `<button class="soft" data-a="pace">Start breathing guide</button>`;
    h += `<div class="pacer" hidden aria-hidden="true"><div class="breath"></div><p class="phase"></p></div>`;
  }
  if (it.audio_url) h += `<button class="soft" data-a="audio">Listen to the recording</button><audio id="guide-audio" preload="none" src="${esc(it.audio_url)}"></audio>`;
  if (it.research_summary) {
    const src = (it.sources || []).filter(x => x && x.title);
    h += `<details class="why"><summary>Why this works</summary><p>${esc(it.research_summary)}</p>${src.length ? `<ul class="sources">${src.map(x =>
      `<li>${x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title)}</a>` : esc(x.title)}${x.year ? ` (${esc(x.year)})` : ''}</li>`).join('')}</ul>` : ''}</details>`;
  }
  return h;
}

// ---- Rendering
function render() {
  clearInterval(tick); stopPacer(); $('#guide-audio')?.pause();
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
  if (k === 'exercise') main.innerHTML = `<div class="screen"><h1>${esc(it.title)}</h1>${(R[it.kind] || R.steps)(it.body || {})}${extras(it)}</div>`;
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
  if (a === 'pace') return b.dataset.on ? stopPacer() : startPacer(S.ex?.body?.pacing || {});
  if (a === 'audio') return toggleAudio(b);
  if (a === 'help') return openHelp();
  if (busy) return;
  if (a === 'retry') { b.disabled = true; b.textContent = 'Trying…'; if (sb) loadWithWait().then(() => go('welcome')); else location.reload(); return }
  if (a === 'need') startCategory(b.dataset.c);
  if (a === 'up' || a === 'down') return vote(k, it, a === 'up' ? 1 : -1);
  if (a === 'refresh') { log('refresh', it, k); go(k, true) }
  if (a === 'next') { log('next', it, 'exercise'); go('affirmation', true) }
  if (a === 'back' && k === 'affirmation') { log('back', it, 'affirmation'); go('exercise', false) }
  if (a === 'back' && k === 'exercise') { log('back', it, 'exercise'); go('welcome') }
  if (a === 'done') { log('complete', S.ex, 'exercise'); log('complete', S.af, 'affirmation'); if (prefs.health) logMindful(S.startedAt, Date.now()); go('message', true) }
  if (a === 'restart') { log('restart', it, 'message'); S.votes = {}; go('welcome') }
});

// Start a session in a category (welcome buttons, widgets, shortcuts). Mindful minutes count from here.
function startCategory(cat) {
  if (!NEEDS.some(n => n[0] === cat)) return;
  S.cat = cat; S.ex = S.af = null; S.startedAt = Date.now();
  if ($('#settings').open) $('#settings').close();
  if ($('#help').open) $('#help').close();
  go('exercise', true);
}

// ---- Settings: theme (stored as prefs.palette) + font
const P = [['hearth', 'Hearth', '#d8c6b2', '#6f4a33'], ['moss', 'Moss', '#cfd6c8', '#4f6b50'], ['tide', 'Tide', '#cdd8de', '#3f6477'], ['pine', 'Pine', '#1f2a27', '#8fb8a3'], ['dusk', 'Dusk', '#2b2830', '#b9a7c9']];
// [key, label shown in settings, CSS font family]
const F = [['lora', 'Lora', 'Lora'], ['alegreya', 'Alegreya', 'Alegreya Sans'], ['source', 'Source Sans', 'Source Sans 3']];
const prefs = store.get('prefs', { palette: 'hearth', font: 'lora' });
// Reminders are off until turned on; days 1 = Sunday ... 7 = Saturday.
prefs.reminders ??= { enabled: false, time: '20:00', days: [1, 2, 3, 4, 5, 6, 7] };
function applyPrefs() {
  const d = document.documentElement;
  if (!P.some(p => p[0] === prefs.palette)) prefs.palette = 'hearth'; // e.g. a saved palette that no longer exists
  d.dataset.palette = prefs.palette; d.dataset.font = prefs.font; store.set('prefs', prefs);
  const bg = getComputedStyle(d).getPropertyValue('--bg').trim();
  $('meta[name=theme-color]').content = bg;
  syncSystemBars(bg);
}
const DAYS = [[1, 'S', 'Sunday'], [2, 'M', 'Monday'], [3, 'T', 'Tuesday'], [4, 'W', 'Wednesday'], [5, 'T', 'Thursday'], [6, 'F', 'Friday'], [7, 'S', 'Saturday']];
let health = ''; // 'Apple Health' / 'Health Connect' when this device can save mindful minutes
function buildSettings(note = '') {
  const r = prefs.reminders;
  $('#settings .body').innerHTML = `<h2>Theme</h2><div class="opts">${P.map(p =>
    `<button class="opt" data-p="${p[0]}" aria-pressed="${prefs.palette === p[0]}"><span class="sw" style="background:linear-gradient(135deg,${p[2]} 50%,${p[3]} 50%)"></span>${p[1]}</button>`).join('')}</div>
    <h2>Font</h2><div class="opts">${F.map(f =>
    `<button class="opt text" data-f="${f[0]}" aria-pressed="${prefs.font === f[0]}" style="font-family:'${f[2]}',sans-serif">${f[1]}</button>`).join('')}</div>
    ${canVibrate ? `<h2>Vibration</h2><div class="opts"><button class="opt text" data-t="haptics" aria-pressed="${prefs.haptics !== false}">Gentle taps during breathing guides</button></div>` : ''}
    ${canRemind ? `<h2>Gentle reminders</h2><div class="opts"><button class="opt text" data-t="reminders" aria-pressed="${r.enabled}">${r.enabled ? 'On' : 'Off'}</button></div>
      ${r.enabled ? `<div class="remind"><label>Time <input type="time" id="r-time" value="${esc(r.time)}"></label>
      <div class="days" role="group" aria-label="Days">${DAYS.map(([n, l, full]) =>
        `<button class="opt text day" data-day="${n}" aria-label="${full}" aria-pressed="${r.days.includes(n)}">${l}</button>`).join('')}</div></div>` : ''}
      ${note ? `<p class="small" role="status">${esc(note)}</p>` : ''}` : ''}
    ${health ? `<h2>${health}</h2><div class="opts"><button class="opt text" data-t="health" aria-pressed="${!!prefs.health}">Save mindful minutes</button></div>` : ''}
    <p class="small">Above Ground offers support for everyday moments. It isn't a replacement for professional care.
      <button class="link" data-a="help">Need more help?</button></p>
    <p class="small">Device: ${deviceId ? (deviceName ? `${esc(deviceName)} (${deviceId.slice(0, 8)})` : deviceId.slice(0, 8)) : 'offline mode'}<br>
    Last Updated: ${version ? `${esc(fmtRelease(version.releasedAt))} (${esc(version.version)})` : 'unknown'}</p>
    <button class="soft" data-close>Close</button>`;
}
async function updateReminders(ask) {
  const ok = await scheduleReminders(prefs.reminders, data?.reminders, ask);
  if (!ok && prefs.reminders.enabled) { prefs.reminders.enabled = false; applyPrefs(); return 'Notifications are turned off for Above Ground. You can allow them in your phone\'s settings.' }
  return '';
}
// "12:48pm Nov 4, 2026", in the viewer's own time zone
function fmtRelease(iso) {
  const d = new Date(iso); if (isNaN(d)) return 'unknown';
  const t = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(/\s?(AM|PM)$/i, (_, m) => m.toLowerCase());
  return `${t} ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}
function openSettings() { buildSettings(); $('#settings').showModal() }
$('#settings').addEventListener('click', async e => {
  const dlg = e.currentTarget, p = e.target.closest('[data-p]'), f = e.target.closest('[data-f]'), t = e.target.closest('[data-t]'), day = e.target.closest('[data-day]');
  if (e.target === dlg || e.target.closest('[data-close]')) return dlg.close();
  if (e.target.closest('[data-a=help]')) { dlg.close(); return openHelp() }
  if (p) prefs.palette = p.dataset.p;
  if (f) prefs.font = f.dataset.f;
  if (t?.dataset.t === 'haptics') { prefs.haptics = prefs.haptics === false; if (prefs.haptics) tap() }
  let note = '';
  if (t?.dataset.t === 'health') {
    if (prefs.health) prefs.health = false;
    else { prefs.health = await requestHealth(); if (!prefs.health) note = `Above Ground can't save to ${health} yet. You can allow it in ${health}.` }
  }
  if (t?.dataset.t === 'reminders') { prefs.reminders.enabled = !prefs.reminders.enabled; applyPrefs(); note = await updateReminders(true) }
  if (day) {
    const n = +day.dataset.day, d = prefs.reminders.days;
    prefs.reminders.days = d.includes(n) ? d.filter(x => x !== n) : [...d, n].sort();
    applyPrefs(); note = await updateReminders(false);
  }
  if (p || f || t || day) { applyPrefs(); buildSettings(note) }
});
$('#settings').addEventListener('change', async e => {
  if (e.target.id !== 'r-time' || !e.target.value) return;
  prefs.reminders.time = e.target.value; applyPrefs(); await updateReminders(false);
});

// ---- "Need more help?": the crisis line for the person's country (rows in `crisis_resources`), with a way to
// pick another country. Always reachable from the header and from Settings.
function openHelp() {
  S.helpOpened = true;
  buildHelp();
  $('#help').showModal();
}
function buildHelp() {
  const all = data?.crisis || [];
  const countries = [...new Map(all.filter(c => c.country !== '*').map(c => [c.country, c.country_name])).entries()];
  const code = prefs.country || guessCountry();
  const here = all.filter(c => c.country === code), fallback = all.filter(c => c.country === '*');
  const list = here.length ? here : fallback;
  const emergency = here.find(c => c.emergency)?.emergency;
  const card = c => `<div class="line"><p class="name">${esc(c.name)}</p>${c.description ? `<p>${esc(c.description)}</p>` : ''}<div class="ways">
    ${c.phone ? `<a class="cta" href="tel:${esc(c.phone)}">Call ${esc(fmtPhone(c.phone))}</a>` : ''}
    ${c.sms ? `<a class="soft" href="sms:${esc(c.sms)}${c.sms_body ? `?&body=${encodeURIComponent(c.sms_body)}` : ''}">Text ${esc(fmtPhone(c.sms))}</a>` : ''}
    ${c.url ? `<a class="soft" href="${esc(c.url)}" target="_blank" rel="noopener">${c.phone ? 'Chat or learn more' : 'Find a helpline'}</a>` : ''}</div></div>`;
  $('#help .body').innerHTML = `<h1 class="help-title" tabindex="-1" autofocus>You don't have to handle this alone</h1>
    <p class="lead">Trained people are ready to listen, any time. It's free and confidential.</p>
    ${list.map(card).join('') || '<p>If you are in danger, call your local emergency number.</p>'}
    <p class="small">${emergency ? `If you're in immediate danger, call ${esc(emergency)}.` : 'If you are in immediate danger, call your local emergency number.'}</p>
    ${countries.length ? `<label class="small country">Showing help for
      <select id="help-country">${countries.map(([c, n]) => `<option value="${esc(c)}" ${c === code ? 'selected' : ''}>${esc(n)}</option>`).join('')}
      <option value="*" ${here.length ? '' : 'selected'}>Another country</option></select></label>` : ''}
    <p class="small">Above Ground offers support for everyday moments. It isn't a replacement for professional care.</p>
    <button class="soft" data-close>Close</button>`;
}
// 116123 -> 116 123, 131114 -> 13 11 14; short codes (988) stay as they are.
const fmtPhone = n => n.length === 6 && n.startsWith('13') ? `${n.slice(0, 2)} ${n.slice(2, 4)} ${n.slice(4)}` : n.length === 6 ? `${n.slice(0, 3)} ${n.slice(3)}` : n;
$('#help').addEventListener('click', e => { if (e.target === e.currentTarget || e.target.closest('[data-close]')) e.currentTarget.close() });
$('#help').addEventListener('change', e => { if (e.target.id === 'help-country') { prefs.country = e.target.value; applyPrefs(); buildHelp(); $('#help-country')?.focus() } });

// ---- Analytics: events are queued locally and sent to Supabase when online.
function log(type, item, kind, meta = {}) {
  if (!deviceId || !item || !UUID.test(item.id)) return; // only real Supabase rows (uuid ids) are logged
  const q = store.get('q', []);
  q.push({ device_id: deviceId, session_id: sessionId, content_type: kind, content_id: item.id, event_type: type, meta, created_at: new Date().toISOString() });
  store.set('q', q); flush();
}
let flushing = null;
// Sends every queued event. Events logged while a send is in flight are sent right after it finishes,
// so a session's last events (complete, the completion message) arrive during that session, not next launch.
function flush() {
  if (flushing) return flushing.then(() => store.get('q', []).length ? flush() : undefined);
  if (!sb || !navigator.onLine) return Promise.resolve();
  const q = store.get('q', []); if (!q.length) return Promise.resolve();
  flushing = (async () => {
    let sent = false;
    try { const { error } = await sb.from('events').insert(q); if (!error) { store.set('q', store.get('q', []).slice(q.length)); sent = true } } catch {}
    flushing = null;
    if (sent && store.get('q', []).length) await flush(); // anything logged while this batch was sending
  })();
  return flushing;
}
addEventListener('online', flush);
// Leaving the app or switching away: send what's queued before the OS may suspend us.
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush() });
onAppPause(flush);

// ---- Startup
async function loadContent() {
  // Content is public, so it loads whether or not the device has signed in.
  const [x, a, m, g, c, r] = await Promise.all([
    sb.from('exercises').select('id,title,kind,body,category,research_summary,sources,audio_url').eq('is_active', true),
    sb.from('affirmations').select('id,body_html,category').eq('is_active', true),
    sb.from('completion_messages').select('id,body').eq('is_active', true),
    sb.from('greetings').select('id,body,contexts').eq('is_active', true),
    sb.from('crisis_resources').select('country,country_name,name,description,phone,sms,sms_body,url,emergency,sort').eq('is_active', true).order('sort'),
    sb.from('reminder_messages').select('id,body').eq('is_active', true)
  ]);
  const err = x.error || a.error || m.error || g.error;
  if (err) throw err;
  if (x.data?.length && a.data?.length && m.data?.length) {
    data = { exercises: x.data, affirmations: a.data, messages: m.data, greetings: g.data || [],
      crisis: c.data || data?.crisis || [], reminders: r.data || data?.reminders || [] };
    store.set(CACHE_KEY, data);
    try { localStorage.removeItem('content'); mirror('content', null) } catch {} // copy saved by the previous app version
  }
}
// Offline-first: with content saved from an earlier visit, the app starts at once and refreshes it in the background.
// The very first launch has nothing saved, so it waits (up to 15 seconds) for the content to arrive.
async function loadWithWait() {
  const wait = data ? 0 : 15000;
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
  followSystemTextSize();
  loadVersion();
  if (CFG.url) {
    // Web: default storage (localStorage), so existing devices keep their sign-in. Native: Preferences.
    sb = createClient(CFG.url, CFG.key, { auth: { storage: authStorage, detectSessionInUrl: !isNative } });
    await loadWithWait();
    ready = registerDevice().catch(e => console.warn('Device sign-in failed, events will not be recorded', e));
    // Reschedule reminders each launch so they use the latest messages and rotate which one shows.
    if (prefs.reminders.enabled) setTimeout(() => updateReminders(false), 5000);
    // Offline: show the name saved for this device last time.
    sb.auth.getSession().then(({ data: { session } }) => {
      const saved = store.get('deviceName', null);
      if (session && !deviceId) deviceId = session.user.id;
      if (!deviceName && saved && saved.id === session?.user.id) deviceName = saved.name;
    }).catch(() => {});
  }
  go('welcome');
  appReady();
  started = true;
  if (pendingLink) handleLink(pendingLink);
  healthAvailable().then(ok => { health = ok ? (platform === 'ios' ? 'Apple Health' : 'Health Connect') : '' });
}
// Deep links arrive at launch or while running; act once the first screen is up.
let started = false, pendingLink = null;
function handleLink(l) {
  if (!started) { pendingLink = l; return }
  pendingLink = null;
  if (l.route === 'help') return openHelp();
  if (l.route === 'start') return l.feeling ? startCategory(l.feeling) : go('welcome');
}
onDeepLink(handleLink);
// Android back button: close Settings, else step back a screen, else leave the app.
onBackButton(() => {
  if ($('#help').open) { $('#help').close(); return true }
  if ($('#settings').open) { $('#settings').close(); return true }
  if ($('#back').style.visibility === 'visible') { $('#back').click(); return true }
  return false;
});
init();
// The service worker gives the website offline support. The native apps already ship their files inside the app,
// and iOS app web views don't run service workers.
if (!isNative && 'serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
