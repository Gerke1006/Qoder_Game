import type { Difficulty, RunState, RunSummary } from '../types';
import { TOTAL_WAVES } from '../data/WaveConfig';
import { DIFFICULTY_CONFIGS } from '../data/DifficultyConfig';

/**
 * 一局游戏的共享运行状态。
 *
 * 职责边界：
 * - 这里只做"状态的读写"，不含任何玩法判断、不含 Phaser 依赖，因此 systems / ui / scenes 都可以安全导入。
 * - 需要跨场景传递的数据一律走这里，不要用场景间 data 参数散落传递。
 * - 不做存档；最佳纪录由 ui/BestRecord 单独存 localStorage，与一局状态解耦。
 */

function createInitialRunState(difficulty: Difficulty): RunState {
  const baseHp = DIFFICULTY_CONFIGS[difficulty].baseHp;
  return {
    phase: 'idle',
    difficulty,
    currentWave: -1,
    totalWaves: TOTAL_WAVES,
    baseHp,
    baseMaxHp: baseHp,
    baseDefense: 0,
    gold: 0,
    kills: 0,
    elapsedMs: 0,
    attackDamageBonus: 0,
    fireRateBonus: 0,
    takenRewardIds: []
  };
}

const runState: RunState = createInitialRunState('normal');

/** 读取当前状态；调用方只应把返回值用于展示或计算，不要绕过下面的 mutator 直接改。 */
export function getRunState(): RunState {
  return runState;
}

/** 每局开始前重置，MainMenuScene / 结算重开时调用。 */
export function resetRun(difficulty: Difficulty = runState.difficulty): void {
  Object.assign(runState, createInitialRunState(difficulty));
}

export function setDifficulty(difficulty: Difficulty): void {
  runState.difficulty = difficulty;
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

export function addKill(): void {
  runState.kills += 1;
}

/** 累计本局用时；BattleScene 每帧传入 delta，暂停时不调用。 */
export function addElapsed(deltaMs: number): void {
  runState.elapsedMs += deltaMs;
}

/** 基地受伤，血量下限为 0；是否失败由调用方判断。 */
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

export function addBaseDefense(amount: number): void {
  runState.baseDefense += amount;
}

export function addAttackDamageBonus(amount: number): void {
  runState.attackDamageBonus += amount;
}

export function addFireRateBonus(amount: number): void {
  runState.fireRateBonus += amount;
}

/** 记录本局已获得的奖励 id，供结算面板与后续去重使用。 */
export function recordReward(rewardId: string): void {
  if (!runState.takenRewardIds.includes(rewardId)) {
    runState.takenRewardIds.push(rewardId);
  }
}

/** 结算快照：ResultScene 只读这份数据，不再依赖战斗场景的存活对象。 */
export function getRunSummary(win: boolean): RunSummary {
  return {
    win,
    wave: runState.currentWave,
    totalWaves: runState.totalWaves,
    kills: runState.kills,
    gold: runState.gold,
    elapsedMs: runState.elapsedMs,
    takenRewardIds: [...runState.takenRewardIds]
  };
}
