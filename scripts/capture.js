'use strict';
// Throwaway visual check: load the real renderer, force each state, and save a
// PNG of Puff so we can eyeball the expressions. Run: node scripts/capture.js
// (uses the electron binary). Not part of the app.

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, '..', 'shots');
fs.mkdirSync(OUT, { recursive: true });

// [filename, JS to run in the page to force a look]
const STATES = [
  ['idle', ""],
  ['focus', "document.querySelector('#stage').classList.remove('idle');document.querySelector('#stage').classList.add('focus')"],
  ['love', "document.querySelector('#stage').classList.add('r-love')"],
  ['surprised', "document.querySelector('#stage').classList.add('r-surprised')"],
  ['wink', "document.querySelector('#stage').classList.add('r-wink')"],
  ['pouty', "document.querySelector('#stage').classList.add('r-pouty')"],
  ['happy', "document.querySelector('#stage').classList.add('happy')"],
  ['sleeping', "document.querySelector('#stage').classList.remove('idle');document.querySelector('#stage').classList.add('sleeping')"],
  ['panel', "document.body.classList.add('panel-open')"],
  ['streak3', "document.querySelector('#stage').classList.add('streak-3')"],
  ['streak7', "document.querySelector('#stage').classList.add('streak-7')"],
  ['streak14', "document.querySelector('#stage').classList.add('streak-14')"],
  ['streak30', "document.querySelector('#stage').classList.add('streak-30')"],
];

async function run() {
  const win = new BrowserWindow({
    width: 300, height: 460, show: true, x: 60, y: 60,
    transparent: true, frame: false, hasShadow: false,
    backgroundColor: '#201b33', // solid bg just for the screenshot, so alpha reads
    webPreferences: { preload: path.join(__dirname, '..', 'preload.js'), sandbox: true },
  });
  await win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  await new Promise((r) => setTimeout(r, 700));

  for (const [name, js] of STATES) {
    // reset then apply
    await win.webContents.executeJavaScript(
      "document.querySelector('#stage').className='hit idle';document.body.className='';"
    );
    if (js) await win.webContents.executeJavaScript(js);
    await new Promise((r) => setTimeout(r, 300));
    const img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(OUT, `${name}.png`), img.toPNG());
    console.log('captured', name);
  }
  app.quit();
}

app.whenReady().then(run);
