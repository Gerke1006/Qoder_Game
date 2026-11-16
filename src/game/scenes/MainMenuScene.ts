import * as Phaser from 'phaser';
import { createTextButton, createTitleText } from '../ui/Button';
import { DESIGN_SIZE, SceneKeys } from '../types';
import { resetRun, setPhase } from '../state/GameState';

/**
 * 主菜单场景：标题 + 开始游戏。
 *
 * 职责：只负责入口导航。开始战斗前重置一局状态，保证每局从同一起点出发。
 */
export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.MainMenu);
  }

  create(): void {
    const { width, height } = DESIGN_SIZE;

    createTitleText(this, width / 2, height * 0.34, 'Roguelite 波次防守', '48px');
    this.add
      .text(width / 2, height * 0.34 + 52, '守住基地 · 逐波强化 · 每局重来', {
        fontFamily: 'system-ui, "Microsoft YaHei", sans-serif',
        fontSize: '18px',
        color: '#8b96ab'
      })
      .setOrigin(0.5);

    createTextButton(this, width / 2, height * 0.62, '开始游戏', () => {
      resetRun();
      setPhase('battle');
      this.scene.start(SceneKeys.Battle);
    });
  }
}
