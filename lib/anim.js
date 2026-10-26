/* The clock and the curves.
 *
 * Everything in this film is a pure function of one number: the time in seconds
 * since the shot started. Nothing is a CSS transition and nothing reads the wall
 * clock, so seeking to 12.4 s always draws exactly the same frame — which is what
 * makes scrubbing honest, and what will make a frame-by-frame export possible
 * later without re-timing anything.
 *
 * These are the basic cubic easings; lib/motion.js has the stronger curves
 * and springs that most films should use. */

export const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

/**
 * A brand token at partial opacity: alpha(C.bg, 0.86).
 *
 * Exists so a translucent surface stays tied to its token. An eight-digit hex
 * written by hand works right up until the token changes, and then the solid
 * surfaces move while the translucent ones silently do not — which reads as a
 * gradient nobody authored.
 */
export function alpha(hex, a) {
  const v = hex.replace('#', '');
  const n = parseInt(v.length === 3 ? v.split('').map((c) => c + c).join('') : v.slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${clamp(a, 0, 1)})`;
}
export const lerp = (a, b, t) => a + (b - a) * t;

/** `t` remapped to 0…1 across a window, and clamped outside it. */
export function win(t, start, end) {
  if (end <= start) return t >= end ? 1 : 0;
  return clamp((t - start) / (end - start));
}

export const easeOut = (x) => 1 - Math.pow(1 - x, 3);
export const easeIn = (x) => x * x * x;
export const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
/** Overshoots a little and comes back — what makes a thing land instead of appear. */
export const easeBack = (x) => {
  const c = 1.7;
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
};

/** Window + curve in one, because that is how nearly every beat is written. */
export const ramp = (t, start, end, curve = easeOut) => curve(win(t, start, end));

/** Up over `inDur`, hold, down over `outDur`. Returns 0…1. */
export function pulse(t, start, end, inDur = 0.3, outDur = 0.3) {
  if (t <= start || t >= end) return 0;
  return Math.min(ramp(t, start, start + inDur), 1 - ramp(t, end - outDur, end));
}

/** A repeating 0…1 phase, driven by the film clock so it stays deterministic. */
export const phase = (t, period, offset = 0) => ((t / period + offset) % 1 + 1) % 1;
/** A 0…1 triangle, for things that breathe. */
export const breathe = (t, period, offset = 0) => {
  const p = phase(t, period, offset);
  return p < 0.5 ? p * 2 : 2 - p * 2;
};

/** Seeded, so the same "random" scatter comes back on every reload. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- DOM helpers ----------
 * Writing to the DOM 60 times a second is fine as long as you do not make the
 * browser re-do layout for values that have not changed. Every setter here is a
 * no-op when the value is the same as last frame. */

const last = new WeakMap();
function memo(el, key, value) {
  let m = last.get(el);
  if (!m) last.set(el, (m = {}));
  if (m[key] === value) return false;
  m[key] = value;
  return true;
}

export function css(el, prop, value) {
  if (el && memo(el, prop, value)) el.style.setProperty(prop, value);
}

export function opacity(el, v) {
  if (!el) return;
  const r = Math.round(v * 1000) / 1000;
  if (memo(el, 'op', r)) {
    el.style.opacity = r;
    // Something fully transparent should not be catching the eye in a stack of
    // twenty overlapping panels, nor costing us a composite.
    el.style.visibility = r <= 0.001 ? 'hidden' : '';
  }
}

export function xform(el, { x = 0, y = 0, s = 1, rot = 0, ox, oy } = {}) {
  if (!el) return;
  const t = `translate3d(${round(x)}px,${round(y)}px,0)` +
    (rot ? ` rotate(${round(rot, 100)}deg)` : '') +
    (s !== 1 ? ` scale(${round(s, 10000)})` : '');
  if (memo(el, 'tf', t)) el.style.transform = t;
  if (ox !== undefined || oy !== undefined) {
    const o = `${ox ?? 50}% ${oy ?? 50}%`;
    if (memo(el, 'to', o)) el.style.transformOrigin = o;
  }
}

export function text(el, v) {
  if (el && memo(el, 'tx', v)) el.textContent = v;
}

export function attr(el, name, v) {
  if (el && memo(el, 'a:' + name, v)) el.setAttribute(name, v);
}

const round = (v, f = 100) => Math.round(v * f) / f;

export const fmtClock = (s) => {
  const t = Math.max(0, Math.floor(s));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

/* ---------- the clock ---------- */

export class Clock {
  constructor(duration, onFrame) {
    this.duration = duration;
    this.onFrame = onFrame;
    this.t = 0;
    this.rate = 1;
    this.loop = true;
    this.playing = false;
    this._last = 0;
    this._tick = this._tick.bind(this);
    requestAnimationFrame(this._tick);
  }

  play() { this.playing = true; }
  pause() { this.playing = false; }
  toggle() { this.playing = !this.playing; }

  seek(t) {
    this.t = clamp(t, 0, this.duration);
    this._dirty = true;
  }

  _tick(now) {
    requestAnimationFrame(this._tick);
    const dt = this._last ? (now - this._last) / 1000 : 0;
    this._last = now;
    if (this.playing) {
      // A dropped frame or a backgrounded tab must not jump the film forward by
      // three seconds.
      this.t += Math.min(dt, 0.1) * this.rate;
      if (this.t >= this.duration) {
        if (this.loop) this.t = 0;
        else { this.t = this.duration; this.playing = false; }
      }
      this._dirty = true;
    }
    if (this._dirty || this._always) {
      this._dirty = false;
      this.onFrame(this.t);
    }
  }
}
