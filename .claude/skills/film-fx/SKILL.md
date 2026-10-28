---
name: film-fx
description: Visual effects for motionkit films, all written as functions of t — film grain, vignette, scanlines, RGB split, flash frames, light leaks, anamorphic lens flare, zoom (radial) blur, directional motion blur, heat-haze and boil warps, shockwave rings, sparks, anime speed lines, glitch slices, echoes, colour grades and duotone, camera shake. Covers which effect sells which moment, how to drive it from cues and speed, how to stack filters, the 3-flashes-a-second safety rule, and the export traps. Use for "add effects", "make it hit harder", "glitch", "grain", "light leak", "flare", "chromatic aberration", "glow", "shake", "VHS", "anime lines", "sparks", "colour grade", or any request to add FX or polish to a motionkit film.
---

# film-fx

Everything lives in `lib/fx.js` (plus `impact()` in `lib/motion.js`,
`cameraBlur()` in `lib/rig.js`, shape wipes in `lib/transitions.js`). Every
effect is set from `t` each frame, seeded where it is random, so preview,
strip and export draw the same frame. See them all in one film:

```bash
node tools/shot.mjs  --film lab/fxlab --scenes          # one frame per effect
node tools/strip.mjs --film lab/fxlab --from 2.4 --to 2.8 --fps 30   # one hit, frame by frame
```

## The effects

| Effect | Call | Sells | Amount that works |
|---|---|---|---|
| Film grain | `makeGrain(stage)` → `grain(G, t, a)` | "shot, not rendered"; hides banding | 0.1–0.2 felt, 0.35 a look |
| Vignette | `makeVignette(layer)` → `opacity(v, a)` | focus to centre, mood | 0.6–0.8; up in slow-mo |
| Scanlines | `makeScanlines(stage)` → `scanlines(S, a, t)` | VHS / CRT / screen-in-screen | 0.25–0.4 |
| RGB split | `rgbSplit(el, px, py)` | a hit on the beat; lens fault | 10–30 px decaying in ~0.12 s; 2–4 px held |
| Flash | `makeFlash(layer, hex?)` → `opacity(f, flashAt(t, hits))` | impact, cut on a drop | peak 0.6–0.85, 0.08–0.12 s |
| Light leak | `makeLeaks(layer, [hot, deep])` → `leaks(L, a, t)` | warm cut, memory, "film" | pulse 0.5 s in, 0.8 s out |
| Lens flare | `makeFlare(layer, {tint})` → `flare(F, a, x, y)` | light source, hero moment | sweep with the camera |
| Zoom blur | `makeZoomBlur(el)` → `zoomBlur(Z, a)` | punch-in, speed toward camera | `a` = 1 − spring progress |
| Motion blur | `dirBlur(el, sx, sy)` | fast sideways moves | `sx = k·|speed(xFn,t)|`, k 0.012–0.02 |
| Echoes | `makeEchoes(el)` → `echoes(list, a, {dx,dy})` | trail behind a word | 3–4 outlines |
| Glitch slices | `makeSlices(el)` → `slices(S, a, t)` | data tear, glitch reveal | 0.2–1 for 2–6 frames |
| Warp | `makeWarp(el, {mode})` → `warp(W, px, t)` | heat haze, dream ('heat'); hand-drawn shudder ('boil') | heat 10–20 px, boil 6–10 |
| Shockwave | `makeRing(layer, hex)` → `ring(el, t, t0, {x,y})` | landing, explosion, a counter ticking | 0.4–0.6 s |
| Sparks | `makeSparks(layer, n, hex)` → `sparks(S, t, t0, {x,y})` | impact, metal, celebration | 20–40, life 0.75 s |
| Speed lines | `makeSpeedLines(layer, hex)` → `speedLines(S, a, t)` | anime focus, sudden attention | decay over ~0.9 s |
| Grade | `makeGrade(id, GRADES.x)` → in `filter` | a look across footage | `tealOrange`, `bleach`, `warm`, `cold` |
| Duotone | `makeDuotone(id, dark, light)` → in `filter` | brand-coloured footage, posters | dark + light brand tokens |
| Shake | `impact(t, t0, {amp})` from `lib/motion.js` | camera hit | 18–30 px, decay 7 |
| Camera blur | `cameraBlur(world, cam, t)` from `lib/rig.js` | whip pans | automatic from camera speed |

Colours are always brand hex tokens from `theme.js` (`C.ember`), never raw
values: `npm run lint` fails otherwise. `lib/fx.js` itself names no colour.

## Drive effects from cues, not timers

The hit list is the film's cue table (`films/<film>.cues.js`), the same times
the sound effects are synthesised on. One list → RGB split, flash, shake,
ring, sparks and the thump all land on the same frame.

```js
const HITS = [CUE.drop, CUE.kill1, CUE.kill2];
const hit = Math.max(...HITS.map((h) => (t >= h ? Math.exp(-(t - h) / 0.12) : 0)));   // 1 on the frame, decays
rgbSplit(word, 26 * hit, 3 * hit);
opacity(flash, flashAt(t, HITS, { len: 0.1, peak: 0.8 }));
xform(world, { x: impact(t, CUE.drop, { amp: 24 }) });
```

- **Decay, don't toggle.** `exp(-(t - hit) / τ)` with τ 0.08–0.15 s. On/off reads as a bug.
- **Blur from speed.** `dirBlur(el, 0.015 * Math.abs(speed(xFn, t)))`: blur only while it moves.
- **Picture a frame before the sound** (`LEAD = 1/30` in nocode.cues.js): the eye reads a cut faster than the ear reads a consonant.
- **Quantise the random** to a frame rate (`Math.floor(t * 24)`): 24 Hz grain and glitch read as film; per-frame at 60 fps reads as noise.

## Taste

- **One hero effect per moment.** Split + flash + shake + sparks all at once is
  the climax, used once. The rest of the film earns it by being quieter.
- **The finish runs all the time, very low:** grain 0.12, vignette 0.7. Nobody
  notices them until they are gone.
- **Leaks and flares belong to cuts and light sources**, not random frames.
- **Match the register.** Brand / calm: grain, vignette, leaks, `line` captions.
  Gaming / hype: split, flash, shake, slices, speed lines, sparks. Retro: scanlines, warp boil, `bleach`.
- If the effect is the first thing a viewer would describe, it is too strong.

## Stacking and order

- **One `filter` per element.** `dirBlur`, `rgbSplit`, `warp` and a grade all
  write `filter`. Nest to stack: blur on the wrapper, split on the child.
- **Order of layers, bottom → top:** scene layers → leaks / flare (screen) → vignette → grain → scanlines → captions → flash.
- Grain is one layer over the whole `stage`, not one per scene.

## Safety: max 3 flashes a second

WCAG 2.3.1 (photosensitive epilepsy). Check the flash list at load so the film
refuses to build instead of shipping a strobe:

```js
const bad = flashCheck(FLASH_TIMES);           // [] when safe
if (bad.length) throw new Error(`too many flashes: ${JSON.stringify(bad)}`);
```

Count every full-frame flash, white/colour pop and hard dark→bright cut. A beat
drop at 160 BPM cut on every beat is already 2.7 a second: flash on the bar, not the beat.

## Export traps (found the slow way)

- **A fine pattern under a blended layer stalls the export.** Scanlines (or any
  tiled overlay) *below* the grain's `mix-blend-mode: overlay` took minutes per
  frame in the exporter's software Chromium. Make scanlines after `makeGrain()`.
- **Repeating gradients with px stops over the full frame are slow**; use a tiled canvas image (as `makeGrain` / `makeScanlines` do).
- `feTurbulence` warps are fine on a word, heavy on the full frame: warp the element, not the stage.
- `backdrop-filter` is banned by the lint (very expensive under the scaled stage).
- After adding an effect, time one capture: `node tools/shot.mjs --film <f> --at <t>` should take seconds, not minutes.

## Not here (yet)

- **Shader transitions** (gl-transitions style: morph, ripple, cube). They need
  both scenes as textures; motionkit scenes are DOM. Possible for footage films
  (`data-gl` on `<html>` turns on GL in the exporter, see `lab/ace`). Check each
  transition's own licence before copying one in.
- **Pixelate / mosaic** on DOM: no cheap per-frame method; do it in ffmpeg after export.
- Grading footage properly (shot matching, skin): `color-grading-finishing`.
- Title and caption design: `kinetic-typography`, `subtitles`.
