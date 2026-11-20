import * as Phaser from 'phaser';
import { AssetKeys, DESIGN_SIZE } from '../types';

/**
 * 林地背景：草地平铺 + 斜射光柱 + 暗角 + 飘落树叶。
 * 主菜单 / 战斗 / 结算共用，保证三个场景同一套空间氛围。
 */
export function createForestBackground(scene: Phaser.Scene, withLeaves = true): Phaser.GameObjects.Container {
  const root = scene.add.container(0, 0);

  const ground = scene.add.tileSprite(DESIGN_SIZE.width / 2, DESIGN_SIZE.height / 2, DESIGN_SIZE.width, DESIGN_SIZE.height, AssetKeys.Ground);
  const rays = scene.add.graphics();
  rays.fillStyle(0xf6e7c8, 0.05);
  rays.fillTriangle(120, -40, 260, -40, 520, 580);
  rays.fillTriangle(420, -40, 500, -40, 760, 580);
  rays.fillStyle(0xf6e7c8, 0.035);
  rays.fillTriangle(700, -40, 820, -40, 1040, 580);
  scene.add.image(DESIGN_SIZE.width / 2, DESIGN_SIZE.height / 2, 'tex-vignette').setDepth(40);
  root.add([ground, rays]);

  if (withLeaves) {
    const leaves = scene.add.particles(0, 0, AssetKeys.Leaf, {
      x: { min: 0, max: DESIGN_SIZE.width },
      y: -20,
      lifespan: 11000,
      speedY: { min: 16, max: 38 },
      speedX: { min: -16, max: 10 },
      rotate: { min: 0, max: 360 },
      scale: { min: 0.45, max: 0.95 },
      alpha: { start: 0.85, end: 0 },
      frequency: 620,
      quantity: 1
    });
    leaves.setDepth(44);
  }

  return root;
}
