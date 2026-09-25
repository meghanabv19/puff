'use strict';

// All the "watch the world" polling lives here so it can be paused as a unit
// when the machine sleeps, the screen locks, or Puff is hidden — that's what
// keeps idle CPU near zero.
//
// Cursor: polled at most every 50 ms. We only *send* an update when the point
// actually moved, and we throttle hard (to FAR_MS) when the cursor is nowhere
// near Puff, since the eyes barely move out there anyway.

const { screen, powerMonitor } = require('electron');

const POLL_MS = 50;      // base cursor poll
const FAR_MS = 200;      // send interval when cursor is far from Puff
const NEAR_PX = 260;     // within this many px of Puff's centre counts as "near"

let getWin = () => null;
let cursorTimer = null;
let idleTimer = null;
let hidden = false;
let asleep = false;      // display sleep / screen lock

let lastSent = { x: null, y: null };
let lastSendAt = 0;

function send(channel, payload) {
  const win = getWin();
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

function pollCursor() {
  const win = getWin();
  if (!win || win.isDestroyed()) return;

  const p = screen.getCursorScreenPoint();
  const b = win.getBounds();

  // How far is the cursor from Puff's centre? Used to pick the send rate.
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  const near = Math.hypot(p.x - cx, p.y - cy) <= NEAR_PX;

  const now = Date.now();
  const minGap = near ? POLL_MS : FAR_MS;
  const moved = p.x !== lastSent.x || p.y !== lastSent.y;

  if (moved && now - lastSendAt >= minGap) {
    lastSent = { x: p.x, y: p.y };
    lastSendAt = now;
    // Coordinates relative to the window so the renderer's eye math is simple.
    send('cursor', { x: p.x - b.x, y: p.y - b.y, near });
  }
}

function pollIdle() {
  send('idle', powerMonitor.getSystemIdleTime());
}

function running() { return !hidden && !asleep; }

function startTimers() {
  if (cursorTimer || !running()) return;
  cursorTimer = setInterval(pollCursor, POLL_MS);
  idleTimer = setInterval(pollIdle, 5000);
  pollIdle();
}

function stopTimers() {
  clearInterval(cursorTimer); cursorTimer = null;
  clearInterval(idleTimer); idleTimer = null;
}

function refresh() {
  if (running()) startTimers();
  else stopTimers();
}

// Public API ----------------------------------------------------------------

function start(winGetter) {
  getWin = winGetter;

  const pause = (why) => { asleep = true; send('power', { state: why, active: false }); refresh(); };
  const wake = (why) => { asleep = false; send('power', { state: why, active: true }); lastSent = { x: null, y: null }; refresh(); };

  powerMonitor.on('suspend', () => pause('suspend'));
  powerMonitor.on('resume', () => wake('resume'));
  powerMonitor.on('lock-screen', () => pause('lock'));
  powerMonitor.on('unlock-screen', () => wake('unlock'));

  startTimers();
}

// Puff hidden -> stop polling entirely (nothing to animate or follow).
function setHidden(v) {
  if (hidden === v) return;
  hidden = v;
  if (!hidden) lastSent = { x: null, y: null };
  refresh();
}

function stop() { stopTimers(); }

module.exports = { start, stop, setHidden };
