import * as Phaser from 'phaser';
import { AssetKeys, DESIGN_SIZE } from '../types';

// 弹体只计算飞行与轨迹相交，目标选择、伤害和回收由场景结算。
export class Projectile extends Phaser.GameObjects.Image {
  velocity = new Phaser.Math.Vector2(0, 0);
  /** 命中时造成的基础伤害，最终伤害由 CombatSystem 叠加本局加成与暴击。 */
  damage = 10;
  /** 轻微追踪：让按住连射能咬住移动目标；目标死亡后弹道保持直线。 */
  target: { x: number; y: number; alive: boolean } | null = null;
  previousX: number;
  previousY: number;
  private turnRate = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, damage: number) {
    super(scene, x, y, AssetKeys.Projectile);
    this.previousX = x;
    this.previousY = y;
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
    this.previousX = this.x;
    this.previousY = this.y;
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
  }

  // 返回本帧线段首次进入圆形碰撞区的位置比例，避免高速弹跨过目标。
  hitFraction(target: { x: number; y: number }, radius: number): number | null {
    const dx = this.x - this.previousX;
    const dy = this.y - this.previousY;
    const ox = this.previousX - target.x;
    const oy = this.previousY - target.y;
    const c = ox * ox + oy * oy - radius * radius;
    if (c <= 0) return 0;
    const a = dx * dx + dy * dy;
    if (a === 0) return null;
    const b = ox * dx + oy * dy;
    const discriminant = b * b - a * c;
    if (discriminant < 0) return null;
    const fraction = (-b - Math.sqrt(discriminant)) / a;
    return fraction >= 0 && fraction <= 1 ? fraction : null;
  }

  // 场景必须先结算沿途命中，再回收已越界的弹体。
  get outOfBounds(): boolean {
    return this.x < -40 || this.x > DESIGN_SIZE.width + 40 || this.y < -40 || this.y > DESIGN_SIZE.height + 40;
  }
}
