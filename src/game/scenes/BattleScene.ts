import * as Phaser from 'phaser';
import { AssetKeys, DESIGN_SIZE, SceneKeys } from '../types';
import { getEnemyStats } from '../data/EnemyConfig';
import { setPhase } from '../state/GameState';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { Boss } from '../entities/Boss';
import { HUD } from '../ui/HUD';
import { createTextButton } from '../ui/Button';

/**
 * 战斗场景：本项目的玩法主场景。
 *
 * 当前状态：只搭好"场地 + 实体占位 + HUD + 场景导航"，
 * 没有移动、射击、碰撞与波次推进——这些属于后续里程碑。
 *
 * 约定：
 * - 数值从 data/* 读，效果从 systems/* 调，共享状态从 state/GameState 走；
 * - 场景内不写死敌人数值，也不在场景里实现奖励逻辑。
 */
export class BattleScene extends Phaser.Scene {
  private hud: HUD | null = null;

  constructor() {
    super(SceneKeys.Battle);
  }

  create(): void {
    // 场景 shutdown 前收回自建监听与 HUD，避免切场景后残留重复事件。
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanUp());

    this.drawArena();
    this.spawnPlaceholders();

    this.hud = new HUD(this);

    createTextButton(this, DESIGN_SIZE.width - 120, DESIGN_SIZE.height - 40, '进入结算（调试）', () =>
      this.finishRun()
    );

    this.input.keyboard?.on('keydown-ESC', () => this.finishRun());
  }

  update(): void {
    this.hud?.refresh();
  }

  /** 结束本局并进入结算：后续胜负判定也收敛到这个入口。 */
  private finishRun(): void {
    setPhase('finished');
    this.scene.start(SceneKeys.Result);
  }

  private drawArena(): void {
    const { width, height } = DESIGN_SIZE;

    const ground = this.add.graphics();
    ground.fillStyle(0x1a2130).fillRect(0, 0, width, height);
    ground.lineStyle(1, 0x28324a, 1);
    for (let x = 0; x <= width; x += 60) {
      ground.lineBetween(x, 0, x, height);
    }
    for (let y = 0; y <= height; y += 60) {
      ground.lineBetween(0, y, width, y);
    }

    this.add
      .text(width / 2, 24, '战斗场景占位 · 玩法待开发', {
        fontFamily: 'system-ui, "Microsoft YaHei", sans-serif',
        fontSize: '20px',
        color: '#5c6a85'
      })
      .setOrigin(0.5);
  }

  /** 用真实实体类摆出静态占位，验证"配置 → 实体 → 渲染"链路可用。 */
  private spawnPlaceholders(): void {
    const { width, height } = DESIGN_SIZE;

    this.add.image(80, height / 2, AssetKeys.Base);
    new Player(this, 160, height / 2);

    const spots = [
      { x: width - 140, y: height / 2 - 90, type: 'grunt' as const },
      { x: width - 90, y: height / 2, type: 'runner' as const },
      { x: width - 150, y: height / 2 + 90, type: 'grunt' as const }
    ];
    for (const spot of spots) {
      new Enemy(this, getEnemyStats(spot.type), spot.x, spot.y);
    }
    new Boss(this, getEnemyStats('boss'), width - 240, height / 2);
  }

  /**
   * 场景 shutdown 时的收尾：显示列表对象由 Phaser 自动销毁，
   * 这里只处理 Phaser 管不到的部分——场景自建的键盘监听与 HUD 包装类。
   */
  private cleanUp(): void {
    this.input.keyboard?.off('keydown-ESC');
    this.hud?.destroy();
    this.hud = null;
  }
}
