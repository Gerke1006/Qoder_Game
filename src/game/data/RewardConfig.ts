import type { RewardOption } from '../types';

/**
 * 奖励池。
 *
 * 每一项只描述"效果是什么"，不描述"效果怎么生效"：
 * - RewardSystem 负责从本表挑选候选奖励；
 * - UpgradeSystem 负责把 effect 作用到 GameState。
 * 新增奖励只需往本数组追加一条，不需要改动系统逻辑。
 */
export const REWARD_CONFIGS: RewardOption[] = [
  {
    id: 'repair-plate',
    title: '维修装甲',
    description: '基地生命上限 +20，并立即恢复 20 点。',
    rarity: 10,
    effect: { kind: 'baseHp', value: 20 }
  },
  {
    id: 'gold-cache',
    title: '补给箱',
    description: '立即获得 30 金币。',
    rarity: 20,
    effect: { kind: 'gold', value: 30 }
  },
  {
    id: 'sharpened-tips',
    title: '硬化弹头',
    description: '所有攻击伤害 +5。',
    rarity: 15,
    effect: { kind: 'damage', value: 5 }
  }
];

/** 每次结算时展示几个候选奖励。 */
export const REWARD_OFFER_COUNT = 3;
