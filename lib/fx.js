/* Effects that need real DOM/SVG: directional blur, echoes, slice smear.
 *
 * All of them are set from `t` each frame and no-op when the value has not
 * changed, like the rest of the kit. None starts a transition or animation.
 */

import { css, opacity } from './anim.js';
import { noise, rand } from './motion.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
let defs = null;
const filters = new WeakMap();
let nextId = 1;

function filterFor(el) {
  let f = filters.get(el);
  if (f) return f;
  if (!defs) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.style.cssText = 'position:absolute;pointer-events:none';
    defs = document.createElementNS(SVG_NS, 'defs');
    svg.appendChild(defs);
    document.body.appendChild(svg);
  }
  const id = `pk-dirblur-${nextId++}`;
  const filter = document.createElementNS(SVG_NS, 'filter');
  filter.setAttribute('id', id);
  // Generous region: a blur that is clipped by its own filter box is a visible
  // rectangle edge on the first frame of a fast move.
  for (const [k, v] of [['x', '-60%'], ['y', '-60%'], ['width', '220%'], ['height', '220%'],
    ['color-interpolation-filters', 'sRGB']]) filter.setAttribute(k, v);
  const blur = document.createElementNS(SVG_NS, 'feGaussianBlur');
  blur.setAttribute('stdDeviation', '0 0');
  filter.appendChild(blur);
  defs.appendChild(filter);
  f = { id, blur, last: '' };
  filters.set(el, f);
  return f;
}

/**
 * Blur along one axis only — what a shutter does to something moving sideways.
 * `sx`, `sy` are standard deviations in px. CSS blur() is round and reads as
 * "out of focus"; this reads as "fast". Below ~0.4 px it switches itself off,
 * so a resting element is not paying for a filter.
 *
 * Derive the amount from the motion: sx = k * |speed(xFn, t)|, k ≈ 0.012–0.02
 * (shutter angle 180° at 60 fps ≈ speed/120 for a full-length smear; the std
 * deviation of that smear is about a third of its length).
 */
export function dirBlur(el, sx, sy = 0) {
  if (!el) return;
  const on = sx > 0.4 || sy > 0.4;
  if (!on) {
    css(el, 'filter', 'none');
    return;
  }
  const f = filterFor(el);
  const v = `${sx.toFixed(2)} ${sy.toFixed(2)}`;
  if (f.last !== v) {
    f.blur.setAttribute('stdDeviation', v);
    f.last = v;
  }
  css(el, 'filter', `url(#${f.id})`);
}

/* The clones of echoes and slices are absolutely positioned over the original,
 * so the original has to sit in a shrink-wrapped relative box of its own: the
 * box keeps the layout (centring, line breaks) and the clones stack on it. */
function stackOf(el) {
  const p = el.parentNode;
  if (p.dataset.pkstack) return p;
  const w = document.createElement('span');
  w.dataset.pkstack = '1';
  w.style.cssText = 'position:relative;display:inline-block';
  p.insertBefore(w, el);
  w.appendChild(el);
  return w;
}
const OVER = ';position:absolute;left:0;top:0;pointer-events:none';

/* ---------- echoes: the outlined ghosts that trail a word ---------- */

/**
 * Clone `el` n times behind it as outlines. Returns the clones; drive them with
 * `echoes()`. The clones are siblings inserted before the original, so they
 * share its position in the layout.
 */
export function makeEchoes(el, n = 3, { stroke = 3 } = {}) {
  const list = [];
  const colour = getComputedStyle(el).color;
  const box = stackOf(el);
  for (let i = 0; i < n; i++) {
    const c = el.cloneNode(true);
    c.setAttribute('aria-hidden', 'true');
    c.style.cssText += `${OVER};color:transparent;-webkit-text-stroke:${stroke}px ${colour}`;
    box.insertBefore(c, el);
    list.push(c);
  }
  return list;
}

/**
 * Spread the echoes `amount` (0…1) of the way to their full offset.
 * Echo i sits at (i+1)*(dx,dy)*amount and fades along the trail.
 */
export function echoes(list, amount, { dx = 0, dy = 0, fade = 0.55, scale = 0, sx = 1, sy = 1 } = {}) {
  list.forEach((c, i) => {
    const k = (i + 1) * amount;
    const a = amount <= 0.001 ? 0 : fade * (1 - i / list.length);
    opacity(c, a);
    css(c, 'transform', `translate3d(${(dx * k).toFixed(2)}px,${(dy * k).toFixed(2)}px,0) scale(${(sx * (1 + scale * k)).toFixed(4)},${sy.toFixed(4)})`);
  });
}

/* ---------- slice smear ---------- */

/**
 * Cut `el` into n horizontal strips that can slide sideways independently.
 * The original is hidden while the smear is on, and the clones carry the look.
 */
export function makeSlices(el, n = 9) {
  const strips = [];
  const box = stackOf(el);
  for (let i = 0; i < n; i++) {
    const c = el.cloneNode(true);
    c.setAttribute('aria-hidden', 'true');
    const top = (i / n) * 100, bottom = 100 - ((i + 1) / n) * 100;
    c.style.cssText += `${OVER};clip-path:inset(${top.toFixed(3)}% -50% ${bottom.toFixed(3)}% -50%)`;
    box.appendChild(c);
    strips.push(c);
  }
  return { el, strips };
}

/**
 * `amount` 0…1 scales the displacement. Strips move by smooth noise, so the
 * smear tears and recovers instead of vibrating; the frame index (quantised
 * `t`) is what makes it stutter like a glitch rather than float like water.
 */
export function slices({ el, strips }, amount, t, { reach = 140, seed = 5, hz = 24 } = {}) {
  const on = amount > 0.002;
  opacity(el, on ? 0 : 1);
  const tq = Math.floor(t * hz) / hz;
  strips.forEach((c, i) => {
    if (!on) { opacity(c, 0); return; }
    opacity(c, 1);
    const dx = (noise(seed + i, tq * 9) * 0.7 + (rand(seed, i + Math.floor(tq * hz)) - 0.5) * 0.6) * reach * amount;
    css(c, 'transform', `translate3d(${dx.toFixed(2)}px,0,0)`);
  });
}
