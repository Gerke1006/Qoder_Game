import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { decodePng, encodePng, crop } from './slice-ui-assets.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = join(root, 'public/assets/images/titles');
const assets = [
  ['game', '林地守卫战', 'woodland-title-v1_1795424781566_c26c1d27.png'],
  ['reward', '林地馈赠', 'woodland-reward-v1_1795424889816_75ca6477.png'],
  ['victory', '守卫成功', 'woodland-victory-v1_1795424910829_cc84ccb3.png'],
  ['defeat', '基地陷落', 'woodland-defeat-v1_1795424937265_0e3cec58.png'],
  ['help', '守卫指南', 'woodland-help-v1_1795424958902_77dfda14.png'],
  ['pause', '战地休整', 'woodland-pause-v1_1795425034177_666a4198.png'],
  ['upgrade', '强化觉醒', 'woodland-upgrade-v1_1795425066570_00e435bf.png'],
  ['boss', '首领来袭', 'woodland-boss-v1_1795425101229_ea9c7c8b.png'],
  ['record', '新纪录', 'woodland-record-v1_1795425128152_4aeabd84.png']
];
const promptSummary = '精确简体中文，横排手绘奇幻美术字；羊皮纸与古金字面、木刻棕色描边、林叶装饰；绿底色强调成长与胜利，铜红强调失败、紫色强调首领；正面可读轮廓，纯洋红背景方便去底，无额外文字或水印。';
mkdirSync(output, { recursive: true });
const manifest = [];
for (const [name, text, source] of assets) {
  const image = decodePng(readFileSync(join(root, 'vibe_images', source)));
  const background = [0, 0, 0];
  for (let x = 0; x < image.width; x++) {
    for (let channel = 0; channel < 3; channel++) background[channel] += image.data[x * 4 + channel] / image.width;
  }
  const cutoff = Math.min(170, Math.min(background[0], background[2]) - background[1] - 20);
  let left = image.width, top = image.height, right = 0, bottom = 0;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const i = (y * image.width + x) * 4;
      const [r, g, b] = image.data.subarray(i, i + 3);
      const spill = Math.min(r, b) - g;
      const alpha = spill <= 70 ? 1 : Math.max(0, 1 - (spill - 70) / (cutoff - 70));
      image.data[i + 3] = Math.round(alpha * image.data[i + 3]);
      if (alpha > 0 && alpha < 1) {
        for (let channel = 0; channel < 3; channel++) {
          image.data[i + channel] = Math.max(0, Math.min(255, (image.data[i + channel] - background[channel] * (1 - alpha)) / alpha));
        }
      }
      if (image.data[i + 3] === 0) image.data.fill(0, i, i + 4);
      if (image.data[i + 3] > 128) {
        left = Math.min(left, x); right = Math.max(right, x);
        top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
    }
  }
  if (left >= right || top >= bottom) throw new Error(`Empty title: ${name}`);
  const result = crop(image, { x: left, y: top, w: right - left + 1, h: bottom - top + 1 }, 8);
  const file = `${name}-v1.png`;
  writeFileSync(join(output, file), encodePng(result.width, result.height, result.data));
  manifest.push({ file, text, source: `vibe_images/${source}`, width: result.width, height: result.height });
  console.log(`${file}: ${result.width}x${result.height} ${text}`);
}
writeFileSync(join(output, 'artwork.json'), JSON.stringify({ generator: 'ImageGen', promptSummary, assets: manifest }, null, 2) + '\n');
