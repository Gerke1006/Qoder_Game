import * as Phaser from 'phaser';
import { AssetKeys, DESIGN_SIZE, SceneKeys, UiKeys, type Difficulty } from '../types';
import { DIFFICULTY_CONFIGS, DIFFICULTY_ORDER } from '../data/DifficultyConfig';
import { getRunState, resetRun, setDifficulty, setPhase } from '../state/GameState';
import { audio } from '../systems/AudioSystem';
import { loadBest, formatTime } from '../utils/BestRecord';
import { createForestBackground } from '../ui/ForestBackground';
import { createArtButton, createTitleText, createTopButton, type ArtButton } from '../ui/Button';
import { createPanel, inkStyle, Palette, prefersReducedMotion } from '../ui/Theme';

/**
 * 主菜单：林地小景 + 标题 plaque + 难度选择 + 开始 / 玩法说明 + 最佳纪录。
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

    createForestBackground(this);
    this.drawDiorama();

    createPanel(this, DESIGN_SIZE.width / 2, 126, 640, 236);
    createTitleText(this, DESIGN_SIZE.width / 2, 92, '林地守卫战', 44);
    this.add
      .text(DESIGN_SIZE.width / 2, 140, 'Roguelite 波次防守 · 守住最后的城堡', inkStyle(16))
      .setOrigin(0.5);
    this.add
      .text(DESIGN_SIZE.width / 2, 170, '五波来袭 · 三选一强化 · 击败史莱姆王', { ...inkStyle(13), color: Palette.inkSoft })
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

    createArtButton(this, DESIGN_SIZE.width / 2, 360, '开始守卫', () => this.startRun(), { width: 300, fontSize: 24 });
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
    this.muteButton.setLabel(audio.isMuted() ? '♪ 已静音' : '♪ 音效开');
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
    const title = createTitleText(this, DESIGN_SIZE.width / 2, 128, '玩法说明', 26);
    const lines = [
      '按住鼠标左键：朝准星方向连续射击，暴击双倍伤害',
      '空格 / 右下角按钮：箭雨扇形覆盖，冷却 8 秒',
      '敌人触碰左侧城堡会扣基地血，血尽则守卫失败',
      '每波结束三选一强化：伤害 / 射速 / 基地 / 金币',
      '打满 5 波并击败史莱姆王即守卫成功',
      'ESC 暂停 · 顶部按钮一键静音'
    ];
    const body = this.add
      .text(DESIGN_SIZE.width / 2, 176, lines.map((line) => `· ${line}`).join('\n'), {
        ...inkStyle(15),
        lineSpacing: 12,
        align: 'left'
      })
      .setOrigin(0.5, 0);
    const close = createArtButton(this, DESIGN_SIZE.width / 2, 412, '明白了', () => this.hideHowto(), { width: 180, height: 44, fontSize: 17 });
    root.add([scrim, panel, title, body, close.container]);
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
