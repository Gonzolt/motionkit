#!/usr/bin/env python3
"""Sound for lab/nocode: synthesised effects on the film's own CUES, mixed with
the voiceover. No samples, no library: numpy only, deterministic (seeded).

    python3 make_sfx.py        # -> mix.wav (and sfx.wav for inspection)

The cues come from films/nocode.cues.js (via node), the same list that shakes
the picture, so a thump and its camera punch land on the same frame.
"""
import json, os, subprocess, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
FILMS = os.path.join(HERE, '..', '..', 'films')
SR = 48000
rng = np.random.default_rng(7)

cues = json.loads(subprocess.run(
    ['node', '-e', "import('./nocode.cues.js').then(m=>console.log(JSON.stringify({c:m.CUES,d:m.DURATION})))"],
    cwd=FILMS, capture_output=True, text=True, check=True).stdout)
DUR = cues['d']
N = int(DUR * SR) + SR


def read(path):
    with wave.open(path) as w:
        a = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
        assert w.getframerate() == SR
    return a


def band(x, lo, hi):
    """Brick-ish band-pass in the frequency domain, with soft edges."""
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    g = 1 / (1 + (lo / np.maximum(f, 1)) ** 4) / (1 + (f / hi) ** 4)
    return np.fft.irfft(X * g, len(x)).astype(np.float32)


def env(n, attack, decay):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(attack, 1e-4)) * np.exp(-t / decay)


def thump(dur, f0, f1, decay):
    t = np.arange(int(dur * SR)) / SR
    f = f1 + (f0 - f1) * np.exp(-t * 18)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) * env(len(t), 0.002, decay)).astype(np.float32)


def click(dur=0.012, lo=2500, hi=9000):
    n = int(dur * SR)
    return band(rng.standard_normal(n * 4).astype(np.float32), lo, hi)[:n] * env(n, 0.0005, dur / 3)


def hit(a):
    x = thump(0.35, 120, 48, 0.09) * 0.9
    x[: int(0.012 * SR)] += click() * 0.5
    return x * a


def slam(a):
    x = thump(0.7, 140, 38, 0.17)
    c = band(rng.standard_normal(int(0.25 * SR)).astype(np.float32), 900, 7000) * env(int(0.25 * SR), 0.001, 0.035)
    x[: len(c)] += c * 0.55
    return x * a * 1.1


def whoosh(a, dur=0.42):
    """Peak at the cue: the sweep rises into it and falls after."""
    n = int(dur * SR)
    noise = rng.standard_normal(n).astype(np.float32)
    out = np.zeros(n, np.float32)
    t = np.arange(n) / n
    bands = [(150, 500), (400, 1200), (1000, 3000), (2500, 7000)]
    for i, (lo, hi) in enumerate(bands):
        c = 0.35 + 0.12 * i               # each band peaks a little later: an upward sweep
        e = np.exp(-((t - c) / 0.16) ** 2)
        out += band(noise, lo, hi) * e
    return out / (np.abs(out).max() + 1e-6) * 0.55 * a, int(0.45 * n)


def tick(a):
    n = int(0.06 * SR)
    t = np.arange(n) / SR
    return (np.sin(2 * np.pi * 1760 * t) * 0.5 + np.sin(2 * np.pi * 3520 * t) * 0.2) * env(n, 0.001, 0.012) * a


def rubber(a):
    n = int(0.6 * SR)
    t = np.arange(n) / SR
    f = 140 + 520 * (1 - np.exp(-t * 7)) + 25 * np.sin(2 * np.pi * 11 * t) * np.exp(-t * 4)
    ph = 2 * np.pi * np.cumsum(f) / SR
    tone = np.sin(ph) + 0.35 * np.sin(2 * ph)
    return (tone * env(n, 0.005, 0.22) * 0.5 * a).astype(np.float32)


def riser(a, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 180 * (6 ** (t / dur))
    ph = 2 * np.pi * np.cumsum(f) / SR
    noise = band(rng.standard_normal(n).astype(np.float32), 2000, 9000)
    shape = (t / dur) ** 2.2
    return ((np.sin(ph) * 0.35 + noise * 0.25) * shape * a).astype(np.float32)


def reverb(x, seconds=1.1, wet=0.18):
    n = int(seconds * SR)
    ir = rng.standard_normal(n).astype(np.float32) * np.exp(-np.arange(n) / SR / (seconds / 5))
    ir = band(ir, 200, 6000)
    L = len(x) + n
    y = np.fft.irfft(np.fft.rfft(x, L) * np.fft.rfft(ir, L), L)[: len(x)]
    return x + wet * y / (np.abs(y).max() + 1e-6) * np.abs(x).max()


sfx = np.zeros(N, np.float32)


def add(x, at, offset=0):
    i = int(at * SR) - offset
    j = max(0, -i)
    i = max(0, i)
    seg = x[j: j + N - i]
    sfx[i: i + len(seg)] += seg


for c in cues['c']:
    k, a, t0 = c['kind'], c['amp'], c['t']
    if k == 'hit': add(hit(a), t0)
    elif k == 'slam': add(slam(a), t0)
    elif k == 'whoosh':
        w, peak = whoosh(a)
        add(w, t0, peak)
    elif k == 'tick': add(tick(a), t0)
    elif k == 'rubber': add(rubber(a), t0)
    elif k == 'riser': add(riser(a, c['until'] - t0), t0)

sfx = reverb(sfx)

# A bed: two detuned low saws, low-passed, breathing slowly. Quiet; it is there
# so the silences between lines are a room and not a dropout.
t = np.arange(N) / SR
saw = lambda f: 2 * ((t * f) % 1) - 1
bed = band((saw(55) + saw(55.4) + 0.5 * saw(82.6)).astype(np.float32), 30, 420)
bed *= (0.6 + 0.4 * np.sin(2 * np.pi * t / 7.5)) * np.minimum(1, t / 1.5) * np.minimum(1, (DUR + 0.5 - t).clip(0) / 2)
bed = bed / np.abs(bed).max() * 0.08

vo = read(os.path.join(HERE, 'vo.wav'))
vo = np.pad(vo, (0, max(0, N - len(vo))))[:N]
# duck the effects a little under speech so words stay on top
speech = np.convolve(np.abs(vo), np.ones(2400) / 2400, mode='same')
duck = 1 - 0.35 * np.clip(speech / (speech.max() + 1e-6) * 4, 0, 1)
mix = vo * 0.9 + sfx * 0.55 * duck + bed
mix = mix[: int(DUR * SR)]
mix = mix / np.abs(mix).max() * 0.94


def write(path, x):
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())


write(os.path.join(HERE, 'sfx.wav'), sfx[: int(DUR * SR)] / (np.abs(sfx).max() + 1e-6) * 0.9)
write(os.path.join(HERE, 'mix.wav'), mix)
print(f"{len(cues['c'])} cues, {DUR:.2f} s -> mix.wav")
