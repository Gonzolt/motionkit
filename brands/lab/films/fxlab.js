/* fxlab — every effect in lib/fx.js and every caption preset in lib/captions.js.
 *
 * A catalogue like motionlab: one technique per scene, hard cuts between
 * them so what you judge is the effect, not the transition.
 *
 *   node tools/shot.mjs  --film lab/fxlab --scenes
 *   node tools/strip.mjs --film lab/fxlab --from 3.6 --to 4.3 --fps 30
 *
 * The captions scene re-uses the nocode voiceover's word times, shifted onto
 * this film's timeline: the same words.js a real film would caption from.
 */

import { opacity, css, xform } from '../../../lib/anim.js';
import { runFilm, preload } from '../../../lib/stage.js';
import { film } from '../../../lib/scenes.js';
import { h } from '../../../lib/dom.js';
import { E, go, pulse, spring } from '../../../lib/motion.js';
import {
  makeGrain, grain, makeVignette, makeScanlines, scanlines, rgbSplit, makeFlash, flashAt, flashCheck,
  makeLeaks, leaks, makeFlare, flare, makeZoomBlur, zoomBlur, makeWarp, warp, makeRing, ring,
  makeSparks, sparks, makeSpeedLines, speedLines, makeGrade, GRADES, makeDuotone,
} from '../../../lib/fx.js';
import { chunk, makeCaptions, captions } from '../../../lib/captions.js';
import { VO } from './nocode.words.js';
import { C, typo } from '../theme.js';

const { SCENES, T, Tend, at: scene, DURATION } = film([
  ['finish', 0.0, 2.0],
  ['split', 2.0, 4.0],
  ['light', 4.0, 6.4],
  ['zoom', 6.4, 8.2],
  ['warp', 8.2, 10.4],
  ['hit', 10.4, 12.6],
  ['grade', 12.6, 14.8],
  ['pop', 14.8, 17.6],
  ['karaoke', 17.6, 20.4],
  ['line', 20.4, 23.2],
]);

/* Flashes are checked before a frame is drawn: more than 3 a second is a
   photosensitivity hazard (WCAG 2.3.1), and it fails here, not in review. */
const FLASHES = [T('split', 0.5), T('split', 1.2), T('hit', 0.4)];
const bad = flashCheck(FLASHES);
if (bad.length) throw new Error(`too many flashes: ${JSON.stringify(bad)}`);

/* ---------- scaffolding ---------- */

const stage = document.getElementById('stage');
const layer = (bg) => {
  const el = h('div', { style: `position:absolute;inset:0;overflow:hidden;background:${bg};visibility:hidden` });
  stage.appendChild(el);
  return el;
};
const center = (parent, y, style, txt) => {
  const box = h('div', { style: `position:absolute;left:0;right:0;top:${y}px;translate:0 -50%;text-align:center` });
  const el = h('span', { style: `display:inline-block;white-space:nowrap;${style}` }, txt);
  box.appendChild(el);
  parent.appendChild(box);
  return el;
};
const label = (parent, txt, colour) =>
  parent.appendChild(h('div', { style: `position:absolute;left:70px;top:170px;${typo('label')}color:${colour}` }, txt));

/* ---------- 1 finish: grain, vignette, scanlines ---------- */

const L1 = layer(C.cobalt);
label(L1, '01  grain · vignette · scanlines', C.bone);
center(L1, 900, `${typo('giant')}color:${C.bone}`, 'FILM');
const vig = makeVignette(L1);

/* ---------- 2 split: rgb split + flash on the beat ---------- */

const L2 = layer(C.ink);
label(L2, '02  rgb split + flash', C.mute);
const hitWord = center(L2, 900, `${typo('giant')}color:${C.bone}`, 'HIT');
const flashEl = makeFlash(L2);

/* ---------- 3 light: leaks + anamorphic flare ---------- */

const L3 = layer(C.ink);
label(L3, '03  light leaks + flare', C.mute);
center(L3, 900, `${typo('huge')}color:${C.bone}`, 'GLOW');
const leak = makeLeaks(L3, [C.bone, C.ember]);
const fl = makeFlare(L3, { tint: C.cobalt, ghost: C.signal });

/* ---------- 4 zoom: radial punch-in ---------- */

const L4 = layer(C.signal);
label(L4, '04  zoom blur', C.ink);
const zWord = center(L4, 900, `${typo('giant')}color:${C.ink};transform-origin:50% 50%`, 'PUNCH');
const zb = makeZoomBlur(zWord, 7);
const zStack = zWord.parentNode; // the word and its copies: scale them together

/* ---------- 5 warp: heat, then boil ---------- */

const L5 = layer(C.ink);
label(L5, '05  warp: heat → boil', C.mute);
const heatWord = center(L5, 760, `${typo('huge')}color:${C.ember}`, 'HEAT');
const boilWord = center(L5, 1080, `${typo('huge')}color:${C.signal}`, 'BOIL');
const heat = makeWarp(heatWord.parentNode, { freq: 0.01, mode: 'heat' });
const boil = makeWarp(boilWord.parentNode, { freq: 0.03, octaves: 1, mode: 'boil' });

/* ---------- 6 hit: ring + sparks + speed lines ---------- */

const L6 = layer(C.panel);
label(L6, '06  ring + sparks + speed lines', C.mute);
const lines6 = makeSpeedLines(L6, C.bone, { cy: 47 });
const ring6 = makeRing(L6, C.signal);
const spark6 = makeSparks(L6, 28, C.signal, { seed: 4 });
const hitWord6 = center(L6, 900, `${typo('huge')}color:${C.bone}`, 'BANG');
const flash6 = makeFlash(L6, C.signal);

/* ---------- 7 grade: one picture, three looks ---------- */

const L7 = layer(C.ink);
label(L7, '07  grade: none · teal/orange · duotone', C.mute);
const tealG = makeGrade('fx-teal', GRADES.tealOrange);
const duo = makeDuotone('fx-duo', C.cobalt, C.signal);
// a "picture" that has shadows, mids and highlights in it, so a grade shows
const swatch = (y, f) => {
  const el = h('div', {
    style: `position:absolute;left:90px;right:90px;top:${y}px;height:360px;border-radius:24px;filter:${f};` +
      `background:linear-gradient(90deg, ${C.ink}, ${C.ember} 30%, ${C.bone} 55%, ${C.cobalt} 80%, ${C.signal})`,
  });
  L7.appendChild(el);
  return el;
};
swatch(330, 'none');
swatch(780, `${tealG} contrast(1.08) saturate(1.3)`);
swatch(1230, duo);

/* ---------- 8–10 captions: the three presets ---------- */

/* The nocode voiceover's words 3.7–9.6 s ("No After Effects. No video model.
   Not one generated image. Just code."), moved to start at scene `id`. */
const capsFor = (id) => {
  const from = 3.7, until = 9.6, at0 = T(id, 0.2);
  const words = VO.words.filter((w) => w.s >= from && w.e <= until)
    .map((w) => ({ ...w, s: w.s - from + at0, e: w.e - from + at0 }));
  return chunk(words);
};
const capBase = `${typo('line')}font-weight:900;color:${C.bone}`;
const CAP_SCENES = ['pop', 'karaoke', 'line'];
const capLayers = CAP_SCENES.map((preset, i) => {
  const L = layer(i === 1 ? C.cobalt : C.ink);
  label(L, `${String(8 + i).padStart(2, '0')}  captions: ${preset}`, C.mute);
  center(L, 700, `${typo('big')}color:${C.mute}`, 'picture');
  return { L, cap: makeCaptions(L, capsFor(preset), { preset, base: capBase, accent: C.signal, emphScale: 1.4 }) };
});

/* The finish sits over every scene: grain is on the whole film. */
const G = makeGrain(stage);
// Scanlines go OVER the grain: a pattern under a blended layer stalls the export.
const scan = makeScanlines(stage);

const LAYERS = [L1, L2, L3, L4, L5, L6, L7, ...capLayers.map((c) => c.L)];

/* ---------- render ---------- */

function render(t) {
  LAYERS.forEach((L, i) => css(L, 'visibility', t >= SCENES[i].t0 && t < SCENES[i].t1 ? 'visible' : 'hidden'));

  // 1 finish: the grain swells in, the vignette closes, the lines roll
  grain(G, t, t < Tend('finish') ? 0.12 + 0.2 * go(t, 0, T('finish', 1.2), E.inOut) : 0.12);
  opacity(vig, 0.4 + 0.5 * go(t, 0, T('finish', 1.4), E.inOut));
  scanlines(scan, t < Tend('finish') ? 0.35 : 0, t);

  // 2 split: two hits, each a split that snaps back and a white frame
  const hit2 = Math.max(...FLASHES.slice(0, 2).map((h) => (t >= h ? Math.exp(-(t - h) / 0.12) : 0)));
  rgbSplit(hitWord, 28 * hit2, 3 * hit2);
  xform(hitWord, { s: 1 + 0.12 * hit2 });
  opacity(flashEl, flashAt(t, FLASHES.slice(0, 2), { len: 0.1, peak: 0.85 }));

  // 3 light: a leak burns across, the flare follows it
  const lp = pulse(t, T('light', 0.2), Tend('light', -0.2), 0.5, 0.8);
  leaks(leak, lp, t);
  flare(fl, pulse(t, T('light', 0.6), Tend('light', -0.3), 0.3, 0.6), 200 + 700 * go(t, T('light'), Tend('light'), E.inOut), 640);

  // 4 zoom: the word punches in; the blur follows the zoom's speed
  const zp = spring(t - T('zoom', 0.3), { duration: 0.5, bounce: 0.25 });
  xform(zStack, { s: 0.3 + 0.7 * zp });
  zoomBlur(zb, Math.max(0, 1 - zp) * (t > T('zoom', 0.3) ? 1 : 0), { reach: 0.5 });

  // 5 warp: heat drifts all the time; boil shudders
  warp(heat, 18, t);
  warp(boil, 10, t, { hz: 12 });

  // 6 hit: everything fires on one frame
  const h6 = T('hit', 0.4);
  ring(ring6, t, h6, { x: 540, y: 900, r1: 820, dur: 0.6 });
  sparks(spark6, t, h6, { x: 540, y: 900, spread: 300, speed: 1700 });
  speedLines(lines6, t >= h6 ? Math.exp(-(t - h6) / 0.9) : 0, t);
  opacity(flash6, flashAt(t, [h6], { len: 0.08, peak: 0.6 }));
  xform(hitWord6, { s: t >= h6 ? 1.35 - 0.35 * spring(t - h6, { duration: 0.4, bounce: 0.4 }) : 0.001 });

  // 8–10 captions: only the scene that is up draws its own
  capLayers.forEach(({ cap }, i) => {
    const s = scene(CAP_SCENES[i]);
    captions(cap, t, { hide: t < s.t0 || t >= s.t1 });
  });
}

runFilm({ scenes: SCENES, duration: DURATION, render, ready: preload() });
