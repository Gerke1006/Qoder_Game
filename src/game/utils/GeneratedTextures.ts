import * as Phaser from 'phaser';
import { AssetKeys } from '../types';

/**
 * 世界纹理生成器。
 *
 * 交付美术只覆盖 UI（面板 / 进度条 / 图标 / 卡框 / 飘字），
 * 战场上的角色、弹体、粒子与背景仍由代码绘制，保持零外部素材依赖。
 * 全部纹理在 PreloadScene 一次性生成，之后场景只引用 key。
 */

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Draw = (g: Phaser.GameObjects.Graphics) => void;

function bake(scene: Phaser.Scene, key: string, w: number, h: number, draw: Draw): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

function slime(g: Phaser.GameObjects.Graphics, size: number, body: number, dark: number, angry: boolean): void {
  const c = size / 2;
  const r = size * 0.42;
  g.fillStyle(dark, 1);
  g.fillEllipse(c, c + size * 0.06, r * 2 + 4, r * 1.7 + 4);
  g.fillStyle(body, 1);
  g.fillEllipse(c, c + size * 0.04, r * 2, r * 1.7);
  g.fillStyle(0xffffff, 0.28);
  g.fillEllipse(c - r * 0.4, c - r * 0.45, r * 0.7, r * 0.42);
  const eyeY = c - size * 0.02;
  const eyeDx = size * 0.15;
  g.fillStyle(0xffffff, 1);
  g.fillCircle(c - eyeDx, eyeY, size * 0.09);
  g.fillCircle(c + eyeDx, eyeY, size * 0.09);
  g.fillStyle(0x1d1410, 1);
  g.fillCircle(c - eyeDx - size * 0.02, eyeY, size * 0.045);
  g.fillCircle(c + eyeDx - size * 0.02, eyeY, size * 0.045);
  if (angry) {
    g.lineStyle(size * 0.05, dark, 1);
    g.lineBetween(c - eyeDx - size * 0.1, eyeY - size * 0.14, c - eyeDx + size * 0.08, eyeY - size * 0.06);
    g.lineBetween(c + eyeDx + size * 0.1, eyeY - size * 0.14, c + eyeDx - size * 0.08, eyeY - size * 0.06);
  }
  g.lineStyle(size * 0.04, dark, 1);
  g.beginPath();
  g.arc(c, c + size * 0.16, size * 0.12, 0.15 * Math.PI, 0.85 * Math.PI);
  g.strokePath();
}

export function createWorldTextures(scene: Phaser.Scene): void {
  const rand = mulberry32(20261120);

  bake(scene, AssetKeys.Ground, 256, 256, (g) => {
    g.fillStyle(0x2c4522, 1);
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 90; i++) {
      const x = rand() * 256;
      const y = rand() * 256;
      const r = 6 + rand() * 22;
      g.fillStyle(rand() > 0.5 ? 0x33512a : 0x273d1e, 0.5);
      g.fillEllipse(x, y, r * 2, r);
    }
    g.lineStyle(2, 0x3d5c30, 0.7);
    for (let i = 0; i < 70; i++) {
      const x = rand() * 256;
      const y = rand() * 256;
      g.lineBetween(x, y, x + (rand() - 0.5) * 6, y - 4 - rand() * 5);
    }
    for (let i = 0; i < 14; i++) {
      g.fillStyle(0x4a6b38, 0.6);
      g.fillCircle(rand() * 256, rand() * 256, 1.6);
    }
  });

  bake(scene, AssetKeys.Player, 72, 72, (g) => {
    g.fillStyle(0x1d1410, 0.35);
    g.fillEllipse(36, 64, 40, 12);
    g.fillStyle(0x2f5a28, 1);
    g.fillEllipse(32, 44, 34, 40);
    g.fillStyle(0x3f7a34, 1);
    g.fillEllipse(32, 42, 28, 34);
    g.fillStyle(0x7a4a2b, 1);
    g.fillRect(20, 40, 24, 6);
    g.fillStyle(0xf0c9a0, 1);
    g.fillCircle(34, 24, 11);
    g.fillStyle(0x2f5a28, 1);
    g.fillEllipse(32, 18, 26, 16);
    g.fillStyle(0x1d1410, 1);
    g.fillCircle(38, 24, 2);
    g.lineStyle(4, 0xd9a441, 1);
    g.beginPath();
    g.arc(48, 36, 18, -0.42 * Math.PI, 0.42 * Math.PI);
    g.strokePath();
    g.lineStyle(2, 0xf3e2c0, 1);
    g.lineBetween(48 + 18 * Math.cos(-0.42 * Math.PI), 36 + 18 * Math.sin(-0.42 * Math.PI), 48 + 18 * Math.cos(0.42 * Math.PI), 36 + 18 * Math.sin(0.42 * Math.PI));
    g.fillStyle(0x7a4a2b, 1);
    g.fillRect(14, 30, 8, 20);
    g.fillStyle(0xd9a441, 1);
    g.fillTriangle(14, 30, 22, 30, 18, 22);
  });

  bake(scene, AssetKeys.EnemyGrunt, 48, 48, (g) => slime(g, 48, 0x6fae4e, 0x3c6b2a, false));
  bake(scene, AssetKeys.EnemyRunner, 40, 40, (g) => {
    slime(g, 40, 0x3fb8af, 0x1f7a74, false);
    g.lineStyle(3, 0xbfeee9, 0.8);
    g.lineBetween(2, 14, 10, 14);
    g.lineBetween(0, 22, 9, 22);
    g.lineBetween(3, 30, 10, 30);
  });
  bake(scene, AssetKeys.Boss, 112, 112, (g) => {
    slime(g, 112, 0x9b4fd6, 0x5c2a86, true);
    g.fillStyle(0xf0b429, 1);
    g.fillTriangle(34, 26, 46, 26, 40, 10);
    g.fillTriangle(50, 24, 62, 24, 56, 6);
    g.fillTriangle(66, 26, 78, 26, 72, 10);
    g.fillRect(34, 22, 44, 8);
    g.fillStyle(0xe04a3a, 1);
    g.fillCircle(56, 26, 3);
  });

  bake(scene, AssetKeys.Projectile, 30, 12, (g) => {
    g.fillStyle(0xd9a441, 1);
    g.fillRect(6, 5, 18, 2);
    g.fillStyle(0xf6e7c8, 1);
    g.fillTriangle(24, 2, 24, 10, 30, 6);
    g.fillStyle(0x6fae4e, 1);
    g.fillTriangle(6, 6, 0, 1, 4, 6);
    g.fillTriangle(6, 6, 0, 11, 4, 6);
  });

  bake(scene, AssetKeys.CardFill, 64, 64, (g) => {
    g.fillStyle(0xf3e2c0, 1);
    g.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 60; i++) {
      g.fillStyle(rand() > 0.5 ? 0xe8d3a8 : 0xf8ecd2, 0.5);
      g.fillCircle(rand() * 64, rand() * 64, 1 + rand() * 2);
    }
  });

  bake(scene, AssetKeys.Leaf, 18, 18, (g) => {
    g.fillStyle(0x6fae4e, 1);
    g.fillEllipse(9, 9, 16, 8);
    g.lineStyle(1.5, 0x3c6b2a, 1);
    g.lineBetween(2, 9, 16, 9);
  });

  bake(scene, AssetKeys.Spark, 24, 24, (g) => {
    g.fillStyle(0xffffff, 0.18);
    g.fillCircle(12, 12, 12);
    g.fillStyle(0xffffff, 0.4);
    g.fillCircle(12, 12, 8);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(12, 12, 4);
  });

  const vignette = scene.textures.createCanvas('tex-vignette', 960, 540);
  if (vignette) {
    const ctx = vignette.getContext();
    const grad = ctx.createRadialGradient(480, 270, 180, 480, 270, 560);
    grad.addColorStop(0, 'rgba(8,14,6,0)');
    grad.addColorStop(1, 'rgba(8,14,6,0.62)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 960, 540);
    vignette.refresh();
  }
}
