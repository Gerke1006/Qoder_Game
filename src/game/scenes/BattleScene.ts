import * as Phaser from 'phaser';
import { AssetKeys, DESIGN_SIZE, SceneKeys, TitleKeys, UiKeys, type EnemyType, type RewardOption, type RunSummary } from '../types';
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
import { applyDamage, resolveBaseDamage } from '../systems/CombatSystem';
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
import { Crosshair } from '../ui/Crosshair';
import { Palette, prefersReducedMotion } from '../ui/Theme';

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
  private crosshair!: Crosshair;
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
    audio.setPaused(false);
    audio.setMood('battle');

    createForestBackground(this);
    this.drawBase();
    this.player = new Player(this, PLAYER_CONFIG.x, PLAYER_CONFIG.y);

    this.crosshair = new Crosshair(this, {
      getOrigin: () => ({ x: this.player.x + 18, y: this.player.y - 6 })
    });
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
    this.input.on('pointerupoutside', this.onPointerUp, this);
    this.game.events.on(Phaser.Core.Events.BLUR, this.onPointerUp, this);
    this.input.keyboard?.addCapture(['SPACE', 'ESC']);
    this.input.keyboard?.on('keydown-SPACE', this.castSkill, this);
    this.input.keyboard?.on('keydown-ESC', this.togglePause, this);

    setPhase('battle');
    setCurrentWave(-1);
  }

  update(time: number, delta: number): void {
    if (this.paused || this.mode === 'over' || this.mode === 'reward') {
      return;
    }
    const step = Math.min(delta, 48);
    addElapsed(step);

    const pointer = this.input.activePointer;
    this.player.idle(time);
    this.player.aimAt(pointer.worldX, pointer.worldY);
    this.crosshair.update();

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
    if (getRunState().baseHp === 0) {
      this.hud.refresh();
      return;
    }
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
    const boss = this.enemies.find((enemy) => enemy instanceof Boss && enemy.alive);
    this.hud.setBossHealth(boss?.hp ?? 0, boss?.maxHp ?? 1);
    this.hud.refresh();

    const hpRatio = getRunState().baseHp / getRunState().baseMaxHp;
    this.dangerGlow.setAlpha(
      hpRatio < 0.3 ? (prefersReducedMotion() ? 0.3 : 0.3 + Math.sin(time * 0.006) * 0.16) : 0
    );

    if (this.mode === 'fight' && this.spawnQueue.length === 0 && this.enemies.length === 0) {
      this.waveCleared();
    }
  }

  private drawBase(): void {
    const glow = this.add.image(BASE_POSITION.x, BASE_POSITION.y, AssetKeys.Spark).setDisplaySize(190, 190).setTint(0x6fae4e).setAlpha(0.3).setDepth(17);
    if (!prefersReducedMotion()) {
      this.tweens.add({ targets: glow, alpha: 0.18, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    this.add.image(BASE_POSITION.x, BASE_POSITION.y, UiKeys.IconBase).setDisplaySize(96, 108).setDepth(18);
  }

  private beginWave(): void {
    this.mode = 'fight';
    this.spawnClock = WAVE_CONFIGS[this.waveIndex].spawnIntervalMs;
    this.spawnQueue = buildSpawnQueue(this.waveIndex);
    setCurrentWave(this.waveIndex);
    audio.setMood(isLastWave(this.waveIndex) ? 'boss' : 'battle');
    this.hud.showBanner(`第 ${this.waveIndex + 1} 波`, isLastWave(this.waveIndex)
      ? '最终决战 · 击败首领并清空全场'
      : '守住基地 · 清空敌人后选择强化');
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
      enemy.onAttackBase = (damage) => {
        if (this.mode === 'fight') this.hitBase(damage);
      };
      this.hud.showBanner('', '击败史莱姆王，并清空全场敌人', TitleKeys.Boss);
      if (!prefersReducedMotion()) this.cameras.main.shake(220, 0.004);
    }
    this.enemies.push(enemy);
  }

  private stepEnemies(step: number, time: number): void {
    for (const enemy of this.enemies) {
      enemy.step(step, time);
      if (enemy.reachedBase) {
        this.hitBase(enemy.stats.damage);
        enemy.destroy();
      }
      if (getRunState().baseHp <= 0) break;
    }
    this.enemies = this.enemies.filter((enemy) => enemy.active);
  }

  private hitBase(baseDamage: number): void {
    const damage = resolveBaseDamage(baseDamage);
    damageBase(damage);
    spawnBaseHitFloat(this, BASE_POSITION.x + 40, BASE_POSITION.y - 60, damage);
    this.hud.flashBase();
    if (!prefersReducedMotion()) this.cameras.main.shake(180, 0.006);
    audio.play('hurt');
    if (getRunState().baseHp <= 0) this.finish(false);
  }

  private stepProjectiles(step: number): void {
    for (const projectile of this.projectiles) {
      projectile.step(step);
      let target: Enemy | null = null;
      let firstHit = Infinity;
      for (const enemy of this.enemies) {
        if (!enemy.alive) continue;
        const radius = enemy.stats.size * 0.48 + 10;
        const fraction = projectile.hitFraction(enemy, radius);
        if (fraction !== null && fraction < firstHit) {
          target = enemy;
          firstHit = fraction;
        }
      }
      if (target) {
        const roll = applyDamage(target, projectile.damage);
        spawnDamageFloat(this, target.x, target.y - target.stats.size * 0.6, roll.amount, roll.crit);
        this.hitSpark(
          Phaser.Math.Linear(projectile.previousX, projectile.x, firstHit),
          Phaser.Math.Linear(projectile.previousY, projectile.y, firstHit),
          roll.crit
        );
        audio.play(roll.crit ? 'crit' : 'hit');
        if (!target.alive) this.onKill(target);
      }
      if (target || projectile.outOfBounds) projectile.destroy();
    }
    this.projectiles = this.projectiles.filter((projectile) => projectile.active);
  }

  private onKill(enemy: Enemy): void {
    addKill();
    addGold(enemy.goldReward);
    spawnGoldFloat(this, enemy.x, enemy.y - 26, enemy.goldReward);
    audio.play('kill');
    audio.play('coin');
    if (enemy instanceof Boss && !prefersReducedMotion()) {
      this.cameras.main.flash(260, 246, 231, 200);
      this.cameras.main.shake(320, 0.008);
    }
  }

  private hitSpark(x: number, y: number, crit: boolean): void {
    if (prefersReducedMotion()) return;
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
    let lockDist: number = PLAYER_CONFIG.lockRadius;
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
    projectile.launch(angle, PLAYER_CONFIG.projectileSpeed, lock ? PLAYER_CONFIG.homingTurnRate : 0);
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
    if (!prefersReducedMotion()) this.cameras.main.shake(120, 0.003);
    const count = PLAYER_CONFIG.skillArrows;
    for (let i = 0; i < count; i++) {
      const angle = -PLAYER_CONFIG.skillSpread / 2 + (PLAYER_CONFIG.skillSpread * i) / (count - 1);
      const projectile = new Projectile(this, this.player.x + 20, this.player.y - 8, PLAYER_CONFIG.skillDamage);
      projectile.launch(angle, PLAYER_CONFIG.projectileSpeed * 0.92);
      this.projectiles.push(projectile);
    }
    if (!prefersReducedMotion()) {
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
    }
    this.player.recoil();
  }

  private waveCleared(): void {
    if (this.mode !== 'fight') return;
    for (const projectile of this.projectiles) projectile.destroy();
    this.projectiles = [];
    if (isLastWave(this.waveIndex)) {
      this.finish(true);
      return;
    }
    this.mode = 'reward';
    setPhase('reward');
    audio.setMood('reward');
    this.pointerHeld = false;
    this.setAimVisible(false);
    this.rewardPanel.show(rollRewards(), (reward) => this.pickReward(reward), () => this.pickReward());
  }

  private pickReward(reward?: RewardOption): void {
    if (this.mode !== 'reward') return;
    const applied = reward ? applyReward(reward) : false;
    this.rewardPanel.hide();
    this.setAimVisible(true);
    this.hud.refresh();
    if (reward && applied) {
      audio.play('reward');
      this.hud.showUpgrade(reward);
    }
    setPhase('battle');
    this.breakRemaining = getBreakMs(this.waveIndex);
    this.waveIndex += 1;
    this.mode = 'break';
    audio.setMood(isLastWave(this.waveIndex) ? 'boss' : 'battle');
  }

  private finish(win: boolean): void {
    if (this.mode === 'over') {
      return;
    }
    this.mode = 'over';
    this.pointerHeld = false;
    this.setAimVisible(false);
    setPhase('finished');
    this.breakText.setText('');
    audio.setMood(win ? 'victory' : 'defeat');
    audio.setPaused(false);
    audio.play(win ? 'win' : 'lose');
    if (win) {
      if (!prefersReducedMotion()) this.cameras.main.flash(400, 246, 231, 200);
      this.hud.showBanner('', '林地恢复了平静', TitleKeys.Victory);
    } else {
      if (!prefersReducedMotion()) this.cameras.main.shake(420, 0.01);
      this.hud.showBanner('', '整备后再战一次', TitleKeys.Defeat);
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
    if (this.mode === 'over') {
      return;
    }
    if (this.mode === 'reward') {
      this.rewardPanel.dismiss();
      return;
    }
    this.paused = !this.paused;
    audio.setPaused(this.paused);
    this.pointerHeld = false;
    audio.play('pause');
    this.setAimVisible(!this.paused);
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

  /** 模态面板（奖励 / 暂停）与结算过场期间收起准星和瞄准线，把光标交还给系统。 */
  private setAimVisible(shown: boolean): void {
    this.crosshair.setVisible(shown);
    this.input.setDefaultCursor(shown ? 'none' : 'default');
  }

  private onPointerDown(pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]): void {
    if (this.paused || (this.mode !== 'fight' && this.mode !== 'break') || currentlyOver.length > 0) {
      return;
    }
    this.pointerHeld = pointer.leftButtonDown();
  }

  private onPointerUp(): void {
    this.pointerHeld = false;
  }

  private cleanUp(): void {
    this.input.off('pointerdown', this.onPointerDown, this);
    this.input.off('pointerup', this.onPointerUp, this);
    this.input.off('pointerupoutside', this.onPointerUp, this);
    this.game.events.off(Phaser.Core.Events.BLUR, this.onPointerUp, this);
    this.input.keyboard?.removeCapture(['SPACE', 'ESC']);
    this.input.keyboard?.off('keydown-SPACE', this.castSkill, this);
    this.input.keyboard?.off('keydown-ESC', this.togglePause, this);
    this.input.setDefaultCursor('default');
    this.crosshair?.destroy();
    this.hud.destroy();
    this.rewardPanel.destroy();
    this.pausePanel.destroy();
  }
}
