import * as Phaser from 'phaser';
import { AssetKeys } from '../types';
import type { Damageable } from '../types';

/**
 * 玩家实体占位。
 *
 * 职责：只负责"玩家形象 + 玩家自身生命"。
 * 不负责：开火与命中判定（CombatSystem）、波次推进（WaveSystem）、
 * 奖励结算（RewardSystem / UpgradeSystem）。
 *
 * 后续把移动输入与射击行为加在这个类上即可，场景代码不需要改动。
 */
export class Player extends Phaser.GameObjects.Container implements Damageable {
  hp: number;
  readonly maxHp: number;
  alive = true;

  constructor(scene: Phaser.Scene, x: number, y: number, maxHp = 100) {
    super(scene, x, y);
    this.maxHp = maxHp;
    this.hp = maxHp;

    this.add(scene.add.image(0, 0, AssetKeys.Player));
    scene.add.existing(this);
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
