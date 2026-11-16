import * as Phaser from 'phaser';
import { AssetKeys } from '../types';

/**
 * 弹道实体。
 *
 * 职责：只做"自身飞行"——按速度推进、越界自毁。
 * 命中判定与伤害计算属于 CombatSystem，本类不认识 Enemy，避免实体互相耦合。
 */
export class Projectile extends Phaser.GameObjects.Image {
  velocity = new Phaser.Math.Vector2(0, 0);
  /** 命中时造成的基础伤害，最终伤害由 CombatSystem 叠加本局加成。 */
  damage = 10;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, AssetKeys.Projectile);
    scene.add.existing(this);
  }

  /** 由场景的 update 调用，deltaMs 为帧间隔。 */
  step(deltaMs: number): void {
    this.x += (this.velocity.x * deltaMs) / 1000;
    this.y += (this.velocity.y * deltaMs) / 1000;

    const { width, height } = this.scene.scale;
    if (this.x < -32 || this.x > width + 32 || this.y < -32 || this.y > height + 32) {
      this.destroy();
    }
  }
}
