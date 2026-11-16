import type * as Phaser from 'phaser';
import { AssetKeys } from '../types';

interface Swatch {
  key: string;
  size: number;
  color: number;
}

/** 初始化阶段使用的占位色块，正式美术接入后由 PreloadScene 改为加载图片。 */
const SWATCHES: Swatch[] = [
  { key: AssetKeys.Player, size: 32, color: 0x4fa3ff },
  { key: AssetKeys.Enemy, size: 28, color: 0xff5a5a },
  { key: AssetKeys.Boss, size: 64, color: 0xb14bff },
  { key: AssetKeys.Projectile, size: 10, color: 0xffd45a },
  { key: AssetKeys.Base, size: 48, color: 0x3ddc97 }
];

/**
 * 用 Graphics 直接生成纹理，不依赖任何外部图片网址。
 * 纹理以 AssetKeys 为 key 注册，之后 Sprite 与实体只用 key 取图。
 */
export function createPlaceholderTextures(scene: Phaser.Scene): void {
  for (const { key, size, color } of SWATCHES) {
    if (scene.textures.exists(key)) {
      continue;
    }
    const graphics = scene.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(color).fillRoundedRect(0, 0, size, size, Math.max(2, size * 0.15));
    graphics.generateTexture(key, size, size);
    graphics.destroy();
  }
}
