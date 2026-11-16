import type { RewardOption } from '../types';
import {
  addAttackDamageBonus,
  addGold,
  getRunState,
  healBase,
  recordReward,
  setBaseMaxHp
} from '../state/GameState';

/**
 * 升级系统：把一项已选奖励真正作用到 GameState。
 *
 * 边界：这是全项目唯一允许写"奖励效果如何生效"的地方。
 * RewardSystem 负责挑，UpgradePanel 负责问，UpgradeSystem 负责改状态；
 * 新增 effect 类型时只需在这里补一个分支，不要散落到场景或 UI 中。
 */
export function applyReward(reward: RewardOption): void {
  const { effect } = reward;

  switch (effect.kind) {
    case 'baseHp': {
      setBaseMaxHp(getRunState().baseMaxHp + effect.value);
      healBase(effect.value);
      break;
    }
    case 'gold': {
      addGold(effect.value);
      break;
    }
    case 'damage': {
      addAttackDamageBonus(effect.value);
      break;
    }
  }

  recordReward(reward.id);
}
