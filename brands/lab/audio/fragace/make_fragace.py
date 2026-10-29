"""fragace: every Medal ace on one song, cut with the frag-edit skill. 16:9, 60 fps.

    python make_fragace.py                 # plan + frames + mix
    python make_fragace.py --plan-only     # rewrite films/fragace.plan.js only

ffmpeg must be on PATH (here: PATH="/c/Program Files/Shotcut:$PATH").

Shape (music1: 83.2 BPM, drop on beat 4, the track stops dead at 35.3 s):

  cold   beats 0-4    the finale's ace kill as a flash-forward, slow, black-and-white
  A      beats 4-16   ace 0818, five kills on beats, colour comes on with the drop
  card   beats 14-16  a phone holding ace 0613 pops over A's ace and swallows the frame
  B      beats 16-28  ace 0613 (Jett), five kills on beats
  burst  beats 28-33.5  the ace kill of the other eleven aces, half a beat each
  C      beats 33.5-end ace 0924, its ace held in slow-mo, desaturates, black on the stop

Kill times are the first frame of the kill emblem (bottom centre), read by eye
from strips (20 fps, then corrected to the frame). Medal's bookmarks are 0.5-0.85 s LATE on the older clips
and ~0.04 s early on the newer ones, so the bookmark alone would put kills off
the beat. Beat times are music1's measured beats (beats.py in ../ace), which
drift up to 58 ms from a metronome, so kills land on the real beat.

Between two kills the footage runs at a solved speed v with slow windows
(R_KILL) around each kill. If v would be over V_MAX the gap becomes a jump
cut on a beat between them, each side anchored to its own kill. A piece is
{clip, f0, f1, fa, sa, keys}: source time = sa + speedRamp(t) - speedRamp(fa),
the same integral as lib/fx.js speedRamp, so the film and this file agree.
"""

import argparse
import json
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CLIPS = Path(r'C:\Medal\Clips\Valorant')
MUSIC = Path.home() / 'Downloads' / 'music1.mp3'
OUT = ROOT / 'out' / 'fragace'
PLAN_JS = ROOT / 'brands' / 'lab' / 'films' / 'fragace.plan.js'

SRC_FPS = 60
FRAME_W, FRAME_H = 1280, 720            # 16:9 centre crop of the 4:3 clip, shown at 1.5x

# music1, measured (beats.py): 51 beats, drop on beat 4, digital silence from 35.35 s
BEATS = [0.296, 0.999, 1.739, 2.438, 3.182, 3.903, 4.624, 5.346, 6.037, 6.788, 7.51, 8.231, 8.94, 9.674,
         10.379, 11.117, 11.838, 12.559, 13.281, 14.002, 14.723, 15.445, 16.166, 16.904, 17.609, 18.367,
         19.064, 19.773, 20.494, 21.216, 21.937, 22.709, 23.38, 24.125, 24.845, 25.565, 26.285, 27.028,
         27.748, 28.468, 29.188, 29.814, 30.627, 31.37, 32.09, 32.81, 33.53, 34.249, 34.969, 35.643, 36.364]
DROP = 4
STOP = 35.30                             # the song's last sound; black from here
DURATION = 35.90

# Medal ids (the time stamp in the file name) and kill-emblem times, checked by eye.
ACES = {
    '20260818003505740': [9.36, 12.80, 15.35, 16.15, 18.76],
    '20260613024539628': [9.13, 19.16, 22.78, 25.39, 28.12],
    '20260924192707914': [9.94, 11.00, 13.60, 14.90, 26.33],
}
# Those reads were from strips every 3rd frame; at every frame the emblem shows
# 1-3 frames earlier (checked on four kills), so every kill moves 2 frames back.
EMBLEM_EARLY = 2 / SRC_FPS
ACES = {c: [round(k - EMBLEM_EARLY, 4) for k in ks] for c, ks in ACES.items()}
A, B, C = ACES
BURST = [  # (clip, ace kill) for the eleven other aces, ordered so neighbours differ
    ('20260407232617316', 24.55), ('20260816214136446', 53.78), ('20260328231237046', 34.27),
    ('20261015171513176', 48.20), ('20260331000310563', 28.53), ('20260830213235410', 62.85),
    ('20260405200551498', 48.87), ('20261016213001807', 32.42), ('20260411035332439', 38.05),
    ('20261013175902626', 32.26), ('20260407232618314', 37.70),
]
BURST = [(c, round(k - EMBLEM_EARLY, 4)) for c, k in BURST]
KILL_BEATS = {A: [6, 8, 10, 11, 13], B: [17, 20, 22, 24, 26], C: [36, 38, 40, 42, 44]}
SECTION = {A: (DROP, 16), B: (14, 28), C: (33.5, None)}      # C runs to STOP
CARD = {'in': 14, 'like': 15, 'out': 16}
BURST_START, BURST_PRE = 28, 0.20

R_KILL = 0.4             # speed through a kill
PRE, POST, RAMP = 0.25, 0.35, 0.12
V_MAX, V_JUMP = 1.6, 1.15
ACE_STOP, ACE_SLOW = 0.08, 0.3


def beat(x):
    """Beat time; x may be fractional (28.5 = halfway between beats 28 and 29)."""
    i = int(x)
    return BEATS[i] + (x - i) * (BEATS[i + 1] - BEATS[i]) if x != i else BEATS[i]


def ramp(t, keys):
    """lib/fx.js speedRamp, line for line."""
    if not keys:
        return t
    src, pt, pv = 0.0, 0.0, keys[0][1]
    for kt, kv in keys:
        if t <= kt:
            v = kv if pt == kt else pv + (kv - pv) * ((t - pt) / (kt - pt))
            return src + (pv + v) / 2 * (t - pt)
        src += (pv + kv) / 2 * (kt - pt)
        pt, pv = kt, kv
    return src + pv * (t - pt)


def src_at(p, t):
    return p['sa'] + ramp(t, p['keys']) - ramp(p['fa'], p['keys'])


def piece(clip, f0, f1, fa, sa, keys, **kw):
    return {'clip': clip, 'f0': round(f0, 4), 'f1': round(f1, 4), 'fa': round(fa, 4), 'sa': sa,
            'keys': [[round(a, 4), round(b, 4)] for a, b in keys], **kw}


def slow_into(f):
    return [[f - PRE - RAMP, None], [f - PRE, R_KILL], [f, R_KILL]]


def ace_part(clip, end_t):
    """Pieces for one ace: kills on their beats, solved speeds, jump cuts where needed."""
    ks, kb = ACES[clip], KILL_BEATS[clip]
    F = [beat(b) for b in kb]
    t0 = beat(SECTION[clip][0])
    pieces, kills = [], []
    # intro: real time, slowing into kill 1
    keys = [[t0, 1.0], [F[0] - PRE - RAMP, 1.0], [F[0] - PRE, R_KILL], [F[0], R_KILL]]
    cur = {'start': t0, 'fa': F[0], 'sa': ks[0], 'keys': keys}
    for i in range(4):
        D, g = F[i + 1] - F[i], ks[i + 1] - ks[i]
        win = PRE + POST + RAMP / 2      # each ramp (RAMP/2 long) averages R_KILL and v: half of it counts here
        w = min(1.0, 0.6 * D / win)
        v = (g - R_KILL * win * w) / (D - win * w)
        a, b = F[i], F[i + 1]
        if v <= V_MAX:              # one shot through both kills
            cur['keys'] += [[a + POST * w, R_KILL], [a + (POST + RAMP / 2) * w, v], [b - (PRE + RAMP / 2) * w, v],
                            [b - PRE * w, R_KILL], [b, R_KILL]]
            continue
        if g / D <= V_MAX:          # too tight for slow windows: straight through near real time
            cur['keys'] += [[a + 0.001, g / D], [b - 0.001, g / D], [b, R_KILL]]
            continue
        # jump cut on a beat between them (floor of the midpoint: more fight before the next kill)
        cb = (kb[i] + kb[i + 1]) // 2 if (kb[i + 1] - kb[i]) > 1 else kb[i] + 0.5
        cut = beat(cb)
        cur['keys'] += [[a + POST, R_KILL], [a + POST + RAMP, V_JUMP]]
        pieces.append(piece(clip, cur['start'], cut, cur['fa'], cur['sa'], cur['keys']))
        cur = {'start': cut, 'fa': b, 'sa': ks[i + 1],
               'keys': [[cut, V_JUMP], [b - PRE - RAMP, V_JUMP], [b - PRE, R_KILL], [b, R_KILL]], 'jump': True}
    # the ace: a hit-stop, then slow-mo to the end of the section
    fa = F[4]
    cur['keys'] += [[fa + 0.001, 0.0], [fa + ACE_STOP, 0.0], [fa + ACE_STOP + 0.001, ACE_SLOW], [end_t, ACE_SLOW]]
    pieces.append(piece(clip, cur['start'], end_t, cur['fa'], cur['sa'], cur['keys']))
    for i, f in enumerate(F):
        kills.append({'t': round(f, 4), 'n': i + 1, 'ace': i == 4, 'clip': clip})
    return pieces, kills


def build():
    pieces, kills, cuts = [], [], []
    # cold open: the finale's ace kill on beat 3, slow, hit-stop, black-and-white
    cf = beat(3)
    pieces.append(piece(C, 0, beat(DROP), cf, ACES[C][4],
                        [[0, 0.55], [cf - 0.1, 0.55], [cf, 0.3], [cf + 0.001, 0], [cf + ACE_STOP, 0], [cf + ACE_STOP + 0.001, 0.22]],
                        tag='cold'))
    kills.append({'t': round(cf, 4), 'n': 0, 'ace': True, 'clip': C})
    pa, ka = ace_part(A, beat(SECTION[A][1]))
    pb, kb = ace_part(B, beat(28))
    pb[0]['tag'] = 'card'                       # starts inside the card at beat 14, full frame from 16
    burst = []
    for j, (clip, k) in enumerate(BURST):
        h0, h1 = beat(BURST_START + j / 2), beat(BURST_START + (j + 1) / 2)
        burst.append(piece(clip, h0, h1, h0 + BURST_PRE, k, [[h0, 1.0]], tag='burst'))
        kills.append({'t': round(h0 + BURST_PRE, 4), 'n': 0, 'ace': True, 'clip': clip, 'burst': True})
    pc, kc = ace_part(C, STOP)
    pieces += pa + pb + burst + pc
    kills += ka + kb + kc
    # main track order: a piece shows from its f0, except B's first, which is in the card until CARD out
    for p in pieces:
        p['show'] = round(beat(CARD['out']), 4) if p.get('tag') == 'card' else p['f0']
    cuts = sorted({p['show'] for p in pieces if p['show'] > 0})
    return pieces, kills, cuts


def clip_path(cid):
    return CLIPS / f'MedalTVValorant{cid}.mp4'


def probe(path):
    o = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height',
                        '-of', 'csv=p=0', str(path)], capture_output=True, text=True, check=True).stdout.strip()
    w, h = map(int, o.split(','))
    return w, h


def ranges(pieces):
    """Source frame ranges each clip needs, merged."""
    need = {}
    for p in pieces:
        a, b = src_at(p, p['f0']), src_at(p, p['f1'])
        lo, hi = int(min(a, b) * SRC_FPS) - 3, int(max(a, b) * SRC_FPS) + 4
        need.setdefault(p['clip'], []).append([max(0, lo), hi])
    for c, rs in need.items():
        rs.sort()
        m = [rs[0]]
        for r in rs[1:]:
            if r[0] <= m[-1][1] + 30:
                m[-1][1] = max(m[-1][1], r[1])
            else:
                m.append(r)
        need[c] = m
    return need


def extract(need):
    for cid, rs in need.items():
        d = OUT / cid
        d.mkdir(parents=True, exist_ok=True)
        w, h = probe(clip_path(cid))
        ch = round(w * 9 / 16)
        vf = f'crop={w}:{ch}:0:{(h - ch) // 2},scale={FRAME_W}:{FRAME_H}:flags=lanczos'
        for lo, hi in rs:
            if all((d / f'f{n:05d}.jpg').exists() for n in (lo, hi)):
                continue
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{lo / SRC_FPS:.4f}', '-i', str(clip_path(cid)),
                            '-frames:v', str(hi - lo + 1), '-vf', vf, '-q:v', '3', '-start_number', str(lo),
                            str(d / 'f%05d.jpg')], check=True)
        print(f'{cid}: {sum(hi - lo + 1 for lo, hi in rs)} frames in {len(rs)} ranges')


def mix():
    OUT.mkdir(parents=True, exist_ok=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(MUSIC), '-t', f'{DURATION}',
                    '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000', '-c:a', 'aac', '-b:a', '256k',
                    str(OUT / 'mix.m4a')], check=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--plan-only', action='store_true')
    a = ap.parse_args()
    pieces, kills, cuts = build()
    for p in pieces:                # every kill must land on its source frame
        for k in kills:
            if p['clip'] == k['clip'] and p['f0'] <= k['t'] <= p['f1'] and not k.get('burst') and k['n']:
                want = ACES[p['clip']][k['n'] - 1]
                got = src_at(p, k['t'])
                assert abs(got - want) < 0.003, (p['clip'], k, got, want)     # keys are rounded to 0.1 ms
    plan = {
        'fps': SRC_FPS, 'frame': [FRAME_W, FRAME_H], 'beats': BEATS, 'drop': DROP, 'stop': STOP,
        'duration': DURATION, 'card': {k: round(beat(v), 4) for k, v in CARD.items()},
        'sections': {'cold': [0, beat(DROP)], 'a': [beat(DROP), beat(16)], 'b': [beat(16), beat(28)],
                     'burst': [beat(28), beat(BURST_START + len(BURST) / 2)], 'c': [beat(SECTION[C][0]), STOP],
                     'end': [STOP, DURATION]},
        'monoOut': [beat(46), beat(48)],
        'pieces': pieces, 'kills': kills, 'cuts': cuts,
    }
    PLAN_JS.write_text('/* Written by brands/lab/audio/fragace/make_fragace.py. Do not edit: change the script. */\n'
                       f'export const PLAN = {json.dumps(plan, indent=1)};\n', encoding='utf-8')
    jumps = sum(1 for p in pieces if p['f0'] > 0)
    print(f'plan: {len(pieces)} pieces, {len(kills)} kills, {len(cuts)} cuts -> {PLAN_JS.name}')
    for p in pieces:
        print(f"  {p['clip'][4:8]} {p.get('tag', ''):5s} film {p['f0']:6.2f}-{p['f1']:6.2f}  src {src_at(p, p['f0']):6.2f}-{src_at(p, p['f1']):6.2f}")
    if a.plan_only:
        return
    extract(ranges(pieces))
    mix()
    print('mix ->', OUT / 'mix.m4a')


if __name__ == '__main__':
    main()
