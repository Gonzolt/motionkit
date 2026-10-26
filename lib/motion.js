/* Motion maths. Curves, springs, keyframe tracks, seeded noise.
 *
 * Everything here is a pure function of numbers — no DOM, no clock — so it can
 * be unit-tested, probed at any t, and differentiated (see `speed`, which is
 * how motion blur is derived from motion instead of being guessed).
 *
 * WHY THIS FILE EXISTS. anim.js has four easings (cubic in/out, one back).
 * Those are the browser-default feel: they read as "software". The motion that
 * reads as designed uses a small set of STRONG curves with a long tail, springs
 * for anything that lands, and different curves for different jobs. Pick from
 * `E` by the job, not by taste on the day:
 *
 *   E.out        UI entrances, things responding. Fast start, soft landing.
 *   E.outExpo    Hero type, big moves, camera settles. Almost all travel in
 *                the first third; the rest is a long, calm arrival.
 *   E.outQuart   Between the two. Default for staggered children.
 *   E.inOut      Something already on screen moving A to B.
 *   E.inOutExpo  Whips and snap-cuts: nearly nothing, then everything, then
 *                nothing. The "camera whip" curve.
 *   E.snap       Hard, fast, tiny settle. Transitions under 0.3 s.
 *   E.anticipate Pulls back before it goes. Use once per scene, not per object.
 *   E.linear     Only for constant motion (a scrolling line, a progress bar).
 *
 * Never E.in for something appearing: it starts slowly, which is precisely the
 * moment the viewer is looking.
 */

import { clamp, lerp, win } from './anim.js';

export { clamp, lerp, win };

/* ---------- cubic-bezier, the same maths as CSS ---------- */

export function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (s) => ((ax * s + bx) * s + cx) * s;
  const Y = (s) => ((ay * s + by) * s + cy) * s;
  const dX = (s) => (3 * ax * s + 2 * bx) * s + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    // Newton first (fast), bisection if the slope is too flat to trust.
    let s = x;
    for (let i = 0; i < 6; i++) {
      const e = X(s) - x;
      if (Math.abs(e) < 1e-6) return Y(s);
      const d = dX(s);
      if (Math.abs(d) < 1e-6) break;
      s -= e / d;
    }
    let lo = 0, hi = 1;
    s = x;
    for (let i = 0; i < 24; i++) {
      const e = X(s) - x;
      if (Math.abs(e) < 1e-6) break;
      if (e > 0) hi = s; else lo = s;
      s = (lo + hi) / 2;
    }
    return Y(s);
  };
}

export const E = {
  linear: (x) => x,
  out: bezier(0.23, 1, 0.32, 1),
  outExpo: bezier(0.16, 1, 0.3, 1),
  outQuart: bezier(0.25, 1, 0.5, 1),
  inOut: bezier(0.77, 0, 0.175, 1),
  inOutExpo: bezier(0.87, 0, 0.13, 1),
  snap: bezier(0.2, 0.9, 0.2, 1),
  drawer: bezier(0.32, 0.72, 0, 1),
  anticipate: bezier(0.6, -0.4, 0.2, 1),
  /* Exits: ease-in is allowed here because the viewer's eye has already left. */
  in: bezier(0.55, 0, 1, 0.45),
  inExpo: bezier(0.7, 0, 0.84, 0),
  /* Overshoot by `c` (0.1 is a nudge, 0.3 is a bounce). */
  back: (c = 0.2) => bezier(0.34, 1 + c * 3.5, 0.64, 1),
};

/* ---------- springs ----------
 *
 * Closed form, so a spring is a function of time like everything else — no
 * integration, no state, scrub-safe. Apple's parameterisation: `duration` is
 * the perceptual time to arrive (the tail keeps settling after it) and
 * `bounce` runs 0 (critically damped, no overshoot) to ~0.5 (very springy);
 * negative bounce is over-damped and sluggish.
 *
 * Returns the position 0 → 1 (overshooting past 1 when bouncy) `s` seconds
 * after the spring was released.
 */
export function spring(s, { duration = 0.55, bounce = 0.2 } = {}) {
  if (s <= 0) return 0;
  const w = (2 * Math.PI) / duration;
  const z = bounce >= 0 ? 1 - bounce : 1 / (1 + bounce);
  if (z < 1) {
    const wd = w * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w * s) * (Math.cos(wd * s) + ((z * w) / wd) * Math.sin(wd * s));
  }
  if (z === 1) return 1 - Math.exp(-w * s) * (1 + w * s);
  const k = w * Math.sqrt(z * z - 1);
  return 1 - Math.exp(-z * w * s) * (Math.cosh(k * s) + ((z * w) / k) * Math.sinh(k * s));
}

/** A spring that starts at `start` seconds: springAt(t, 1.2, {bounce: .3}). */
export const springAt = (t, start, opts) => spring(t - start, opts);

/* ---------- windows ---------- */

/** 0→1 across [a,b] through a curve. `ramp` in anim.js, but defaulting to a
 *  strong curve instead of cubic ease-out. */
export const go = (t, a, b, ease = E.out) => ease(win(t, a, b));

/** from→to across [a,b]. The value of nearly every property in a film. */
export const tween = (t, a, b, from, to, ease = E.out) => lerp(from, to, go(t, a, b, ease));

/** Up over `inDur`, hold, down over `outDur`. 0…1. */
export const pulse = (t, a, b, inDur = 0.25, outDur = 0.25, easeIn = E.out, easeOut = E.in) =>
  Math.min(easeIn(win(t, a, a + inDur)), 1 - easeOut(win(t, b - outDur, b)));

/** Stagger: child `i` of `n`, each starting `each` s after the last. */
export function stagger(t, i, { start = 0, each = 0.04, dur = 0.5, ease = E.outQuart } = {}) {
  const a = start + i * each;
  return ease(win(t, a, a + dur));
}

/** Total time a stagger of `n` children takes, so the next beat can start on it. */
export const staggerSpan = (n, { each = 0.04, dur = 0.5 } = {}) => (n - 1) * each + dur;

/* ---------- keyframe tracks ----------
 *
 * track([[0, 0], [1, 100, E.outExpo], [2.5, 0, E.inOut]])
 *
 * A key's curve governs the segment ARRIVING at it. Before the first key and
 * after the last the value holds. A key may also be [t, v, ease, 'hold'] to
 * stay at the previous value until t and then jump — a hard cut inside a
 * property.
 */
export function track(keys, defaultEase = E.out) {
  const ks = keys.map(([t, v, ease, mode]) => ({ t, v, ease: ease ?? defaultEase, hold: mode === 'hold' }));
  for (let i = 1; i < ks.length; i++) {
    if (ks[i].t < ks[i - 1].t) throw new Error(`track keys out of order at index ${i}`);
  }
  return (t) => {
    if (t <= ks[0].t) return ks[0].v;
    const last = ks[ks.length - 1];
    if (t >= last.t) return last.v;
    let i = 1;
    while (ks[i].t < t) i++;
    const a = ks[i - 1], b = ks[i];
    if (b.hold) return a.v;
    return lerp(a.v, b.v, b.ease((t - a.t) / (b.t - a.t)));
  };
}

/** Several tracks at once: tracks({x: [...], y: [...]}) → t → {x, y}. */
export function tracks(spec, defaultEase) {
  const fns = Object.entries(spec).map(([k, keys]) => [k, track(keys, defaultEase)]);
  return (t) => Object.fromEntries(fns.map(([k, f]) => [k, f(t)]));
}

/* ---------- velocity ----------
 *
 * Motion blur that matches the motion has to come from the motion. Differentiate
 * the function that drives the object and blur by that, instead of picking a
 * blur amount that looks about right and is wrong at both ends of the move.
 */
export const speed = (fn, t, dt = 1 / 120) => (fn(t + dt) - fn(t - dt)) / (2 * dt);

/* ---------- seeded noise ---------- */

const hash = (n) => {
  let x = Math.imul(n | 0, 0x27d4eb2d) ^ 0x165667b1;
  x = Math.imul(x ^ (x >>> 15), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
};

/** Smooth 1-D value noise, −1…1, same answer for the same (seed, x). */
export function noise(seed, x) {
  const i = Math.floor(x), f = x - i;
  const u = f * f * (3 - 2 * f);
  const a = hash(i * 7919 + seed * 104729) * 2 - 1;
  const b = hash((i + 1) * 7919 + seed * 104729) * 2 - 1;
  return lerp(a, b, u);
}

/** Uncorrelated 0…1 per (seed, index): for scatter, delays, glitch strips. */
export const rand = (seed, i = 0) => hash(i * 2654435761 + seed * 40503);

/**
 * A hit: starts at `t0` with `amp`, rings at `freq` Hz, dies with `decay`/s.
 * Add it to camera x/y/rot for an impact. Calling it for the same hit with
 * two seeds gives independent x and y so it does not just slide on a diagonal.
 */
export function impact(t, t0, { amp = 24, decay = 7, freq = 14, seed = 1 } = {}) {
  const s = t - t0;
  if (s < 0) return 0;
  return amp * Math.exp(-decay * s) * noise(seed, s * freq);
}

/** Continuous handheld drift: a little, always. Stillness reads as dead. */
export const drift = (t, { amp = 6, freq = 0.35, seed = 3 } = {}) => amp * noise(seed, t * freq);
