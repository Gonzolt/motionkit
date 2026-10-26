#!/usr/bin/env python3
"""Pacing of a video, as numbers and a graph.

    python3 tools/rhythm.py reference.mp4
    python3 tools/rhythm.py out/lab-motionlab.mp4 reference.mp4 --out out/rhythm.png
    python3 tools/rhythm.py clip.mp4 --from 28 --to 38

WHY. "Rest, move, rest" is the single most useful rule in motion design and the
one thing a still frame cannot show. This measures how much the picture changes
from one frame to the next and turns that into a timeline: bursts of motion,
the calm between them, how long each lasts. Run it on a reference you admire
and on your own export, and compare the shapes, not the content: a film that is
all one height of activity feels busy and flat; a good one is peaks and valleys.

It cannot tell you whether the motion is *good*. It tells you the rhythm, which
is half of why a cut works, and it finds the exact second a cut or a wipe
happens so you can open a strip there (tools/strip.mjs, or ffmpeg -ss).

Activity is the mean absolute pixel change between consecutive frames, 0–100.
Cuts and wipes spike it; a held frame is 0; a slow camera drift is low.
"""
import argparse, json, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw


def load(path, t0, t1, fps, w=72, h=128):
    cmd = ['ffmpeg', '-v', 'error', '-ss', str(t0)] + (['-t', str(t1 - t0)] if t1 else []) + [
        '-i', path, '-vf', f'fps={fps},scale={w}:{h},format=gray', '-f', 'rawvideo', '-']
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, h, w).astype(np.float32)


def activity(frames):
    d = np.abs(np.diff(frames, axis=0)).mean(axis=(1, 2)) / 255 * 100
    return np.concatenate([[0], d])


def segments(a, fps, t0, hi, lo):
    """Hysteresis: a burst starts above `hi` and ends when it falls under `lo`."""
    out, i, n = [], 0, len(a)
    while i < n:
        if a[i] >= hi:
            j = i
            while j < n and a[j] >= lo:
                j += 1
            out.append((t0 + i / fps, t0 + j / fps, float(a[i:j].max())))
            i = j
        else:
            i += 1
    return out


def summarise(name, a, fps, t0):
    hi = max(1.2, float(np.percentile(a, 70)))
    segs = segments(a, fps, t0, hi, hi * 0.35)
    # merge bursts closer than 0.12 s: one gesture, not two
    merged = []
    for s in segs:
        if merged and s[0] - merged[-1][1] < 0.12:
            merged[-1] = (merged[-1][0], s[1], max(merged[-1][2], s[2]))
        else:
            merged.append(s)
    dur = len(a) / fps
    moving = sum(e - s for s, e, _ in merged)
    rests = [merged[i + 1][0] - merged[i][1] for i in range(len(merged) - 1)]
    print(f'\n{name}: {dur:.1f} s at {fps} fps, {len(merged)} bursts of motion')
    print(f'  threshold {hi:.1f}   in motion {moving / dur * 100:.0f} % of the time   '
          f'median burst {np.median([e - s for s, e, _ in merged]):.2f} s   '
          f'median rest {np.median(rests) if rests else 0:.2f} s   longest rest {max(rests) if rests else 0:.2f} s')
    big = sorted(merged, key=lambda s: -s[2])[:12]
    print('  strongest bursts (likely cuts / wipes), by time:')
    for s, e, pk in sorted(big):
        print(f'    {s:6.2f} → {e:6.2f}  ({e - s:4.2f} s)  peak {pk:5.1f}')
    return merged, hi


def draw(rows, out, fps):
    W, H, PAD, TOP = 1600, 150, 30, 24
    img = Image.new('RGB', (W + 2 * PAD, (H + 40) * len(rows) + 10), (14, 14, 16))
    d = ImageDraw.Draw(img)
    for r, (name, a, t0, merged, hi) in enumerate(rows):
        y0 = 10 + r * (H + 40)
        d.text((PAD, y0), name, fill=(238, 233, 223))
        base = y0 + TOP + H
        top = max(float(a.max()), hi * 2, 10)
        n = len(a)
        for s, e, _ in merged:
            x0 = PAD + (s - t0) / (n / fps) * W
            x1 = PAD + (e - t0) / (n / fps) * W
            d.rectangle([x0, y0 + TOP, max(x1, x0 + 1), base], fill=(32, 36, 22))
        pts = [(PAD + i / (n - 1) * W, base - min(v, top) / top * H) for i, v in enumerate(a)]
        d.line(pts, fill=(215, 255, 58), width=2)
        d.line([(PAD, base - hi / top * H), (PAD + W, base - hi / top * H)], fill=(80, 80, 80), width=1)
        for k in range(int((n / fps)) + 1):
            x = PAD + k / (n / fps) * W
            d.line([(x, base), (x, base + 5)], fill=(120, 120, 120))
            if k % 5 == 0:
                d.text((x + 2, base + 8), f'{t0 + k:g}s', fill=(140, 140, 140))
    img.save(out)
    print(f'\ngraph: {out}')


ap = argparse.ArgumentParser()
ap.add_argument('videos', nargs='+')
ap.add_argument('--fps', type=float, default=30)
ap.add_argument('--from', dest='t0', type=float, default=0)
ap.add_argument('--to', dest='t1', type=float, default=0)
ap.add_argument('--out', default='out/rhythm.png')
ap.add_argument('--json', action='store_true')
args = ap.parse_args()

rows = []
for v in args.videos:
    fr = load(v, args.t0, args.t1, args.fps)
    if len(fr) < 3:
        sys.exit(f'{v}: too few frames')
    a = activity(fr)
    merged, hi = summarise(v.split('/')[-1], a, args.fps, args.t0)
    rows.append((v.split('/')[-1], a, args.t0, merged, hi))
    if args.json:
        print(json.dumps([{'from': s, 'to': e, 'peak': p} for s, e, p in merged]))
import os
os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
draw(rows, args.out, args.fps)
