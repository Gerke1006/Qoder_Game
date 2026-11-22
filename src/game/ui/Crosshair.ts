import * as Phaser from 'phaser';
import { UiKeys, type UiKey, type Vec2 } from '../types';

/**
 * 准星 + 瞄准线。
 *
 * 准星是一枚跟随指针的 reticle；瞄准线从起点（玩家）指向指针。
 * 整条线贴图横向拉伸会让虚线和箭头一起变形，所以拆成两段素材：
 * 单周期虚线（ui-aim-dash，38×24）用 TileSprite 按距离无缝平铺，
 * 末端接独立箭头（ui-aim-tip，28×24），箭头尖端正好落在指针上。
 *
 * 光标交给 Phaser 的 setDefaultCursor：战斗内隐藏，模态面板打开时交还。
 */
const DASH_PERIOD = 38;
const TIP_LEN = 28;
const AIM_DEPTH = 61;
const CROSSHAIR_DEPTH = 62;
const MIN_AIM_LEN = 44;

export interface CrosshairOptions {
  /** 瞄准线起点（世界坐标），通常取玩家位置。 */
  getOrigin: () => Vec2;
  /** reticle 显示边长。 */
  size?: number;
}

export class Crosshair {
  private readonly scene: Phaser.Scene;
  private readonly getOrigin: () => Vec2;
  private readonly reticle: Phaser.GameObjects.Image;
  private readonly dash: Phaser.GameObjects.TileSprite;
  private readonly tip: Phaser.GameObjects.Image;
  private shown = true;

  constructor(scene: Phaser.Scene, options: CrosshairOptions) {
    this.scene = scene;
    this.getOrigin = options.getOrigin;
    const size = options.size ?? 48;

    this.reticle = scene.add
      .image(0, 0, this.ensure(UiKeys.Crosshair, 'tex-crosshair-fallback', 64, 64, drawCrosshair))
      .setDisplaySize(size, size)
      .setDepth(CROSSHAIR_DEPTH);

    this.dash = scene.add
      .tileSprite(
        0,
        0,
        DASH_PERIOD,
        24,
        this.ensure(UiKeys.AimDash, 'tex-aim-dash-fallback', DASH_PERIOD, 24, drawDash)
      )
      .setOrigin(0, 0.5)
      .setDepth(AIM_DEPTH);

    this.tip = scene.add
      .image(0, 0, this.ensure(UiKeys.AimTip, 'tex-aim-tip-fallback', TIP_LEN, 24, drawTip))
      .setOrigin(0, 0.5)
      .setDepth(AIM_DEPTH);
  }

  /** 每帧：准星贴指针；瞄准线从起点旋到指针方向、按距离平铺，箭头尖端落在指针处。 */
  update(): void {
    if (!this.shown) {
      return;
    }
    this.scene.game.canvas.style.cursor = 'none';
    const p = this.scene.input.activePointer;
    this.reticle.setPosition(p.x, p.y);

    const o = this.getOrigin();
    const dx = p.x - o.x;
    const dy = p.y - o.y;
    const dist = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);

    if (dist < MIN_AIM_LEN) {
      this.dash.setVisible(false);
      this.tip.setVisible(false);
      return;
    }

    const dashLen = Math.max(0, dist - TIP_LEN);
    this.dash.setVisible(true).setPosition(o.x, o.y).setRotation(angle);
    this.dash.setSize(dashLen, 24);

    this.tip
      .setVisible(true)
      .setPosition(o.x + Math.cos(angle) * dashLen, o.y + Math.sin(angle) * dashLen)
      .setRotation(angle);
  }

  /** 模态面板（奖励 / 暂停）打开时隐藏准星与引导线，交还系统光标。 */
  setVisible(value: boolean): void {
    if (this.shown === value) {
      return;
    }
    this.shown = value;
    this.reticle.setVisible(value);
    this.dash.setVisible(value);
    this.tip.setVisible(value);
  }

  destroy(): void {
    this.reticle.destroy();
    this.dash.destroy();
    this.tip.destroy();
  }

  private ensure(
    key: UiKey,
    fallbackKey: string,
    w: number,
    h: number,
    draw: (g: Phaser.GameObjects.Graphics) => void
  ): string {
    if (this.scene.textures.exists(key)) {
      return key;
    }
    if (!this.scene.textures.exists(fallbackKey)) {
      const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
      draw(g);
      g.generateTexture(fallbackKey, w, h);
      g.destroy();
    }
    return fallbackKey;
  }
}

function drawCrosshair(g: Phaser.GameObjects.Graphics): void {
  g.lineStyle(4, 0xf3e2b8, 1).strokeCircle(32, 32, 22);
  g.lineBetween(32, 6, 32, 16);
  g.lineBetween(32, 48, 32, 58);
  g.lineBetween(6, 32, 16, 32);
  g.lineBetween(48, 32, 58, 32);
  g.fillStyle(0xe03428, 1).fillCircle(32, 32, 4);
}

function drawDash(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(0xbfb39a, 1).fillRoundedRect(0, 7, 27, 10, 5);
}

function drawTip(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(0xe0562a, 1).fillTriangle(0, 3, 0, 21, 27, 12);
}
