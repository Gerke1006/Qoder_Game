import * as Phaser from 'phaser';
import { REWARD_CONFIGS } from '../data/RewardConfig';

/**
 * 本局强化记录面板。
 *
 * 职责：把"本局已获得哪些强化"渲染成一行行文本，供结算界面查看。
 * 与 RewardPanel 的分工：RewardPanel 负责"选"，UpgradePanel 负责"看结果"，
 * 两者都不改状态——状态的写入只在 UpgradeSystem 里发生。
 */
export class UpgradePanel {
  private readonly lines: Phaser.GameObjects.Text[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly x: number,
    private readonly y: number
  ) {}

  /** 依据已选奖励 id 列表重绘；id 在配置表中找不到时跳过，避免结算界面崩溃。 */
  render(takenRewardIds: readonly string[]): void {
    this.clear();

    this.pushLine('本局强化', 24, '#e6e9ef');

    if (takenRewardIds.length === 0) {
      this.pushLine('（无）', 18, '#8b96ab');
      return;
    }

    for (const id of takenRewardIds) {
      const reward = REWARD_CONFIGS.find((item) => item.id === id);
      if (reward) {
        this.pushLine(`· ${reward.title}`, 18, '#c9d3e4');
      }
    }
  }

  destroy(): void {
    this.clear();
  }

  private pushLine(content: string, fontSize: number, color: string): void {
    const offset = this.lines.length * 28;
    this.lines.push(
      this.scene.add
        .text(this.x, this.y + offset, content, {
          fontFamily: 'system-ui, "Microsoft YaHei", sans-serif',
          fontSize: `${fontSize}px`,
          color
        })
        .setOrigin(0.5)
    );
  }

  private clear(): void {
    for (const line of this.lines) {
      line.destroy();
    }
    this.lines.length = 0;
  }
}
