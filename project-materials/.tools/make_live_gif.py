from PIL import Image, ImageDraw, ImageFont
import pathlib
P = pathlib.Path(r'C:/Users/26646/Documents/Qoder/2026-11-16/36c4b6e0/ui-assets/preview')
font = ImageFont.truetype(r'C:/Windows/Fonts/msyh.ttc', 15)
fontS = ImageFont.truetype(r'C:/Windows/Fonts/msyh.ttc', 13)
# HUD crop region covers 3 bars + gold chip: x0..260, y0..146
BOX = (0, 0, 268, 150)
labels = [
    ('g0.png', '初始：基地100/100 角色100/100 准备中 金币0'),
    ('g1.png', '角色受击20→80  基地受击15→85  第1波'),
    ('g2.png', '奖励硬化弹头(伤害+5) 角色→60 金币+12'),
    ('g3.png', '角色→30 基地受击25→60 第2波'),
    ('g4.png', '奖励维修装甲(上限120 回20→80) 角色→15 第3波'),
    ('g5.png', '角色阵亡→0  基地被打爆→0'),
]
frames = []
strip_h = 34
for name, lab in labels:
    im = Image.open(P/name).convert('RGB').crop(BOX)
    w, h = im.size
    W = 470
    canvas = Image.new('RGB', (W, h+strip_h), (24, 16, 10))
    canvas.paste(im, ((W-w)//2, strip_h))
    d = ImageDraw.Draw(canvas)
    d.text((8, 8), lab, font=fontS, fill=(243, 226, 184))
    frames.append(canvas)
frames[0].save(P/'bar_live.gif', save_all=True, append_images=frames[1:],
               duration=[1100,1100,1100,1100,1300,1600], loop=0, disposal=2)
# static contact strip (2 cols x 3 rows)
cw, ch = frames[0].size
cols, rows = 2, 3
sheet = Image.new('RGB', (cw*cols+12*(cols+1), ch*rows+12*(rows+1)), (16, 11, 7))
for i, f in enumerate(frames):
    r, c = divmod(i, cols)
    sheet.paste(f, (12+c*(cw+12), 12+r*(ch+12)))
sheet.save(P/'bar_live_states.png')
print('GIF', (P/'bar_live.gif').stat().st_size, 'sheet', sheet.size)
