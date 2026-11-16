import * as Phaser from 'phaser';
import { AssetKeys } from '../types';
import type { Damageable, EnemyStats } from '../types';

/**
 * 普通敌人实体。
 *
 * 职责：承载一个敌人的外观与生命，数值一律来自 data/EnemyConfig，
 * 构造函数不写死任何属性数字。
 *
 * 后续移动、寻路、撞基地的行为加在 update 相关方法里，
 * 击杀奖励由 WaveSystem / RewardSystem 依据 `stats` 处理，不要写进本类。
 */
export class Enemy extends Phaser.GameObjects.Container implements Damageable {
  readonly stats: EnemyStats;
  hp: number;
  readonly maxHp: number;
  alive = true;

  constructor(
    scene: Phaser.Scene,
    stats: EnemyStats,
    x: number,
    y: number,
    textureKey: string = AssetKeys.Enemy
  ) {
    super(scene, x, y);
    this.stats = stats;
    this.maxHp = stats.maxHp;
    this.hp = stats.maxHp;

    this.add(scene.add.image(0, 0, textureKey));
    scene.add.existing(this);
  }

  /** 击杀时发放的金币，供 RewardSystem 使用。 */
  get goldReward(): number {
    return this.stats.goldReward;
  }

  takeDamage(amount: number): void {
    if (!this.alive) {
      return;
    }
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp === 0) {
      this.alive = false;
      this.destroy();
    }
  }
}
