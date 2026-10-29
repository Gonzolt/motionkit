/* fraglab — the gaming-edit pieces in lib/frag.js, one per scene, on stand-in
 * footage. Landscape 1920x1080, because that is what all six reference edits
 * were (the frag-edit skill has the breakdown).
 *
 * The "footage" is a gradient room, a crosshair and a gun block in the bottom
 * right that swings: enough to judge type over a shot, a word behind the gun,
 * a card portal and a repetition burst without shipping real clips.
 *
 *   node tools/shot.mjs  --film lab/fraglab --scenes --width 1920 --height 1080
 *   node tools/strip.mjs --film lab/fraglab --from 3.4 --to 4.4 --fps 30 --width 1920 --height 1080
 */

import { opacity, css, xform, alpha } from '../../../lib/anim.js';
import { runFilm, preload } from '../../../lib/stage.js';
import { film } from '../../../lib/scenes.js';
import { h } from '../../../lib/dom.js';
import { E, go, track } from '../../../lib/motion.js';
import { makeFlash, flashAt, flashCheck, makeRing, ring, shake } from '../../../lib/fx.js';
import {
  wordAt, grow, stutter, segAt, polyAt, clipTo, makeLyric, lyric, makeScribble, scribble,
  makeCard, card, makeEdgeInk, edgeInk,
} from '../../../lib/frag.js';
import { C, disp, typo } from '../theme.js';

const W = 1920, H = 1080, CX = W / 2, CY = H / 2;

const { SCENES, T, Tend, DURATION } = film([
  ['lyric', 0.0, 3.4],
  ['behind', 3.4, 6.0],
  ['scribble', 6.0, 9.0],
  ['card', 9.0, 12.0],
  ['burst', 12.0, 14.0],
  ['ink', 14.0, 17.4],
]);

/* ---------- timing, all from the scene table ---------- */

const LYRICS = [
  { w: 'MAKE', s: T('lyric', 0.3), e: T('lyric', 0.6) },
  { w: 'ME', s: T('lyric', 0.75), e: T('lyric', 0.95) },
  { w: 'YOUR', s: T('lyric', 1.2), e: T('lyric', 1.6), accent: 'only' },
];
const READY = { parts: ['REA', 'DY'], times: [T('lyric', 2.0), T('lyric', 2.25)], accent: 'for?', accentAt: T('lyric', 2.55) };
const SWING = [T('behind', 0.2), T('behind', 1.3)];          // the gun swings up across the word twice
const SCRIB = { draw: [T('scribble', 1.0), T('scribble', 1.3)], swap: T('scribble', 1.55) };
const CARD = { in: T('card', 0.4), like: T('card', 1.2), out: T('card', 2.2) };
// rooms of similar brightness only: a dark/bright alternation 10 times a second is a strobe (flashCheck counts it)
const BURST = stutter(Array.from({ length: 12 }, (_, i) => ({ clip: [0, 1, 3][i % 3], src: 0.05 })), { t0: T('burst', 0.4), each: 0.1, pre: 0.05 });
const DROP = T('ink', 0.5);
const KILLS = [T('ink', 1.0), T('ink', 1.6), T('ink', 2.2)];
const SYL = KILLS.map((s, i) => ({ w: ['ya', 'sa', 'shi'][i], s, e: s + 0.3 }));

const FLASHES = [DROP];
const bad = flashCheck(FLASHES);
if (bad.length) throw new Error(`too many flashes: ${JSON.stringify(bad)}`);

/* ---------- stand-in footage ---------- */

const stage = document.getElementById('stage');
const layer = () => {
  const el = h('div', { style: `position:absolute;inset:0;overflow:hidden;background:${C.ink};visibility:hidden` });
  stage.appendChild(el);
  return el;
};
const ROOMS = [[C.cobalt, C.mute], [C.ember, C.panel], [C.signal, C.rule], [C.mute, C.cobalt]];

/** A gradient room, a crosshair, and a gun block bottom-right. pose(t) moves the gun. */
function makeShot(parent, room, { w = W, hgt = H } = {}) {
  const el = h('div', { style: `position:absolute;left:0;top:0;width:${w}px;height:${hgt}px;overflow:hidden;` +
    `background:linear-gradient(180deg, ${room[0]} 0%, ${room[1]} 58%, ${C.panel} 100%)` });
  el.appendChild(h('div', { style: `position:absolute;left:0;right:0;top:58%;bottom:0;background:linear-gradient(180deg, ${alpha(C.ink, 0.2)}, ${alpha(C.ink, 0.6)})` }));
  el.appendChild(h('div', { style: `position:absolute;left:${w / 2 - 3}px;top:${hgt / 2 - 3}px;width:6px;height:6px;border-radius:50%;background:${C.bone}` }));
  const gun = h('div', { style: `position:absolute;left:0;top:0;width:${w * 0.34}px;height:${hgt * 0.15}px;border-radius:${hgt * 0.04}px;` +
    `background:linear-gradient(180deg, ${C.mute}, ${C.panel});box-shadow:0 0 0 ${Math.round(w / 300)}px ${C.ink} inset;transform-origin:85% 50%` });
  el.appendChild(gun);
  parent.appendChild(el);
  return { el, gun, w, hgt };
}
/** Gun pose in frame px: resting low right, swung up and left across the centre during a swing. */
function gunPose(t, swings = []) {
  let u = 0;
  for (const s of swings) u = Math.max(u, go(t, s, s + 0.25, E.out) * (1 - go(t, s + 0.45, s + 0.8, E.inOut)));
  return { x: 1180 - 520 * u, y: 860 - 420 * u, rot: -8 - 26 * u };
}
const placeGun = (S, p) => xform(S.gun, { x: p.x * S.w / W, y: p.y * S.hgt / H, rot: p.rot });
/** The gun's four corners in % of the frame: what you would key by hand on real footage. */
function gunPoly(p) {
  const gw = W * 0.34, gh = H * 0.15, ox = gw * 0.85, oy = gh / 2, r = p.rot * Math.PI / 180;
  return [[0, 0], [gw, 0], [gw, gh], [0, gh]].map(([x, y]) => {
    const dx = x - ox, dy = y - oy;
    return [(p.x + ox + dx * Math.cos(r) - dy * Math.sin(r)) / W * 100, (p.y + oy + dx * Math.sin(r) + dy * Math.cos(r)) / H * 100];
  });
}

const BIG = `${disp(260, { s: 68, ls: 2 })}text-transform:uppercase;`;
const ACCENT = `${disp(96, { w: 500, s: 90, ls: 0 })}font-style:italic;color:${C.signal};`;
const label = (parent, txt) =>
  parent.appendChild(h('div', { style: `position:absolute;left:60px;top:50px;${typo('label')}color:${C.bone};opacity:0.8` }, txt));

/* ---------- 1 lyric: one word at a time, a syllable build, script accents ---------- */

const L1 = layer();
const shot1 = makeShot(L1, ROOMS[0]);
const ly1 = makeLyric(L1, { x: CX, y: CY, style: BIG, accentStyle: ACCENT });
label(L1, '01  lyric word · syllable build · accent');

/* ---------- 2 behind: the word sits between the shot and a clipped copy of it ---------- */

const L2 = layer();
const under2 = makeShot(L2, ROOMS[1]);
const ly2 = makeLyric(L2, { x: CX, y: CY - 40, style: BIG });
const over2 = makeShot(L2, ROOMS[1]);
// hand keys every 0.1 s, as you would set them on real footage; polyAt fills the frames between
const KEYS2 = Array.from({ length: 27 }, (_, i) => T('behind', i * 0.1)).map((t) => [t, gunPoly(gunPose(t, SWING))]);
label(L2, '02  text behind the gun');

/* ---------- 3 scribble: a marker strike becomes the next word ---------- */

const L3 = layer();
css(L3, 'background', C.bone);
const words3 = h('div', { style: `position:absolute;left:0;right:0;top:${CY - 150}px;text-align:center;${disp(150, { s: 100, w: 900, lh: 1 })}color:${C.ink}` });
const first3 = h('span', { style: 'display:inline-block;position:relative' }, 'THAT');
words3.append(first3, h('span', {}, '  YOU'), h('br'), h('span', {}, 'NEED  IT'));
L3.appendChild(words3);
const scrib3 = makeScribble(L3, C.cobalt, { passes: 5, seed: 4 });
label(L3, '03  marker scribble swap');
css(L3.lastChild, 'color', C.ink);

/* ---------- 4 card: a post holding the next shot, then it swallows the frame ---------- */

const L4 = layer();
const shot4a = makeShot(L4, ROOMS[2]);
const shot4b = makeShot(L4, ROOMS[3]);
const card4 = makeCard(L4, { w: 460, kind: 'post', paper: C.bone, ink: C.ink, heart: C.ember });
const inCard = makeShot(card4.screen, ROOMS[3], { w: card4.sw, hgt: card4.sh });
card4.screen.insertBefore(inCard.el, card4.big);
label(L4, '04  card portal');

/* ---------- 5 burst: the same move from many rounds, 3 frames each ---------- */

const L5 = layer();
const shots5 = ROOMS.map((r) => makeShot(L5, r));
const ring5 = makeRing(L5, C.signal);
label(L5, '05  repetition burst');

/* ---------- 6 ink: monochrome until the drop, ink and a syllable on every kill ---------- */

const L6 = layer();
const world6 = h('div', { style: 'position:absolute;inset:0' });
L6.appendChild(world6);
const shot6 = makeShot(world6, ROOMS[1]);
const ink6 = makeEdgeInk(L6, C.cobalt, { W, H });
const syl6 = makeLyric(L6, { x: CX, y: CY + 70, style: `${disp(44, { s: 100, w: 700 })}text-transform:lowercase;` });
const flash6 = makeFlash(L6);
label(L6, '06  mono → colour · edge ink · crosshair syllables');
const mono6 = track([[T('ink'), 1], [DROP, 1, E.out, 'hold'], [DROP + 0.01, 0]]);

const LAYERS = { lyric: L1, behind: L2, scribble: L3, card: L4, burst: L5, ink: L6 };

/* ---------- render ---------- */

function render(t) {
  for (const [id, el] of Object.entries(LAYERS)) opacity(el, t >= T(id) && t < Tend(id) ? 1 : 0);

  // 1 lyric
  placeGun(shot1, gunPose(t));
  const w1 = wordAt(LYRICS, t, { hold: 0.35, lead: 1 / 30 });
  const r1 = grow(READY.parts, READY.times, t);
  const cue1 = w1 ?? (r1 && t < Tend('lyric') ? { text: r1, t0: READY.times[0], accent: t >= READY.accentAt ? READY.accent : null } : null);
  lyric(ly1, t, cue1, { base: C.bone, hot: C.signal, glow: alpha(C.bone, 0.55), accentDelay: cue1 === w1 ? 0.07 : READY.accentAt - READY.times[0] });

  // 2 behind
  const p2 = gunPose(t, SWING);
  placeGun(under2, p2);
  placeGun(over2, p2);
  lyric(ly2, t, t >= T('behind', 0.05) ? { text: 'ENEMY', t0: T('behind', 0.05) } : null, { base: C.ember, ghost: false });
  clipTo(over2.el, polyAt(KEYS2, t));

  // 3 scribble: draw over THAT, then the strike turns into RIGHT in the marker's colour
  const r = first3.getBoundingClientRect(), s = stage.getBoundingClientRect(), k = s.width / W;
  const box3 = { x: (r.left - s.left) / k, y: (r.top - s.top) / k + 20, w: r.width / k, h: r.height / k - 40 };
  scribble(scrib3, go(t, SCRIB.draw[0], SCRIB.draw[1], E.inOut), box3, { out: go(t, SCRIB.swap, SCRIB.swap + 0.12) });
  first3.textContent = t >= SCRIB.swap ? 'RIGHT' : 'THAT';
  css(first3, 'color', t >= SCRIB.swap ? C.cobalt : C.ink);

  // 4 card
  placeGun(shot4a, gunPose(t));
  placeGun(inCard, gunPose(t, [CARD.like]));
  const portal = card(card4, t, CARD.in, CARD.out, { x: CX + 420, y: CY - 30, frameW: W, frameH: H, like: CARD.like });
  opacity(shot4b.el, portal >= 1 ? 1 : 0);
  placeGun(shot4b, gunPose(t, [CARD.like]));

  // 5 burst: show the segment's shot, the move (a ring) lands 0.05 s into each one
  const b = segAt(BURST, t);
  shots5.forEach((sh, i) => opacity(sh.el, (b ? b.seg.clip : 0) === i ? 1 : 0));
  if (b) placeGun(shots5[b.seg.clip], gunPose(b.src + 10, [10.05]));
  ring(ring5, t, b ? b.seg.t0 + 0.05 : -9, { x: CX, y: CY, r0: 10, r1: 260, dur: 0.3, width: 10 });

  // 6 ink
  css(shot6.el, 'filter', mono6(t) > 0 ? `grayscale(${mono6(t)}) contrast(1.15)` : 'none');
  placeGun(shot6, gunPose(t, KILLS.map((k6) => k6 - 0.15)));
  const last = KILLS.filter((k6) => t >= k6).pop();
  edgeInk(ink6, last ? Math.exp(-(t - last) / 0.35) : 0, t);
  const sh = shake(t, KILLS, { amp: 14, rot: 0.6 });
  xform(world6, { x: sh.x, y: sh.y, rot: sh.rot, s: 1.02 });
  lyric(syl6, t, wordAt(SYL, t, { hold: 0.45 }), { base: C.bone, hot: C.signal, ghost: false });
  opacity(flash6, flashAt(t, FLASHES, { len: 0.1, peak: 0.6 }));
}

runFilm({ scenes: SCENES, duration: DURATION, render, ready: preload(), frameW: W, frameH: H });
