/* Promo pieces for social posts: product photos, badges, price tags, stars,
 * lower thirds, stickers and the end card, plus the platform safe zones,
 * feed crops and the variant switch that hook and ad tests run on.
 *
 * Brand-neutral like the rest of lib/: every colour and type style comes in
 * as a string from the brand's theme (`C.signal`, `typo('big')`). Every piece
 * is built once and set from `t`. The how-to is the social-promo skill; the
 * worked example is lab/promo.
 */

import { alpha, css, opacity, xform, clamp, lerp } from './anim.js';
import { E, go, spring } from './motion.js';
import { h } from './dom.js';

/* ---------- where things may go ---------- */

/**
 * Clear areas on a 1080x1920 frame, from the platforms' AD specs (stricter
 * than organic posts, because the ad UI adds a CTA button). Sources disagree
 * by tens of px and apps change: preview the real upload before trusting a
 * pixel. `all` is the area clear on every one of them: design to it when one
 * film goes everywhere.
 */
export const SAFE = {
  tiktok: { top: 240, bottom: 1260, left: 120, right: 960, rail: { x: 840, y: 840 } },   // + like rail below y 840
  reels: { top: 270, bottom: 1250, left: 65, right: 960 },
  shorts: { top: 288, bottom: 1248, left: 48, right: 888 },
  all: { top: 288, bottom: 1248, left: 120, right: 888 },
};

/**
 * Centre crops of the 9:16 master for feed placements. Design the film with
 * its key content inside `feed45` and one export serves Reels, the 4:5 feed
 * and the 1:1 feed: `ffmpeg -i in.mp4 -vf crop=1080:1350:0:285 out-4x5.mp4`.
 * 16:9 cannot be cropped out of 9:16: it is a separate layout.
 */
export const CROPS = {
  feed45: { w: 1080, h: 1350, y: 285 },
  square: { w: 1080, h: 1080, y: 420 },
};

/**
 * Review overlay: the `all` safe box (solid) and the feed crops (dashed).
 * Shown only with ?guides in the URL, never in an export unless asked for.
 */
export function makeGuides(stage) {
  if (!new URLSearchParams(location.search).has('guides')) return null;
  const s = SAFE.all;
  const box = (style) => stage.appendChild(h('div', { style: `position:absolute;pointer-events:none;z-index:2147483646;${style}` }));
  box(`left:${s.left}px;top:${s.top}px;width:${s.right - s.left}px;height:${s.bottom - s.top}px;outline:3px solid rgba(255,255,255,0.85)`);
  for (const c of Object.values(CROPS)) box(`left:0;top:${c.y}px;width:${c.w}px;height:${c.h}px;outline:3px dashed rgba(255,255,255,0.5)`);
  return true;
}

/* ---------- variants ---------- */

/**
 * Which hook, message and CTA this render is: ?v=H2-M1-C2 in the URL
 * (tools/variants.mjs sets it), else the first of each in the brief.
 * Returns the brief's own entries, so a film reads `V.hook.onscreen`.
 */
export function variant(brief) {
  const want = (new URLSearchParams(location.search).get('v') ?? '').split('-');
  const pick = (list, prefix) => {
    const id = want.find((x) => x.startsWith(prefix));
    const hit = list.find((x) => x.id === id);
    if (id && !hit) throw new Error(`variant ${id} is not in the brief (have ${list.map((x) => x.id).join(', ')})`);
    return hit ?? list[0];
  };
  const hook = pick(brief.hooks, 'H'), message = pick(brief.messages, 'M'), cta = pick(brief.ctas, 'C');
  return { hook, message, cta, id: `${hook.id}-${message.id}-${cta.id}` };
}

/**
 * The variant ids a test renders. Default is a hook test (every hook, first
 * message and CTA); `matrix` is every combination; `only` a comma list.
 */
export function variantIds(b, { matrix = false, only = null } = {}) {
  if (only) return only.split(',').map((s) => s.trim()).filter(Boolean);
  const [m0, c0] = [b.messages[0].id, b.ctas[0].id];
  if (!matrix) return b.hooks.map((x) => `${x.id}-${m0}-${c0}`);
  const ids = [];
  for (const hk of b.hooks) for (const m of b.messages) for (const c of b.ctas) ids.push(`${hk.id}-${m.id}-${c.id}`);
  return ids;
}

/** The brief, fetched relative to the film page. Top-level await it in the film. */
export const loadBrief = async (path) => (await fetch(path)).json();

/* ---------- product photo ---------- */

/**
 * A photo (product shot, screenshot, lifestyle still) in a box that clips it.
 * `fit` cover fills the box, contain shows all of it. Returns the box; move
 * the picture inside with kenBurns().
 */
export function makePhoto(parent, src, { x = 90, y = 400, w = 900, hgt = 900, radius = 36, fit = 'cover', bg = 'rgba(0,0,0,0)' } = {}) {
  const box = h('div', { style: `position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${hgt}px;border-radius:${radius}px;overflow:hidden;background:${bg}` });
  const img = h('img', { src, alt: '', style: `position:absolute;inset:0;width:100%;height:100%;object-fit:${fit};transform-origin:50% 50%` });
  box.appendChild(img);
  parent.appendChild(box);
  box.img = img;
  return box;
}

/**
 * The slow push that makes a still feel filmed: scale and drift from `from`
 * to `to` across p 0→1 (use the scene's whole length, linear or E.inOut).
 * 1.0 → 1.12 over 3–4 s is felt, not seen. Never zoom out past 1 (edges show).
 */
export function kenBurns(box, p, { from = { s: 1.0, x: 0, y: 0 }, to = { s: 1.12, x: -20, y: -30 } } = {}) {
  xform(box.img, { s: Math.max(1, lerp(from.s, to.s, p)), x: lerp(from.x, to.x, p), y: lerp(from.y, to.y, p) });
}

/* ---------- badge ---------- */

const BURST = (() => {
  const pts = [];
  for (let i = 0; i < 24; i++) {
    const r = i % 2 ? 41 : 50, a = (i / 24) * Math.PI * 2;
    pts.push(`${(50 + r * Math.cos(a)).toFixed(2)}% ${(50 + r * Math.sin(a)).toFixed(2)}%`);
  }
  return `polygon(${pts.join(',')})`;
})();

/**
 * "NEW", "-30%", "FREE": a round, pill or starburst badge. `type` is the
 * label's type style (font, size, weight) from the theme.
 */
export function makeBadge(parent, label, { x = 820, y = 420, size = 240, shape = 'burst', bg, fg, type = '' } = {}) {
  const pill = shape === 'pill';
  const el = h('div', {
    style: `position:absolute;left:${x}px;top:${y}px;translate:-50% -50%;display:grid;place-items:center;visibility:hidden;` +
      `${pill ? `padding:18px 40px;border-radius:999px;` : `width:${size}px;height:${size}px;`}` +
      `${shape === 'burst' ? `clip-path:${BURST};` : shape === 'circle' ? 'border-radius:50%;' : ''}` +
      `background:${alpha(bg, 1)};color:${alpha(fg, 1)};text-align:center;white-space:nowrap;${type}`,
  }, label);
  parent.appendChild(el);
  return el;
}
/** Slaps on at t0 with an overshoot and a tilt, then wobbles a little forever. */
export function badge(el, t, t0, { tilt = -10, hide = false } = {}) {
  const s = t - t0;
  if (hide || s < 0) { opacity(el, 0); return; }
  opacity(el, 1);
  xform(el, { s: 1.6 - 0.6 * spring(s, { duration: 0.4, bounce: 0.45 }), rot: tilt + 3 * Math.sin(s * 2.4) });
}

/* ---------- price tag ---------- */

/**
 * Old price struck through, new price landing. `was` may be null. Styles
 * from the theme: `type` for the new price, `small` for the old one.
 */
export function makePrice(parent, { now, was = null, x = 540, y = 1100, type = '', small = '', colour, strike }) {
  const row = h('div', { style: `position:absolute;left:0;right:0;top:${y}px;translate:0 -50%;text-align:center;white-space:nowrap` });
  let wasEl = null, line = null;
  if (was) {
    wasEl = h('span', { style: `position:relative;display:inline-block;margin-right:28px;vertical-align:middle;${small};color:${alpha(colour, 0.6)}` }, was);
    line = h('i', { style: `position:absolute;left:-6%;top:52%;width:112%;height:8px;border-radius:4px;background:${alpha(strike, 1)};transform-origin:0 50%;transform:scaleX(0)` });
    wasEl.appendChild(line);
    row.appendChild(wasEl);
  }
  const nowEl = h('span', { style: `display:inline-block;vertical-align:middle;${type};color:${alpha(colour, 1)}` }, now);
  row.appendChild(nowEl);
  parent.appendChild(row);
  return { row, wasEl, line, nowEl };
}
/** The old price shows, gets struck at t0, the new one lands 0.25 s later. */
export function price(P, t, t0) {
  opacity(P.row, go(t, t0 - 0.4, t0 - 0.15, E.out));
  if (P.line) css(P.line, 'transform', `scaleX(${go(t, t0, t0 + 0.22, E.outExpo).toFixed(4)})`);
  const s = t - (t0 + (P.line ? 0.25 : 0));
  opacity(P.nowEl, s >= 0 ? 1 : 0);
  xform(P.nowEl, { s: s >= 0 ? 1.4 - 0.4 * spring(s, { duration: 0.4, bounce: 0.4 }) : 1 });
}

/* ---------- stars ---------- */

/** A rating row; `rating` may be fractional (4.6 fills 60% of the fifth star). */
export function makeStars(parent, rating, { n = 5, x = 540, y = 1000, size = 96, colour, empty = 'rgba(255,255,255,0.18)' } = {}) {
  const row = h('div', { style: `position:absolute;left:${x}px;top:${y}px;translate:-50% -50%;display:flex;gap:${size * 0.15}px` });
  const star = 'polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)';
  const stars = Array.from({ length: n }, (_, i) => {
    const cell = h('div', { style: `position:relative;width:${size}px;height:${size}px;clip-path:${star};background:${empty}` });
    const fill = clamp(rating - i);
    cell.appendChild(h('div', { style: `position:absolute;inset:0;width:${(fill * 100).toFixed(1)}%;background:${alpha(colour, 1)}` }));
    row.appendChild(cell);
    return cell;
  });
  parent.appendChild(row);
  return { row, stars };
}
export function stars(S, t, t0, { each = 0.08 } = {}) {
  S.stars.forEach((c, i) => {
    const s = t - t0 - i * each;
    opacity(c, s >= 0 ? 1 : 0);
    xform(c, { s: s >= 0 ? spring(s, { duration: 0.35, bounce: 0.5 }) : 0.001 });
  });
}

/* ---------- lower third ---------- */

/** Name / title strap. `bar` is a hex token; `type`, `small` theme styles. */
export function makeLowerThird(parent, title, sub, { x = 120, y = 1060, bar, type = '', small = '' } = {}) {
  const box = h('div', { style: `position:absolute;left:${x}px;top:${y}px;visibility:hidden` });
  const strip = h('div', { style: `position:absolute;left:-24px;top:0;bottom:0;width:10px;background:${alpha(bar, 1)};transform-origin:50% 0` });
  const a = h('div', { style: `overflow:hidden` }, h('div', { style: type }, title));
  const b = h('div', { style: `overflow:hidden;margin-top:8px` }, h('div', { style: small }, sub));
  box.append(strip, a, b);
  parent.appendChild(box);
  return { box, strip, a: a.firstChild, b: b.firstChild };
}
/** In at t0 (bar grows, lines rise out of their masks), out by t1. */
export function lowerThird(L, t, t0, t1) {
  const on = t >= t0 && t < t1;
  css(L.box, 'visibility', on ? 'visible' : 'hidden');
  if (!on) return;
  const out = go(t, t1 - 0.3, t1, E.in);
  css(L.strip, 'transform', `scaleY(${(go(t, t0, t0 + 0.3, E.outExpo) * (1 - out)).toFixed(4)})`);
  xform(L.a, { y: 110 * (1 - go(t, t0 + 0.08, t0 + 0.5, E.outExpo)) + 110 * out });
  xform(L.b, { y: 80 * (1 - go(t, t0 + 0.16, t0 + 0.58, E.outExpo)) + 80 * out });
}

/* ---------- sticker ---------- */

/** "LINK IN BIO ↓", "SWIPE →": a tilted sticker that pops and keeps nudging. */
export function makeSticker(parent, label, { x = 540, y = 1180, bg, fg, type = '', tilt = -4 } = {}) {
  const el = h('div', {
    style: `position:absolute;left:${x}px;top:${y}px;translate:-50% -50%;padding:20px 36px;border-radius:22px;white-space:nowrap;visibility:hidden;` +
      `background:${alpha(bg, 1)};color:${alpha(fg, 1)};box-shadow:0 10px 0 rgba(0,0,0,0.35);${type}`,
  }, label);
  parent.appendChild(el);
  el.tilt = tilt;
  return el;
}
export function sticker(el, t, t0, { hide = false } = {}) {
  const s = t - t0;
  if (hide || s < 0) { opacity(el, 0); return; }
  opacity(el, 1);
  // a nudge every 1.2 s: enough to catch the eye on the end card, not a strobe
  const nudge = Math.exp(-((s % 1.2) / 0.18)) * (s > 0.6 ? 1 : 0);
  xform(el, { s: spring(s, { duration: 0.4, bounce: 0.5 }) * (1 + 0.06 * nudge), rot: el.tilt + 4 * nudge });
}

/* ---------- end card ---------- */

/**
 * The last 2–3 s: logo, one line, the action, the handle. `logo` is an
 * element the film built (a mark, an <img>); styles come from the theme.
 *   button: the CTA pill's background token; buttonFg its text token.
 */
export function makeEndCard(parent, { logo = null, headline, cta, handle, type = '', ctaType = '', small = '', button, buttonFg, colour, top = 520 }) {
  const card = h('div', { style: 'position:absolute;inset:0;visibility:hidden' });
  const col = h('div', { style: `position:absolute;left:120px;right:192px;top:${top}px;display:flex;flex-direction:column;align-items:center;gap:44px;text-align:center` });
  if (logo) col.appendChild(logo);
  const head = h('div', { style: `${type};color:${alpha(colour, 1)}` }, headline);
  const btn = h('div', { style: `padding:28px 56px;border-radius:999px;background:${alpha(button, 1)};color:${alpha(buttonFg, 1)};white-space:nowrap;${ctaType}` }, cta);
  const hand = h('div', { style: `${small};color:${alpha(colour, 0.75)}` }, handle);
  col.append(head, btn, hand);
  card.appendChild(col);
  parent.appendChild(card);
  return { card, logo, head, btn, hand };
}
/** Builds in over ~0.8 s from t0; the button breathes so the eye ends on it. */
export function endCard(K, t, t0) {
  const on = t >= t0;
  css(K.card, 'visibility', on ? 'visible' : 'hidden');
  if (!on) return;
  const s = t - t0;
  if (K.logo) xform(K.logo, { s: spring(s, { duration: 0.45, bounce: 0.35 }) });
  opacity(K.head, go(t, t0 + 0.15, t0 + 0.45, E.out));
  xform(K.head, { y: 40 * (1 - go(t, t0 + 0.15, t0 + 0.55, E.outExpo)) });
  const b = t - t0 - 0.4;
  opacity(K.btn, b >= 0 ? 1 : 0);
  xform(K.btn, { s: b >= 0 ? spring(b, { duration: 0.4, bounce: 0.4 }) * (1 + 0.03 * Math.sin(b * 4.2)) : 0.001 });
  opacity(K.hand, go(t, t0 + 0.65, t0 + 0.95, E.out));
}
