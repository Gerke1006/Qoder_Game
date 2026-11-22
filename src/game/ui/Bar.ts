import * as Phaser from 'phaser';
import { UiKeys, type UiKey } from '../types';

/**
 * 美术进度条：底槽 + 填充 + 金边三层，全部按交付素材的原始像素装配。
 *
 * 进度用填充层的 crop 宽度表达，而不是横向缩放贴图：
 * 高光、圆角与木纹在任何比例下都不会被压扁。整体尺寸走 container.setScale。
 */
const NATIVE = { width: 480, height: 60 };
const FILL = { width: 447, height: 32, x: 17, y: 13 };

export interface Bar {
  container: Phaser.GameObjects.Container;
  setRatio(ratio: number): void;
  destroy(): void;
}

const FALLBACKS: Record<string, { width: number; height: number; draw: (g: Phaser.GameObjects.Graphics) => void }> = {
  [UiKeys.BarTrough]: {
    width: NATIVE.width,
    height: NATIVE.height,
    draw: (g) => {
      g.fillStyle(0x2a1608, 1).fillRoundedRect(0, 0, NATIVE.width, NATIVE.height, 10);
      g.lineStyle(6, 0x8a5a33, 1).strokeRoundedRect(3, 3, 474, 54, 8);
    }
  },
  [UiKeys.BarFill]: {
    width: FILL.width,
    height: FILL.height,
    draw: (g) => g.fillStyle(0xe03428, 1).fillRoundedRect(0, 0, FILL.width, FILL.height, 8)
  },
  [UiKeys.BarFrame]: {
    width: NATIVE.width,
    height: NATIVE.height,
    draw: (g) => g.lineStyle(6, 0x8a5a33, 1).strokeRoundedRect(3, 3, 474, 54, 8)
  }
};

function ensure(scene: Phaser.Scene, key: UiKey): void {
  if (scene.textures.exists(key)) {
    return;
  }
  const fallback = FALLBACKS[key];
  if (!fallback) {
    return;
  }
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  fallback.draw(g);
  g.generateTexture(key, fallback.width, fallback.height);
  g.destroy();
}

export function createBar(scene: Phaser.Scene, x: number, y: number, width: number, height: number): Bar {
  ensure(scene, UiKeys.BarTrough);
  ensure(scene, UiKeys.BarFill);
  ensure(scene, UiKeys.BarFrame);

  const trough = scene.add.image(0, 0, UiKeys.BarTrough);
  const fill = scene.add
    .image(FILL.x - NATIVE.width / 2, FILL.y - NATIVE.height / 2, UiKeys.BarFill)
    .setOrigin(0);
  const frame = scene.add.image(0, 0, UiKeys.BarFrame);
  const container = scene.add
    .container(x, y, [trough, fill, frame])
    .setScale(width / NATIVE.width, height / NATIVE.height);

  const bar: Bar = {
    container,
    setRatio(ratio: number): void {
      const clamped = Phaser.Math.Clamp(ratio, 0, 1);
      fill.setVisible(clamped > 0.001);
      fill.setCrop(0, 0, Math.round(FILL.width * clamped), FILL.height);
    },
    destroy(): void {
      container.destroy();
    }
  };
  bar.setRatio(1);
  return bar;
}
