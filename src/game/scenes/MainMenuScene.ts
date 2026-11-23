import * as Phaser from 'phaser';
import { AssetKeys, DESIGN_SIZE, SceneKeys, TitleKeys, UiKeys, type Difficulty } from '../types';
import { DIFFICULTY_CONFIGS, DIFFICULTY_ORDER } from '../data/DifficultyConfig';
import { getRunState, resetRun, setDifficulty, setPhase } from '../state/GameState';
import { audio } from '../systems/AudioSystem';
import { loadBest, formatTime } from '../utils/BestRecord';
import { createForestBackground } from '../ui/ForestBackground';
import { createArtButton, createTopButton, type ArtButton } from '../ui/Button';
import { createArtHeading, createPanel, creamStyle, inkStyle, Palette, prefersReducedMotion } from '../ui/Theme';

/**
 * 主菜单：林地小景 + 美术标题 + 难度选择 + 开始 / 玩法说明 + 最佳纪录。
 * 难度选择写入 GameState，进入战斗时 resetRun 会按难度初始化基地血量。
 */
export class MainMenuScene extends Phaser.Scene {
  private difficultyButtons = new Map<Difficulty, ArtButton>();
  private descriptionText!: Phaser.GameObjects.Text;
  private muteButton!: ArtButton;
  private howto: Phaser.GameObjects.Container | null = null;
  private howtoKeys: ((event: KeyboardEvent) => void) | null = null;
  private menuKeys: ((event: KeyboardEvent) => void) | null = null;

  constructor() {
    super(SceneKeys.MainMenu);
  }

  create(): void {
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanUp());
    this.difficultyButtons.clear();
    this.howto = null;
    audio.setMood('menu');
    audio.setPaused(false);

    createForestBackground(this);
    this.drawDiorama();

    createArtHeading(this, DESIGN_SIZE.width / 2, 106, TitleKeys.Game, 560, 150);
    this.add
      .text(DESIGN_SIZE.width / 2, 198, 'Roguelite 波次防守 · 守住最后的城堡', creamStyle(16))
      .setOrigin(0.5);
    this.add
      .text(DESIGN_SIZE.width / 2, 222, '五波来袭 · 三选一强化 · 击败史莱姆王', creamStyle(13))
      .setOrigin(0.5);

    const selected = getRunState().difficulty;
    DIFFICULTY_ORDER.forEach((difficulty, i) => {
      const button = createArtButton(
        this,
        DESIGN_SIZE.width / 2 + (i - 1) * 170,
        272,
        DIFFICULTY_CONFIGS[difficulty].label,
        () => this.selectDifficulty(difficulty),
        { width: 150, fontSize: 17 }
      );
      button.setSelected(difficulty === selected);
      this.difficultyButtons.set(difficulty, button);
    });
    this.descriptionText = this.add
      .text(DESIGN_SIZE.width / 2, 306, '', { ...inkStyle(14), color: Palette.cream, stroke: Palette.forestDeep, strokeThickness: 3 })
      .setOrigin(0.5);
    this.selectDifficulty(selected, true);

    const start = createArtButton(this, DESIGN_SIZE.width / 2, 360, '开始守卫', () => this.startRun(), { width: 300, fontSize: 24 });
    start.container.setName('start-run');
    this.add.text(DESIGN_SIZE.width / 2, 402, 'Enter 开始守卫 · 1 / 2 / 3 选择难度', creamStyle(12)).setOrigin(0.5);
    createArtButton(this, DESIGN_SIZE.width / 2, 448, '玩法说明', () => this.showHowto(), { width: 190, fontSize: 16 });

    const best = loadBest();
    this.add
      .text(
        DESIGN_SIZE.width / 2,
        512,
        best
          ? `最佳纪录 · ${DIFFICULTY_CONFIGS[best.difficulty].label} · 击杀 ${best.kills} · ${formatTime(best.elapsedMs)} · 通关 ${best.wins} 次`
          : '尚无通关纪录 · 由你写下第一笔',
        { ...inkStyle(14), color: Palette.parchmentDark, stroke: Palette.forestDeep, strokeThickness: 3 }
      )
      .setOrigin(0.5);

    this.muteButton = createTopButton(this, 878, 30, '', () => this.toggleMute(), 132);
    this.syncMute();

    this.menuKeys = (event: KeyboardEvent): void => {
      if (this.howto || event.repeat) return;
      if (event.key === 'Enter') this.startRun();
      if (event.key === '1') this.selectDifficulty('easy');
      if (event.key === '2') this.selectDifficulty('normal');
      if (event.key === '3') this.selectDifficulty('hard');
    };
    window.addEventListener('keydown', this.menuKeys);
  }

  private drawDiorama(): void {
    const castle = this.add.image(118, 424, UiKeys.IconBase).setDisplaySize(150, 169).setDepth(6);
    const archer = this.add.image(226, 452, AssetKeys.Player).setDepth(6);
    const slimeA = this.add.image(836, 440, AssetKeys.EnemyGrunt).setDisplaySize(52, 52).setDepth(6);
    const slimeB = this.add.image(892, 474, AssetKeys.EnemyRunner).setDisplaySize(40, 40).setDepth(6);
    if (!prefersReducedMotion()) {
      this.tweens.add({ targets: castle, y: 420, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: archer, y: 448, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: slimeA, scaleY: 0.86, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: slimeB, scaleY: 0.84, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  private selectDifficulty(difficulty: Difficulty, silent = false): void {
    setDifficulty(difficulty);
    for (const [key, button] of this.difficultyButtons) {
      button.setSelected(key === difficulty);
    }
    this.descriptionText.setText(DIFFICULTY_CONFIGS[difficulty].description);
    if (!silent) {
      audio.play('click');
    }
  }

  private startRun(): void {
    resetRun(getRunState().difficulty);
    setPhase('battle');
    this.scene.start(SceneKeys.Battle);
  }

  private toggleMute(): void {
    audio.toggleMuted();
    this.syncMute();
  }

  private syncMute(): void {
    this.muteButton.setLabel(audio.isMuted() ? '♪ 声音关' : '♪ 声音开');
  }

  private showHowto(): void {
    if (this.howto) {
      return;
    }
    const root = this.add.container(0, 0).setDepth(80);
    this.howto = root;
    const scrim = this.add
      .rectangle(DESIGN_SIZE.width / 2, DESIGN_SIZE.height / 2, DESIGN_SIZE.width, DESIGN_SIZE.height, 0x0c1206, 0.7)
      .setInteractive();
    const panel = createPanel(this, DESIGN_SIZE.width / 2, 272, 680, 400);
    const title = createArtHeading(this, DESIGN_SIZE.width / 2, 128, TitleKeys.Help, 250, 62);
    const lines = [
      '按住鼠标左键：朝准星连续射击，暴击双倍伤害',
      '空格 / 右下角按钮：箭雨扇形攻击，冷却 8 秒',
      '敌人触城扣基地血；血量耗尽则守卫失败',
      '防御减伤；生命上限强化提高上限并恢复等量生命',
      '波后 1 / 2 / 3 三选一强化；ESC 或点击空白跳过奖励',
      'Boss 到基地后会持续攻城，不能放任不管',
      '完成五波，击败史莱姆王并清空全场敌人才算胜利',
      '战斗中 ESC 暂停；“声音”开关同时控制音乐与音效'
    ];
    const body = this.add
      .text(DESIGN_SIZE.width / 2, 176, lines.map((line) => `· ${line}`).join('\n'), {
        ...inkStyle(14),
        lineSpacing: 6,
        align: 'left',
        wordWrap: { width: 552, useAdvancedWrap: true }
      })
      .setOrigin(0.5, 0);
    const close = createArtButton(this, DESIGN_SIZE.width / 2, 412, '明白了', () => this.hideHowto(), { width: 180, height: 44, fontSize: 17 });
    const hint = this.add.text(DESIGN_SIZE.width / 2, 375, 'ESC 关闭说明', { ...inkStyle(12), color: Palette.inkSoft }).setOrigin(0.5);
    root.add([scrim, panel, title, body, close.container, hint]);
    if (prefersReducedMotion()) {
      root.setAlpha(1);
    } else {
      root.setAlpha(0);
      this.tweens.add({ targets: root, alpha: 1, duration: 160 });
    }

    this.howtoKeys = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        this.hideHowto();
      }
    };
    window.addEventListener('keydown', this.howtoKeys);
  }

  private hideHowto(): void {
    if (this.howtoKeys) {
      window.removeEventListener('keydown', this.howtoKeys);
      this.howtoKeys = null;
    }
    this.howto?.destroy();
    this.howto = null;
  }

  private cleanUp(): void {
    this.hideHowto();
    if (this.menuKeys) {
      window.removeEventListener('keydown', this.menuKeys);
      this.menuKeys = null;
    }
    this.difficultyButtons.clear();
  }
}
