/* frag — the pieces of a gaming "edit" (Valorant / FPS TikTok montage) that
 * lib/fx.js does not already have. Read with the frag-edit skill.
 *
 * Measured from six reference edits, not invented: one lyric word at a time
 * in the middle of the frame, a word that builds by syllable (REA → READY)
 * with a small script word hung on it, the word sitting BEHIND the gun, a
 * marker scribble that swaps one word for the next, a social card that pops in
 * holding the next shot and then swallows the frame, a burst of the same move
 * from many rounds a few frames each, and coloured ink creeping in from the
 * edges on a kill.
 *
 * Same rules as fx.js: everything is set from t, random things are seeded,
 * colours come from the caller (a brand's theme.js), this file names none.
 *
 *   wordAt / grow / stutter / segAt / polyAt     pure, node-testable (tests/frag.test.mjs)
 *   makeLyric → lyric                            the centre word: pop, hot colour, ghost, accent
 *   makeScribble → scribble                      marker strike over a word
 *   makeCard → card                              post / phone card portal into the next shot
 *   clipTo                                       the top slice of a "text behind the gun" sandwich
 *   makeEdgeInk → edgeInk                        boiling colour at the frame edges, no SVG filter
 */

import { opacity, css, xform, text, clamp, lerp, alpha } from './anim.js';
import { E, go, spring, rand } from './motion.js';
import { h } from './dom.js';

/* ---------- lyrics: which word, how much of it ---------- */

/**
 * The lyric word on screen at t. `words` is transcribe.py's shape,
 * [{w, s, e}], sorted by s; a word may carry `accent` (the small script word).
 * A word holds until the next one starts or `hold` s after it ends, whichever
 * comes first. `lead` shows every word that much early (picture before sound
 * reads as in sync; one frame is plenty).
 * Returns {i, text, t0, age, accent} or null.
 */
export function wordAt(words, t, { hold = 0.5, lead = 0 } = {}) {
  let i = -1;
  while (i + 1 < words.length && t >= words[i + 1].s - lead) i++;
  if (i < 0) return null;
  const w = words[i];
  const next = words[i + 1];
  const off = Math.min(next ? next.s - lead : Infinity, (w.e ?? w.s) + hold);
  if (t >= off) return null;
  const t0 = w.s - lead;
  return { i, text: w.w, t0, age: t - t0, accent: w.accent ?? null };
}

/**
 * A word that builds by syllable: grow(['REA', 'DY'], [t0, t1], t) is '' before
 * t0, 'REA' until t1, then 'READY'. One time per part, ascending.
 */
export function grow(parts, times, t) {
  let s = '';
  for (let i = 0; i < parts.length && t >= times[i]; i++) s += parts[i];
  return s;
}

/* ---------- the repetition burst ---------- */

/**
 * The same move from many rounds, `each` s apiece, back to back from `t0`.
 * `moments` are [{clip, src}] where src is the source time of the move (the
 * ability cast, the flick); `pre` starts every shot that much before it, so the
 * move lands at the same point in each shot and the burst reads as one rhythm.
 * Pick `each` from the grid: a beat, half a beat, or 3 frames for a strobe.
 */
export function stutter(moments, { t0, each = 0.1, pre = 0.05 } = {}) {
  return moments.map((m, i) => ({ ...m, t0: t0 + i * each, t1: t0 + (i + 1) * each, from: m.src - pre }));
}

/** The burst segment under t: {seg, local, src} (src = source time to show), or null. */
export function segAt(segs, t) {
  for (const seg of segs) {
    if (t >= seg.t0 && t < seg.t1) {
      const local = t - seg.t0;
      return { seg, local, src: seg.from + local * (seg.rate ?? 1) };
    }
  }
  return null;
}

/* ---------- text behind the gun ----------
 *
 * Three layers: the shot, the word, and the SAME shot again clipped to the
 * thing in front (viewmodel, knife, agent). An FPS viewmodel lives in a known
 * corner, so a polygon keyed every few frames is usually enough; no matte.
 */

/**
 * Polygon at t from keys [[t, [[x, y], …]], …] (x, y in % of the frame), linear
 * between keys, held outside them. Every key needs the same number of points.
 */
export function polyAt(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  const last = keys[keys.length - 1];
  if (t >= last[0]) return last[1];
  let i = 1;
  while (keys[i][0] < t) i++;
  const [ta, pa] = keys[i - 1], [tb, pb] = keys[i];
  if (pa.length !== pb.length) throw new Error(`polyAt: key ${i} has ${pb.length} points, key ${i - 1} has ${pa.length}`);
  const u = (t - ta) / (tb - ta);
  return pa.map(([x, y], k) => [lerp(x, pb[k][0], u), lerp(y, pb[k][1], u)]);
}

/** Clip `el` to a polygon in % (from polyAt), or show all of it with null. */
export function clipTo(el, poly) {
  css(el, 'clip-path', poly ? `polygon(${poly.map(([x, y]) => `${x.toFixed(2)}% ${y.toFixed(2)}%`).join(',')})` : 'none');
}

/* ---------- the centre lyric word ---------- */

/**
 * One lyric word, centred on (x, y) in px. `style` is the brand's type (a
 * condensed display face, big); `accentStyle` the small script word that hangs
 * off its lower right ("you", "for?"). A ghost copy blows up and fades on
 * every new word.
 */
export function makeLyric(parent, { x, y, style = '', accentStyle = '' } = {}) {
  const box = h('div', { style: `position:absolute;left:${x}px;top:${y}px;translate:-50% -50%;white-space:nowrap;text-align:center;pointer-events:none` });
  const ghost = h('span', { 'aria-hidden': 'true', style: `position:absolute;left:0;top:0;${style}` });
  const word = h('span', { style: `position:relative;display:inline-block;${style}` });
  const accent = h('span', { style: `position:absolute;right:-0.35em;bottom:-0.1em;transform-origin:20% 80%;${accentStyle}` });
  box.append(ghost, word, accent);
  parent.appendChild(box);
  return { box, ghost, word, accent };
}

/**
 * Draw the word at t. `cue` is {text, t0, accent?} (wordAt's result, or a
 * grow() string with its own t0) or null to hide. On t0 the word lands from
 * 1.25× with a spring, wears `hot` for `hotLen` s then `base`, the ghost
 * scales out behind it, and the accent drops in `accentDelay` s later.
 * `glow` is a colour for a soft text glow that flares on the hit.
 */
export function lyric(L, t, cue, { base, hot = base, hotLen = 0.1, glow = null, ghost = true, accentDelay = 0.07 } = {}) {
  if (!cue || !cue.text) { opacity(L.box, 0); return; }
  opacity(L.box, 1);
  const age = t - cue.t0;
  text(L.word, cue.text);
  xform(L.word, { s: 1.25 - 0.25 * spring(age, { duration: 0.28, bounce: 0.3 }) });
  css(L.word, 'color', age < hotLen ? hot : base);
  if (glow) {
    const g = 14 + 26 * Math.exp(-Math.max(0, age) / 0.12);
    css(L.word, 'text-shadow', `0 0 ${g.toFixed(1)}px ${glow}`);
  }
  // the ghost: same word, scaling out and fading in the first half second
  const g = go(t, cue.t0, cue.t0 + 0.5, E.out);
  text(L.ghost, cue.text);
  css(L.ghost, 'color', base);
  opacity(L.ghost, ghost && age >= 0 && age < 0.5 ? 0.45 * (1 - g) : 0);
  xform(L.ghost, { s: 1 + 0.6 * g });
  if (cue.accent) {
    const a = spring(age - accentDelay, { duration: 0.35, bounce: 0.4 });
    text(L.accent, cue.accent);
    opacity(L.accent, clamp(a * 3));
    xform(L.accent, { s: 0.4 + 0.6 * a, rot: -10 + 4 * a });
  } else {
    opacity(L.accent, 0);
  }
}

/* ---------- marker scribble ---------- */

/**
 * A felt-tip strike: back-and-forth passes that cover a word. Draw it with
 * scribble(S, p, box); swap the word underneath once p reaches 1, then show the
 * new word in the marker's colour (the strike "becomes" the next word).
 */
export function makeScribble(parent, colour, { passes = 5, seed = 3 } = {}) {
  const svg = h('svg', { style: 'position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;pointer-events:none' });
  const path = h('path', { fill: 'none', stroke: colour, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  svg.appendChild(path);
  parent.appendChild(svg);
  return { svg, path, passes, seed, len: 0, key: '' };
}

/** p 0…1 of the strike drawn over box {x, y, w, h} (frame px); `out` 0…1 fades it. */
export function scribble(S, p, box, { out = 0 } = {}) {
  const key = `${box.x}|${box.y}|${box.w}|${box.h}`;
  if (S.key !== key) {
    const n = S.passes, pts = [];
    for (let i = 0; i < n; i++) {
      const yy = box.y + box.h * (0.15 + 0.7 * (i / Math.max(1, n - 1))) + box.h * 0.12 * (rand(S.seed, i) - 0.5);
      const x0 = box.x - box.w * 0.04 * rand(S.seed + 1, i), x1 = box.x + box.w * (1 + 0.04 * rand(S.seed + 2, i));
      pts.push(i % 2 ? [x1, yy] : [x0, yy], i % 2 ? [x0, yy + box.h * 0.08] : [x1, yy + box.h * 0.08]);
    }
    let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`, len = 0;
    for (let i = 1; i < pts.length; i++) {
      d += ` L${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)}`;
      len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    }
    S.path.setAttribute('d', d);
    S.path.setAttribute('stroke-width', (box.h / S.passes * 1.9).toFixed(1));
    S.path.setAttribute('stroke-dasharray', `${len.toFixed(1)} ${len.toFixed(1)}`);
    S.len = len;
    S.key = key;
  }
  css(S.path, 'stroke-dashoffset', (S.len * (1 - clamp(p))).toFixed(1));
  opacity(S.svg, p <= 0 ? 0 : 1 - clamp(out));
}

/* ---------- card portal ---------- */

/**
 * A social post (kind 'post') or a phone (kind 'phone') that pops in over the
 * shot. Put the NEXT shot inside `K.screen`; card() then flies the card up
 * until its screen fills the frame, and the film cuts to that shot underneath.
 * Colours from the brand: `paper` card, `ink` placeholder text bars, `heart`.
 */
export function makeCard(parent, { w = 520, kind = 'post', paper, ink, heart } = {}) {
  const phone = kind === 'phone';
  const sw = phone ? w - 28 : w - 32;
  const sh = phone ? Math.round(sw * 9 / 16) : sw;          // a phone held sideways shows a 16:9 clip
  const pad = phone ? 14 : 16;
  const top = phone ? pad : pad + 44 + 14;                  // screen's top edge inside the card (header row)
  // scale and tilt about the SCREEN's centre, so flying it to fill the frame is a plain translate
  const box = h('div', { style: `position:absolute;left:0;top:0;width:${w}px;box-sizing:border-box;border-radius:${phone ? 44 : 22}px;` +
    `background:${paper};padding:${pad}px;box-shadow:0 30px 80px rgba(0,0,0,0.45);transform-origin:${w / 2}px ${top + sh / 2}px` });
  const bar = (wd, ht = 12) => h('div', { style: `width:${wd}px;height:${ht}px;border-radius:${ht}px;background:${alpha(ink, 0.25)}` });
  if (!phone) {
    box.appendChild(h('div', { style: 'display:flex;align-items:center;gap:12px;margin-bottom:14px' },
      h('div', { style: `width:44px;height:44px;border-radius:50%;background:${alpha(ink, 0.2)}` }), bar(160)));
  }
  const screen = h('div', { style: `position:relative;width:${sw}px;height:${sh}px;overflow:hidden;border-radius:${phone ? 30 : 6}px;background:rgba(0,0,0,1)` });
  box.appendChild(screen);
  const HEART = 'M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.6 4.5c2.1 0 3.6 1.2 4.4 2.6.8-1.4 2.3-2.6 4.4-2.6 3.6 0 5.7 3.9 4.2 7.3C19.5 16.4 12 21 12 21z';
  let small = null;
  if (!phone) {
    small = h('path', { d: HEART, fill: 'none', stroke: ink, 'stroke-width': '1.8' });
    box.appendChild(h('div', { style: 'display:flex;align-items:center;gap:14px;margin-top:14px' },
      h('svg', { viewBox: '0 0 24 24', width: '34', height: '34' }, small), bar(90), bar(60)));
    box.appendChild(h('div', { style: 'margin-top:12px' }, bar(w * 0.55, 10)));
  }
  const big = h('svg', { viewBox: '0 0 24 24', width: String(sw * 0.4), height: String(sw * 0.4),
    style: 'position:absolute;left:50%;top:50%;translate:-50% -50%;overflow:visible' }, h('path', { d: HEART, fill: heart }));
  screen.appendChild(big);
  parent.appendChild(box);
  return { box, screen, big, small, heart, w, sw, sh, top, phone };
}

/**
 * Draw the card between t0 (pops in) and t1 (has swallowed the frame).
 * (x, y) is the card centre in frame px; `like` a time for the heart pop.
 * Returns the portal progress 0…1: at 1 the film shows the card's shot full frame.
 */
export function card(K, t, t0, t1, { x, y, frameW, frameH, tilt = 14, like = null, fly = 0.35 } = {}) {
  if (t < t0 || t >= t1) { opacity(K.box, 0); return t >= t1 ? 1 : 0; }
  opacity(K.box, 1);
  const a = spring(t - t0, { duration: 0.45, bounce: 0.25 });
  const o = go(t, t1 - fly, t1, E.in);
  // the scale at which the screen covers the frame, flown to the frame centre
  const cover = Math.max(frameW / K.sw, frameH / K.sh) * 1.04;
  const s = lerp(0.55 + 0.45 * a, cover, o);
  const cx = lerp(x, frameW / 2, o), cy = lerp(y, frameH / 2, o);   // where the screen's centre goes
  const ry = tilt * (1 - a) * (1 - o), rz = -3 * (1 - a) * (1 - o);
  css(K.box, 'transform', `translate3d(${(cx - K.w / 2).toFixed(1)}px,${(cy - K.top - K.sh / 2).toFixed(1)}px,0) ` +
    `perspective(1400px) rotateY(${ry.toFixed(2)}deg) rotate(${rz.toFixed(2)}deg) scale(${s.toFixed(4)})`);
  if (like !== null && t >= like) {
    const b = spring(t - like, { duration: 0.4, bounce: 0.5 });
    opacity(K.big, t - like < 0.7 ? 1 : 1 - clamp((t - like - 0.7) / 0.2));
    xform(K.big, { s: 0.2 + 0.8 * b });
    if (K.small) { K.small.setAttribute('fill', K.heart); K.small.setAttribute('stroke', K.heart); }
  } else {
    opacity(K.big, 0);
    if (K.small) K.small.setAttribute('fill', 'none');
  }
  return o;
}

/* ---------- edge ink ---------- */

/**
 * Colour that creeps in from the frame edges on a kill (the purple smoke
 * border). Drawn once into a few canvases with jagged, seeded inner edges and
 * flipped through at `hz` for a hand-made boil: no feTurbulence on the full
 * frame, which is what stalls export.
 */
export function makeEdgeInk(parent, colour, { W = 1080, H = 1920, variants = 4, seed = 17, depth = 0.06 } = {}) {
  const S = 0.25;                                        // drawn at quarter size, blurred, scaled up
  const list = [];
  for (let v = 0; v < variants; v++) {
    const c = h('canvas', { width: String(Math.round(W * S)), height: String(Math.round(H * S)),
      style: `position:absolute;left:0;top:0;width:${W}px;height:${H}px;pointer-events:none` });
    const g = c.getContext('2d');
    const w = c.width, hh = c.height, n = 160;
    g.filter = `blur(${Math.round(6 * S * 4)}px)`;
    g.fillStyle = colour;
    g.beginPath();
    g.rect(-20, -20, w + 40, hh + 40);
    for (let i = 0; i <= n; i++) {                         // the inner, jagged hole: a rounded rectangle (superellipse)
      const a = -i / n * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      // depth in px of the short side: mostly a thin band, now and then a tendril
      const d = Math.min(w, hh) * depth * (0.4 + 1.6 * rand(seed + v * 31, i) ** 4);
      const ex = Math.sign(ca) * Math.abs(ca) ** 0.4, ey = Math.sign(sa) * Math.abs(sa) ** 0.4;
      const px = w / 2 + ex * (w / 2 - d), py = hh / 2 + ey * (hh / 2 - d);
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.closePath();
    g.fill('evenodd');
    parent.appendChild(c);
    list.push(c);
  }
  return { list };
}

/** amount 0…1 (an exp decay after the kill, usually); variants flip at hz. */
export function edgeInk(I, amount, t, { hz = 12 } = {}) {
  const k = Math.floor(t * hz) % I.list.length;
  I.list.forEach((c, i) => opacity(c, i === k ? clamp(amount) : 0));
}
