// Shared renderer state + the bridge to main. Everything reads settings/data
// from `S` and persists through saveData/saveSettings, which write the JSON
// file in the main process (never localStorage).

// Fallback shim so the page can also be opened in a plain browser for preview.
export const api = window.puff || {
  setIgnore() {}, moveBy() {}, hide() {}, show() {}, toggle() {},
  quit() { window.close(); },
  bounds: async () => null,
  walk() {}, walkStop() {}, snap() {}, hideFor() {}, contextMenu() {},
  store: {
    getAll: async () => JSON.parse(localStorage.getItem('puff') || 'null'),
    get: async (k) => (JSON.parse(localStorage.getItem('puff') || '{}'))[k],
    set(k, v) { const d = JSON.parse(localStorage.getItem('puff') || '{}'); d[k] = v; localStorage.setItem('puff', JSON.stringify(d)); },
    patch(k, p) { const d = JSON.parse(localStorage.getItem('puff') || '{}'); d[k] = Object.assign({}, d[k], p); localStorage.setItem('puff', JSON.stringify(d)); },
  },
  openSettings() {}, pauseReminders() {}, setLaunchAtLogin() {},
  onCursor(cb) { document.addEventListener('mousemove', (e) => cb({ x: e.clientX, y: e.clientY, near: true })); return () => {}; },
  onIdle() { return () => {}; },
  onPower() { return () => {}; },
  onCommand() { return () => {}; },
  onStoreChanged() { return () => {}; },
  onWatch() { return () => {}; },
};

// Live runtime state, filled at boot from the store.
export const S = {
  settings: null,
  data: null,
};

export const $ = (sel) => document.querySelector(sel);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const todayStr = () => new Date().toDateString();

// Do-not-disturb state. Quiet = a full-screen app is in front (when quietDND is
// on) OR you paused reminders from the tray. While quiet, Puff sends no
// unsolicited bubbles and doesn't wander.
export const watch = { fullscreen: false, distraction: false };
export const dnd = { pausedUntil: 0 };
export function isQuiet() {
  const fs = watch.fullscreen && (S.settings ? S.settings.quietDND !== false : true);
  return fs || Date.now() < dnd.pausedUntil;
}

// Roll the day over: drop finished tasks + finished-day counters, keep unfinished
// tasks. Streak bookkeeping happens in timer.js when a session completes.
function rollDay(data) {
  const base = {
    date: todayStr(),
    tasks: (data.tasks || []).filter((t) => !t.done),
    sessions: 0,
    doneCount: 0,
    streak: data.streak || 0,
    streakBest: data.streakBest || 0,
    lastSessionDate: data.lastSessionDate || null,
  };
  return base;
}

export async function loadState() {
  const all = await api.store.getAll();
  S.settings = (all && all.settings) || {};
  let data = (all && all.data) || {};
  if (data.date !== todayStr()) {
    data = rollDay(data);
    api.store.set('data', data);
  }
  S.data = data;
  return S;
}

let dataTimer = null;
export function saveData() {
  // Coalesce rapid changes; main also debounces its disk write.
  if (dataTimer) return;
  dataTimer = setTimeout(() => { dataTimer = null; api.store.set('data', S.data); }, 120);
}
export function saveSettings() { api.store.set('settings', S.settings); }

// Day rollover while the app is left running past midnight: drop finished
// tasks + counters, keep unfinished tasks, preserve the streak.
const dayHandlers = [];
export function onDayChange(fn) { dayHandlers.push(fn); }
export function maybeRollDay() {
  if (S.data && S.data.date !== todayStr()) {
    S.data = rollDay(S.data);
    api.store.set('data', S.data);
    dayHandlers.forEach((fn) => { try { fn(); } catch { /* ignore */ } });
  }
}
