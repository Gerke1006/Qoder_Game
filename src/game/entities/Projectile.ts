import * as Phaser from 'phaser';
import { AssetKeys, DESIGN_SIZE } from '../types';

/**
 * 弹道实体：只做自身飞行与越界自毁。
 * 命中判定与伤害计算属于 BattleScene + CombatSystem，本类不认识 Enemy。
 */
export class Projectile extends Phaser.GameObjects.Image {
  velocity = new Phaser.Math.Vector2(0, 0);
  /** 命中时造成的基础伤害，最终伤害由 CombatSystem 叠加本局加成与暴击。 */
  damage = 10;
  /** 轻微追踪：让按住连射能咬住移动目标；目标死亡后弹道保持直线。 */
  target: { x: number; y: number; alive: boolean } | null = null;
  private turnRate = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, damage: number) {
    super(scene, x, y, AssetKeys.Projectile);
    this.damage = damage;
    scene.add.existing(this);
    this.setDepth(26);
  }

  launch(angle: number, speed: number, turnRate = 0): void {
    this.velocity.set(Math.cos(angle) * speed, Math.sin(angle) * speed);
    this.turnRate = turnRate;
    this.setRotation(angle);
  }

  step(deltaMs: number): void {
    if (this.target && this.target.alive && this.turnRate > 0) {
      const desired = Phaser.Math.Angle.Between(this.x, this.y, this.target.x, this.target.y);
      const current = this.velocity.angle();
      const delta = Phaser.Math.Angle.Wrap(desired - current);
      const maxTurn = (this.turnRate * deltaMs) / 1000;
      const next = current + Phaser.Math.Clamp(delta, -maxTurn, maxTurn);
      const speed = this.velocity.length();
      this.velocity.set(Math.cos(next) * speed, Math.sin(next) * speed);
      this.setRotation(next);
    }
    this.x += (this.velocity.x * deltaMs) / 1000;
    this.y += (this.velocity.y * deltaMs) / 1000;
    if (this.x < -40 || this.x > DESIGN_SIZE.width + 40 || this.y < -40 || this.y > DESIGN_SIZE.height + 40) {
      this.destroy();
    }
  }
}
