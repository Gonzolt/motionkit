---
name: subtitles
description: Captions and subtitles for motionkit films and for any other clip — word-synced captions drawn inside the film (pop, karaoke, line presets) from the same word times the picture is cut to, sidecar SRT / VTT / ASS files for YouTube, TikTok, Vimeo, and burned-in captions on footage motionkit did not draw. Includes free local transcription with faster-whisper (Norwegian too) and a name-fix list. Use for "add captions", "subtitles", "SRT", "burn in subtitles", "karaoke captions", "TikTok-style words", "transcribe this clip", or caption timing, chunking, placement and emphasis questions.
---

# subtitles

Most short-form viewers watch muted: the captions *are* the delivery. In this
repo they come from the same `films/<film>.words.js` the picture is cut to, so
re-recording the voice re-times picture, sound and captions together.

| Piece | File | What it does |
|---|---|---|
| Transcribe | `tools/transcribe.py` | Any audio/video → word times, locally, free (faster-whisper) |
| Chunk | `lib/captions.js` `chunk()` | Words → caption chunks by the rules below. Pure, runs in node |
| Draw | `lib/captions.js` `makeCaptions()` / `captions()` | Caption layer inside a film, a function of `t` like everything else |
| Sidecar | `tools/subs.mjs` | Same chunks → `.srt`, `.vtt`, `.ass` |
| Burn in | ffmpeg `ass=` filter | ASS onto footage that is not a motionkit film |

The catalogue film `lab/fxlab` (scenes `pop`, `karaoke`, `line`) shows all three presets.

## 1. Get word times

A motionkit film already has them: `make_vo.py` writes `films/<film>.words.js`.

Any other clip (your own recording, a game clip, a podcast):

```bash
python tools/transcribe.py take.mp4                                  # -> take.words.json
python tools/transcribe.py take.mp4 --lang no --model medium         # Norwegian: medium or larger
python tools/transcribe.py take.mp4 --js brands/lab/films/take.words.js   # a film can import it
python tools/transcribe.py take.mp4 --prompt "Claude, motionkit" --fix fixes.txt
```

- `--fix` is `heard=meant` per line (`cloud=Claude`). ASR destroys exactly the
  names the audience is watching for; keep one list per project.
- `--prompt` biases whisper's spelling of names and terms. It helps, it does not replace `--fix`.
- Pick the model by language: `small` is fine for clear English; Norwegian and
  accents want `medium` or `large-v3` (slower; `--device cuda` on the RTX).
- No ffmpeg needed: faster-whisper decodes audio and video itself (PyAV,
  pinned below 17 in `requirements.txt`: PyAV 19 breaks faster-whisper 1.2).
- `--fix` works on phrases too: `he frames=Keyframes` merges the two words into one with their combined timing.
- Paid alternative with diarisation: `elevenlabs-speech-to-text`.

**Re-derive times on the file you caption.** Any trim, speed change or re-cut
moves every word. Times from the source applied to the cut drift progressively.

## 2. The rules (what `chunk()` enforces)

| Rule | Value | Why |
|---|---|---|
| Never early | caption starts word onset **+0.08 s** | Text before the word reads as broken sync. Late is invisible, early is a bug |
| Chunk size | 2–3 words, 4 only when asked (`maxWords`) | A whole sentence lets the viewer read ahead and leave |
| Break on | punctuation, then a pause ≥ 0.35 s, then the word cap | Breaks where the speaker breaks |
| Minimum | 0.4 s on screen, else merged with the next chunk | Shorter cannot be read |
| Hold | 0.3 s past the last word before a pause | Then the screen is clean in the silence |
| Emphasis | one word per chunk, a number first, else the longest content word (the later one on a tie); a lone word only if it is a number | When everything is big, nothing is |

Override per film: `chunk(words, { maxWords: 4, emphasis: ['code', 'AE'] })`, or `emphasis: false`.

## 3. Captions inside a film

```js
import { chunk, makeCaptions, captions } from '../../../lib/captions.js';
import { VO } from './myfilm.words.js';
import { C, typo } from '../theme.js';

const CAP = makeCaptions(stage, chunk(VO.words), {
  preset: 'pop',                                   // pop | karaoke | line
  base: `${typo('line')}font-weight:900;color:${C.bone}`,   // type + colour from the brand
  accent: C.signal,                                // emphasis / lit-word colour
  emphScale: 1.4,
});
// in render(t):
captions(CAP, t, { hide: cardCoversCaptions(t) });
```

| Preset | Looks like | Use for |
|---|---|---|
| `pop` | words land one by one as spoken, small overshoot; the emphasis word bigger, in the accent | TikTok / Reels talking, hype, ads |
| `karaoke` | the whole chunk up at once, each word lights as it is spoken | music, lyrics, fast speech, gaming |
| `line` | whole chunk fades and rises in, no per-word motion | explainers, calm brand films, documentary |

- **Make the captions late in the build** so they sit on top: create them after
  the scene layers (and above grain, see `film-fx`).
- **Placement:** default box is `SAFE_BOX` (x 90–870, centre y 1380): inside
  the TikTok/Reels clear area, left of the like rail, above the description.
  Check with `node tools/shot.mjs --film <f> --safe-zone`. Move `y` when the
  layout moves: a card in the bottom half needs the captions up top.
- **Collisions:** when a popup, product card or on-screen word takes the
  space, `hide` the captions for that window. One thing at a time beats two fighting.
- **No box behind the text.** Legibility comes from `OUTLINE` (dark text-shadow
  on every side), so the picture stays visible. Pass `outline: false` only on a flat, dark-safe background.
- Kinetic type that already says the line (as in `lab/nocode`) *is* the caption;
  do not double it. Use captions for footage, talking heads and long VO.
- Uppercase by default (`upper: false` for long sentences or Norwegian names where case matters).

## 4. Sidecar files (upload with the video)

```bash
node tools/subs.mjs --words brands/lab/films/nocode.words.js --srt out/nocode.srt --vtt out/nocode.vtt
node tools/subs.mjs --words take.words.json --srt out/take.srt --max-words 4 --no-emph
```

| Format | Where |
|---|---|
| SRT | YouTube, TikTok (Studio), Instagram, LinkedIn, most editors. UTF-8 |
| VTT | Vimeo (recommended there), web `<track>` players |
| ASS | Styled burn-in with ffmpeg/libass; Aegisub for hand fixes |

A sidecar keeps captions searchable, translatable and switchable even when the
video also has burned-in text: upload one whenever the platform takes it.

## 5. Burn in on other footage

```bash
node tools/subs.mjs --words take.words.json --ass out/take.ass --accent "#D7FF3A" --upper --font "Archivo" --size 84
node tools/subs.mjs --words take.words.json --ass out/take.ass --preset karaoke --accent "#D7FF3A"
ffmpeg -i take.mp4 -vf "ass=out/take.ass" -c:a copy take-captioned.mp4
```

- **Needs an ffmpeg built with libass** (`ffmpeg -filters | grep " ass "`).
  Shotcut's bundled ffmpeg, the one this machine uses for exports, has none:
  install a full build (`winget install Gyan.FFmpeg`) for burn-in. The SRT/VTT
  sidecars and the in-film captions need no ffmpeg at all.

- `--res 1920x1080` for landscape, and `--y` for the caption centre in that frame.
- The font must be installed (or passed with `ass=...:fontsdir=brands/lab/assets/fonts`).
- On Windows, ffmpeg's filter parser wants the path escaped: `ass='C\:/path/take.ass'`, or run from the folder.
- `pop` in ASS is static emphasis (bigger + accent); per-word motion needs the
  in-film layer (motionkit) or an editor. `karaoke` uses `\k` and lights per word.

## 6. Translate and localise

- Caption in the language the audience reads. A real translation of what was
  said, not a summary, and timed to the original words.
- Machine translation is a draft: expect to rewrite most chunks, keeping the timing.
- Dubbing the voice instead: `elevenlabs-dubbing`.

## 7. Check before you ship

1. `node tools/shot.mjs --film <f> --safe-zone --sheet 12`: no caption under platform UI, faces or hands.
2. `node tools/strip.mjs --film <f> --from A --to B --fps 30` across a chunk change: no frame with two chunks, no early word.
3. Read the SRT top to bottom against the audio: names (the fix list), numbers, punctuation.
4. Muted watch: does the film still make sense with captions only?

Accessibility depth (SDH, speaker IDs, sound descriptions, WCAG): the
`captions-media-accessibility` skill in `Desktop/test/skills-library/calesthio_generative-media-skills` (MIT).
Caption craft for raw talking-head edits: `i-hate-editing/rules/captions.md`.
