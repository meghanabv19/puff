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
export const BASES = ['idle', 'focus', 'sleeping', 'sleepy', 'wander',
  'dancing', 'meditating', 'coffee', 'napping', 'angry'];

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

// A temporary base state (dance, coffee, nap, meditate, angry) that reverts to
// idle after `ms` — unless something else changed the state meanwhile.
let activityTimer = null;
export function activity(state, ms, onStart) {
  setBase(state);
  if (onStart) onStart();
  clearTimeout(activityTimer);
  activityTimer = setTimeout(() => { if (base === state) setBase('idle'); }, ms);
}

// Little rising glyphs (music notes, steam, anger marks). Colour is optional.
export function floaters(n, glyphs, color) {
  if (reducedMotion) return;
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span');
    s.className = 'float';
    s.textContent = pick(glyphs);
    if (color) s.style.color = color;
    s.style.left = (28 + Math.random() * 60) + '%';
    s.style.setProperty('--dx', ((Math.random() - 0.5) * 70) + 'px');
    s.style.animationDelay = (i * 110) + 'ms';
    els.stage.appendChild(s);
    setTimeout(() => s.remove(), 1600 + i * 110);
  }
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
  celebrate: { stage: 'r-celebrate celebrating', puff: 'jump', dur: 2200, rainbow: 8 },
  tickle:    { stage: 'r-giggle', puff: 'wiggle', dur: 700, hearts: 3 },
  roll:      { puff: 'roll', dur: 900 },
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

  const stageClasses = r.stage ? r.stage.split(' ') : [];
  if (r.puff) playPuff(r.puff);
  if (stageClasses.length) els.stage.classList.add(...stageClasses);
  if (r.hearts) sparkle(r.hearts, false);
  if (r.stars) sparkle(r.stars, true);
  if (r.rainbow) rainbowSparkle(r.rainbow);

  setTimeout(() => {
    if (stageClasses.length) els.stage.classList.remove(...stageClasses);
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

// multicolored confetti for rainbow celebrations
const RAINBOW = ['#FF5D73', '#FFA24D', '#FFE066', '#7BE495', '#5AC8FA', '#B18CFF'];
function rainbowSparkle(n = 8) {
  if (reducedMotion) return;
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span');
    s.className = 'float';
    s.textContent = pick(['✦', '✧', '★', '♥', '•']);
    s.style.color = RAINBOW[i % RAINBOW.length];
    s.style.left = (18 + Math.random() * 66) + '%';
    s.style.setProperty('--dx', ((Math.random() - 0.5) * 110) + 'px');
    s.style.animationDelay = (i * 70) + 'ms';
    els.stage.appendChild(s);
    setTimeout(() => s.remove(), 1700 + i * 70);
  }
}

/* ---------------- blinking ---------------- */
function startBlink() {
  (function loop() {
    setTimeout(() => {
      const eyesBusy = ['sleeping', 'sleepy', 'napping', 'meditating', 'angry'].includes(base);
      if (!eyesBusy && !reacting && !reducedMotion) {
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
