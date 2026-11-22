/**
 * 全局共享类型与常量。
 *
 * 约定：所有跨模块使用的字面量常量（场景 key、资源 key）都放在这里，
 * 这样 scenes / systems / ui 只依赖 types，不会互相拉进实现文件产生循环依赖。
 */

/** Phaser 场景注册 key，顺序即游戏启动流程。 */
export const SceneKeys = {
  Boot: 'Boot',
  Preload: 'Preload',
  MainMenu: 'MainMenu',
  Battle: 'Battle',
  Result: 'Result'
} as const;

export type SceneKey = (typeof SceneKeys)[keyof typeof SceneKeys];

/** 世界实体占位纹理 key（由 utils/GeneratedTextures 用 Graphics 生成）。 */
export const AssetKeys = {
  Player: 'tex-player',
  EnemyGrunt: 'tex-enemy-grunt',
  EnemyRunner: 'tex-enemy-runner',
  Boss: 'tex-boss',
  Projectile: 'tex-projectile',
  Ground: 'tex-ground',
  CardFill: 'tex-card-fill',
  Leaf: 'tex-leaf',
  Spark: 'tex-spark',
  PreloadBarTrack: 'preload-bar-track',
  PreloadBarFill: 'preload-bar-fill',
  PreloadBarFrame: 'preload-bar-frame',
  PreloadIcon: 'preload-icon'
} as const;

export type AssetKey = (typeof AssetKeys)[keyof typeof AssetKeys];

/** 交付美术切图后的 UI 资源 key（public/assets/images/ui）。 */
export const UiKeys = {
  PanelLarge: 'ui-panel-large',
  PanelSmall: 'ui-panel-small',
  BarTrough: 'ui-bar-trough',
  BarFrame: 'ui-bar-frame',
  BarFill: 'ui-bar-fill',
  IconGold: 'ui-icon-gold',
  IconBase: 'ui-icon-base',
  IconHeart: 'ui-icon-heart',
  IconDamage: 'ui-icon-damage',
  IconSpeed: 'ui-icon-speed',
  IconTime: 'ui-icon-time',
  IconWave: 'ui-icon-wave',
  FrameCommon: 'ui-frame-common',
  FrameRare: 'ui-frame-rare',
  FrameEpic: 'ui-frame-epic',
  Crosshair: 'ui-crosshair',
  AimDash: 'ui-aim-dash',
  AimTip: 'ui-aim-tip',
  Cooldown: 'ui-cooldown',
  IconDefense: 'ui-icon-defense',
  DmgCritBurst: 'ui-dmg-crit-burst',
  DmgTakenArrow: 'ui-dmg-taken-arrow'
} as const;

export type UiKey = (typeof UiKeys)[keyof typeof UiKeys];

/** 伤害飘字 BMFont key（public/assets/fonts）。 */
export const FontKeys = {
  Normal: 'font-dmg-normal',
  Crit: 'font-dmg-crit',
  Hit: 'font-dmg-hit'
} as const;

export type FontKey = (typeof FontKeys)[keyof typeof FontKeys];

/** 设计分辨率：所有场景坐标与 UI 布局都基于此尺寸，缩放交给 Phaser Scale FIT。 */
export const DESIGN_SIZE = { width: 960, height: 540 } as const;

/** 一局游戏所处的阶段，GameState 用它表示当前游戏阶段。 */
export type GamePhase = 'idle' | 'battle' | 'reward' | 'finished';

export type Difficulty = 'easy' | 'normal' | 'hard';

export type Rarity = 'common' | 'rare' | 'epic';

export interface Vec2 {
  x: number;
  y: number;
}

/** 可被造成伤害的对象：CombatSystem 只依赖这个最小接口，不依赖具体实体类。 */
export interface Damageable {
  hp: number;
  maxHp: number;
  alive: boolean;
  takeDamage(amount: number): void;
}

/** 敌人类型，与 data/EnemyConfig 的键一一对应。 */
export type EnemyType = 'grunt' | 'runner' | 'boss';

/** 单个敌人的属性配置。 */
export interface EnemyStats {
  type: EnemyType;
  name: string;
  maxHp: number;
  /** 每秒移动像素。 */
  speed: number;
  /** 撞击基地时造成的伤害。 */
  damage: number;
  /** 击杀后获得的金币。 */
  goldReward: number;
  /** 实体显示尺寸（像素）。 */
  size: number;
}

/** 一波敌人的生成规则。 */
export interface WaveDefinition {
  index: number;
  label: string;
  spawns: Partial<Record<EnemyType, number>>;
  spawnIntervalMs: number;
  breakMs: number;
}

export type UpgradeEffect =
  | { kind: 'baseHp'; value: number }
  | { kind: 'gold'; value: number }
  | { kind: 'damage'; value: number }
  | { kind: 'speed'; value: number };

/** 一项可选奖励。 */
export interface RewardOption {
  id: string;
  title: string;
  description: string;
  rarity: Rarity;
  effect: UpgradeEffect;
}

/** 一局游戏的共享运行状态（由 state/GameState 持有）。 */
export interface RunState {
  phase: GamePhase;
  difficulty: Difficulty;
  /** 当前波次序号，从 0 开始；-1 表示尚未进入战斗。 */
  currentWave: number;
  totalWaves: number;
  baseHp: number;
  baseMaxHp: number;
  gold: number;
  kills: number;
  elapsedMs: number;
  /** 本局累计的攻击伤害加成。 */
  attackDamageBonus: number;
  /** 本局累计的射速加成（发/秒）。 */
  fireRateBonus: number;
  takenRewardIds: string[];
}

/** 结算统计快照。 */
export interface RunSummary {
  win: boolean;
  wave: number;
  totalWaves: number;
  kills: number;
  gold: number;
  elapsedMs: number;
  takenRewardIds: string[];
}
