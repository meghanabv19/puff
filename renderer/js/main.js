// Boot + wiring. Loads persisted state, brings up every module, and routes the
// commands that arrive from the tray, global hotkeys and the main process.

import { api, $, pick, loadState, S, onDayChange, watch, dnd } from './runtime.js';
import { LINES } from './lines.js';
import { initBubble, say } from './bubble.js';
import { initPet, setStreakTier, activity, floaters } from './pet.js';
import { initInteractions, setPanelToggle } from './interactions.js';
import { initTimer, toggle as toggleTimer, isRunning, refreshStats } from './timer.js';
import { initTasks, focusInput, render as renderTasks } from './tasks.js';
import { initReminders } from './reminders.js';
import { initSettings, openSettingsFallback } from './settings.js';
import { initChat } from './chat.js';

const body = document.body;

function togglePanel(force) {
  const open = force === undefined ? !body.classList.contains('panel-open') : force;
  body.classList.toggle('panel-open', open);
  if (open) focusInput();
}

function handleCommand({ name, payload }) {
  switch (name) {
    case 'toggle-panel':
      togglePanel();
      break;
    case 'start-focus':
      togglePanel(true);
      if (!isRunning()) toggleTimer();
      break;
    case 'toggle-focus':
      toggleTimer();
      break;
    case 'pause-reminders': {
      const mins = payload?.minutes || 60;
      dnd.pausedUntil = Date.now() + mins * 60 * 1000;
      say(`ok, quiet for ${mins} min ♡`, { ms: 3000 });
      break;
    }
    case 'add-task':
      togglePanel(true);
      break;
    case 'hide-30':
      api.hide();
      break;
    case 'open-settings':
      openSettingsFallback();
      break;
    case 'settings-changed':
      // settings.js re-reads via onStoreChanged
      break;
    default:
      break;
  }
}

async function boot() {
  await loadState();

  initBubble($('#bubble'));
  initPet();
  initSettings();
  initTimer();
  initTasks(togglePanel);
  initInteractions();
  setPanelToggle(togglePanel);
  initReminders();
  initChat();

  // reflect the saved streak accessory on launch
  setStreakTier(S.data.streak || 0);

  // re-render the panel if the day rolls over while we're running
  onDayChange(() => { renderTasks(); refreshStats(); });

  // Pause/resume all animation with the display (main tells us via 'power').
  api.onPower(({ active }) => {
    body.classList.toggle('asleep', !active);
  });

  // Signals from the active-window watcher: DND, distraction, social, and a
  // coarse "what app are you in" context for cute asides.
  let lastSocialAngerAt = 0;
  let lastContext = '';
  api.onWatch(({ fullscreen, distraction, social, context }) => {
    watch.fullscreen = !!fullscreen;
    watch.distraction = !!distraction;
    watch.social = !!social;
    if (context) watch.context = context;

    // social media -> Puff pops onto the screen, angry (with a cooldown)
    const sa = S.settings.socialAnger || {};
    if (social && sa.on !== false) {
      const cd = (sa.cooldownMinutes || 3) * 60 * 1000;
      if (Date.now() - lastSocialAngerAt > cd) {
        lastSocialAngerAt = Date.now();
        api.show();                     // come onto the screen
        activity('angry', 4200);
        floaters(3, ['💢', '✖'], '#E8637A');
        say(pick(LINES.angry), { ms: 4200, replace: true });
      }
    }

    // gentle "i see what you're doing" aside on an app change
    if (context && context !== lastContext) {
      lastContext = context;
      if (S.settings.appReactions !== false) {
        const map = { coding: LINES.watchCoding, browser: LINES.watchBrowser, terminal: LINES.watchTerminal };
        const lines = map[context];
        if (lines && Math.random() < 0.5) say(pick(lines), { unsolicited: true, ms: 4000 });
      }
    }
  });

  api.onCommand(handleCommand);

  // little hello
  setTimeout(() => { say(pick(LINES.greeting)); }, 600);
}

boot();
