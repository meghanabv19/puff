// Pointer handling: click-through, eyes-follow-cursor, hover, petting, the
// click / double-click / drag discrimination, drag edge-snap, the right-click
// menu, and wandering.

import { api, S, pick, isQuiet } from './runtime.js';
import { LINES } from './lines.js';
import { say } from './bubble.js';
import { els, play, react, beHappy, setBase, getBase, face, activity, floaters } from './pet.js';
import { wake } from './reminders.js';
import { isBreakRunning } from './timer.js';

let onPanelToggle = () => {};
export function setPanelToggle(fn) { onPanelToggle = fn; }

let down = false;
let dragging = false;
let cursorNear = false;
let lastInteraction = Date.now();

// Any hands-on moment resets the wander clock and cancels an in-progress walk.
function markInteraction() {
  lastInteraction = Date.now();
  if (getBase() === 'wander') { api.walkStop(); setBase('idle'); play('plop'); }
}

export function initInteractions() {
  const body = document.body;
  const puff = els.puff;

  // --- click-through: only Puff and the panel catch the mouse ---
  document.querySelectorAll('.hit').forEach((el) => {
    el.addEventListener('mouseenter', () => api.setIgnore(false));
    el.addEventListener('mouseleave', () => { if (!down) api.setIgnore(true); });
  });

  // --- eyes follow the global cursor (anywhere on screen) ---
  api.onCursor(({ x, y, near }) => {
    cursorNear = !!near;
    const r = puff.getBoundingClientRect();
    const dx = x - (r.left + r.width / 2);
    const dy = y - (r.top + r.height * 0.6);
    const d = Math.hypot(dx, dy) || 1;
    const m = Math.min(4, d / 30);
    els.eyes.setAttribute('transform', `translate(${(dx / d * m).toFixed(2)} ${(dy / d * m).toFixed(2)})`);
  });

  // --- hover: hop + wave + occasional line ---
  puff.addEventListener('mouseenter', () => {
    markInteraction();
    els.stage.classList.add('hovered');
    if (!dragging) play('hop');
    if (Math.random() < 0.3 && !body.classList.contains('panel-open')) {
      say(pick(LINES.hover), { ms: 2000 });
    }
  });
  puff.addEventListener('mouseleave', () => els.stage.classList.remove('hovered'));

  // --- petting & tickling: rub the mouse back and forth over Puff ---
  // gentle rubbing -> love/purr; fast vigorous wiggling -> ticklish giggles.
  let lastPetX = null, lastDir = 0, flips = 0, petWindow = 0, lastReact = 0;
  puff.addEventListener('mousemove', (e) => {
    if (down) return;
    if (lastPetX !== null) {
      const dir = Math.sign(e.clientX - lastPetX);
      if (dir && dir !== lastDir) { flips++; lastDir = dir; }
    }
    lastPetX = e.clientX;
    const now = Date.now();
    if (now - petWindow > 1200) { petWindow = now; flips = 0; } // count flips per 1.2s
    if (now - lastReact < 2200) return;

    if (flips >= 9) {                       // fast, vigorous -> ticklish
      lastReact = now; flips = 0;
      react('tickle'); beHappy(1400);
      say(pick(LINES.tickle), { ms: 2000, replace: true });
    } else if (flips >= 5) {                // gentle rubbing -> love
      lastReact = now; flips = 0;
      react('love'); beHappy(1800);
      say(pick(LINES.pet), { ms: 2200, replace: true });
    }
  });

  // --- right-click: small context menu (built in main) ---
  puff.addEventListener('contextmenu', (e) => { e.preventDefault(); api.contextMenu(); });

  // --- click / double-click / drag ---
  let lastX = 0, lastY = 0, clickTimer = null;

  puff.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    markInteraction();
    down = true; dragging = false;
    lastX = e.screenX; lastY = e.screenY;
  });

  window.addEventListener('mousemove', (e) => {
    if (!down) return;
    const dx = e.screenX - lastX, dy = e.screenY - lastY;
    if (!dragging && Math.hypot(dx, dy) < 4) return; // movement threshold
    if (!dragging) {
      dragging = true;
      els.stage.classList.add('dragging');
      react('surprised');
      say(pick(LINES.dragStart), { ms: 1500, replace: true });
    }
    api.moveBy(dx, dy);
    lastX = e.screenX; lastY = e.screenY;
  });

  window.addEventListener('mouseup', () => {
    if (!down) return;
    down = false;
    if (dragging) {
      dragging = false;
      els.stage.classList.remove('dragging');
      play('plop');
      api.snap();          // snap to a screen edge if we were dropped near one
      return;
    }
    // Tell a single click apart from a double-click.
    if (clickTimer) {
      clearTimeout(clickTimer); clickTimer = null;
      onPanelToggle();
    } else {
      clickTimer = setTimeout(() => {
        clickTimer = null;
        wake();
        react('squish'); beHappy(900);
        const r = Math.random();
        if (r < 0.18) react('wink');
        else if (r < 0.34) react('giggle');
        else if (r < 0.46) react('roll');
        if (Math.random() < 0.5) say(pick(LINES.click), { ms: 1800, replace: true });
      }, 240);
    }
  });

  startWander();
  startPlay();
}

export function isDragging() { return dragging; }

/* ---------------- ambient playfulness ---------------- */
// Through the day, when you've left Puff alone for a bit, it just... plays:
// a little dance, an occasional coffee, a wink. Never during focus, sleep,
// dragging, or do-not-disturb.
function startPlay() {
  setInterval(maybePlay, 30000);
}

function canPlay() {
  return !isQuiet() &&
    getBase() === 'idle' &&
    !document.body.classList.contains('panel-open') &&
    (Date.now() - lastInteraction) >= 20000;
}

function maybePlay() {
  if (!canPlay()) return;
  const r = Math.random();
  if (r < 0.34) {
    activity('dancing', 4500);
    floaters(5, ['♪', '♫', '✧'], '#B7ACE8');
    if (Math.random() < 0.4) say(pick(LINES.idlePlay), { unsolicited: true, ms: 2600 });
  } else if (r < 0.52) {
    activity('coffee', 5000);
    floaters(3, ['˚', '·', '~'], '#C9A27A');
  } else if (r < 0.68) {
    react('roll');   // playful barrel roll
  } else if (r < 0.8) {
    react('wink');
  }
  // otherwise: do nothing this tick — wandering handles walking on its own
}

/* ---------------- wandering ---------------- */
// Every so often, if you've left Puff alone (and it's not focusing, sleeping, or
// right under your cursor), it waddles a short way along the bottom of the work
// area, then sits.
function startWander() {
  setInterval(maybeWander, 12000);
}

function canWander() {
  // Puff roams much sooner during a break; otherwise waits for real quiet time.
  const idleNeeded = (isBreakRunning() ? 12 : (S.settings.wanderIdleSeconds || 45)) * 1000;
  return S.settings.wander &&
    !isQuiet() &&
    getBase() === 'idle' &&
    !cursorNear &&
    !document.body.classList.contains('panel-open') &&
    (Date.now() - lastInteraction) >= idleNeeded;
}

async function maybeWander() {
  if (!canWander()) return;
  if (Math.random() > 0.5) return; // only sometimes, so it stays a surprise

  const info = await api.bounds();
  if (!info || getBase() !== 'idle') return;
  const { bounds, workArea } = info;

  const dir = Math.random() < 0.5 ? -1 : 1;
  const dist = 60 + Math.random() * 120;
  const minX = workArea.x;
  const maxX = workArea.x + workArea.width - bounds.width;
  const targetX = Math.min(maxX, Math.max(minX, bounds.x + dir * dist));
  const dx = targetX - bounds.x;
  if (Math.abs(dx) < 12) return; // already at the wall

  const ms = Math.min(2600, 700 + Math.abs(dx) * 8);
  face(dx < 0 ? 'left' : 'right');
  setBase('wander');
  api.walk(dx, ms);
  setTimeout(() => {
    if (getBase() === 'wander') { setBase('idle'); face('right'); play('plop'); }
  }, ms + 80);
}
