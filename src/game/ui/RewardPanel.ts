import * as Phaser from 'phaser';
import type { RewardOption } from '../types';
import { DESIGN_SIZE } from '../types';

/**
 * 奖励选择面板：展示 RewardSystem 给出的候选，并把玩家的选择回调出去。
 *
 * 职责边界：面板不做挑选逻辑（RewardSystem）、不写状态（UpgradeSystem），
 * 只知道"有哪些候选、用户点了哪个"。
 *
 * 尚未接入战斗流程：等战斗与波次跑通后，由 BattleScene 在波次结束处
 * `panel.show(rollRewards(), (reward) => { applyReward(reward); panel.hide(); })`。
 */
export class RewardPanel {
  private readonly container: Phaser.GameObjects.Container;
  private readonly optionTexts: Phaser.GameObjects.Text[] = [];

  constructor(private readonly scene: Phaser.Scene) {
    this.container = scene.add.container(0, 0).setVisible(false);

    const dim = scene.add
      .rectangle(DESIGN_SIZE.width / 2, DESIGN_SIZE.height / 2, DESIGN_SIZE.width, DESIGN_SIZE.height, 0x000000, 0.65)
      .setInteractive();
    this.container.add(dim);
    this.container.add(
      scene.add.text(DESIGN_SIZE.width / 2, 110, '选择一项强化', {
        fontFamily: 'system-ui, "Microsoft YaHei", sans-serif',
        fontSize: '32px',
        color: '#e6e9ef'
      }).setOrigin(0.5)
    );
  }

  get visible(): boolean {
    return this.container.visible;
  }

  /** 渲染候选并开启交互；onPick 在玩家点击某一项后触发。 */
  show(options: RewardOption[], onPick: (reward: RewardOption) => void): void {
    this.clearOptions();

    const step = 72;
    const startY = 190;

    options.forEach((reward, index) => {
      const text = this.scene.add
        .text(DESIGN_SIZE.width / 2, startY + index * step, `${reward.title} — ${reward.description}`, {
          fontFamily: 'system-ui, "Microsoft YaHei", sans-serif',
          fontSize: '20px',
          color: '#e6e9ef',
          backgroundColor: '#2b3446',
          padding: { x: 18, y: 10 }
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      text.on('pointerdown', () => onPick(reward));
      this.optionTexts.push(text);
      this.container.add(text);
    });

    this.container.setVisible(true);
    this.container.setDepth(100);
  }

  hide(): void {
    this.clearOptions();
    this.container.setVisible(false);
  }

  private clearOptions(): void {
    for (const text of this.optionTexts) {
      text.destroy();
    }
    this.optionTexts.length = 0;
  }
}
