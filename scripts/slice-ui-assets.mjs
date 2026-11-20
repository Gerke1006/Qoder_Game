/**
 * UI 素材切图管线（零第三方依赖，仅用 Node 内置 zlib）。
 *
 * 用法：
 *   node scripts/slice-ui-assets.mjs inspect   # 打印每张 sheets 的尺寸、色彩类型与连通元素包围盒
 *   node scripts/slice-ui-assets.mjs           # 按 SLICE_PLAN 裁切并输出到 public/assets/
 *
 * 输入 sheets 位于 SHEET_DIR（交付的原始整图），输出为独立 PNG 与 BMFont XML。
 * 美术换图后重跑本脚本即可，坐标以连通域自动分析为准，SLICE_PLAN 只负责命名与分组。
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { inflateSync, deflateSync } from 'node:zlib';
import path from 'node:path';

const SHEET_DIR = 'C:/Users/黄成源/.qoder/tmp/D--main-NKU-----Qoder-Game/images/830e7ae3-658d-4e64-813e-e8fe07f1ccc4';
const OUT_IMG = 'public/assets/images/ui';
const OUT_FONT = 'public/assets/fonts';

const SHEETS = {
  panels: 'd07db7e9-749f-40ba-95c9-161246924115.png',
  icons: '315b4c4b-a00a-4622-a230-09c8b59b987c.png',
  rarity: 'bd1018b7-bb44-454e-bd43-96ff931eee13.png',
  combat: '4edac8bc-1cd7-4c10-aeab-70a5e9fb8f43.png'
};

/* ---------------- PNG 解码 ---------------- */

const CRC_TABLE = (() => {
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
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

export function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a png');
  let pos = 8;
  let ihdr = null;
  const idat = [];
  let plte = null;
  let trns = null;
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      ihdr = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        depth: data[8],
        color: data[9],
        interlace: data[12]
      };
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'PLTE') plte = data;
    else if (type === 'tRNS') trns = data;
    pos += 12 + len;
  }
  if (!ihdr || ihdr.depth !== 8 || ihdr.interlace !== 0) throw new Error('unsupported png format');
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ihdr.color];
  const raw = inflateSync(Buffer.concat(idat));
  const stride = ihdr.width * channels;
  const out = Buffer.alloc(ihdr.height * stride);
  let rp = 0;
  for (let y = 0; y < ihdr.height; y++) {
    const filter = raw[rp++];
    for (let x = 0; x < stride; x++) {
      const cur = raw[rp + x];
      const a = x >= channels ? out[y * stride + x - channels] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= channels && y > 0 ? out[(y - 1) * stride + x - channels] : 0;
      let v;
      switch (filter) {
        case 0: v = cur; break;
        case 1: v = cur + a; break;
        case 2: v = cur + b; break;
        case 3: v = cur + ((a + b) >> 1); break;
        case 4: v = cur + paeth(a, b, c); break;
        default: throw new Error('bad filter ' + filter);
      }
      out[y * stride + x] = v & 0xff;
    }
    rp += stride;
  }
  // 统一转 RGBA
  const rgba = Buffer.alloc(ihdr.width * ihdr.height * 4);
  for (let i = 0; i < ihdr.width * ihdr.height; i++) {
    let r, g, b, a;
    if (ihdr.color === 6) [r, g, b, a] = [out[i * 4], out[i * 4 + 1], out[i * 4 + 2], out[i * 4 + 3]];
    else if (ihdr.color === 2) [r, g, b, a] = [out[i * 3], out[i * 3 + 1], out[i * 3 + 2], 255];
    else if (ihdr.color === 0) [r, g, b, a] = [out[i], out[i], out[i], 255];
    else if (ihdr.color === 4) [r, g, b, a] = [out[i * 2], out[i * 2], out[i * 2], out[i * 2 + 1]];
    else {
      const idx = out[i];
      r = plte[idx * 3]; g = plte[idx * 3 + 1]; b = plte[idx * 3 + 2];
      a = trns && idx < trns.length ? trns[idx] : 255;
    }
    rgba[i * 4] = r; rgba[i * 4 + 1] = g; rgba[i * 4 + 2] = b; rgba[i * 4 + 3] = a;
  }
  return { width: ihdr.width, height: ihdr.height, color: ihdr.color, data: rgba };
}

/* ---------------- PNG 编码 ---------------- */

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

export function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* ---------------- 连通域分析 ---------------- */

export function components(img, minArea = 60) {
  const { width, height, data } = img;
  const hasAlpha = img.color === 6 || img.color === 4 || img.color === 3;
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2], a = data[i * 4 + 3];
    mask[i] = hasAlpha ? (a > 10 ? 1 : 0) : (r < 248 || g < 248 || b < 248 ? 1 : 0);
  }
  const seen = new Uint8Array(width * height);
  const boxes = [];
  const stack = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;
    let minX = width, minY = height, maxX = 0, maxY = 0, area = 0;
    stack.length = 0;
    stack.push(start);
    seen[start] = 1;
    while (stack.length) {
      const p = stack.pop();
      const x = p % width, y = (p / width) | 0;
      area++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      const neighbors = [p - 1, p + 1, p - width, p + width];
      for (const q of neighbors) {
        if (q < 0 || q >= mask.length) continue;
        const qx = q % width;
        if (Math.abs(qx - x) > 1) continue;
        if (mask[q] && !seen[q]) { seen[q] = 1; stack.push(q); }
      }
    }
    if (area >= minArea) boxes.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, area });
  }
  boxes.sort((a, b) => a.y - b.y || a.x - b.x);
  return boxes;
}

export function crop(img, box, pad = 2) {
  const x = Math.max(0, box.x - pad);
  const y = Math.max(0, box.y - pad);
  const w = Math.min(img.width - x, box.w + pad * 2);
  const h = Math.min(img.height - y, box.h + pad * 2);
  const out = Buffer.alloc(w * h * 4);
  for (let row = 0; row < h; row++) {
    img.data.copy(out, row * w * 4, ((y + row) * img.width + x) * 4, ((y + row) * img.width + x + w) * 4);
  }
  return { width: w, height: h, data: out, x, y };
}

/* ---------------- 主流程 ---------------- */

const mode = process.argv[2] ?? 'slice';

if (mode === 'inspect') {
  for (const [name, file] of Object.entries(SHEETS)) {
    const img = decodePng(readFileSync(path.join(SHEET_DIR, file)));
    console.log(`\n=== ${name} ${img.width}x${img.height} colorType=${img.color} ===`);
    const boxes = components(img);
    boxes.forEach((b, i) => console.log(`#${i} x=${b.x} y=${b.y} w=${b.w} h=${b.h} area=${b.area}`));
  }
} else {
  runSlicePlan();
}

/* 命名与分组计划：inspect 之后按包围盒序号填写。 */
function runSlicePlan() {
  mkdirSync(OUT_IMG, { recursive: true });
  mkdirSync(OUT_FONT, { recursive: true });
  const plan = buildPlan();
  for (const job of plan) {
    const img = decodePng(readFileSync(path.join(SHEET_DIR, SHEETS[job.sheet])));
    if (job.kind === 'crop') {
      const c = crop(img, job.box, job.pad ?? 2);
      writeFileSync(path.join(OUT_IMG, job.out), encodePng(c.width, c.height, c.data));
      console.log('wrote', job.out, c.width + 'x' + c.height);
    } else if (job.kind === 'font') {
      writeFont(img, job);
    }
  }
}

function buildPlan() {
  return [
    { sheet: 'panels', kind: 'crop', out: 'panel-large.png', box: { x: 69, y: 12, w: 1311, h: 541 } },
    { sheet: 'panels', kind: 'crop', out: 'panel-small.png', box: { x: 339, y: 585, w: 770, h: 289 } },
    { sheet: 'panels', kind: 'crop', out: 'bar-trough.png', box: { x: 31, y: 937, w: 455, h: 108 } },
    { sheet: 'panels', kind: 'crop', out: 'bar-frame.png', box: { x: 964, y: 938, w: 454, h: 107 } },
    { sheet: 'panels', kind: 'crop', out: 'bar-fill.png', box: { x: 532, y: 954, w: 399, h: 75 } },

    { sheet: 'icons', kind: 'crop', out: 'icon-gold.png', box: { x: 136, y: 142, w: 365, h: 346 } },
    { sheet: 'icons', kind: 'crop', out: 'icon-base.png', box: { x: 537, y: 74, w: 367, h: 414 } },
    { sheet: 'icons', kind: 'crop', out: 'icon-heart.png', box: { x: 945, y: 143, w: 366, h: 342 } },
    { sheet: 'icons', kind: 'crop', out: 'icon-damage.png', box: { x: 28, y: 592, w: 343, h: 364 } },
    { sheet: 'icons', kind: 'crop', out: 'icon-speed.png', box: { x: 384, y: 593, w: 337, h: 364 } },
    { sheet: 'icons', kind: 'crop', out: 'icon-time.png', box: { x: 733, y: 592, w: 337, h: 365 } },
    { sheet: 'icons', kind: 'crop', out: 'icon-wave.png', box: { x: 1080, y: 591, w: 344, h: 364 } },

    { sheet: 'rarity', kind: 'crop', out: 'frame-common.png', box: { x: 34, y: 221, w: 445, h: 644 } },
    { sheet: 'rarity', kind: 'crop', out: 'frame-rare.png', box: { x: 499, y: 221, w: 447, h: 644 } },
    { sheet: 'rarity', kind: 'crop', out: 'frame-epic.png', box: { x: 967, y: 173, w: 448, h: 690 } },

    { sheet: 'combat', kind: 'crop', out: 'ui-crosshair.png', box: { x: 61, y: 768, w: 243, h: 248 } },
    { sheet: 'combat', kind: 'crop', out: 'ui-aimline.png', box: { x: 331, y: 843, w: 459, h: 102 } },
    { sheet: 'combat', kind: 'crop', out: 'ui-cooldown.png', box: { x: 839, y: 769, w: 245, h: 242 } },

    { sheet: 'combat', kind: 'font', out: 'dmg-normal', box: { x: 63, y: 89, w: 1346, h: 142 }, startX: 65, endX: 1406 },
    { sheet: 'combat', kind: 'font', out: 'dmg-crit', box: { x: 17, y: 266, w: 1414, h: 220 }, startX: 19, endX: 1429 },
    { sheet: 'combat', kind: 'font', out: 'dmg-hit', box: { x: 16, y: 512, w: 1420, h: 200 }, startX: 20, endX: 1433 }
  ];
}

/**
 * 由整行数字条生成 BMFont。
 * 切分点取"列透明投影"的零值游程中心（缺失时在期望位置附近取最小值列），
 * 12 个字形按顺序可无缝拼回原条，BitmapText 渲染即还原美术字形。
 */
function writeFont(img, job) {
  const strip = crop(img, job.box, 0);
  const { width, height, data } = strip;
  const colAlpha = new Float64Array(width);
  for (let x = 0; x < width; x++) {
    let sum = 0;
    for (let y = 0; y < height; y++) sum += data[(y * width + x) * 4 + 3];
    colAlpha[x] = sum;
  }
  const relStart = job.startX - job.box.x;
  const relEnd = job.endX - job.box.x;
  const pitch = (relEnd - relStart) / 12;

  const zeroRuns = [];
  let runStart = -1;
  for (let x = 0; x <= width; x++) {
    const zero = x < width && colAlpha[x] === 0;
    if (zero && runStart < 0) runStart = x;
    if (!zero && runStart >= 0) {
      if (x - runStart >= 2) zeroRuns.push((runStart + x - 1) / 2);
      runStart = -1;
    }
  }

  const cuts = [0];
  for (let i = 1; i < 12; i++) {
    const expect = relStart + i * pitch;
    let best = null;
    let bestDist = Infinity;
    for (const c of zeroRuns) {
      const d = Math.abs(c - expect);
      if (d < bestDist && d <= 34) { bestDist = d; best = c; }
    }
    if (best === null) {
      let minV = Infinity;
      for (let x = Math.max(1, Math.floor(expect - 30)); x < Math.min(width - 1, expect + 30); x++) {
        if (colAlpha[x] < minV) { minV = colAlpha[x]; best = x; }
      }
    }
    cuts.push(Math.round(best));
  }
  cuts.push(width);
  for (let i = 1; i < cuts.length; i++) {
    if (cuts[i] <= cuts[i - 1]) cuts[i] = cuts[i - 1] + 1;
  }

  const chars = '0123456789-!';
  let xml = `<?xml version="1.0"?>\n<font>\n<info face="${job.out}" size="${height}"/>\n<common lineHeight="${height}" base="${height - 6}" scaleW="${width}" scaleH="${height}" pages="1"/>\n<pages><page id="0" file="${job.out}.png"/></pages>\n<chars count="12">\n`;
  for (let i = 0; i < 12; i++) {
    const x = cuts[i];
    const w = cuts[i + 1] - cuts[i];
    xml += `<char id="${chars.charCodeAt(i)}" x="${x}" y="0" width="${w}" height="${height}" xoffset="0" yoffset="0" xadvance="${w}" page="0"/>\n`;
  }
  xml += '</chars>\n</font>\n';
  writeFileSync(path.join(OUT_IMG, job.out + '.png'), encodePng(width, height, data));
  writeFileSync(path.join(OUT_FONT, job.out + '.xml'), xml);
  console.log('wrote font', job.out, 'cuts:', cuts.join(','));
}
