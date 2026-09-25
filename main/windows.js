'use strict';

// Watches the frontmost window to power two features:
//   • do-not-disturb  — when a full-screen app is in front
//   • distraction nudges — when the active title matches your distraction list
//
// PRIVACY: window titles are read into a local variable, matched against your
// list right here, and then dropped. They are NEVER stored, written to disk,
// logged, or sent to the renderer. Only two booleans ({ fullscreen, distraction })
// ever leave this module.
//
// The watcher only runs when it's actually needed (DND or distractions enabled)
// and can be paused when the screen sleeps / Puff is hidden, so it costs nothing
// while idle.

const { screen } = require('electron');

let activeWindow = null;   // get-windows is ESM; imported lazily
let libTried = false;
let timer = null;
let paused = false;
let getSettings = () => ({});
let send = () => {};
let lastSig = '';

const POLL_MS = 5000;

async function ensureLib() {
  if (activeWindow || libTried) return activeWindow;
  libTried = true;
  try {
    ({ activeWindow } = await import('get-windows'));
  } catch (e) {
    console.error('[windows] get-windows unavailable:', e.message);
  }
  return activeWindow;
}

function needed() {
  const s = getSettings() || {};
  return !!(s.quietDND || (s.distractions && s.distractions.on));
}

async function poll() {
  const s = getSettings() || {};
  const lib = await ensureLib();
  if (!lib) return;

  // Only ask for the (permission-gated) title when distraction nudges are on;
  // DND just needs the window bounds, which don't require any permission.
  const wantTitle = !!(s.distractions && s.distractions.on);

  let info = null;
  try { info = await lib({ screenRecordingPermission: wantTitle, accessibilityPermission: false }); }
  catch { info = null; }

  let fullscreen = false;
  let distraction = false;

  if (info && info.owner && !/electron|puff/i.test(info.owner.name || '')) {
    const disp = screen.getDisplayNearestPoint({ x: info.bounds.x, y: info.bounds.y });
    const f = disp.bounds; // full display bounds (incl. menu bar), not the work area
    fullscreen = Math.abs(info.bounds.width - f.width) < 4 &&
                 Math.abs(info.bounds.height - f.height) < 4;

    if (wantTitle) {
      // title lives only for the length of this block
      const hay = ((info.title || '') + ' ' + (info.owner.name || '')).toLowerCase();
      const list = (s.distractions.list || []);
      distraction = list.some((w) => {
        const term = String(w || '').trim().toLowerCase();
        return term && hay.includes(term);
      });
    }
  }
  // (title is now out of scope and gone)

  const sig = `${fullscreen}|${distraction}`;
  if (sig !== lastSig) { lastSig = sig; send({ fullscreen, distraction }); }
}

function refresh() {
  const on = needed() && !paused;
  if (on && !timer) {
    timer = setInterval(poll, POLL_MS);
    poll();
  } else if (!on && timer) {
    clearInterval(timer); timer = null;
    lastSig = '';
    send({ fullscreen: false, distraction: false }); // clear any stale DND
  }
}

function start(opts) {
  getSettings = opts.getSettings;
  send = opts.send;
  refresh();
}

function setPaused(v) { paused = !!v; refresh(); }
function stop() { if (timer) { clearInterval(timer); timer = null; } }

module.exports = { start, refresh, setPaused, stop };
