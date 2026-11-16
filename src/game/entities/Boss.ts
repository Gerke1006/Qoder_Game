import * as Phaser from 'phaser';
import { AssetKeys, type EnemyStats } from '../types';
import { Enemy } from './Enemy';

/**
 * 首领敌人。
 *
 * 与 Enemy 的差异只有纹理与（后续的）阶段行为；数值仍然来自 data/EnemyConfig，
 * 因此这里不重复定义任何属性。首领技能请写在新增方法里，不要扩散到 BattleScene。
 */
export class Boss extends Enemy {
  constructor(scene: Phaser.Scene, stats: EnemyStats, x: number, y: number) {
    super(scene, stats, x, y, AssetKeys.Boss);
  }
}
