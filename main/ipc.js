'use strict';

// The single, explicit bridge between the sandboxed renderer and the main
// process. Every channel the preload exposes is handled here. Keep this list
// small and boring on purpose — it's the app's trust boundary.

const { ipcMain, app } = require('electron');
const store = require('./store');
const chat = require('./chat');

function register(deps) {
  const { getWin, moveBy, setIgnore, showHide, savePosition,
          openSettings, pauseReminders, setLaunchAtLogin, boundsInfo,
          walk, walkStop, snapToEdge, hideFor, popupContext, afterStoreChange, peekaboo } = deps;
  const notifyChange = (key) => { broadcastStore(getWin, key); if (afterStoreChange) afterStoreChange(key); };

  // --- window / mouse ---
  ipcMain.on('mouse:ignore', (_e, ignore) => setIgnore(!!ignore));
  ipcMain.on('win:move-by', (_e, { dx, dy }) => { moveBy(dx, dy); savePosition(); });
  ipcMain.on('win:hide', () => showHide(false));
  ipcMain.on('win:show', () => showHide(true));
  ipcMain.on('win:toggle', () => showHide());
  ipcMain.handle('win:bounds', () => boundsInfo());

  // --- wander / snap / hide / context menu ---
  ipcMain.on('win:walk', (_e, { dx, ms }) => walk(dx, ms));
  ipcMain.on('win:walk-stop', () => walkStop());
  ipcMain.on('win:snap', () => snapToEdge());
  ipcMain.on('win:peekaboo', () => peekaboo());
  ipcMain.on('win:hide-for', (_e, minutes) => hideFor(minutes));
  ipcMain.on('ui:context-menu', () => popupContext());

  // --- persistent store (JSON on disk) ---
  ipcMain.handle('store:getAll', () => store.getAll());
  ipcMain.handle('store:get', (_e, key) => store.get(key));
  ipcMain.on('store:set', (_e, { key, value }) => {
    store.set(key, value);
    notifyChange(key);
  });
  ipcMain.on('store:patch', (_e, { key, partial }) => {
    store.patch(key, partial);
    notifyChange(key);
  });

  // --- talk to Puff (Claude API; key stays in main) ---
  ipcMain.handle('chat:send', (_e, { messages }) => chat.ask(messages));

  // --- app / features ---
  ipcMain.on('app:quit', () => app.quit());
  ipcMain.on('settings:open', () => openSettings && openSettings());
  ipcMain.on('reminders:pause', (_e, minutes) => pauseReminders && pauseReminders(minutes));
  ipcMain.on('app:launch-at-login', (_e, on) => setLaunchAtLogin && setLaunchAtLogin(!!on));
}

// When one window changes settings/data, let every window know so they stay live.
function broadcastStore(getWin, key) {
  const win = getWin();
  if (win && !win.isDestroyed()) win.webContents.send('store-changed', key);
}

module.exports = { register, broadcastStore };
