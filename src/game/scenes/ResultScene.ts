import * as Phaser from 'phaser';
import { AssetKeys, DESIGN_SIZE, SceneKeys, TitleKeys, UiKeys, type RunSummary } from '../types';
import { DIFFICULTY_CONFIGS } from '../data/DifficultyConfig';
import { getRunState, resetRun, setPhase } from '../state/GameState';
import { audio } from '../systems/AudioSystem';
import { formatTime, submitWin } from '../utils/BestRecord';
import { createForestBackground } from '../ui/ForestBackground';
import { createArtButton } from '../ui/Button';
import { createArtHeading, createPanel, creamStyle, inkStyle, Palette, prefersReducedMotion } from '../ui/Theme';
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
    audio.setMood(this.summary.win ? 'victory' : 'defeat');
    audio.setPaused(false);
    createForestBackground(this);

    const cx = DESIGN_SIZE.width / 2;
    createPanel(this, cx, 228, 720, 420);
    createArtHeading(this, cx, 90, this.summary.win ? TitleKeys.Victory : TitleKeys.Defeat, 310, 82);
    this.add
      .text(cx, 144, `${DIFFICULTY_CONFIGS[getRunState().difficulty].label}难度 · ${this.summary.win ? '五波全清' : `止步第 ${Math.max(1, this.summary.wave + 1)} 波`}`, {
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
        createArtHeading(this, cx + 250, 92, TitleKeys.Record, 105, 40);
      }
      if (!prefersReducedMotion()) {
        this.celebrate();
      }
    } else {
      this.add.text(cx, 446, '重整防线，试试防御与生命强化，再战一局。', creamStyle(13)).setOrigin(0.5);
    }

    createArtButton(this, cx - 130, 490, '再来一局', () => this.restart(), { width: 240, height: 50, fontSize: 20 });
    createArtButton(this, cx + 130, 490, '返回主菜单', () => this.toMenu(), { width: 240, height: 50, fontSize: 20 });
    this.add.text(cx, 527, 'Enter 再来一局 · ESC 返回主菜单', creamStyle(12)).setOrigin(0.5);

    this.input.keyboard?.on('keydown-ESC', this.toMenu, this);
    this.input.keyboard?.on('keydown-ENTER', this.restart, this);
  }

  private celebrate(): void {
    const colors = [Palette.gold, Palette.leaf].map((color) => Phaser.Display.Color.HexStringToColor(color).color);
    for (const x of [128, DESIGN_SIZE.width - 128]) {
      const burst = this.add.particles(x, 138, AssetKeys.Spark, {
        speed: { min: 40, max: 90 },
        angle: { min: 230, max: 310 },
        gravityY: 70,
        lifespan: { min: 900, max: 1500 },
        scale: { start: 0.24, end: 0.06 },
        alpha: { start: 0.7, end: 0 },
        tint: colors,
        emitting: false
      }).setDepth(3);
      burst.explode(14);
      this.time.delayedCall(1600, () => burst.destroy());
    }
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
