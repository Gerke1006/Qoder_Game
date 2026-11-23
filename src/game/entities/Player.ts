import * as Phaser from 'phaser';
import { AssetKeys } from '../types';
import { prefersReducedMotion } from '../ui/Theme';

/**
 * 玩家实体：林地弓手。
 *
 * 只负责形象与瞄准/后坐表现；开火时机、命中与伤害由 BattleScene + CombatSystem 决定。
 * 玩家本身不承伤——防守目标是基地，血量在 GameState.baseHp。
 */
export class Player extends Phaser.GameObjects.Container {
  private sprite: Phaser.GameObjects.Image;
  private baseY: number;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    this.baseY = y;
    this.sprite = scene.add.image(0, 0, AssetKeys.Player);
    this.add(this.sprite);
    scene.add.existing(this);
    this.setDepth(24);
  }

  aimAt(x: number, y: number): void {
    const angle = Phaser.Math.Angle.Between(this.x, this.y, x, y);
    this.sprite.setRotation(Phaser.Math.Clamp(angle, -0.7, 0.7) * 0.55);
  }

  recoil(): void {
    if (prefersReducedMotion()) return;
    this.scene.tweens.add({
      targets: this.sprite,
      x: -5,
      duration: 60,
      yoyo: true,
      ease: 'Quad.easeOut'
    });
  }

  idle(timeMs: number): void {
    this.y = this.baseY + (prefersReducedMotion() ? 0 : Math.sin(timeMs * 0.0022) * 2.5);
  }
}
