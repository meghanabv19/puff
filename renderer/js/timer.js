// Pomodoro focus timer: focus / short break / long break (after N rounds), all
// lengths configurable. Completing a focus session bumps today's count and
// credits the daily streak.

import { $, S, pick, saveData } from './runtime.js';
import { LINES } from './lines.js';
import { say } from './bubble.js';
import { react, setBase, getBase, setStreakTier, notify } from './pet.js';

let mode = 'focus';      // 'focus' | 'short' | 'long'
let left = 0;            // seconds remaining
let running = false;
let tick = null;
let round = 0;           // focus sessions since the last long break

let timeEl, modeEl, startBtn;

const LEN = { focus: 25, short: 5, long: 15 };
const KEY = { focus: 'focus', short: 'shortBreak', long: 'longBreak' };
const minutes = (m) => ((S.settings.timer && S.settings.timer[KEY[m]]) || LEN[m]);
const fullFor = (m) => minutes(m) * 60;
const label = (m) => (m === 'focus' ? 'Focus' : m === 'long' ? 'Long break' : 'Break');
const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export function initTimer() {
  timeEl = $('#time'); modeEl = $('#mode'); startBtn = $('#startBtn');
  left = fullFor(mode);

  startBtn.onclick = toggle;
  $('#resetBtn').onclick = reset;
  $('#skipBtn').onclick = skip;
  $('#quitBtn').onclick = () => { say('bye bye!', { ms: 900 }); setTimeout(() => window.puff && window.puff.quit(), 700); };

  render();
}

export function isRunning() { return running; }
export function isFocusRunning() { return running && mode === 'focus'; }

function render() {
  const full = fullFor(mode);
  timeEl.textContent = fmt(left);
  modeEl.textContent = label(mode);
  startBtn.textContent = running ? 'Pause'
    : (left === full ? (mode === 'focus' ? 'Start focus' : 'Start break') : 'Resume');
  if (running && mode === 'focus') setBase('focus');
  else if (getBase() === 'focus') setBase('idle');
}

export function toggle() {
  running = !running;
  clearInterval(tick);
  if (running) {
    tick = setInterval(step, 1000);
    say(mode === 'focus' ? pick(LINES.focusStart) : pick(LINES.breakStart));
  }
  render();
}

function reset() {
  clearInterval(tick); running = false;
  left = fullFor(mode);
  render();
}

function skip() {
  clearInterval(tick); running = false;
  mode = mode === 'focus' ? 'short' : 'focus';
  left = fullFor(mode);
  render();
}

function step() {
  left--;
  if (left <= 0) return finishRound();
  if (mode === 'focus' && left % 480 === 0) say(pick(LINES.focusCheer), { unsolicited: true, ms: 3000 });
  render();
}

function finishRound() {
  clearInterval(tick); running = false;

  if (mode === 'focus') {
    S.data.sessions = (S.data.sessions || 0) + 1;
    const milestone = creditStreak();
    saveData();
    setStreakTier(S.data.streak || 0);

    react('celebrate');
    say(pick(LINES.focusDone), { ms: 6000 });
    notify('Focus session done', 'Nice work. Time for a break.');

    round += 1;
    const beforeLong = (S.settings.timer && S.settings.timer.roundsBeforeLong) || 4;
    if (round >= beforeLong) { round = 0; mode = 'long'; }
    else mode = 'short';
    left = fullFor(mode);

    if (milestone) setTimeout(() => say(pick(LINES.streak[milestone]), { ms: 6000 }), 1200);
  } else {
    say(pick(LINES.breakDone), { ms: 6000 });
    notify(mode === 'long' ? 'Long break over' : 'Break is over', 'Puff is ready when you are.');
    mode = 'focus'; left = fullFor('focus');
  }
  render();
  refreshStats();
}

// Credit today's streak the first time a focus session completes each day.
// Returns the milestone number (3/7/14/30) if we just hit one, else null.
function creditStreak() {
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  if (S.data.lastSessionDate === today) return null; // already counted today

  S.data.streak = (S.data.lastSessionDate === yesterday) ? (S.data.streak || 0) + 1 : 1;
  S.data.lastSessionDate = today;
  S.data.streakBest = Math.max(S.data.streakBest || 0, S.data.streak);

  return [3, 7, 14, 30].includes(S.data.streak) ? S.data.streak : null;
}

export function refreshStats() {
  const s = S.data.sessions || 0, t = S.data.doneCount || 0, k = S.data.streak || 0;
  const parts = [];
  if (s || t) parts.push(`${s} focus ${s === 1 ? 'session' : 'sessions'}, ${t} ${t === 1 ? 'task' : 'tasks'} done`);
  const base = parts.length ? `Today: ${parts[0]}` : 'No sessions yet today';
  $('#stats').textContent = k >= 1 ? `${base} · 🔥 ${k}-day streak` : base;
}
