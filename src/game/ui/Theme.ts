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

/** Browser-level accessibility preference used to keep decorative motion optional. */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
}

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

/**
 * 九宫格边框：交付美术为正方形切图（panel-large 512²、panel-small 256²），
 * 角饰按原始像素绘制，只有中间羊皮纸 / 木纹被拉伸。
 */
const PANEL_BORDERS = {
  [UiKeys.PanelLarge]: { left: 64, right: 64, top: 64, bottom: 64 },
  [UiKeys.PanelSmall]: { left: 16, right: 16, top: 16, bottom: 16 }
} as const;

type PanelKey = keyof typeof PANEL_BORDERS;

/** panel-large 是浅色羊皮纸面，正文用墨色字；panel-small 是深色木面，文字必须用羊皮纸亮字。 */
export const PANEL_SAFE_INSET = 64;

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

/** 按钮 / 标题条底板：小面板九宫格，横向拉伸只作用于中间木纹。 */
export function createPlaque(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height = 56,
  key: PanelKey = UiKeys.PanelSmall
): Phaser.GameObjects.NineSlice {
  const b = PANEL_BORDERS[key];
  return scene.add
    .nineslice(x, y, key, undefined, width, height, b.left, b.right, b.top, b.bottom)
    .setOrigin(0.5);
}

export const RARITY_COLOR: Record<'common' | 'rare' | 'epic', string> = {
  common: Palette.stone,
  rare: Palette.info,
  epic: Palette.epic
};
