import type { RewardOption, UpgradeEffect } from '../types';
import { UiKeys, type UiKey } from '../types';

/**
 * 奖励池。
 *
 * 每一项只描述"效果是什么"，不描述"效果怎么生效"：
 * - RewardSystem 负责从本表挑选候选；
 * - UpgradeSystem 负责把 effect 作用到 GameState。
 * 新增奖励只需往本数组追加一条，不需要改动系统逻辑。
 */
export const REWARD_CONFIGS: RewardOption[] = [
  {
    id: 'repair-plate',
    title: '维修装甲',
    description: '基地生命上限 +25，并立即恢复 25 点。',
    rarity: 'common',
    effect: { kind: 'baseHp', value: 25 }
  },
  {
    id: 'gold-cache',
    title: '补给箱',
    description: '立即获得 40 金币。',
    rarity: 'common',
    effect: { kind: 'gold', value: 40 }
  },
  {
    id: 'sharpened-tips',
    title: '硬化弹头',
    description: '所有攻击伤害 +6。',
    rarity: 'common',
    effect: { kind: 'damage', value: 6 }
  },
  {
    id: 'quick-draw',
    title: '速射护腕',
    description: '射速 +0.6 发/秒。',
    rarity: 'common',
    effect: { kind: 'speed', value: 0.6 }
  },
  {
    id: 'oak-heart',
    title: '橡木之心',
    description: '基地生命上限 +50，并立即恢复 50 点。',
    rarity: 'rare',
    effect: { kind: 'baseHp', value: 50 }
  },
  {
    id: 'war-horn',
    title: '战争号角',
    description: '所有攻击伤害 +14。',
    rarity: 'rare',
    effect: { kind: 'damage', value: 14 }
  },
  {
    id: 'wind-feather',
    title: '风之羽',
    description: '射速 +1.2 发/秒。',
    rarity: 'rare',
    effect: { kind: 'speed', value: 1.2 }
  },
  {
    id: 'dragon-hoard',
    title: '龙之宝库',
    description: '立即获得 120 金币。',
    rarity: 'epic',
    effect: { kind: 'gold', value: 120 }
  },
  {
    id: 'sun-blessing',
    title: '烈日祝福',
    description: '所有攻击伤害 +22。',
    rarity: 'epic',
    effect: { kind: 'damage', value: 22 }
  }
];

/** 每次结算时展示几个候选奖励。 */
export const REWARD_OFFER_COUNT = 3;

/** 效果类型 → 展示图标，供奖励卡与强化记录共用。 */
export function rewardIcon(effect: UpgradeEffect): UiKey {
  switch (effect.kind) {
    case 'baseHp':
      return UiKeys.IconDefense;
    case 'gold':
      return UiKeys.IconGold;
    case 'damage':
      return UiKeys.IconDamage;
    case 'speed':
      return UiKeys.IconSpeed;
  }
}

/** 稀有度 → 卡框资源。 */
export function rarityFrame(rarity: RewardOption['rarity']): UiKey {
  switch (rarity) {
    case 'common':
      return UiKeys.FrameCommon;
    case 'rare':
      return UiKeys.FrameRare;
    case 'epic':
      return UiKeys.FrameEpic;
  }
}

export const RARITY_LABEL: Record<RewardOption['rarity'], string> = {
  common: '普通',
  rare: '稀有',
  epic: '史诗'
};
