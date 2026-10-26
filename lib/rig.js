/* A camera for a world of type and shapes.
 *
 * Put everything that lives in the same space inside one `world` element at the
 * frame's size (children absolutely positioned; (0,0) of the world is the
 * CENTRE of the frame, so an object at x:0,y:0 sits in the middle). The rig
 * moves the world the opposite way to the camera, so a push in is a zoom and a
 * pan is a translate — and, unlike animating each object, they cannot disagree.
 *
 *   const rig = makeRig(world);
 *   const cam = camera({
 *     x:  [[0, 0], [2, 500, E.inOutExpo]],
 *     z:  [[0, 1], [2, 1.8, E.inOutExpo]],
 *     rx: [[0, 0], [2, 20, E.inOut]],
 *   }, [ { at: 2.0, amp: 30, seed: 1 } ]);   // an impact when the move lands
 *   rig(cam(t));
 *
 * Camera moves that read as designed, not as a CSS transform:
 *   - Move and zoom together on one curve, so they begin and end as one gesture.
 *   - Add a little rotation (2–4°) to a big move. A perfectly square camera is
 *     a screen recording.
 *   - Land with an `impact` or a spring, not a dead stop.
 *   - Blur by the speed of the move (see `cameraBlur`), not by guess.
 */

import { css } from './anim.js';
import { track, impact, drift, speed } from './motion.js';
import { dirBlur } from './fx.js';

const DEFAULT = { x: 0, y: 0, z: 1, rot: 0, rx: 0, ry: 0 };

export function makeRig(world, { perspective = 1600 } = {}) {
  return function apply(c) {
    const cam = { ...DEFAULT, ...c };
    const x = cam.x + (cam.sx ?? 0), y = cam.y + (cam.sy ?? 0);
    const rot = cam.rot + (cam.srot ?? 0);
    css(world, 'transform',
      `perspective(${perspective}px) rotateX(${cam.rx.toFixed(3)}deg) rotateY(${cam.ry.toFixed(3)}deg) ` +
      `rotate(${rot.toFixed(3)}deg) scale(${cam.z.toFixed(5)}) translate3d(${(-x).toFixed(2)}px,${(-y).toFixed(2)}px,0)`);
  };
}

/**
 * Build `t → camera state` from property tracks plus impacts.
 *   spec     { x, y, z, rot, rx, ry }: each [[t, value, ease?], …]
 *   hits     [{ at, amp, decay, freq, seed, rot }]  — shake on x, y and rot
 *   handheld amplitude of constant drift in px (0 to turn off)
 */
export function camera(spec, hits = [], { handheld = 0 } = {}) {
  const fns = Object.fromEntries(Object.entries(spec).map(([k, keys]) => [k, track(keys)]));
  return (t) => {
    const c = { ...DEFAULT };
    for (const [k, f] of Object.entries(fns)) c[k] = f(t);
    c.sx = 0; c.sy = 0; c.srot = 0;
    for (const h of hits) {
      const o = { decay: h.decay, freq: h.freq };
      c.sx += impact(t, h.at, { ...o, amp: h.amp, seed: h.seed ?? 1 });
      c.sy += impact(t, h.at, { ...o, amp: h.amp, seed: (h.seed ?? 1) + 17 });
      c.srot += impact(t, h.at, { ...o, amp: h.rot ?? h.amp / 12, seed: (h.seed ?? 1) + 31 });
    }
    if (handheld) {
      c.sx += drift(t, { amp: handheld, seed: 11 });
      c.sy += drift(t, { amp: handheld, seed: 12 });
      c.srot += drift(t, { amp: handheld / 8, seed: 13 });
    }
    return c;
  };
}

/**
 * Motion blur on the world derived from the camera's own screen-space speed.
 * `k` ≈ 0.014 is a 180° shutter at 60 fps; raise to exaggerate.
 */
export function cameraBlur(world, cam, t, { k = 0.014, max = 40 } = {}) {
  const vx = Math.abs(speed((s) => cam(s).x * cam(s).z + cam(s).sx, t));
  const vy = Math.abs(speed((s) => cam(s).y * cam(s).z + cam(s).sy, t));
  dirBlur(world, Math.min(max, vx * k), Math.min(max, vy * k));
}
