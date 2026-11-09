import math, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H, FPS, DUR = 1080, 1920, 30, 10.0
NF = int(FPS * DUR)
F_BLACK = '/usr/share/fonts/opentype/inter/InterDisplay-Black.otf'
F_BLACKI = '/usr/share/fonts/opentype/inter/InterDisplay-BlackItalic.otf'
F_XB = '/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf'
font = lambda p, s: ImageFont.truetype(p, s)

YEL = (255, 212, 0); RED = (227, 27, 35); NAVY = (6, 26, 74); WHITE = (255, 255, 255)

# ---------------- easing ----------------
clamp = lambda x: max(0.0, min(1.0, x))
def prog(t, a, b): return clamp((t - a) / (b - a))
def ease_out(x): return 1 - (1 - x) ** 3
def ease_in(x): return x ** 3
def back(x, s=1.9):
    x -= 1; return x * x * ((s + 1) * x + s) + 1
def elastic(x):
    if x <= 0: return 0
    if x >= 1: return 1
    return 2 ** (-10 * x) * math.sin((x * 10 - 0.75) * (2 * math.pi / 3)) + 1

# ---------------- helpers ----------------
def text_img(txt, fpath, size, fill, stroke=0, stroke_fill=NAVY, shadow=True, pad=40):
    f = font(fpath, size)
    bb = f.getbbox(txt, stroke_width=stroke)
    w, h = bb[2] - bb[0] + pad * 2, bb[3] - bb[1] + pad * 2
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    pos = (pad - bb[0], pad - bb[1])
    if shadow:
        sh = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        ImageDraw.Draw(sh).text((pos[0] + 8, pos[1] + 12), txt, font=f, fill=(0, 0, 30, 170), stroke_width=stroke, stroke_fill=(0, 0, 30, 170))
        im = Image.alpha_composite(im, sh.filter(ImageFilter.GaussianBlur(6)))
        d = ImageDraw.Draw(im)
    d.text(pos, txt, font=f, fill=fill, stroke_width=stroke, stroke_fill=stroke_fill)
    return im

def paste_c(base, im, cx, cy, scale=1.0, rot=0.0, alpha=1.0):
    if alpha <= 0.01 or scale <= 0.01: return
    if scale != 1.0:
        im = im.resize((max(1, int(im.width * scale)), max(1, int(im.height * scale))), Image.BICUBIC)
    if rot:
        im = im.rotate(rot, Image.BICUBIC, expand=True)
    if alpha < 1:
        a = im.getchannel('A').point(lambda v: int(v * alpha)); im = im.copy(); im.putalpha(a)
    base.alpha_composite(im, (int(cx - im.width / 2), int(cy - im.height / 2))) if (
        0 <= int(cx - im.width / 2) and 0 <= int(cy - im.height / 2) and
        int(cx - im.width / 2) + im.width <= base.width and int(cy - im.height / 2) + im.height <= base.height
    ) else safe_paste(base, im, int(cx - im.width / 2), int(cy - im.height / 2))

def safe_paste(base, im, x, y):
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(base.width, x + im.width), min(base.height, y + im.height)
    if x1 <= x0 or y1 <= y0: return
    base.alpha_composite(im.crop((x0 - x, y0 - y, x1 - x, y1 - y)), (x0, y0))

def rounded(w, h, r, fill, outline=None, ow=0):
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(im).rounded_rectangle((0, 0, w - 1, h - 1), r, fill=fill, outline=outline, width=ow)
    return im

def with_shadow(im, off=(0, 14), blur=14, a=150):
    pad = blur * 3
    out = Image.new('RGBA', (im.width + pad * 2, im.height + pad * 2), (0, 0, 0, 0))
    sh = Image.new('RGBA', out.size, (0, 0, 0, 0))
    mask = im.getchannel('A')
    sh.paste((0, 0, 30, a), (pad + off[0], pad + off[1]), mask)
    out = Image.alpha_composite(out, sh.filter(ImageFilter.GaussianBlur(blur)))
    out.alpha_composite(im, (pad, pad))
    return out

# ---------------- static layers ----------------
# background radial gradient
yy, xx = np.mgrid[0:H, 0:W]
r = np.sqrt(((xx - W / 2) / W) ** 2 + ((yy - H * 0.45) / H) ** 2)
r = np.clip(r / 0.75, 0, 1)[..., None]
c_in = np.array([40, 120, 230]); c_out = np.array([4, 18, 60])
BG = Image.fromarray((c_in * (1 - r) + c_out * r).astype(np.uint8), 'RGB').convert('RGBA')

# sunburst rays
RS = 2600
rays = Image.new('RGBA', (RS, RS), (0, 0, 0, 0))
d = ImageDraw.Draw(rays)
n = 24
for k in range(n):
    a0 = 2 * math.pi * k / n; a1 = a0 + math.pi / n
    d.polygon([(RS / 2, RS / 2), (RS / 2 + RS * math.cos(a0), RS / 2 + RS * math.sin(a0)),
               (RS / 2 + RS * math.cos(a1), RS / 2 + RS * math.sin(a1))], fill=(255, 255, 255, 26))
rays_small = rays.resize((RS // 2, RS // 2), Image.BILINEAR)

# glow
def glow(size, color, a=200):
    g = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(g).ellipse((size * .2, size * .2, size * .8, size * .8), fill=color + (a,))
    return g.filter(ImageFilter.GaussianBlur(size * .12))
GLOW = glow(1100, (120, 210, 255), 170)

# bottles
bot = Image.open('cut/1394b966.png').convert('RGBA')
a = np.array(bot.getchannel('A')); a[a < 40] = 0
bot.putalpha(Image.fromarray(a)); bot = bot.crop(bot.getbbox())
BH = 860
bot = bot.resize((int(bot.width * BH / bot.height), BH), Image.LANCZOS)
BOT = with_shadow(bot, off=(0, 30), blur=22, a=160)

# texts
T_PROMO = text_img('PROMOÇÃO', F_BLACKI, 168, WHITE, stroke=8, stroke_fill=NAVY)
T_IMPER = text_img('IMPERDÍVEL', F_BLACKI, 150, YEL, stroke=0)
rib_w = T_IMPER.width + 40
RIB = rounded(rib_w, T_IMPER.height - 30, 26, RED)
RIB.alpha_composite(T_IMPER, (20, -15))
RIB = with_shadow(RIB)

T_BRAND = text_img('SMIRNOFF ICE', F_BLACK, 104, WHITE, stroke=6, stroke_fill=NAVY)
T_SUB = text_img('sabor limão clássico', F_XB, 44, (200, 230, 255), shadow=True)

# price starburst
def starburst(R, pts=18, inner=0.86):
    S = int(R * 2 + 20)
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0)); dd = ImageDraw.Draw(im)
    poly = []
    for k in range(pts * 2):
        rr = R if k % 2 == 0 else R * inner; ang = math.pi * k / pts
        poly.append((S / 2 + rr * math.cos(ang), S / 2 + rr * math.sin(ang)))
    dd.polygon(poly, fill=RED)
    dd.ellipse((S / 2 - R * .78, S / 2 - R * .78, S / 2 + R * .78, S / 2 + R * .78), outline=YEL, width=8)
    return im
BURST = starburst(250)
P_LBL = text_img('POR APENAS', F_XB, 38, WHITE, shadow=False, pad=10)
P_RS = text_img('R$', F_BLACK, 70, YEL, shadow=False, pad=10)
P_VAL = text_img('9,00', F_BLACK, 168, WHITE, shadow=False, pad=10)
PRICE = Image.new('RGBA', (560, 420), (0, 0, 0, 0))
PRICE.alpha_composite(P_LBL, ((560 - P_LBL.width) // 2, 70))
row_w = P_RS.width + P_VAL.width - 10
x0 = (560 - row_w) // 2
PRICE.alpha_composite(P_RS, (x0, 160)); PRICE.alpha_composite(P_VAL, (x0 + P_RS.width - 10, 120))
PRICE = with_shadow(PRICE, off=(0, 6), blur=6, a=120)

# long neck pill
T_LN = text_img('LONG NECK 275ml', F_BLACK, 50, NAVY, shadow=False, pad=8)
PILL = rounded(T_LN.width + 60, T_LN.height + 30, (T_LN.height + 30) // 2, YEL)
PILL.alpha_composite(T_LN, (30, 15)); PILL = with_shadow(PILL)

# "só esse mês" ribbon
T_MES = text_img('SÓ ESSE MÊS!', F_BLACKI, 96, NAVY, shadow=False, pad=10)
MES = rounded(T_MES.width + 90, T_MES.height + 40, 30, YEL)
MES.alpha_composite(T_MES, (45, 20)); MES = with_shadow(MES)

# store card
def store_card():
    w, h = 940, 210
    im = rounded(w, h, 40, (255, 255, 255, 245), outline=YEL, ow=8)
    t1 = text_img('APENAS NA', F_XB, 40, (30, 80, 170), shadow=False, pad=6)
    t2 = text_img('Tabadega dos Caiçaras', F_BLACK, 76, NAVY, shadow=False, pad=6)
    im.alpha_composite(t1, ((w - t1.width) // 2, 22))
    im.alpha_composite(t2, ((w - t2.width) // 2, 80))
    return with_shadow(im)
STORE = store_card()

# share card
def share_icon(s, col):
    im = Image.new('RGBA', (s, s), (0, 0, 0, 0)); dd = ImageDraw.Draw(im)
    p = [(s * .72, s * .2), (s * .28, s * .5), (s * .72, s * .8)]
    dd.line([p[0], p[1], p[2]], fill=col, width=int(s * .08))
    for (x, y) in p:
        rr = s * .14; dd.ellipse((x - rr, y - rr, x + rr, y + rr), fill=col)
    return im
def share_card():
    w, h = 940, 300
    im = rounded(w, h, 40, (10, 40, 110, 235), outline=(120, 200, 255), ow=5)
    ic_bg = Image.new('RGBA', (130, 130), (0, 0, 0, 0))
    ImageDraw.Draw(ic_bg).ellipse((0, 0, 129, 129), fill=YEL)
    ic_bg.alpha_composite(share_icon(90, NAVY), (20, 20))
    im.alpha_composite(ic_bg, (40, (h - 130) // 2))
    lines = [('Compartilhe com aquela', WHITE, 54), ('pessoa que não pode', WHITE, 54), ('perder essa oferta!', YEL, 60)]
    y = 40
    for txt, col, sz in lines:
        t = text_img(txt, F_BLACK, sz, col, shadow=False, pad=4)
        im.alpha_composite(t, (200, y)); y += t.height + 8
    return with_shadow(im)
SHARE = share_card()

# particles (ice bubbles)
prng = np.random.default_rng(3)
PART = [dict(x=prng.uniform(0, W), y0=prng.uniform(0, H), sp=prng.uniform(80, 260), r=prng.uniform(4, 16),
             ph=prng.uniform(0, 6.28), a=prng.uniform(60, 150)) for _ in range(55)]
SPARK = [dict(x=prng.uniform(80, W - 80), y=prng.uniform(200, 1500), ph=prng.uniform(0, 1), s=prng.uniform(18, 40)) for _ in range(14)]

def draw_spark(d, x, y, s, a):
    col = (255, 255, 255, int(a))
    d.polygon([(x, y - s), (x + s * .18, y - s * .18), (x + s, y), (x + s * .18, y + s * .18),
               (x, y + s), (x - s * .18, y + s * .18), (x - s, y), (x - s * .18, y - s * .18)], fill=col)

# ---------------- frame ----------------
def frame(fi):
    t = fi / FPS
    im = BG.copy()
    # rays rotate
    ang = t * 12
    ry = rays_small.rotate(ang, Image.BILINEAR).resize((RS, RS), Image.BILINEAR)
    pulse = 1 + 0.04 * math.sin(t * 2 * math.pi * 124 / 60) * (t > 1.55)
    rcy = H * 0.42 if t > 1.5 else H * 0.47
    paste_c(im, ry, W / 2, rcy, scale=pulse)

    # particles
    pl = Image.new('RGBA', (W, H), (0, 0, 0, 0)); pd = ImageDraw.Draw(pl)
    for p in PART:
        y = (p['y0'] - p['sp'] * t) % (H + 40) - 20
        x = p['x'] + 18 * math.sin(t * 2 + p['ph'])
        pd.ellipse((x - p['r'], y - p['r'], x + p['r'], y + p['r']), outline=(255, 255, 255, int(p['a'])), width=3)
    im.alpha_composite(pl)

    # shake
    shake = 0
    for ti in (0.12, 0.42, 2.78):
        if ti <= t < ti + 0.25: shake = 22 * (1 - (t - ti) / 0.25)
    sx = shake * math.sin(t * 95); sy = shake * math.cos(t * 83)

    L = Image.new('RGBA', (W, H), (0, 0, 0, 0))

    # ===== headline =====
    p1 = back(prog(t, 0.08, 0.38), 1.4)
    p2 = back(prog(t, 0.38, 0.66), 1.6)
    up = ease_out(prog(t, 1.4, 1.85))  # move headline to the top
    hy = 820 + (210 - 820) * up
    hs = 1 + (0.62 - 1) * up
    if t < 0.38:
        s1 = 2.6 - 1.6 * p1
    else:
        s1 = 1.0
    paste_c(L, T_PROMO, W / 2, hy - 95 * hs, scale=s1 * hs, alpha=clamp(p1 * 3) if t < 0.38 else 1)
    if t >= 0.38:
        rib_x = -W / 2 + (W / 2 + W) * p2 if p2 < 1 else W / 2
        rib_x = W * 1.5 + (W / 2 - W * 1.5) * p2
        paste_c(L, RIB, rib_x, hy + 105 * hs, scale=hs, rot=4)

    # ===== bottles =====
    if t >= 1.55:
        pb = back(prog(t, 1.55, 2.2), 1.5)
        by = H + 600 + (1000 - (H + 600)) * pb
        bob = 10 * math.sin((t - 2.2) * 2.4) if t > 2.2 else 0
        shrink = ease_out(prog(t, 6.2, 6.7))
        bsc = 1 - 0.12 * shrink
        bx = 420 - 20 * shrink
        by = by - 40 * shrink
        gl = clamp(prog(t, 1.7, 2.3))
        paste_c(im, GLOW, bx, by + 30, scale=1 + 0.05 * math.sin(t * 3), alpha=gl)
        paste_c(L, BOT, bx, by + bob, scale=bsc)

        # brand title
        pt = back(prog(t, 1.72, 2.1), 2.2)
        paste_c(L, T_BRAND, W / 2, 440, scale=pt)
        paste_c(L, T_SUB, W / 2, 525, alpha=prog(t, 2.0, 2.3))

    # ===== price burst =====
    if t >= 2.75:
        pp = elastic(prog(t, 2.75, 3.45))
        wob = 3 * math.sin(t * 5)
        shrink = ease_out(prog(t, 6.2, 6.7))
        cx = 820 - 10 * shrink; cy = 1060 - 60 * shrink
        sc = pp * (1 + 0.035 * math.sin(t * 2 * math.pi * 124 / 60)) * (1 - 0.12 * shrink)
        paste_c(L, BURST, cx, cy, scale=sc, rot=-12 + wob + (1 - pp) * 90)
        paste_c(L, PRICE, cx, cy - 10, scale=sc, rot=-12 + wob)

    # ===== long neck pill =====
    if t >= 3.45:
        pn = back(prog(t, 3.45, 3.85), 1.6)
        out = ease_in(prog(t, 6.1, 6.45))
        x = -500 + (290 + 500) * pn - 900 * out
        paste_c(L, PILL, x, 1440, rot=3)

    # ===== só esse mês =====
    if 4.1 <= t < 6.6:
        pm = back(prog(t, 4.1, 4.5), 1.6)
        out = ease_in(prog(t, 6.15, 6.5))
        x = W + 500 + (W / 2 - (W + 500)) * pm + 1300 * out
        paste_c(L, MES, x, 1555, rot=-3, scale=1 + 0.03 * math.sin(t * 8))

    # ===== store card =====
    if t >= 4.85:
        ps = back(prog(t, 4.85, 5.3), 1.3)
        y = H + 200 + (1755 - (H + 200)) * ps
        paste_c(L, STORE, W / 2, y)

    # ===== share card =====
    if t >= 6.4:
        pc = back(prog(t, 6.4, 6.85), 1.4)
        y = H + 300 + (1490 - (H + 300)) * pc
        beat = 1 + 0.025 * max(0, math.sin(t * 2 * math.pi * 124 / 60))
        paste_c(L, SHARE, W / 2, y, scale=beat if t > 6.9 else 1)

    im.alpha_composite(L, (int(sx), int(sy)))

    # sparkles
    if t > 2.8:
        sl = Image.new('RGBA', (W, H), (0, 0, 0, 0)); sd = ImageDraw.Draw(sl)
        for s in SPARK:
            ph = (t * 0.9 + s['ph']) % 1.0
            a = math.sin(ph * math.pi) ** 3 * 255
            draw_spark(sd, s['x'], s['y'], s['s'] * (0.5 + ph), a)
        im.alpha_composite(sl)

    # flashes
    fl = 0
    for ti, dur, amp in ((0.1, 0.25, 0.85), (0.4, 0.2, 0.5), (2.75, 0.2, 0.55), (6.38, 0.18, 0.35)):
        if ti <= t < ti + dur: fl = max(fl, amp * (1 - (t - ti) / dur))
    out = im.convert('RGB')
    if fl > 0:
        out = Image.blend(out, Image.new('RGB', (W, H), (255, 255, 255)), fl)
    # fade-in / fade-out
    if t < 0.08 or t > 9.7:
        k = clamp(t / 0.08) if t < 0.08 else clamp((10 - t) / 0.3)
        out = Image.blend(Image.new('RGB', (W, H), (0, 0, 0)), out, k)
    return out

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'preview':
        for tt in sys.argv[2:]:
            frame(int(float(tt) * FPS)).resize((540, 960)).save(f'prev_{tt}.jpg', quality=85)
        sys.exit()
    ff = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS),
                           '-i', '-', '-i', 'mix.wav', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
                           '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', 'promo.mp4'], stdin=subprocess.PIPE)
    for fi in range(NF):
        ff.stdin.write(frame(fi).tobytes())
        if fi % 30 == 0: print(fi, flush=True)
    ff.stdin.close(); ff.wait()
    print('done')
