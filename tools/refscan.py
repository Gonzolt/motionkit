#!/usr/bin/env python3
"""Take a reference edit apart: tempo, cuts, flashes, monochrome runs, contact sheets.

    python tools/refscan.py ref.mov                        # -> out/refscan/ref/
    python tools/refscan.py a.mov b.mov c.mov --out out/refscan
    python tools/refscan.py ref.mov --strip 4.2 --strip 26.5 --strip-len 2
    python tools/refscan.py ref.mov --lyrics               # + faster-whisper lines

WHY. "Make it like these" is only actionable once "these" are numbers: how
fast the cuts come, whether they sit on the beat, how often the frame flashes,
where the picture goes black-and-white, how long the hook is. A contact sheet
shows the look; this file shows the timing. Run it on every reference before
planning an edit (frag-edit skill), and on your own export afterwards to see
whether the shapes match.

Per clip it writes:
  sheet.png          one tile per second, timestamped, read row by row
  strip-<t>.png      10 fps around a moment (--strip), to see a transition frame by frame
  scan.json          everything below, machine-readable
and prints a one-screen summary.

What it measures (30 fps, 96x54 thumbnails, so it is fast and approximate):
  content_end    where a platform end card starts (TikTok's dark logo screen), trimmed from everything else
  bpm, beats     autocorrelation of spectral flux; half/double tempo is ambiguous, check by ear or strip
  cut_phase      where in the beat the cuts land, 8 bins. Piled into one or two bins = locked to the
                 grid (beat0 itself can be off by a fraction, so read the shape, not the bin number)
  burst_gap      median spacing of quick cuts, in beats: 1.0 = on every beat, 0.5 = on eighths
  cuts           colour-histogram jumps that stand out from their neighbours; whip pans and
                 flashes can still count, so treat on-beat ratios as a shape, not a verdict
  flashes        frame-to-frame brightness jumps; flash_rate_max is the worst 1-second window
                 (WCAG 2.3.1 allows 3)
  mono_runs      stretches with almost no colour (B&W intros, manga inserts, desaturated outros)

ffmpeg must be on PATH (on this machine: export PATH="/c/Program Files/Shotcut:$PATH").
Needs numpy and Pillow. --lyrics needs faster-whisper (requirements.txt).
"""

import argparse, json, os, subprocess, sys, wave, tempfile
import numpy as np
from PIL import Image, ImageDraw

FPS = 30
TW, TH = 96, 54


def ffmpeg(*args, capture=True):
    return subprocess.run(['ffmpeg', '-v', 'error', *args], capture_output=capture, check=True).stdout


def probe(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration:stream=width,height,codec_type',
                          '-of', 'json', path], capture_output=True, check=True).stdout
    j = json.loads(out)
    v = next(s for s in j['streams'] if s.get('codec_type') == 'video')
    return float(j['format']['duration']), v['width'], v['height']


def thumbs(path, w=TW, h=TH):
    raw = ffmpeg('-i', path, '-vf', f'fps={FPS},scale={w}:{h}', '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-')
    return np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3)


def mono_audio(path, sr=16000):
    with tempfile.TemporaryDirectory() as d:
        wav = os.path.join(d, 'a.wav')
        ffmpeg('-y', '-i', path, '-vn', '-ac', '1', '-ar', str(sr), wav)
        with wave.open(wav) as f:
            return np.frombuffer(f.readframes(f.getnframes()), np.int16).astype(np.float32) / 32768


# ---------- picture ----------

def end_card(F):
    """First frame of a trailing run of near-uniform dark frames (the TikTok/Reels outro)."""
    n = len(F)
    flat = np.zeros(n, bool)
    for k in range(n):
        f = F[k].reshape(-1, 3).astype(np.int16)
        mode = np.median(f, axis=0)
        near = (np.abs(f - mode).sum(1) < 40).mean()
        flat[k] = near > 0.8 and mode.mean() < 60
    k = n
    while k > 0 and flat[k - 1]:
        k -= 1
    # a black hold right before the card belongs to the edit's ending, keep it
    return k / FPS if n - k > FPS else n / FPS


def hist(f, bins=8):
    q = (f.reshape(-1, 3) // (256 // bins)).astype(np.int32)
    h = np.bincount(q[:, 0] * bins * bins + q[:, 1] * bins + q[:, 2], minlength=bins ** 3).astype(np.float32)
    return h / h.sum()


def cuts(F, end):
    n = min(len(F), int(end * FPS))
    H = np.stack([hist(F[k]) for k in range(n)])
    d = np.concatenate([[0], np.abs(np.diff(H, axis=0)).sum(1)])  # 0…2
    out = []
    for k in range(1, n):
        lo, hi = max(1, k - 8), min(n, k + 9)
        ctx = np.median(d[lo:hi])
        if d[k] > 0.5 and d[k] > 3 * ctx and d[k] == d[max(1, k - 2):min(n, k + 3)].max():
            out.append(k / FPS)
    return out


def flashes(F, end):
    n = min(len(F), int(end * FPS))
    lum = F[:n].astype(np.float32).mean(axis=(1, 2, 3))
    return [k / FPS for k in range(1, n) if lum[k] - lum[k - 1] > 45]


def worst_window(times, window=1.0):
    best, at = 0, None
    for i, t in enumerate(times):
        c = sum(1 for u in times[i:] if u - t < window)
        if c > best:
            best, at = c, t
    return best, at


def mono_runs(F, end, min_len=0.13):
    n = min(len(F), int(end * FPS))
    f = F[:n].astype(np.int16)
    sat = (f.max(3) - f.min(3)).mean(axis=(1, 2))
    runs, k = [], 0
    while k < n:
        if sat[k] < 12:
            j = k
            while j < n and sat[j] < 12:
                j += 1
            if (j - k) / FPS >= min_len:
                runs.append([round(k / FPS, 2), round(j / FPS, 2)])
            k = j
        else:
            k += 1
    return runs, float(sat.mean())


# ---------- sound ----------

def flux(x, sr, hop=160, n=1024):
    win = np.hanning(n)
    nf = (len(x) - n) // hop
    spec = np.abs(np.fft.rfft(np.stack([x[i * hop:i * hop + n] * win for i in range(nf)]), axis=1))
    spec = np.log1p(spec * 10)
    d = np.concatenate([[0], np.maximum(0, np.diff(spec, axis=0)).sum(1)])
    return (d - d.mean()) / (d.std() + 1e-9), sr / hop


def tempo(env, fr, lo_bpm=70, hi_bpm=180):
    e = env - env.mean()
    ac = np.correlate(e, e, 'full')[len(e) - 1:]
    lo, hi = int(fr * 60 / hi_bpm), int(fr * 60 / lo_bpm)
    lag = lo + int(np.argmax(ac[lo:hi]))
    return 60 * fr / lag


def beat_grid(env, fr, bpm):
    per = fr * 60 / bpm
    best = (-1e9, 0)
    for ph in np.linspace(0, per, 64, endpoint=False):
        idx = np.arange(ph, len(env), per).astype(int)
        s = env[idx].sum()
        if s > best[0]:
            best = (s, ph)
    return np.arange(best[1], len(env), per) / fr


# ---------- sheets ----------

def sheet(path, dur, out, cols=8, w=240):
    raw = ffmpeg('-i', path, '-vf', f'fps=1,scale={w}:-2', '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-')
    _, vw, vh = probe(path)
    h = int(round(w * vh / vw / 2) * 2)
    fr = np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3)
    rows = (len(fr) + cols - 1) // cols
    img = Image.new('RGB', (cols * (w + 2), rows * (h + 2)), (12, 12, 12))
    d = ImageDraw.Draw(img)
    for i, f in enumerate(fr):
        x, y = (i % cols) * (w + 2), (i // cols) * (h + 2)
        img.paste(Image.fromarray(f), (x, y))
        d.rectangle([x, y + h - 16, x + 34, y + h], fill=(0, 0, 0))
        d.text((x + 3, y + h - 15), f'{i}s', fill=(255, 220, 0))
    img.save(out)


def strip(path, at, length, out, fps=10, cols=5, w=320):
    raw = ffmpeg('-ss', str(at), '-t', str(length), '-i', path, '-vf', f'fps={fps},scale={w}:-2',
                 '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-')
    _, vw, vh = probe(path)
    h = int(round(w * vh / vw / 2) * 2)
    fr = np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3)
    rows = (len(fr) + cols - 1) // cols
    img = Image.new('RGB', (cols * (w + 2), rows * (h + 2)), (12, 12, 12))
    d = ImageDraw.Draw(img)
    for i, f in enumerate(fr):
        x, y = (i % cols) * (w + 2), (i // cols) * (h + 2)
        img.paste(Image.fromarray(f), (x, y))
        d.rectangle([x, y + h - 16, x + 48, y + h], fill=(0, 0, 0))
        d.text((x + 3, y + h - 15), f'{at + i / fps:.1f}', fill=(255, 220, 0))
    img.save(out)


def lyrics(path):
    from faster_whisper import WhisperModel
    m = WhisperModel('small', device='cpu', compute_type='int8')
    segs, info = m.transcribe(path, word_timestamps=False)
    return info.language, [[round(s.start, 2), round(s.end, 2), s.text.strip()] for s in segs]


# ---------- main ----------

def scan(path, outdir, a):
    os.makedirs(outdir, exist_ok=True)
    dur, vw, vh = probe(path)
    F = thumbs(path)
    end = end_card(F)
    C = cuts(F, end)
    FL = flashes(F, end)
    runs, sat = mono_runs(F, end)
    x = mono_audio(path)
    env, fr = flux(x, 16000)
    env = env[:int(end * fr)]
    bpm = tempo(env, fr)
    beats = beat_grid(env, fr, bpm)
    eighths = np.sort(np.concatenate([beats, beats + 30 / bpm]))
    near = lambda c, g: float(np.min(np.abs(g - c))) if len(g) else 9
    shots = np.diff([0] + C + [end])
    fmax, fat = worst_window(FL)
    # Where in the beat the cuts fall (8 bins). A grid-locked edit piles into one
    # or two bins even when beat0 is off by a fraction; a free edit is flat.
    p = 60 / bpm
    phase = np.histogram(((np.array(C) - beats[0]) / p) % 1, bins=8, range=(0, 1))[0] if len(C) and len(beats) else []
    gaps = np.diff(C)
    burst = gaps[(gaps > 0.15) & (gaps < 1.2 * p)]
    res = {
        'file': os.path.basename(path), 'size': [vw, vh], 'duration': round(dur, 2), 'content_end': round(end, 2),
        'bpm': round(bpm, 1), 'beat0': round(float(beats[0]), 3) if len(beats) else None,
        'cuts': [round(c, 2) for c in C], 'cut_count': len(C), 'cuts_per_sec': round(len(C) / end, 2),
        'cuts_on_beat': round(sum(near(c, beats) <= 0.07 for c in C) / max(1, len(C)), 2),
        'cuts_on_eighth': round(sum(near(c, eighths) <= 0.07 for c in C) / max(1, len(C)), 2),
        'cut_phase': [int(v) for v in phase],
        'burst_gap_beats': round(float(np.median(burst)) / p, 2) if len(burst) else None,
        'shot_median': round(float(np.median(shots)), 2), 'shot_p90': round(float(np.percentile(shots, 90)), 2),
        'longest_shot': [round(float(shots.max()), 2), round(([0] + C)[int(np.argmax(shots))], 2)],
        'flashes': [round(f, 2) for f in FL], 'flash_rate_max': fmax, 'flash_rate_at': fat,
        'mono_runs': runs, 'mean_saturation': round(sat, 1),
    }
    if a.lyrics:
        res['lyrics_lang'], res['lyrics'] = lyrics(path)
    sheet(path, dur, os.path.join(outdir, 'sheet.png'))
    for s in a.strip or []:
        strip(path, s, a.strip_len, os.path.join(outdir, f'strip-{s:.1f}.png'))
    with open(os.path.join(outdir, 'scan.json'), 'w', encoding='utf-8') as f:
        json.dump(res, f, indent=1, ensure_ascii=False)
    return res


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('files', nargs='+')
    ap.add_argument('--out', default='out/refscan')
    ap.add_argument('--strip', type=float, action='append', help='start of a 10 fps strip (repeatable)')
    ap.add_argument('--strip-len', type=float, default=2.0)
    ap.add_argument('--lyrics', action='store_true', help='transcribe sung lines with faster-whisper (times are rough on music)')
    a = ap.parse_args()
    sys.stdout.reconfigure(encoding='utf-8')
    for p in a.files:
        name = os.path.splitext(os.path.basename(p))[0]
        r = scan(p, os.path.join(a.out, name), a)
        print(f"{r['file']}  {r['size'][0]}x{r['size'][1]}  {r['content_end']}s of {r['duration']}s  "
              f"{r['bpm']} BPM  {r['cut_count']} cuts ({r['cuts_per_sec']}/s, median shot {r['shot_median']}s)  "
              f"on beat {r['cuts_on_beat']:.0%} / eighth {r['cuts_on_eighth']:.0%}  "
              f"phase {r['cut_phase']}  bursts every {r['burst_gap_beats']} beat  "
              f"flashes {len(r['flashes'])} (worst {r['flash_rate_max']}/s at {r['flash_rate_at']})  "
              f"mono {sum(b - a_ for a_, b in r['mono_runs']):.1f}s")
        for l in r.get('lyrics', []):
            print(f'    {l[0]:6.2f}-{l[1]:6.2f} {l[2]}')


if __name__ == '__main__':
    main()
