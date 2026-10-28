# lib/fx.js reference

Every effect: what it is, the call, every parameter with its default, values
that work, what it costs in the exporter (software Chromium, GPU off), and the
mistakes that show. `make*` builds DOM once (outside `render`); the lower-case
call sets it from `t` every frame and does nothing when the value is unchanged.

Cost key: **free** (a transform or opacity), **cheap** (a gradient or tiled
image), **filter** (an SVG/CSS filter on the element's area: fine on a word,
think twice full-frame), **heavy** (full-frame filter or many filtered nodes).

---

## Drivers (pure, no DOM)

### `beatPulse(t, bpm, { offset = 0, decay = 0.12, every = 1 })`
1 on each beat, `exp(-s/decay)` after it. `offset` is the first downbeat in
film time (from the music grid / `beat-sync-editing`), nothing before it.
`every: 2` every other beat, `0.5` eighths, `4` the bar. `decay` 0.08 punchy,
0.2 soft pump. Multiply into scale (0.03–0.1), split (15–25 px), glitch amount.

### `flicker(t, { seed = 1, hz = 24, rate = 0.08, depth = 0.75, hum = 0.06 })`
Brightness 0…1. Mostly `1 - hum·noise`, with dropouts to `1 - depth·(0.6…1)`
on `rate` of frames and occasional double blinks. `rate` 0.05 tired tube, 0.14
dying, 0.25+ horror. Different `seed` per sign so two tubes never blink together.

### `shake(t, hits, { amp = 24, rot = 1.2, decay = 7, freq = 14, seed = 1 })`
`{ x, y, rot }` summed over every hit within `6/decay` s. Each axis is
`impact()` with its own seed, y at 0.75·amp, rotation in degrees. Apply to a
world wrapper, not the subject (`xform(world, { x, y, rot })`). Overscale the
world ~3% (`s: 1.03`) when the background is a full-frame plate, or edges show.
amp 12 nudge, 24 hit, 40 explosion; decay 5 rumbly, 10 tight.

### `hitStop(t, [[at, hold], …])` → source time
Freezes the source for `hold` s at each `at`. The output runs longer by the
holds. Use 0.06–0.12 s per hit; longer reads as a pause, not a hit. Combine
with a flash on `at` and a shake starting at `at + hold`.

### `speedRamp(t, [[t, speed], …])` → source time
Speed is linear between keys and held outside; the result is the exact
integral, so there is never a jump. Ramp into the hit (`1 → 0.25` over 0.4 s),
hold slow 0.3–0.6 s, ramp out (`0.25 → 1.5–2`). For footage, map source time
to a frame number; for code motion, feed it to the pose functions.
Compose: `speedRamp(hitStop(t, stops), keys)`.

### `flashAt(t, hits, { len = 0.12, peak = 1 })` / `flashCheck(times, { max = 3, window = 1 })`
`flashAt` is `peak·(1 - age/len)²` for the newest hit inside `len`. `flashCheck`
returns every window with more than `max` flashes per `window` s; assert it
empty at load.

---

## Finish

### Grain: `makeGrain(parent, { tiles = 4, size = 256, seed = 101, blend = 'overlay' })` → `grain(G, t, amount, { hz = 24 })`
Seeded gaussian-ish noise tiles, one picked and offset per frame at `hz`.
Overlay leaves pure black/white alone. 0.1–0.15 always on, 0.2–0.35 as a look.
`hz` 24 film, 12 cheap video, 8 stop-motion. **cheap**. Put it on `stage`, once.
**Make it before scanlines and halftone** (export trap).

### Vignette: `makeVignette(parent, { at = 'ellipse 80% 62% at 50% 50%', from = 50, dark = 0.85 })`
Radial darkening; drive with `opacity()`. 0.6–0.8 at rest, up to 1 in slow
motion. Move `at` to sit over the subject. **cheap**.

### Scanlines: `makeScanlines(parent, { gap = 4, levels = 8 })` → `scanlines(S, amount, t, { roll = 40 })`
Lines baked into tiles at eight alpha levels; the layer is only on or off.
`roll` px/s of drift. 0.25–0.4. **cheap**, if created after the grain.

### Halftone: `makeHalftone(parent, { size = 14, dot = 0.42, levels = 8 })` → `halftone(H, amount)`
45° dot screen drawn into the tile (no rotated layer, no blend). `size` dot
pitch px, `dot` radius as a fraction of it. 0.3–0.5. **cheap**, after the grain.

### Grades: `makeGrade(id, { r, g, b })` with `GRADES.tealOrange | bleach | warm | cold`
Per-channel tone curves (feComponentTransfer tables, shadows → highlights).
Returns `url(#id)` for `filter`; chain `contrast()`/`saturate()` after it.
Register once per look, use on many elements. **filter** (on footage-size images: fine).
`bleach` wants `saturate(0.6)`; `tealOrange` likes `saturate(1.2–1.35)`.

### Duotone: `makeDuotone(id, dark, light)`
Luminance → a two-colour ramp of brand tokens. Posters, photos in a brand
palette, "flashback". **filter**.

---

## Light

### Leaks: `makeLeaks(parent, [hot, deep], { W, H })` → `leaks(L, amount, t, { seed = 3 })`
Two big radial blobs in `screen` blend drifting on noise. Pulse it around a
cut: `pulse(t, cut - 0.1, cut + 0.7, 0.12, 0.5)`. hot = a light warm token, deep
= a saturated one. **cheap** (two gradients).

### Flare: `makeFlare(parent, { tint, ghost = tint, W, H })` → `flare(F, amount, x, y)`
Anamorphic streak + hotspot + three ghosts on the line through the frame
centre (they move opposite to the source, as real ghosts do). Put the source
where the light is; move it with the camera. **cheap** (one blurred streak).

### Glow: `glow(el, px, colour, { strength = 0.9 })`
Two stacked `drop-shadow`s (0.4·px and px) in a brand colour; `px < 0.5` off.
Neon: `glow(el, 34 * flicker(t), C.x)` and `opacity(el, 0.35 + 0.65 * flicker)`.
UI highlight 12–20, neon 30–40. **filter**: one per element (wrap to combine).

### Shine: `makeShine(el, { kind = 'text', angle = 110, width = 12, strength = 0.85 })` → `shine(s, p)`
A white band clipped to the glyphs (`text`: a background-clipped clone) or to
a card (`box`: a screen-blended child; the card needs `position:relative;
overflow:hidden`). `p` 0→1 over 0.5–0.9 s with `E.inOut`. `width` is % of the
band; 8 crisp, 16 soft. **cheap**.

### Spotlight: `makeSpotlight(parent, { dark = 0.9, soft = 90 })` → `spotlight(S, x, y, r, amount = 1)`
Darkness with a soft hole of radius `r` (px) at (x, y). `r ≤ 1` is solid dark:
the iris out. `soft` px of feather. Follow a subject with its own pose. **cheap**.

---

## Motion

### Directional blur: `dirBlur(el, sx, sy = 0)`
One-axis gaussian (SVG) in px std-dev; below 0.4 it switches off. Derive
from speed: `sx = k·|speed(xFn, t)|`, k ≈ 0.012–0.02. **filter**.

### Zoom blur: `makeZoomBlur(el, n = 6)` → `zoomBlur(Z, amount, { reach = 0.35, ox = 50, oy = 50, fade = 0.32 })`
n faint copies scaled out from the origin (%). Scale the stack wrapper
(`el.parentNode`) for the punch so copies follow. `amount` = 1 − spring
progress. **cheap** (copies), n 6–8.

### Trail: `makeTrail(el, n = 5)` → `trail(T, t, pose, { dt = 1/30, fade = 0.5 })`
Copy i is drawn at `pose(t - (i+1)·dt)`; `pose` returns `{ x, y, s, rot }`.
Exact on every frame and invisible at rest (copies sit under the original).
dt 1/60 tight streak, 1/20 distinct ghosts; n 5–8. `trail()` sets the
element's own transform. **cheap**.

### Echoes: `makeEchoes(el, n = 3, { stroke = 3 })` → `echoes(list, amount, { dx, dy, fade = 0.55, scale, sx, sy })`
Outlined (stroke-only) clones fanned along (dx, dy)·amount. For type. **cheap**.

---

## Glitch

### RGB split: `rgbSplit(el, px, py = 0)`
Red shifted −(px, py), blue +(px, py). 10–30 px decaying in ~0.12 s on hits,
2–4 px held for a lens look. Below 0.6 px off. **filter**.

### Slices: `makeSlices(el, n = 9)` → `slices(S, amount, t, { reach = 140, seed = 5, hz = 24 })`
Horizontal strips displaced by noise; the original is hidden while on.
Glitch reveal: amount 1 → 0 over 0.2 s. **cheap**.

### Block glitch: `makeBlockGlitch(el, n = 8)` → `blockGlitch(B, amount, t, { hz = 24, seed = 11, reach = 90, hue = 150 })`
Random rectangles of the element torn sideways, re-rolled every frame; each
block shows with probability `amount`; every third is hue-rotated by `hue`°
(0 for none). The original stays. Drive with `beatPulse`. **cheap** (clip-path).

### Warp: `makeWarp(el, { freq = 0.012, octaves = 2, mode = 'heat' })` → `warp(W, amount, t, { hz = 12, seed = 1 })`
feTurbulence → feDisplacementMap by `amount` px (off below 0.3). `heat`
drifts the noise frequency smoothly; `boil` re-seeds at `hz` (12 = animation
on twos). Higher `freq` = finer wobble. **filter**, heavy full-frame: warp a word or a wrapper.

---

## Impact

### Flash: `makeFlash(parent, colour = null)`
White, or a brand token. Drive with `opacity(f, flashAt(t, hits, …))`; peak
0.6–0.85, len 0.08–0.12. Counts toward `flashCheck`.

### Ring: `makeRing(parent, colour)` → `ring(el, t, t0, { x = 540, y = 960, r0 = 20, r1 = 700, dur = 0.5, width = 14 })`
Out-cubic expansion, thinning and fading. Two rings 0.06 s apart read as a
shockwave. **free** (transform + border).

### Sparks: `makeSparks(parent, n, colour, { seed = 9, size = 10 })` → `sparks(S, t, t0, { x, y, dir = -90, spread = 140, speed = 1400, gravity = 2600, life = 0.75 })`
Ballistic, closed-form; each spark points along its velocity. `dir` degrees
(−90 up), `spread` degrees of cone (360 burst). 20–40 sparks. **free**.

### Speed lines: `makeSpeedLines(parent, colour, { cx = 50, cy = 45, clear = 30, spokes = 90 })` → `speedLines(S, amount, t, { hz = 12, seed = 7 })`
Hard conic stripes with a clear centre that shrinks as `amount` rises,
re-jittered at `hz`. Decay over ~0.9 s after a hit. **cheap**.

---

## Space

### Dust / bokeh: `makeDust(parent, n, colour, { seed = 21, size = [3, 10], blur = 0, W, H })` → `dust(D, t, amount, { rise = 40, sway = 26 })`
Seeded motes rising at depth-scaled speed, swaying on noise, wrapping top to
bottom. Dust: 50–80 motes, size [2, 7], no blur. Bokeh: 10–16, size [60, 160],
blur 12–16, `rise` 10–20. **cheap** for dust; bokeh's blur is a static filter
per mote (fine at ~15).

### Goo: `makeGoo(id, { blur = 16, contrast = 22 })` → `filter` value
Blur then alpha threshold, composited atop the source: shapes inside the
container melt where they meet. Blobs are plain circles in brand colours; the
container must have no background. Bigger `blur` = longer bridges. **filter**
on the container's area.

### Letterbox: `makeLetterbox(parent, { W, H })` → `letterbox(L, p, { ratio = 2.39 })`
Bars sized for `ratio` and slid in by `p`. On a 1080x1920 frame 2.39 leaves
a thin strip; vertical films use 1.0–1.35 for a cinematic window. Make it late
(above captions) or it covers nothing. **free**.

---

## Debugging an effect

- **Looks different in export than preview:** something reads the clock or
  `Math.random()` (the lint catches both in films), or a CSS transition sneaked
  in. Every random must be `rand(seed, frame)`.
- **Export sits on one frame:** see the export traps in SKILL.md; time one
  `shot.mjs --at` per effect.
- **Effect invisible:** `opacity()` sets `visibility:hidden` at 0, and every
  overlay starts hidden until its driver runs; make sure render calls it every
  frame, including the frames where it should be 0.
- **Two effects fight:** both write `filter` or both write `transform` on the
  same element. Wrap one.
