import type { Difficulty } from '../types';

/** 难度系数：只影响敌人与基地，不改变奖励池。 */
export interface DifficultyProfile {
  label: string;
  description: string;
  enemyHpMult: number;
  enemySpeedMult: number;
  baseHp: number;
}

export const DIFFICULTY_CONFIGS: Record<Difficulty, DifficultyProfile> = {
  easy: {
    label: '轻松',
    description: '敌人更脆更慢，基地 130 血',
    enemyHpMult: 0.75,
    enemySpeedMult: 0.85,
    baseHp: 130
  },
  normal: {
    label: '标准',
    description: '设计基准难度，基地 100 血',
    enemyHpMult: 1,
    enemySpeedMult: 1,
    baseHp: 100
  },
  hard: {
    label: '困难',
    description: '敌人更硬更快，基地 80 血',
    enemyHpMult: 1.35,
    enemySpeedMult: 1.15,
    baseHp: 80
  }
};

export const DIFFICULTY_ORDER: Difficulty[] = ['easy', 'normal', 'hard'];
