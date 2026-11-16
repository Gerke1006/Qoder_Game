import type { EnemyStats, EnemyType } from '../types';

/**
 * 敌人属性表。
 *
 * 后续所有敌人数值只在这里维护，实体与系统只读取、不写死数字。
 */
export const ENEMY_CONFIGS: Record<EnemyType, EnemyStats> = {
  grunt: {
    type: 'grunt',
    name: '小兵',
    maxHp: 30,
    speed: 40,
    damage: 5,
    goldReward: 3,
    size: 28
  },
  runner: {
    type: 'runner',
    name: '疾行者',
    maxHp: 18,
    speed: 90,
    damage: 3,
    goldReward: 4,
    size: 22
  },
  boss: {
    type: 'boss',
    name: '首领',
    maxHp: 400,
    speed: 25,
    damage: 20,
    goldReward: 50,
    size: 64
  }
};

export function getEnemyStats(type: EnemyType): EnemyStats {
  return ENEMY_CONFIGS[type];
}
