# -*- coding: utf-8 -*-
import io, sys

path = r'C:/Users/26646/Desktop/Qoder_Game-main/src/game/ui/HUD.ts'
s = io.open(path, encoding='utf-8').read()

pairs = [
    ("UiKeys.IconDamage).setDisplaySize(32, 34)", "UiKeys.IconDamage).setDisplaySize(34, 34)"),
    ("UiKeys.IconSpeed).setDisplaySize(31, 34)", "UiKeys.IconSpeed).setDisplaySize(34, 34)"),
    ("""    const skillBase = scene.add.image(0, 0, UiKeys.Cooldown).setDisplaySize(SKILL_SIZE, SKILL_SIZE);
    this.skillShade = scene.add.graphics();""",
     """    const skillBase = scene.add.image(0, 0, UiKeys.IconTime).setDisplaySize(SKILL_SIZE - 12, SKILL_SIZE - 12);
    this.skillVeil = scene.add
      .image(0, 0, UiKeys.Cooldown)
      .setDisplaySize(SKILL_SIZE, SKILL_SIZE)
      .setAlpha(0)
      .setVisible(false);
    this.skillShade = scene.add.graphics();"""),
    ("""    this.skillRoot = scene.add.container(skillX, skillY, [skillBase, this.skillShade, this.skillLabel, this.skillCount, skillHint]);""",
     """    this.skillRoot = scene.add.container(skillX, skillY, [
      skillBase,
      this.skillVeil,
      this.skillShade,
      this.skillLabel,
      this.skillCount,
      skillHint
    ]);"""),
    ("""  /** remainingMs = 0 表示就绪；遮罩自上而下消退。 */""",
     """  /** remainingMs = 0 表示就绪；灰罩随剩余时间淡出，暗扇形从 12 点顺时针扫过未冷却部分。 */"""),
    ("""    this.skillShade.clear();
    if (ratio > 0) {
      const h = (SKILL_SIZE - 10) * ratio;
      this.skillShade.fillStyle(0x101408, 0.72);
      this.skillShade.fillRoundedRect(-SKILL_SIZE / 2 + 5, -SKILL_SIZE / 2 + 5, SKILL_SIZE - 10, h, 6);
      this.skillLabel.setVisible(false);""",
     """    this.skillShade.clear();
    this.skillVeil.setVisible(ratio > 0).setAlpha(0.5 * ratio);
    if (ratio > 0) {
      const radius = (SKILL_SIZE - 12) / 2;
      const start = -Math.PI / 2;
      this.skillShade.fillStyle(0x0b0f16, 0.8);
      this.skillShade.slice(0, 0, radius, start, start + ratio * Math.PI * 2, false, 0);
      this.skillShade.fillPath();
      this.skillLabel.setVisible(false);"""),
]

for old, new in pairs:
    if s.count(old) != 1:
        sys.exit('anchor not unique (%d): %s' % (s.count(old), old[:60]))
    s = s.replace(old, new)

io.open(path, 'w', encoding='utf-8', newline='\n').write(s)
print('HUD patched')
