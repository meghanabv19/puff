// The speech bubble. A queue so messages never overwrite each other, plus a
// minimum gap between *unsolicited* lines (reminders, cheers, wandering) so
// Puff never nags. Direct reactions to your input (click, drag, petting) are
// "solicited" and always show right away.

import { S, isQuiet } from './runtime.js';

let el = null;
let showing = false;
const queue = [];
let hideTimer = null;
let lastUnsolicitedAt = 0;

function gapMs() {
  const m = (S.settings && S.settings.messageGapMinutes) || 10;
  return m * 60 * 1000;
}

function pump() {
  if (showing || queue.length === 0) return;
  const item = queue.shift();
  showing = true;
  el.textContent = item.text;
  el.classList.add('show');
  hideTimer = setTimeout(() => {
    el.classList.remove('show');
    // brief beat between messages so they read as separate
    setTimeout(() => { showing = false; pump(); }, 260);
  }, item.ms);
}

// Fill in {name}. Puff speaks lowercase, so the name is lowercased to match.
// The placeholder expands to " name" (leading space) when used, or "" when
// dropped — so lines read naturally either way. Write it snug: "hi{name}!".
function withName(text) {
  if (!text.includes('{name}')) return text;
  const s = S.settings || {};
  const name = (s.name || '').trim().toLowerCase();
  const chance = s.nameChance ?? 0.35;
  const use = name && Math.random() < chance;
  return text.replace(/\{name\}/g, use ? ' ' + name : '');
}

// text, { ms, unsolicited, replace }
export function say(text, opts = {}) {
  if (!el) return;
  text = withName(text);
  const ms = opts.ms || 3500;

  if (opts.unsolicited) {
    if (isQuiet()) return;                          // do-not-disturb
    const now = Date.now();
    if (now - lastUnsolicitedAt < gapMs()) return;  // too soon — stay quiet
    lastUnsolicitedAt = now;
  }

  // A solicited "replace" (e.g. rapid clicks) jumps the current bubble instead
  // of stacking up behind it.
  if (opts.replace && showing) {
    clearTimeout(hideTimer);
    showing = false;
    queue.length = 0;
  }
  queue.push({ text, ms });
  if (queue.length > 3) queue.splice(0, queue.length - 3); // never let it back up
  pump();
}

export function initBubble(element) { el = element; }

// Let focus mode etc. reset the "last nag" clock if needed.
export function resetGap() { lastUnsolicitedAt = 0; }
