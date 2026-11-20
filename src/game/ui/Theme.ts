import * as Phaser from 'phaser';
import { UiKeys } from '../types';

/**
 * 视觉语言：林地 + 羊皮纸 + 木框。
 *
 * 所有 UI 颜色与文字样式从这里取，保证面板、飘字、卡框与战场氛围同一套色板；
 * 色相直接来自交付美术（木棕 / 羊皮纸米 / 叶绿 / 金币黄 / 血红 / 史诗紫）。
 */
export const Palette = {
  forestDeep: '#141f10',
  forest: '#2c4522',
  forestLight: '#3d5c30',
  parchment: '#f3e2c0',
  parchmentDark: '#e8d3a8',
  cream: '#f8ecd2',
  ink: '#4a2f1b',
  inkSoft: '#7a5a3a',
  wood: '#7a4a2b',
  leaf: '#6fae4e',
  gold: '#f0b429',
  danger: '#e04a3a',
  info: '#3f8fd6',
  epic: '#9b4fd6',
  stone: '#8a8f98'
} as const;

export const FONT_FAMILY = '"Microsoft YaHei", "PingFang SC", system-ui, sans-serif';

export function inkStyle(size: number, bold = false): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: FONT_FAMILY,
    fontSize: `${size}px`,
    fontStyle: bold ? 'bold' : 'normal',
    color: Palette.ink
  };
}

export function creamStyle(size: number, bold = false): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: FONT_FAMILY,
    fontSize: `${size}px`,
    fontStyle: bold ? 'bold' : 'normal',
    color: Palette.cream,
    stroke: Palette.forestDeep,
    strokeThickness: 3
  };
}

/** 九宫格边框：保留四角木框与叶饰，只拉伸中间羊皮纸。 */
const PANEL_BORDERS = {
  [UiKeys.PanelLarge]: { left: 110, right: 110, top: 100, bottom: 100 },
  [UiKeys.PanelSmall]: { left: 100, right: 100, top: 90, bottom: 90 }
} as const;

type PanelKey = keyof typeof PANEL_BORDERS;

export function createPanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  key: PanelKey = UiKeys.PanelLarge
): Phaser.GameObjects.NineSlice {
  const b = PANEL_BORDERS[key];
  return scene.add
    .nineslice(x, y, key, undefined, width, height, b.left, b.right, b.top, b.bottom)
    .setOrigin(0.5);
}

/** 接近原图比例的 plaque（按钮 / 标题条）直接整图缩放，避免九宫格压扁角饰。 */
export function createPlaque(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  key: PanelKey = UiKeys.PanelSmall
): Phaser.GameObjects.Image {
  const src = scene.textures.get(key).getSourceImage();
  const ratio = src.height / src.width;
  return scene.add.image(x, y, key).setDisplaySize(width, Math.round(width * ratio)).setOrigin(0.5);
}

export const RARITY_COLOR: Record<'common' | 'rare' | 'epic', string> = {
  common: Palette.stone,
  rare: Palette.info,
  epic: Palette.epic
};
