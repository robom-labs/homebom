// PWA 아이콘(도장 배경 + 종 모양)을 외부 의존성 없이 PNG로 생성하는 스크립트.
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
const STAMP = [200, 64, 47]; // #C8402F
const PAPER = [250, 246, 239]; // #FAF6EF

// 0..1 좌표계에서 점이 종(벨) 내부인지 판정한다.
function inBell(x, y) {
  // 꼭지
  if ((x - 0.5) ** 2 + (y - 0.235) ** 2 <= 0.038 ** 2) return true;
  // 돔(반원)
  if (y <= 0.46 && (x - 0.5) ** 2 + (y - 0.46) ** 2 <= 0.205 ** 2) return true;
  // 몸통(아래로 살짝 벌어짐)
  if (y > 0.46 && y <= 0.615) {
    const hw = 0.205 + (y - 0.46) * 0.55;
    if (Math.abs(x - 0.5) <= hw) return true;
  }
  // 입술(테)
  if (y > 0.615 && y <= 0.655 && Math.abs(x - 0.5) <= 0.3) return true;
  // 추
  if ((x - 0.5) ** 2 + (y - 0.72) ** 2 <= 0.05 ** 2) return true;
  return false;
}

// 0..1 좌표계에서 점이 배경(둥근 사각 도장) 내부인지 판정한다.
function inRoundedSquare(x, y, radius) {
  const cx = Math.min(Math.max(x, radius), 1 - radius);
  const cy = Math.min(Math.max(y, radius), 1 - radius);
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
}

function drawIcon(size, { maskable }) {
  const rgba = Buffer.alloc(size * size * 4);
  const SS = 3; // 3x3 슈퍼샘플링
  // maskable은 전체 채움 + 종을 안전영역(중앙 80%) 안에 배치한다.
  const bellScale = maskable ? 0.72 : 0.88;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let bgHit = 0;
      let bellHit = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (px + (sx + 0.5) / SS) / size;
          const y = (py + (sy + 0.5) / SS) / size;
          const bg = maskable ? true : inRoundedSquare(x, y, 0.21);
          if (!bg) continue;
          bgHit++;
          const bx = (x - 0.5) / bellScale + 0.5;
          const by = (y - 0.5) / bellScale + 0.5;
          if (inBell(bx, by)) bellHit++;
        }
      }
      const total = SS * SS;
      const alpha = bgHit / total;
      const bellRatio = bgHit > 0 ? bellHit / bgHit : 0;
      const i = (py * size + px) * 4;
      rgba[i] = Math.round(STAMP[0] + (PAPER[0] - STAMP[0]) * bellRatio);
      rgba[i + 1] = Math.round(STAMP[1] + (PAPER[1] - STAMP[1]) * bellRatio);
      rgba[i + 2] = Math.round(STAMP[2] + (PAPER[2] - STAMP[2]) * bellRatio);
      rgba[i + 3] = Math.round(alpha * 255);
    }
  }
  return encodePng(size, rgba);
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, "icon-192.png"), drawIcon(192, { maskable: false }));
writeFileSync(join(OUT_DIR, "icon-512.png"), drawIcon(512, { maskable: false }));
writeFileSync(join(OUT_DIR, "maskable-512.png"), drawIcon(512, { maskable: true }));
console.log(`아이콘 3종 생성 완료 → ${OUT_DIR}`);
