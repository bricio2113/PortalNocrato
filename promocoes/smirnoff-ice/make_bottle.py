"""Builds a clean 'studio' Smirnoff Ice bottle from the user's photo:
isolates the front bottle, symmetric silhouette, colour/contrast grade,
cylindrical shading, glass highlights and condensation droplets.
Outputs cut/bottle_clean.png (single) and cut/bottles_trio.png (3 bottles)."""
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance, ImageDraw

im = Image.open('cut/f847b770.png').convert('RGBA')
a = np.array(im.getchannel('A')); a[a < 40] = 0; im.putalpha(Image.fromarray(a))
im = im.crop(im.getbbox())
A = np.array(im.getchannel('A')) > 128
h, w = A.shape
# right bottle = front one. right edge per row
right = np.array([np.max(np.nonzero(A[y])[0]) if A[y].any() else -1 for y in range(h)])
# axis from the body (lower half), where width is stable
cap_rows = [y for y in range(h) if right[y] > 0]
top = cap_rows[0]
# left edge of the front bottle on its lowest rows (nothing overlaps there at the very bottom right side)
# estimate axis using the cap: cap of the front bottle is the topmost run near the right
cy = next(y for y in range(h) if right[y] > w * 0.62) + 10
top = cy - 10
runs = np.nonzero(A[cy])[0]
# take the right-most contiguous run (front bottle cap)
seg = [runs[-1]]
for x in runs[::-1][1:]:
    if seg[-1] - x <= 2: seg.append(x)
    else: break
axis = (min(seg) + max(seg)) / 2
print('axis', axis, 'cap', min(seg), max(seg))
mask = np.zeros_like(A, dtype=np.float32)
for y in range(h):
    if right[y] < 0: continue
    ax = axis + (444 - axis) * min(1, max(0, (y - top) / 330))
    r = right[y]; l = 2 * ax - r
    xs = np.arange(w)
    mask[y] = np.clip(np.minimum(xs - l + 1, r - xs + 1), 0, 1.5) / 1.5
mask = mask * (np.array(im.getchannel('A')) / 255.0)
x0 = int(max(0, 2 * 444 - right.max() - 2)); x1 = int(right.max() + 2)
rgb = im.convert('RGB')
bot = Image.merge('RGBA', (*rgb.split(), Image.fromarray((mask * 255).astype(np.uint8)))).crop((x0, top - 2, x1, h))
bot = bot.crop(bot.getbbox())
# soften silhouette edge 1px
al = bot.getchannel('A').filter(ImageFilter.GaussianBlur(0.8))

# upscale for detail
H2 = 1100
scale = H2 / bot.height
rgb = bot.convert('RGB').resize((int(bot.width * scale), H2), Image.LANCZOS)
al = al.resize(rgb.size, Image.LANCZOS)

# ---- grade ----
rgb = rgb.filter(ImageFilter.UnsharpMask(radius=3, percent=140, threshold=2))
rgb = ImageEnhance.Contrast(rgb).enhance(1.18)
rgb = ImageEnhance.Color(rgb).enhance(1.35)
arr = np.array(rgb).astype(np.float32) / 255
# levels: lift whites, deepen darks a little
arr = np.clip((arr - 0.04) / 0.92, 0, 1) ** 1.05
Wd, Hd = rgb.size
xs = (np.arange(Wd) - Wd / 2) / (Wd / 2)
# cylindrical shading (darker at the sides)
cyl = 1.06 - 0.32 * np.abs(xs) ** 2.2
arr *= cyl[None, :, None]
# slight cool/lemon tint in the liquid (bright low-saturation pixels)
lum = arr.mean(2, keepdims=True); sat = arr.max(2, keepdims=True) - arr.min(2, keepdims=True)
liq = np.clip((lum - 0.55) / 0.3, 0, 1) * np.clip((0.12 - sat) / 0.12, 0, 1)
tint = np.array([0.97, 1.0, 0.90])
arr = arr * (1 - liq * 0.35) + arr * tint * liq * 0.35
arr = arr * (1 - liq * 0.6) + (arr ** 0.7) * liq * 0.6
# glass highlights
Y = np.arange(Hd)[:, None] / Hd
def bar(cx, wd, strength):
    return strength * np.exp(-((xs[None, :] - cx) / wd) ** 2) * np.ones((Hd, 1))
hl = bar(-0.55, 0.09, 0.55) + bar(-0.38, 0.03, 0.35) + bar(0.62, 0.05, 0.35)
hl *= np.clip((Y - 0.02) / 0.05, 0, 1)
arr = arr + (1 - arr) * np.clip(hl, 0, 1)[..., None]
img = Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8), 'RGB').convert('RGBA')

# ---- condensation droplets ----
rng = np.random.default_rng(11)
drops = Image.new('RGBA', img.size, (0, 0, 0, 0))
d = ImageDraw.Draw(drops)
alpha_np = np.array(al)
neck_end = int(Hd * 0.30)
for _ in range(520):
    x = rng.uniform(0.08, 0.92) * Wd; y = rng.uniform(0.12, 0.97) * Hd
    if alpha_np[int(y), int(x)] < 250: continue
    r = rng.choice([2.0, 2.5, 3, 3.5, 4, 5, 6, 7], p=[.18, .18, .17, .14, .12, .10, .07, .04])
    ry = r * rng.uniform(1.0, 1.35)
    d.ellipse((x - r, y - ry, x + r, y + ry), fill=(255, 255, 255, 40))
    d.arc((x - r, y - ry, x + r, y + ry), 20, 160, fill=(40, 60, 70, 110), width=max(1, int(r / 3)))
    hr = max(1, r * 0.35)
    d.ellipse((x - r * 0.45 - hr, y - ry * 0.45 - hr, x - r * 0.45 + hr, y - ry * 0.45 + hr), fill=(255, 255, 255, 230))
drops = drops.filter(ImageFilter.GaussianBlur(0.6))
img.alpha_composite(drops)
img.putalpha(al)
img.save('cut/bottle_clean.png')
print('single', img.size)

# ---- trio (front + 2 behind, like a packshot) ----
back_b = ImageEnhance.Brightness(img).enhance(0.86)
bs = 0.9
back_b = back_b.resize((int(img.width * bs), int(img.height * bs)), Image.LANCZOS)
TW = int(img.width * 2.25); TH = img.height + 10
trio = Image.new('RGBA', (TW, TH), (0, 0, 0, 0))
by = TH - back_b.height - 40
trio.alpha_composite(back_b, (0, by))
trio.alpha_composite(back_b, (TW - back_b.width, by))
# shadow of front bottle onto back bottles
sh = Image.new('RGBA', img.size, (0, 0, 0, 0)); sh.putalpha(img.getchannel('A').point(lambda v: v * 0.45))
sh = sh.filter(ImageFilter.GaussianBlur(18))
fx = (TW - img.width) // 2
trio.alpha_composite(sh, (fx - 25, TH - img.height - 5))
trio.alpha_composite(sh, (fx + 25, TH - img.height - 5))
trio.alpha_composite(img, (fx, TH - img.height))
trio.save('cut/bottles_trio.png')
print('trio', trio.size)

prev = Image.new('RGBA', trio.size, (255, 196, 0, 255)); prev.alpha_composite(trio)
prev.convert('RGB').resize((trio.width // 2, trio.height // 2)).save('cut/prev_trio.jpg')
