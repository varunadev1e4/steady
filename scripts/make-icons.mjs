// Generates the PWA icons as PNGs with no dependencies (anti-aliased
// rasterisation + zlib from Node). Run: node scripts/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(out, { recursive: true });

const BG = [250, 247, 242];
const SAGE = [88, 122, 94];
const CLAY = [196, 121, 90];

// The same mark as public/icon.svg, in a 64-unit box.
function bezier(p0, p1, p2, p3, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    pts.push([
      u ** 3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t ** 3 * p3[0],
      u ** 3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t ** 3 * p3[1],
    ]);
  }
  return pts;
}
const curve = [
  ...bezier([14, 40], [20, 30], [26, 30], [32, 40], 120),
  ...bezier([32, 40], [38, 50], [44, 50], [50, 40], 120),
];

function render(size, { inset = 0 } = {}) {
  // inset shrinks the mark for maskable icons (keeps it in the safe zone).
  const scale = (size / 64) * (1 - inset * 2);
  const offset = size * inset;
  const px = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const ux = (x + 0.5 - offset) / scale;
      const uy = (y + 0.5 - offset) / scale;
      let col = BG;
      // circle
      const dc = Math.hypot(ux - 32, uy - 22) - 5;
      // stroke (half width 2.5 units)
      let dl = Infinity;
      for (const [cx, cy] of curve) dl = Math.min(dl, Math.hypot(ux - cx, uy - cy));
      dl -= 2.5;
      const aa = 1 / scale; // one pixel in units
      const mix = (a, b, t) => a.map((v, i) => Math.round(v * (1 - t) + b[i] * t));
      const aStroke = Math.min(1, Math.max(0, 0.5 - dl / aa));
      const aCircle = Math.min(1, Math.max(0, 0.5 - dc / aa));
      col = mix(col, SAGE, aStroke);
      col = mix(col, CLAY, aCircle);
      const i = (y * size + x) * 4;
      px[i] = col[0];
      px[i + 1] = col[1];
      px[i + 2] = col[2];
      px[i + 3] = 255;
    }
  }
  return png(size, size, px);
}

function crc32(buf) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

writeFileSync(join(out, 'icon-192.png'), render(192));
writeFileSync(join(out, 'icon-512.png'), render(512));
writeFileSync(join(out, 'maskable-512.png'), render(512, { inset: 0.12 }));
writeFileSync(join(out, 'apple-touch-icon.png'), render(180));
console.log('Icons written to public/icons');
