import * as Phaser from 'phaser';
import { AssetKeys, DESIGN_SIZE, FontKeys, SceneKeys, UiKeys, type AssetKey } from '../types';
import { assetUrl } from '../utils/assetUrl';
import { createWorldTextures } from '../utils/GeneratedTextures';
import { LoadingBar } from '../ui/LoadingBar';

interface ImageAsset {
  key: AssetKey;
  file: string;
}

/** Formal art registry for this scene and the first playable slice. */
const IMAGE_ASSETS: ImageAsset[] = [
  { key: AssetKeys.PreloadBarTrack, file: 'preload/bar-track.png' },
  { key: AssetKeys.PreloadBarFill, file: 'preload/bar-fill.png' },
  { key: AssetKeys.PreloadBarFrame, file: 'preload/bar-frame.png' },
  { key: AssetKeys.PreloadIcon, file: 'preload/loading-icon.png' }
];

const UI_IMAGES: Array<[string, string]> = [
  [UiKeys.PanelLarge, 'panel-large.png'], [UiKeys.PanelSmall, 'panel-small.png'],
  [UiKeys.BarTrough, 'bar-trough.png'], [UiKeys.BarFrame, 'bar-frame.png'], [UiKeys.BarFill, 'bar-fill.png'],
  [UiKeys.IconGold, 'icon-gold.png'], [UiKeys.IconBase, 'icon-base.png'], [UiKeys.IconHeart, 'icon-heart.png'],
  [UiKeys.IconDamage, 'icon-damage.png'], [UiKeys.IconSpeed, 'icon-speed.png'], [UiKeys.IconTime, 'icon-time.png'],
  [UiKeys.IconWave, 'icon-wave.png'], [UiKeys.FrameCommon, 'frame-common.png'], [UiKeys.FrameRare, 'frame-rare.png'],
  [UiKeys.FrameEpic, 'frame-epic.png'], [UiKeys.Crosshair, 'ui-crosshair.png'],
  [UiKeys.AimDash, 'ui-aim-dash.png'], [UiKeys.AimTip, 'ui-aim-tip.png'], [UiKeys.Cooldown, 'ui-cooldown.png'],
  [UiKeys.IconDefense, 'icon_defense.png'], [UiKeys.DmgCritBurst, 'dmg_crit_burst.png'],
  [UiKeys.DmgTakenArrow, 'dmg_taken_arrow.png']
];

const UI_FONTS: Array<[string, string]> = [
  [FontKeys.Normal, 'dmg-normal'], [FontKeys.Crit, 'dmg-crit'], [FontKeys.Hit, 'dmg-hit']
];

const MIN_DISPLAY_MS = 500;

/**
 * Sole external-resource entry point. The scene owns only the loading
 * presentation and hands off to MainMenu once assets and placeholders exist.
 */
export class PreloadScene extends Phaser.Scene {
  private loadingBar: LoadingBar | null = null;
  private startedAt = 0;
  private loadFailed = false;

  constructor() {
    super(SceneKeys.Preload);
  }

  preload(): void {
    this.startedAt = performance.now();
    this.drawBackdrop();
    this.loadingBar = new LoadingBar(this);

    const handleProgress = (value: number) => this.loadingBar?.setProgress(value);
    const handleFileComplete = () => this.loadingBar?.useLoadedTextures();
    const handleLoadError = () => {
      this.loadFailed = true;
      this.loadingBar?.setStatus('部分素材加载失败，已使用安全样式', '#f5c26b');
    };
    const handleComplete = () => {
      this.loadingBar?.setProgress(1);
      if (!this.loadFailed) this.loadingBar?.setStatus('资源准备完成');
    };

    this.load.on('progress', handleProgress);
    this.load.on('filecomplete', handleFileComplete);
    this.load.on('loaderror', handleLoadError);
    this.load.once('complete', handleComplete);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.load.off('progress', handleProgress);
      this.load.off('filecomplete', handleFileComplete);
      this.load.off('loaderror', handleLoadError);
      this.loadingBar?.destroy();
      this.loadingBar = null;
    });

    for (const { key, file } of IMAGE_ASSETS) {
      this.load.image(key, assetUrl('images', file));
    }
    for (const [key, file] of UI_IMAGES) {
      this.load.image(key, assetUrl('images', `ui/${file}`));
    }
    for (const [key, base] of UI_FONTS) {
      this.load.bitmapFont(key, assetUrl('images', `ui/${base}.png`), assetUrl('fonts', `${base}.xml`));
    }
  }

  create(): void {
    createWorldTextures(this);

    const elapsed = performance.now() - this.startedAt;
    const remaining = Math.max(0, MIN_DISPLAY_MS - elapsed);
    this.time.delayedCall(remaining, () => this.scene.start(SceneKeys.MainMenu));
  }

  private drawBackdrop(): void {
    const { width, height } = DESIGN_SIZE;
    const backdrop = this.add.graphics();

    backdrop.fillStyle(0x15291f, 1).fillRect(0, 0, width, height);
    backdrop.fillStyle(0x21402c, 1).fillRect(0, 0, width, 170);
    backdrop.fillStyle(0x1b3526, 1).fillRect(0, 170, width, 210);
    backdrop.fillStyle(0x12231d, 1).fillRect(0, 380, width, 160);

    // Distant hills and castle silhouettes establish the requested fantasy mood.
    backdrop.fillStyle(0x315333, 1);
    backdrop.fillTriangle(0, 360, 180, 160, 380, 360);
    backdrop.fillTriangle(240, 360, 500, 135, 760, 360);
    backdrop.fillTriangle(600, 360, 820, 180, width, 360);
    backdrop.fillStyle(0x1a2e24, 1);
    backdrop.fillRect(754, 185, 28, 175);
    backdrop.fillRect(810, 220, 32, 140);
    backdrop.fillRect(784, 255, 74, 105);
    backdrop.fillTriangle(748, 185, 768, 150, 788, 185);
    backdrop.fillTriangle(804, 220, 826, 185, 848, 220);

    // Dark vignette bands keep the loading copy readable without adding a new asset.
    backdrop.fillStyle(0x0b1712, 0.32).fillRect(0, 0, width, 72);
    backdrop.fillStyle(0x0b1712, 0.42).fillRect(0, height - 62, width, 62);

    // Central wooden plaque with a gold edge, matching the reference UI language.
    backdrop.fillStyle(0x25170f, 0.78).fillRoundedRect(154, 112, 652, 314, 28);
    backdrop.lineStyle(5, 0x9c6b35, 0.95).strokeRoundedRect(154, 112, 652, 314, 28);
    backdrop.lineStyle(2, 0xe2b75d, 0.55).strokeRoundedRect(166, 124, 628, 290, 22);
    backdrop.fillStyle(0x5d371f, 1).fillRoundedRect(238, 163, 484, 96, 22);
    backdrop.lineStyle(3, 0xf0c96f, 0.95).strokeRoundedRect(238, 163, 484, 96, 22);
    backdrop.lineStyle(2, 0x2a180f, 0.8).strokeRoundedRect(248, 173, 464, 76, 16);

    // Small leafy ornaments frame the plaque without competing with the progress bar.
    for (const leaf of [
      { x: 208, y: 164, angle: -28 },
      { x: 228, y: 145, angle: -12 },
      { x: 752, y: 164, angle: 28 },
      { x: 732, y: 145, angle: 12 }
    ]) {
      backdrop.save();
      backdrop.translateCanvas(leaf.x, leaf.y);
      backdrop.rotateCanvas(Phaser.Math.DegToRad(leaf.angle));
      backdrop.fillStyle(0x6ba647, 1).fillEllipse(0, 0, 30, 13);
      backdrop.lineStyle(2, 0x274827, 0.8).strokeEllipse(0, 0, 30, 13);
      backdrop.restore();
    }
  }
}
