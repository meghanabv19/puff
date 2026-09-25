// Puff's visible body + the single state manager that drives it.
//
// Two layers:
//   • BASE MOOD  — exactly one of idle / focus / sleeping / sleepy / wander,
//     a class on #stage. Persistent until changed.
//   • REACTIONS  — short one-shots (hop, squish, love, surprised, wink, pouty,
//     giggle, celebrate…). They are QUEUED and played one at a time so they
//     never fight each other or the base mood.
//
// Input handling lives in interactions.js; this module is "how Puff looks".

import { $, pick } from './runtime.js';

export const els = {};
export const BASES = ['idle', 'focus', 'sleeping', 'sleepy', 'wander'];

let base = 'idle';
let reducedMotion = false;

export function initPet() {
  els.stage = $('#stage');
  els.puff = $('#puff');
  els.eyes = $('#eyes');
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  els.stage.classList.add('idle');
  startBlink();
}

export function isReducedMotion() { return reducedMotion; }

/* ---------------- base mood ---------------- */
export function setBase(name) {
  if (!BASES.includes(name) || base === name) return;
  els.stage.classList.remove(...BASES);
  els.stage.classList.add(name);
  base = name;
}
export function getBase() { return base; }

// face direction while wandering ('left' | 'right')
export function face(dir) {
  els.stage.classList.toggle('face-left', dir === 'left');
}

// Streak accessory/glow: show the highest milestone earned (3/7/14/30).
const STREAK_TIERS = [3, 7, 14, 30];
export function setStreakTier(streak) {
  els.stage.classList.remove('streak-3', 'streak-7', 'streak-14', 'streak-30');
  let cls = '';
  for (const t of STREAK_TIERS) if (streak >= t) cls = 'streak-' + t;
  if (cls) els.stage.classList.add(cls);
}

/* ---------------- reactions (queued one-shots) ---------------- */
// puff:  class added to #puff (a keyframe animation, self-clears on animationend)
// stage: class added to #stage for the duration (switches expression)
// hearts/stars: little floaters
const REACTIONS = {
  hop:       { puff: 'hop', dur: 500 },
  squish:    { puff: 'squish', dur: 450, hearts: 3 },
  plop:      { puff: 'plop', dur: 450 },
  jump:      { puff: 'jump', dur: 800 },
  wink:      { stage: 'r-wink', dur: 700 },
  giggle:    { stage: 'r-giggle', puff: 'shake', dur: 700 },
  love:      { stage: 'r-love', dur: 1700, hearts: 4 },
  surprised: { stage: 'r-surprised', dur: 900 },
  pouty:     { stage: 'r-pouty', dur: 1900 },
  celebrate: { stage: 'r-celebrate', puff: 'jump', dur: 1800, stars: 6 },
};

let reacting = false;
const queue = [];

export function react(name) {
  const r = REACTIONS[name];
  if (!r || reducedMotion) return;
  queue.push(r);
  if (queue.length > 4) queue.splice(0, queue.length - 4); // never back up
  pump();
}
export function isReacting() { return reacting; }

function pump() {
  if (reacting || queue.length === 0) return;
  const r = queue.shift();
  reacting = true;

  if (r.puff) playPuff(r.puff);
  if (r.stage) els.stage.classList.add(r.stage);
  if (r.hearts) sparkle(r.hearts, false);
  if (r.stars) sparkle(r.stars, true);

  setTimeout(() => {
    if (r.stage) els.stage.classList.remove(r.stage);
    reacting = false;
    pump();
  }, r.dur);
}

const PUFF_ANIMS = ['hop', 'squish', 'plop', 'jump', 'shake'];
function playPuff(name) {
  const p = els.puff;
  p.classList.remove(...PUFF_ANIMS);
  void p.getBBox(); // force restart
  p.classList.add(name);
  p.addEventListener('animationend', () => p.classList.remove(name), { once: true });
}

// Back-compat helper used around the app: play('hop') etc.
export function play(name) { react(name); }

/* ---------------- floaters + transient happy ---------------- */
export function sparkle(n = 3, star = false) {
  if (reducedMotion) return;
  const stage = els.stage;
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span');
    s.className = 'float' + (star ? ' star' : '');
    s.textContent = star ? pick(['✦', '✧', '★']) : pick(['♥', '♡', '♥']);
    s.style.left = (30 + Math.random() * 55) + '%';
    s.style.setProperty('--dx', ((Math.random() - 0.5) * 70) + 'px');
    s.style.animationDelay = (i * 90) + 'ms';
    stage.appendChild(s);
    setTimeout(() => s.remove(), 1600 + i * 90);
  }
}

export function beHappy(ms = 1400) {
  els.stage.classList.add('happy');
  setTimeout(() => els.stage.classList.remove('happy'), ms);
}

/* ---------------- blinking ---------------- */
function startBlink() {
  (function loop() {
    setTimeout(() => {
      const sleeping = base === 'sleeping' || base === 'sleepy';
      if (!sleeping && !reacting && !reducedMotion) {
        els.stage.classList.add('blink');
        setTimeout(() => els.stage.classList.remove('blink'), 140);
      }
      loop();
    }, 2500 + Math.random() * 3500);
  })();
}

export function notify(title, body) {
  try { new Notification(title, { body, silent: false }); } catch { /* not permitted */ }
}
