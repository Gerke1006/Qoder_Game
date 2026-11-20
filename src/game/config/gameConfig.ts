import * as Phaser from 'phaser';
import { DESIGN_SIZE } from '../types';
import { BootScene } from '../scenes/BootScene';
import { PreloadScene } from '../scenes/PreloadScene';
import { MainMenuScene } from '../scenes/MainMenuScene';
import { BattleScene } from '../scenes/BattleScene';
import { ResultScene } from '../scenes/ResultScene';

/**
 * Phaser 游戏配置：尺寸、渲染、缩放与场景注册表。
 *
 * 约定：
 * - 逻辑分辨率固定为 DESIGN_SIZE（types/index.ts），画面适配完全交给 Scale.FIT，
 *   因此场景与 UI 内部一律使用设计坐标，不需要关心浏览器窗口实际像素。
 * - 新增场景只在下面的 scene 数组里登记一行，场景之间用 SceneKeys 互相引用。
 */
export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  backgroundColor: '#141f10',

  // 音效全部由 systems/AudioSystem 用 WebAudio 合成，Phaser 音频管理器关闭以免重复占用上下文。
  audio: { noAudio: true },

  width: DESIGN_SIZE.width,
  height: DESIGN_SIZE.height,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },

  scene: [BootScene, PreloadScene, MainMenuScene, BattleScene, ResultScene]
};
