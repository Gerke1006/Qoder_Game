import type { RunState } from '../types';
import { TOTAL_WAVES } from '../data/WaveConfig';

/**
 * 一局游戏的共享运行状态。
 *
 * 职责边界：
 * - 这里只做"状态的读写"，不含任何玩法判断、不含 Phaser 依赖，因此 systems / ui / scenes 都可以安全导入。
 * - 需要跨场景传递的数据一律走这里，不要用场景间 data 参数散落传递。
 * - 不做存档、不做全局状态框架；将来需要持久化时再在本文件外层加一层。
 */

const INITIAL_BASE_MAX_HP = 100;
const INITIAL_GOLD = 0;

function createInitialRunState(): RunState {
  return {
    phase: 'idle',
    currentWave: -1,
    totalWaves: TOTAL_WAVES,
    baseHp: INITIAL_BASE_MAX_HP,
    baseMaxHp: INITIAL_BASE_MAX_HP,
    gold: INITIAL_GOLD,
    attackDamageBonus: 0,
    takenRewardIds: []
  };
}

const runState: RunState = createInitialRunState();

/** 读取当前状态；调用方只应把返回值用于展示或计算，不要绕过下面的 mutator 直接改。 */
export function getRunState(): RunState {
  return runState;
}

/** 每局开始前重置，MainMenuScene 进入战斗时调用。 */
export function resetRun(): void {
  Object.assign(runState, createInitialRunState());
}

export function setPhase(phase: RunState['phase']): void {
  runState.phase = phase;
}

export function setCurrentWave(index: number): void {
  runState.currentWave = index;
}

export function addGold(amount: number): void {
  runState.gold = Math.max(0, runState.gold + amount);
}

/** 基地受伤，血量下限为 0；是否失败由调用方（BattleScene / WaveSystem）判断。 */
export function damageBase(amount: number): void {
  runState.baseHp = Math.max(0, runState.baseHp - amount);
}

export function healBase(amount: number): void {
  runState.baseHp = Math.min(runState.baseMaxHp, runState.baseHp + amount);
}

export function setBaseMaxHp(value: number): void {
  runState.baseMaxHp = value;
  runState.baseHp = Math.min(runState.baseHp, value);
}

/** 累加本局伤害加成（升级类奖励）。 */
export function addAttackDamageBonus(amount: number): void {
  runState.attackDamageBonus += amount;
}

/** 记录本局已获得的奖励 id，供结算面板与后续去重使用。 */
export function recordReward(rewardId: string): void {
  if (!runState.takenRewardIds.includes(rewardId)) {
    runState.takenRewardIds.push(rewardId);
  }
}
