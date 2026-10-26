/* motionlab — one short film that uses every primitive in lib/motion*.
 *
 * It is a catalogue, not an ad: each scene shows one technique and the shape
 * that carries the cut into the next. Look at it with
 *
 *   node tools/shot.mjs  --film lab/motionlab --sheet 16
 *   node tools/strip.mjs --film lab/motionlab --from 2.5 --to 3.3 --fps 15
 *
 * and read the code beside the frames. Each scene also names the one trick a
 * new film should steal from it.
 */

import { opacity, css, xform } from '../../../lib/anim.js';
import { runFilm, preload } from '../../../lib/stage.js';
import { film } from '../../../lib/scenes.js';
import { h } from '../../../lib/dom.js';
import { E, go, tween, spring, pulse, speed } from '../../../lib/motion.js';
import { splitText, charIn, squashStretch, typewriter, scramble } from '../../../lib/type.js';
import { dirBlur, makeEchoes, echoes, makeSlices, slices } from '../../../lib/fx.js';
import { reveal, pushThrough } from '../../../lib/transitions.js';
import { makeRig, camera, cameraBlur } from '../../../lib/rig.js';
import { C, typo } from '../theme.js';

const { SCENES, T, DURATION } = film([
  ['rise',    0.0,  2.6],
  ['stretch', 2.6,  4.5],
  ['fan',     4.5,  6.3],
  ['blocks',  6.3,  7.9],
  ['world',   7.9, 11.2],
  ['type',   11.2, 13.8],
]);

/* ---------- scaffolding ---------- */

const stage = document.getElementById('stage');

const layer = (bg) => {
  const el = h('div.layer', { style: `position:absolute;inset:0;overflow:hidden;background:${bg}` });
  stage.appendChild(el);
  return el;
};
const at = (parent, x, y, extra, ...kids) => {
  const el = h('div', {
    style: `position:absolute;left:${x}px;top:${y}px;translate:-50% -50%;white-space:nowrap;${extra ?? ''}`,
  }, ...kids);
  parent.appendChild(el);
  return el;
};
const label = (parent, text, colour) =>
  parent.appendChild(h('div', { style: `position:absolute;left:70px;top:170px;${typo('label')}color:${colour}` }, text));

/* ---------- 1  rise : masked per-character rise ---------- */

const L1 = layer(C.ink);
label(L1, '01  masked rise', C.mute);
const riseBox = h('div', {
  style: 'position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:0 70px;gap:6px',
});
L1.appendChild(riseBox);
const riseLines = [['MOTION', C.bone], ['HAS', C.bone], ['WEIGHT', C.signal]].map(([w, colour]) => {
  const line = h('div', { style: `${typo('huge')}color:${colour}` });
  riseBox.appendChild(line);
  return splitText(line, w, { mask: true });
});
// The dot that the next transition grows out of exists in THIS scene first.
const dot1 = at(L1, 880, 1560, `width:44px;height:44px;border-radius:50%;background:${C.signal}`);

/* ---------- 2  stretch : squash & stretch + directional blur + echoes ---------- */

const L2 = layer(C.signal);
label(L2, '02  squash + stretch', C.ink);
const wordBox = at(L2, 540, 900, 'text-align:center');
const word = h('span', { id: 'word', style: `${typo('huge')}color:${C.ink};display:inline-block;transform-origin:50% 60%` }, 'STRETCH');
wordBox.appendChild(word);
const trail = makeEchoes(word, 3, { stroke: 3 });
const sub = at(L2, 540, 1130, `${typo('line')}color:${C.ink}`, 'sx = 1 + a·(1 − spring)  ·  sy = 1/sx');
// The square that the fan transition opens from.
const sq2 = at(L2, 200, 420, `width:40px;height:40px;background:${C.ink}`);

/* ---------- 3  fan : wedge transition + blur-in characters ---------- */

const L3 = layer(C.ink);
label(L3, '03  fan  +  blur-in', C.mute);
const ring = at(L3, 540, 1010, `width:820px;height:820px;border-radius:50%;border:16px solid ${C.cobalt}`);
const fanLines = [['SHAPES', C.bone, 600], ['DO THE', C.mute, 800], ['CUTTING', C.signal, 1000]].map(([w, colour, y]) => {
  const line = at(L3, 540, y, `${typo('huge')}color:${colour}`);
  return splitText(line, w);
});

/* ---------- 4  blocks : hard pixel-block wipe + scramble ---------- */

const L4 = layer(C.cobalt);
label(L4, '04  blocks  +  scramble', C.bone);
const scr = at(L4, 540, 820, `${typo('huge')}color:${C.bone}`);
const typed4 = at(L4, 540, 1050, `${typo('line')}color:${C.bone}`);

/* ---------- 5  world : one camera over a space of type and shapes ---------- */

const L5 = layer(C.bone);
const world = h('div', { style: 'position:absolute;inset:0;transform-origin:50% 50%' });
L5.appendChild(world);
const w5 = (x, y, style, ...kids) => at(world, 540 + x, 960 + y, style, ...kids);
w5(0, -250, `${typo('giant')}color:${C.ink}`, 'ZOOM');
w5(0, 170, `width:700px;height:700px;border-radius:50%;border:22px solid ${C.cobalt}`);
w5(-330, 450, `width:260px;height:260px;border-radius:50%;background:${C.ember}`);
w5(0, -30, `${typo('line')}color:${C.ink}`, 'move + zoom + roll');
w5(1500, 120, `${typo('giant')}color:${C.ink}`, 'WHIP');
w5(1850, -300, `width:420px;height:420px;border-radius:50%;background:${C.signal}`);
w5(1500, 380, `${typo('line')}color:${C.ink}`, 'inOutExpo · blur from speed');
w5(750, 600, `width:2600px;height:8px;background:${C.ink}`);
const L5label = label(L5, '05  camera', C.ink);
const rig = makeRig(world);
const t5 = T('world');
const cam = camera({
  z:   [[t5, 1.0], [t5 + 1.2, 1.3, E.outExpo], [t5 + 1.9, 1.3], [t5 + 2.4, 0.78, E.inOutExpo]],
  x:   [[t5, -50], [t5 + 1.2, 0, E.outExpo], [t5 + 1.9, 0], [t5 + 2.4, 1500, E.inOutExpo]],
  y:   [[t5, 70], [t5 + 1.2, -230, E.outExpo], [t5 + 1.9, -230], [t5 + 2.4, 140, E.inOutExpo]],
  rot: [[t5, -3], [t5 + 1.2, 0, E.outExpo], [t5 + 1.9, 0], [t5 + 2.2, 4, E.inOutExpo], [t5 + 3.0, 0, E.outExpo]],
}, [{ at: t5 + 2.4, amp: 26, seed: 2 }], { handheld: 3 });

/* ---------- 6  type : inset reveal + slice smear + typewriter ---------- */

const L6 = layer(C.ink);
label(L6, '06  slice  +  typewriter', C.mute);
const sliceWordBox = at(L6, 540, 760, 'text-align:center');
const sliceWord = h('span', { style: `${typo('giant')}color:${C.bone};display:inline-block` }, 'SLICE');
sliceWordBox.appendChild(sliceWord);
const sl = makeSlices(sliceWord, 9);
const typed6 = at(L6, 540, 1040, `${typo('line')}color:${C.signal}`);

/* ---------- one frame ---------- */

const LAYERS = [L1, L2, L3, L4, L5, L6];

function render(t) {
  /* --- transitions: p of each incoming layer, eased with its own curve --- */
  const pStretch = go(t, T('stretch'), T('stretch', 0.42), E.outQuart);
  const pFan = go(t, T('fan'), T('fan', 0.55), E.inOutExpo);
  const pBlocks = go(t, T('blocks'), T('blocks', 0.42), E.inOut);
  const pWorld = go(t, T('world'), T('world', 0.55), E.inOut);
  const pType = go(t, T('type'), T('type', 0.6), E.inOutExpo);

  reveal(L1, 'disc', 1);
  reveal(L2, 'disc', pStretch, { x: 880, y: 1560, r0: 22 });
  reveal(L3, 'fan', pFan, { x: 200, y: 420, angle: 62 });
  reveal(L4, 'blocks', pBlocks, { cols: 8, rows: 14, order: 'radial', grow: false });
  reveal(L5, 'bars', pWorld, { n: 6, dir: 'v', shuffle: true, seed: 4, spread: 0.7 });
  reveal(L6, 'inset', pType, { from: { x: 440, y: 860, w: 200, h: 200 }, radius: 90 });

  // The outgoing layer keeps travelling while it is covered, then is switched
  // off — five full-frame layers is a lot to composite for no visible gain.
  pushThrough(L1, pStretch, { dy: -70, scale: 0.06 });
  pushThrough(L2, pFan, { dx: 90, dy: 40, scale: 0.05 });
  pushThrough(L3, pBlocks, { scale: 0.08 });
  pushThrough(L4, pWorld, { dy: 60, scale: 0.04 });
  pushThrough(L5, pType, { scale: 0.06 });
  [[L1, pStretch], [L2, pFan], [L3, pBlocks], [L4, pWorld], [L5, pType]]
    .forEach(([l, next]) => { if (next >= 1) css(l, 'visibility', 'hidden'); });

  /* --- 1 rise --- */
  riseLines.forEach(({ chars }, i) => {
    charIn(chars, t, { start: T('rise', 0.12 + i * 0.2), each: 0.035, dur: 0.8, ease: E.outExpo, from: { y: 1.2 } });
  });
  const drift1 = go(t, 0, T('rise', 2.6), (x) => x);
  xform(riseBox, { s: 1 + 0.035 * drift1 });
  xform(dot1, { s: spring(t - T('rise', 1.85), { duration: 0.45, bounce: 0.35 }) });

  /* --- 2 stretch --- */
  const s0 = T('stretch', 0.3);
  const st = (u) => squashStretch(u, s0, { amount: 0.3, duration: 0.65, bounce: 0.3 });
  const { sx, sy } = st(t);
  css(word, 'transform', `scale(${sx.toFixed(4)},${sy.toFixed(4)})`);
  opacity(word, t >= s0 ? 1 : 0);
  // blur = how fast the word's edges are travelling, not a number that looked right
  dirBlur(word, Math.min(20, Math.abs(speed((u) => st(u).sx, t)) * 480 * 0.014), 0);
  const settle = 1 - spring(t - s0, { duration: 0.65, bounce: 0.3 });
  echoes(trail, t >= s0 ? Math.max(0, settle) : 0, { dx: -70, sx, sy, fade: 0.7 });
  opacity(sub, go(t, s0 + 0.5, s0 + 0.9, E.out));
  xform(sub, { y: tween(t, s0 + 0.5, s0 + 0.9, 18, 0, E.out) });
  xform(sq2, { s: spring(t - T('stretch', 1.4), { duration: 0.4, bounce: 0.3 }) });

  /* --- 3 fan --- */
  xform(ring, { s: 0.55 + 0.45 * spring(t - T('fan', 0.25), { duration: 0.8, bounce: 0.25 }) });
  fanLines.forEach(({ chars }, i) => {
    charIn(chars, t, {
      start: T('fan', 0.3 + i * 0.16), each: 0.045, dur: 0.6, ease: E.outQuart,
      from: { y: 0.3, blur: 16, op: 0 }, order: 'random', seed: 3 + i,
    });
  });

  /* --- 4 blocks --- */
  scramble(scr, 'BLOCKS', t, { start: T('blocks', 0.3), dur: 0.7, seed: 7 });
  typewriter(typed4, 'hard cells · radial order · 0.4 s', t, { start: T('blocks', 0.8), cps: 36 });

  /* --- 5 world --- */
  rig(cam(t));
  cameraBlur(world, cam, t, { k: 0.014 });

  /* --- 6 type --- */
  slices(sl, pulse(t, T('type', 0.9), T('type', 1.5), 0.08, 0.4, E.out, E.out), t, { reach: 150 });
  typewriter(typed6, 'every frame is a function of t', t, { start: T('type', 1.2), cps: 24 });
}

runFilm({ scenes: SCENES, duration: DURATION, render, ready: preload() });
