import * as Phaser from 'phaser';
import { DESIGN_SIZE } from '../types';
import { audio } from '../systems/AudioSystem';
import { createArtButton, type ArtButton } from './Button';
import { createPanel, inkStyle, Palette, prefersReducedMotion } from './Theme';

/**
 * 暂停面板：继续 / 重新开始 / 返回主菜单 / 静音开关。
 * 遮罩拦截战场点击；ESC 的监听由 BattleScene 持有，这里只负责展示与回调。
 */
export interface PauseCallbacks {
  onResume(): void;
  onRestart(): void;
  onMenu(): void;
  onMute(): void;
}

export class PausePanel {
  private scene: Phaser.Scene;
  private root: Phaser.GameObjects.Container | null = null;
  private muteButton: ArtButton | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  get visible(): boolean {
    return this.root !== null;
  }

  show(callbacks: PauseCallbacks): void {
    this.hide();
    const root = this.scene.add.container(0, 0).setDepth(90);
    this.root = root;

    const scrim = this.scene.add
      .rectangle(DESIGN_SIZE.width / 2, DESIGN_SIZE.height / 2, DESIGN_SIZE.width, DESIGN_SIZE.height, 0x0c1206, 0.7)
      .setInteractive();
    const panel = createPanel(this.scene, DESIGN_SIZE.width / 2, 270, 520, 380);
    root.add([scrim, panel]);

    const cx = DESIGN_SIZE.width / 2;
    const title = this.scene.add.text(cx, 170, '暂停', inkStyle(28, true)).setOrigin(0.5);
    const resume = createArtButton(this.scene, cx, 214, '继续战斗', callbacks.onResume, { width: 280, height: 46, fontSize: 18 });
    const restart = createArtButton(this.scene, cx, 264, '重新开始', callbacks.onRestart, { width: 280, height: 46, fontSize: 18 });
    const menu = createArtButton(this.scene, cx, 314, '返回主菜单', callbacks.onMenu, { width: 280, height: 46, fontSize: 18 });
    this.muteButton = createArtButton(this.scene, cx, 358, '', callbacks.onMute, { width: 220, height: 40, fontSize: 15 });
    const hint = this.scene.add
      .text(cx, 392, '按 ESC 继续', { ...inkStyle(12), color: Palette.inkSoft })
      .setOrigin(0.5);
    root.add([title, resume.container, restart.container, menu.container, this.muteButton.container, hint]);
    this.syncMute();

    if (prefersReducedMotion()) {
      root.setAlpha(1).setScale(1);
    } else {
      root.setAlpha(0).setScale(0.94);
      this.scene.tweens.add({ targets: root, alpha: 1, scale: 1, duration: 180, ease: 'Quad.easeOut' });
    }
  }

  syncMute(): void {
    this.muteButton?.setLabel(audio.isMuted() ? '♪ 音效已静音' : '♪ 音效开启');
  }

  hide(): void {
    this.root?.destroy();
    this.root = null;
    this.muteButton = null;
  }

  destroy(): void {
    this.hide();
  }
}
