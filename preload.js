'use strict';

// The only thing the sandboxed renderer can see of the outside world.
// A small, explicit surface: no ipcRenderer, no node, no fs — just these calls.

const { contextBridge, ipcRenderer } = require('electron');

const on = (channel, cb) => {
  const handler = (_e, payload) => cb(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler); // unsubscribe
};

contextBridge.exposeInMainWorld('puff', {
  // window + mouse
  setIgnore: (ignore) => ipcRenderer.send('mouse:ignore', ignore),
  moveBy: (dx, dy) => ipcRenderer.send('win:move-by', { dx, dy }),
  hide: () => ipcRenderer.send('win:hide'),
  show: () => ipcRenderer.send('win:show'),
  toggle: () => ipcRenderer.send('win:toggle'),
  quit: () => ipcRenderer.send('app:quit'),
  bounds: () => ipcRenderer.invoke('win:bounds'),

  // wander / snap / hide / context menu
  walk: (dx, ms) => ipcRenderer.send('win:walk', { dx, ms }),
  walkStop: () => ipcRenderer.send('win:walk-stop'),
  snap: () => ipcRenderer.send('win:snap'),
  hideFor: (minutes) => ipcRenderer.send('win:hide-for', minutes),
  contextMenu: () => ipcRenderer.send('ui:context-menu'),

  // persistent JSON store (main process owns the file)
  store: {
    getAll: () => ipcRenderer.invoke('store:getAll'),
    get: (key) => ipcRenderer.invoke('store:get', key),
    set: (key, value) => ipcRenderer.send('store:set', { key, value }),
    patch: (key, partial) => ipcRenderer.send('store:patch', { key, partial }),
  },

  // features that live in main
  openSettings: () => ipcRenderer.send('settings:open'),
  pauseReminders: (minutes) => ipcRenderer.send('reminders:pause', minutes),
  setLaunchAtLogin: (on) => ipcRenderer.send('app:launch-at-login', on),

  // events (main -> renderer). Each returns an unsubscribe fn.
  onCursor: (cb) => on('cursor', cb),
  onIdle: (cb) => on('idle', cb),
  onPower: (cb) => on('power', cb),
  onCommand: (cb) => on('command', cb),
  onStoreChanged: (cb) => on('store-changed', cb),
  onWatch: (cb) => on('watch', cb),
});
