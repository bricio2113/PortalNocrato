import math, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps

W, H, FPS, DUR = 1080, 1920, 30, 10.0
NF = int(FPS * DUR)
FD = 'fonts/'
F_ANTON = FD + 'anton.woff'; F_SCRIPT = FD + 'kaushan.woff'
MONT = {w: FD + f'mont{w}.woff' for w in (500, 600, 700, 800, 900)}
font = lambda p, s: ImageFont.truetype(p, s)
PHOTO = '/root/.claude/uploads/b46d0fb9-5d71-5374-a345-c06afdc70d9d/adadeae8-image.jpg'

NAVY = (16, 22, 58); WHITE = (255, 255, 255); YEL = (255, 196, 0)

clamp = lambda x: max(0.0, min(1.0, x))
def prog(t, a, b): return clamp((t - a) / (b - a))
def ease_out(x): return 1 - (1 - x) ** 3
def ease_in(x): return x ** 3
def ease_io(x): return 3 * x * x - 2 * x * x * x
def back(x, s=1.7):
    x -= 1; return x * x * ((s + 1) * x + s) + 1
def elastic(x):
    if x <= 0: return 0
    if x >= 1: return 1
    return 2 ** (-10 * x) * math.sin((x * 10 - 0.75) * (2 * math.pi / 3)) + 1

# ---------------- helpers ----------------
def text_img(txt, fpath, size, fill, shadow=0, pad=30, spacing=0, stroke=0, stroke_fill=NAVY):
    f = font(fpath, size)
    if spacing:
        # manual letter spacing
        widths = [f.getlength(c) for c in txt]
        tw = int(sum(widths) + spacing * (len(txt) - 1))
        bb = f.getbbox(txt)
        im = Image.new('RGBA', (tw + pad * 2, bb[3] - bb[1] + pad * 2), (0, 0, 0, 0))
        d = ImageDraw.Draw(im); x = pad
        for c, w_ in zip(txt, widths):
            d.text((x, pad - bb[1]), c, font=f, fill=fill); x += w_ + spacing
    else:
        bb = f.getbbox(txt, stroke_width=stroke)
        im = Image.new('RGBA', (bb[2] - bb[0] + pad * 2, bb[3] - bb[1] + pad * 2), (0, 0, 0, 0))
        ImageDraw.Draw(im).text((pad - bb[0], pad - bb[1]), txt, font=f, fill=fill, stroke_width=stroke, stroke_fill=stroke_fill)
    if shadow:
        return with_shadow(im, off=(0, shadow), blur=max(4, shadow), a=110)
    return im

def with_shadow(im, off=(0, 14), blur=14, a=150, col=(30, 15, 0)):
    pad = blur * 3
    out = Image.new('RGBA', (im.width + pad * 2, im.height + pad * 2), (0, 0, 0, 0))
    sh = Image.new('RGBA', out.size, (0, 0, 0, 0))
    sh.paste(col + (a,), (pad + off[0], pad + off[1]), im.getchannel('A'))
    out = Image.alpha_composite(out, sh.filter(ImageFilter.GaussianBlur(blur)))
    out.alpha_composite(im, (pad, pad))
    return out

def safe_paste(base, im, x, y):
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(base.width, x + im.width), min(base.height, y + im.height)
    if x1 <= x0 or y1 <= y0: return
    base.alpha_composite(im.crop((x0 - x, y0 - y, x1 - x, y1 - y)), (x0, y0))

def xform(im, scale=1.0, rot=0.0, alpha=1.0):
    if scale != 1.0:
        im = im.resize((max(1, int(im.width * scale)), max(1, int(im.height * scale))), Image.BICUBIC)
    if rot:
        im = im.rotate(rot, Image.BICUBIC, expand=True)
    if alpha < 1:
        im = im.copy(); im.putalpha(im.getchannel('A').point(lambda v: int(v * alpha)))
    return im

def paste_c(base, im, cx, cy, scale=1.0, rot=0.0, alpha=1.0):
    if alpha <= 0.01 or scale <= 0.01: return
    im = xform(im, scale, rot, alpha)
    safe_paste(base, im, int(cx - im.width / 2), int(cy - im.height / 2))

def paste_tl(base, im, x, y, alpha=1.0):
    if alpha <= 0.01: return
    safe_paste(base, xform(im, alpha=alpha), int(x), int(y))

def reveal(im, p):
    """left-to-right write-on mask"""
    if p >= 1: return im
    out = im.copy(); a = np.array(out.getchannel('A')).astype(np.float32)
    edge = p * (im.width + 80) - 40
    xs = np.arange(im.width)[None, :]
    a *= np.clip((edge - xs) / 40 + 0.5, 0, 1)
    out.putalpha(Image.fromarray(a.astype(np.uint8))); return out

def clip_v(im, p):
    """reveal from bottom up (text rising out of a mask)"""
    return im

# ---------------- background (store photo tinted yellow) ----------------
ph = Image.open(PHOTO).convert('L')
ph = ImageOps.fit(ph.crop((0, 0, ph.width, int(ph.height * 0.36))), (W + 160, H + 200), Image.LANCZOS, centering=(0.62, 0.5)).filter(ImageFilter.GaussianBlur(7))
ph = ImageOps.autocontrast(ph, cutoff=2)
g = np.array(ph).astype(np.float32) / 255
dark = np.array([196, 110, 0]); mid = np.array([255, 182, 0]); light = np.array([255, 236, 120])
g3 = g[..., None]
col = np.where(g3 < 0.5, dark + (mid - dark) * (g3 / 0.5), mid + (light - mid) * ((g3 - 0.5) / 0.5))
# warm glow top-centre
yy, xx = np.mgrid[0:H + 200, 0:W + 160]
glow = np.exp(-(((xx - (W + 160) / 2) / 700) ** 2 + ((yy - 500) / 700) ** 2))[..., None]
col = col * 0.72 + np.array([255, 220, 60]) * 0.28
col = col * (1 - 0.35 * glow) + np.array([255, 235, 140]) * 0.35 * glow
BG = Image.fromarray(np.clip(col, 0, 255).astype(np.uint8), 'RGB').convert('RGBA')

# white table surface
TABLE = Image.new('RGBA', (W, H), (0, 0, 0, 0))
td = ImageDraw.Draw(TABLE)
td.polygon([(0, 1560), (W, 1300), (W, H), (0, H)], fill=(246, 246, 244, 255))
tg = np.array(TABLE).astype(np.float32)
shade = np.linspace(0.93, 1.0, H)[:, None]
tg[..., :3] *= shade[..., None] if False else shade[:, :, None]
TABLE = Image.fromarray(tg.astype(np.uint8), 'RGBA')
TABLE = with_shadow(TABLE, off=(0, -10), blur=18, a=90)
TABLE = TABLE.crop((54, 54, 54 + W, 54 + H))

# bottles
bot = Image.open('cut/bottles_trio.png').convert('RGBA')
bot = bot.crop(bot.getbbox())
from PIL import ImageEnhance
bot = ImageEnhance.Brightness(bot).enhance(1.1)
BH = 840
BOT = bot.resize((int(bot.width * BH / bot.height), BH), Image.LANCZOS)
# contact shadow
CSH = Image.new('RGBA', (760, 160), (0, 0, 0, 0))
ImageDraw.Draw(CSH).ellipse((40, 40, 720, 120), fill=(60, 40, 10, 150))
CSH = CSH.filter(ImageFilter.GaussianBlur(18))

# single blurred bottle for the corners (left bottle of the cut-out)
one = bot.crop((0, 0, int(bot.width * 0.36), bot.height))
one = one.crop(one.getbbox())
one = one.resize((int(one.width * 1300 / one.height), 1300), Image.LANCZOS)
CORNER = one.filter(ImageFilter.GaussianBlur(9))

# logo (script)
def logo():
    f1 = font(F_SCRIPT, 150); f2 = font(F_SCRIPT, 92)
    im = Image.new('RGBA', (760, 330), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.text((60, 0), 'Tabadega', font=f1, fill=NAVY)
    d.text((215, 170), 'dos Caiçaras', font=f2, fill=NAVY)
    # brush swoosh under the name
    pts = [(80 + k * 6, 318 - 26 * math.sin(k / 110 * math.pi) - k * 0.08) for k in range(111)]
    for i, (x, y) in enumerate(pts):
        r = 2 + 5 * math.sin(i / 110 * math.pi)
        d.ellipse((x - r, y - r, x + r, y + r), fill=NAVY)
    im = im.crop(im.getbbox())
    return im.rotate(5, Image.BICUBIC, expand=True)
LOGO = logo()

T_PROMO = text_img('PROMOÇÃO', MONT[900], 118, WHITE, shadow=8, pad=20)
T_IMPER = text_img('IMPERDÍVEL', F_ANTON, 190, NAVY, pad=20)
# product name sized to width
def fit(txt, fp, target):
    s = 100
    while font(fp, s + 2).getlength(txt) < target: s += 2
    return s
T_PROD = text_img('SMIRNOFF ICE', F_ANTON, fit('SMIRNOFF ICE', F_ANTON, 640), NAVY, pad=20)
T_LN = text_img('LONG NECK • 275 ml', MONT[600], 44, NAVY, spacing=5, pad=10)
T_SAB = text_img('SABOR LIMÃO CLÁSSICO', MONT[800], 34, WHITE, spacing=3, pad=10)
SAB = Image.new('RGBA', (T_SAB.width + 30, T_SAB.height + 10), (0, 0, 0, 0))
ImageDraw.Draw(SAB).rounded_rectangle((0, 0, SAB.width - 1, SAB.height - 1), 12, fill=NAVY)
SAB.alpha_composite(T_SAB, (15, 5))

# octagon price badge
def octagon(R, fill, outline=None, ow=0, inset=0):
    S = int(R * 2 + 20)
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    pts = lambda r: [(S / 2 + r * math.cos(math.pi / 8 + k * math.pi / 4), S / 2 + r * math.sin(math.pi / 8 + k * math.pi / 4)) for k in range(8)]
    d.polygon(pts(R), fill=fill)
    if outline: d.polygon(pts(R - inset), outline=outline, width=ow)
    return im
def badge():
    B = octagon(250, NAVY, WHITE, 6, 18)
    S = B.width; C = S / 2
    rs = text_img('R$', MONT[900], 46, WHITE, pad=0)
    n9 = text_img('9', MONT[900], 215, WHITE, pad=0)
    c00 = text_img(',00', MONT[900], 76, WHITE, pad=0)
    l1 = text_img('POR UNIDADE', MONT[800], 36, WHITE, pad=0)
    l2 = text_img('APROVEITE!', MONT[900], 46, WHITE, pad=0)
    gap = 8
    row_w = rs.width + gap + n9.width + gap + c00.width
    row_h = n9.height
    total_h = row_h + 26 + l1.height + 12 + l2.height
    y0 = int(C - total_h / 2)
    x = int(C - row_w / 2)
    B.alpha_composite(rs, (x, y0 + row_h - rs.height - 18))          # R$ sits low, beside the 9
    B.alpha_composite(n9, (x + rs.width + gap, y0))
    B.alpha_composite(c00, (x + rs.width + gap + n9.width + gap, y0 + 4))  # cents superscript
    y = y0 + row_h + 26
    B.alpha_composite(l1, (int(C - l1.width / 2), y)); y += l1.height + 12
    B.alpha_composite(l2, (int(C - l2.width / 2), y))
    return with_shadow(B, off=(0, 16), blur=16, a=120)
BADGE = badge()

# "só esse mês" sticker
T_MES = text_img('SÓ ESSE MÊS!', MONT[900], 50, NAVY, pad=6)
MES = Image.new('RGBA', (T_MES.width + 56, T_MES.height + 26), (0, 0, 0, 0))
ImageDraw.Draw(MES).rounded_rectangle((0, 0, MES.width - 1, MES.height - 1), 16, fill=WHITE, outline=NAVY, width=5)
MES.alpha_composite(T_MES, (28, 13)); MES = with_shadow(MES, off=(0, 8), blur=8, a=110)

# whatsapp-like phone icon (drawn)
def phone_icon(s, col):
    im = Image.new('RGBA', (s, s), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.ellipse((s * .06, s * .04, s * .96, s * .94), fill=col)
    d.polygon([(s * .12, s * .70), (s * .04, s * .98), (s * .34, s * .88)], fill=col)
    col = WHITE
    # handset
    h = Image.new('RGBA', (s, s), (0, 0, 0, 0)); hd = ImageDraw.Draw(h)
    hd.arc((s * .26, s * .22, s * .74, s * .74), 100, 260, fill=col, width=int(s * .1))
    hd.rounded_rectangle((s * .30, s * .20, s * .46, s * .34), 6, fill=col)
    hd.rounded_rectangle((s * .30, s * .62, s * .46, s * .76), 6, fill=col)
    h = h.rotate(-40, Image.BICUBIC, center=(s * .5, s * .49))
    im.alpha_composite(h)
    return im
T_DEL = text_img('Atendemos por delivery!', MONT[800], 60, NAVY, pad=8)
T_TEL = text_img('(13) 98161-0521', MONT[900], 92, NAVY, pad=8)
PH_IC = phone_icon(104, NAVY)
TEL = Image.new('RGBA', (PH_IC.width + 14 + T_TEL.width, max(PH_IC.height, T_TEL.height)), (0, 0, 0, 0))
TEL.alpha_composite(PH_IC, (0, (TEL.height - PH_IC.height) // 2 + 2)); TEL.alpha_composite(T_TEL, (PH_IC.width + 14, 0))
T_18 = text_img('18+  •  BEBA COM MODERAÇÃO', MONT[600], 28, NAVY, spacing=3, pad=6)

# share banner
def share_icon(s, col):
    im = Image.new('RGBA', (s, s), (0, 0, 0, 0)); dd = ImageDraw.Draw(im)
    p = [(s * .72, s * .2), (s * .28, s * .5), (s * .72, s * .8)]
    dd.line([p[0], p[1], p[2]], fill=col, width=int(s * .08))
    for (x, y) in p:
        rr = s * .14; dd.ellipse((x - rr, y - rr, x + rr, y + rr), fill=col)
    return im
def share_banner():
    w, h = 980, 168
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, w - 1, h - 1), 30, fill=NAVY, outline=WHITE, width=5)
    d.ellipse((26, 24, 146, 144), fill=YEL)
    im.alpha_composite(share_icon(84, NAVY), (44, 42))
    l1 = text_img('Compartilhe com aquela pessoa', MONT[800], 41, WHITE, pad=4)
    l2 = text_img('que não pode perder essa oferta!', MONT[900], 41, YEL, pad=4)
    im.alpha_composite(l1, (172, 26)); im.alpha_composite(l2, (172, 88))
    return with_shadow(im, off=(0, 12), blur=14, a=130)
SHARE = share_banner()

prng = np.random.default_rng(5)
SPARK = [dict(x=prng.uniform(80, W - 80), y=prng.uniform(150, 1300), ph=prng.uniform(0, 1), s=prng.uniform(14, 30)) for _ in range(12)]
def draw_spark(d, x, y, s, a):
    col = (255, 255, 255, int(a))
    d.polygon([(x, y - s), (x + s * .18, y - s * .18), (x + s, y), (x + s * .18, y + s * .18),
               (x, y + s), (x - s * .18, y + s * .18), (x - s, y), (x - s * .18, y - s * .18)], fill=col)

BPM = 124

def frame(fi):
    t = fi / FPS
    # Ken Burns background
    z = 1.0 + 0.06 * (t / DUR)
    bg = BG.resize((int(BG.width * z), int(BG.height * z)), Image.BILINEAR)
    ox = (bg.width - W) // 2 - int(40 * t / DUR); oy = (bg.height - H) // 2
    im = bg.crop((ox, oy, ox + W, oy + H))

    shake = 0
    for ti in (0.12, 0.42, 3.6):
        if ti <= t < ti + 0.22: shake = 16 * (1 - (t - ti) / 0.22)
    sx = int(shake * math.sin(t * 95)); sy = int(shake * math.cos(t * 83))
    L = Image.new('RGBA', (W, H), (0, 0, 0, 0))

    # corner blurred bottles slide in
    pc = 0
    if pc > 0:
        paste_c(L, CORNER, -40 - 300 * (1 - pc), 150 - 300 * (1 - pc), rot=-38, scale=0.8)
        paste_c(L, CORNER, -40 - 300 * (1 - pc), 1850 + 300 * (1 - pc), rot=40, scale=0.75)
        paste_c(L, CORNER, W + 30 + 300 * (1 - pc), 1820 + 300 * (1 - pc), rot=-30, scale=0.8)

    # table rises
    ptab = ease_out(prog(t, 1.45, 1.95))
    if ptab > 0:
        safe_paste(L, TABLE, 0, int(700 * (1 - ptab)))

    # bottles
    if t >= 1.6:
        pb = back(prog(t, 1.6, 2.2), 1.3)
        by = 1560 + 1100 * (1 - pb)
        bx = 830
        paste_c(L, CSH, bx + 10, 1548 + 600 * (1 - pb), alpha=clamp(pb))
        safe_paste(L, BOT, int(bx - BOT.width / 2), int(by - BOT.height))

    # ---------- logo: write-on ----------
    pl = ease_io(prog(t, 0.0, 0.9))
    lp = reveal(LOGO, pl)
    lscale = 1 + 0.015 * math.sin(t * 2 * math.pi * BPM / 60) * (t > 1.6)
    if 5.4 <= t < 6.1:  # emphasis when the store name is said
        lscale *= 1 + 0.08 * math.sin(prog(t, 5.4, 6.1) * math.pi)
    paste_c(L, lp, W / 2, 255, scale=lscale)

    # ---------- headline ----------
    p1 = back(prog(t, 0.1, 0.45), 1.5)
    # PROMOÇÃO: centered intro -> left aligned
    mv = ease_io(prog(t, 1.35, 1.75))
    if t >= 0.1:
        x_c = W / 2 + (70 + T_PROMO.width / 2 - 20 - W / 2) * mv
        y_c = 760 + (515 - 760) * mv
        paste_c(L, T_PROMO, x_c, y_c + 120 * (1 - p1), scale=1.15 - 0.15 * mv, alpha=clamp(p1 * 2))
    # IMPERDÍVEL slams, then swaps out for product name
    if 0.38 <= t < 1.75:
        p2 = prog(t, 0.38, 0.62)
        s = 2.4 - 1.4 * ease_out(p2)
        outp = ease_in(prog(t, 1.35, 1.65))
        paste_c(L, T_IMPER, W / 2 - 900 * outp, 930, scale=s, alpha=clamp(p2 * 3) * (1 - outp))
    if t >= 1.55:
        pp = ease_out(prog(t, 1.55, 1.95))
        safe_paste(L, xform(T_PROD, alpha=clamp(pp * 1.5)), int(50 + 700 * (1 - pp)), 560)
    if t >= 1.95:
        pl2 = ease_out(prog(t, 1.95, 2.35))
        paste_tl(L, reveal(T_LN, pl2), 66, 742)
        paste_tl(L, SAB, 76, 812 - 20 * (1 - pl2), alpha=pl2)

    # ---------- price badge ----------
    if t >= 2.8:
        pp = elastic(prog(t, 2.8, 3.55))
        pp *= 1 + 0.12 * math.sin(math.pi * prog(t, 3.6, 3.9))  # bump on the cash-register hit
        beat = 1 + 0.03 * max(0, math.sin(t * 2 * math.pi * BPM / 60)) * (t > 3.5)
        paste_c(L, BADGE, 290, 1170, scale=pp * beat, rot=(1 - clamp(prog(t, 2.8, 3.25))) * -120)

    # ---------- só esse mês sticker ----------
    if 4.6 <= t:
        pm = back(prog(t, 4.6, 4.95), 2.2)
        paste_c(L, MES, 300, 935, scale=pm, rot=6)

    # ---------- bottom contact block ----------
    if t >= 5.15:
        pd_ = ease_out(prog(t, 5.15, 5.55)); pt = back(prog(t, 5.3, 5.75), 1.5); p18 = prog(t, 5.6, 5.9)
        paste_c(L, T_DEL, W / 2, 1745 + 60 * (1 - pd_), alpha=pd_, scale=0.9 + 0.1 * pt)
        paste_c(L, T_18, W / 2, 1845, alpha=p18)

    # ---------- share banner ----------
    if t >= 6.72:
        ps = back(prog(t, 6.72, 7.15), 1.3)
        x = -W + (W / 2 + W) * ps
        beat = 1 + 0.02 * max(0, math.sin(t * 2 * math.pi * BPM / 60)) * (t > 7.3)
        paste_c(L, SHARE, x, 1560, scale=beat, rot=-1.5)

    im.alpha_composite(L, (sx, sy))

    if t > 2.8:
        sl = Image.new('RGBA', (W, H), (0, 0, 0, 0)); sd = ImageDraw.Draw(sl)
        for s in SPARK:
            ph_ = (t * 0.9 + s['ph']) % 1.0
            draw_spark(sd, s['x'], s['y'], s['s'] * (0.5 + ph_), math.sin(ph_ * math.pi) ** 3 * 230)
        im.alpha_composite(sl)

    out = im.convert('RGB')
    fl = 0
    for ti, dur, amp in ((0.42, 0.18, 0.45), (3.6, 0.18, 0.4), (6.7, 0.15, 0.25)):
        if ti <= t < ti + dur: fl = max(fl, amp * (1 - (t - ti) / dur))
    if fl > 0: out = Image.blend(out, Image.new('RGB', (W, H), (255, 255, 255)), fl)
    if t < 0.12 or t > 9.8:
        k = clamp(t / 0.12) if t < 0.12 else clamp((10 - t) / 0.2)
        out = Image.blend(Image.new('RGB', (W, H), (0, 0, 0)), out, k)
    return out

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'preview':
        for tt in sys.argv[2:]:
            frame(int(float(tt) * FPS)).resize((540, 960)).save(f'prev_{tt}.jpg', quality=85)
        sys.exit()
    ff = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS),
                           '-i', '-', '-i', 'mix.wav', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
                           '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', 'promo2.mp4'], stdin=subprocess.PIPE)
    for fi in range(NF):
        ff.stdin.write(frame(fi).tobytes())
    ff.stdin.close(); ff.wait()
    print('done')
