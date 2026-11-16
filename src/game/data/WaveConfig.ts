import type { WaveDefinition } from '../types';

/**
 * 波次表：一局 = 数组的一项，按顺序推进。
 *
 * 波次数量与敌人构成都在这里改，WaveSystem 只负责按表生成，不含任何具体数字。
 */
export const WAVE_CONFIGS: readonly WaveDefinition[] = [
  {
    index: 0,
    label: '第 1 波',
    spawns: { grunt: 5 },
    spawnIntervalMs: 900,
    breakMs: 4000
  },
  {
    index: 1,
    label: '第 2 波',
    spawns: { grunt: 6, runner: 3 },
    spawnIntervalMs: 800,
    breakMs: 4000
  },
  {
    index: 2,
    label: '首领波',
    spawns: { grunt: 4, boss: 1 },
    spawnIntervalMs: 1000,
    breakMs: 0
  }
];

export const TOTAL_WAVES = WAVE_CONFIGS.length;
