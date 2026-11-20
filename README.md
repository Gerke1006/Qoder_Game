# 林地守卫战（Qoder_Game）

面向 2026 Qoder 高校创造力大赛的 2D Roguelite 波次防守游戏，由三名成员协作开发。

玩家扮演林地弓手守护最后的城堡：按住左键朝准星射击，空格释放扇形箭雨；每波结束从三张稀有度卡牌中选一项强化，构建本局独特打法；打满 5 波并击败史莱姆王即守卫成功，基地血尽则失败重来。三档难度、最佳纪录持久化、暂停与一键静音齐备。

## 技术栈

| 用途 | 选型 | 版本 |
| --- | --- | --- |
| 开发语言 | TypeScript | ^5.9 |
| 2D 游戏框架 | Phaser 3 | ^3.90 |
| 构建 / 开发服务器 | Vite | ^8.3 |
| 入口与样式 | HTML5 + CSS | — |
| 音效 | WebAudio 实时合成（零音频文件） | — |
| 版本控制 | Git | — |

说明：npm 上 `phaser` 的 `latest` 已经是 Phaser 4，本项目通过 `^3.90.0` 显式锁定 Phaser 3，请勿直接升级到 Phaser 4。

无后端、无数据库、无登录，产物是纯静态站点，可直接部署到 Qoder Sites。

## 目录结构

```text
.
├── public/assets/            # 静态素材（Vite 原样拷贝到站点根目录）
│   ├── images/ui/            # 交付美术切图：面板 / 进度条 / 图标 / 卡框 / 准星 / 飘字数字条
│   ├── fonts/                # 伤害飘字 BMFont（AngelCode XML）
│   └── audio/                # 预留目录（音效当前由 WebAudio 合成）
├── scripts/slice-ui-assets.mjs  # 零依赖切图管线：整图 → 独立 PNG + BMFont
├── src/
│   ├── main.ts               # 应用入口：引样式 + new Phaser.Game + 首次手势解锁音频
│   ├── styles/main.css       # 页面级样式（林地色板、画布居中、滚动条）
│   └── game/
│       ├── config/gameConfig.ts      # Phaser 配置与场景注册表
│       ├── scenes/                   # Boot / Preload / MainMenu / Battle / Result
│       ├── entities/                 # Player / Enemy / Boss / Projectile
│       ├── systems/                  # Combat / Wave / Reward / Upgrade / Audio
│       ├── state/GameState.ts        # 一局游戏的共享运行状态
│       ├── data/                     # Enemy / Wave / Reward / Difficulty / Player 配置
│       ├── ui/                       # HUD / RewardPanel / UpgradePanel / PausePanel / Button / Bar / Theme 等
│       ├── types/index.ts            # 公共类型 + 场景 key + 资源 key
│       └── utils/                    # 世界纹理生成、资源路径、最佳纪录
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

## 操作方式

| 输入 | 行为 |
| --- | --- |
| 按住鼠标左键 | 朝准星方向连续射击（15% 暴击，双倍伤害） |
| 空格 / 右下角按钮 | 箭雨：10 支扇形箭，冷却 8 秒 |
| ESC / 顶栏暂停 | 暂停面板：继续 / 重新开始 / 返回主菜单 / 静音 |
| 顶栏 ♪ 按钮 | 一键静音全部音效与环境声，状态持久化 |
| 奖励面板 1 / 2 / 3 | 键盘快选强化卡 |
| 结算页 Enter / ESC | 再来一局 / 返回主菜单 |

## 模块职责

### 场景（scenes/）

| 场景 | 职责 |
| --- | --- |
| `BootScene` | 游戏唯一入口，只做全局一次性初始化，立刻转入 Preload |
| `PreloadScene` | 所有外部资源的唯一加载入口：UI 切图 + 三套 BMFont；加载完成后生成世界纹理 |
| `MainMenuScene` | 林地小景 + 标题 + 难度选择 + 玩法说明 + 最佳纪录；开局重置一局状态 |
| `BattleScene` | 玩法主循环：准备倒计时 → 波次生成 → 清波 → 三选一 → 下一波；胜负判定收敛到 `finish()` |
| `ResultScene` | 只消费 `RunSummary` 快照：胜负横幅、图标统计、强化记录、重开 / 回菜单 |

场景之间只用 `SceneKeys` 互相引用，`gameConfig.ts` 集中注册，切换一律走 `this.scene.start()`。

### 实体（entities/）

`Player` 只管形象与瞄准 / 后坐表现；`Enemy` 管外观、血条、向基地推进与死亡动画；`Boss extends Enemy` 额外周期召唤小怪（通过回调通知场景生成，不直接 new 敌人）；`Projectile` 只负责飞行与越界自毁。数值来自 `data/*`，不在实体里写死。

### 系统（systems/）

| 系统 | 负责 | 明确不负责 |
| --- | --- | --- |
| `CombatSystem` | 伤害计算、暴击掷骰与结算（纯函数，只依赖 `Damageable` 接口） | 碰撞检测、开火时机 |
| `WaveSystem` | 把 `WaveConfig` 展开成混编生成队列（首领压轴）、判断是否最后一波 | 创建实体、计时 |
| `RewardSystem` | 从奖励池挑候选，自动排除本局已获得项 | 修改任何状态 |
| `UpgradeSystem` | 全项目唯一允许写"奖励效果如何生效"的地方 | 挑选奖励、渲染 UI |
| `AudioSystem` | WebAudio 合成全部音效 + 林间环境声；静音持久化；全局单例不随场景重建 | 玩法判断 |

调用链固定为 `RewardSystem（选）→ RewardPanel（问）→ UpgradeSystem（改）→ GameState（记）→ HUD（显）`。

### 状态（state/GameState.ts）

一局运行的共享状态：阶段、难度、波次、基地血量、金币、击杀、用时、伤害 / 射速加成、已选奖励。只提供读写函数与 `getRunSummary()` 快照，不含玩法判断、不依赖 Phaser。最佳纪录单独存 localStorage（`utils/BestRecord.ts`），与一局状态解耦。

### 数据配置（data/）

敌人属性、波次构成、奖励效果、难度系数、玩家与技能数值集中在 `EnemyConfig` / `WaveConfig` / `RewardConfig` / `DifficultyConfig` / `PlayerConfig`。调数值只改这五处，不碰系统与场景代码。

### UI（ui/）

`Theme` 统一色板与文字样式（色相取自交付美术）；`Button` 是木框羊皮纸按钮工厂（四态反馈）；`Bar` 按原图比例换算槽 / 填充 / 金边三层；`HUD` 读状态渲染战况与技能冷却；`RewardPanel` 稀有度卡框三选一（含键盘快选与防连点锁）；`PausePanel` 暂停菜单；`UpgradePanel` 强化记录行；`FloatingText` 用 BMFont 渲染伤害 / 受击 / 金币飘字；`ForestBackground` 三场景共用林地背景。UI 一律不改状态、不做玩法判断。

## 美术资源接入方式

交付整图放在会话素材目录后，运行切图管线：

```bash
node scripts/slice-ui-assets.mjs inspect   # 打印每张整图的连通元素包围盒
node scripts/slice-ui-assets.mjs           # 按 SLICE_PLAN 裁切输出 PNG + BMFont
```

管线零第三方依赖（仅 Node 内置 zlib）：自写 PNG 编解码 + 连通域分析 + 列透明投影切分数字条，12 个字形可无缝拼回原条。美术换图后重跑即可，`SLICE_PLAN` 只负责命名与分组。

产物在 `public/assets/images/ui/` 与 `public/assets/fonts/`，由 `PreloadScene` 的 `UI_IMAGES` / `UI_FONTS` 登记表加载，key 复用 `types/index.ts` 的 `UiKeys` / `FontKeys`。战场角色 / 弹体 / 粒子 / 背景仍由 `utils/GeneratedTextures.ts` 代码绘制，保持零外部素材依赖。

素材路径统一由 `utils/assetUrl.ts` 拼接，保持相对路径，本地开发、构建产物与 Qoder Sites 子路径部署都能正确解析。请勿从互联网直接抓取有版权风险的游戏素材。

## 三人协作约定

**目录归属**：一个人主改一个区域（例如 A 负责 scenes + systems，B 负责 entities + data，C 负责 ui + 素材），跨区改动先对齐后再合并，减少冲突。

**分支**：`main` 保持可运行；功能分支命名 `feat/<模块>-<简述>`，例如 `feat/wave-spawn`。合并前本地必须通过 `npm run build`。

**改数值的正确位置**：敌人血量、速度、波次构成、奖励效果、难度系数、玩家数值一律改 `data/*`。在场景或系统里出现硬编码数字视为需要修掉的问题。

**新增内容的正确位置**：

- 新敌人 → `data/EnemyConfig` 加条目，需要新行为才加 `entities/`；
- 新波次 → `data/WaveConfig` 加一条；
- 新奖励 → `data/RewardConfig` 加一条，若是新效果类型再给 `UpgradeSystem` 补一个分支；
- 新场景 → 写类 + 在 `types/index.ts` 的 `SceneKeys` 补 key + 在 `gameConfig.ts` 注册；
- 新音效 → `AudioSystem` 的 `SfxName` 加一个分支，调用方只写 `audio.play('名字')`。

**事件与内存**：场景内自建的非 Phaser 托管监听（键盘、全局事件）必须在 `create` 里登记 `this.events.once(Phaser.Scenes.Events.SHUTDOWN, ...)` 做收尾；挂在游戏对象自身的 `pointerdown` 随对象销毁，不需要额外处理。禁止只加监听不加清理。

**类型**：公共类型只放 `src/game/types/index.ts`；禁止使用 `any`，确实需要未知类型时使用 `unknown` 再收窄。

**依赖**：新增第三方库需要先说明理由。当前依赖只有 `phaser` + `vite` + `typescript`。

**代码风格**：一个文件一个职责，不写"上帝文件"；注释只解释职责边界与非直观约束，不逐行翻译代码。

## 当前进度

已完成：完整可玩循环（5 波 + 首领 + 胜负 + 重开）、三档难度、三选一稀有度强化、箭雨技能与冷却、暂停 / 静音 / 最佳纪录、交付美术全量接入（面板 / 进度条 / 图标 / 卡框 / 准星 / 瞄准线 / 冷却罩 / 三套飘字）、WebAudio 合成音效与林间环境声、粒子 / 震屏 / 闪白 / 低血警示等手感反馈、构建产物可静态部署。
