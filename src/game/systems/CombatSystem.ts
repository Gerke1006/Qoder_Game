import type { Damageable } from '../types';
import { getRunState } from '../state/GameState';

/**
 * 战斗系统：伤害的"计算与结算"。
 *
 * 边界：不认识 Phaser 对象类型，只依赖 Damageable 接口；
 * 碰撞检测、发射时机由 BattleScene 负责，本系统只提供纯函数。
 */

export const CRIT_CHANCE = 0.15;
export const CRIT_MULTIPLIER = 2;

export function resolveBaseDamage(baseDamage: number): number {
  return Math.max(1, Math.round(baseDamage - getRunState().baseDefense));
}

export interface DamageRoll {
  amount: number;
  crit: boolean;
}

/** 基础伤害 + 本局升级加成。 */
export function resolveDamage(baseDamage: number): number {
  return Math.max(1, Math.round(baseDamage + getRunState().attackDamageBonus));
}

/** 掷一次伤害，含暴击判定；飘字样式由 crit 决定。 */
export function rollDamage(baseDamage: number): DamageRoll {
  const crit = Math.random() < CRIT_CHANCE;
  const amount = resolveDamage(baseDamage) * (crit ? CRIT_MULTIPLIER : 1);
  return { amount, crit };
}

/** 对任意可受伤对象结算一次伤害；调用方负责判断"是否命中"。 */
export function applyDamage(target: Damageable, baseDamage: number): DamageRoll {
  if (!target.alive) {
    return { amount: 0, crit: false };
  }
  const roll = rollDamage(baseDamage);
  target.takeDamage(roll.amount);
  return roll;
}
