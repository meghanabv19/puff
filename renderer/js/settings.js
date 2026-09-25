// Applying settings live in the pet window. The standalone settings *window*
// (its own UI) is built in Phase 5; for now this reads the saved settings and
// reflects the ones that affect the pet window itself (pet size), and re-reads
// them whenever the store changes.

import { api, S } from './runtime.js';
import { say } from './bubble.js';

const SIZE_SCALE = { S: 0.8, M: 1, L: 1.2 };
const OUTFITS = ['party', 'beanie', 'headphones', 'flower', 'bow'];

export function applySettings() {
  const size = (S.settings && S.settings.petSize) || 'M';
  document.documentElement.style.setProperty('--scale', String(SIZE_SCALE[size] || 1));

  // cosmetic outfit
  const stage = document.getElementById('stage');
  if (stage) {
    OUTFITS.forEach((o) => stage.classList.remove('outfit-' + o));
    const outfit = (S.settings && S.settings.outfit) || 'none';
    if (OUTFITS.includes(outfit)) stage.classList.add('outfit-' + outfit);
  }
}

export function initSettings() {
  applySettings();

  // Keep settings in sync if another window (settings window / tray) changes
  // them. We deliberately DON'T reload `data` here — the pet window owns it, and
  // re-reading our own writes could clobber an in-flight edit.
  api.onStoreChanged(async (key) => {
    if (key !== 'settings') return;
    S.settings = await api.store.get('settings');
    applySettings();
  });
}

// Phase 1 stand-in for the Settings menu item / hotkey until Phase 5.
export function openSettingsFallback() {
  say('settings live in the panel for now ♡', { ms: 2600 });
}
