import type { Damageable } from '../types';
import { getRunState } from '../state/GameState';

/**
 * 战斗系统：伤害的"计算与结算"。
 *
 * 边界：不认识 Phaser 对象类型，只依赖 Damageable 接口；
 * 碰撞检测、发射时机由 BattleScene（或后续的射击逻辑）负责，本系统只提供纯函数。
 */

/** 基础伤害 + 本局升级加成。 */
export function resolveDamage(baseDamage: number): number {
  return Math.max(1, baseDamage + getRunState().attackDamageBonus);
}

/** 对任意可受伤对象结算一次伤害；调用方负责判断"是否命中"。 */
export function applyDamage(target: Damageable, baseDamage: number): void {
  if (!target.alive) {
    return;
  }
  target.takeDamage(resolveDamage(baseDamage));
}
