import type { RewardOption } from '../types';
import { REWARD_CONFIGS, REWARD_OFFER_COUNT } from '../data/RewardConfig';
import { getRunState } from '../state/GameState';

/**
 * 奖励系统：决定"这一轮给玩家看哪几个奖励"。
 *
 * 边界：只产出候选，不修改任何状态。
 * 玩家选定之后，由 UpgradeSystem 负责生效；UI（RewardPanel）只负责展示与回调。
 */

/** 从奖励池中挑选不重复的候选，自动排除本局已获得过的奖励。 */
export function rollRewards(
  count = REWARD_OFFER_COUNT,
  excludeIds: string[] = getRunState().takenRewardIds
): RewardOption[] {
  const pool = REWARD_CONFIGS.filter((reward) => !excludeIds.includes(reward.id));
  const picked: RewardOption[] = [];

  while (picked.length < count && pool.length > 0) {
    const index = Math.floor(Math.random() * pool.length);
    picked.push(pool[index]);
    pool.splice(index, 1);
  }

  return picked;
}
