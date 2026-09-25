'use strict';

// System-tray icon and menu. Menu items mostly just send a named command to
// the pet window, which owns the actual behaviour; a few (quit, launch-at-
// login) are pure main-process concerns.

const { Tray, Menu, app, nativeImage } = require('electron');
const path = require('path');

let tray = null;

function iconPath() {
  // A small colored icon reads fine in both menu bars; see assets/README.
  const file = process.platform === 'darwin' ? 'trayTemplate.png' : 'tray.png';
  return path.join(__dirname, '..', 'assets', 'icons', file);
}

function build(deps) {
  const { command, showHide, getSettings, setLaunchAtLogin, openSettings } = deps;

  let img = nativeImage.createFromPath(iconPath());
  if (process.platform === 'darwin') img.setTemplateImage(true); // auto light/dark in the menu bar
  tray = new Tray(img);
  tray.setToolTip('Puff');

  const rebuild = () => {
    const s = getSettings();
    const menu = Menu.buildFromTemplate([
      { label: 'Show / Hide', click: () => showHide() },
      { type: 'separator' },
      { label: 'Start focus', click: () => command('start-focus') },
      { label: 'Pause reminders for 1 hour', click: () => command('pause-reminders-60') },
      { type: 'separator' },
      { label: 'Settings…', click: () => openSettings() },
      {
        label: 'Launch at login',
        type: 'checkbox',
        checked: !!(s && s.launchAtLogin),
        click: (item) => setLaunchAtLogin(item.checked),
      },
      { type: 'separator' },
      { label: 'Quit Puff', click: () => app.quit() },
    ]);
    tray.setContextMenu(menu);
  };

  rebuild();
  tray.on('click', () => showHide());     // single click toggles on Windows/Linux
  tray.on('double-click', () => showHide());

  return { rebuild, destroy: () => { if (tray) { tray.destroy(); tray = null; } } };
}

module.exports = { build };
