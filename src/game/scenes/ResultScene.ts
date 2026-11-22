import * as Phaser from 'phaser';
import { DESIGN_SIZE, SceneKeys, UiKeys, type RunSummary } from '../types';
import { DIFFICULTY_CONFIGS } from '../data/DifficultyConfig';
import { getRunState, resetRun, setPhase } from '../state/GameState';
import { audio } from '../systems/AudioSystem';
import { formatTime, submitWin } from '../utils/BestRecord';
import { createForestBackground } from '../ui/ForestBackground';
import { createArtButton } from '../ui/Button';
import { createPanel, inkStyle, Palette, prefersReducedMotion } from '../ui/Theme';
import { createUpgradeSummary } from '../ui/UpgradePanel';

/**
 * 结算场景：胜负横幅 + 图标统计 + 本局强化 + 重开 / 回菜单。
 * 只消费 BattleScene 传来的 RunSummary 快照，不依赖战斗场景存活对象。
 */
export class ResultScene extends Phaser.Scene {
  private summary!: RunSummary;

  constructor() {
    super(SceneKeys.Result);
  }

  init(summary: RunSummary): void {
    this.summary = summary;
  }

  create(): void {
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanUp());
    createForestBackground(this);

    const cx = DESIGN_SIZE.width / 2;
    createPanel(this, cx, 228, 720, 420);
    const title = this.add
      .text(cx, 96, this.summary.win ? '守卫成功！' : '基地陷落…', inkStyle(40, true))
      .setOrigin(0.5);
    title.setColor(this.summary.win ? Palette.leaf : Palette.danger);
    this.add
      .text(cx, 134, `${DIFFICULTY_CONFIGS[getRunState().difficulty].label}难度 · ${this.summary.win ? '五波全清' : `止步第 ${Math.max(1, this.summary.wave + 1)} 波`}`, {
        ...inkStyle(15),
        color: Palette.inkSoft
      })
      .setOrigin(0.5);

    const stats: Array<[string, string, string]> = [
      [UiKeys.IconWave, '抵达波次', `${Math.max(0, this.summary.wave + 1)} / ${this.summary.totalWaves}`],
      [UiKeys.IconDamage, '击杀敌人', `${this.summary.kills}`],
      [UiKeys.IconGold, '累计金币', `${this.summary.gold}`],
      [UiKeys.IconTime, '守卫用时', formatTime(this.summary.elapsedMs)]
    ];
    stats.forEach(([icon, label, value], i) => {
      const x = cx - 190 + (i % 2) * 250;
      const y = 182 + Math.floor(i / 2) * 44;
      this.add.image(x, y, icon).setDisplaySize(30, 30);
      this.add.text(x + 24, y, label, { ...inkStyle(14), color: Palette.inkSoft }).setOrigin(0, 0.5);
      this.add.text(x + 150, y, value, inkStyle(17, true)).setOrigin(0, 0.5);
    });

    const summary = createUpgradeSummary(this, cx - 250, 272, 500, this.summary.takenRewardIds);
    summary.setDepth(2);

    if (this.summary.win) {
      const isRecord = submitWin(this.summary, getRunState().difficulty);
      if (isRecord) {
        const badge = this.add
          .text(cx + 250, 92, '新纪录！', { ...inkStyle(20, true), color: Palette.gold })
          .setOrigin(0.5)
          .setAngle(-8);
        if (!prefersReducedMotion()) {
          this.tweens.add({ targets: badge, scale: 1.15, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        }
      }
    }

    createArtButton(this, cx - 130, 490, '再来一局', () => this.restart(), { width: 240, height: 50, fontSize: 20 });
    createArtButton(this, cx + 130, 490, '返回主菜单', () => this.toMenu(), { width: 240, height: 50, fontSize: 20 });

    this.input.keyboard?.on('keydown-ESC', this.toMenu, this);
    this.input.keyboard?.on('keydown-ENTER', this.restart, this);
  }

  private restart(): void {
    audio.play('click');
    resetRun(getRunState().difficulty);
    setPhase('battle');
    this.scene.start(SceneKeys.Battle);
  }

  private toMenu(): void {
    audio.play('click');
    setPhase('idle');
    this.scene.start(SceneKeys.MainMenu);
  }

  private cleanUp(): void {
    this.input.keyboard?.off('keydown-ESC', this.toMenu, this);
    this.input.keyboard?.off('keydown-ENTER', this.restart, this);
  }
}
