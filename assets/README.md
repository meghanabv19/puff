# Assets

- `puff.svg` — the canonical character art. The same SVG is inlined in
  `renderer/index.html` (inlining is required so CSS can switch expressions).
  `puff.svg` is the standalone reference copy for editing/swapping.
- `icons/` — generated raster icons. **Do not edit by hand.** They are produced
  from a vector description in `scripts/gen-icons.js`:

  ```bash
  npm run icons
  ```

  - `tray.png` — colored 32px tray icon (Windows/Linux).
  - `trayTemplate.png` — black template 32px (macOS menu bar auto-adapts to
    light/dark).
  - `icon_16…1024.png` — app icon sizes used when packaging (Phase 7).

## Swapping the art

See the main `README.md` → "Swapping the character art". The short version:
keep `id="puff"` and `class="hit"` on the root element, and keep the state
group class names (`eyes-open`, `eyes-shut`, `eyes-happy`, `mouth`, `mouth-o`,
`cheeks`, `arm`, `lamp`) so animations and expression switching keep working.
