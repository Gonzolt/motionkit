---
name: frag-edit
description: Gaming "edits" in the TikTok style (Valorant and other FPS montages cut to a song with vocals) made with motionkit — the lyric as the text track one word at a time, words that build by syllable with a script accent, text sitting behind the gun or knife, a marker scribble that swaps one word for the next, a social-post or phone card that holds the next shot and swallows the frame, a repetition burst of the same move from many rounds, coloured ink creeping from the frame edges on kills, syllables under the crosshair, monochrome intros that go to colour on the drop. Also taking reference edits apart into numbers with tools/refscan.py (tempo, cut rate, burst spacing, flash rate, B&W runs, contact sheets). Use for "make a Valorant edit", "edit like these TikToks", "lyric edit", "frag movie", "velocity edit", "text behind the gun", "analyse these reference clips", or any gaming montage in this repo.
---

# frag-edit

A frag edit is a 20–50 s gaming montage carried by a song with vocals. The
lyric is the only text, one word at a time; kills, cuts and effects sit on the
song's grid; every section changes with one big transition. This skill is
built from six reference edits measured frame by frame:
[references/reference-breakdown.md](references/reference-breakdown.md).

Code: `lib/frag.js` (what the references do that `lib/fx.js` did not have),
`tools/refscan.py` (reference analysis), catalogue film `lab/fraglab`:

```bash
node tools/shot.mjs  --film lab/fraglab --scenes --width 1920 --height 1080
python tools/refscan.py refs/*.mov --strip 12.0        # sheet.png, strip-12.0.png, scan.json per clip
```

## Start from the references, as numbers

Before planning, scan whatever the user calls "like these":

```bash
python tools/refscan.py a.mov b.mov --out out/refscan --strip 4.2 --lyrics
```

Read each `sheet.png` (1 tile = 1 s) for the look, then copy these into the
plan: frame size, edit length (`content_end`, the platform end card is cut
off), BPM, `burst_gap_beats`, `cut_phase` (piled into one or two bins = cut on
the grid), `flash_rate_max`, `mono_runs`. Open a strip (`--strip t`) at every
transition you want to copy; a 1 fps sheet cannot show one.

What the six references share (details and per-edit notes in the breakdown):

| Trait | Measured |
|---|---|
| Format | all 16:9 (854x480 downloads), 30 fps; posted landscape |
| Length | 20–53 s of edit, median about 33 s |
| Tempo | 79–154 BPM (half/double is ambiguous) |
| Cut rate | 0.6–1.7 cuts/s; median shot 0.3–0.5 s, one at 1.1 s |
| Bursts | quick cuts every 0.5 or 1.0 beat; one burst of 3-frame shots |
| Monochrome | 5 of 6 open B&W or near-B&W and go to colour on the drop |
| Text | the lyric, one word at a time, centred, condensed, heavy, glowing |
| Signature | each edit repeats ONE gimmick of its own (see the table below) |
| Flashes | 2–25 per edit; one breaks the 3-per-second rule. We do not |

## Anatomy

| Section | Length | What happens | Out of it |
|---|---|---|---|
| Cold open | 0.5–1 s | B&W or black, a streak, an anime/manga frame, or one word | hard cut |
| Build | 4–20 s | slower: skin inspect, held kills, lyric words, monochrome or soft grade | **one** big transition: white burst, zoom/speed tunnel, portal, card portal |
| Drop | 8–20 s | colour on, kills on beats, edge ink, shake, word hits | whip-blur cuts |
| Burst | 2–5 s | beat-rate cuts, or the same move from many rounds at 3 frames each | hard cut |
| Outro | 1–3 s | last word, desaturate, black hold, ends on a beat | end |

Put section changes on bar lines; the song's own structure (verse → drop)
decides where. A kill needs at least 0.4 s of fight before it to read.

## Techniques → calls

| Technique | In ref | Call |
|---|---|---|
| Lyric word, one at a time, lands with a spring, hot colour then white, glow | R3, R4, R5 | `wordAt(words, t)` → `lyric(makeLyric(...), t, cue, {base, hot, glow})` |
| Ghost copy blows up and fades behind each new word | R5 | `lyric` (on by default, `ghost: false` to drop) |
| Word builds by syllable (RE → REA → READY) | R4 | `grow(['REA', 'DY'], [t0, t1], t)` as the cue's text |
| Small script word hung off the big one ("for?") | R4 | `makeLyric({accentStyle})`, `accent` on the word or the cue |
| Text behind the gun / knife / agent | R4 | shot, word, shot copy clipped: `clipTo(copy, polyAt(KEYS, t))` |
| Marker scribble strikes a word and becomes the next word | R6 | `makeScribble` → `scribble(S, p, box, {out})`, swap the text at p = 1 |
| White type page interlude | R6 | a layer in the brand's light token, `typo()` words, scribbles |
| Post / phone card holding the next shot, heart pop, swallows the frame | R3, R6 | `makeCard(...)`, next shot into `K.screen`, `card(K, t, t0, t1, {...})` returns portal 0…1 |
| Collage page around a card (giant type behind, photos, @handle) | R6 | `makeCard` + `typo('giant')` + `makePhoto` (`lib/promo.js`) |
| Same move from many rounds, 3 frames each | R4 | `stutter(moments, {t0, each})` → `segAt(segs, t).src` picks the frame |
| Ink creeping in from the edges on a kill | R5, R1 | `makeEdgeInk(layer, C.x, {W, H})` → `edgeInk(I, Math.exp(-(t - kill) / 0.35), t)` |
| One syllable under the crosshair per kill | R1 | `wordAt(KILLS.map(...))` into a small `makeLyric` at y = centre + 70 |
| Foreign lyric big, translation small in a box | R1 | `makeLyric` + a boxed `h('span')` under it; `subtitles` for full lines |
| Same word stacked 2–3 times, different sizes | R1 | two or three `makeLyric`s on the same cue, or `makeEchoes` (`fx.js`) |
| B&W intro → colour on the drop | R2, R4–R6 | `track([[t0, 1], [DROP, 1, E.out, 'hold'], [DROP + 0.01, 0]])` → `grayscale()` |
| Zoom / speed-line tunnel into the drop | R1, R3 | `makeSpeedLines` + `makeZoomBlur` (`film-fx`) |
| Cuts hidden in whip blur | all | `dirBlur` / `cameraBlur` on the outgoing and incoming shot |
| RGB split and motion blur on a word | R4 | `rgbSplit(L.word, px)`, `dirBlur(L.box, sx)` (`film-fx`) |
| Grade drifting through a section (pink in the burst) | R4 | `makeGrade` / `hue-rotate()` driven by a `track` |

Pick ONE row from the signature group (syllable build, text behind the gun,
scribble page, card portal, repetition burst, crosshair syllables) and repeat
it; that is what makes an edit recognisable. The shared grammar (lyric words,
monochrome intro, whip cuts, edge ink) goes under it.

## Workflow

1. **Scan the references** (above). Write down format, length, BPM, burst
   spacing, the text style and the one signature.
2. **Song → words.** `python tools/transcribe.py song.mp3 --lang en` gives
   `{w, s, e}` words. Sung timing is rough: in R4 whisper put a word four
   seconds early. Snap each word you will show to its onset or the nearest
   eighth, then check with a strip. Keep only the words you will show; split
   the syllable-build words into `parts` with times. Save as
   `films/<film>.words.js`.
3. **Beat grid and kills.** Beat grid from the song (refscan prints BPM; a
   tap or onset fit beats it); kill frames from the footage at native fps (the
   kill banner appears on the kill frame). Place every kill one frame before
   its beat's transient. Put grid, drop, kills and words in
   `films/<film>.cues.js`; nothing in the film is a typed number of seconds.
4. **Footage.** One JPEG per source frame per clip and a time map, as in
   `lab/ace`: film time → clip time through `speedRamp` / `hitStop` /
   Hermite segments, so slow-mo, freezes and bursts stay pure functions of t.
   A burst is `segAt(stutter(...), t)` choosing clip and source time.
5. **Picture.** Sections from the scene table, effects from cues
   (`film-fx`: "Drive from cues, not timers"). Type from the brand's theme:
   one condensed heavy face, one accent style.
6. **Check.** `tools/shot.mjs --scenes`, strips across every hit and every
   transition, `flashCheck` at load. Then export and run
   `tools/refscan.py` on your own export: the cut rate, burst spacing and
   mono runs should sit inside the references' range.
7. **Export landscape** if the references are: `--width 1920 --height 1080`
   on shot, strip and export, and `runFilm({frameW: 1920, frameH: 1080})`.
   For a vertical version keep the crosshair centred and the word in the
   middle third (`SAFE` in `lib/promo.js`).

## Recipes

**Lyric track with a syllable build and an accent** (fraglab scene 1):

```js
const L = makeLyric(layer, { x: W / 2, y: H / 2, style: BIG, accentStyle: ACCENT });
// in render(t):
const w = wordAt(WORDS, t, { hold: 0.35, lead: 1 / 30 });
const r = grow(['REA', 'DY'], READY_T, t);
const cue = w ?? (r ? { text: r, t0: READY_T[0], accent: t >= FOR_T ? 'for?' : null } : null);
lyric(L, t, cue, { base: C.bone, hot: C.signal, glow: alpha(C.bone, 0.55) });
```

**Text behind the gun** (scene 2). The viewmodel stays in its corner, so key
its outline every 0.1–0.2 s (more on fast swings) and let `polyAt` fill in:

```js
// makeShot = whatever builds your footage element (fraglab has a stand-in), called twice
const under = makeShot(layer); const L = makeLyric(layer, {...}); const over = makeShot(layer);
// render: both shots show the same frame; the copy shows only the gun
clipTo(over.el, polyAt(GUN_KEYS, t));     // GUN_KEYS: [[t, [[x%, y%], …]], …], same point count
```

**Kill hit**, the frag version of film-fx's recipe: `hitStop` 0.06–0.1 s on
the kill frame, `edgeInk` decaying with τ 0.35 s, `shake` amp 10–16 px at
1080p, the next crosshair syllable or the next lyric word, and `speedRamp`
out at 1.3–1.6×. Ring and flash only on the drop and the last kill.

**Card portal** (scene 4): pop in 0.8–1.0 s before the cut, `like` 0.4 s
later, `out` exactly on the beat that starts the next section; when `card()`
returns 1, the full-frame shot under it must be the shot that was inside.

**Repetition burst** (scene 5): 8–15 rounds of the same move, `each` = 3
frames (0.1 s) for a strobe or half a beat for a rhythm, `pre` so the move
lands at the same point in every shot. Pick rounds with similar brightness:
dark/bright alternation at that rate is a strobe and fails `flashCheck`.

**Drop**: monochrome → colour on the drop frame, one flash (peak 0.6, 0.1 s),
speed lines decaying over the first beat, edge ink on the first kill.

## Taste

- **The lyric is the text.** One word at a time, centred. No kill counter,
  clip names or captions on top of it, unless the edit has no vocal.
- **Three levels, same plan**: *clean* (kills, drop, transitions; no words),
  *lyric* (one word per shown sung word), *full* (plus the signature). Start
  at lyric; go full only if the user asks for "more".
- **One big transition per section**; inside sections, hard cuts or whip blur.
- **One accent type style per edit** (script, serif-in-a-box or marker).
- **Hot colour lasts 2–3 frames**, then the base colour. Longer reads as a
  different word.
- **Effects decay** (film-fx). Edge ink on and off reads as a glitch.
- If the user has said they dislike flashes, strobes or "too much text",
  that beats the references: drop flashes entirely, run the clean level.

## Safety and rights

- **Max 3 flashes a second**, counted across full-frame flashes, colour pops,
  strobing bursts and dark → bright hard cuts. R1 hits 4/s; do not copy it.
- **Songs, anime and manga frames belong to someone.** On TikTok the app's
  licensed library covers a song added there; an exported mp4 with the song
  baked in is not licensed anywhere else. Use the user's own or licensed art
  for inserts, and say so when an insert is a placeholder.
- Don't copy a creator's watermark, handle or collage layout one to one: take
  the technique, not the page.

## Limits in a DOM film

- Rotoscoping a moving agent or a spinning knife is a polygon you key by hand;
  there is no matte tool here. Where that is too much, put the word above the
  subject and lower its opacity, or move it.
- Smooth slow-mo needs high-fps source (60–120 fps); no optical flow.
- Shader transitions (morph, ripple) need `data-gl` (see `lab/ace`).
- refscan's cuts and beats are approximate (thumbnail histograms, flux
  autocorrelation): read them as shapes and confirm a moment in a strip.

## Which skill next

| Job | Skill |
|---|---|
| Glow, split, shake, hit-stop, speed ramps, speed lines, flash rule | `film-fx` |
| Bigger type moves, lyric-video craft | `kinetic-typography` |
| Cutting to the beat, J/L cuts, ramps | `beat-sync-editing` |
| Structure of the whole piece | `editing-montage` |
| The first 2–3 seconds | `hook-lab` |
| Translations, full-line captions | `subtitles` |
| Grading footage, matching rounds | `color-grading-finishing` |
| Picking and cutting the song | `music-supervision-scoring` |
| Kill and whoosh sounds | `sound-design-foley` |
