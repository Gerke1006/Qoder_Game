import * as Phaser from 'phaser';
import { AssetKeys, DESIGN_SIZE, SceneKeys, UiKeys, type EnemyType, type RewardOption, type RunSummary } from '../types';
import { getEnemyStats } from '../data/EnemyConfig';
import { PLAYER_CONFIG, BASE_POSITION } from '../data/PlayerConfig';
import { WAVE_CONFIGS } from '../data/WaveConfig';
import { DIFFICULTY_CONFIGS } from '../data/DifficultyConfig';
import {
  addElapsed,
  addGold,
  addKill,
  damageBase,
  getRunState,
  resetRun,
  setPhase,
  setCurrentWave
} from '../state/GameState';
import { applyDamage } from '../systems/CombatSystem';
import { buildSpawnQueue, getBreakMs, isLastWave } from '../systems/WaveSystem';
import { rollRewards } from '../systems/RewardSystem';
import { applyReward } from '../systems/UpgradeSystem';
import { audio } from '../systems/AudioSystem';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { Boss } from '../entities/Boss';
import { Projectile } from '../entities/Projectile';
import { HUD } from '../ui/HUD';
import { RewardPanel } from '../ui/RewardPanel';
import { PausePanel } from '../ui/PausePanel';
import { createForestBackground } from '../ui/ForestBackground';
import { spawnBaseHitFloat, spawnDamageFloat, spawnGoldFloat } from '../ui/FloatingText';
import { Palette } from '../ui/Theme';

type BattleMode = 'break' | 'fight' | 'reward' | 'over';

/**
 * 战斗场景：完整玩法主循环。
 *
 * 流程：准备倒计时 → 按波次表生成敌人 → 清波 → 三选一强化 → 下一波；
 * 打满 5 波胜利，基地血尽失败。数值读 data/*，伤害读 CombatSystem，
 * 奖励生效读 UpgradeSystem，本场景只负责调度与表现。
 */
export class BattleScene extends Phaser.Scene {
  private hud!: HUD;
  private rewardPanel!: RewardPanel;
  private pausePanel!: PausePanel;
  private player!: Player;
  private crosshair!: Phaser.GameObjects.Image;
  private aimLine!: Phaser.GameObjects.Image;
  private breakText!: Phaser.GameObjects.Text;
  private dangerGlow!: Phaser.GameObjects.Image;

  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private spawnQueue: EnemyType[] = [];
  private spawnClock = 0;
  private waveIndex = 0;
  private mode: BattleMode = 'break';
  private breakRemaining = 0;
  private fireClock = 0;
  private skillRemaining = 0;
  private pointerHeld = false;
  private paused = false;

  constructor() {
    super(SceneKeys.Battle);
  }

  create(): void {
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanUp());

    this.enemies = [];
    this.projectiles = [];
    this.spawnQueue = [];
    this.waveIndex = 0;
    this.mode = 'break';
    this.breakRemaining = 2600;
    this.fireClock = 0;
    this.skillRemaining = 0;
    this.pointerHeld = false;
    this.paused = false;

    createForestBackground(this);
    this.drawBase();
    this.player = new Player(this, PLAYER_CONFIG.x, PLAYER_CONFIG.y);

    this.aimLine = this.add
      .image(this.player.x, this.player.y, UiKeys.AimLine)
      .setOrigin(0, 0.5)
      .setAlpha(0.3)
      .setDepth(19);
    this.crosshair = this.add.image(DESIGN_SIZE.width / 2, DESIGN_SIZE.height / 2, UiKeys.Crosshair).setScale(0.22).setDepth(60);
    this.dangerGlow = this.add
      .image(DESIGN_SIZE.width / 2, DESIGN_SIZE.height / 2, 'tex-vignette')
      .setTint(0xe04a3a)
      .setAlpha(0)
      .setDepth(41);
    this.input.setDefaultCursor('none');

    this.breakText = this.add
      .text(DESIGN_SIZE.width / 2, 150, '', {
        fontFamily: '"Microsoft YaHei", "PingFang SC", system-ui, sans-serif',
        fontSize: '18px',
        fontStyle: 'bold',
        color: Palette.cream,
        stroke: Palette.forestDeep,
        strokeThickness: 4
      })
      .setOrigin(0.5)
      .setDepth(46);

    this.hud = new HUD(this, {
      onPause: () => this.togglePause(),
      onMute: () => this.toggleMute(),
      onSkill: () => this.castSkill()
    });
    this.rewardPanel = new RewardPanel(this);
    this.pausePanel = new PausePanel(this);

    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointerup', this.onPointerUp, this);
    this.input.keyboard?.addCapture(['SPACE', 'ESC']);
    this.input.keyboard?.on('keydown-SPACE', this.castSkill, this);
    this.input.keyboard?.on('keydown-ESC', this.togglePause, this);

    setPhase('battle');
    setCurrentWave(-1);
  }

  update(time: number, delta: number): void {
    if (this.paused || this.mode === 'over') {
      return;
    }
    const step = Math.min(delta, 48);
    addElapsed(step);

    const pointer = this.input.activePointer;
    this.player.idle(time);
    this.player.aimAt(pointer.worldX, pointer.worldY);
    this.crosshair.setPosition(pointer.worldX, pointer.worldY);
    const aimAngle = Phaser.Math.Angle.Between(this.player.x, this.player.y, pointer.worldX, pointer.worldY);
    const aimDist = Phaser.Math.Clamp(Phaser.Math.Distance.Between(this.player.x, this.player.y, pointer.worldX, pointer.worldY), 60, 460);
    this.aimLine.setPosition(this.player.x + 18, this.player.y - 6);
    this.aimLine.setRotation(aimAngle);
    this.aimLine.setDisplaySize(aimDist, 14);

    if (this.mode === 'break') {
      this.breakRemaining -= step;
      this.breakText.setText(
        this.waveIndex === 0
          ? '按住左键射击 · 空格释放箭雨'
          : `下一波 ${Math.max(1, Math.ceil(this.breakRemaining / 1000))} 秒后来袭`
      );
      if (this.breakRemaining <= 0) {
        this.beginWave();
      }
    } else {
      this.breakText.setText('');
    }

    if (this.mode === 'fight') {
      this.spawnClock += step;
      const interval = WAVE_CONFIGS[this.waveIndex].spawnIntervalMs;
      while (this.spawnQueue.length > 0 && this.spawnClock >= interval) {
        this.spawnClock -= interval;
        this.spawnEnemy(this.spawnQueue.shift() as EnemyType);
      }
    }

    this.stepEnemies(step, time);
    this.stepProjectiles(step);

    if (this.pointerHeld && this.mode === 'fight') {
      this.fireClock -= step;
      if (this.fireClock <= 0) {
        this.fireClock = 1000 / (PLAYER_CONFIG.fireRate + getRunState().fireRateBonus);
        this.shoot(pointer.worldX, pointer.worldY);
      }
    }

    this.skillRemaining = Math.max(0, this.skillRemaining - step);
    this.hud.setSkillCooldown(this.skillRemaining);
    this.hud.setEnemiesLeft(this.spawnQueue.length + this.enemies.filter((e) => e.alive).length);
    this.hud.refresh();

    const hpRatio = getRunState().baseHp / getRunState().baseMaxHp;
    this.dangerGlow.setAlpha(hpRatio < 0.3 ? 0.3 + Math.sin(time * 0.006) * 0.16 : 0);

    if (this.mode === 'fight' && this.spawnQueue.length === 0 && this.enemies.length === 0) {
      this.waveCleared();
    }
  }

  private drawBase(): void {
    const glow = this.add.image(BASE_POSITION.x, BASE_POSITION.y, AssetKeys.Spark).setDisplaySize(190, 190).setTint(0x6fae4e).setAlpha(0.3).setDepth(17);
    this.tweens.add({ targets: glow, alpha: 0.18, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.add.image(BASE_POSITION.x, BASE_POSITION.y, UiKeys.IconBase).setDisplaySize(96, 108).setDepth(18);
  }

  private beginWave(): void {
    this.mode = 'fight';
    this.spawnClock = WAVE_CONFIGS[this.waveIndex].spawnIntervalMs;
    this.spawnQueue = buildSpawnQueue(this.waveIndex);
    setCurrentWave(this.waveIndex);
    this.hud.showBanner(`第 ${this.waveIndex + 1} 波`, WAVE_CONFIGS[this.waveIndex].label);
    audio.play('wave');
  }

  private spawnEnemy(type: EnemyType, at?: { x: number; y: number }): void {
    const profile = DIFFICULTY_CONFIGS[getRunState().difficulty];
    const base = getEnemyStats(type);
    const stats = { ...base, maxHp: Math.round(base.maxHp * profile.enemyHpMult) };
    const x = at?.x ?? DESIGN_SIZE.width + 40;
    const y = at?.y ?? Phaser.Math.Between(120, 420);
    const enemy = type === 'boss' ? new Boss(this, stats, x, y, profile.enemySpeedMult) : new Enemy(this, stats, x, y, type === 'runner' ? AssetKeys.EnemyRunner : AssetKeys.EnemyGrunt, profile.enemySpeedMult);
    if (enemy instanceof Boss) {
      enemy.onSummon = (sx, sy) => {
        if (this.mode === 'fight') {
          this.spawnEnemy('grunt', { x: Math.max(sx, 340), y: Phaser.Math.Clamp(sy, 110, 430) });
        }
      };
      this.cameras.main.shake(220, 0.004);
    }
    this.enemies.push(enemy);
  }

  private stepEnemies(step: number, time: number): void {
    for (const enemy of this.enemies) {
      enemy.step(step, time);
      if (enemy.reachedBase) {
        damageBase(enemy.stats.damage);
        spawnBaseHitFloat(this, BASE_POSITION.x + 40, BASE_POSITION.y - 60, enemy.stats.damage);
        this.hud.flashBase();
        this.cameras.main.shake(180, 0.006);
        audio.play('hurt');
        enemy.destroy();
        if (getRunState().baseHp <= 0) {
          this.finish(false);
        }
      }
    }
    this.enemies = this.enemies.filter((enemy) => enemy.active);
  }

  private stepProjectiles(step: number): void {
    for (const projectile of this.projectiles) {
      projectile.step(step);
      if (!projectile.active) {
        continue;
      }
      for (const enemy of this.enemies) {
        if (!enemy.alive) {
          continue;
        }
        const radius = enemy.stats.size * 0.48 + 10;
        if (Phaser.Math.Distance.Between(projectile.x, projectile.y, enemy.x, enemy.y) <= radius) {
          const roll = applyDamage(enemy, projectile.damage);
          spawnDamageFloat(this, enemy.x, enemy.y - enemy.stats.size * 0.6, roll.amount, roll.crit);
          this.hitSpark(projectile.x, projectile.y, roll.crit);
          audio.play(roll.crit ? 'crit' : 'hit');
          if (!enemy.alive && !enemy.reachedBase) {
            this.onKill(enemy);
          }
          projectile.destroy();
          break;
        }
      }
    }
    this.projectiles = this.projectiles.filter((projectile) => projectile.active);
  }

  private onKill(enemy: Enemy): void {
    addKill();
    addGold(enemy.goldReward);
    spawnGoldFloat(this, enemy.x, enemy.y - 26, enemy.goldReward);
    audio.play('kill');
    audio.play('coin');
    if (enemy instanceof Boss) {
      this.cameras.main.flash(260, 246, 231, 200);
      this.cameras.main.shake(320, 0.008);
    }
  }

  private hitSpark(x: number, y: number, crit: boolean): void {
    const burst = this.add.particles(x, y, AssetKeys.Spark, {
      speed: { min: 30, max: crit ? 160 : 90 },
      lifespan: 260,
      scale: { start: crit ? 0.6 : 0.4, end: 0 },
      tint: crit ? 0xf0b429 : 0xf6e7c8,
      emitting: false
    });
    burst.setDepth(27);
    burst.explode(crit ? 10 : 5);
    this.time.delayedCall(320, () => burst.destroy());
  }

  private shoot(targetX: number, targetY: number): void {
    const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, targetX, targetY);
    const projectile = new Projectile(this, this.player.x + 24, this.player.y - 8, PLAYER_CONFIG.baseDamage);
    let lock: Enemy | null = null;
    let lockDist = 90;
    for (const enemy of this.enemies) {
      if (!enemy.alive) {
        continue;
      }
      const d = Phaser.Math.Distance.Between(targetX, targetY, enemy.x, enemy.y);
      if (d < lockDist) {
        lockDist = d;
        lock = enemy;
      }
    }
    projectile.target = lock;
    projectile.launch(angle, PLAYER_CONFIG.projectileSpeed, lock ? 3.2 : 0);
    this.projectiles.push(projectile);
    this.player.recoil();
    audio.play('shoot');
  }

  private castSkill(): void {
    if (this.paused || this.mode !== 'fight' || this.skillRemaining > 0) {
      return;
    }
    this.skillRemaining = PLAYER_CONFIG.skillCooldownMs;
    audio.play('skill');
    this.cameras.main.shake(120, 0.003);
    const count = PLAYER_CONFIG.skillArrows;
    for (let i = 0; i < count; i++) {
      const angle = -0.42 + (0.84 * i) / (count - 1);
      const projectile = new Projectile(this, this.player.x + 20, this.player.y - 8, PLAYER_CONFIG.skillDamage);
      projectile.launch(angle, PLAYER_CONFIG.projectileSpeed * 0.92);
      this.projectiles.push(projectile);
    }
    const ring = this.add.particles(this.player.x, this.player.y, AssetKeys.Spark, {
      speed: { min: 80, max: 220 },
      lifespan: 380,
      scale: { start: 0.8, end: 0 },
      tint: 0xf0b429,
      emitting: false
    });
    ring.setDepth(27);
    ring.explode(18);
    this.time.delayedCall(450, () => ring.destroy());
    this.player.recoil();
  }

  private waveCleared(): void {
    if (isLastWave(this.waveIndex)) {
      this.finish(true);
      return;
    }
    this.mode = 'reward';
    setPhase('reward');
    this.pointerHeld = false;
    this.rewardPanel.show(rollRewards(), (reward) => this.pickReward(reward));
  }

  private pickReward(reward: RewardOption): void {
    if (this.mode !== 'reward') {
      return;
    }
    applyReward(reward);
    this.rewardPanel.hide();
    this.hud.refresh();
    setPhase('battle');
    this.waveIndex += 1;
    this.mode = 'break';
    this.breakRemaining = getBreakMs(this.waveIndex);
  }

  private finish(win: boolean): void {
    if (this.mode === 'over') {
      return;
    }
    this.mode = 'over';
    this.pointerHeld = false;
    setPhase('finished');
    this.breakText.setText('');
    audio.play(win ? 'win' : 'lose');
    if (win) {
      this.cameras.main.flash(400, 246, 231, 200);
      this.hud.showBanner('守卫成功！', '林地恢复了平静');
    } else {
      this.cameras.main.shake(420, 0.01);
      this.hud.showBanner('基地陷落…', '整备后再战一次');
    }
    const summary: RunSummary = {
      win,
      wave: getRunState().currentWave,
      totalWaves: getRunState().totalWaves,
      kills: getRunState().kills,
      gold: getRunState().gold,
      elapsedMs: getRunState().elapsedMs,
      takenRewardIds: [...getRunState().takenRewardIds]
    };
    this.time.delayedCall(1400, () => this.scene.start(SceneKeys.Result, summary));
  }

  private togglePause(): void {
    if (this.mode === 'over' || this.rewardPanel.visible) {
      return;
    }
    this.paused = !this.paused;
    this.pointerHeld = false;
    audio.play('pause');
    if (this.paused) {
      this.pausePanel.show({
        onResume: () => this.togglePause(),
        onRestart: () => {
          resetRun(getRunState().difficulty);
          this.scene.restart();
        },
        onMenu: () => {
          setPhase('idle');
          this.scene.start(SceneKeys.MainMenu);
        },
        onMute: () => this.toggleMute()
      });
    } else {
      this.pausePanel.hide();
    }
  }

  private toggleMute(): void {
    audio.toggleMuted();
    this.hud.syncMuteLabel();
    this.pausePanel.syncMute();
  }

  private onPointerDown(): void {
    this.pointerHeld = true;
  }

  private onPointerUp(): void {
    this.pointerHeld = false;
  }

  private cleanUp(): void {
    this.input.off('pointerdown', this.onPointerDown, this);
    this.input.off('pointerup', this.onPointerUp, this);
    this.input.keyboard?.removeCapture(['SPACE', 'ESC']);
    this.input.keyboard?.off('keydown-SPACE', this.castSkill, this);
    this.input.keyboard?.off('keydown-ESC', this.togglePause, this);
    this.input.setDefaultCursor('default');
    this.hud.destroy();
    this.rewardPanel.destroy();
    this.pausePanel.destroy();
  }
}
