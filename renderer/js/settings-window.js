// The standalone Settings window. Reads the JSON store, binds every control,
// and writes changes straight back — which the main process broadcasts so the
// pet window (and hotkeys / tray / watcher) update live.

const api = window.puff;
const $ = (id) => document.getElementById(id);

let settings = {};

function keyName(e) {
  const k = e.key;
  if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(k)) return null;
  if (k === ' ') return 'Space';
  if (k.length === 1) return k.toUpperCase();
  const map = { ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right' };
  return map[k] || k; // Escape, F1…, etc.
}
const accelToText = (a) => (a || '').replace('CommandOrControl', 'Cmd/Ctrl');

let savedTimer = null;
function flashSaved() {
  const el = $('saved');
  el.classList.add('show');
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => el.classList.remove('show'), 900);
}

let writeTimer = null;
function save() {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    api.store.set('settings', settings);
    flashSaved();
  }, 150);
}

// pull current form values into `settings`
function collect() {
  settings.name = $('s-name').value.trim();
  settings.petSize = $('s-size').value;
  settings.outfit = $('s-outfit').value;
  settings.messageGapMinutes = num($('m-gap'), 10);
  settings.wander = $('w-on').checked;
  settings.wanderIdleSeconds = num($('w-idle'), 45);
  settings.quietDND = $('q-dnd').checked;

  settings.timer = {
    focus: num($('t-focus'), 25), shortBreak: num($('t-short'), 5),
    longBreak: num($('t-long'), 15), roundsBeforeLong: num($('t-rounds'), 4),
  };
  settings.reminders = {
    water:   { on: $('r-water-on').checked,   minutes: num($('r-water-min'), 45) },
    stretch: { on: $('r-stretch-on').checked, minutes: num($('r-stretch-min'), 60) },
    eyes:    { on: $('r-eyes-on').checked,    minutes: num($('r-eyes-min'), 20) },
    lateNight: { on: $('r-late-on').checked,  hour: num($('r-late-hour'), 23) },
  };
  settings.distractions = {
    on: $('d-on').checked,
    thresholdSeconds: num($('d-thr'), 20),
    list: $('d-list').value.split(/[,\n]/).map((s) => s.trim()).filter(Boolean),
  };
  settings.chat = {
    on: $('chat-on').checked,
    apiKey: $('chat-key').value.trim(),
    model: $('chat-model').value,
  };
  // keep socialAnger's list/cooldown; only the toggle is editable here
  settings.socialAnger = Object.assign({}, settings.socialAnger, { on: $('social-on').checked });
  settings.sound = { on: $('sound-on').checked };
  settings.appReactions = $('apreact-on').checked;
  // hotkeys are set directly by the capture handlers; keep whatever's there
  settings.hotkeys = settings.hotkeys || {};
}
const num = (el, d) => { const v = parseInt(el.value, 10); return Number.isFinite(v) ? v : d; };

function onChange() { collect(); save(); }

function fill() {
  const s = settings;
  $('s-name').value = s.name || '';
  $('s-size').value = s.petSize || 'M';
  $('s-outfit').value = s.outfit || 'none';
  $('m-gap').value = s.messageGapMinutes ?? 10;
  $('w-on').checked = s.wander !== false;
  $('w-idle').value = s.wanderIdleSeconds ?? 45;
  $('q-dnd').checked = s.quietDND !== false;
  $('s-login').checked = !!s.launchAtLogin;

  const t = s.timer || {};
  $('t-focus').value = t.focus ?? 25; $('t-short').value = t.shortBreak ?? 5;
  $('t-long').value = t.longBreak ?? 15; $('t-rounds').value = t.roundsBeforeLong ?? 4;

  const r = s.reminders || {};
  $('r-water-on').checked = r.water?.on !== false; $('r-water-min').value = r.water?.minutes ?? 45;
  $('r-stretch-on').checked = r.stretch?.on !== false; $('r-stretch-min').value = r.stretch?.minutes ?? 60;
  $('r-eyes-on').checked = !!r.eyes?.on; $('r-eyes-min').value = r.eyes?.minutes ?? 20;
  $('r-late-on').checked = r.lateNight?.on !== false; $('r-late-hour').value = r.lateNight?.hour ?? 23;

  const d = s.distractions || {};
  $('d-on').checked = !!d.on; $('d-thr').value = d.thresholdSeconds ?? 20;
  $('d-list').value = (d.list || []).join(', ');

  const c = s.chat || {};
  $('chat-on').checked = !!c.on;
  $('chat-key').value = c.apiKey || '';
  $('chat-model').value = c.model || 'claude-opus-4-8';
  $('social-on').checked = !(s.socialAnger && s.socialAnger.on === false);
  $('sound-on').checked = !(s.sound && s.sound.on === false);
  $('apreact-on').checked = s.appReactions !== false;

  $('hk-panel').value = accelToText(s.hotkeys?.togglePanel);
  $('hk-focus').value = accelToText(s.hotkeys?.toggleFocus);
  $('hk-peek').value = accelToText(s.hotkeys?.peekaboo);
}

function bindHotkey(inputId, key) {
  const input = $(inputId);
  input.addEventListener('focus', () => input.classList.add('capturing'));
  input.addEventListener('blur', () => input.classList.remove('capturing'));
  input.addEventListener('keydown', (e) => {
    e.preventDefault();
    const k = keyName(e);
    if (!k) return; // still waiting for a non-modifier key
    const mods = [];
    if (e.metaKey || e.ctrlKey) mods.push('CommandOrControl');
    if (e.shiftKey) mods.push('Shift');
    if (e.altKey) mods.push('Alt');
    const accel = [...mods, k].join('+');
    settings.hotkeys = settings.hotkeys || {};
    settings.hotkeys[key] = accel;
    input.value = accelToText(accel);
    save();
    input.blur();
  });
}

async function boot() {
  const all = await api.store.getAll();
  settings = (all && all.settings) || {};
  fill();

  // wire every input to save on change/input
  document.querySelectorAll('input, select, textarea').forEach((el) => {
    if (el.classList.contains('hk')) return; // handled separately
    const evt = (el.type === 'checkbox' || el.tagName === 'SELECT') ? 'change' : 'input';
    el.addEventListener(evt, onChange);
  });

  // launch-at-login needs the OS-level call as well as persistence
  $('s-login').addEventListener('change', (e) => api.setLaunchAtLogin(e.target.checked));

  bindHotkey('hk-panel', 'togglePanel');
  bindHotkey('hk-focus', 'toggleFocus');
  bindHotkey('hk-peek', 'peekaboo');
}

boot();
