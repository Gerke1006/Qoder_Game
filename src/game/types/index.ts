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

/** 运行时占位纹理 key（由 utils/PlaceholderTextures 用 Graphics 生成，无外部图片）。 */
export const AssetKeys = {
  Player: 'tex-player',
  Enemy: 'tex-enemy',
  Boss: 'tex-boss',
  Projectile: 'tex-projectile',
  Base: 'tex-base'
} as const;

export type AssetKey = (typeof AssetKeys)[keyof typeof AssetKeys];

/** 设计分辨率：所有场景坐标与 UI 布局都基于此尺寸，缩放交给 Phaser Scale FIT。 */
export const DESIGN_SIZE = { width: 960, height: 540 } as const;

/** 一局游戏所处的阶段，GameState 用它表示当前游戏阶段。 */
export type GamePhase = 'idle' | 'battle' | 'reward' | 'finished';

export interface Vec2 {
  x: number;
  y: number;
}

/** 可被造成伤害的对象：CombatSystem 只依赖这个最小接口，不依赖具体实体类。 */
export interface Damageable {
  hp: number;
  maxHp: number;
  alive: boolean;
  /** 承受一次伤害，内部负责扣血与死亡判定。 */
  takeDamage(amount: number): void;
}

/** 敌人类型，与 data/EnemyConfig 的键一一对应。 */
export type EnemyType = 'grunt' | 'runner' | 'boss';

/** 单个敌人的属性配置。 */
export interface EnemyStats {
  type: EnemyType;
  name: string;
  maxHp: number;
  /** 每秒移动像素，用于后续移动系统。 */
  speed: number;
  /** 撞击基地时造成的伤害。 */
  damage: number;
  /** 击杀后获得的金币。 */
  goldReward: number;
  /** 占位纹理尺寸。 */
  size: number;
}

/** 一波敌人的生成规则。 */
export interface WaveDefinition {
  index: number;
  label: string;
  /** 本波各类型敌人的数量。 */
  spawns: Partial<Record<EnemyType, number>>;
  /** 同波内相邻敌人的生成间隔（毫秒）。 */
  spawnIntervalMs: number;
  /** 本波结束到下一波开始的准备时间（毫秒）。 */
  breakMs: number;
}

export type UpgradeEffect =
  | { kind: 'baseHp'; value: number }
  | { kind: 'gold'; value: number }
  | { kind: 'damage'; value: number };

/** 一项可选奖励。 */
export interface RewardOption {
  id: string;
  title: string;
  description: string;
  /** 该奖励的稀有度权重，数值越大越稀有。 */
  rarity: number;
  effect: UpgradeEffect;
}

/** 一局游戏的共享运行状态（由 state/GameState 持有）。 */
export interface RunState {
  phase: GamePhase;
  /** 当前波次序号，从 0 开始；-1 表示尚未进入战斗。 */
  currentWave: number;
  totalWaves: number;
  baseHp: number;
  baseMaxHp: number;
  gold: number;
  /** 本局累计的攻击伤害加成，由 UpgradeSystem 写入、射击逻辑读取。 */
  attackDamageBonus: number;
  /** 本局已选奖励 id，用于结算展示与后续去重。 */
  takenRewardIds: string[];
}
