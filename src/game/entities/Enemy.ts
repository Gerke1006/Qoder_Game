import * as Phaser from 'phaser';
import { AssetKeys, type Damageable, type EnemyStats } from '../types';
import { BASE_LINE_X } from '../data/PlayerConfig';

/**
 * 敌人实体：外观 + 生命 + 向基地推进。
 *
 * 数值一律来自 data/EnemyConfig；击杀金币与基地扣血由 BattleScene 依据
 * `alive` / `reachedBase` 两个标志结算，本类只负责表现与死亡动画。
 */
export class Enemy extends Phaser.GameObjects.Container implements Damageable {
  readonly stats: EnemyStats;
  hp: number;
  readonly maxHp: number;
  alive = true;
  /** 抵达基地线：场景据此扣基地血，不发金币。 */
  reachedBase = false;

  protected sprite: Phaser.GameObjects.Image;
  private hpBar: Phaser.GameObjects.Graphics;
  private baseY: number;
  private seed = Math.random() * Math.PI * 2;
  private speed: number;
  private barWidth: number;
  private baseScaleX: number;
  private baseScaleY: number;

  constructor(
    scene: Phaser.Scene,
    stats: EnemyStats,
    x: number,
    y: number,
    textureKey: string = AssetKeys.EnemyGrunt,
    speedMult = 1
  ) {
    super(scene, x, y);
    this.stats = stats;
    this.maxHp = stats.maxHp;
    this.hp = stats.maxHp;
    this.baseY = y;
    this.speed = stats.speed * speedMult;
    this.barWidth = stats.size * 0.95;

    this.sprite = scene.add.image(0, 0, textureKey).setDisplaySize(stats.size, stats.size);
    this.baseScaleX = this.sprite.scaleX;
    this.baseScaleY = this.sprite.scaleY;
    this.hpBar = scene.add.graphics();
    this.add([this.sprite, this.hpBar]);
    scene.add.existing(this);
    this.setDepth(20);
    this.drawHpBar();
  }

  get goldReward(): number {
    return this.stats.goldReward;
  }

  /** 由 BattleScene 每帧调用。 */
  step(deltaMs: number, timeMs: number): void {
    if (!this.alive) {
      return;
    }
    this.x -= (this.speed * deltaMs) / 1000;
    const wobble = Math.sin(timeMs * 0.005 + this.seed);
    this.y = this.baseY + wobble * 5;
    this.sprite.setScale(this.baseScaleX * (1 + wobble * 0.05), this.baseScaleY * (1 - wobble * 0.05));
    if (this.x <= BASE_LINE_X) {
      this.reachedBase = true;
      this.alive = false;
    }
  }

  takeDamage(amount: number): void {
    if (!this.alive) {
      return;
    }
    this.hp = Math.max(0, this.hp - amount);
    this.drawHpBar();
    this.sprite.setTintFill(0xffffff);
    this.scene.time.delayedCall(60, () => {
      if (this.sprite.active) {
        this.sprite.clearTint();
      }
    });
    if (this.hp === 0) {
      this.alive = false;
      this.playDeath();
    }
  }

  protected drawHpBar(): void {
    this.hpBar.clear();
    if (this.hp >= this.maxHp || !this.alive) {
      return;
    }
    const y = -this.stats.size * 0.66;
    const ratio = this.hp / this.maxHp;
    const color = ratio > 0.5 ? 0x6fae4e : ratio > 0.25 ? 0xf0b429 : 0xe04a3a;
    this.hpBar.fillStyle(0x141f10, 0.8);
    this.hpBar.fillRoundedRect(-this.barWidth / 2, y, this.barWidth, 6, 3);
    this.hpBar.fillStyle(color, 1);
    this.hpBar.fillRoundedRect(-this.barWidth / 2 + 1, y + 1, Math.max(2, (this.barWidth - 2) * ratio), 4, 2);
  }

  private playDeath(): void {
    this.hpBar.clear();
    const tint = this.stats.type === 'boss' ? 0x9b4fd6 : this.stats.type === 'runner' ? 0x3fb8af : 0x6fae4e;
    const burst = this.scene.add.particles(this.x, this.y, AssetKeys.Spark, {
      speed: { min: 50, max: 170 },
      lifespan: 420,
      scale: { start: 0.7, end: 0 },
      tint,
      emitting: false
    });
    burst.setDepth(25);
    burst.explode(this.stats.type === 'boss' ? 26 : 12);
    this.scene.time.delayedCall(500, () => burst.destroy());
    this.scene.tweens.add({
      targets: this.sprite,
      scale: 0,
      alpha: 0,
      duration: 200,
      ease: 'Quad.easeIn',
      onComplete: () => this.destroy()
    });
  }
}
