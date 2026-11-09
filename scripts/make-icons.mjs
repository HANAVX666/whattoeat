import zlib from "node:zlib";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BG = [226, 80, 58];
const FG = [250, 247, 242];

const TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(w, h, rgba) {
  const stride = w * 4 + 1;
  const raw = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    raw[y * stride] = 0;
    rgba.copy(raw, y * stride + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

function inRim(x, y) {
  if (y < 150 || y > 192 || x < 76 || x > 436) return false;
  if (y >= 168) return true;
  const dy = 168 - y;
  if (x >= 94 && x <= 418) return true;
  const cx = x < 94 ? 94 : 418;
  const dx = x - cx;
  return dx * dx + dy * dy <= 324;
}

function inBowl(x, y) {
  if (y >= 192) {
    const dx = x - 256;
    const dy = y - 192;
    if (dx * dx + dy * dy <= 28900) return true;
  }
  return inRim(x, y);
}

function render(size, scale) {
  const SS = 4;
  const acc = new Float32Array(size * size);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let hit = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (px + (sx + 0.5) / SS) / size;
          const v = (py + (sy + 0.5) / SS) / size;
          const x = ((u - 0.5) / scale + 0.5) * 512;
          const y = ((v - 0.5) / scale + 0.5) * 512;
          if (inBowl(x, y)) hit++;
        }
      }
      acc[py * size + px] = hit / (SS * SS);
    }
  }
  const out = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const a = acc[i];
    out[i * 4] = Math.round(BG[0] + (FG[0] - BG[0]) * a);
    out[i * 4 + 1] = Math.round(BG[1] + (FG[1] - BG[1]) * a);
    out[i * 4 + 2] = Math.round(BG[2] + (FG[2] - BG[2]) * a);
    out[i * 4 + 3] = 255;
  }
  return encodePNG(size, size, out);
}

const jobs = [["icon-192.png", 192, 1], ["icon-512.png", 512, 1], ["icon-512-maskable.png", 512, 0.72]];
for (const [name, size, scale] of jobs) {
  writeFileSync(join(ROOT, name), render(size, scale));
  console.log("wrote " + name);
}
