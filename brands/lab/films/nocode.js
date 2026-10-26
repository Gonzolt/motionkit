/* lab/nocode — "Just code." 29 s, 9:16, voiceover-driven kinetic type.
 *
 * Style study: word-synced kinetic typography in the manner of the AI-motion
 * demos going round TikTok (hard cuts on every word, a dot that runs through
 * the whole piece, wipes that are shapes). Original script, palette and
 * choreography; the claim it makes about itself is true: no After Effects, no
 * image or video model, every frame below is a function of t.
 *
 * Timing is not typed in here. The voiceover is TTS line by line
 * (audio/nocode/make_vo.py), whisper gives every word's start, and
 * nocode.cues.js turns those into scene starts and hits. Picture punches and
 * sound effects come from the same CUES list, so they cannot drift apart.
 *
 * The thread: a lime dot. It is the "No way" period, the dot the first cut zooms
 * through, the period of CODE., the playhead head, the ring runner in the loop,
 * and the period of the last line.
 */

import { opacity, css, xform, clamp, lerp } from '../../../lib/anim.js';
import { runFilm, preload } from '../../../lib/stage.js';
import { film } from '../../../lib/scenes.js';
import { h } from '../../../lib/dom.js';
import { E, go, tween, spring, impact, win, track, drift } from '../../../lib/motion.js';
import { splitText, charIn, charOut, squashStretch, typewriter } from '../../../lib/type.js';
import { makeSlices, slices } from '../../../lib/fx.js';
import { reveal } from '../../../lib/transitions.js';
import { makeRig } from '../../../lib/rig.js';
import { C, disp, mono } from '../theme.js';
import { SC, CUES, DURATION, word } from './nocode.cues.js';

const ws = (n, k) => word(n, k).s;

const SCENE_LIST = [
  ['hook', SC.hook, SC.okay], ['okay', SC.okay, SC.noae], ['noae', SC.noae, SC.model],
  ['model', SC.model, SC.code], ['code', SC.code, SC.ft], ['ft', SC.ft, SC.stretch],
  ['stretch', SC.stretch, SC.camera], ['camera', SC.camera, SC.layers],
  ['tools', SC.layers, SC.nope], ['nope', SC.nope, SC.loop], ['loop', SC.loop, SC.outro],
  ['outro', SC.outro, SC.end],
];
const { SCENES } = film(SCENE_LIST);

/* ---------- scaffolding ---------- */

const stage = document.getElementById('stage');
const camWrap = h('div', { style: 'position:absolute;inset:0;transform-origin:50% 50%' });
stage.appendChild(camWrap);

const layer = (bg) => {
  const el = h('div', { style: `position:absolute;inset:0;overflow:hidden;background:${bg}` });
  camWrap.appendChild(el);
  return el;
};
const box = (parent, extra = '') => {
  const el = h('div', { style: `position:absolute;inset:0;transform-origin:50% 50%;${extra}` });
  parent.appendChild(el);
  return el;
};
const at = (parent, x, y, extra, ...kids) => {
  const el = h('div', { style: `position:absolute;left:${x}px;top:${y}px;translate:-50% -50%;white-space:nowrap;${extra ?? ''}` }, ...kids);
  parent.appendChild(el);
  return el;
};
const tl = (parent, x, y, extra, ...kids) => {
  const el = h('div', { style: `position:absolute;left:${x}px;top:${y}px;white-space:nowrap;${extra ?? ''}` }, ...kids);
  parent.appendChild(el);
  return el;
};
const dotEl = (parent, d, colour = C.signal) => {
  const el = h('div', { style: `position:absolute;left:0;top:0;width:${d}px;height:${d}px;margin:${-d / 2}px 0 0 ${-d / 2}px;border-radius:50%;background:${colour}` });
  parent.appendChild(el);
  return el;
};
/* An inline period that is a circle, so a dot can land in a line of type. */
const periodEl = (em = 0.2, colour = C.signal) => h('span', {
  style: `display:inline-block;width:${em}em;height:${em}em;border-radius:50%;background:${colour};margin-left:0.05em;vertical-align:0.02em`,
});
const place = (el, x, y, s = 1) => css(el, 'transform', `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) scale(${s.toFixed(4)})`);
const wdth = (el, w) => css(el, 'font-variation-settings', `"wdth" ${clamp(w, 62, 125).toFixed(1)}`);
const line = (parent, str, style, opts) => {
  const el = h('div', { style });
  parent.appendChild(el);
  return { el, ...splitText(el, str, opts) };
};
/* Picture cuts half a frame early: with sub-frame motion blur a cut ON a frame
   time is averaged into a 50/50 ghost. */
const hard = (t, a) => (t >= a - 1 / 60 ? 1 : 0);
const DOTGRID = `background-image:radial-gradient(${C.rule} 2px,transparent 2.5px);background-size:60px 60px`;

/* measured after fonts load (frame px, pre-transform) */
const M = {};
const centreOf = (el) => {
  const f = document.getElementById('frame').getBoundingClientRect();
  const k = f.width / 1080, r = el.getBoundingClientRect();
  return { x: (r.left - f.left + r.width / 2) / k, y: (r.top - f.top + r.height / 2) / k, w: r.width / k };
};

/* ======================= 1  hook: "No way." =========================== */

const L1 = layer(C.ink);
const in1 = box(L1);
const col1 = h('div', { style: 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px' });
in1.appendChild(col1);
const no1 = line(col1, 'NO', `${disp(400, { s: 125 })}color:${C.bone}`);
const way1 = line(col1, 'WAY', `${disp(300, { s: 110 })}color:${C.bone}`);
const per1 = periodEl(0.2);
way1.el.appendChild(per1);
opacity(per1, 0);
const dot1 = dotEl(in1, 60);

/* ======================= 2  "Okay. Okay." ============================ */

const L2 = layer(C.signal);
const in2 = box(L2);
const okWrap = at(in2, 540, 820, 'text-align:center');
const okWord = h('span', { style: `${disp(250, { s: 115 })}color:${C.ink};display:inline-block;transform-origin:50% 80%` }, 'OKAY.');
okWrap.appendChild(okWord);
const okGhosts = [0, 1, 2].map((i) => at(in2, 540, 1060 + i * 210,
  `${disp(250, { s: 115 })}color:transparent;-webkit-text-stroke:3px ${C.ink}`, 'OKAY.'));
const okSlices = makeSlices(okWord, 11);

/* ================= 3  "This video? No After Effects." ================= */

const L3 = layer(C.ink);
const in3 = box(L3);
const t3a = tl(in3, 70, 250, `${disp(210)}color:${C.bone}`);
const this3 = splitText(t3a, 'THIS', { mask: true });
const t3b = tl(in3, 70, 450, `${disp(210)}color:${C.bone}`);
const video3 = splitText(t3b, 'VIDEO', { mask: true });
const q3 = h('span', { style: `display:inline-block;color:${C.signal}` }, '?');
t3b.appendChild(q3);
// The panel is a frame-sized layer of its own so it can be shattered with a clip-path.
const P3 = box(in3);
const panel = tl(P3, 70, 1000, `width:940px;height:620px;background:${C.panel};border:2px solid ${C.rule};border-radius:18px;overflow:hidden`);
const panelHead = tl(panel, 30, 26, `${mono(30)}color:${C.mute}`);
const ROWS3 = [
  ['hero_type', C.cobalt, 0.05, 0.62], ['dot', C.signal, 0.2, 0.9], ['bg_wipe', C.ember, 0.35, 0.7],
  ['camera', C.bone, 0.0, 0.95], ['null 4', C.mute, 0.5, 0.8],
];
const rows3 = ROWS3.map(([name, colour, a, b], i) => {
  const y = 110 + i * 96;
  tl(panel, 30, y + 10, `${mono(26)}color:${C.bone}`, name);
  tl(panel, 250, y + 44, `width:660px;height:2px;background:${C.rule}`);
  const bar = tl(panel, 250 + 660 * a, y + 14, `width:${660 * (b - a)}px;height:40px;border-radius:8px;background:${colour};opacity:.85;transform-origin:0 50%`);
  const keys = [a, (a + b) / 2, b].map((u) => tl(panel, 250 + 660 * u - 12, y + 22, `width:24px;height:24px;background:${C.bone};rotate:45deg;border:3px solid ${C.panel}`));
  return { bar, keys };
});
const head3 = tl(panel, 250 + 660 * 0.3, 90, `width:3px;height:520px;background:${C.ember}`);
const strike3 = tl(P3, 30, 1290, `width:1020px;height:22px;background:${C.signal};transform-origin:0 50%;rotate:-9deg`);

/* ========= 4  "No video model. Not one generated image." =========== */

const L4 = layer(C.cobalt);
const in4 = box(L4);
const W4 = ['NO', 'VIDEO', 'MODEL.'].map((w, i) => {
  const el = tl(in4, 70, 230 + i * 190, `${disp(200, { s: 80 })}color:${C.bone}`);
  return splitText(el, w, { mask: true });
});
const zero4 = at(in4, 830, 1290, `${disp(640, { s: 66 })}color:${C.signal}`, '0');
const gen4 = tl(in4, 70, 1180, `${disp(84)}color:${C.bone}`);
const gen4s = splitText(gen4, 'GENERATED', { mask: true });
const img4 = tl(in4, 70, 1275, `${disp(84)}color:${C.bone}`);
const img4s = splitText(img4, 'IMAGES.', { mask: true });

/* ======================== 5  "Just code." ============================ */

const L5 = layer(C.ink);
const in5 = box(L5);
const codeBg = tl(in5, 50, 0, `${mono(25, { lh: 1.45 })}color:${C.mute};opacity:.32;white-space:pre`);
const just5 = at(in5, 540, 770, `${disp(130)}color:${C.bone}`);
const just5s = splitText(just5, 'JUST', { mask: true });
const code5wrap = at(in5, 540, 1000, `${disp(250, { s: 110 })}`);
const code5 = h('span', { style: `${disp(250, { s: 110 })}color:${C.bone};display:inline-block` }, 'CODE');
const per5 = periodEl(0.2);
code5wrap.append(code5, per5);

/* ============ 6  "Every frame is a function of time." =============== */

const L6 = layer(C.bone);
const in6 = box(L6);
const ev6 = ['EVERY', 'FRAME'].map((w, i) => splitText(tl(in6, 70, 260 + i * 175, `${disp(180)}color:${C.ink}`), w, { mask: true }));
const is6 = tl(in6, 72, 640, `${mono(44)}color:${C.ink}`);
const ft6 = at(in6, 540, 930, `${mono(300)}color:${C.ink}`);
const ft6s = splitText(ft6, 'f(t)');
const tChar = ft6s.chars[2];
css(tChar, 'padding', '0 0.04em');
css(tChar, 'border-radius', '0.08em');
const RULER_Y = 1360;
const ruler6 = box(in6);
for (let i = 0; i < 46; i++) {
  const x = i * 36;
  const big = i % 5 === 0;
  tl(ruler6, x, RULER_Y - (big ? 46 : 22), `width:3px;height:${big ? 46 : 22}px;background:${C.ink}`);
  if (big) tl(ruler6, x + 8, RULER_Y - 46, `${mono(22)}color:${C.mute}`, String(270 + i));
}
tl(in6, 0, RULER_Y, `width:1080px;height:3px;background:${C.ink}`);
const play6 = h('div', { style: 'position:absolute;left:0;top:0' });
in6.appendChild(play6);
tl(play6, -1.5, RULER_Y - 300, `width:3px;height:380px;background:${C.cobalt}`);
const play6dot = dotEl(play6, 34, C.cobalt);
css(play6dot, 'top', `${RULER_Y - 300}px`);
const tc6 = tl(play6, 24, RULER_Y - 330, `${mono(34)}color:${C.cobalt}`);
const PLAY = track([[SC.ft, -40], [SC.ft + 0.5, 140, E.outExpo], [SC.stretch - 0.3, 820, E.inOut]]);
const PLAY_END = 820;

/* ============== 7  "Now watch the letters stretch." ================= */

const L7 = layer(C.signal);
const in7 = box(L7);
const now7 = splitText(tl(in7, 70, 330, `${disp(96)}color:${C.ink}`), 'NOW WATCH', { mask: true });
const let7 = splitText(tl(in7, 70, 440, `${disp(118, { s: 90 })}color:${C.ink}`), 'THE LETTERS', { mask: true });
const STRETCH_STYLE = `${disp(150)}position:absolute;left:58px;top:980px;transform-origin:0 100%;white-space:nowrap`;
const sGhosts = [0, 1, 2].map(() => h('div', { style: `${STRETCH_STYLE}color:transparent;-webkit-text-stroke:2.5px ${C.ink}` }, 'STRETCH'));
const sWord = h('div', { style: `${STRETCH_STYLE}color:${C.ink}` }, 'STRETCH');
in7.append(...sGhosts, sWord);
const S7 = ws(6, 4);
const sW = (t) => (t < S7 ? 62 : 62 + 50 * spring(t - S7, { duration: 0.75, bounce: 0.45 }));
/* height follows width: narrow and short -> wide and tall (2x) */
const tall = (w) => lerp(0.75, 2.0, clamp((w - 62) / 50, 0, 1.3));

/* ====== 8  "Follow the camera, and wait for the transition." ======= */

const L8 = layer(C.ink);
const world8 = h('div', { style: 'position:absolute;inset:0;transform-origin:50% 50%' });
L8.appendChild(world8);
tl(world8, -2000, -2000, `width:5200px;height:5200px;${DOTGRID}`);
const w8 = (x, y, extra, ...k) => at(world8, 540 + x, 960 + y, extra, ...k);
const POS8 = { follow: [0, 0], the: [560, 640], camera: [1300, 120] };
const fol8 = splitText(w8(...POS8.follow, `${disp(190)}color:${C.bone}`), 'FOLLOW', { mask: true });
const the8 = splitText(w8(...POS8.the, `${disp(190)}color:${C.mute}`), 'THE', { mask: true });
const cam8 = splitText(w8(...POS8.camera, `${disp(190)}color:${C.signal}`), 'CAMERA', { mask: true });
w8(650, 330, `width:1500px;height:3px;background:${C.rule};rotate:-14deg`);
const rig8 = makeRig(world8);
const C0 = SC.camera, F1 = ws(7, 1), F2 = ws(7, 2), PB = ws(8, 0);
const cam8t = {
  x: track([[C0, -90], [F1 - 0.1, 0, E.outExpo], [F1 + 0.1, POS8.the[0], E.inOutExpo], [F2 - 0.08, POS8.the[0]], [F2 + 0.22, POS8.camera[0], E.inOutExpo], [PB, POS8.camera[0]], [SC.trans - 0.05, 650, E.inOut]]),
  y: track([[C0, 60], [F1 - 0.1, 0, E.outExpo], [F1 + 0.1, POS8.the[1], E.inOutExpo], [F2 - 0.08, POS8.the[1]], [F2 + 0.22, POS8.camera[1], E.inOutExpo], [PB, POS8.camera[1]], [SC.trans - 0.05, 330, E.inOut]]),
  z: track([[C0, 1.3], [F1 - 0.1, 1.0, E.outExpo], [F1 + 0.1, 1.15, E.inOutExpo], [F2 - 0.08, 1.15], [F2 + 0.22, 1.05, E.inOutExpo], [PB, 1.1], [SC.trans - 0.05, 0.42, E.inOut]]),
  rot: track([[C0, -4], [F1 - 0.1, 0, E.outExpo], [F1 + 0.1, 4, E.inOutExpo], [F2 - 0.08, 4], [F2 + 0.22, -2.5, E.inOutExpo], [PB, -2], [SC.trans - 0.05, 0, E.inOut]]),
};
const hud8 = box(L8);
const BR = [[90, 300, 0, 0], [990, 300, 1, 0], [90, 1620, 0, 1], [990, 1620, 1, 1]].map(([x, y, fx, fy]) =>
  tl(hud8, x - fx * 80, y - fy * 80, `width:80px;height:80px;box-sizing:border-box;border:0 solid ${C.signal};` +
    `border-${fy ? 'bottom' : 'top'}-width:7px;border-${fx ? 'right' : 'left'}-width:7px;transform-origin:${fx ? 100 : 0}% ${fy ? 100 : 0}%`));
const rec8 = tl(hud8, 92, 220, `${mono(30)}color:${C.bone}`);
const recDot = dotEl(hud8, 20, C.ember);
const wait8 = at(hud8, 540, 1720, `${mono(44)}color:${C.bone}`);
const dot8 = dotEl(hud8, 44);

/* ===== 9  "Layers. Keyframes. Graph editor. Render." (four cuts) ===== */

const L9 = layer(C.bone);
const in9 = box(L9, `background-image:radial-gradient(${C.mute} 2px,transparent 2.5px);background-size:60px 60px`);
const stack9 = h('div', { style: 'position:absolute;left:540px;top:820px;width:0;height:0;transform-style:preserve-3d' });
in9.appendChild(stack9);
const CARDS = [C.mute, C.ember, C.cobalt, C.ink, C.signal];
const cards9 = CARDS.map((colour) => {
  const c = h('div', { style: `position:absolute;left:-230px;top:-150px;width:460px;height:300px;border-radius:22px;background:${colour};box-shadow:0 0 0 4px ${C.bone}` });
  stack9.appendChild(c);
  return c;
});
const lay9 = at(in9, 540, 1480, `${disp(190)}color:${C.ink}`);
const lay9s = splitText(lay9, 'LAYERS.', { mask: true });

const L9b = layer(C.ink);
tl(L9b, 0, 880, `width:1080px;height:4px;background:${C.bone}`);
const dia9 = [0, 1, 2, 3, 4, 5, 6].map((i) => at(L9b, 120 + i * 140, 882,
  `width:70px;height:70px;rotate:45deg;background:${i === 4 ? C.signal : C.bone};border:5px solid ${C.ink};box-sizing:border-box`));
const key9s = splitText(at(L9b, 540, 1240, `${disp(170, { s: 88 })}color:${C.bone}`), 'KEYFRAMES.', { mask: true });

const L9c = layer(C.cobalt);
const SVG_NS = 'http://www.w3.org/2000/svg';
const svg9 = document.createElementNS(SVG_NS, 'svg');
svg9.setAttribute('viewBox', '0 0 900 700');
svg9.setAttribute('style', 'position:absolute;left:90px;top:420px;width:900px;height:700px;overflow:visible');
L9c.appendChild(svg9);
const sv = (tag, attrs) => {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  svg9.appendChild(e);
  return e;
};
for (let i = 0; i <= 6; i++) {
  sv('line', { x1: i * 150, y1: 0, x2: i * 150, y2: 700, stroke: 'rgba(255,255,255,.18)', 'stroke-width': 2 });
  if (i <= 4) sv('line', { x1: 0, y1: i * 175, x2: 900, y2: i * 175, stroke: 'rgba(255,255,255,.18)', 'stroke-width': 2 });
}
// The film's own hero curve, E.outExpo = cubic-bezier(.16, 1, .3, 1), drawn at scale.
const P = (x, y) => [x * 900, 700 - y * 700];
const [p0, p1, p2, p3] = [P(0, 0), P(0.16, 1), P(0.3, 1), P(1, 1)];
const hnd1 = sv('line', { x1: p0[0], y1: p0[1], x2: p1[0], y2: p1[1], stroke: C.signal, 'stroke-width': 4 });
const hnd2 = sv('line', { x1: p3[0], y1: p3[1], x2: p2[0], y2: p2[1], stroke: C.signal, 'stroke-width': 4 });
const curve9 = sv('path', { d: `M${p0} C${p1} ${p2} ${p3}`, fill: 'none', stroke: C.bone, 'stroke-width': 12, 'stroke-linecap': 'round', pathLength: 1, 'stroke-dasharray': 1 });
const knobs9 = [p1, p2].map((p) => sv('circle', { cx: p[0], cy: p[1], r: 16, fill: C.signal }));
const gr9s = splitText(at(L9c, 540, 1380, `${disp(112, { s: 82 })}color:${C.bone}`), 'GRAPH EDITOR.', { mask: true });

const L9d = layer(C.ink);
const ren9s = splitText(at(L9d, 540, 820, `${disp(190)}color:${C.bone}`), 'RENDER.', { mask: true });
tl(L9d, 90, 1010, `width:900px;height:26px;border-radius:13px;background:${C.rule}`);
const bar9 = tl(L9d, 90, 1010, `width:900px;height:26px;border-radius:13px;background:${C.signal};transform-origin:0 50%`);
const eta9 = tl(L9d, 90, 1070, `${mono(36)}color:${C.mute}`);

/* ========================== 10  "Nope." ============================== */

const L10 = layer(C.signal);
const nopeWrap = at(L10, 540, 960, '');
const nope = h('span', { style: `${disp(260, { s: 110 })}color:${C.ink};display:inline-block;transform-origin:50% 85%` }, 'NOPE.');
nopeWrap.appendChild(nope);
const nopeSl = makeSlices(nope, 9);

/* ================ 11  "Write. Render. Look. Fix." ==================== */

const L11 = layer(C.ink);
const in11 = box(L11);
const RC = { x: 540, y: 980, r: 300 };
const svg11 = document.createElementNS(SVG_NS, 'svg');
svg11.setAttribute('viewBox', '0 0 1080 1920');
svg11.setAttribute('style', 'position:absolute;inset:0;width:1080px;height:1920px');
in11.appendChild(svg11);
const ring = (attrs) => {
  const e = document.createElementNS(SVG_NS, 'circle');
  for (const [k, v] of Object.entries({ cx: RC.x, cy: RC.y, r: RC.r, fill: 'none', ...attrs })) e.setAttribute(k, v);
  svg11.appendChild(e);
  return e;
};
ring({ stroke: C.rule, 'stroke-width': 6 });
const arc11 = ring({ stroke: C.signal, 'stroke-width': 10, pathLength: 360, 'stroke-dasharray': 360, transform: `rotate(-90 ${RC.x} ${RC.y})`, 'stroke-linecap': 'round' });
const LOOPW = ['WRITE', 'RENDER', 'LOOK', 'FIX'];
const ANG = [-90, 0, 90, 180];
const ticks11 = ANG.map((a) => {
  const r = (a * Math.PI) / 180;
  return at(in11, RC.x + Math.cos(r) * RC.r, RC.y + Math.sin(r) * RC.r,
    `width:26px;height:26px;border-radius:50%;background:${C.rule}`);
});
const labels11 = LOOPW.map((w, i) => {
  const a = (ANG[i] * Math.PI) / 180, d = RC.r + 70;
  return at(in11, RC.x + Math.cos(a) * d, RC.y + Math.sin(a) * d, `${mono(28)}color:${C.mute}`, `0${i + 1} ${w}`);
});
const big11 = LOOPW.map((w) => splitText(at(in11, RC.x, RC.y, `${disp(120, { s: 92 })}color:${C.bone}`), `${w}.`, { mask: true }));
const run11 = dotEl(in11, 46);
const LW = [0, 1, 2, 3].map((k) => ws(11, k));
const ANGT = track([[LW[0] - 0.3, -150], [LW[0], -90, E.outExpo], [LW[1] - 0.3, -90], [LW[1], 0, E.inOutExpo], [LW[2] - 0.3, 0],
  [LW[2], 90, E.inOutExpo], [LW[3] - 0.3, 90], [LW[3], 180, E.inOutExpo], [SC.outro - 0.45, 180], [SC.outro - 0.12, 270, E.inExpo]]);

/* ================ 12  "Made with code. Nothing else." ================ */

const L12 = layer(C.signal);
const in12 = box(L12);
const made12 = splitText(at(in12, 540, 640, `${disp(80, { w: 800 })}color:${C.ink};letter-spacing:6px`), 'MADE WITH', { mask: true });
const word12 = at(in12, 540, 880, `${disp(270, { s: 112 })}color:${C.ink};transform-origin:50% 75%`, 'CODE');
const code12 = at(in12, 540, 1150, `${mono(96)}color:${C.ink}`);
const code12txt = h('span', {});
const per12 = periodEl(0.26, C.ink);
code12.append(code12txt, per12);
const foot12 = at(in12, 540, 1700, `${mono(28)}color:${C.ink}`, `${DURATION.toFixed(1)} s · ${Math.round(DURATION * 30)} frames · every one = f(t)`);

/* ========================= the cut list ============================== */

const LAYERS = [
  [L1, () => 1],
  [L2, (t) => hard(t, SC.okay)],
  [L3, (t) => hard(t, SC.noae)],
  [L4, (t) => hard(t, SC.model)],
  [L5, (t) => go(t, SC.code - 0.22, SC.code + 0.12, E.outQuart), 'bars', { n: 7, dir: 'h', spread: 0.5 }],
  [L6, (t) => go(t, SC.ft - 0.04, SC.ft + 0.36, E.outExpo), 'disc', () => ({ x: M.per5.x, y: M.per5.y, r0: M.per5.w / 2 })],
  // the playhead splits the frame open
  [L7, (t) => go(t, SC.stretch - 0.28, SC.stretch + 0.12, E.outExpo), 'inset', { from: { x: PLAY_END - 2, y: 0, w: 4, h: 1920 } }],
  [L8, (t) => hard(t, SC.camera)],
  [L9, (t) => go(t, SC.trans, SC.trans + 0.5, E.inOutExpo), 'fan', { x: 540, y: 960, angle: -90, clock: true }],
  [L9b, (t) => hard(t, SC.keys)],
  [L9c, (t) => hard(t, SC.graph)],
  [L9d, (t) => hard(t, SC.render)],
  [L10, (t) => hard(t, SC.nope)],
  [L11, (t) => hard(t, SC.loop)],
  [L12, (t) => go(t, SC.outro - 0.12, SC.outro + 0.3, E.outExpo), 'disc', { x: RC.x, y: RC.y, r0: 23 }],
];

/* ============================ one frame ============================== */

function punch(t) {
  let x = 0, y = 0, z = 0;
  for (const c of CUES) {
    if (t < c.t || c.kind === 'tick' || c.kind === 'riser') continue;
    const k = c.kind === 'slam' ? 1 : c.kind === 'whoosh' ? 0.35 : 0.6;
    const a = 13 * c.amp * k;
    x += impact(t, c.t, { amp: a, decay: 9, freq: 15, seed: Math.round(c.t * 100) });
    y += impact(t, c.t, { amp: a, decay: 9, freq: 15, seed: Math.round(c.t * 100) + 7 });
    z += 0.03 * c.amp * k * Math.exp(-14 * (t - c.t));
  }
  return { x, y, z };
}

function render(t) {
  const pk = punch(t);
  // a little handheld drift under everything: a locked-off frame reads as a screen recording
  const dx = drift(t, { amp: 5, freq: 0.4, seed: 21 }), dy = drift(t, { amp: 5, freq: 0.35, seed: 22 });
  const dr = drift(t, { amp: 0.35, freq: 0.3, seed: 23 });
  css(camWrap, 'transform', `translate3d(${(pk.x + dx).toFixed(2)}px,${(pk.y + dy).toFixed(2)}px,0) rotate(${dr.toFixed(3)}deg) scale(${(1.035 + pk.z).toFixed(4)})`);

  LAYERS.forEach(([L, pf, shape, opts], i) => {
    const next = LAYERS[i + 1];
    const gone = next && next[1](t) >= 1;
    const p = gone ? 0 : pf(t);
    // opts only while the cut is running: a disc with r0 draws its dot even at p=0
    const o = p > 0 ? (typeof opts === 'function' ? opts() : opts) : {};
    reveal(L, shape ?? 'disc', p, o ?? {});
  });

  /* ---------- 1 ---------- */
  {
    charIn(no1.chars, t, { start: ws(0, 0) - 0.03, each: 0.04, dur: 0.22, ease: E.snap, from: { s: 1.9, blur: 18, op: 0 } });
    charIn(way1.chars, t, { start: ws(0, 1) - 0.03, each: 0.03, dur: 0.24, ease: E.outExpo, from: { x: -0.7, blur: 14, op: 0 } });
    const fly = go(t, ws(0, 0) + 0.02, ws(0, 1) + 0.3, E.outExpo);
    const appear = spring(t - 0.08, { duration: 0.4, bounce: 0.35 });
    const beat = 1 + 0.12 * Math.exp(-7 * Math.max(0, (t - 0.08) % 0.5)) * (t < ws(0, 0) ? 1 : 0);
    const d = M.per1 ?? { x: 540, y: 1100, w: 60 };
    place(dot1, lerp(540, d.x, fly), lerp(960, d.y, fly), appear * beat * lerp(1, d.w / 60, fly));
    // zoom through the dot into the lime of the next scene
    const zin = E.inExpo(win(t, SC.okay - 0.3, SC.okay));
    css(in1, 'transform-origin', `${d.x}px ${d.y}px`);
    // and bring the dot to the centre as we go in, so the flood is symmetric
    css(in1, 'transform', `translate3d(${((540 - d.x) * zin).toFixed(2)}px,${((960 - d.y) * zin).toFixed(2)}px,0) scale(${(1 + 30 * zin).toFixed(4)})`);
  }

  /* ---------- 2 ---------- */
  {
    const a = ws(1, 0), b = ws(1, 1);
    const w = t < a ? 62 : 62 + 53 * spring(t - a, { duration: 0.5, bounce: 0.4 });
    wdth(okWord, w);
    okSlices.strips.forEach((s) => wdth(s, w));
    const sq = squashStretch(t, b, { amount: -0.16, duration: 0.35, bounce: 0.4, axis: 'y' });
    css(okWord, 'transform', `translateY(${tween(t, a - 0.02, a + 0.25, -260, 0, E.outExpo).toFixed(1)}px) scale(${(t >= b ? sq.sx : 1).toFixed(4)},${(t >= b ? sq.sy : 1).toFixed(4)})`);
    opacity(okWrap, t >= a - 0.02 ? 1 : 0);
    okGhosts.forEach((g, i) => {
      const p = go(t, b + i * 0.05, b + i * 0.05 + 0.35, E.outExpo);
      opacity(g, p * (0.9 - i * 0.25));
      xform(g, { y: (1 - p) * -200 });
      wdth(g, 115 - i * 18);
    });
    slices(okSlices, go(t, SC.noae - 0.2, SC.noae, E.in), t, { reach: 260, seed: 4 });
  }

  /* ---------- 3 ---------- */
  {
    charIn(this3.chars, t, { start: ws(2, 0) - 0.04, each: 0.03, dur: 0.45, ease: E.outExpo, from: { y: 1.1 } });
    charIn(video3.chars, t, { start: ws(2, 1) - 0.02, each: 0.03, dur: 0.45, ease: E.outExpo, from: { y: 1.1 } });
    const q = spring(t - ws(2, 1) - 0.2, { duration: 0.4, bounce: 0.45 });
    xform(q3, { s: q, rot: (1 - q) * -40 });
    const pIn = go(t, ws(2, 2) - 0.05, ws(2, 2) + 0.4, E.outExpo);
    opacity(panel, pIn);
    xform(panel, { y: (1 - pIn) * 160 });
    typewriter(panelHead, 'After Effects  —  comp 1', t, { start: ws(2, 3), cps: 40, caret: false });
    rows3.forEach((r, i) => {
      const g = go(t, ws(2, 2) + 0.1 + i * 0.05, ws(2, 2) + 0.55 + i * 0.05, E.outQuart);
      css(r.bar, 'transform', `scaleX(${g.toFixed(4)})`);
      r.keys.forEach((k, j) => xform(k, { s: spring(t - ws(2, 2) - 0.25 - i * 0.05 - j * 0.04, { duration: 0.35, bounce: 0.4 }) }));
    });
    xform(head3, { x: 660 * 0.5 * go(t, ws(2, 2), SC.model, E.linear) });
    const st = go(t, ws(2, 4) - 0.02, ws(2, 4) + 0.16, E.snap);
    css(strike3, 'transform', `scaleX(${st.toFixed(4)})`);
    opacity(strike3, st > 0 ? 1 : 0);
    const shatter = go(t, SC.model - 0.5, SC.model - 0.06, E.linear);
    reveal(P3, 'blocks', 1 - shatter, { cols: 9, rows: 16, order: 'random', seed: 11, spread: 0.85 });
  }

  /* ---------- 4 ---------- */
  {
    W4.forEach((w, i) => charIn(w.chars, t, { start: ws(3, i) - 0.03, each: 0.025, dur: 0.32, ease: E.outExpo, from: { y: 1.15 } }));
    const z = ws(3, 3) - 0.02;
    const drop = t < z ? 0 : spring(t - z, { duration: 0.5, bounce: 0.38 });
    opacity(zero4, t >= z ? 1 : 0);
    const sq = squashStretch(t, z + 0.14, { amount: -0.12, duration: 0.4, bounce: 0.35, axis: 'y' });
    css(zero4, 'transform', `translateY(${((1 - drop) * -1100).toFixed(1)}px) scale(${(t > z + 0.14 ? sq.sx : 1).toFixed(4)},${(t > z + 0.14 ? sq.sy : 1).toFixed(4)})`);
    charIn(gen4s.chars, t, { start: ws(3, 5) - 0.03, each: 0.02, dur: 0.35, ease: E.outExpo, from: { y: 1.15 } });
    charIn(img4s.chars, t, { start: ws(3, 6) - 0.03, each: 0.02, dur: 0.35, ease: E.outExpo, from: { y: 1.15 } });
  }

  /* ---------- 5 ---------- */
  {
    xform(codeBg, { y: -260 * Math.max(0, t - SC.code + 0.3) + 40 });
    charIn(just5s.chars, t, { start: ws(4, 0) - 0.04, each: 0.03, dur: 0.3, ease: E.outExpo, from: { y: 1.15 } });
    const c = ws(4, 1) - 0.03;
    const k = clamp((t - c) / 0.2);
    opacity(code5, t >= c ? 1 : 0);
    css(code5, 'transform', `scale(${(1 + 0.45 * (1 - E.snap(k))).toFixed(4)})`);
    css(code5, 'filter', k < 1 && t >= c ? `blur(${(14 * (1 - k)).toFixed(1)}px)` : 'none');
    xform(per5, { s: spring(t - c - 0.15, { duration: 0.35, bounce: 0.5 }) });
  }

  /* ---------- 6 ---------- */
  {
    ev6.forEach((w, i) => charIn(w.chars, t, { start: ws(5, i) - 0.04, each: 0.03, dur: 0.4, ease: E.outExpo, from: { y: 1.1 } }));
    const said = [2, 3, 4, 5].filter((k) => t >= ws(5, k) - 0.03).map((k) => word(5, k).w.replace('.', ''));
    const s = said.join(' ');
    if (is6.textContent !== s) is6.textContent = s;
    charIn(ft6s.chars, t, { start: ws(5, 4) - 0.04, each: 0.05, dur: 0.35, ease: E.outExpo, from: { y: 0.5, blur: 12, op: 0 } });
    const hi = t >= ws(5, 6) - 0.03;
    css(tChar, 'background', hi ? C.cobalt : 'transparent');
    css(tChar, 'color', hi ? C.bone : C.ink);
    xform(ruler6, { x: -60 * Math.max(0, t - SC.ft) });
    const px = PLAY(t);
    xform(play6, { x: px });
    const tc = `t = ${t.toFixed(2)}s`;
    if (tc6.textContent !== tc) tc6.textContent = tc;
  }

  /* ---------- 7 ---------- */
  {
    charIn(now7.chars, t, { start: ws(6, 0) - 0.04, each: 0.02, dur: 0.35, ease: E.outExpo, from: { y: 1.1 } });
    charIn(let7.chars, t, { start: ws(6, 2) - 0.04, each: 0.025, dur: 0.4, ease: E.outExpo, from: { y: 1.1 } });
    const w = sW(t);
    const over = Math.max(0, w - 125) / 125;           // past the font's widest: finish with scale
    wdth(sWord, w);
    css(sWord, 'transform', `scale(${(1 + over).toFixed(4)},${tall(w).toFixed(4)})`);
    opacity(sWord, t >= S7 - 0.02 ? 1 : 0);
    sGhosts.forEach((g, i) => {
      const tg = t - 0.07 * (i + 1);
      wdth(g, sW(tg));
      css(g, 'transform', `scaleY(${tall(sW(tg)).toFixed(4)})`);
      const fade = 1 - go(t, S7 + 0.5, S7 + 1.1, E.out);
      opacity(g, t >= S7 ? (0.65 - i * 0.18) * fade : 0);
    });
  }

  /* ---------- 8 ---------- */
  {
    charIn(fol8.chars, t, { start: ws(7, 0) - 0.05, each: 0.03, dur: 0.4, ease: E.outExpo, from: { y: 1.1 } });
    charIn(the8.chars, t, { start: ws(7, 1) - 0.02, each: 0.04, dur: 0.4, ease: E.outExpo, from: { y: 1.1 } });
    charIn(cam8.chars, t, { start: ws(7, 2) - 0.02, each: 0.03, dur: 0.45, ease: E.outExpo, from: { y: 1.1 } });
    rig8({ x: cam8t.x(t), y: cam8t.y(t), z: cam8t.z(t), rot: cam8t.rot(t) });
    const b = spring(t - ws(7, 2) - 0.1, { duration: 0.4, bounce: 0.3 });
    const out = go(t, PB, PB + 0.3, E.out);
    BR.forEach((el) => { opacity(el, b > 0 ? 1 - out : 0); xform(el, { s: lerp(1.25, 1, b) }); });
    const tcs = `REC  00:00:${String(Math.floor(t)).padStart(2, '0')}:${String(Math.floor((t % 1) * 30)).padStart(2, '0')}`;
    if (rec8.textContent !== tcs) rec8.textContent = tcs;
    place(recDot, 74, 240, Math.floor(t * 2) % 2 ? 1 : 0.0001);
    const said = [0, 1, 2, 3].filter((k) => t >= ws(8, k) - 0.03).map((k) => word(8, k).w);
    const s = said.length ? `${said.join(' ')}…` : '';
    if (wait8.textContent !== s) wait8.textContent = s;
    opacity(wait8, 1 - go(t, SC.trans - 0.05, SC.trans + 0.1, E.out));
    place(dot8, 540, 960, spring(t - ws(8, 1), { duration: 0.5, bounce: 0.3 }) * (1 + 0.15 * Math.sin(Math.max(0, t - ws(8, 1)) * 18)));
  }

  /* ---------- 9 ---------- */
  {
    const a0 = SC.trans + 0.35;
    css(stack9, 'transform', `rotateX(56deg) rotateZ(${(-38 + 10 * go(t, SC.trans, SC.keys, E.out)).toFixed(2)}deg)`);
    cards9.forEach((c, i) => {
      const p = spring(t - a0 - i * 0.2, { duration: 0.45, bounce: 0.3 });
      css(c, 'transform', `translateZ(${(i * 46 + (1 - p) * 700).toFixed(1)}px)`);
      opacity(c, t >= a0 + i * 0.2 ? 1 : 0);
    });
    const spread = go(t, SC.layers, SC.layers + 0.4, E.outExpo);
    if (spread > 0) cards9.forEach((c, i) => css(c, 'transform', `translateZ(${(i * (46 + 40 * spread)).toFixed(1)}px)`));
    charIn(lay9s.chars, t, { start: SC.layers - 0.02, each: 0.025, dur: 0.3, ease: E.outExpo, from: { y: 1.15 } });

    dia9.forEach((d, i) => xform(d, { s: spring(t - SC.keys - i * 0.06, { duration: 0.35, bounce: 0.45 }) }));
    charIn(key9s.chars, t, { start: SC.keys + 0.03, each: 0.02, dur: 0.3, ease: E.outExpo, from: { y: 1.15 } });

    const dr = go(t, SC.graph, SC.graph + 0.6, E.outExpo);
    curve9.setAttribute('stroke-dashoffset', (1 - dr).toFixed(4));
    const hk = go(t, SC.graph + 0.15, SC.graph + 0.45, E.out);
    [hnd1, hnd2].forEach((l) => l.setAttribute('opacity', hk.toFixed(3)));
    knobs9.forEach((k, i) => k.setAttribute('r', (16 * spring(t - SC.graph - 0.2 - i * 0.08, { duration: 0.35, bounce: 0.5 })).toFixed(2)));
    charIn(gr9s.chars, t, { start: SC.graph + 0.03, each: 0.02, dur: 0.3, ease: E.outExpo, from: { y: 1.15 } });

    charIn(ren9s.chars, t, { start: SC.render - 0.02, each: 0.025, dur: 0.3, ease: E.outExpo, from: { y: 1.15 } });
    const r = Math.max(0, t - SC.render);
    css(bar9, 'transform', `scaleX(${(0.004 + 0.02 * r).toFixed(4)})`);
    const eta = 3 * 3600 + 25 * 60 + 12 + Math.floor(r * 37);
    const e = `rendering… ${Math.floor(r * 2.4)}%   ETA ${String(Math.floor(eta / 3600)).padStart(2, '0')}:${String(Math.floor(eta / 60) % 60).padStart(2, '0')}:${String(eta % 60).padStart(2, '0')}`;
    if (eta9.textContent !== e) eta9.textContent = e;
  }

  /* ---------- 10 ---------- */
  {
    const a = SC.nope;
    const k = clamp((t - a) / 0.16);
    const sq = squashStretch(t, a + 0.12, { amount: 0.25, duration: 0.45, bounce: 0.4, axis: 'x' });
    const s = (1 + 0.6 * (1 - E.snap(k)));
    css(nope, 'transform', `scale(${(s * (t > a + 0.12 ? sq.sx : 1)).toFixed(4)},${(s * (t > a + 0.12 ? sq.sy : 1)).toFixed(4)})`);
    slices(nopeSl, go(t, SC.loop - 0.22, SC.loop, E.in), t, { reach: 300, seed: 9 });
  }

  /* ---------- 11 ---------- */
  {
    const ang = ANGT(t);
    const r = (ang * Math.PI) / 180;
    const toCentre = go(t, SC.outro - 0.12, SC.outro + 0.05, E.in);
    const rx = RC.x + Math.cos(r) * RC.r * (1 - toCentre), ry = RC.y + Math.sin(r) * RC.r * (1 - toCentre);
    place(run11, rx, ry, spring(t - SC.loop, { duration: 0.35, bounce: 0.4 }));
    arc11.setAttribute('stroke-dashoffset', (360 - clamp(ang + 90, 0, 360)).toFixed(2));
    LW.forEach((w, i) => {
      const hit = t >= w - 0.03;
      css(ticks11[i], 'background', hit ? C.signal : C.rule);
      xform(ticks11[i], { s: hit ? 1 + 0.6 * Math.exp(-9 * (t - w)) : 1 });
      css(labels11[i], 'color', hit ? C.bone : C.mute);
      const next = LW[i + 1] ?? SC.outro - 0.15;
      charIn(big11[i].chars, t, { start: w - 0.04, each: 0.025, dur: 0.3, ease: E.outExpo, from: { y: 1.15 } });
      if (t >= next - 0.12) charOut(big11[i].chars, t, { start: next - 0.12, each: 0.015, dur: 0.18, from: { y: -1.15 } });
    });
    xform(in11, { rot: tween(t, SC.loop, SC.outro, -5, 5, E.inOut), s: tween(t, SC.loop, SC.outro, 1, 1.08, E.inOut) });
  }

  /* ---------- 12 ---------- */
  {
    charIn(made12.chars, t, { start: ws(12, 0) - 0.04, each: 0.025, dur: 0.4, ease: E.outExpo, from: { y: 1.15 } });
    const c = ws(12, 2) - 0.03;
    const w = t < c ? 62 : 62 + 50 * spring(t - c, { duration: 0.55, bounce: 0.4 });
    wdth(word12, w);
    opacity(word12, t >= c ? 1 : 0);
    const k = clamp((t - c) / 0.18);
    xform(word12, { s: 1 + 0.25 * (1 - E.snap(k)) });
    const typed = typewriter(code12txt, 'nothing else', t, { start: ws(12, 3) - 0.04, cps: 15, caret: false });
    xform(per12, { s: spring(t - ws(12, 4) - 0.3, { duration: 0.4, bounce: 0.5 }) });
    opacity(foot12, go(t, ws(12, 4) + 0.8, ws(12, 4) + 1.3, E.out));
    xform(in12, { s: tween(t, SC.outro, DURATION, 1, 1.05, E.out) });
    void typed;
  }
}

const ready = preload().then(async () => {
  M.per1 = centreOf(per1);
  M.per5 = centreOf(per5);
  try {
    const src = await (await fetch('./nocode.js')).text();
    codeBg.textContent = src.split('\n').slice(60, 260).join('\n');
  } catch { codeBg.textContent = ''; }
});

runFilm({ scenes: SCENES, duration: DURATION, render, ready });
