'use strict';

const { app, BrowserWindow, screen, Menu, globalShortcut, powerMonitor } = require('electron');
const path = require('path');

const store = require('./store');
const activity = require('./activity');
const ipc = require('./ipc');
const tray = require('./tray');
const windows = require('./windows');

// A canvas comfortably bigger than the largest pet, with headroom above for
// the speech bubble and room for the focus panel. The pet is scaled in CSS,
// so the window itself never needs to resize.
const WIN_W = 300;
const WIN_H = 460;

let win = null;
let trayCtl = null;
let saveTimer = null;

// --- window position: remember it, and clamp back on screen if displays change ---

function defaultPosition() {
  const { workArea } = screen.getPrimaryDisplay();
  return {
    x: workArea.x + workArea.width - WIN_W - 24,
    y: workArea.y + workArea.height - WIN_H,
  };
}

// Is this rectangle visible on *some* display? (Guards against a saved position
// on a monitor that's since been unplugged.)
function isOnScreen(x, y) {
  const MARGIN = 40; // at least this many px must be reachable
  return screen.getAllDisplays().some((d) => {
    const a = d.workArea;
    return x + WIN_W - MARGIN > a.x && x + MARGIN < a.x + a.width &&
           y + WIN_H - MARGIN > a.y && y + MARGIN < a.y + a.height;
  });
}

function startPosition() {
  const saved = store.get('position');
  if (saved && isOnScreen(saved.x, saved.y)) return saved;
  return defaultPosition();
}

function savePosition() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    if (!win || win.isDestroyed()) return;
    const [x, y] = win.getPosition();
    store.set('position', { x, y });
  }, 400);
}

// --- window lifecycle ---

function createWindow() {
  const pos = startPosition();

  win = new BrowserWindow({
    width: WIN_W,
    height: WIN_H,
    x: pos.x,
    y: pos.y,
    transparent: true,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    fullscreenable: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  reassertTop();
  win.setIgnoreMouseEvents(true, { forward: true }); // click-through until the page says otherwise
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  // Opt-in diagnostics: surface renderer console + crashes in the terminal.
  if (process.env.PUFF_DEBUG) {
    win.webContents.on('console-message', (_e, level, message, line, source) => {
      console.log(`[renderer] ${message}  (${source}:${line})`);
    });
    win.webContents.on('preload-error', (_e, p, err) => console.error('[preload-error]', p, err));
    win.webContents.on('render-process-gone', (_e, d) => console.error('[render-gone]', d));
  }

  win.on('moved', savePosition);
  win.on('closed', () => { win = null; });

  activity.start(() => win);
}

// Keep Puff floating above everything — other apps, all Spaces, even full-screen
// windows (Chrome, VS Code, terminal). Re-asserted after sleep / display changes,
// which is when macOS tends to drop the always-on-top level.
function reassertTop() {
  if (!win || win.isDestroyed()) return;
  // Join every Space + be allowed over full-screen apps, THEN raise the level.
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true });
  win.setAlwaysOnTop(true, 'screen-saver');
}

// --- helpers handed to ipc / tray ---

function setIgnore(ignore) {
  if (win && !win.isDestroyed()) win.setIgnoreMouseEvents(ignore, { forward: true });
}

function moveBy(dx, dy) {
  if (!win || win.isDestroyed()) return;
  const [x, y] = win.getPosition();
  win.setPosition(Math.round(x + dx), Math.round(y + dy));
}

function showHide(force) {
  if (!win || win.isDestroyed()) return;
  const show = force === undefined ? !win.isVisible() : force;
  if (show) { win.showInactive(); reassertTop(); }
  else win.hide();
  activity.setHidden(!show);
  windows.setPaused(!show);
  sendCommand(show ? 'shown' : 'hidden');
}

function sendCommand(name, payload) {
  if (win && !win.isDestroyed()) win.webContents.send('command', { name, payload });
}

function boundsInfo() {
  if (!win || win.isDestroyed()) return null;
  const b = win.getBounds();
  const disp = screen.getDisplayMatching(b);
  return { bounds: b, workArea: disp.workArea };
}

// --- wander: tween the window horizontally along the bottom of the work area ---
let walkTimer = null;
function walkStop() { if (walkTimer) { clearInterval(walkTimer); walkTimer = null; } }
function walk(dx, ms) {
  walkStop();
  if (!win || win.isDestroyed()) return;
  const [startX, startY] = win.getPosition();
  const a = screen.getDisplayMatching(win.getBounds()).workArea;
  const minX = a.x, maxX = a.x + a.width - WIN_W;
  const targetX = Math.min(maxX, Math.max(minX, startX + dx));
  const t0 = Date.now();
  const duration = Math.max(200, ms || 1200);
  walkTimer = setInterval(() => {
    if (!win || win.isDestroyed()) return walkStop();
    const t = Math.min(1, (Date.now() - t0) / duration);
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // easeInOutQuad
    win.setPosition(Math.round(startX + (targetX - startX) * e), startY);
    if (t >= 1) { walkStop(); savePosition(); }
  }, 16);
}

// --- edge snap: if dropped near a display edge, sit flush against it ---
function snapToEdge() {
  if (!win || win.isDestroyed()) return;
  const b = win.getBounds();
  const a = screen.getDisplayMatching(b).workArea;
  const TH = 48;
  let x = b.x, y = b.y;
  if (Math.abs(b.x - a.x) < TH) x = a.x;
  else if (Math.abs((b.x + WIN_W) - (a.x + a.width)) < TH) x = a.x + a.width - WIN_W;
  if (Math.abs((b.y + WIN_H) - (a.y + a.height)) < TH) y = a.y + a.height - WIN_H;
  else if (Math.abs(b.y - a.y) < TH) y = a.y;
  if (x !== b.x || y !== b.y) { win.setPosition(x, y); savePosition(); }
}

// --- hide for a while (context menu / "hide for 30 min") ---
let hideTimer = null;
function hideFor(minutes) {
  showHide(false);
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => showHide(true), Math.max(1, minutes) * 60 * 1000);
}

// --- right-click context menu on Puff ---
function popupContext() {
  if (!win || win.isDestroyed()) return;
  const menu = Menu.buildFromTemplate([
    { label: 'Start focus', click: () => { showHide(true); sendCommand('start-focus'); } },
    { label: 'Add task', click: () => { showHide(true); sendCommand('add-task'); } },
    { label: 'Hide for 30 min', click: () => hideFor(30) },
    { type: 'separator' },
    { label: 'Settings…', click: () => openSettings() },
    { label: 'Quit Puff', click: () => app.quit() },
  ]);
  menu.popup({ window: win });
}

function setLaunchAtLogin(on) {
  try {
    app.setLoginItemSettings({ openAtLogin: !!on });
  } catch (e) {
    console.error('[login-item] could not update:', e.message); // e.g. unsigned dev build
  }
  store.patch('settings', { launchAtLogin: !!on });
  if (trayCtl) trayCtl.rebuild();
  sendCommand('settings-changed');
}

let settingsWin = null;
function openSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) { settingsWin.show(); settingsWin.focus(); return; }
  settingsWin = new BrowserWindow({
    width: 440, height: 680, title: 'Puff — Settings',
    resizable: true, minimizable: true, maximizable: false, fullscreenable: false,
    backgroundColor: '#1E1B33',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false,
    },
  });
  settingsWin.setMenuBarVisibility(false);
  if (process.env.PUFF_DEBUG) {
    settingsWin.webContents.on('console-message', (_e, l, m, line, src) =>
      console.log(`[settings] ${m}  (${src}:${line})`));
  }
  settingsWin.loadFile(path.join(__dirname, '..', 'renderer', 'settings.html'));
  settingsWin.on('closed', () => { settingsWin = null; });
}

function pauseReminders(minutes) {
  sendCommand('pause-reminders', { minutes });
}

// Global hotkeys (configurable). Re-registered whenever settings change.
function registerHotkeys() {
  globalShortcut.unregisterAll();
  const hk = (store.getAll().settings && store.getAll().settings.hotkeys) || {};
  const bindings = [
    [hk.togglePanel, 'toggle-panel'],
    [hk.toggleFocus, 'toggle-focus'],
  ];
  for (const [accel, cmd] of bindings) {
    if (!accel) continue;
    try {
      globalShortcut.register(accel, () => { showHide(true); sendCommand(cmd); });
    } catch (e) {
      console.error(`[hotkey] could not register ${accel}:`, e.message);
    }
  }
}

// Called after the renderer/settings changes the store, so hotkeys + tray stay live.
function afterStoreChange(key) {
  if (key !== 'settings') return;
  registerHotkeys();
  windows.refresh();
  if (trayCtl) trayCtl.rebuild();
}

// --- boot ---

app.whenReady().then(() => {
  store.load();

  // Become a menu-bar "accessory" app on macOS: no Dock icon, no app-switcher
  // entry, and — crucially — its window can float over other apps' full-screen
  // Spaces. This is what makes Puff truly always-on-top everywhere.
  if (process.platform === 'darwin' && app.dock) app.dock.hide();

  createWindow();

  ipc.register({
    getWin: () => win,
    moveBy,
    setIgnore,
    showHide,
    savePosition,
    boundsInfo,
    openSettings,
    pauseReminders,
    setLaunchAtLogin,
    walk,
    walkStop,
    snapToEdge,
    hideFor,
    popupContext,
    afterStoreChange,
  });

  registerHotkeys();

  // Active-window watcher (DND + distraction nudges). Only booleans reach the
  // renderer; titles never leave main/windows.js.
  windows.start({
    getSettings: () => store.getAll().settings,
    send: (payload) => { if (win && !win.isDestroyed()) win.webContents.send('watch', payload); },
  });
  powerMonitor.on('suspend', () => windows.setPaused(true));
  powerMonitor.on('lock-screen', () => windows.setPaused(true));
  powerMonitor.on('resume', () => { windows.setPaused(false); reassertTop(); });
  powerMonitor.on('unlock-screen', () => { windows.setPaused(false); reassertTop(); });

  // Displays reconfigured (unplugged monitor, resolution change) can drop the
  // always-on-top level — re-assert it.
  screen.on('display-added', reassertTop);
  screen.on('display-removed', reassertTop);
  screen.on('display-metrics-changed', reassertTop);

  // Safety net: whenever focus moves between windows/apps, make sure Puff is
  // still pinned on top (cheap — a no-op if it already is).
  app.on('browser-window-blur', reassertTop);
  app.on('browser-window-focus', reassertTop);

  trayCtl = tray.build({
    command: (name) => {
      if (name === 'pause-reminders-60') { showHide(true); pauseReminders(60); return; }
      showHide(true);
      sendCommand(name);
    },
    showHide,
    getSettings: () => store.getAll().settings,
    setLaunchAtLogin,
    openSettings,
  });

  app.on('activate', () => { if (!win) createWindow(); }); // macOS dock click
});

// Puff lives in the tray, so closing the window shouldn't quit the app.
app.on('window-all-closed', () => { /* keep running in tray */ });

app.on('before-quit', () => {
  activity.stop();
  windows.stop();
  globalShortcut.unregisterAll();
  store.flushNow();
  if (trayCtl) trayCtl.destroy();
});
