import * as Phaser from 'phaser';
import { DESIGN_SIZE, SceneKeys } from '../types';
import { getRunState, resetRun, setPhase } from '../state/GameState';
import { createTextButton, createTitleText } from '../ui/Button';
import { UpgradePanel } from '../ui/UpgradePanel';

/**
 * 结算场景：展示本局结果与已获得的强化，并提供返回主菜单。
 *
 * 当前只有基础占位：胜负原因、时长、评分等留待玩法成型后补充。
 * 本场景只读 GameState，不产生任何玩法副作用；返回主菜单时才重置状态。
 */
export class ResultScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Result);
  }

  create(): void {
    const { width, height } = DESIGN_SIZE;
    const state = getRunState();

    createTitleText(this, width / 2, height * 0.2, '本局结束', '44px');

    const waveSummary =
      state.currentWave < 0 ? '未进入波次' : `坚守至 ${state.currentWave + 1}/${state.totalWaves} 波`;

    this.add
      .text(
        width / 2,
        height * 0.2 + 56,
        `${waveSummary} · 剩余金币 ${state.gold} · 基地 ${state.baseHp}/${state.baseMaxHp}`,
        {
          fontFamily: 'system-ui, "Microsoft YaHei", sans-serif',
          fontSize: '20px',
          color: '#c9d3e4'
        }
      )
      .setOrigin(0.5);

    const upgradePanel = new UpgradePanel(this, width / 2, height * 0.46);
    upgradePanel.render(state.takenRewardIds);

    createTextButton(this, width / 2, height * 0.82, '返回主菜单', () => {
      resetRun();
      setPhase('idle');
      this.scene.start(SceneKeys.MainMenu);
    });
  }
}
