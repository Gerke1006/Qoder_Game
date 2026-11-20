import * as Phaser from 'phaser';
import { UiKeys } from '../types';

/**
 * 美术进度条：底槽 + 红色填充 + 金边三层整图缩放。
 *
 * 原图比例（459x112 槽 / 403x79 填充）决定了内腔留白，
 * 这里按同一比例换算，任意显示尺寸下填充都正好落在槽内。
 */
export interface Bar {
  container: Phaser.GameObjects.Container;
  setRatio(ratio: number): void;
  destroy(): void;
}

const INNER_W = 403 / 459;
const INNER_H = 79 / 112;
const PAD_X = (459 - 403) / 2 / 459;

export function createBar(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number
): Bar {
  const trough = scene.add.image(0, 0, UiKeys.BarTrough).setDisplaySize(width, height);
  const innerW = width * INNER_W;
  const innerH = height * INNER_H;
  const fill = scene.add
    .image(-width / 2 + width * PAD_X, 0, UiKeys.BarFill)
    .setOrigin(0, 0.5)
    .setDisplaySize(innerW, innerH);
  const frame = scene.add.image(0, 0, UiKeys.BarFrame).setDisplaySize(width, height);
  const container = scene.add.container(x, y, [trough, fill, frame]);

  return {
    container,
    setRatio(ratio: number): void {
      const clamped = Phaser.Math.Clamp(ratio, 0, 1);
      fill.setVisible(clamped > 0.001);
      fill.setDisplaySize(Math.max(innerW * clamped, innerH * 0.9), innerH);
    },
    destroy(): void {
      container.destroy();
    }
  };
}
