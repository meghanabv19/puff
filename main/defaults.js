'use strict';

// Central place for the shape of everything Puff remembers.
// Settings live here so the main process, the pet window and the settings
// window all agree on defaults. Bump nothing here without thinking about
// migration in store.js (missing keys are back-filled from these defaults).

function defaultSettings() {
  return {
    timer: {
      focus: 25,            // minutes
      shortBreak: 5,
      longBreak: 15,
      roundsBeforeLong: 4,
    },
    reminders: {
      water:     { on: true,  minutes: 45 },   // ~45 min of *active* time
      stretch:   { on: true,  minutes: 60 },
      eyes:      { on: false, minutes: 20 },   // 20-20-20, off by default
      lateNight: { on: true,  hour: 23 },      // wind-down after this hour
    },
    distractions: {
      on: false,
      thresholdSeconds: 20,
      list: ['youtube', 'reddit', 'instagram', 'netflix', ' x ', 'twitter'],
    },
    wander: true,
    wanderIdleSeconds: 45,                      // quiet time before Puff may wander
    petSize: 'M',                              // 'S' | 'M' | 'L'
    launchAtLogin: false,
    hotkeys: {
      togglePanel: 'CommandOrControl+Shift+P',
      toggleFocus: 'CommandOrControl+Shift+F',
    },
    messageGapMinutes: 10,                      // min gap between unsolicited bubbles
    quietDND: true,                            // go quiet on fullscreen apps
    name: 'Meghana',                           // Puff occasionally uses this; editable in settings
    nameChance: 0.35,                          // how often a name-capable line uses it
  };
}

function defaultData() {
  return {
    date: new Date().toDateString(),
    tasks: [],                                 // { id, text, done }
    sessions: 0,                               // focus sessions completed today
    doneCount: 0,                              // tasks ticked off today
    streak: 0,                                 // consecutive days with >=1 focus session
    streakBest: 0,
    lastSessionDate: null,                     // toDateString of last day with a session
  };
}

function defaultStore() {
  return {
    version: 1,
    position: null,                            // { x, y } or null -> bottom-right
    settings: defaultSettings(),
    data: defaultData(),
  };
}

module.exports = { defaultSettings, defaultData, defaultStore };
