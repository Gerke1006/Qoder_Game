import * as Phaser from 'phaser';
import { AssetKeys, DESIGN_SIZE } from '../types';
import { prefersReducedMotion } from './Theme';

const BAR_WIDTH = 560;
const BAR_HEIGHT = 28;
const BAR_Y = 324;

/**
 * Preload-only progress presentation. It starts with a Graphics fallback so
 * the first frame is visible before the bar textures themselves finish loading.
 */
export class LoadingBar {
  private readonly scene: Phaser.Scene;
  private readonly centerX: number;
  private readonly fallback: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly percent: Phaser.GameObjects.Text;
  private readonly status: Phaser.GameObjects.Text;
  private icon: Phaser.GameObjects.Image | null = null;
  private track: Phaser.GameObjects.Image | null = null;
  private fill: Phaser.GameObjects.Image | null = null;
  private frame: Phaser.GameObjects.Image | null = null;
  private progress = 0;
  private usingTextures = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.centerX = DESIGN_SIZE.width / 2;
    this.fallback = scene.add.graphics();

    this.title = scene.add
      .text(this.centerX, 224, '正在加载...', {
        color: '#fff0b0',
        fontFamily: 'Georgia, "Microsoft YaHei", serif',
        fontSize: '34px',
        fontStyle: 'bold',
        stroke: '#3a2116',
        strokeThickness: 8
      })
      .setOrigin(0.5)
      .setShadow(0, 3, '#1b120e', 5, true, true);

    this.percent = scene.add
      .text(this.centerX, BAR_Y + 37, '0%', {
        color: '#f8df9a',
        fontFamily: 'system-ui, "Microsoft YaHei", sans-serif',
        fontSize: '16px',
        fontStyle: 'bold',
        stroke: '#25180f',
        strokeThickness: 4
      })
      .setOrigin(0.5);

    this.status = scene.add
      .text(this.centerX, BAR_Y + 65, '正在准备资源', {
        color: '#d8c9a0',
        fontFamily: 'system-ui, "Microsoft YaHei", sans-serif',
        fontSize: '14px'
      })
      .setOrigin(0.5);

    this.drawFallback();
  }

  /** Update progress with a clamped value in the inclusive 0..1 range. */
  setProgress(value: number): void {
    this.progress = Phaser.Math.Clamp(Number.isFinite(value) ? value : 0, 0, 1);
    const percent = Math.round(this.progress * 100);
    this.percent.setText(`${percent}%`);

    if (this.usingTextures && this.fill) {
      this.fill.setDisplaySize(BAR_WIDTH * this.progress, BAR_HEIGHT);
    } else {
      this.drawFallback();
    }
  }

  setStatus(message: string, color = '#d8c9a0'): void {
    this.status.setColor(color).setText(message);
  }

  /**
   * Swap the fallback bar for the authored textures once all three bar files
   * are available. The icon can appear independently as soon as it is ready.
   */
  useLoadedTextures(): void {
    if (!this.icon && this.scene.textures.exists(AssetKeys.PreloadIcon)) {
      this.icon = this.scene.add
        .image(this.centerX + 245, 218, AssetKeys.PreloadIcon)
        .setDisplaySize(66, 66)
        .setAngle(-5);
      if (!prefersReducedMotion()) {
        this.scene.tweens.add({ targets: this.icon, angle: 355, duration: 1800, repeat: -1, ease: 'Sine.easeInOut' });
      }
    }

    const hasBarTextures =
      this.scene.textures.exists(AssetKeys.PreloadBarTrack) &&
      this.scene.textures.exists(AssetKeys.PreloadBarFill) &&
      this.scene.textures.exists(AssetKeys.PreloadBarFrame);
    if (!hasBarTextures || this.usingTextures) return;

    this.usingTextures = true;
    this.fallback.setVisible(false);
    this.track = this.scene.add
      .image(this.centerX, BAR_Y, AssetKeys.PreloadBarTrack)
      .setDisplaySize(BAR_WIDTH, BAR_HEIGHT);
    this.fill = this.scene.add
      .image(this.centerX - BAR_WIDTH / 2, BAR_Y, AssetKeys.PreloadBarFill)
      .setOrigin(0, 0.5)
      .setDisplaySize(BAR_WIDTH * this.progress, BAR_HEIGHT);
    this.frame = this.scene.add
      .image(this.centerX, BAR_Y, AssetKeys.PreloadBarFrame)
      .setDisplaySize(BAR_WIDTH, BAR_HEIGHT);
    this.frame.setDepth(2);
    this.fill.setDepth(1);
    this.track.setDepth(0);
  }

  destroy(): void {
    this.fallback.destroy();
    this.title.destroy();
    this.percent.destroy();
    this.status.destroy();
    this.icon?.destroy();
    this.track?.destroy();
    this.fill?.destroy();
    this.frame?.destroy();
  }

  private drawFallback(): void {
    if (this.usingTextures) return;

    const left = this.centerX - BAR_WIDTH / 2;
    const top = BAR_Y - BAR_HEIGHT / 2;
    const fillWidth = BAR_WIDTH * this.progress;

    this.fallback.clear();
    this.fallback.fillStyle(0x2c1a12, 1).fillRoundedRect(left, top, BAR_WIDTH, BAR_HEIGHT, 12);
    this.fallback.lineStyle(3, 0xd1a151, 1).strokeRoundedRect(left, top, BAR_WIDTH, BAR_HEIGHT, 12);
    this.fallback.fillStyle(0x6eaf42, 1).fillRoundedRect(left + 5, top + 5, Math.max(0, fillWidth - 10), BAR_HEIGHT - 10, 8);
    this.fallback.lineStyle(1, 0xf1e79b, 0.55).lineBetween(left + 10, top + 7, left + Math.max(10, fillWidth - 10), top + 7);
  }
}
