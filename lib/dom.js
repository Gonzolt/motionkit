/* The DOM builder and the finger. Brand-neutral on purpose.
 *
 * Anything in here must be true of every product's film. Icons are not — they
 * are a product's own glyphs and belong in brands/<brand>/. Number and
 * currency formatting is locale-specific too: put it in the brand. */

const SVG_NS = 'http://www.w3.org/2000/svg';
const SVG_TAGS = new Set(['svg', 'path', 'circle', 'rect', 'g', 'line', 'polyline',
  'polygon', 'ellipse', 'text', 'defs', 'linearGradient', 'radialGradient', 'stop',
  'clipPath', 'mask', 'filter', 'feGaussianBlur', 'feOffset', 'feMerge', 'feMergeNode']);

/** h('div.card', {style}, children…) — enough of a builder for a film. */
export function h(spec, props = {}, ...kids) {
  const [tag, ...classes] = spec.split('.');
  const name = tag || 'div';
  const el = SVG_TAGS.has(name) ? document.createElementNS(SVG_NS, name) : document.createElement(name);
  if (classes.length) el.setAttribute('class', classes.join(' '));
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null) continue;
    if (k === 'style') el.setAttribute('style', v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'class') el.setAttribute('class', [...classes, v].join(' '));
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
  }
  return el;
}

/** An icon from a brand's ICON table. Pass the table, not a global. */
export function icon(table, name, { size = 20, colour = 'currentColor', style = '' } = {}) {
  const body = table[name];
  if (!body) throw new Error(`no icon "${name}" in this brand's table`);
  return h('svg', {
    viewBox: '0 0 24 24',
    style: `width:${size}px;height:${size}px;color:${colour};flex:none;${style}`,
    html: body,
  });
}

/* ---------- the finger ----------
 *
 * One element for the whole film. A scene says where it should be and when it
 * presses; everything else — the travel between points, the squash on contact —
 * happens here, so every tap in every film behaves the same way. */

import { win, ramp, easeInOut, easeOut, lerp, opacity, xform, css } from './anim.js';

export function finger(el, t, { path = [], press = null, show = [0, 0] }) {
  if (!el) return;
  // `show` is one window, or several — a finger that hangs about between two
  // taps reads as a cursor someone forgot to move.
  const ranges = Array.isArray(show[0]) ? show : [show];
  const alive = Math.max(...ranges.map(([a, b]) => Math.min(win(t, a, a + 0.25), 1 - win(t, b - 0.25, b))));
  opacity(el, alive * 0.8);
  if (alive <= 0) return;

  let x = path[0]?.x ?? 0, y = path[0]?.y ?? 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    const f = ramp(t, a.t, b.t, easeInOut);
    x = lerp(a.x, b.x, f);
    y = lerp(a.y, b.y, f);
    if (t < b.t) break;
  }
  // The press: down fast, up slower, and a ring that leaves behind it.
  let s = 1;
  if (press) {
    const down = ramp(t, press[0], press[0] + 0.09, easeOut);
    const up = ramp(t, press[1], press[1] + 0.16, easeOut);
    s = 1 - 0.22 * (down - up);
    const ring = win(t, press[0], press[0] + 0.55);
    css(el.firstElementChild, 'transform', `scale(${(1 + ring * 1.5).toFixed(3)})`);
    css(el.firstElementChild, 'border-color', `rgba(255,255,255,${(0.45 * (1 - ring)).toFixed(3)})`);
  }
  xform(el, { x, y, s });
}

/** Whether a press is landing right now — for the button's own reaction. */
export const pressed = (t, press) => (press && t >= press[0] && t <= press[1] ? 1 : 0);
