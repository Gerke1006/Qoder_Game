# Roguelite 波次防守（Qoder_Game）

面向 2026 Qoder 高校创造力大赛的 2D Roguelite 波次防守游戏，由三名成员协作开发。

玩家守护基地，逐波抵御来袭敌人；每波结束后从随机奖励中选择一项强化，构建本局独特打法，失败后从头再来。

当前仓库处于**工程初始化阶段**：五个场景可以完整跑通，架构与数据配置已就位，战斗玩法尚未开发。

## 技术栈

| 用途 | 选型 | 版本 |
| --- | --- | --- |
| 开发语言 | TypeScript | ^5.9 |
| 2D 游戏框架 | Phaser 3 | ^3.90 |
| 构建 / 开发服务器 | Vite | ^8.3 |
| 入口与样式 | HTML5 + CSS | — |
| 版本控制 | Git | — |

说明：npm 上 `phaser` 的 `latest` 已经是 Phaser 4，本项目通过 `^3.90.0` 显式锁定 Phaser 3，请勿直接升级到 Phaser 4。

无后端、无数据库、无登录，产物是纯静态站点，可直接部署到 Qoder Sites。

## 目录结构

```text
.
├── public/assets/            # 静态素材（Vite 原样拷贝到站点根目录）
│   ├── images/
│   ├── audio/
│   └── fonts/
├── src/
│   ├── main.ts               # 应用入口：引样式 + new Phaser.Game
│   ├── styles/main.css       # 页面级样式（画布居中与铺满）
│   └── game/
│       ├── config/gameConfig.ts      # Phaser 配置与场景注册表
│       ├── scenes/                   # Boot / Preload / MainMenu / Battle / Result
│       ├── entities/                 # Player / Enemy / Boss / Projectile
│       ├── systems/                  # Combat / Wave / Reward / Upgrade
│       ├── state/GameState.ts        # 一局游戏的共享运行状态
│       ├── data/                     # EnemyConfig / WaveConfig / RewardConfig
│       ├── ui/                       # HUD / RewardPanel / UpgradePanel / Button
│       ├── types/index.ts            # 公共类型 + 场景 key + 资源 key
│       └── utils/                    # 占位纹理生成、资源路径等通用函数
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## 本地开发

```bash
npm install
npm run dev        # http://localhost:5173/
```

```bash
npm run build      # 先 tsc --noEmit 全量类型检查，再产出 dist/
npm run preview    # 本地起静态服务器验证 dist/ 产物
```

`npm run dev` 时会在浏览器挂上 `window.game`（Phaser 实例），可直接在控制台排查场景与状态；该句柄不会出现在 `npm run build` 的产物里。

## 模块职责

### 场景（scenes/）

| 场景 | 职责 |
| --- | --- |
| `BootScene` | 游戏唯一入口，只做全局一次性初始化，立刻转入 Preload |
| `PreloadScene` | 所有外部资源的唯一加载入口；无正式素材时生成占位纹理 |
| `MainMenuScene` | 标题 + 开始游戏；开局前重置一局状态 |
| `BattleScene` | 玩法主场景。目前只有场地、实体占位、HUD 与调试用结算入口 |
| `ResultScene` | 结算展示与返回主菜单；只读状态，不产生玩法副作用 |

场景之间只用 `SceneKeys` 互相引用，`gameConfig.ts` 集中注册，切换一律走 `this.scene.start()`。

### 实体（entities/）

只做"这个对象长什么样、有多少血"。数值来自 `data/EnemyConfig`，不在实体里写死。`Boss extends Enemy`，差异只有纹理与后续技能。`Projectile` 只负责飞行与越界自毁，命中判定不属于它。

### 系统（systems/）

| 系统 | 负责 | 明确不负责 |
| --- | --- | --- |
| `CombatSystem` | 伤害计算与结算（纯函数，只依赖 `Damageable` 接口） | 碰撞检测、开火时机 |
| `WaveSystem` | 把 `WaveConfig` 展开成生成队列、判断是否最后一波 | 创建实体、计时 |
| `RewardSystem` | 从奖励池挑候选，自动排除本局已获得项 | 修改任何状态 |
| `UpgradeSystem` | 全项目唯一允许写"奖励效果如何生效"的地方 | 挑选奖励、渲染 UI |

调用链固定为 `RewardSystem（选）→ RewardPanel（问）→ UpgradeSystem（改）→ GameState（记）→ HUD（显）`。

### 状态（state/GameState.ts）

一局运行的共享状态：阶段、当前波次、基地血量、金币、伤害加成、已选奖励。只提供读写函数，不含玩法判断、不依赖 Phaser，因此任何模块都能安全导入。当前不做存档。

### 数据配置（data/）

敌人属性、波次构成、奖励效果全部集中在 `EnemyConfig` / `WaveConfig` / `RewardConfig`。调数值只改这三处，不碰系统与场景代码。

### UI（ui/）

`HUD` 读状态渲染战况；`RewardPanel` 展示候选并回调选择结果；`UpgradePanel` 展示本局已获得强化；`Button` 是三者共用的文本按钮工厂。UI 一律不改状态、不做玩法判断。

## 美术资源接入方式

1. 把图片放进 `public/assets/images/`；
2. 在 `src/game/scenes/PreloadScene.ts` 的 `IMAGE_ASSETS` 数组里登记一行 `{ key, file }`；
3. `key` 复用 `AssetKeys`（同 key 会自动覆盖占位纹理），场景代码零改动。

素材路径统一由 `utils/assetUrl.ts` 拼接，保持相对路径，本地开发、构建产物与 Qoder Sites 子路径部署都能正确解析。

请勿从互联网直接抓取有版权风险的游戏素材。当前全部视觉元素由 Phaser Graphics 生成的占位色块构成。

## 三人协作约定

**目录归属**：一个人主改一个区域（例如 A 负责 scenes + systems，B 负责 entities + data，C 负责 ui + 素材），跨区改动先在对齐后再合并，减少冲突。

**分支**：`main` 保持可运行；功能分支命名 `feat/<模块>-<简述>`，例如 `feat/wave-spawn`。合并前本地必须通过 `npm run build`。

**改数值的正确位置**：敌人血量、速度、波次构成、奖励效果一律改 `data/*`。在场景或系统里出现硬编码数字视为需要修掉的问题。

**新增内容的正确位置**：

- 新敌人 → `data/EnemyConfig` 加条目，需要新行为才加 `entities/`；
- 新波次 → `data/WaveConfig` 加一条；
- 新奖励 → `data/RewardConfig` 加一条，若是新效果类型再给 `UpgradeSystem` 补一个分支；
- 新场景 → 写类 + 在 `types/index.ts` 的 `SceneKeys` 补 key + 在 `gameConfig.ts` 注册。

**事件与内存**：场景内自建的非 Phaser 托管监听（键盘、全局事件）必须在 `create` 里登记 `this.events.once(Phaser.Scenes.Events.SHUTDOWN, ...)` 做收尾；挂在游戏对象自身的 `pointerdown` 随对象销毁，不需要额外处理。禁止只加监听不加清理。

**类型**：公共类型只放 `src/game/types/index.ts`；禁止使用 `any`，确实需要未知类型时使用 `unknown` 再收窄。

**依赖**：新增第三方库需要先说明理由。当前依赖只有 `phaser` + `vite` + `typescript`。

**代码风格**：一个文件一个职责，不写"上帝文件"；注释只解释职责边界与非直观约束，不逐行翻译代码。

## 当前进度

已完成：工程配置与四个命令、五个场景的完整切换与清理、占位纹理、共享状态、三套数据配置、四个系统与调用边界、HUD 与两个面板、构建产物可静态部署。

未实现（下一步里程碑）：

1. 敌人移动与基地碰撞；
2. 玩家开火、弹道与命中判定（`Projectile.step` 与 `CombatSystem.applyDamage` 已就位，缺发射与碰撞检测）；
3. 波次时间轴推进（`WaveSystem.buildSpawnQueue` 已可产出队列，缺按 `spawnIntervalMs` 定时生成）；
4. 波次结束 → 奖励选择流程接入（`RewardPanel` 已可用但尚未接入 `BattleScene`）；
5. 胜负判定与结算内容；
6. 正式美术、音效与手感反馈。
