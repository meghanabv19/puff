'use strict';

// Generates Puff's raster icons (tray + app) from a vector description, with no
// image dependencies — just a tiny hand-rolled PNG encoder. Run:  npm run icons
//
// Output:
//   assets/icons/tray.png            colored 32px (Windows/Linux menu)
//   assets/icons/trayTemplate.png    black template 32px (macOS menu bar)
//   assets/icons/icon_<n>.png        app icon at several sizes (Phase 7 packaging)

const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'assets', 'icons');
fs.mkdirSync(OUT, { recursive: true });

// --- geometry helpers (normalized 0..1 space) ---
const circle = (x, y, cx, cy, r) => Math.hypot(x - cx, y - cy) <= r;
const ellipse = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
function segDist(x, y, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

// Puff's body (fluffy union of circles + a base ellipse).
function bodyHit(x, y) {
  return circle(x, y, 0.50, 0.46, 0.26) ||
         circle(x, y, 0.31, 0.60, 0.20) ||
         circle(x, y, 0.69, 0.60, 0.20) ||
         ellipse(x, y, 0.50, 0.66, 0.34, 0.22);
}
const lampHit = (x, y) => circle(x, y, 0.63, 0.19, 0.058);
const antennaHit = (x, y) => segDist(x, y, 0.52, 0.34, 0.61, 0.22) < 0.014;

// Layered shapes, bottom to top, for the colored icon.
const LAYERS = [
  { hit: bodyHit, col: [238, 233, 255], a: 1 },
  { hit: (x, y) => ellipse(x, y, 0.50, 0.76, 0.30, 0.09) && bodyHit(x, y), col: [217, 209, 250], a: 1 },
  { hit: (x, y) => ellipse(x, y, 0.32, 0.70, 0.065, 0.038), col: [255, 179, 199], a: 1 },
  { hit: (x, y) => ellipse(x, y, 0.68, 0.70, 0.065, 0.038), col: [255, 179, 199], a: 1 },
  { hit: (x, y) => circle(x, y, 0.63, 0.19, 0.095), col: [255, 236, 170], a: 0.22 }, // lamp glow
  { hit: antennaHit, col: [183, 172, 232], a: 1 },
  { hit: lampHit, col: [255, 229, 138], a: 1 },
  { hit: (x, y) => circle(x, y, 0.42, 0.60, 0.05), col: [43, 37, 64], a: 1 },        // eyes
  { hit: (x, y) => circle(x, y, 0.58, 0.60, 0.05), col: [43, 37, 64], a: 1 },
  { hit: (x, y) => circle(x, y, 0.435, 0.585, 0.017), col: [255, 255, 255], a: 1 },  // eye shine
  { hit: (x, y) => circle(x, y, 0.595, 0.585, 0.017), col: [255, 255, 255], a: 1 },
];

// composite one pixel by supersampling
function sample(px, py, size, ss, template) {
  let R = 0, G = 0, B = 0, A = 0;
  for (let sy = 0; sy < ss; sy++) {
    for (let sx = 0; sx < ss; sx++) {
      const x = (px + (sx + 0.5) / ss) / size;
      const y = (py + (sy + 0.5) / ss) / size;
      let r = 0, g = 0, b = 0, a = 0;
      if (template) {
        // black silhouette of body+antenna+lamp, eyes punched out
        const on = (bodyHit(x, y) || antennaHit(x, y) || lampHit(x, y)) &&
                   !(circle(x, y, 0.42, 0.60, 0.05) || circle(x, y, 0.58, 0.60, 0.05));
        if (on) { a = 1; }
      } else {
        for (const L of LAYERS) {
          if (!L.hit(x, y)) continue;
          const la = L.a;
          r = L.col[0] * la + r * (1 - la);
          g = L.col[1] * la + g * (1 - la);
          b = L.col[2] * la + b * (1 - la);
          a = la + a * (1 - la);
        }
      }
      R += r; G += g; B += b; A += a;
    }
  }
  const n = ss * ss;
  return [Math.round(R / n), Math.round(G / n), Math.round(B / n), Math.round((A / n) * 255)];
}

function render(size, template = false) {
  const ss = 4;
  const buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = sample(x, y, size, ss, template);
      const i = (y * size + x) * 4;
      buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = a;
    }
  }
  return buf;
}

// --- minimal PNG encoder (RGBA, 8-bit) ---
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return (buf) => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
})();

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(CRC(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

function encodePNG(rgba, size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit, RGBA
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0)),
  ]);
}

function write(name, size, template = false) {
  const png = encodePNG(render(size, template), size);
  fs.writeFileSync(path.join(OUT, name), png);
  console.log(`  ${name}  (${size}px, ${png.length} bytes)`);
}

console.log('Generating Puff icons ->', OUT);
write('tray.png', 32);
write('trayTemplate.png', 32, true);
for (const s of [16, 32, 64, 128, 256, 512, 1024]) write(`icon_${s}.png`, s);
console.log('done.');
