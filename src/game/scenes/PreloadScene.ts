import * as Phaser from 'phaser';
import { DESIGN_SIZE, SceneKeys, type AssetKey } from '../types';
import { assetUrl } from '../utils/assetUrl';
import { createPlaceholderTextures } from '../utils/PlaceholderTextures';

/**
 * 正式美术登记表。
 *
 * 把图片放进 public/assets/images/ 后，在这里补一行 { key, file }，
 * key 复用 AssetKeys（同 key 会覆盖占位纹理），场景代码无需任何改动。
 */
interface ImageAsset {
  key: AssetKey;
  file: string;
}

const IMAGE_ASSETS: ImageAsset[] = [];

/**
 * 预加载场景：所有外部资源的唯一加载入口。
 *
 * 职责：加载资源 + 生成本阶段必需的占位纹理，然后进入主菜单。
 * 不画任何界面元素。
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Preload);
  }

  preload(): void {
    const info = this.add
      .text(DESIGN_SIZE.width / 2, DESIGN_SIZE.height / 2, '资源加载中…', {
        fontFamily: 'system-ui, "Microsoft YaHei", sans-serif',
        fontSize: '24px',
        color: '#8b96ab'
      })
      .setOrigin(0.5);

    // 文本在 preload 期间不参与渲染循环，靠这一行保证切换前能看到提示。
    this.load.once('complete', () => info.destroy());

    for (const { key, file } of IMAGE_ASSETS) {
      this.load.image(key, assetUrl('images', file));
    }
  }

  create(): void {
    createPlaceholderTextures(this);

    // 音频、字体等后续按需在本场景加载；当前没有正式素材，故不注册任何外部文件。
    this.scene.start(SceneKeys.MainMenu);
  }
}
