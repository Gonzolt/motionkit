# motionkit

Motion design in plain code: kinetic typography, shape transitions, a camera
rig, springs, motion blur and word-synced voiceover. No After Effects, no
image or video model. Every frame is a pure function of time `t`, so any frame
can be rendered, inspected and re-rendered exactly.

A film is an HTML page plus a `render(t)` function. Headless Chromium steps
through it one frame at a time and ffmpeg encodes the result.

**Example output:** [`media/nocode.mp4`](media/nocode.mp4) (29 s, 1080x1920,
30 fps, with sound), rendered with
`node tools/export.mjs --film lab/nocode --fps 30 --blur 12 --shutter 0.4`.
It is an earlier render: the last line differs from the current script.

<p align="center">
  <a href="media/nocode.mp4"><img src="media/nocode.gif" width="360" alt="nocode: preview (no sound). Click for the mp4 with sound."></a>
  <br><sub>Preview without sound. Click it for the mp4 with sound.</sub>
</p>

Five example films are included:

| Film | What it shows |
| --- | --- |
| `lab/nocode` | 29 s, 9:16. Kinetic type cut on every word of a voiceover, with synthesised sound effects on the same cues |
| `lab/motionlab` | 14 s catalogue of the primitives: masked rise, squash and stretch, fan, blocks, camera whip, slice smear |
| `lab/promo` | 15 s social promo read from `campaigns/launch/brief.json`: 3 hooks × 2 messages × 2 CTAs, picked with `?v=H2-M1-C1` |
| `lab/fxlab` | 39 s catalogue: every effect in `lib/fx.js` (finish, light, glitch, impact, trails, time remaps, goo, halftone, spotlight, letterbox) and the three caption presets |

## Requirements

| Tool | Version | Used for |
| --- | --- | --- |
| Node.js | 20 or newer | rendering, tools |
| ffmpeg + ffprobe | 5 or newer, on `PATH` | encoding, strips, audio |
| Python | 3.10 or newer | voiceover (edge-tts, Piper), sound, rhythm graph |
| Disk | about 1 GB | Chromium download plus the whisper model |

`npm install` downloads its own Chromium through puppeteer, so no system
browser is needed. Linux and macOS both work. On Windows, use WSL.

## Setup

```bash
git clone <this-repo-url> motionkit
cd motionkit

# 1. Node side (downloads Chromium, ~170 MB)
npm install

# 2. Python side (voiceover, sound effects, rhythm graph)
python3 -m venv .venv
source .venv/bin/activate          # Windows/WSL: same; fish: source .venv/bin/activate.fish
pip install -r requirements.txt

# 3. Check that everything is in place
npm test                           # unit tests, import check, lint
ffmpeg -version | head -1
```

Install ffmpeg with your package manager if it is missing:

```bash
sudo apt install ffmpeg            # Debian / Ubuntu
brew install ffmpeg                # macOS
```

## Render the example film

The voiceover audio is not committed (it is generated), so build it first.
The first run downloads the whisper `small` model (~460 MB) once.

```bash
source .venv/bin/activate
cd brands/lab/audio/nocode
python make_vo.py                  # TTS per line + word timestamps -> films/nocode.words.js
python make_sfx.py                 # sound effects on the film's cues + mix -> mix.wav
ffmpeg -y -i mix.wav -af loudnorm=I=-14:TP=-1.5:LRA=11 -c:a aac -b:a 192k mix.m4a
cd ../../../..

# fast preview export, no motion blur (~1 min)
node tools/export.mjs --film lab/nocode --fps 30 --audio brands/lab/audio/nocode/mix.m4a --out out/nocode-preview.mp4

# final export with real motion blur (12 sub-frames per frame, ~15-20 min)
node tools/export.mjs --film lab/nocode --fps 30 --blur 12 --shutter 0.4 \
  --audio brands/lab/audio/nocode/mix.m4a --out out/nocode.mp4
```

The film already ships with `nocode.words.js`, so steps that only touch the
picture work without the Python side at all:

```bash
node tools/export.mjs --film lab/motionlab --fps 30 --out out/motionlab.mp4
```

## Look at a film while you work

```bash
npm run serve                                    # http://localhost:5178/brands/lab/films/nocode.html
node tools/shot.mjs  --film lab/nocode --sheet 24 --cols 6          # contact sheet of the whole film
node tools/shot.mjs  --film lab/nocode --at 1.2,13.6,21.7           # single frames
node tools/strip.mjs --film lab/nocode --from 13.2 --to 14.2 --fps 30   # every frame of one move
node tools/strip.mjs --film lab/motionlab --from 2.9 --to 3.6 --fps 60 --probe '#word'  # measure the easing
node tools/onion.mjs --film lab/motionlab --range 2.5..3.3 --n 8        # one move's path as onion skin
node tools/framelint.mjs --film lab/nocode                          # clipped/off-frame/overlapping text, missing fonts and assets
node tools/snapshot.mjs --film lab/nocode --update                  # approve frames once …
node tools/snapshot.mjs --film lab/nocode                           # … then diff them after every change
python3 tools/rhythm.py out/nocode-preview.mp4                      # motion / rest timeline graph
node tools/subs.mjs --words brands/lab/films/nocode.words.js --srt out/nocode.srt   # subtitles (also --vtt, --ass)
python tools/transcribe.py take.mp4                                 # word times for any clip (faster-whisper)
node tools/variants.mjs --film lab/promo --brief campaigns/launch/brief.json --shots   # every hook, side by side
node tools/carousel.mjs --deck campaigns/launch/carousel.json      # carousel PNGs in the brand's look
node tools/copycheck.mjs campaigns/launch/posts.json               # post copy vs platform limits and brand voice
```

`shot`, `strip`, `lint`, `framelint`, `snapshot` and `onion` take `--json`. Each then prints
one result object on stdout, or `{"error":{"code","message"}}` with exit 1, so an
agent parses one line instead of scraping logs (`tools/report.mjs`). `framelint`,
`snapshot` and `onion` follow Kinetograph's `lint`, `snapshot` and `onion`.

Output goes to `out/` (git-ignored). In the browser preview, the bar at the
bottom plays, scrubs and loops. The shaded overlay marks where TikTok and Reels
draw their own UI; it is hidden in exports (add `--safe-zone` to `shot.mjs` to
capture it).

Judge motion with `strip.mjs`, not the contact sheet: a transition lasts 8-15
frames and a sheet will usually land on one of them at most.

## Make your own film

1. Copy `brands/lab` to `brands/<yours>`. Put colours and fonts in `theme.js`
   and `theme.css` only. `npm run lint` fails if a film names a raw colour or
   font, so a palette cannot drift between films.
2. Copy `films/motionlab.html` and `.js` and rename them. The HTML only loads
   `lib/film.css`, your `theme.css` and your film module.
3. In the film, build the DOM once, then write `render(t)` that sets every
   property from `t`. Never read the clock, never accumulate state, never use
   CSS transitions or `requestAnimationFrame`. That rule is what makes
   scrubbing, strips and motion blur work.
4. `node tools/export.mjs --film <yours>/<name>`.

### The library

| File | Gives you |
| --- | --- |
| `lib/motion.js` | `E` easing curves by job, closed-form `spring()`, keyframe `track()`, `stagger()`, `speed()`, seeded `noise`/`rand`/`impact`/`drift` |
| `lib/type.js` | `splitText` (with masks), `charIn`/`charOut`, `squashStretch`, `typewriter`, `scramble`, `countTo` |
| `lib/fx.js` | 26 effects as functions of `t` (grain, scanlines, halftone, grades, leaks, flare, glow, shine, spotlight, blurs, trails, RGB split, slice and block glitch, warp, flash, ring, sparks, speed lines, dust, goo, letterbox) and drivers (`beatPulse`, `flicker`, `shake`, `hitStop`, `speedRamp`, `flashCheck`). See the `film-fx` skill |
| `lib/promo.js` | social pieces: product photo + `kenBurns`, `badge`, `price`, `stars`, `lowerThird`, `sticker`, `endCard`; platform `SAFE` zones, feed `CROPS`, `variant()` |
| `lib/captions.js` | `chunk()` word times into caption chunks, `makeCaptions`/`captions` in-film captions (pop, karaoke, line) |
| `lib/transitions.js` | `reveal(layer, shape, p)`: disc, wipe, fan, bars, blocks, inset; `pushThrough` |
| `lib/rig.js` | `makeRig`, `camera()` from tracks with impacts and handheld drift, `cameraBlur` |
| `lib/scenes.js` | the scene table: name scenes, never hard-code seconds |
| `lib/stage.js` | frame fitting, clock, scrubber and the `window.PK` export hook |

### Voiceover-driven films

`brands/lab/audio/nocode/` is the pattern:

1. `make_vo.py` renders the script one line at a time with edge-tts and joins
   the lines with gaps you set by hand. The gaps are the edit.
2. faster-whisper finds the start of every word. The script is known, so
   whisper only supplies timing; the words are labelled from the script.
3. `films/nocode.cues.js` turns word times into scene starts and a list of
   hits. The film shakes the camera on those cues and `make_sfx.py`
   synthesises effects on the same cues, so picture and sound cannot drift.
4. To check the mix without listening, run whisper on `mix.wav` and compare
   with the script. Effects that cover speech show up as missed words.

Change a line in `make_vo.py`, rerun the three audio commands and the film
retimes itself. To use your own recording instead of TTS, replace the
per-line clips (`line00.mp3`...) with your takes and keep the same file names.

Voice: `en-US-BrianNeural`. List others with `edge-tts --list-voices`.

### Voice engines

Every `make_vo.py` renders through `tools/voice/tts.py`, so the engine is an
environment variable and the script does not change:

| `TTS_ENGINE` | Runs | Cost | Default voice |
| --- | --- | --- | --- |
| `edge` (default) | online | free | `en-US-BrianNeural` |
| `piper` | offline, CPU | free | `en_US-ryan-high` (Norwegian: `no_NO-talesyntese-medium`) |
| `elevenlabs` | online | paid, `ELEVENLABS_API_KEY` | George (`JBFqnCBsd6RMkjVDRZzb`) |

```bash
TTS_ENGINE=piper python make_vo.py
TTS_ENGINE=piper TTS_VOICE=no_NO-talesyntese-medium python make_vo.py
python tools/voice/tts.py --engine piper --list
```

Piper voices download to `~/.cache/piper` on first use. Clips are cached per
engine, so switching engines never reuses another engine's audio.

## Skills

`.claude/skills/` holds Claude Code skills for the picture (effects,
subtitles, type, grade), social (promos, hooks, carousels, repurposing),
voice, editing, music and sound side of a film. Claude loads them by itself when it works in this repo;
start with `motionkit`. The index, sources and licences are in
[`.claude/skills/README.md`](.claude/skills/README.md).

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `no Chromium found` | Run `npm install` in the repo root. Or install `chromium` / `google-chrome` |
| edge-tts fails with HTTP 403 | `pip install -U edge-tts` (versions before 7.3 are rejected by the service) |
| A 0-byte `lineNN.mp3` after a failed TTS call | Delete it. The script reuses existing clips |
| `whisper could not place the words of ...` | The TTS clip is wrong or truncated: delete that line's mp3 and rerun |
| `shot.mjs` / export sits for minutes on one frame | A fine pattern (scanlines, a repeating gradient) under a blended layer such as grain. Put it above the grain; see the `film-fx` skill |
| `window.PK never appeared` | The film threw while loading. The error is printed under "the page reported" |
| `track keys out of order` | Two keyframes in a `track()` are not in time order, often two words closer together than the move |
| Ghost of two scenes on a hard cut in a `--blur` export | Put the cut half a frame early (`t >= a - 1/60` at 30 fps) |
| Visible steps on a very fast wipe with `--blur` | Raise `--blur` (12-16) or lower `--shutter` |

## Licences

Fonts in `brands/lab/assets/fonts` are Inter, Archivo and IBM Plex Mono, all
under the SIL Open Font License 1.1. The licence texts are in
`brands/lab/assets/fonts/licenses/`. The code has no licence yet: the
repository is private and all rights are reserved.
