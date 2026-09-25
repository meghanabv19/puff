// Boot + wiring. Loads persisted state, brings up every module, and routes the
// commands that arrive from the tray, global hotkeys and the main process.

import { api, $, pick, loadState, S, onDayChange, watch, dnd } from './runtime.js';
import { LINES } from './lines.js';
import { initBubble, say } from './bubble.js';
import { initPet, setStreakTier } from './pet.js';
import { initInteractions, setPanelToggle } from './interactions.js';
import { initTimer, toggle as toggleTimer, isRunning, refreshStats } from './timer.js';
import { initTasks, focusInput, render as renderTasks } from './tasks.js';
import { initReminders } from './reminders.js';
import { initSettings, openSettingsFallback } from './settings.js';

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

  // reflect the saved streak accessory on launch
  setStreakTier(S.data.streak || 0);

  // re-render the panel if the day rolls over while we're running
  onDayChange(() => { renderTasks(); refreshStats(); });

  // Pause/resume all animation with the display (main tells us via 'power').
  api.onPower(({ active }) => {
    body.classList.toggle('asleep', !active);
  });

  // Do-not-disturb + distraction signals from the active-window watcher.
  api.onWatch(({ fullscreen, distraction }) => {
    watch.fullscreen = !!fullscreen;
    watch.distraction = !!distraction;
  });

  api.onCommand(handleCommand);

  // little hello
  setTimeout(() => { say(pick(LINES.greeting)); }, 600);
}

boot();
