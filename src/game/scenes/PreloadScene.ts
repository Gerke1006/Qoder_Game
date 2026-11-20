import * as Phaser from 'phaser';
import { DESIGN_SIZE, FontKeys, SceneKeys, UiKeys } from '../types';
import { assetUrl } from '../utils/assetUrl';
import { createWorldTextures } from '../utils/GeneratedTextures';
import { Palette } from '../ui/Theme';

/**
 * 预加载场景：所有外部资源的唯一加载入口。
 *
 * 交付 UI 切图 + 三套伤害飘字 BMFont 在这里登记；
 * 世界纹理（角色 / 弹体 / 粒子 / 背景）在加载完成后一次性生成。
 */
const UI_IMAGES: Array<[string, string]> = [
  [UiKeys.PanelLarge, 'panel-large.png'],
  [UiKeys.PanelSmall, 'panel-small.png'],
  [UiKeys.BarTrough, 'bar-trough.png'],
  [UiKeys.BarFrame, 'bar-frame.png'],
  [UiKeys.BarFill, 'bar-fill.png'],
  [UiKeys.IconGold, 'icon-gold.png'],
  [UiKeys.IconBase, 'icon-base.png'],
  [UiKeys.IconHeart, 'icon-heart.png'],
  [UiKeys.IconDamage, 'icon-damage.png'],
  [UiKeys.IconSpeed, 'icon-speed.png'],
  [UiKeys.IconTime, 'icon-time.png'],
  [UiKeys.IconWave, 'icon-wave.png'],
  [UiKeys.FrameCommon, 'frame-common.png'],
  [UiKeys.FrameRare, 'frame-rare.png'],
  [UiKeys.FrameEpic, 'frame-epic.png'],
  [UiKeys.Crosshair, 'ui-crosshair.png'],
  [UiKeys.AimLine, 'ui-aimline.png'],
  [UiKeys.Cooldown, 'ui-cooldown.png']
];

const UI_FONTS: Array<[string, string]> = [
  [FontKeys.Normal, 'dmg-normal'],
  [FontKeys.Crit, 'dmg-crit'],
  [FontKeys.Hit, 'dmg-hit']
];

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Preload);
  }

  preload(): void {
    const cx = DESIGN_SIZE.width / 2;
    const cy = DESIGN_SIZE.height / 2;
    const label = this.add
      .text(cx, cy - 40, '正在布置林地…', {
        fontFamily: '"Microsoft YaHei", "PingFang SC", system-ui, sans-serif',
        fontSize: '22px',
        fontStyle: 'bold',
        color: Palette.cream
      })
      .setOrigin(0.5);

    const trough = this.add.graphics();
    trough.fillStyle(0x141f10, 1);
    trough.fillRoundedRect(cx - 180, cy, 360, 18, 9);
    const fill = this.add.graphics();

    this.load.on('progress', (value: number) => {
      fill.clear();
      fill.fillStyle(0x6fae4e, 1);
      fill.fillRoundedRect(cx - 178, cy + 2, Math.max(4, 356 * value), 14, 7);
    });
    this.load.once('complete', () => {
      label.destroy();
      trough.destroy();
      fill.destroy();
    });

    for (const [key, file] of UI_IMAGES) {
      this.load.image(key, assetUrl('images', `ui/${file}`));
    }
    for (const [key, base] of UI_FONTS) {
      this.load.bitmapFont(key, assetUrl('images', `ui/${base}.png`), assetUrl('fonts', `${base}.xml`));
    }
  }

  create(): void {
    createWorldTextures(this);
    this.scene.start(SceneKeys.MainMenu);
  }
}
