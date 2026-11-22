import * as Phaser from 'phaser';
import { REWARD_CONFIGS, RARITY_LABEL, rewardIcon } from '../data/RewardConfig';
import { inkStyle, Palette, RARITY_COLOR } from './Theme';

/**
 * 强化记录面板：把本局已选奖励按获得顺序列成图标行。
 * 结算与暂停共用同一份展示逻辑，避免两处各写一套。
 */
export function createUpgradeSummary(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  takenIds: string[]
): Phaser.GameObjects.Container {
  const rows: Phaser.GameObjects.GameObject[] = [];
  const header = scene.add.text(0, 0, `本局强化 · ${takenIds.length}`, inkStyle(17, true)).setOrigin(0, 0.5);
  rows.push(header);

  if (takenIds.length === 0) {
    rows.push(scene.add.text(0, 30, '尚未获得强化', { ...inkStyle(14), color: Palette.inkSoft }).setOrigin(0, 0.5));
  }

  takenIds.forEach((id, i) => {
    const reward = REWARD_CONFIGS.find((item) => item.id === id);
    if (!reward) {
      return;
    }
    const rowY = 24 + i * 22;
    const icon = scene.add.image(14, rowY, rewardIcon(reward.effect)).setDisplaySize(22, 22);
    const title = scene.add.text(34, rowY, reward.title, inkStyle(15, true)).setOrigin(0, 0.5);
    const rarity = scene.add
      .text(width, rowY, RARITY_LABEL[reward.rarity], { ...inkStyle(13, true), color: RARITY_COLOR[reward.rarity] })
      .setOrigin(1, 0.5);
    rows.push(icon, title, rarity);
  });

  return scene.add.container(x, y, rows);
}
