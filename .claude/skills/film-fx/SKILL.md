---
name: film-fx
description: Visual effects for motionkit films, all written as functions of t — film grain, vignette, scanlines, halftone, RGB split, flash frames, light leaks, anamorphic lens flare, glow and neon flicker, zoom (radial) blur, directional motion blur, afterimage trails, block glitch and slice glitch, heat-haze and boil warps, gooey metaballs, shockwave rings, sparks, dust and bokeh, anime speed lines, shine sweeps, spotlight and iris, letterbox bars, colour grades and duotone, camera shake, beat pulses, hit-stop and speed ramps. Covers which effect sells which moment, ready recipes (beat drop, kill hit, product reveal, retro, cinematic), how to drive effects from cues, stacking, the 3-flashes-a-second rule and the export traps. Use for "add effects", "make it hit harder", "glitch", "grain", "light leak", "flare", "glow", "neon", "chromatic aberration", "shake", "freeze frame", "slow motion", "VHS", "comic", "anime lines", "sparks", "shine", "colour grade", or any request for FX or polish on a motionkit film.
---

# film-fx

Everything lives in `lib/fx.js` (plus `impact()`/`drift()` in `lib/motion.js`,
`cameraBlur()` in `lib/rig.js`, shape wipes in `lib/transitions.js`). Every
effect is set from `t`, seeded where it is random, so preview, strip and export
draw the same frame. The catalogue film runs every one of them:

```bash
node tools/shot.mjs  --film lab/fxlab --scenes                         # one frame per effect
node tools/strip.mjs --film lab/fxlab --from 17.2 --to 17.7 --fps 30   # one beat hit, frame by frame
```

Full parameters, defaults, costs and pitfalls per effect:
[references/effects.md](references/effects.md). Read it before tuning one.

## Two kinds of thing

**Drivers** say *how much*, as pure functions of `t` (no DOM, node-testable).
**Effects** draw. A driver's 0…1 goes into an effect's `amount`.

| Driver | Returns | Use |
|---|---|---|
| `Math.exp(-(t - hit) / τ)` | 1 → 0 after a hit | the default hit envelope, τ 0.08–0.15 s |
| `beatPulse(t, bpm, {offset, every, decay})` | 1 on every beat, decaying | pump anything to the music's grid |
| `flashAt(t, hits, {len, peak})` | flash opacity | white or colour pops on hits |
| `flicker(t, {seed, rate, depth})` | 0…1 brightness | neon tubes, failing bulbs, horror |
| `shake(t, hits, {amp, rot, decay})` | `{x, y, rot}` | camera hits; several hits sum |
| `hitStop(t, [[at, hold]])` | source time | freeze on impact (fighting-game feel) |
| `speedRamp(t, [[t, speed]])` | source time | slow-mo into a hit, rush out |
| `pulse(t, a, b, in, out)` (motion.js) | 0→1→0 | leaks, flares, sweeps |
| `0.015 * Math.abs(speed(xFn, t))` | px of blur | motion blur from real speed |

## The effects

| Group | Effect | Call | Sells |
|---|---|---|---|
| Finish | grain | `makeGrain(stage)` → `grain(G, t, a)` | "shot, not rendered"; kills banding |
| | vignette | `makeVignette(layer)` → `opacity(v, a)` | focus, mood |
| | scanlines | `makeScanlines(stage)` → `scanlines(S, a, t)` | VHS, CRT, screen-in-screen |
| | halftone | `makeHalftone(stage)` → `halftone(H, a)` | print, comic, pop art |
| | grade / duotone | `makeGrade(id, GRADES.x)`, `makeDuotone(id, dark, light)` → in `filter` | a look across footage |
| Light | leaks | `makeLeaks(layer, [hot, deep])` → `leaks(L, a, t)` | warm film cut, memory |
| | flare | `makeFlare(layer, {tint})` → `flare(F, a, x, y)` | light source, hero moment |
| | glow | `glow(el, px, hex)` (× `flicker(t)` for neon) | neon, energy, UI highlight |
| | shine | `makeShine(el, {kind})` → `shine(s, p)` | product reveal, "new", premium |
| | spotlight / iris | `makeSpotlight(layer)` → `spotlight(S, x, y, r)` | focus a subject, iris out |
| Motion | dirBlur | `dirBlur(el, sx, sy)` | fast sideways moves |
| | zoom blur | `makeZoomBlur(el)` → `zoomBlur(Z, a)` | punch-in toward camera |
| | trail | `makeTrail(el)` → `trail(T, t, pose)` | speed, ghosts, dance, sport |
| | echoes | `makeEchoes(el)` → `echoes(list, a, {dx, dy})` | outlined trail behind a word |
| | shake | `shake()` driver on a world wrapper | impact |
| Glitch | RGB split | `rgbSplit(el, px, py)` | hit on a beat; lens fault |
| | slices | `makeSlices(el)` → `slices(S, a, t)` | horizontal tear, glitch reveal |
| | block glitch | `makeBlockGlitch(el)` → `blockGlitch(B, a, t)` | compression error, datamosh look |
| | warp | `makeWarp(el, {mode})` → `warp(W, px, t)` | heat haze ('heat'), line boil ('boil') |
| Impact | flash | `makeFlash(layer, hex?)` → `opacity(f, flashAt(...))` | impact, drop |
| | ring | `makeRing(layer, hex)` → `ring(el, t, t0, {x, y})` | landing, explosion |
| | sparks | `makeSparks(layer, n, hex)` → `sparks(S, t, t0, {x, y})` | metal, celebration |
| | speed lines | `makeSpeedLines(layer, hex)` → `speedLines(S, a, t)` | anime focus, sudden attention |
| Space | dust / bokeh | `makeDust(layer, n, hex, {size, blur})` → `dust(D, t, a)` | air, depth, calm, night |
| | goo | `makeGoo(id)` → `filter` on a container of blobs | liquid, organic, blob transitions |
| | letterbox | `makeLetterbox(layer)` → `letterbox(L, p, {ratio})` | "the cinematic bit" |

Colours are always brand hex tokens from `theme.js` (`C.ember`), never raw
values: `npm run lint` fails otherwise. `lib/fx.js` names no colour.

## Recipes

Each is a starting point; the numbers are the ones that read on a phone.

**Beat drop** (music-led, every other beat after the drop):
```js
const bp = beatPulse(t, BPM, { offset: DROP, every: 2, decay: 0.1 });
const sh = shake(t, BEATS_AFTER_DROP, { amp: 26, rot: 1.5 });
xform(world, { x: sh.x, y: sh.y, rot: sh.rot, s: 1 + 0.04 * bp });
rgbSplit(title, 22 * bp, 2 * bp);
blockGlitch(bg, 0.8 * bp, t);
opacity(flash, flashAt(t, [DROP], { len: 0.1, peak: 0.85 }));   // one flash, on the drop only
```

**Kill / hit in a gaming edit**: hit-stop 0.08–0.12 s on the frame of the
hit, flash 0.6 for 0.08 s, ring + 20–30 sparks from the hit point, shake amp
30, speed lines decaying over 0.9 s, then `speedRamp` out at 1.5–2×.
`lab/fxlab` scenes `hit` and `trail` are this recipe split in two.

**Product reveal**: spotlight opens from r 120 to 450 over 1 s (`E.out`),
dust at 0.9 drifting through the beam, the card lands with a spring, `shine`
sweeps the card (0.8 s, `E.inOut`) then the headline 0.7 s later, a soft glow
(px 20) on the price. No glitch, no flash.

**Brand / calm**: grain 0.12, vignette 0.7, one leak pulse per cut, bokeh at
0.4 with `rise: 14`, `line` captions. Nothing that shakes.

**Retro / VHS**: `GRADES.bleach` + `saturate(0.7)`, scanlines 0.35, slices
0.2 on every cut for 3 frames, `rgbSplit` held at 3 px, warp 'boil' 6 px on
titles at 12 Hz.

**Comic / pop**: halftone 0.4, speed lines on every entrance, words land with
`spring` bounce 0.5 and a -8° tilt, ring on each impact, duotone on photos.

**Cinematic**: letterbox to 2.39 (landscape) or 1.0 (vertical, shows as a
square window), `GRADES.tealOrange`, flare sweeping with the camera, grain
0.15, iris out (spotlight r → 0) at the end.

## Taste

- **One hero effect per moment.** Everything at once is the climax, used once.
- **The finish runs all the time, very low** (grain 0.12, vignette 0.7). Nobody notices it until it is gone.
- **Decay, don't toggle.** On/off reads as a bug; an exponential tail reads as physics.
- **Effects follow causes**: leaks and flares at cuts and light sources, blur from speed, shake from hits, glitch from beats. An effect with no cause is noise.
- **Match the register** (calm brand vs hype gaming vs retro). Mixing registers is the commonest way to look amateur.
- If the effect is the first thing a viewer would describe, it is too strong.

## Drive from cues, not timers

The hit list comes from the film's cue table (`films/<film>.cues.js`), the
same times `make_sfx.py` synthesises sound on. One list → split, flash,
shake, ring, sparks and the thump land on the same frame. Picture leads sound
by one frame (`LEAD = 1/30`). Quantise random effects to 24 Hz (`Math.floor(t * 24)`).

For footage, time-remap drivers compose: `pose(speedRamp(hitStop(t, stops), keys))`.
The scene table stays in output time; only the poses read source time.

## Stacking and order

- **One `filter` per element.** `dirBlur`, `rgbSplit`, `warp`, `glow`, a grade
  all write `filter`. Nest to stack: blur on the wrapper, split on the child.
- **Layer order, bottom → top:** scene → dust/bokeh → subject → leaks/flare →
  spotlight → vignette → grain → scanlines/halftone → captions → letterbox → flash.
- Grain, scanlines and halftone are one layer each over the whole `stage`.
- `trail()` places its element: do not also `xform()` it.

## Safety: max 3 flashes a second

WCAG 2.3.1 (photosensitive epilepsy). Assert the flash list at load:

```js
const bad = flashCheck(FLASH_TIMES);
if (bad.length) throw new Error(`too many flashes: ${JSON.stringify(bad)}`);
```

Count every full-frame flash, colour pop, strobe and hard dark→bright cut. At
128 BPM a flash per beat is 2.1/s, per eighth 4.3/s: flash on the bar, pulse
(not flash) on the beat. `flicker()` on a small word is fine; on the whole frame it counts.

## Export traps (found the slow way)

The exporter renders in Chromium with the GPU off. Things that are free on
your screen can take minutes per frame there:

1. **A fine pattern under or inside a blended/translucent layer** (scanlines
   under grain; halftone with multiply at opacity 0.4) stalled capture
   completely. Patterns go *after* `makeGrain()`, carry their strength in the
   tile's alpha, and never use `mix-blend-mode` or layer opacity.
2. Full-frame repeating gradients with px stops: use a tiled canvas instead.
3. `feTurbulence` warps on a word are fine, on the full frame heavy.
4. Rotated oversized overlays: draw the angle into the tile.
5. `backdrop-filter` is banned by the lint.

**After adding any effect, time one frame of it:**
`node tools/shot.mjs --film <f> --at <t>` must take seconds. If it sits, hide
layers one by one in the browser pane (`window.PK.frame(t)` then set
`display:none`) to find the culprit.

## Not here

- Shader transitions (morph, ripple, cube): they need both scenes as textures;
  scenes are DOM. Possible on footage films that set `data-gl` on `<html>`.
  Check each transition's licence before copying one in.
- Pixelate / mosaic on DOM: do it in ffmpeg after export.
- Grading footage properly: `color-grading-finishing`. Type reveals:
  `kinetic-typography`. Captions: `subtitles`. Sound for every hit: `sound-design-foley`.
