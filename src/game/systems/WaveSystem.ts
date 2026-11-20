import type { EnemyType } from '../types';
import { WAVE_CONFIGS } from '../data/WaveConfig';

/**
 * 波次系统：把 data/WaveConfig 的表读成"本波该生成哪些敌人"。
 *
 * 边界：只做数据展开与推进判定，不创建实体、不持有 Phaser 引用。
 * 真正的定时生成（timeline / timer）由 BattleScene 调用本模块的结果来执行。
 */

/** 把某一波的 spawns 展开成生成序列：小怪混编打散，首领压轴。 */
export function buildSpawnQueue(waveIndex: number): EnemyType[] {
  const wave = WAVE_CONFIGS[waveIndex];
  if (!wave) {
    return [];
  }

  const queue: EnemyType[] = [];
  let bossCount = 0;
  for (const [type, count] of Object.entries(wave.spawns)) {
    const enemyType = type as EnemyType;
    const total = count ?? 0;
    if (enemyType === 'boss') {
      bossCount = total;
      continue;
    }
    for (let i = 0; i < total; i++) {
      queue.push(enemyType);
    }
  }

  for (let i = queue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }
  for (let i = 0; i < bossCount; i++) {
    queue.push('boss');
  }
  return queue;
}

/** 本波配置的准备时间（毫秒）。 */
export function getBreakMs(waveIndex: number): number {
  return WAVE_CONFIGS[waveIndex]?.breakMs ?? 0;
}

/** 波次序号是否已经越界，用于 BattleScene 判断"全部打完"。 */
export function isLastWave(waveIndex: number): boolean {
  return waveIndex >= WAVE_CONFIGS.length - 1;
}
