/* Effects that need real DOM/SVG: blurs, echoes, slice smear, and the finish
 * (grain, RGB split, light leaks, flares, grades, warps, sparks…).
 *
 * All of them are set from `t` each frame and no-op when the value has not
 * changed, like the rest of the kit. None starts a transition or animation.
 * Anything random is seeded and quantised to a frame rate, so the same `t`
 * always draws the same frame.
 *
 * ONE `filter` per element. dirBlur, rgbSplit, warp and a grade all write the
 * element's `filter`; to stack two, nest the element in a wrapper and give
 * each its own (blur on the wrapper, split on the child). The catalogue with
 * every effect running is lab/fxlab; the how-to is the film-fx skill.
 */

import { alpha, css, opacity, clamp, lerp, rng, xform } from './anim.js';
import { impact, noise, rand } from './motion.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
let defs = null;
const filters = new WeakMap();
let nextId = 1;

/** The page's one hidden <defs>, made on first use. */
function svgDefs() {
  if (!defs) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.style.cssText = 'position:absolute;pointer-events:none';
    defs = document.createElementNS(SVG_NS, 'defs');
    svg.appendChild(defs);
    document.body.appendChild(svg);
  }
  return defs;
}
function svgEl(tag, attrs, parent) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  parent.appendChild(el);
  return el;
}
/* Generous region: a blur that is clipped by its own filter box is a visible
   rectangle edge on the first frame of a fast move. */
const WIDE = { x: '-60%', y: '-60%', width: '220%', height: '220%', 'color-interpolation-filters': 'sRGB' };

function filterFor(el) {
  let f = filters.get(el);
  if (f) return f;
  const id = `pk-dirblur-${nextId++}`;
  const filter = svgEl('filter', { id, ...WIDE }, svgDefs());
  const blur = svgEl('feGaussianBlur', { stdDeviation: '0 0' }, filter);
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
    c.removeAttribute('id'); // a cloned id makes querySelector('#id') find the copy
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
    c.removeAttribute('id'); // a cloned id makes querySelector('#id') find the copy
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

/* ---------- full-frame finish layers ---------- */

/** A full-frame overlay on `parent`, hidden until driven. */
function overlay(parent, style = '') {
  const el = document.createElement('div');
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText = `position:absolute;inset:0;pointer-events:none;overflow:hidden;visibility:hidden;${style}`;
  parent.appendChild(el);
  return el;
}

/**
 * Film grain: a few seeded noise tiles, one picked and shifted per frame at
 * `hz` (24 reads as film, 12 as cheap video). Overlay blend lifts the
 * mid-tones and leaves pure black and white alone. `amount` 0.1–0.2 is felt,
 * 0.35 is a look.
 */
export function makeGrain(parent, { tiles = 4, size = 256, seed = 101, blend = 'overlay' } = {}) {
  const urls = Array.from({ length: tiles }, (_, k) => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const d = g.createImageData(size, size);
    const r = rng(seed + k);
    for (let i = 0; i < d.data.length; i += 4) {
      // three uniforms summed: roughly gaussian, like silver, not like static
      d.data[i] = d.data[i + 1] = d.data[i + 2] = clamp(Math.round(128 + (r() + r() + r() - 1.5) * 150), 0, 255);
      d.data[i + 3] = 255;
    }
    g.putImageData(d, 0, 0);
    return c.toDataURL('image/png');
  });
  return { el: overlay(parent, `mix-blend-mode:${blend};background-size:${size}px ${size}px`), urls, size };
}
export function grain(G, t, amount, { hz = 24 } = {}) {
  opacity(G.el, amount);
  if (amount <= 0.001) return;
  const f = Math.floor(t * hz);
  css(G.el, 'background-image', `url(${G.urls[f % G.urls.length]})`);
  css(G.el, 'background-position', `${Math.floor(rand(f, 1) * G.size)}px ${Math.floor(rand(f, 2) * G.size)}px`);
}

/** Dark corners. Drive it with opacity(); 0.6–0.8 at rest, up in slow motion. */
export const makeVignette = (parent, { at = 'ellipse 80% 62% at 50% 50%', from = 50, dark = 0.85 } = {}) =>
  overlay(parent, `background:radial-gradient(${at}, rgba(0,0,0,0) ${from}%, rgba(0,0,0,${dark}) 100%)`);

/** A full-frame flash. White by default; pass a brand hex token for a tinted pop. Drive with opacity(). */
export const makeFlash = (parent, colour = null) =>
  overlay(parent, `background:${colour ? alpha(colour, 1) : 'rgba(255,255,255,1)'}`);

/**
 * The flash amount at `t` from a list of hit times: full on the hit frame,
 * gone after `len` seconds. Check the list with flashCheck() first.
 */
export function flashAt(t, times, { len = 0.12, peak = 1 } = {}) {
  let a = 0;
  for (const h of times) if (t >= h && t < h + len) a = Math.max(a, peak * (1 - (t - h) / len) ** 2);
  return a;
}

/**
 * WCAG 2.3.1: no more than three flashes in any one second. Pass the times of
 * every full-frame flash, strobe or hard light/dark cut; returns the windows
 * that break the rule (empty when the film is safe). Pure, so a film can
 * throw on it at load and a test can run it in node.
 */
export function flashCheck(times, { max = 3, window = 1 } = {}) {
  const ts = [...times].sort((a, b) => a - b);
  const bad = [];
  for (let i = 0; i < ts.length; i++) {
    let j = i;
    while (j + 1 < ts.length && ts[j + 1] - ts[i] < window) j++;
    if (j - i + 1 > max) bad.push({ from: ts[i], count: j - i + 1 });
  }
  return bad;
}

/* ---------- RGB split ---------- */

/**
 * Pull the red channel one way and blue the other by (px, py). Reads as a
 * hit on a beat at 10–30 px, as a lens fault at 2–4 px held. Below 0.6 px
 * it switches the filter off. One filter per element.
 */
export function rgbSplit(el, px, py = 0) {
  if (!el) return;
  if (Math.abs(px) < 0.6 && Math.abs(py) < 0.6) { css(el, 'filter', 'none'); return; }
  let f = splits.get(el);
  if (!f) {
    const id = `pk-rgb-${nextId++}`;
    const fl = svgEl('filter', { id, x: '-5%', y: '-5%', width: '110%', height: '110%', 'color-interpolation-filters': 'sRGB' }, svgDefs());
    const only = (m, result) => svgEl('feColorMatrix', { in: 'SourceGraphic', type: 'matrix', values: m, result }, fl);
    only('1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0', 'r');
    const offR = svgEl('feOffset', { in: 'r', dx: '0', dy: '0', result: 'ro' }, fl);
    only('0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0', 'g');
    only('0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0', 'b');
    const offB = svgEl('feOffset', { in: 'b', dx: '0', dy: '0', result: 'bo' }, fl);
    const add = { operator: 'arithmetic', k1: '0', k2: '1', k3: '1', k4: '0' };
    svgEl('feComposite', { in: 'ro', in2: 'g', ...add, result: 'rg' }, fl);
    svgEl('feComposite', { in: 'rg', in2: 'bo', ...add }, fl);
    f = { id, offR, offB, last: '' };
    splits.set(el, f);
  }
  const v = `${px.toFixed(1)},${py.toFixed(1)}`;
  if (f.last !== v) {
    f.offR.setAttribute('dx', (-px).toFixed(1));
    f.offR.setAttribute('dy', (-py).toFixed(1));
    f.offB.setAttribute('dx', px.toFixed(1));
    f.offB.setAttribute('dy', py.toFixed(1));
    f.last = v;
  }
  css(el, 'filter', `url(#${f.id})`);
}
const splits = new WeakMap();

/* ---------- grades ---------- */

/** Per-channel tone curves, 0…1 tables from shadows to highlights. Curves, not colours. */
export const GRADES = {
  // teal shadows, warm highlights, crushed blacks: the montage look
  tealOrange: { r: '0 0.015 0.15 0.42 0.74 0.94 1', g: '0 0.05 0.2 0.44 0.7 0.89 0.97', b: '0.01 0.1 0.27 0.47 0.67 0.83 0.9' },
  // hard contrast, a touch cool in the highlights: bleach bypass (add saturate(0.6))
  bleach: { r: '0 0.08 0.3 0.6 0.86 1', g: '0 0.08 0.3 0.6 0.86 1', b: '0 0.09 0.31 0.6 0.85 0.98' },
  warm: { r: '0.02 0.3 0.62 0.9 1', g: '0.01 0.26 0.55 0.82 0.96', b: '0 0.2 0.45 0.72 0.88' },
  cold: { r: '0 0.2 0.47 0.75 0.93', g: '0.01 0.25 0.53 0.8 0.97', b: '0.04 0.32 0.62 0.88 1' },
};

/**
 * Register a grade once and get the filter reference to put in `filter`:
 *   const g = makeGrade('teal', GRADES.tealOrange);
 *   css(img, 'filter', `${g} contrast(1.08) saturate(1.3)`);
 */
export function makeGrade(id, { r, g, b }) {
  const f = svgEl('filter', { id, 'color-interpolation-filters': 'sRGB' }, svgDefs());
  const ct = svgEl('feComponentTransfer', {}, f);
  svgEl('feFuncR', { type: 'table', tableValues: r }, ct);
  svgEl('feFuncG', { type: 'table', tableValues: g }, ct);
  svgEl('feFuncB', { type: 'table', tableValues: b }, ct);
  return `url(#${id})`;
}

/** Duotone / gradient map: luminance mapped from `dark` to `light` (brand hex tokens). */
export function makeDuotone(id, dark, light) {
  const rgb = (hex) => alpha(hex, 1).match(/\d+/g).slice(0, 3).map((v) => (v / 255).toFixed(3));
  const [d, l] = [rgb(dark), rgb(light)];
  const f = svgEl('filter', { id, 'color-interpolation-filters': 'sRGB' }, svgDefs());
  svgEl('feColorMatrix', { type: 'matrix', values: '.2126 .7152 .0722 0 0  .2126 .7152 .0722 0 0  .2126 .7152 .0722 0 0  0 0 0 1 0' }, f);
  const ct = svgEl('feComponentTransfer', {}, f);
  ['R', 'G', 'B'].forEach((c, i) => svgEl(`feFunc${c}`, { type: 'table', tableValues: `${d[i]} ${l[i]}` }, ct));
  return `url(#${id})`;
}

/* ---------- light: leaks and flares ---------- */

/**
 * Two warm blobs that sweep across in screen blend: what a cut burns with on
 * film. `hot`, `deep` are brand hex tokens.
 */
export function makeLeaks(parent, [hot, deep], { W = 1080, H = 1920 } = {}) {
  const el = overlay(parent, 'mix-blend-mode:screen');
  const blob = (w, hgt, bg) => {
    const b = document.createElement('div');
    b.style.cssText = `position:absolute;left:0;top:0;width:${w}px;height:${hgt}px;margin:${-hgt / 2}px 0 0 ${-w / 2}px;border-radius:50%;background:${bg}`;
    el.appendChild(b);
    return b;
  };
  const a = blob(1500, 1500, `radial-gradient(circle, ${alpha(hot, 0.95)} 0%, ${alpha(deep, 0.55)} 35%, rgba(0,0,0,0) 68%)`);
  const b = blob(1100, 1700, `radial-gradient(ellipse, ${alpha(deep, 0.85)} 0%, ${alpha(deep, 0.3)} 40%, rgba(0,0,0,0) 70%)`);
  return { el, a, b, W, H };
}
export function leaks(L, amount, t, { seed = 3 } = {}) {
  opacity(L.el, clamp(amount) * 0.85);
  if (amount <= 0.001) return;
  xform(L.a, { x: lerp(-200, L.W + 200, clamp(0.5 + 0.9 * noise(seed, t * 0.7) + 0.6 * (1 - amount))), y: L.H * 0.22 + 300 * noise(seed + 1, t * 0.9) });
  xform(L.b, { x: L.W - 120 + 160 * noise(seed + 2, t * 1.1), y: L.H * 0.68 + 260 * noise(seed + 3, t * 0.8), s: 0.8 + 0.4 * amount });
}

/**
 * Anamorphic lens flare: a long horizontal streak, a hotspot, and ghosts on
 * the line from the flare through the frame centre. `tint`, `ghost` are hex tokens.
 */
export function makeFlare(parent, { tint, ghost = tint, W = 1080, H = 1920 } = {}) {
  const root = overlay(parent, 'mix-blend-mode:screen;overflow:visible');
  const add = (host, style) => {
    const d = document.createElement('div');
    d.style.cssText = `position:absolute;${style}`;
    host.appendChild(d);
    return d;
  };
  const at = add(root, 'left:0;top:0;width:0;height:0');
  const glow = add(at, `left:-1400px;top:-45px;width:2800px;height:90px;filter:blur(18px);background:linear-gradient(90deg, rgba(0,0,0,0) 0%, ${alpha(tint, 0.55)} 30%, ${alpha(tint, 0.9)} 50%, ${alpha(tint, 0.55)} 70%, rgba(0,0,0,0) 100%)`);
  const streak = add(at, `left:-1300px;top:-4px;width:2600px;height:8px;background:linear-gradient(90deg, rgba(0,0,0,0) 0%, ${alpha(tint, 0.8)} 25%, rgba(255,255,255,1) 50%, ${alpha(tint, 0.8)} 75%, rgba(0,0,0,0) 100%)`);
  add(at, `left:-170px;top:-170px;width:340px;height:340px;border-radius:50%;background:radial-gradient(circle, rgba(255,255,255,1) 0%, ${alpha(tint, 0.7)} 22%, rgba(0,0,0,0) 65%)`);
  const ghosts = [[0.55, 120, ghost, 0.35], [1.25, 70, tint, 0.4], [1.7, 200, ghost, 0.18]].map(([k, r, c, a]) => ({
    k,
    el: add(root, `left:0;top:0;width:${r * 2}px;height:${r * 2}px;margin:${-r}px 0 0 ${-r}px;border-radius:50%;` +
      `background:radial-gradient(circle, ${alpha(c, a * 0.4)} 0%, ${alpha(c, a)} 70%, rgba(0,0,0,0) 72%)`),
  }));
  return { el: root, at, glow, streak, ghosts, W, H };
}
export function flare(F, amount, x, y) {
  const a = clamp(amount);
  opacity(F.el, a);
  if (a <= 0.001) return;
  xform(F.at, { x, y });
  css(F.streak, 'transform', `scaleX(${(0.6 + 0.6 * a).toFixed(3)})`);
  css(F.glow, 'transform', `scaleX(${(0.6 + 0.6 * a).toFixed(3)})`);
  for (const g of F.ghosts) xform(g.el, { x: F.W / 2 + (F.W / 2 - x) * g.k, y: F.H / 2 + (F.H / 2 - y) * g.k });
}

/* ---------- zoom blur ---------- */

/**
 * Radial punch-in blur: n faint copies scaled out from the origin. The cheap
 * version of a radial blur, and on type it reads the same. Drive `amount`
 * 0…1 off the speed of a zoom, not off a timer.
 */
export function makeZoomBlur(el, n = 6) {
  const box = stackOf(el);
  const copies = Array.from({ length: n }, () => {
    const c = el.cloneNode(true);
    c.setAttribute('aria-hidden', 'true');
    c.removeAttribute('id'); // a cloned id makes querySelector('#id') find the copy
    c.style.cssText += OVER;
    box.appendChild(c);
    return c;
  });
  return { el, copies };
}
export function zoomBlur({ copies }, amount, { reach = 0.35, ox = 50, oy = 50, fade = 0.32 } = {}) {
  copies.forEach((c, i) => {
    const k = (i + 1) / copies.length;
    opacity(c, amount <= 0.002 ? 0 : fade * (1 - k * 0.7) * Math.min(1, amount * 3));
    css(c, 'transform-origin', `${ox}% ${oy}%`);
    css(c, 'transform', `scale(${(1 + reach * amount * k).toFixed(4)})`);
  });
}

/* ---------- warp: heat haze and boil ---------- */

/**
 * Displace `el` by noise. mode 'heat' drifts smoothly (haze, underwater,
 * dream); 'boil' re-seeds every frame at `hz` (hand-drawn line boil, a hit
 * that shudders). `amount` is the displacement in px. One filter per element.
 */
export function makeWarp(el, { freq = 0.012, octaves = 2, mode = 'heat' } = {}) {
  const id = `pk-warp-${nextId++}`;
  const f = svgEl('filter', { id, ...WIDE }, svgDefs());
  const turb = svgEl('feTurbulence', { type: 'fractalNoise', baseFrequency: `${freq}`, numOctaves: `${octaves}`, seed: '1', result: 'n' }, f);
  const disp = svgEl('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: '0', xChannelSelector: 'R', yChannelSelector: 'G' }, f);
  return { el, id, turb, disp, freq, mode, last: '' };
}
export function warp(Wp, amount, t, { hz = 12, seed = 1 } = {}) {
  if (amount < 0.3) { css(Wp.el, 'filter', 'none'); return; }
  const fq = Wp.mode === 'boil'
    ? `${Wp.freq}`
    : `${(Wp.freq * (1 + 0.25 * noise(seed, t * 0.6))).toFixed(5)} ${(Wp.freq * (1.6 + 0.4 * noise(seed + 1, t * 0.5))).toFixed(5)}`;
  const sd = Wp.mode === 'boil' ? String(seed + Math.floor(t * hz)) : String(seed);
  const v = `${fq}|${sd}|${amount.toFixed(1)}`;
  if (Wp.last !== v) {
    Wp.turb.setAttribute('baseFrequency', fq);
    Wp.turb.setAttribute('seed', sd);
    Wp.disp.setAttribute('scale', amount.toFixed(1));
    Wp.last = v;
  }
  css(Wp.el, 'filter', `url(#${Wp.id})`);
}

/* ---------- shockwave ring ---------- */

/** A ring that bursts out from a hit. `colour` is a hex token. */
export function makeRing(parent, colour) {
  const el = document.createElement('div');
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText = 'position:absolute;left:0;top:0;width:200px;height:200px;margin:-100px 0 0 -100px;border-radius:50%;' +
    `border:10px solid ${alpha(colour, 1)};pointer-events:none;visibility:hidden`;
  parent.appendChild(el);
  return el;
}
/** Out from (x, y) at t0, radius r0→r1 over `dur`, thinning and fading as it goes. */
export function ring(el, t, t0, { x = 540, y = 960, r0 = 20, r1 = 700, dur = 0.5, width = 14 } = {}) {
  const p = (t - t0) / dur;
  if (p < 0 || p >= 1) { opacity(el, 0); return; }
  const r = r0 + (r1 - r0) * (1 - (1 - p) ** 3);
  opacity(el, (1 - p) ** 1.5);
  xform(el, { x, y, s: r / 100 });
  // the border scales with the ring, so divide it back out to keep it in frame px
  css(el, 'border-width', `${(Math.max(1, width * (1 - p)) / (r / 100)).toFixed(2)}px`);
}

/* ---------- speed lines ---------- */

/**
 * Anime focus lines rushing to (cx, cy) in %: a hard-stopped conic gradient
 * with a clear disc in the middle, re-jittered at `hz`. `colour` is a hex token.
 */
export function makeSpeedLines(parent, colour, { cx = 50, cy = 45, clear = 30, spokes = 90 } = {}) {
  return { el: overlay(parent), colour: alpha(colour, 1), cx, cy, clear, step: 360 / spokes };
}
export function speedLines(S, amount, t, { hz = 12, seed = 7 } = {}) {
  opacity(S.el, clamp(amount));
  if (amount <= 0.001) return;
  const f = Math.floor(t * hz);
  const w = (S.step * (0.12 + 0.18 * amount)).toFixed(2);
  css(S.el, 'background', `repeating-conic-gradient(from ${(rand(seed, f) * S.step).toFixed(2)}deg at ${S.cx}% ${S.cy}%, ` +
    `${S.colour} 0deg ${w}deg, rgba(0,0,0,0) ${w}deg ${S.step.toFixed(3)}deg)`);
  const r = S.clear * (1.25 - 0.4 * amount);
  const mask = `radial-gradient(circle at ${S.cx}% ${S.cy}%, rgba(0,0,0,0) ${r.toFixed(1)}%, rgba(0,0,0,1) ${(r + 14).toFixed(1)}%)`;
  css(S.el, '-webkit-mask-image', mask);
  css(S.el, 'mask-image', mask);
}

/* ---------- sparks ---------- */

/**
 * n seeded particles, thrown from a point and pulled down by gravity. Their
 * paths are closed-form (p = v·s + ½·g·s²), so any frame is exact. `colour` is a hex token.
 */
export function makeSparks(parent, n, colour, { seed = 9, size = 10 } = {}) {
  const r = rng(seed);
  const list = Array.from({ length: n }, () => {
    const el = document.createElement('div');
    el.setAttribute('aria-hidden', 'true');
    const sz = size * (0.5 + r());
    el.style.cssText = `position:absolute;left:0;top:0;width:${sz * 3}px;height:${sz}px;margin:${-sz / 2}px 0 0 ${-sz * 1.5}px;` +
      `border-radius:${sz}px;background:${alpha(colour, 1)};box-shadow:0 0 ${sz * 1.5}px ${alpha(colour, 0.8)};pointer-events:none;visibility:hidden`;
    parent.appendChild(el);
    return { el, a: r(), v: r(), life: r() };
  });
  return { list };
}
export function sparks({ list }, t, t0, { x = 540, y = 960, dir = -90, spread = 140, speed = 1400, gravity = 2600, life = 0.75 } = {}) {
  const s = t - t0;
  for (const p of list) {
    const L = life * (0.55 + 0.45 * p.life);
    if (s < 0 || s >= L) { opacity(p.el, 0); continue; }
    const ang = ((dir + (p.a - 0.5) * spread) * Math.PI) / 180;
    const v = speed * (0.35 + 0.65 * p.v);
    const vx = Math.cos(ang) * v, vy = Math.sin(ang) * v + gravity * s;
    opacity(p.el, 1 - (s / L) ** 2);
    // each spark points along its own velocity, so it streaks instead of floating
    xform(p.el, {
      x: x + Math.cos(ang) * v * s,
      y: y + Math.sin(ang) * v * s + 0.5 * gravity * s * s,
      rot: (Math.atan2(vy, vx) * 180) / Math.PI,
      s: 1 - 0.6 * (s / L),
    });
  }
}

/* ---------- scanlines ---------- */

/**
 * CRT / VHS lines with a slow roll. Drive with scanlines(); 0.25–0.4 is enough.
 *
 * Export trap, found the slow way: a fine pattern UNDER a blended layer
 * (grain's overlay) stalls Chromium's software rasteriser, which the export
 * runs on, for minutes per frame. Make scanlines AFTER makeGrain() so they
 * sit on top of it. The strength is baked into the tile (eight levels) so the
 * layer is never a translucent group either.
 */
export function makeScanlines(parent, { gap = 4, levels = 8 } = {}) {
  const tiles = Array.from({ length: levels }, (_, i) => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = gap * 32;
    const g = c.getContext('2d');
    g.fillStyle = `rgba(0,0,0,${((i + 1) / levels).toFixed(3)})`;
    for (let y = 0; y < c.height; y += gap) g.fillRect(0, y, c.width, gap / 2);
    return c.toDataURL('image/png');
  });
  return { el: overlay(parent, `background-size:256px ${gap * 32}px`), tiles, gap };
}
export function scanlines(S, amount, t, { roll = 40 } = {}) {
  const i = Math.round(clamp(amount) * S.tiles.length) - 1;
  css(S.el, 'visibility', i < 0 ? 'hidden' : 'visible');
  if (i < 0) return;
  css(S.el, 'background-image', `url(${S.tiles[i]})`);
  css(S.el, 'background-position', `0 ${((t * roll) % (S.gap * 32)).toFixed(1)}px`);
}

/* ================================================================== */
/* Drivers: pure functions of t that say HOW MUCH, for any effect.     */
/* No DOM, so a film, a cue file and a node test can all call them.    */
/* ================================================================== */

/**
 * A pulse on every beat: 1 on the beat, decaying with time constant `decay`.
 * `every` 2 = every other beat, 0.5 = eighths. Nothing before `offset` (the
 * first downbeat, from the music's own grid).
 */
export function beatPulse(t, bpm, { offset = 0, decay = 0.12, every = 1 } = {}) {
  if (t < offset) return 0;
  const p = (60 / bpm) * every;
  return Math.exp(-(((t - offset) % p) / decay));
}

/**
 * A neon tube / failing bulb: mostly on with a faint hum, sometimes a dropout
 * or a double blink. Returns brightness 0…1; multiply an opacity or a glow by
 * it. Quantised to `hz`, seeded, so it blinks on the same frames every render.
 * `rate` is the chance of a dropout per frame (0.05 tired, 0.25 dying).
 */
export function flicker(t, { seed = 1, hz = 24, rate = 0.08, depth = 0.75, hum = 0.06 } = {}) {
  const f = Math.floor(t * hz);
  const r = rand(seed, f);
  if (r < rate) return 1 - depth * (0.6 + 0.4 * rand(seed + 1, f));
  // the frame after a dropout sometimes stays down: the double blink
  if (rand(seed, f - 1) < rate && rand(seed + 2, f) < 0.4) return 1 - depth * 0.5;
  return 1 - hum * (0.5 + 0.5 * noise(seed + 3, t * 9));
}

/**
 * Camera shake from several hits at once: { x, y, rot } to add to the world's
 * transform. Each hit is `impact()` on each axis with its own seed, so the
 * frame jolts diagonally and twists instead of sliding on one axis.
 * `amp` px, `rot` degrees, `decay` 1/s (7 = gone in ~0.5 s).
 */
export function shake(t, hits, { amp = 24, rot = 1.2, decay = 7, freq = 14, seed = 1 } = {}) {
  let x = 0, y = 0, r = 0;
  for (const h of hits) {
    if (t < h || t > h + 6 / decay) continue;
    x += impact(t, h, { amp, decay, freq, seed });
    y += impact(t, h, { amp: amp * 0.75, decay, freq: freq * 1.13, seed: seed + 1 });
    r += impact(t, h, { amp: rot, decay: decay * 0.8, freq: freq * 0.7, seed: seed + 2 });
  }
  return { x, y, rot: r };
}

/**
 * Hit-stop: the picture freezes for `hold` seconds at each `at`, then carries
 * on. Returns the SOURCE time to draw. The film runs longer by the sum of the
 * holds, so build the scene table on output time and feed this to the poses.
 *   const src = hitStop(t, [[2.0, 0.12], [3.4, 0.2]]);
 */
export function hitStop(t, stops) {
  let src = t;
  for (const [at, hold] of stops) if (t > at) src -= Math.min(t - at, hold);
  return src;
}

/**
 * Speed ramp: `keys` [[t, speed], …] in OUTPUT time, speed linear between
 * keys and held outside them (1 = real time, 0.25 = slow motion, 3 = rush).
 * Returns the source time, the exact integral of the speed curve, so slow
 * motion into a hit and a rush out of it never jumps a frame.
 */
export function speedRamp(t, keys) {
  if (!keys.length) return t;
  let src = 0, prevT = 0, prevV = keys[0][1];
  for (const [kt, kv] of keys) {
    if (t <= kt) {
      const v = prevT === kt ? kv : prevV + (kv - prevV) * ((t - prevT) / (kt - prevT));
      return src + ((prevV + v) / 2) * (t - prevT);
    }
    src += ((prevV + kv) / 2) * (kt - prevT);
    prevT = kt;
    prevV = kv;
  }
  return src + prevV * (t - prevT);
}

/* ---------- glow ---------- */

/**
 * Soft light around an element's own shape (text, an icon, a line): two
 * stacked drop-shadows in a brand colour. `px` 0 switches it off. Multiply
 * `px` by flicker(t) for neon. One filter per element: put a glow on a
 * wrapper if the element already has a split or a blur.
 */
export function glow(el, px, colour, { strength = 0.9 } = {}) {
  if (!el) return;
  if (px < 0.5) { css(el, 'filter', 'none'); return; }
  const c = alpha(colour, strength);
  css(el, 'filter', `drop-shadow(0 0 ${(px * 0.4).toFixed(1)}px ${c}) drop-shadow(0 0 ${px.toFixed(1)}px ${c})`);
}

/* ---------- block glitch ---------- */

/**
 * Rectangular blocks of `el` torn out and shoved sideways, re-rolled every
 * frame at `hz`: the compression-error look. Unlike slices() the original
 * stays, and the blocks are random in both size and place. `hue` tints
 * every third block by rotating its hue.
 */
export function makeBlockGlitch(el, n = 8) {
  const box = stackOf(el);
  const blocks = Array.from({ length: n }, () => {
    const c = el.cloneNode(true);
    c.setAttribute('aria-hidden', 'true');
    c.removeAttribute('id'); // a cloned id makes querySelector('#id') find the copy
    c.style.cssText += OVER;
    box.appendChild(c);
    return c;
  });
  return { el, blocks };
}
export function blockGlitch({ blocks }, amount, t, { hz = 24, seed = 11, reach = 90, hue = 150 } = {}) {
  const f = Math.floor(t * hz);
  blocks.forEach((c, i) => {
    if (amount <= 0.002 || rand(seed + f, i) > amount) { opacity(c, 0); return; }
    opacity(c, 1);
    const top = rand(seed + f, i + 40) * 90, h = 4 + rand(seed + f, i + 80) * 22;
    const left = rand(seed + f, i + 120) * 70, w = 15 + rand(seed + f, i + 160) * 50;
    css(c, 'clip-path', `inset(${top.toFixed(1)}% ${Math.max(0, 100 - left - w).toFixed(1)}% ${Math.max(0, 100 - top - h).toFixed(1)}% ${left.toFixed(1)}%)`);
    css(c, 'transform', `translate3d(${((rand(seed + f, i + 200) - 0.5) * 2 * reach * amount).toFixed(1)}px,0,0)`);
    css(c, 'filter', hue && i % 3 === 0 ? `hue-rotate(${hue}deg) saturate(1.6)` : 'none');
  });
}

/* ---------- afterimage trail ---------- */

/**
 * Filled afterimages of a moving element: copy i is drawn where the element
 * WAS i·dt seconds ago. Because the pose is a function of time, the trail is
 * exact on every frame and vanishes by itself when the thing stops.
 *   const T = makeTrail(ball, 6);
 *   trail(T, t, (s) => ({ x: xFn(s), y: yFn(s), s: 1, rot: 0 }));
 * trail() places the element too: do not also xform() it.
 */
export function makeTrail(el, n = 5) {
  const box = stackOf(el);
  const ghosts = Array.from({ length: n }, () => {
    const c = el.cloneNode(true);
    c.setAttribute('aria-hidden', 'true');
    c.removeAttribute('id'); // a cloned id makes querySelector('#id') find the copy
    c.style.cssText += OVER;
    box.insertBefore(c, el);
    return c;
  });
  return { el, ghosts };
}
export function trail({ el, ghosts }, t, pose, { dt = 1 / 30, fade = 0.5 } = {}) {
  xform(el, pose(t));
  ghosts.forEach((c, i) => {
    opacity(c, fade * (1 - i / ghosts.length));
    xform(c, pose(t - (i + 1) * dt));
  });
}

/* ---------- shine ---------- */

/**
 * A bright band sweeping across text (`kind: 'text'`, clipped to the glyphs)
 * or across a card or product shot (`kind: 'box'`, clipped to the box; the
 * box needs position:relative and overflow:hidden). Drive p 0→1 over 0.5–0.9 s.
 */
export function makeShine(el, { kind = 'text', angle = 110, width = 12, strength = 0.85 } = {}) {
  const band = `linear-gradient(${angle}deg, rgba(255,255,255,0) ${50 - width}%, rgba(255,255,255,${strength}) 50%, rgba(255,255,255,0) ${50 + width}%)`;
  let s;
  if (kind === 'text') {
    s = el.cloneNode(true);
    s.setAttribute('aria-hidden', 'true');
    s.removeAttribute('id'); // a cloned id makes querySelector('#id') find the copy
    s.style.cssText += `${OVER};color:rgba(0,0,0,0);-webkit-text-fill-color:rgba(0,0,0,0);background:${band};` +
      'background-size:300% 100%;-webkit-background-clip:text;background-clip:text';
    stackOf(el).appendChild(s);
  } else {
    s = document.createElement('div');
    s.setAttribute('aria-hidden', 'true');
    s.style.cssText = `position:absolute;inset:0;pointer-events:none;background:${band};background-size:300% 100%;mix-blend-mode:screen`;
    el.appendChild(s);
  }
  return s;
}
export function shine(s, p) {
  const on = p > 0 && p < 1;
  opacity(s, on ? 1 : 0);
  if (on) css(s, 'background-position', `${(100 - 100 * p).toFixed(2)}% 0`);
}

/* ---------- goo ---------- */

/**
 * The metaball filter: blur, then a hard alpha threshold, so shapes inside
 * the element melt into each other where they touch. Put it on a container
 * of blobs (circles in brand colours) and move the blobs; the container
 * needs no background. Returns the `filter` value.
 */
export function makeGoo(id, { blur = 16, contrast = 22 } = {}) {
  const f = svgEl('filter', { id, ...WIDE }, svgDefs());
  svgEl('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: `${blur}`, result: 'b' }, f);
  svgEl('feColorMatrix', { in: 'b', type: 'matrix', values: `1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${contrast} ${-contrast / 2}`, result: 'g' }, f);
  svgEl('feComposite', { in: 'SourceGraphic', in2: 'g', operator: 'atop' }, f);
  return `url(#${id})`;
}

/* ---------- dust and bokeh ---------- */

/**
 * Floating motes: seeded positions, each rising at its own depth-scaled
 * speed and swaying on noise, wrapping top to bottom, so the field is
 * endless and exact at any t. Small and sharp = dust in a light beam; large
 * with `blur` = bokeh. `colour` is a hex token.
 */
export function makeDust(parent, n, colour, { seed = 21, size = [3, 10], blur = 0, W = 1080, H = 1920 } = {}) {
  const r = rng(seed);
  const el = overlay(parent);
  const motes = Array.from({ length: n }, () => {
    const d = document.createElement('div');
    const z = r();
    const sz = size[0] + (size[1] - size[0]) * z;
    d.style.cssText = `position:absolute;left:0;top:0;width:${sz}px;height:${sz}px;margin:${-sz / 2}px 0 0 ${-sz / 2}px;border-radius:50%;` +
      `background:${alpha(colour, 0.4 + 0.6 * z)};${blur ? `filter:blur(${(blur * z).toFixed(1)}px);` : ''}`;
    el.appendChild(d);
    return { d, x: r() * W, y: r() * H, z, ph: r() * 100 };
  });
  return { el, motes, W, H, seed };
}
export function dust(D, t, amount, { rise = 40, sway = 26 } = {}) {
  opacity(D.el, amount);
  if (amount <= 0.001) return;
  const span = D.H + 120;
  D.motes.forEach((m, i) => {
    const y = ((((m.y - rise * (0.3 + m.z) * t) % span) + span) % span) - 60;
    xform(m.d, { x: m.x + sway * (0.4 + m.z) * noise(D.seed + i, t * 0.25 + m.ph), y });
  });
}

/* ---------- spotlight and iris ---------- */

/**
 * Darkness with a soft round hole at (x, y) of radius r: a spotlight that
 * follows the subject, or, with r → 0, the classic iris out to black.
 */
export function makeSpotlight(parent, { dark = 0.9, soft = 90 } = {}) {
  return { el: overlay(parent), dark, soft };
}
export function spotlight(S, x, y, r, amount = 1) {
  opacity(S.el, amount);
  if (amount <= 0.001) return;
  if (r <= 1) { css(S.el, 'background', `rgba(0,0,0,${S.dark})`); return; }
  css(S.el, 'background', `radial-gradient(circle ${r.toFixed(1)}px at ${x.toFixed(1)}px ${y.toFixed(1)}px, ` +
    `rgba(0,0,0,0) ${Math.max(0, r - S.soft).toFixed(1)}px, rgba(0,0,0,${S.dark}) ${r.toFixed(1)}px)`);
}

/* ---------- letterbox ---------- */

/**
 * Black bars that close in to a wider aspect `ratio` (2.39 scope, 1.85 flat):
 * the "this is the cinematic bit" signal. p 0…1 slides them in.
 */
export function makeLetterbox(parent, { W = 1080, H = 1920 } = {}) {
  const bar = (edge) => {
    const b = document.createElement('div');
    b.setAttribute('aria-hidden', 'true');
    b.style.cssText = `position:absolute;left:0;right:0;${edge}:0;height:0;background:rgba(0,0,0,1);pointer-events:none`;
    parent.appendChild(b);
    return b;
  };
  return { top: bar('top'), bottom: bar('bottom'), W, H };
}
export function letterbox(L, p, { ratio = 2.39 } = {}) {
  const hgt = Math.max(0, (L.H - L.W / ratio) / 2) * clamp(p);
  css(L.top, 'height', `${hgt.toFixed(1)}px`);
  css(L.bottom, 'height', `${hgt.toFixed(1)}px`);
}

/* ---------- halftone ---------- */

/**
 * Print / comic dots over the frame, on the classic 45° screen. Drive with
 * halftone(); 0.3–0.6.
 *
 * Built like makeScanlines and for the same reason: a translucent or blended
 * pattern stalls the exporter's software rasteriser for minutes a frame. So:
 * no blend mode, no layer opacity, no rotated layer. The strength is baked
 * into the dots' alpha (eight levels), the 45° lattice is drawn straight into
 * the tile (a dot in each corner and one in the middle), and it is created
 * after makeGrain() so it sits on top.
 */
export function makeHalftone(parent, { size = 14, dot = 0.42, levels = 8 } = {}) {
  const cell = Math.round(size * Math.SQRT2);
  const r = size * dot;
  const tiles = Array.from({ length: levels }, (_, i) => {
    const c = document.createElement('canvas');
    c.width = c.height = cell * 8;
    const g = c.getContext('2d');
    g.fillStyle = `rgba(0,0,0,${((i + 1) / levels).toFixed(3)})`;
    for (let y = 0; y <= 8; y++) {
      for (let x = 0; x <= 8; x++) {
        for (const [ox, oy] of [[0, 0], [0.5, 0.5]]) {
          g.beginPath();
          g.arc((x + ox) * cell, (y + oy) * cell, r, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    return c.toDataURL('image/png');
  });
  return { el: overlay(parent, `background-size:${cell * 8}px ${cell * 8}px`), tiles };
}
export function halftone(H, amount) {
  const i = Math.round(clamp(amount) * H.tiles.length) - 1;
  css(H.el, 'visibility', i < 0 ? 'hidden' : 'visible');
  if (i >= 0) css(H.el, 'background-image', `url(${H.tiles[i]})`);
}
