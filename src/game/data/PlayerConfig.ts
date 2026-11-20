/** 玩家与技能数值：场景只读这里，调平衡不改逻辑。 */
export const PLAYER_CONFIG = {
  /** 站位（设计坐标）。 */
  x: 168,
  y: 270,
  /** 单发基础伤害。 */
  baseDamage: 12,
  /** 基础射速（发/秒）。 */
  fireRate: 2.4,
  /** 弹体速度（像素/秒）：足够快，保证指向移动目标时弹道落点仍在命中半径内。 */
  projectileSpeed: 980,
  /** 箭雨：扇形弹数 / 单发伤害 / 冷却毫秒。 */
  skillArrows: 10,
  skillDamage: 10,
  skillCooldownMs: 8000
} as const;

/** 敌人抵达基地的判定线（设计坐标 x）。 */
export const BASE_LINE_X = 108;

/** 基地图标站位。 */
export const BASE_POSITION = { x: 62, y: 270 } as const;
