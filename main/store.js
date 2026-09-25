'use strict';

// Tiny JSON-file store living in app.getPath('userData').
// Synchronous reads (cheap, small file), debounced atomic writes.
// Everything the renderer persists goes through here via IPC — never
// localStorage — so the source of truth is one file on disk.

const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const { defaultStore } = require('./defaults');

const FILE = path.join(app.getPath('userData'), 'puff-data.json');
const TMP = FILE + '.tmp';

let state = null;
let writeTimer = null;

// Recursively fill in any keys missing from `obj` using `base`.
// New settings added in later versions get sensible defaults for old users.
function backfill(base, obj) {
  if (Array.isArray(base)) return Array.isArray(obj) ? obj : base.slice();
  if (base && typeof base === 'object') {
    const out = obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {};
    for (const k of Object.keys(base)) out[k] = backfill(base[k], out[k]);
    return out;
  }
  return obj === undefined ? base : obj;
}

function load() {
  const base = defaultStore();
  try {
    const raw = fs.readFileSync(FILE, 'utf8');
    state = backfill(base, JSON.parse(raw));
  } catch {
    state = base; // no file yet, or corrupt -> start fresh
  }
  return state;
}

function ensure() {
  if (!state) load();
  return state;
}

function flush() {
  writeTimer = null;
  try {
    fs.writeFileSync(TMP, JSON.stringify(state, null, 2));
    fs.renameSync(TMP, FILE); // atomic-ish swap so a crash never truncates the file
  } catch (e) {
    console.error('[store] write failed:', e.message);
  }
}

function scheduleWrite() {
  if (writeTimer) return;
  writeTimer = setTimeout(flush, 250);
}

// Public API ----------------------------------------------------------------

function getAll() { return ensure(); }
function get(key) { return ensure()[key]; }

function set(key, value) {
  ensure()[key] = value;
  scheduleWrite();
  return state[key];
}

// Shallow-merge a partial object into a top-level key (e.g. patch('settings', {...})).
function patch(key, partial) {
  const cur = ensure()[key];
  state[key] = (cur && typeof cur === 'object' && !Array.isArray(cur))
    ? Object.assign({}, cur, partial)
    : partial;
  scheduleWrite();
  return state[key];
}

// Write synchronously right now (used on quit so nothing is lost).
function flushNow() {
  if (writeTimer) { clearTimeout(writeTimer); writeTimer = null; }
  if (state) flush();
}

module.exports = { load, getAll, get, set, patch, scheduleWrite, flushNow, FILE };
