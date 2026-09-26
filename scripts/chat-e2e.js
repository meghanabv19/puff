'use strict';
// End-to-end: load the real renderer with the real preload, open the panel,
// type a message into the chat box, and read back what Puff shows. Verifies the
// whole chat path (renderer -> IPC -> main/chat.js -> Ollama -> panel reply).
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const store = require('../main/store');
const chat = require('../main/chat');

ipcMain.handle('chat:send', (_e, { messages }) => chat.ask(messages));
// stub the other channels the preload/renderer may call
['mouse:ignore','win:move-by','win:hide','win:show','win:toggle','win:walk','win:walk-stop',
 'win:snap','win:peekaboo','win:hide-for','ui:context-menu','app:quit','settings:open',
 'reminders:pause','app:launch-at-login','store:set','store:patch'].forEach((c)=>ipcMain.on(c,()=>{}));
ipcMain.handle('win:bounds', () => ({ bounds:{x:0,y:0,width:300,height:460}, workArea:{x:0,y:0,width:1440,height:900} }));
ipcMain.handle('store:getAll', () => store.getAll());
ipcMain.handle('store:get', (_e,k)=>store.get(k));

app.whenReady().then(async () => {
  store.load();
  const win = new BrowserWindow({ width:300, height:460, show:false,
    webPreferences:{ preload: path.join(__dirname,'..','preload.js'), sandbox:true } });
  await win.loadFile(path.join(__dirname,'..','renderer','index.html'));
  await new Promise(r=>setTimeout(r,600));

  const run = (js) => win.webContents.executeJavaScript(js);
  // open panel, type into chat, press Enter
  await run("document.body.classList.add('panel-open')");
  const send = async (msg) => {
    await run(`(()=>{const i=document.getElementById('chatInput');i.value=${JSON.stringify(msg)};i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter'}));})()`);
    // poll the panel reply for up to 20s
    for (let i=0;i<40;i++){
      await new Promise(r=>setTimeout(r,500));
      const txt = await run("(document.getElementById('chatReply')||{}).textContent||''");
      const bub = await run("(document.getElementById('bubble')||{}).textContent||''");
      if (txt && txt !== 'puff is thinking…') return {via:'panel', txt};
      if (bub) return {via:'bubble', txt:bub};
    }
    return {via:'none', txt:'(no reply seen)'};
  };

  console.log('USER: hi puff, i am nervous about my interview');
  console.log('PUFF:', JSON.stringify(await send('hi puff, i am nervous about my interview')));
  console.log('USER: tell me a joke');
  console.log('PUFF:', JSON.stringify(await send('tell me a joke')));
  console.log('USER: ballet');
  console.log('PUFF:', JSON.stringify(await send('ballet')));
  app.quit();
});
