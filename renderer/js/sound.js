// Tiny synthesized sounds via the Web Audio API — no audio files, no deps.
// Used for the little celebration when you tick a task or finish a focus round.
// Toggle with settings.sound.on.

import { S } from './runtime.js';

let ctx = null;
function audio() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch { ctx = null; }
  }
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function enabled() {
  return !(S.settings && S.settings.sound && S.settings.sound.on === false);
}

// one soft note
function tone(freq, startAt, dur, gain = 0.05, type = 'triangle') {
  const c = audio();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(g); g.connect(c.destination);
  const t = c.currentTime + startAt;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

// cheerful rising arpeggio (C–E–G–C) — the "task done!" jingle (~1s)
export function celebrate() {
  if (!enabled()) return;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.09, 0.22, 0.05));
}

// a slightly grander three-note flourish for finishing a focus session
export function fanfare() {
  if (!enabled()) return;
  [659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.12, 0.32, 0.055));
}

// a single soft blip
export function blip() {
  if (!enabled()) return;
  tone(880, 0, 0.14, 0.04);
}
