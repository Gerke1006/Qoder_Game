import type { WaveDefinition } from '../types';

/**
 * 波次表：一局 = 数组的一项，按顺序推进。
 *
 * 难度曲线：1-2 波教学密度，3 波混编提速，4 波高压，5 波首领。
 * 波次数量与敌人构成都在这里改，WaveSystem 只负责按表生成。
 */
export const WAVE_CONFIGS: readonly WaveDefinition[] = [
  {
    index: 0,
    label: '第 1 波',
    spawns: { grunt: 5 },
    spawnIntervalMs: 1100,
    breakMs: 4000
  },
  {
    index: 1,
    label: '第 2 波',
    spawns: { grunt: 6, runner: 2 },
    spawnIntervalMs: 950,
    breakMs: 4000
  },
  {
    index: 2,
    label: '第 3 波',
    spawns: { grunt: 7, runner: 5 },
    spawnIntervalMs: 800,
    breakMs: 4500
  },
  {
    index: 3,
    label: '第 4 波',
    spawns: { grunt: 9, runner: 7 },
    spawnIntervalMs: 650,
    breakMs: 5000
  },
  {
    index: 4,
    label: '首领波',
    spawns: { grunt: 6, runner: 4, boss: 1 },
    spawnIntervalMs: 900,
    breakMs: 0
  }
];

export const TOTAL_WAVES = WAVE_CONFIGS.length;
