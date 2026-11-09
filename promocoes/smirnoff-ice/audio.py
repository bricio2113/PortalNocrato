import numpy as np, wave
SR = 48000
DUR = 10.0
N = int(SR * DUR)
rng = np.random.default_rng(7)


def load(fn):
    w = wave.open(fn)
    s = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
    sr = w.getframerate()
    t_new = np.arange(int(len(s) * SR / sr)) / SR
    return np.interp(t_new, np.arange(len(s)) / sr, s)


def place(buf, sig, t, gain=1.0):
    i = int(t * SR)
    if i >= len(buf): return
    j = min(len(buf), i + len(sig))
    buf[i:j] += sig[: j - i] * gain


def env(n, a, d):
    t = np.arange(n) / SR
    return np.minimum(t / max(a, 1e-4), 1) * np.exp(-t / d)


def lp(x, k):
    # simple one-pole lowpass, k in (0,1)
    y = np.empty_like(x); acc = 0.0
    for i, v in enumerate(x):
        acc += k * (v - acc); y[i] = acc
    return y


def whoosh(d=0.45, up=True):
    n = int(d * SR); t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    # sweeping bandpass via difference of two lowpasses with moving cutoff (chunked)
    out = np.zeros(n); chunk = 256
    a1 = a2 = 0.0
    for c in range(0, n, chunk):
        p = c / n; p = p if up else 1 - p
        k1 = 0.02 + 0.35 * p; k2 = k1 * 0.35
        for i in range(c, min(n, c + chunk)):
            a1 += k1 * (noise[i] - a1); a2 += k2 * (noise[i] - a2)
            out[i] = a1 - a2
    e = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 2
    return out * e / (np.abs(out).max() + 1e-9)


def impact():
    n = int(0.7 * SR); t = np.arange(n) / SR
    f = 110 * np.exp(-t * 9) + 38
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 5)
    crack = rng.standard_normal(n) * np.exp(-t * 40) * 0.5
    return np.tanh((boom + crack) * 1.6) * 0.9


def pop():
    n = int(0.18 * SR); t = np.arange(n) / SR
    f = 900 * np.exp(-t * 25) + 300
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 28)


def ching():
    n = int(1.4 * SR); t = np.arange(n) / SR
    s = np.zeros(n)
    for f, a, d in [(2093, 1, .5), (2637, .7, .45), (3136, .6, .4), (4186, .45, .3), (5274, .3, .25)]:
        s += a * np.sin(2 * np.pi * f * t) * np.exp(-t / d)
    # second strike (register "cha-ching")
    s2 = np.zeros(n); off = int(0.11 * SR)
    for f, a, d in [(2349, 1, .6), (2960, .7, .5), (3520, .6, .45), (4699, .4, .35)]:
        s2[off:] += a * np.sin(2 * np.pi * f * t[: n - off]) * np.exp(-t[: n - off] / d)
    click = rng.standard_normal(n) * np.exp(-t * 120) * 0.6
    return (s * 0.5 + s2 * 0.6 + click) / 2.2


def sparkle():
    n = int(1.0 * SR); t = np.arange(n) / SR; s = np.zeros(n)
    for k in range(9):
        o = int(k * 0.06 * SR); f = 2500 + k * 380
        s[o:] += np.sin(2 * np.pi * f * t[: n - o]) * np.exp(-t[: n - o] * 9) * (0.9 ** k)
    return s / 4


# ---------------- background beat (124 bpm) ----------------
bpm = 124; beat = 60 / bpm
music = np.zeros(N)
kn = int(0.35 * SR); kt = np.arange(kn) / SR
kick = np.sin(2 * np.pi * np.cumsum(55 + 140 * np.exp(-kt * 30)) / SR) * np.exp(-kt * 9)
hn = int(0.06 * SR)
hat = np.diff(rng.standard_normal(hn + 1)) * np.exp(-np.arange(hn) / SR * 70) * 0.25
clap_n = int(0.2 * SR)
clap = rng.standard_normal(clap_n) * np.exp(-np.arange(clap_n) / SR * 22) * 0.35
bass_notes = [45, 45, 48, 43]  # A, A, C, G (midi)
chord_notes = [[57, 60, 64], [57, 60, 64], [60, 64, 67], [55, 59, 62]]
mtof = lambda m: 440 * 2 ** ((m - 69) / 12)
t0 = 1.55  # music drops in after the intro hit
i = 0
while t0 + i * beat < DUR:
    tb = t0 + i * beat; bar = (i // 4) % 4
    place(music, kick, tb, 0.9)
    place(music, hat, tb + beat / 2, 1.0)
    if i % 2 == 1:
        place(music, clap, tb, 0.8)
    # bass (8th notes)
    for h in range(2):
        bn = int(beat / 2 * SR * 0.9); bt = np.arange(bn) / SR
        f = mtof(bass_notes[bar])
        b = (np.sign(np.sin(2 * np.pi * f * bt)) * 0.3 + np.sin(2 * np.pi * f * bt)) * np.exp(-bt * 6)
        place(music, b * 0.32, tb + h * beat / 2)
    # off-beat chord stab
    cn = int(0.18 * SR); ct = np.arange(cn) / SR
    st = sum(np.sin(2 * np.pi * mtof(m) * ct) + 0.3 * np.sin(4 * np.pi * mtof(m) * ct) for m in chord_notes[bar])
    place(music, st * np.exp(-ct * 14) * 0.09, tb + beat / 2)
    i += 1
# intro riser into the first hit area
rn = int(1.4 * SR); rt = np.arange(rn) / SR
riser = rng.standard_normal(rn) * (rt / 1.4) ** 2 * 0.12
place(music, riser, 0.15)
fade = np.ones(N); fl = int(0.5 * SR); fade[-fl:] = np.linspace(1, 0, fl)
music *= fade

# ---------------- voice ----------------
voice = np.zeros(N)
VOICE_T = [0.25, 1.6, 4.2, 6.4]
for k, t in enumerate(VOICE_T):
    place(voice, load(f'v{k}.wav'), t, 1.0)
# light presence: tiny short slap for "radio" feel
voice = voice + 0.12 * np.concatenate([np.zeros(int(0.045 * SR)), voice[: -int(0.045 * SR)]])

# ducking envelope from voice
venv = np.abs(voice)
win = int(0.08 * SR)
venv = np.convolve(venv, np.ones(win) / win, mode='same')
duck = 1 - 0.55 * np.clip(venv / 0.08, 0, 1)

# ---------------- sfx ----------------
sfx = np.zeros(N)
place(sfx, whoosh(0.35), 0.0, 0.5)
place(sfx, impact(), 0.12, 0.8)
place(sfx, impact(), 0.42, 0.6)
place(sfx, whoosh(0.4), 1.3, 0.45)
place(sfx, pop(), 1.75, 0.5)
place(sfx, whoosh(0.3), 2.5, 0.35)
place(sfx, ching(), 2.78, 0.9)
place(sfx, sparkle(), 2.85, 0.5)
place(sfx, pop(), 3.5, 0.5)
place(sfx, whoosh(0.4), 4.05, 0.45)
place(sfx, pop(), 4.95, 0.45)
place(sfx, whoosh(0.4), 6.2, 0.45)
place(sfx, pop(), 7.0, 0.35)
place(sfx, sparkle(), 9.2, 0.55)

mix = voice * 1.0 + music * duck * 0.55 + sfx * 0.55
mix = np.tanh(mix * 1.1) / np.tanh(1.1)
mix = mix / np.abs(mix).max() * 0.95
st = np.stack([mix, mix], 1)
w = wave.open('mix.wav', 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((st * 32767).astype(np.int16).tobytes()); w.close()
print('audio ok')
