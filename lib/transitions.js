/* Transitions that are shapes, not fades.
 *
 * A cut between two scenes is the most visible thing in a film, and a
 * crossfade is the one that says "no decision was made". Here the incoming
 * scene sits on top of the outgoing one in its own layer, and a shape REVEALS
 * it through clip-path. The shape is the transition.
 *
 *   reveal(layer, 'disc', p, { x, y })      circle growing from a point
 *   reveal(layer, 'wipe', p, { angle })     straight or diagonal edge sweeping
 *   reveal(layer, 'fan',  p, { x, y, angle })  wedge from a point; 360° floods
 *   reveal(layer, 'bars', p, { n, dir })    staggered bars
 *   reveal(layer, 'blocks', p, { cols, rows, order })  pixel-block wipe
 *   reveal(layer, 'inset', p, { from })     rectangle growing from a rect
 *
 * `p` runs 0 (nothing of the layer shown) → 1 (all of it). Ease it yourself,
 * with a curve from E: `reveal(B, 'disc', go(t, a, a+0.4, E.inOutExpo), …)`.
 * 0.25–0.5 s is the working range. Under 0.2 s it reads as a cut with a flicker;
 * over 0.7 s it reads as a slow wipe, which is a different (and rarer) decision.
 *
 * What makes one of these look designed rather than stock:
 *   - it starts or ends on something in the scene (a dot, a letter, a corner),
 *     not at the exact centre of the screen by default;
 *   - the outgoing scene is moving while it is covered (see `pushThrough`);
 *   - the next transition is a DIFFERENT shape.
 */

import { css, clamp, lerp } from './anim.js';
import { rand } from './motion.js';

export const FRAME = { W: 1080, H: 1920 };

const fmt = (n) => (Math.round(n * 100) / 100).toString();

/* ---------- geometry ---------- */

function clipRectByHalfPlane(poly, nx, ny, d) {
  // Keep points where nx*x + ny*y <= d (Sutherland–Hodgman, one plane).
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const da = nx * a[0] + ny * a[1] - d, db = nx * b[0] + ny * b[1] - d;
    if (da <= 0) out.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
      const k = da / (da - db);
      out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]);
    }
  }
  return out;
}

const poly = (pts) => `polygon(${pts.map(([x, y]) => `${fmt(x)}px ${fmt(y)}px`).join(',')})`;

function cornersFar(x, y, W, H) {
  return Math.max(Math.hypot(x, y), Math.hypot(W - x, y), Math.hypot(x, H - y), Math.hypot(W - x, H - y));
}

/* ---------- the shapes ---------- */

const SHAPES = {
  /** `r0` is the radius at p=0. Give it when the disc grows from something
   *  already on screen (a dot) — then the first frame of the wipe is that dot,
   *  not a slow-motion start from nothing. */
  disc(p, { x = FRAME.W / 2, y = FRAME.H / 2, r0 = 0, W, H }) {
    return `circle(${fmt(lerp(r0, cornersFar(x, y, W, H), p))}px at ${fmt(x)}px ${fmt(y)}px)`;
  },

  /**
   * Straight edge sweeping across at `angle` degrees (0 = left→right,
   * 90 = top→bottom, 63 = a steep diagonal). `soft` is not supported:
   * a hard edge is the point.
   */
  wipe(p, { angle = 0, W, H }) {
    const a = (angle * Math.PI) / 180, nx = Math.cos(a), ny = Math.sin(a);
    const rect = [[0, 0], [W, 0], [W, H], [0, H]];
    const dots = rect.map(([x, y]) => nx * x + ny * y);
    const lo = Math.min(...dots), hi = Math.max(...dots);
    const clipped = clipRectByHalfPlane(rect, nx, ny, lerp(lo, hi, p));
    return clipped.length >= 3 ? poly(clipped) : 'polygon(0 0,0 0,0 0)';
  },

  /**
   * A wedge fanning out from (x, y). `angle` is where it points; the wedge
   * opens symmetrically to 360° at p=1. `clock: true` instead sweeps like a
   * clock hand from `angle`.
   */
  fan(p, { x = FRAME.W / 2, y = FRAME.H / 2, angle = 0, clock = false }) {
    const R = 6000;
    const span = p * 360;
    const a0 = clock ? angle : angle - span / 2;
    const steps = Math.max(2, Math.ceil(span / 12));
    const pts = [[x, y]];
    for (let i = 0; i <= steps; i++) {
      const a = ((a0 + (span * i) / steps) * Math.PI) / 180;
      pts.push([x + Math.cos(a) * R, y + Math.sin(a) * R]);
    }
    return p >= 0.999 ? 'none' : poly(pts);
  },

  /** n bars, staggered. dir 'h' = bars run horizontally and grow rightwards. */
  bars(p, { n = 8, dir = 'h', spread = 0.6, seed = 0, shuffle = false, W, H }) {
    const parts = [];
    for (let i = 0; i < n; i++) {
      const o = shuffle ? rand(seed + 1, i) : i / (n - 1 || 1);
      const q = clamp((p * (1 + spread) - o * spread));
      if (q <= 0) continue;
      if (dir === 'h') {
        const h = H / n;
        parts.push(`M0 ${fmt(i * h)}h${fmt(W * q)}v${fmt(h + 0.5)}h${fmt(-W * q)}z`);
      } else {
        const w = W / n;
        parts.push(`M${fmt(i * w)} 0v${fmt(H * q)}h${fmt(w + 0.5)}v${fmt(-H * q)}z`);
      }
    }
    return parts.length ? `path('${parts.join('')}')` : 'polygon(0 0,0 0,0 0)';
  },

  /**
   * Cells that switch on in an order. `grow: false` is the hard pixel-block
   * wipe (each cell is either there or not); `grow: true` makes each cell
   * scale up from its centre. order: 'random' | 'diag' | 'radial' | 'rows'.
   */
  blocks(p, { cols = 8, rows = 14, order = 'random', seed = 3, spread = 0.75, grow = false, x = FRAME.W / 2, y = FRAME.H / 2, W, H }) {
    const cw = W / cols, ch = H / rows;
    const maxR = cornersFar(x, y, W, H);
    const parts = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let o;
        if (order === 'diag') o = (c / (cols - 1) + r / (rows - 1)) / 2;
        else if (order === 'radial') o = Math.hypot((c + 0.5) * cw - x, (r + 0.5) * ch - y) / maxR;
        else if (order === 'rows') o = r / (rows - 1) + rand(seed, c + r * cols) * 0.1;
        else o = rand(seed, c + r * cols);
        const q = clamp(p * (1 + spread) - o * spread);
        if (q <= 0) continue;
        const k = grow ? q : 1;
        const w = cw * k + 0.5, h = ch * k + 0.5;
        parts.push(`M${fmt(c * cw + (cw - w) / 2)} ${fmt(r * ch + (ch - h) / 2)}h${fmt(w)}v${fmt(h)}h${fmt(-w)}z`);
      }
    }
    return parts.length ? `path('${parts.join('')}')` : 'polygon(0 0,0 0,0 0)';
  },

  /** Rectangle growing from `from` ({x,y,w,h}) to the full frame. */
  inset(p, { from = { x: FRAME.W / 2 - 60, y: FRAME.H / 2 - 60, w: 120, h: 120 }, radius = 0, W, H }) {
    const l = lerp(from.x, 0, p), t = lerp(from.y, 0, p);
    const r = lerp(W - (from.x + from.w), 0, p), b = lerp(H - (from.y + from.h), 0, p);
    return `inset(${fmt(t)}px ${fmt(r)}px ${fmt(b)}px ${fmt(l)}px round ${fmt(radius * (1 - p))}px)`;
  },
};

/**
 * Show `layer` through a shape at progress p (0…1).
 * `layer` must be absolutely positioned at the frame's size.
 */
export function reveal(layer, shape, p, opts = {}) {
  if (!layer) return;
  const fn = SHAPES[shape];
  if (!fn) throw new Error(`no transition shape "${shape}" — have: ${Object.keys(SHAPES).join(', ')}`);
  if (p <= 0.0001 && !(shape === 'disc' && opts.r0 > 0)) {
    css(layer, 'visibility', 'hidden');
    return;
  }
  css(layer, 'visibility', 'visible');
  if (p >= 0.9999) {
    css(layer, 'clip-path', 'none');
    return;
  }
  css(layer, 'clip-path', fn(p, { W: FRAME.W, H: FRAME.H, ...opts }));
}

/**
 * The outgoing layer keeps moving while it is covered. A scene that freezes as
 * it is wiped looks like a screenshot; one that is still travelling looks like
 * it was cut mid-thought. `dx`, `dy` are the extra travel in px over p 0→1,
 * `scale` the extra zoom. Apply it to the OUTGOING layer.
 *
 * Travel is clamped to what the zoom covers. A layer that slides 90 px with no
 * zoom shows 90 px of whatever is behind it down one edge, which is a visible
 * bug in exactly the frames where the viewer's eye is on the edge.
 */
export function pushThrough(layer, p, { dx = 0, dy = 0, scale = 0 } = {}) {
  const maxX = scale * FRAME.W / 2, maxY = scale * FRAME.H / 2;
  const x = Math.max(-maxX, Math.min(maxX, dx)), y = Math.max(-maxY, Math.min(maxY, dy));
  css(layer, 'transform', `translate3d(${fmt(x * p)}px,${fmt(y * p)}px,0) scale(${(1 + scale * p).toFixed(4)})`);
}
