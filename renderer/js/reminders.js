// Away-detection + gentle reminders + distraction nudges.
//
// Reminders (each toggleable, each with its own interval):
//   • water   — after ~45 min of *active* time
//   • stretch — after ~60 min of active time
//   • eyes    — 20-20-20 eye break (off by default)
//   • lateNight — wind-down after a configurable hour
// Away: sleep after 3 min idle (never during focus), wake with a greeting.
// Distraction nudge: during a focus session, if the active window matches your
//   distraction list for longer than the threshold, Puff gives a pouty "back to
//   it?" (see main/windows.js — titles never leave main).

import { api, S, pick, maybeRollDay, watch } from './runtime.js';
import { LINES } from './lines.js';
import { say } from './bubble.js';
import { play, react, setBase, getBase } from './pet.js';
import { isFocusRunning } from './timer.js';

let activeSeconds = 0;
const lastAt = { water: 0, stretch: 0, eyes: 0 };
let lastLateNudge = 0;

let distractStart = 0;
let lastDistractNudge = 0;

export function wake() {
  if (getBase() !== 'sleeping') return;
  setBase('idle');
  play('hop');
  say(pick(LINES.wake));
}

function isLateNight() {
  const r = S.settings.reminders?.lateNight;
  if (r && r.on === false) return false;
  const hour = r?.hour ?? 23;
  const h = new Date().getHours();
  return (h >= hour || h < 5);
}

// active-time reminders (water / stretch / eyes)
function fireActiveReminder(key, defMins) {
  const r = S.settings.reminders?.[key];
  if (!r || r.on === false) return;
  const mins = r.minutes || defMins;
  if (activeSeconds - lastAt[key] >= mins * 60) {
    lastAt[key] = activeSeconds;
    say(pick(LINES[key]), { unsolicited: true, ms: 6000 });
  }
}

// distraction check, advanced on the 5s idle tick
function checkDistraction() {
  const on = S.settings.distractions?.on;
  if (!on || !isFocusRunning() || !watch.distraction) { distractStart = 0; return; }

  const now = Date.now();
  if (!distractStart) distractStart = now;
  const thr = (S.settings.distractions.thresholdSeconds || 20) * 1000;
  if (now - distractStart >= thr && now - lastDistractNudge > 60 * 1000) {
    lastDistractNudge = now;
    distractStart = now; // re-arm so it doesn't spam
    react('pouty');
    say(pick(LINES.distract), { ms: 5000 }); // solicited: a nudge should show even in a busy patch
  }
}

export function initReminders() {
  api.onIdle((idle) => {
    maybeRollDay(); // catches midnight crossings

    // --- away -> sleep (never mid-focus, don't stomp wander) ---
    if (idle >= 180 && !isFocusRunning()) {
      if (getBase() === 'idle' || getBase() === 'sleepy') setBase('sleeping');
    } else if (idle < 5) {
      if (getBase() === 'sleeping') wake();
      else if (isLateNight() && (getBase() === 'idle' || getBase() === 'sleepy')) setBase('sleepy');
      else if (getBase() === 'sleepy' && !isLateNight()) setBase('idle');
    }

    // count genuinely-active time for the interval reminders
    if (idle < 60) activeSeconds += 5;

    fireActiveReminder('water', 45);
    fireActiveReminder('stretch', 60);
    fireActiveReminder('eyes', 20);

    // late-night wind-down nudge
    const now = Date.now();
    if (isLateNight() && idle < 60 && now - lastLateNudge > 30 * 60 * 1000) {
      lastLateNudge = now;
      say(pick(LINES.lateNight), { unsolicited: true, ms: 6000 });
    }

    checkDistraction();
  });
}
