import * as Phaser from 'phaser';
import { AssetKeys, type EnemyStats } from '../types';
import { Enemy } from './Enemy';

/**
 * 首领敌人：体型与数值来自配置，额外行为是周期性召唤小怪压线。
 * 召唤只通过回调通知场景生成实体，本类不直接 new Enemy，避免实体互相耦合。
 */
export class Boss extends Enemy {
  onSummon: ((x: number, y: number) => void) | null = null;
  private summonClock = 0;

  constructor(scene: Phaser.Scene, stats: EnemyStats, x: number, y: number, speedMult = 1) {
    super(scene, stats, x, y, AssetKeys.Boss, speedMult);
    this.setDepth(22);
    this.setScale(0.4);
    scene.tweens.add({ targets: this, scale: 1, duration: 420, ease: 'Back.easeOut' });
  }

  override step(deltaMs: number, timeMs: number): void {
    super.step(deltaMs, timeMs);
    if (!this.alive || !this.onSummon) {
      return;
    }
    this.summonClock += deltaMs;
    if (this.summonClock >= 6500) {
      this.summonClock = 0;
      this.onSummon(this.x - 30, this.y - 46);
      this.onSummon(this.x - 30, this.y + 46);
      this.scene.tweens.add({ targets: this, scale: 1.12, duration: 140, yoyo: true, ease: 'Quad.easeOut' });
    }
  }
}
