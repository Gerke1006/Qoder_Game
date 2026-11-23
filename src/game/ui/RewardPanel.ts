import * as Phaser from 'phaser';
import { DESIGN_SIZE, TitleKeys, type RewardOption } from '../types';
import { RARITY_LABEL, rarityFrame, rewardIcon } from '../data/RewardConfig';
import { createArtHeading, creamStyle, inkStyle, Palette, prefersReducedMotion, RARITY_COLOR } from './Theme';
import { getRunState } from '../state/GameState';
import { PLAYER_CONFIG } from '../data/PlayerConfig';

/**
 * 波次结算奖励面板：遮罩 + 三张稀有度卡框。
 *
 * 卡框 / 内衬 / 效果图标全部来自交付美术；悬停抬升 + 稀有度光晕，
 * 支持鼠标点选与键盘 1/2/3 快选。hide 时解绑键盘并销毁全部对象。
 */
export class RewardPanel {
  private scene: Phaser.Scene;
  private root: Phaser.GameObjects.Container | null = null;
  private keyHandler: ((event: KeyboardEvent) => void) | null = null;
  private locked = false;
  private onDismiss: (() => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  get visible(): boolean {
    return this.root !== null;
  }

  show(rewards: RewardOption[], onPick: (reward: RewardOption) => void, onDismiss?: () => void): void {
    this.hide();
    this.locked = false;
    const reducedMotion = prefersReducedMotion();
    const root = this.scene.add.container(0, 0).setDepth(80);
    this.root = root;

    const scrim = this.scene.add
      .rectangle(DESIGN_SIZE.width / 2, DESIGN_SIZE.height / 2, DESIGN_SIZE.width, DESIGN_SIZE.height, 0x0c1206, 0)
      .setInteractive();
    root.add(scrim);
    this.onDismiss = onDismiss ?? null;
    if (onDismiss) scrim.on(Phaser.Input.Events.POINTER_DOWN, () => this.dismiss());
    if (reducedMotion) {
      scrim.setFillStyle(0x0c1206, 0.66);
    } else {
      this.scene.tweens.add({ targets: scrim, fillAlpha: 0.66, duration: 240 });
    }

    const title = createArtHeading(this.scene, DESIGN_SIZE.width / 2, 65, TitleKeys.Reward, 320, 76).setAlpha(0);
    const hint = this.scene.add
      .text(DESIGN_SIZE.width / 2, 108, onDismiss ? '点击卡片或按 1 / 2 / 3 选择 · 点击空白或按 ESC 跳过' : '点击卡片或按 1 / 2 / 3 选择', {
        fontFamily: '"Microsoft YaHei", "PingFang SC", system-ui, sans-serif',
        fontSize: '14px',
        color: Palette.parchmentDark
      })
      .setOrigin(0.5)
      .setAlpha(0);
    root.add([title, hint]);
    if (reducedMotion) {
      title.setAlpha(1);
      hint.setAlpha(1);
    } else {
      this.scene.tweens.add({ targets: [title, hint], alpha: 1, duration: 300, delay: 120 });
    }

    const cardW = 190;
    const cardH = 316;
    const gap = 252;
    rewards.forEach((reward, i) => {
      const x = DESIGN_SIZE.width / 2 + (i - (rewards.length - 1) / 2) * gap;
      const card = this.buildCard(reward, cardW, cardH);
      card.setData('rewardId', reward.id);
      const badge = this.scene.add.circle(-62, -114, 13, 0x4a2f1b, 0.94);
      const shortcut = this.scene.add.text(-62, -114, `${i + 1}`, creamStyle(14, true)).setOrigin(0.5);
      card.add([badge, shortcut]);
      card.setPosition(x, 306);
      card.setAlpha(reducedMotion ? 1 : 0).setScale(reducedMotion ? 1 : 0.7);
      root.add(card);
      if (!reducedMotion) {
        this.scene.tweens.add({
          targets: card,
          alpha: 1,
          scale: 1,
          duration: 320,
          delay: 140 + i * 110,
          ease: 'Back.easeOut'
        });
      }

      let picked = false;
      const choose = (): void => {
        if (picked || this.locked || !this.root) {
          return;
        }
        picked = true;
        this.locked = true;
        this.scene.tweens.killTweensOf(card);
        if (reducedMotion) {
          card.setScale(1).setAlpha(0);
          onPick(reward);
        } else {
          this.scene.tweens.add({
            targets: card,
            scale: 1.16,
            alpha: 0,
            duration: 220,
            ease: 'Quad.easeIn'
          });
          this.scene.time.delayedCall(180, () => onPick(reward));
        }
      };

      card.setInteractive({ useHandCursor: true });
      card.on(Phaser.Input.Events.POINTER_OVER, () => {
        if (picked || this.locked) {
          return;
        }
        if (!reducedMotion) {
          this.scene.tweens.killTweensOf(card);
          card.setAlpha(1);
          this.scene.tweens.add({ targets: card, y: 296, scale: 1.06, duration: 140, ease: 'Quad.easeOut' });
        }
        const glow = card.getByName('glow') as Phaser.GameObjects.Image;
        if (reducedMotion) glow.setAlpha(0.5);
        else this.scene.tweens.add({ targets: glow, alpha: 0.5, duration: 140 });
      });
      card.on(Phaser.Input.Events.POINTER_OUT, () => {
        if (picked || this.locked) {
          return;
        }
        if (!reducedMotion) {
          this.scene.tweens.killTweensOf(card);
          this.scene.tweens.add({ targets: card, y: 306, scale: 1, duration: 140, ease: 'Quad.easeOut' });
        }
        const glow = card.getByName('glow') as Phaser.GameObjects.Image;
        if (reducedMotion) glow.setAlpha(0);
        else this.scene.tweens.add({ targets: glow, alpha: 0, duration: 140 });
      });
      card.on(Phaser.Input.Events.POINTER_DOWN, () => {
        if (!picked && !this.locked) {
          if (!reducedMotion) card.setScale(0.98);
          choose();
        }
      });
      card.setData('choose', choose);
    });

    this.keyHandler = (event: KeyboardEvent): void => {
      if (event.repeat) return;
      const index = ['1', '2', '3'].indexOf(event.key);
      if (index >= 0 && index < rewards.length && this.root && !this.locked) {
        const card = root.list.filter((obj) => obj.getData('choose'))[index] as Phaser.GameObjects.Container;
        (card.getData('choose') as () => void)();
      }
    };
    window.addEventListener('keydown', this.keyHandler);
  }

  private buildCard(reward: RewardOption, w: number, h: number): Phaser.GameObjects.Container {
    const color = Phaser.Display.Color.HexStringToColor(RARITY_COLOR[reward.rarity]).color;
    const glow = this.scene.add
      .image(0, 0, 'tex-spark')
      .setDisplaySize(w * 1.7, h * 1.4)
      .setTint(color)
      .setAlpha(0)
      .setName('glow');
    const insetX = w * 0.085;
    const insetY = reward.rarity === 'epic' ? h * 0.1 : h * 0.06;
    const fill = this.scene.add.image(0, 0, 'tex-card-fill').setDisplaySize(w - insetX * 2, h - insetY * 2);
    const frame = this.scene.add.image(0, 0, rarityFrame(reward.rarity)).setDisplaySize(w, h);
    const icon = this.scene.add.image(0, -88, rewardIcon(reward.effect)).setDisplaySize(60, 60);
    const title = this.scene.add.text(0, -46, reward.title, inkStyle(19, true)).setOrigin(0.5);
    const desc = this.scene.add
      .text(0, -22, reward.description, { ...inkStyle(13), color: Palette.inkSoft, align: 'center', wordWrap: { width: w - 56 } })
      .setOrigin(0.5, 0);
    const rarity = this.scene.add
      .text(0, h / 2 - 54, RARITY_LABEL[reward.rarity], {
        ...inkStyle(13, true),
        color: RARITY_COLOR[reward.rarity]
      })
      .setOrigin(0.5);
    const state = getRunState();
    const { kind, value } = reward.effect;
    const current = { baseHp: state.baseMaxHp, gold: state.gold, damage: PLAYER_CONFIG.baseDamage + state.attackDamageBonus,
      speed: PLAYER_CONFIG.fireRate + state.fireRateBonus, defense: state.baseDefense }[kind];
    const label = { baseHp: '生命上限', gold: '金币', damage: '攻击力', speed: '每秒射击', defense: '基地防御' }[kind];
    const format = (number: number): string => kind === 'speed' ? number.toFixed(1) : `${number}`;
    const preview = this.scene.add.text(0, 68, `${label}\n${format(current)} → ${format(current + value)}`, {
      ...inkStyle(16, true), align: 'center', lineSpacing: 5
    }).setOrigin(0.5).setName('reward-preview');
    const container = this.scene.add.container(0, 0, [glow, fill, frame, icon, title, desc, preview, rarity]);
    container.setSize(w, h);
    return container;
  }

  dismiss(): void {
    if (this.locked || !this.root || !this.onDismiss) return;
    const onDismiss = this.onDismiss;
    this.locked = true;
    this.hide();
    onDismiss();
  }

  hide(): void {
    this.onDismiss = null;
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
    this.root?.destroy();
    this.root = null;
  }

  destroy(): void {
    this.hide();
  }
}
