from PIL import Image, ImageDraw, ImageFont
import pathlib
P = pathlib.Path(r'C:/Users/26646/Documents/Qoder/2026-11-16/36c4b6e0/ui-assets/preview')
font = ImageFont.truetype(r'C:/Windows/Fonts/msyh.ttc', 16)
items = [
    ('run0_menu.png',        '① 主菜单（第九类主面板）'),
    ('run1_battle_full.png', '② 战斗开局：基地/波次/角色 三条满'),
    ('run2_battle_mid.png',  '③ 真实系统改动后：角色65 基地80 第2波 金币30'),
    ('run3_result.png',      '④ ESC 结算：本局强化列表'),
]
W, H = 480, 270
strip = 30
frames = []
for name, lab in items:
    im = Image.open(P/name).convert('RGB').resize((W, H))
    c = Image.new('RGB', (W, H+strip), (24, 16, 10))
    c.paste(im, (0, strip))
    ImageDraw.Draw(c).text((8, 6), lab, font=font, fill=(243, 226, 184))
    frames.append(c)
cw, ch = frames[0].size
sheet = Image.new('RGB', (cw*2+12*3, ch*2+12*3), (16, 11, 7))
for i, f in enumerate(frames):
    r, c = divmod(i, 2)
    sheet.paste(f, (12+c*(cw+12), 12+r*(ch+12)))
sheet.save(P/'run_sheet.png')
frames[0].save(P/'run_loop.gif', save_all=True, append_images=frames[1:],
               duration=[1200, 1400, 1600, 1600], loop=0, disposal=2)
print('sheet', sheet.size, 'gif', (P/'run_loop.gif').stat().st_size)
