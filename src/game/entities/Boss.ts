import * as Phaser from 'phaser';
import { AssetKeys, type EnemyStats } from '../types';
import { BOSS_CONFIG } from '../data/EnemyConfig';
import { BASE_LINE_X } from '../data/PlayerConfig';
import { Enemy } from './Enemy';
import { prefersReducedMotion } from '../ui/Theme';

export class Boss extends Enemy {
  onSummon: ((x: number, y: number) => void) | null = null;
  onAttackBase: ((damage: number) => void) | null = null;
  private summonClock = 0;
  private attackClock = 0;

  constructor(scene: Phaser.Scene, stats: EnemyStats, x: number, y: number, speedMult = 1) {
    super(scene, stats, x, y, AssetKeys.Boss, speedMult);
    this.setDepth(22);
    if (!prefersReducedMotion()) {
      this.setScale(0.4);
      scene.tweens.add({ targets: this, scale: 1, duration: 420, ease: 'Back.easeOut' });
    }
  }

  protected override reachBase(): void {
    this.x = BASE_LINE_X;
  }

  override step(deltaMs: number, timeMs: number): void {
    super.step(deltaMs, timeMs);
    if (!this.alive) {
      return;
    }
    if (this.x <= BASE_LINE_X && this.onAttackBase) {
      this.attackClock -= deltaMs;
      if (this.attackClock <= 0) {
        this.attackClock += BOSS_CONFIG.baseAttackIntervalMs;
        this.onAttackBase(this.stats.damage);
      }
    }
    this.summonClock += deltaMs;
    if (this.summonClock >= BOSS_CONFIG.summonIntervalMs && this.onSummon) {
      this.summonClock -= BOSS_CONFIG.summonIntervalMs;
      this.onSummon(this.x - BOSS_CONFIG.summonOffsetX, this.y - BOSS_CONFIG.summonOffsetY);
      this.onSummon(this.x - BOSS_CONFIG.summonOffsetX, this.y + BOSS_CONFIG.summonOffsetY);
      if (!prefersReducedMotion()) {
        this.scene.tweens.add({ targets: this, scale: 1.12, duration: 140, yoyo: true, ease: 'Quad.easeOut' });
      }
    }
  }
}
