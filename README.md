# Puff, your desk buddy

A little lavender cloud that lives in the corner of your screen, keeps you
company and helps you focus — without ever nagging.

> Puff is an **original** character (a round lavender cloud with a glowing lamp
> antenna, tiny feet, little arms and pink cheeks). Not based on any existing
> mascot.

## Run it

1. Install [Node.js](https://nodejs.org) 18 or newer.
2. In this folder:

   ```bash
   npm install
   npm start
   ```

Puff appears in the bottom-right corner, on top of your other windows, and adds
a tray/menu-bar icon. Closing the pet doesn't quit the app — use the tray's
**Quit Puff** (or the panel's Quit button).

**Linux transparency:** if the window shows a black box instead of being
see-through, start with:

```bash
npm start -- --enable-transparent-visuals --disable-gpu
```

## Building installers

Icons are generated from a vector description (`npm run icons`), then packaged
with [electron-builder](https://electron.build):

```bash
npm run pack        # unpacked app in release/ (quick smoke test)
npm run dist:mac    # .dmg + .zip   (run on macOS)
npm run dist:win    # .exe (NSIS)   (run on Windows)
```

Build on each target OS for best results. macOS builds are unsigned unless you
provide a Developer ID (`export CSC_IDENTITY_AUTODISCOVERY=false` to skip
signing during local testing). App icons live in `build/` (`icon.icns` for mac,
`icon.png` for win/linux).

### Footprint (measured, packaged, idle)

| | |
|---|---|
| Memory (physical footprint, all processes) | **~106 MB** |
| CPU when idle | **~0.5%** (renderer 0.0%; the rest is the 20 Hz cursor poll in main) |

Animations are CSS/SVG (transform/opacity, GPU-composited) and everything pauses
when the display sleeps, the screen locks, or Puff is hidden.

## Controls

- **Hover** — Puff hops and waves; its eyes follow your cursor anywhere on screen.
- **Single click** — a squish, some hearts, an occasional cute line.
- **Double-click** — open/close the focus panel.
- **Drag** — pick Puff up and move it anywhere; it plops down when you let go.
- **Pet** — rub the mouse back and forth over Puff to make it happy.
- **Tray / menu-bar icon** — Show/Hide, Start focus, Pause reminders for 1 hour,
  Settings, Launch at login, Quit.

Puff falls asleep when you step away (never during a focus session) and wakes up
when you're back. **Right-click** Puff for a quick menu (Start focus, Add task,
Hide for 30 min, Settings, Quit).

### Focus, tasks & streaks

- Double-click → the **focus panel**: a Pomodoro timer (focus / short break /
  long break after 4 rounds), today's stats, and a task list you can tick and
  **drag to reorder**.
- During a focus session Puff puts on glasses and types at a little laptop, and
  won't wander or fall asleep.
- Keep at least one focus session a day going to build a **streak** — Puff earns
  a ⭐ (3 days), 🎀 (7), 👑 (14), and a glowing crown (30).
- Global hotkeys: **⌘/Ctrl+Shift+P** (panel), **⌘/Ctrl+Shift+F** (start/pause
  focus) — rebindable in Settings.

### Reminders & quiet time

Puff can remind you to drink water, stretch, take a 20-20-20 eye break, and wind
down late at night — each toggle and interval is in **Settings**. It
automatically goes quiet (no bubbles, no wandering) when a full-screen app is
active, or when you pick "Pause reminders for 1 hour" from the tray.

### Distraction nudges (opt-in, private)

If you turn it on in Settings, during a focus session Puff gently nudges you when
the active window looks like a distraction (YouTube, Reddit, …). **Window titles
are checked in memory only and are never stored, logged, or sent anywhere** — see
`main/windows.js`. On macOS this uses the Screen Recording permission to read the
title; leave it off and nothing is ever inspected.

### Settings

Open Settings from the tray or the right-click menu: name Puff uses for you, pet
size, timer lengths, reminder toggles/intervals, distraction list & threshold,
wandering, do-not-disturb, launch-at-login, hotkeys and chattiness. Changes save
to the JSON store and apply live.

## Project layout

```
main/            Electron main process (Node)
  main.js          window, always-on-top, remembered position, hotkeys, wiring
  ipc.js           the one explicit IPC surface
  store.js         JSON store in app.getPath('userData')
  tray.js          tray/menu-bar icon + menu
  activity.js      cursor + idle polling (pauses on sleep/lock/hide)
  windows.js       active-window watcher for DND + distractions (titles never leave here)
  defaults.js      default settings + saved-data shape
preload.js       exposes a small window.puff API to the renderer
renderer/        the UI (plain HTML/CSS/vanilla JS, ES modules)
  index.html       the pet + panel; the character is inline SVG
  settings.html    the settings window
  styles/          base / pet / panel / settings CSS
  js/              runtime, pet (state machine), interactions, timer, tasks,
                   bubble, reminders, settings, settings-window, lines, main
assets/          character SVG + generated icons
build/           packaging icons (icon.icns / icon.png)
scripts/         gen-icons.js (icons), capture.js (dev: screenshot pet states)
```

### Security model

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- The renderer talks to the OS only through the small, explicit API in
  `preload.js`; every channel is handled in `main/ipc.js`.
- Strict Content-Security-Policy (`default-src 'none'`, only our own scripts).
- All data is stored in a JSON file in `app.getPath('userData')`, written by the
  main process — never `localStorage`.

## Editing what Puff says

Every line lives in `renderer/js/lines.js`, grouped by situation. A `{name}`
placeholder is occasionally filled with your name (set it in the store /
settings; defaults to "Meghana").

## Swapping the character art

The character is the `<svg id="puff">` block in `renderer/index.html` (kept as a
standalone copy in `assets/puff.svg`). To use your own art:

1. Replace the SVG contents, **or** drop in an `<img>` of a PNG/GIF/sprite sheet
   you have the rights to use.
2. Keep `id="puff"` and `class="hit"` on the root element so dragging and
   clicking still work.
3. Keep the expression group class names so animations and state-switching keep
   working: `eyes-open`, `eyes-shut`, `eyes-happy`, `mouth`, `mouth-o`,
   `cheeks`, `arm`, `lamp` (and `breathe` on the group that should breathe).

For a sprite sheet / PNG frames, give each frame those class names (e.g. show
the `eyes-shut` frame when `#stage` has the matching state class) — the CSS in
`renderer/styles/pet.css` shows the pattern.

## Regenerating icons

The tray and app icons are generated from a vector description — no image files
checked in by hand:

```bash
npm run icons
```

## Tweaks

- Most things are in **Settings** (tray → Settings). The raw store is at
  `app.getPath('userData')/puff-data.json` if you want to hand-edit.
- Things Puff says live in `renderer/js/lines.js`.
- Set `PUFF_DEBUG=1 npm start` to print renderer/settings console output and
  crashes in the terminal.
