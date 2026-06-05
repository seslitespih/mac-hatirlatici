/**
 * generate-assets.js
 *
 * Generates all required Expo app icons and splash screens as PNG files.
 * Uses only Node.js built-ins (no sharp/canvas dependency) by writing
 * minimal valid PNG files with correct dimensions via raw Buffer manipulation.
 *
 * Run:  node scripts/generate-assets.js
 *
 * Output files:
 *   assets/icon.png           1024×1024   App icon
 *   assets/adaptive-icon.png  1024×1024   Android adaptive icon foreground
 *   assets/splash.png         1284×2778   Splash screen (iPhone 14 Pro Max res)
 *   assets/favicon.png         196×196    Web favicon
 *   assets/notification-icon.png  96×96   Android notification icon (white on transparent)
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ─── Minimal PNG encoder ─────────────────────────────────────────────────────

function encodePNG(width, height, pixelFn) {
  // pixelFn(x, y) → [r, g, b, a]
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function chunk(type, data) {
    const typeBuf = Buffer.from(type, 'ascii');
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    let crc = 0xffffffff;
    for (const b of [...typeBuf, ...data]) {
      crc ^= b;
      for (let i = 0; i < 8; i++) {
        crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
      }
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type: RGB  — use 6 for RGBA
  ihdr[9] = 6;  // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // Raw pixel data (filter byte 0 per row)
  const rowSize = width * 4 + 1;
  const raw = Buffer.alloc(height * rowSize);
  for (let y = 0; y < height; y++) {
    raw[y * rowSize] = 0; // filter = None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFn(x, y);
      const off = y * rowSize + 1 + x * 4;
      raw[off] = r; raw[off + 1] = g; raw[off + 2] = b; raw[off + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(raw, { level: 6 });

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ─── Color helpers ───────────────────────────────────────────────────────────

const BG      = [15, 15, 26, 255];    // #0f0f1a
const ACCENT  = [233, 69, 96, 255];   // #e94560
const WHITE   = [255, 255, 255, 255];
const TRANSP  = [0, 0, 0, 0];

function dist(x, y, cx, cy) {
  return Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
}

// ─── Icon pixel function (1024×1024) ────────────────────────────────────────
// Dark background + centered ⚽ silhouette (circle + pentagon patches)

function iconPixel(x, y, W, H) {
  const cx = W / 2, cy = H / 2;
  const r = W * 0.38;
  const d = dist(x, y, cx, cy);

  // Rounded background
  const bgR = W * 0.22;
  const bgDist = dist(x, y, cx, cy);

  // Rounded rect background
  const rx = Math.abs(x - cx), ry = Math.abs(y - cy);
  const cornerR = W * 0.22;
  const inRoundedRect =
    rx <= W * 0.44 && ry <= H * 0.44 &&
    (rx <= W * 0.44 - cornerR || ry <= H * 0.44 - cornerR ||
      dist(rx, ry, W * 0.44 - cornerR, H * 0.44 - cornerR) <= cornerR);

  if (!inRoundedRect) return TRANSP;

  // Circle (ball)
  if (d <= r) {
    // Pentagon patch pattern (simplified hexagon tiles)
    const angle = Math.atan2(y - cy, x - cx);
    const normalD = d / r;
    const tile = Math.floor((angle / Math.PI + 1) * 3 + normalD * 2);
    return tile % 3 === 0 && d > r * 0.25
      ? [20, 20, 35, 255]  // dark patch
      : WHITE;
  }

  return [30, 30, 50, 255]; // background inside rounded rect
}

// ─── Splash pixel function ───────────────────────────────────────────────────

function splashPixel(x, y, W, H) {
  const cx = W / 2, cy = H / 2;
  const logoR = W * 0.15;
  const d = dist(x, y, cx, cy * 0.85);

  // Ball
  if (d <= logoR) {
    const angle = Math.atan2(y - cy * 0.85, x - cx);
    const nd = d / logoR;
    const tile = Math.floor((angle / Math.PI + 1) * 3 + nd * 2);
    return tile % 3 === 0 && nd > 0.25 ? [20, 20, 35, 255] : WHITE;
  }

  // Gradient background
  const t = y / H;
  const r = Math.round(15 + t * 10);
  const g = Math.round(15 + t * 5);
  const b = Math.round(26 + t * 15);
  return [r, g, b, 255];
}

// ─── Notification icon (96×96, white silhouette on transparent) ──────────────

function notifPixel(x, y, W, H) {
  const cx = W / 2, cy = H / 2;
  const r = W * 0.38;
  const d = dist(x, y, cx, cy);
  if (d <= r) return WHITE;
  return TRANSP;
}

// ─── Write files ─────────────────────────────────────────────────────────────

const assetsDir = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

const files = [
  {
    name: 'icon.png',
    w: 1024, h: 1024,
    fn: (x, y) => iconPixel(x, y, 1024, 1024),
  },
  {
    name: 'adaptive-icon.png',
    w: 1024, h: 1024,
    fn: (x, y) => iconPixel(x, y, 1024, 1024),
  },
  {
    name: 'splash.png',
    w: 1284, h: 2778,
    fn: (x, y) => splashPixel(x, y, 1284, 2778),
  },
  {
    name: 'favicon.png',
    w: 196, h: 196,
    fn: (x, y) => iconPixel(x, y, 196, 196),
  },
  {
    name: 'notification-icon.png',
    w: 96, h: 96,
    fn: (x, y) => notifPixel(x, y, 96, 96),
  },
];

console.log('Generating Expo assets...\n');

for (const { name, w, h, fn } of files) {
  const outPath = path.join(assetsDir, name);
  const buf = encodePNG(w, h, fn);
  fs.writeFileSync(outPath, buf);
  const kb = (buf.length / 1024).toFixed(1);
  console.log(`  ✓  ${name.padEnd(28)} ${w}×${h}  (${kb} KB)`);
}

console.log('\nDone! All assets written to assets/');
console.log('\nNext step: npx expo start --android');
