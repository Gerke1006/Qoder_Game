# -*- coding: utf-8 -*-
import io, sys

def patch(path, pairs):
    s = io.open(path, encoding='utf-8').read()
    for old, new in pairs:
        if s.count(old) != 1:
            sys.exit('%s anchor count=%d: %s' % (path, s.count(old), old[:70]))
        s = s.replace(old, new)
    io.open(path, 'w', encoding='utf-8', newline='\n').write(s)
    print('patched', path.rsplit('/', 1)[-1])

base = 'C:/Users/26646/Desktop/Qoder_Game-main/src/game/'

# ---- 主菜单：panel-large 64px 边框，正文全部落进羊皮纸安全区 ----
patch(base + 'scenes/MainMenuScene.ts', [
    ("""    createPanel(this, DESIGN_SIZE.width / 2, 104, 640, 200);
    createTitleText(this, DESIGN_SIZE.width / 2, 84, '林地守卫战', 44);
    this.add
      .text(DESIGN_SIZE.width / 2, 132, 'Roguelite 波次防守 · 守住最后的城堡', inkStyle(16))
      .setOrigin(0.5);
    this.add
      .text(DESIGN_SIZE.width / 2, 160, '五波来袭 · 三选一强化 · 击败史莱姆王', { ...inkStyle(13), color: Palette.inkSoft })
      .setOrigin(0.5);""",
     """    createPanel(this, DESIGN_SIZE.width / 2, 126, 640, 236);
    createTitleText(this, DESIGN_SIZE.width / 2, 92, '林地守卫战', 44);
    this.add
      .text(DESIGN_SIZE.width / 2, 140, 'Roguelite 波次防守 · 守住最后的城堡', inkStyle(16))
      .setOrigin(0.5);
    this.add
      .text(DESIGN_SIZE.width / 2, 170, '五波来袭 · 三选一强化 · 击败史莱姆王', { ...inkStyle(13), color: Palette.inkSoft })
      .setOrigin(0.5);"""),
    ("""        238,
        DIFFICULTY_CONFIGS[difficulty].label,""",
     """        272,
        DIFFICULTY_CONFIGS[difficulty].label,"""),
    ("""    this.descriptionText = this.add
      .text(DESIGN_SIZE.width / 2, 276, ''""",
     """    this.descriptionText = this.add
      .text(DESIGN_SIZE.width / 2, 306, ''"""),
    ("""    createArtButton(this, DESIGN_SIZE.width / 2, 346, '开始守卫', () => this.startRun(), { width: 300, fontSize: 24 });
    createArtButton(this, DESIGN_SIZE.width / 2, 442, '玩法说明', () => this.showHowto(), { width: 190, fontSize: 16 });""",
     """    createArtButton(this, DESIGN_SIZE.width / 2, 360, '开始守卫', () => this.startRun(), { width: 300, fontSize: 24 });
    createArtButton(this, DESIGN_SIZE.width / 2, 448, '玩法说明', () => this.showHowto(), { width: 190, fontSize: 16 });"""),
    ("""        DESIGN_SIZE.width / 2,
        508,
        best""",
     """        DESIGN_SIZE.width / 2,
        512,
        best"""),
    ("""    const panel = createPanel(this, DESIGN_SIZE.width / 2, 268, 660, 380);
    const title = createTitleText(this, DESIGN_SIZE.width / 2, 126, '玩法说明', 26);""",
     """    const panel = createPanel(this, DESIGN_SIZE.width / 2, 272, 680, 400);
    const title = createTitleText(this, DESIGN_SIZE.width / 2, 128, '玩法说明', 26);"""),
    ("""    const body = this.add
      .text(DESIGN_SIZE.width / 2, 182, lines.map((line) => `· ${line}`).join('\\n'), {""",
     """    const body = this.add
      .text(DESIGN_SIZE.width / 2, 176, lines.map((line) => `· ${line}`).join('\\n'), {"""),
    ("""    const close = createArtButton(this, DESIGN_SIZE.width / 2, 408, '明白了', () => this.hideHowto(), { width: 180, fontSize: 17 });""",
     """    const close = createArtButton(this, DESIGN_SIZE.width / 2, 412, '明白了', () => this.hideHowto(), { width: 180, height: 44, fontSize: 17 });"""),
])

# ---- 结算：面板加高，统计与强化列表落进安全区 ----
patch(base + 'scenes/ResultScene.ts', [
    ("""    createPanel(this, cx, 238, 720, 400);
    const title = this.add
      .text(cx, 92, this.summary.win ? '守卫成功！' : '基地陷落…', inkStyle(40, true))""",
     """    createPanel(this, cx, 228, 720, 420);
    const title = this.add
      .text(cx, 96, this.summary.win ? '守卫成功！' : '基地陷落…', inkStyle(40, true))"""),
    ("""      .text(cx, 132, `${DIFFICULTY_CONFIGS""",
     """      .text(cx, 134, `${DIFFICULTY_CONFIGS"""),
    ("""    const summary = createUpgradeSummary(this, cx - 250, 286, 500, this.summary.takenRewardIds);""",
     """    const summary = createUpgradeSummary(this, cx - 250, 272, 500, this.summary.takenRewardIds);"""),
    ("""    createArtButton(this, cx - 130, 486, '再来一局', () => this.restart(), { width: 240, fontSize: 20 });
    createArtButton(this, cx + 130, 486, '返回主菜单', () => this.toMenu(), { width: 240, fontSize: 20 });""",
     """    createArtButton(this, cx - 130, 490, '再来一局', () => this.restart(), { width: 240, height: 50, fontSize: 20 });
    createArtButton(this, cx + 130, 490, '返回主菜单', () => this.toMenu(), { width: 240, height: 50, fontSize: 20 });"""),
])

# ---- 暂停：改用羊皮纸主面板（深色木底小面板会让墨字看不清） ----
patch(base + 'ui/PausePanel.ts', [
    ("""    const panel = createPanel(this.scene, DESIGN_SIZE.width / 2, 268, 470, 336, UiKeys.PanelSmall);
    root.add([scrim, panel]);

    const cx = DESIGN_SIZE.width / 2;
    const title = this.scene.add.text(cx, 142, '暂停', inkStyle(28, true)).setOrigin(0.5);
    const resume = createArtButton(this.scene, cx, 196, '继续战斗', callbacks.onResume, { width: 280, fontSize: 18 });
    const restart = createArtButton(this.scene, cx, 250, '重新开始', callbacks.onRestart, { width: 280, fontSize: 18 });
    const menu = createArtButton(this.scene, cx, 304, '返回主菜单', callbacks.onMenu, { width: 280, fontSize: 18 });
    this.muteButton = createArtButton(this.scene, cx, 356, '', callbacks.onMute, { width: 220, fontSize: 15 });
    const hint = this.scene.add
      .text(cx, 398, '按 ESC 继续', { ...inkStyle(12), color: Palette.inkSoft })
      .setOrigin(0.5);""",
     """    const panel = createPanel(this.scene, DESIGN_SIZE.width / 2, 270, 520, 380);
    root.add([scrim, panel]);

    const cx = DESIGN_SIZE.width / 2;
    const title = this.scene.add.text(cx, 170, '暂停', inkStyle(28, true)).setOrigin(0.5);
    const resume = createArtButton(this.scene, cx, 214, '继续战斗', callbacks.onResume, { width: 280, height: 46, fontSize: 18 });
    const restart = createArtButton(this.scene, cx, 264, '重新开始', callbacks.onRestart, { width: 280, height: 46, fontSize: 18 });
    const menu = createArtButton(this.scene, cx, 314, '返回主菜单', callbacks.onMenu, { width: 280, height: 46, fontSize: 18 });
    this.muteButton = createArtButton(this.scene, cx, 358, '', callbacks.onMute, { width: 220, height: 40, fontSize: 15 });
    const hint = this.scene.add
      .text(cx, 392, '按 ESC 继续', { ...inkStyle(12), color: Palette.inkSoft })
      .setOrigin(0.5);"""),
])

# ---- 奖励卡片：几何对齐我们的稀有度卡框（307x512，顶部牌匾 + 中空） ----
patch(base + 'ui/RewardPanel.ts', [
    ("""    const cardW = 202;
    const cardH = 292;""",
     """    const cardW = 190;
    const cardH = 316;"""),
    ("""    const icon = this.scene.add.image(0, -96, rewardIcon(reward.effect)).setDisplaySize(64, 64);""",
     """    const icon = this.scene.add.image(0, -88, rewardIcon(reward.effect)).setDisplaySize(60, 60);"""),
    ("""      .text(0, h / 2 - 30, RARITY_LABEL[reward.rarity], {""",
     """      .text(0, h / 2 - 34, RARITY_LABEL[reward.rarity], {"""),
])
