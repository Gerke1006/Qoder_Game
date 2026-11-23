import type { EnemyStats, EnemyType } from '../types';

/**
 * 敌人属性表。
 *
 * 后续所有敌人数值只在这里维护，实体与系统只读取、不写死数字。
 * 数值按 960 宽战场调过：从右侧出生到左侧基地约 820px。
 */
export const ENEMY_CONFIGS: Record<EnemyType, EnemyStats> = {
  grunt: {
    type: 'grunt',
    name: '史莱姆',
    maxHp: 30,
    speed: 42,
    damage: 6,
    goldReward: 3,
    size: 40
  },
  runner: {
    type: 'runner',
    name: '疾行史莱姆',
    maxHp: 18,
    speed: 88,
    damage: 5,
    goldReward: 4,
    size: 32
  },
  boss: {
    type: 'boss',
    name: '史莱姆王',
    maxHp: 380,
    speed: 22,
    damage: 22,
    goldReward: 60,
    size: 92
  }
};

export const BOSS_CONFIG = {
  summonIntervalMs: 6500,
  summonOffsetX: 30,
  summonOffsetY: 46,
  baseAttackIntervalMs: 2000
} as const;

export function getEnemyStats(type: EnemyType): EnemyStats {
  return ENEMY_CONFIGS[type];
}
