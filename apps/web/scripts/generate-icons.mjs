// 청약봄 대표 아이콘(건물 + 봄 점)을 외부 의존성 없이 PNG로 생성하는 스크립트.
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

// ---- PNG 인코더 (RGBA, 8bit) ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- 아이콘 드로잉 ----
const TRANSPARENT = [0, 0, 0, 0];
const BACKGROUND = [231, 244, 231, 255]; // #E7F4E7
const BACKGROUND_STROKE = [185, 221, 191, 255]; // #B9DDBF
const PAPER = [255, 250, 243, 255]; // #FFFAF3
const INK = [29, 48, 71, 255]; // #1D3047
const ACCENT = [78, 165, 101, 255]; // #4EA565

function inRoundedRect(x, y, x0, y0, x1, y1, radius) {
  const cx = Math.min(Math.max(x, x0 + radius), x1 - radius);
  const cy = Math.min(Math.max(y, y0 + radius), y1 - radius);
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
}

function onRoundedRectStroke(x, y, x0, y0, x1, y1, radius, width) {
  if (!inRoundedRect(x, y, x0 - width / 2, y0 - width / 2, x1 + width / 2, y1 + width / 2, radius + width / 2)) return false;
  return !inRoundedRect(x, y, x0 + width / 2, y0 + width / 2, x1 - width / 2, y1 - width / 2, Math.max(0, radius - width / 2));
}

function distanceToSegment(x, y, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lengthSquared));
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

function onLine(x, y, x1, y1, x2, y2, width) {
  return distanceToSegment(x, y, x1, y1, x2, y2) <= width / 2;
}

function sampleIcon(x, y, maskable) {
  const scale = maskable ? 0.78 : 1;
  const ux = (x - 0.5) / scale + 0.5;
  const uy = (y - 0.5) / scale + 0.5;
  let color = maskable ? BACKGROUND : TRANSPARENT;

  const bgOuter = inRoundedRect(ux, uy, 2 / 64, 2 / 64, 62 / 64, 62 / 64, 17 / 64);
  const bgInner = inRoundedRect(ux, uy, 4 / 64, 4 / 64, 60 / 64, 60 / 64, 15 / 64);
  if (bgOuter) color = BACKGROUND_STROKE;
  if (bgInner) color = BACKGROUND;

  if (inRoundedRect(ux, uy, 19 / 64, 16 / 64, 45 / 64, 49 / 64, 3.5 / 64)) color = PAPER;
  if (onRoundedRectStroke(ux, uy, 19 / 64, 16 / 64, 45 / 64, 49 / 64, 3.5 / 64, 3.5 / 64)) color = INK;

  const lineWidth = 3.5 / 64;
  const windows = [
    [25, 25, 29, 25], [35, 25, 39, 25],
    [25, 33, 29, 33], [35, 33, 39, 33],
    [29, 49, 29, 41], [29, 41, 35, 41], [35, 41, 35, 49],
  ];
  if (windows.some(([x1, y1, x2, y2]) => onLine(ux, uy, x1 / 64, y1 / 64, x2 / 64, y2 / 64, lineWidth))) color = ACCENT;
  if ((ux - 50 / 64) ** 2 + (uy - 14 / 64) ** 2 <= (3 / 64) ** 2) color = ACCENT;
  return color;
}

function drawIcon(size, { maskable }) {
  const rgba = Buffer.alloc(size * size * 4);
  const SS = 3; // 3x3 슈퍼샘플링
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const sums = [0, 0, 0, 0];
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (px + (sx + 0.5) / SS) / size;
          const y = (py + (sy + 0.5) / SS) / size;
          const color = sampleIcon(x, y, maskable);
          for (let channel = 0; channel < 4; channel++) sums[channel] += color[channel];
        }
      }
      const total = SS * SS;
      const i = (py * size + px) * 4;
      for (let channel = 0; channel < 4; channel++) rgba[i + channel] = Math.round(sums[channel] / total);
    }
  }
  return encodePng(size, rgba);
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, "apple-touch-icon-v2.png"), drawIcon(180, { maskable: true }));
writeFileSync(join(OUT_DIR, "icon-192-v2.png"), drawIcon(192, { maskable: false }));
writeFileSync(join(OUT_DIR, "icon-512-v2.png"), drawIcon(512, { maskable: false }));
writeFileSync(join(OUT_DIR, "maskable-512-v2.png"), drawIcon(512, { maskable: true }));
console.log(`아이콘 4종 생성 완료 → ${OUT_DIR}`);
