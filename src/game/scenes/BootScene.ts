import * as Phaser from 'phaser';
import { SceneKeys } from '../types';

/**
 * 启动场景：游戏唯一的入口场景。
 *
 * 职责：只做"全局一次性"的初始化（画布基础设置、后续可扩展的全局参数），
 * 然后立即进入 PreloadScene。不加载资源、不画界面。
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Boot);
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#10141c');

    // 启动阶段不依赖任何资源，直接交给预加载场景。
    this.scene.start(SceneKeys.Preload);
  }
}
