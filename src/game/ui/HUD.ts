import * as Phaser from 'phaser';
import { DESIGN_SIZE, TitleKeys, UiKeys, type TitleKey, type RewardOption } from '../types';
import { getRunState } from '../state/GameState';
import { PLAYER_CONFIG } from '../data/PlayerConfig';
import { TOTAL_WAVES } from '../data/WaveConfig';
import { formatTime } from '../utils/BestRecord';
import { audio } from '../systems/AudioSystem';
import { createBar, type Bar } from './Bar';
import { createTopButton, type ArtButton } from './Button';
import { createArtHeading, createPlaque, creamStyle, Palette, prefersReducedMotion } from './Theme';
import { rewardIcon } from '../data/RewardConfig';

/**
 * 战斗 HUD：基地血条 / 波次 / 金币 / 用时 / 攻击与射速 / 箭雨冷却 / 静音与暂停。
 *
 * 只读 GameState 做展示，所有交互通过回调交还 BattleScene；
 * 全部对象挂在一个根容器下，destroy 一次清干净。
 */
export interface HudCallbacks {
  onPause(): void;
  onMute(): void;
  onSkill(): void;
}

const SKILL_SIZE = 66;

export class HUD {
  private root: Phaser.GameObjects.Container;
  private hpBar: Bar;
  private waveBar: Bar;
  private hpText: Phaser.GameObjects.Text;
  private waveText: Phaser.GameObjects.Text;
  private goldText: Phaser.GameObjects.Text;
  private timeText: Phaser.GameObjects.Text;
  private damageText: Phaser.GameObjects.Text;
  private speedText: Phaser.GameObjects.Text;
  private defenseText: Phaser.GameObjects.Text;
  private muteButton: ArtButton;
  private skillVeil: Phaser.GameObjects.Image;
  private skillShade: Phaser.GameObjects.Graphics;
  private skillLabel: Phaser.GameObjects.Text;
  private skillCount: Phaser.GameObjects.Text;
  private skillRoot: Phaser.GameObjects.Container;
  private banner: Phaser.GameObjects.Container | null = null;
  private upgradeToast: Phaser.GameObjects.Container | null = null;
  private bossRoot: Phaser.GameObjects.Container;
  private bossBar: Bar;
  private bossHpText: Phaser.GameObjects.Text;
  private cache = new Map<string, string>();
  private skillWasCooling = false;
  private enemiesLeft = 0;

  constructor(scene: Phaser.Scene, callbacks: HudCallbacks) {
    this.root = scene.add.container(0, 0).setDepth(50);

    const chrome = scene.add.graphics();
    chrome.fillStyle(0x0b1712, 0.24).fillRect(0, 0, DESIGN_SIZE.width, 66);
    chrome.fillStyle(0x0b1712, 0.2).fillRect(0, 478, DESIGN_SIZE.width, 62);
    chrome.lineStyle(1, 0xd9a441, 0.22).lineBetween(0, 66, DESIGN_SIZE.width, 66);
    chrome.lineStyle(1, 0xd9a441, 0.18).lineBetween(0, 478, DESIGN_SIZE.width, 478);
    this.root.add(chrome);

    const heart = scene.add.image(30, 28, UiKeys.IconHeart).setDisplaySize(36, 36);
    this.hpBar = createBar(scene, 168, 28, 232, 26);
    this.hpText = scene.add.text(168, 29, '', creamStyle(14, true)).setOrigin(0.5);
    this.root.add([heart, this.hpBar.container, this.hpText]);

    const waveIcon = scene.add.image(312, 28, UiKeys.IconWave).setDisplaySize(34, 34);
    this.waveText = scene.add.text(336, 22, '', creamStyle(14, true)).setOrigin(0, 0.5);
    this.waveBar = createBar(scene, 434, 46, 196, 14);
    this.root.add([waveIcon, this.waveBar.container, this.waveText]);

    const goldIcon = scene.add.image(560, 28, UiKeys.IconGold).setDisplaySize(32, 32);
    this.goldText = scene.add.text(582, 28, '0', creamStyle(16, true)).setOrigin(0, 0.5);
    const timeIcon = scene.add.image(668, 28, UiKeys.IconTime).setDisplaySize(32, 32);
    this.timeText = scene.add.text(690, 28, '00:00', creamStyle(16, true)).setOrigin(0, 0.5);
    this.root.add([goldIcon, this.goldText, timeIcon, this.timeText]);

    this.muteButton = createTopButton(scene, 806, 28, '', () => callbacks.onMute(), 112);
    const pauseButton = createTopButton(scene, 912, 28, '暂停', () => callbacks.onPause(), 84);
    this.root.add([this.muteButton.container, pauseButton.container]);
    this.syncMuteLabel();

    const dmgIcon = scene.add.image(30, 512, UiKeys.IconDamage).setDisplaySize(34, 34);
    this.damageText = scene.add.text(52, 512, '', creamStyle(15, true)).setOrigin(0, 0.5);
    const spdIcon = scene.add.image(120, 512, UiKeys.IconSpeed).setDisplaySize(34, 34);
    this.speedText = scene.add.text(142, 512, '', creamStyle(15, true)).setOrigin(0, 0.5);
    const defIcon = scene.add.image(214, 512, UiKeys.IconDefense).setDisplaySize(34, 34);
    this.defenseText = scene.add.text(236, 512, '', creamStyle(15, true)).setOrigin(0, 0.5);
    this.root.add([dmgIcon, this.damageText, spdIcon, this.speedText, defIcon, this.defenseText]);

    const skillX = DESIGN_SIZE.width - 54;
    const skillY = DESIGN_SIZE.height - 54;
    const skillBase = scene.add.image(0, 0, UiKeys.IconTime).setDisplaySize(SKILL_SIZE - 12, SKILL_SIZE - 12);
    this.skillVeil = scene.add
      .image(0, 0, UiKeys.Cooldown)
      .setDisplaySize(SKILL_SIZE, SKILL_SIZE)
      .setAlpha(0)
      .setVisible(false);
    this.skillShade = scene.add.graphics();
    this.skillLabel = scene.add.text(0, -6, '箭雨', creamStyle(16, true)).setOrigin(0.5);
    this.skillCount = scene.add.text(0, 14, '', creamStyle(14, true)).setOrigin(0.5);
    const skillHint = scene.add.text(0, -SKILL_SIZE / 2 - 12, '空格', creamStyle(12)).setOrigin(0.5);
    this.skillRoot = scene.add.container(skillX, skillY, [
      skillBase,
      this.skillVeil,
      this.skillShade,
      this.skillLabel,
      this.skillCount,
      skillHint
    ]);
    this.skillRoot.setSize(SKILL_SIZE, SKILL_SIZE);
    this.skillRoot.setInteractive({ useHandCursor: true });
    this.skillRoot.on(Phaser.Input.Events.POINTER_DOWN, () => callbacks.onSkill());
    this.root.add(this.skillRoot);

    this.root.add(scene.add.text(340, 512, '按住左键射击 · 空格箭雨 · ESC 暂停', creamStyle(12)).setOrigin(0, 0.5));
    for (const [x, label] of [[52, '攻击'], [142, '射速'], [236, '防御']] as const) {
      this.root.add(scene.add.text(x, 487, label, creamStyle(10)).setAlpha(0.8));
    }
    this.bossBar = createBar(scene, 0, 15, 330, 14);
    this.bossHpText = scene.add.text(0, -7, '', creamStyle(13, true)).setOrigin(0.5);
    const bossBacking = createPlaque(scene, 0, 4, 368, 52).setTint(0xc5b2d9);
    this.bossRoot = scene.add.container(DESIGN_SIZE.width / 2, 100, [bossBacking, this.bossBar.container, this.bossHpText]).setVisible(false);
    this.root.add(this.bossRoot);
    this.refresh();
  }

  private setText(key: string, text: Phaser.GameObjects.Text, value: string): void {
    if (this.cache.get(key) !== value) {
      this.cache.set(key, value);
      text.setText(value);
    }
  }

  syncMuteLabel(): void {
    const muted = audio.isMuted();
    this.muteButton.setLabel(muted ? '♪ 声音关' : '♪ 声音开');
  }

  refresh(): void {
    const s = getRunState();
    this.hpBar.setRatio(s.baseHp / s.baseMaxHp);
    this.waveBar.setRatio((s.currentWave + 1) / TOTAL_WAVES);
    this.setText('hp', this.hpText, `基地 ${Math.ceil(s.baseHp)} / ${s.baseMaxHp}`);
    const waveLabel = s.currentWave < 0 ? '准备中' : `第 ${s.currentWave + 1} / ${TOTAL_WAVES} 波`;
    this.setText('wave', this.waveText, this.enemiesLeft > 0 ? `${waveLabel} · 余 ${this.enemiesLeft}` : waveLabel);
    this.setText('gold', this.goldText, `${s.gold}`);
    this.setText('time', this.timeText, formatTime(s.elapsedMs));
    this.setText('dmg', this.damageText, `${PLAYER_CONFIG.baseDamage + s.attackDamageBonus}`);
    this.setText('spd', this.speedText, `${(PLAYER_CONFIG.fireRate + s.fireRateBonus).toFixed(1)}/s`);
    this.setText('def', this.defenseText, `${s.baseDefense}`);
  }

  setEnemiesLeft(count: number): void {
    this.enemiesLeft = count;
  }

  /** remainingMs = 0 表示就绪；灰罩随剩余时间淡出，暗扇形从 12 点顺时针扫过未冷却部分。 */
  setSkillCooldown(remainingMs: number): void {
    const ratio = Phaser.Math.Clamp(remainingMs / PLAYER_CONFIG.skillCooldownMs, 0, 1);
    this.skillShade.clear();
    this.skillVeil.setVisible(ratio > 0).setAlpha(0.5 * ratio);
    if (ratio > 0) {
      const radius = (SKILL_SIZE - 12) / 2;
      const start = -Math.PI / 2;
      this.skillShade.fillStyle(0x0b0f16, 0.8);
      this.skillShade.slice(0, 0, radius, start, start + ratio * Math.PI * 2, false, 0);
      this.skillShade.fillPath();
      this.skillLabel.setVisible(false);
      this.skillCount.setText(`${Math.ceil(remainingMs / 1000)}`);
      this.skillWasCooling = true;
    } else {
      this.skillLabel.setVisible(true);
      this.skillCount.setText('就绪');
      if (this.skillWasCooling && !prefersReducedMotion()) {
        this.root.scene.tweens.add({
          targets: this.skillRoot,
          scale: 1.18,
          duration: 120,
          yoyo: true,
          ease: 'Quad.easeOut'
        });
      }
      this.skillWasCooling = false;
    }
  }

  setBossHealth(hp: number, maxHp: number): void {
    this.bossRoot.setVisible(hp > 0);
    if (hp <= 0) return;
    this.bossBar.setRatio(hp / maxHp);
    this.bossHpText.setText(`史莱姆王 · ${Math.ceil(hp)} / ${maxHp}`);
  }

  showUpgrade(reward: RewardOption): void {
    this.upgradeToast?.destroy();
    const scene = this.root.scene;
    const toast = scene.add.container(520, 421).setName('upgrade-toast');
    toast.add([
      createPlaque(scene, 0, 0, 340, 88),
      scene.add.image(-132, 0, rewardIcon(reward.effect)).setDisplaySize(46, 46),
      createArtHeading(scene, 10, -18, TitleKeys.Upgrade, 154, 40),
      scene.add.text(18, 17, `${reward.title} · 强化已生效`, creamStyle(14, true)).setOrigin(0.5)
    ]);
    this.root.add(toast);
    this.upgradeToast = toast;
    const text = { baseHp: this.hpText, damage: this.damageText, speed: this.speedText, defense: this.defenseText, gold: this.goldText }[reward.effect.kind];
    text.setColor(Palette.gold);
    if (!prefersReducedMotion()) {
      toast.setAlpha(0);
      scene.tweens.add({ targets: toast, alpha: 1, duration: 180 });
    }
    scene.time.delayedCall(2600, () => {
      if (this.upgradeToast !== toast) return;
      text.setColor(Palette.cream);
      toast.destroy();
      this.upgradeToast = null;
    });
  }

  showBanner(title: string, subtitle = '', artKey?: TitleKey): void {
    this.banner?.destroy();
    const scene = this.root.scene;
    const reducedMotion = prefersReducedMotion();
    const banner = scene.add
      .container(DESIGN_SIZE.width / 2, 190)
      .setDepth(55)
      .setScale(reducedMotion ? 1 : 0.7)
      .setAlpha(reducedMotion ? 1 : 0);
    const ribbon = scene.add.graphics();
    ribbon.fillStyle(0x26180f, 0.9).fillRoundedRect(-250, -54, 500, subtitle ? 108 : 78, 18);
    ribbon.lineStyle(4, 0xd9a441, 0.95).strokeRoundedRect(-250, -54, 500, subtitle ? 108 : 78, 18);
    ribbon.lineStyle(1, 0xf6e7c8, 0.5).strokeRoundedRect(-239, -43, 478, subtitle ? 86 : 56, 12);
    ribbon.fillStyle(0x6fae4e, 1).fillTriangle(-250, -14, -286, -34, -250, -38);
    ribbon.fillStyle(0x6fae4e, 1).fillTriangle(250, -14, 286, -34, 250, -38);
    const heading = artKey
      ? createArtHeading(scene, 0, subtitle ? -17 : 0, artKey, 270, 66)
      : scene.add.text(0, subtitle ? -21 : 0, title, { ...creamStyle(38, true), align: 'center' }).setOrigin(0.5);
    banner.add([ribbon, heading]);
    if (subtitle) {
      banner.add(scene.add.text(0, 27, subtitle, { ...creamStyle(17, true), color: '#f0c96f' }).setOrigin(0.5));
    }
    this.banner = banner;
    this.root.add(this.banner);
    if (reducedMotion) {
      scene.time.delayedCall(1700, () => {
        if (this.banner !== banner) return;
        this.banner?.destroy();
        this.banner = null;
      });
    } else {
      scene.tweens.add({ targets: this.banner, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' });
      scene.tweens.add({
        targets: this.banner,
        alpha: 0,
        y: 170,
        delay: 1300,
        duration: 400,
        onComplete: () => {
          if (this.banner !== banner) return;
          this.banner?.destroy();
          this.banner = null;
        }
      });
    }
  }

  flashBase(): void {
    const scene = this.root.scene;
    if (prefersReducedMotion()) {
      this.hpText.setColor(Palette.danger);
      scene.time.delayedCall(320, () => this.hpText.setColor(Palette.cream));
      return;
    }
    const flash = scene.add
      .rectangle(DESIGN_SIZE.width / 2, DESIGN_SIZE.height / 2, DESIGN_SIZE.width, DESIGN_SIZE.height, 0xe04a3a, 0.22)
      .setDepth(45);
    this.root.add(flash);
    scene.tweens.add({ targets: flash, alpha: 0, duration: 320, onComplete: () => flash.destroy() });
  }

  destroy(): void {
    this.banner?.destroy();
    this.banner = null;
    this.upgradeToast?.destroy();
    this.upgradeToast = null;
    this.root.destroy();
  }
}
