import * as Phaser from 'phaser';
import { getRunState } from '../state/GameState';
import { WAVE_CONFIGS } from '../data/WaveConfig';

/**
 * 战斗内常驻信息层（HUD）。
 *
 * 职责：只读 GameState 并渲染，绝不修改状态、不做任何玩法判断。
 * 这样其他成员改数值逻辑时不需要动 UI，反之亦然。
 *
 * 用法：BattleScene 在 create 里 new HUD(scene)，在 update 里调用 refresh()。
 */
export class HUD {
  private readonly baseHpText: Phaser.GameObjects.Text;
  private readonly goldText: Phaser.GameObjects.Text;
  private readonly waveText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    const style: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: 'system-ui, "Microsoft YaHei", sans-serif',
      fontSize: '18px',
      color: '#c9d3e4'
    };

    this.baseHpText = scene.add.text(16, 12, '', style);
    this.goldText = scene.add.text(16, 36, '', style);
    this.waveText = scene.add.text(16, 60, '', style);

    this.refresh();
  }

  /** 依据当前 GameState 重绘三行信息；状态没变时重复赋值代价可忽略。 */
  refresh(): void {
    const state = getRunState();
    const waveText =
      state.currentWave < 0
        ? '准备中'
        : `${WAVE_CONFIGS[state.currentWave]?.label ?? '未知波次'}（${state.currentWave + 1}/${state.totalWaves}）`;

    this.baseHpText.setText(`基地 ${state.baseHp}/${state.baseMaxHp}`);
    this.goldText.setText(`金币 ${state.gold}`);
    this.waveText.setText(waveText);
  }

  /** 场景切换时调用，移除 HUD 自身创建的显示对象。 */
  destroy(): void {
    this.baseHpText.destroy();
    this.goldText.destroy();
    this.waveText.destroy();
  }
}
