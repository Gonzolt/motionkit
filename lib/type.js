/* Kinetic type.
 *
 * Text is split into words and characters once, then every character is a
 * plain element driven from `t`. The moves below are the ones that carry most
 * motion-design type; combine them, do not stack all of them.
 *
 *   charIn / charOut   per-character entrance/exit with stagger. Presets via
 *                      `from`: rise (masked), drop, blurIn, spin, scatter.
 *   squashStretch      a word that lands stretched and relaxes with a spring.
 *   typewriter         characters appear at a rate, with a caret.
 *   scramble           characters resolve out of noise, left to right.
 *
 * Directional blur and echoes are in fx.js; combine them with these.
 */

import { css, opacity, clamp, lerp } from './anim.js';
import { E, go, spring, rand, win } from './motion.js';

/**
 * Fill `el` with words made of characters.
 *   mask: wrap every word in an overflow:hidden box so characters can rise out
 *         of an invisible floor — the signature "text appears from a line".
 * Returns { words: [el], chars: [el] }, in reading order.
 */
export function splitText(el, str, { mask = false } = {}) {
  el.textContent = '';
  const words = [], chars = [];
  const parts = str.split(/(\s+)/);
  for (const part of parts) {
    if (!part) continue;
    if (/^\s+$/.test(part)) {
      el.appendChild(document.createTextNode(' '));
      continue;
    }
    const w = document.createElement('span');
    // Clipping a word to its line box cuts descenders and tall accents, so the
    // mask gets padding the layout then takes back with a negative margin.
    w.style.cssText = 'display:inline-block;white-space:nowrap;' +
      (mask ? 'overflow:hidden;padding:0.14em 0.04em;margin:-0.14em -0.04em;vertical-align:top' : '');
    // Named, so tools/framelint.mjs knows this clip is a reveal and not a layout bug.
    if (mask) w.dataset.mask = '';
    for (const ch of part) {
      const c = document.createElement('span');
      c.textContent = ch;
      c.style.cssText = 'display:inline-block;will-change:transform';
      w.appendChild(c);
      chars.push(c);
    }
    el.appendChild(w);
    words.push(w);
  }
  return { words, chars };
}

/* ---------- per-character in / out ---------- */

const ORDER = {
  lr: (i) => i,
  rl: (i, n) => n - 1 - i,
  center: (i, n) => Math.abs(i - (n - 1) / 2) * 2,
  edges: (i, n) => (n - 1) - Math.abs(i - (n - 1) / 2) * 2,
  random: (i, n, seed) => rand(seed, i) * n,
};

function writeChar(c, p, from, out) {
  // p: 1 = resting. Everything interpolates between `from` and rest.
  const k = 1 - p;
  const x = (from.x ?? 0) * k, y = (from.y ?? 0) * k;
  const rot = (from.rot ?? 0) * k;
  const s = lerp(from.s ?? 1, 1, p);
  css(c, 'transform', `translate3d(${x.toFixed(3)}em,${y.toFixed(3)}em,0) rotate(${rot.toFixed(2)}deg) scale(${s.toFixed(4)})`);
  const blur = (from.blur ?? 0) * k;
  css(c, 'filter', blur > 0.15 ? `blur(${blur.toFixed(2)}px)` : 'none');
  if (from.op !== undefined) opacity(c, lerp(from.op, 1, clamp(p * 1.6)));
}

/**
 * Presets:
 *   rise:    { y: 1.15 }                       (use with splitText({mask:true}))
 *   drop:    { y: -0.9, op: 0 }
 *   blurIn:  { y: 0.25, blur: 14, op: 0 }
 *   spin:    { rot: -80, y: 0.5, s: 0.6, op: 0 }
 *   scatter: set `scatter: n` for seeded random x/y/rot of size n.
 *
 * `each` is the stagger, `dur` each character's own travel. A line of 12
 * characters at each .03 s, dur .6 s takes 0.93 s in total.
 */
export function charIn(chars, t, { start = 0, each = 0.03, dur = 0.7, ease = E.outExpo,
  from = { y: 1.15 }, order = 'lr', seed = 1, scatter = 0, out = false } = {}) {
  const n = chars.length;
  const idx = ORDER[order] ?? ORDER.lr;
  chars.forEach((c, i) => {
    const a = start + idx(i, n, seed) * each;
    let p = ease(go(t, a, a + dur, (x) => x));
    p = out ? 1 - p : p;
    const f = scatter
      ? { ...from, x: (rand(seed, i) - 0.5) * scatter, y: (rand(seed + 9, i) - 0.5) * scatter,
          rot: (rand(seed + 3, i) - 0.5) * 60 }
      : from;
    writeChar(c, p, f);
  });
}

export const charOut = (chars, t, o = {}) => charIn(chars, t, { ease: E.inExpo, dur: 0.45, each: 0.02, ...o, out: true });

/* ---------- squash & stretch ---------- */

/**
 * A body that arrives stretched and relaxes through a spring, keeping its
 * volume (sy = 1 / sx). `axis: 'x'` is a horizontal stretch (a word smeared
 * along its reading direction); 'y' is a tall squeeze. Returns { sx, sy } for
 * the caller to apply, because where the origin sits (baseline? centre?) is a
 * layout decision, not an animation one.
 *
 *   amount  0.35 = 35 % longer at the first frame
 *   bounce  0.35 gives one visible overshoot; 0 just eases in.
 */
export function squashStretch(t, start, { amount = 0.35, duration = 0.5, bounce = 0.35, axis = 'x' } = {}) {
  const s = 1 + amount * (1 - spring(t - start, { duration, bounce }));
  const a = t < start ? 1 + amount : s;
  return axis === 'x' ? { sx: a, sy: 1 / a } : { sx: 1 / a, sy: a };
}

/* ---------- typewriter / scramble ---------- */

export function typewriter(el, str, t, { start = 0, cps = 22, caret = true } = {}) {
  const n = clamp(Math.floor((t - start) * cps), 0, str.length);
  const shown = str.slice(0, n);
  let c = el._pkCaret;
  if (!el._pkText) {
    el.textContent = '';
    el._pkText = document.createTextNode('');
    el.appendChild(el._pkText);
    if (caret) {
      c = el._pkCaret = document.createElement('span');
      c.style.cssText = 'display:inline-block;width:0.07em;height:0.85em;margin-left:0.08em;' +
        'background:currentColor;vertical-align:-0.08em';
      el.appendChild(c);
    }
  }
  if (el._pkText.data !== shown) el._pkText.data = shown;
  if (c) {
    // Solid while typing, blinks when idle — a caret that blinks mid-word
    // looks like a bug.
    const typing = n < str.length && t >= start;
    opacity(c, t < start ? 0 : typing || Math.floor((t - start) * 2.2) % 2 === 0 ? 1 : 0);
  }
  return n / str.length;
}

const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*+<>/';

export function scramble(el, str, t, { start = 0, dur = 0.8, seed = 2, hz = 30 } = {}) {
  const p = clamp((t - start) / dur);
  const f = Math.floor(t * hz);
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === ' ') { out += ' '; continue; }
    // Left to right resolve, each character settling at its own moment.
    const settle = (i + 1) / str.length;
    out += p >= settle || t < start ? (t < start ? '' : ch) : CHARSET[Math.floor(rand(seed + f, i) * CHARSET.length)];
  }
  if (el._pkScr !== out) { el.textContent = out; el._pkScr = out; }
  return p;
}

/* ---------- counters ---------- */

export const fmtInt = (n) => Math.round(n).toLocaleString('en-US');

/** 51 713 500 → "51.7M", 3 400 → "3.4K", below 1000 as is. */
export const fmtShort = (n) => {
  const a = Math.abs(n);
  if (a >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (a >= 1e4) return `${(n / 1e3).toFixed(1)}K`;
  return fmtInt(n);
};

/**
 * A number that counts from `from` to `to` between a and b. Set it in a
 * monospace face: proportional digits make the whole figure jitter sideways
 * as it counts, which looks like a bug and is not fixable from here.
 * Returns the progress 0…1 so a bar or a glow can follow it.
 */
export function countTo(el, t, a, b, to, { from = 0, ease = E.outExpo, fmt = fmtInt } = {}) {
  const p = ease(win(t, a, b));
  const s = fmt(from + (to - from) * p);
  if (el._pkCount !== s) { el.textContent = s; el._pkCount = s; }
  return p;
}
