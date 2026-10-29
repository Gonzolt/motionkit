/* promo — a 15 s social promo built from campaigns/launch/brief.json.
 *
 * The brief owns the words: three hooks, two messages, two CTAs. The URL
 * picks one of each (?v=H2-M1-C1), so one film renders every ad variant:
 *
 *   node tools/variants.mjs --film lab/promo --brief campaigns/launch/brief.json --shots
 *   http://localhost:5178/brands/lab/films/promo.html?v=H3-M2-C2&guides
 *
 * Structure: hook (2.4 s, decides the scroll) → message → product → proof →
 * end card. Everything that matters sits inside SAFE.all (clear on TikTok,
 * Reels and Shorts ads) and inside the 4:5 feed crop; ?guides draws both.
 */

import { opacity, css, xform } from '../../../lib/anim.js';
import { runFilm, preload } from '../../../lib/stage.js';
import { film } from '../../../lib/scenes.js';
import { h } from '../../../lib/dom.js';
import { E, go, spring, stagger } from '../../../lib/motion.js';
import { splitText, charIn, countTo } from '../../../lib/type.js';
import { makeGrain, grain, makeDust, dust, makeShine, shine, glow, shake } from '../../../lib/fx.js';
import {
  SAFE, makeGuides, variant, loadBrief, makePhoto, kenBurns, makeBadge, badge,
  makeLowerThird, lowerThird, makeEndCard, endCard, makeSticker, sticker,
} from '../../../lib/promo.js';
import { C, typo, disp, mono } from '../theme.js';

const BRIEF = await loadBrief('../../../campaigns/launch/brief.json');
const V = variant(BRIEF);

const { SCENES, T, Tend, DURATION } = film([
  ['hook', 0.0, 2.4],
  ['message', 2.4, 5.0],
  ['product', 5.0, 9.2],
  ['proof', 9.2, 11.8],
  ['end', 11.8, 15.0],
]);

/* ---------- scaffolding ---------- */

const stage = document.getElementById('stage');
css(stage, 'background', C.ink);
const S = SAFE.all;
const MID = (S.left + S.right) / 2;          // the safe column's centre, not the frame's
const layer = (bg = 'rgba(0,0,0,0)') => {
  const el = h('div', { style: `position:absolute;inset:0;overflow:hidden;background:${bg};visibility:hidden` });
  stage.appendChild(el);
  return el;
};
/* A text block centred in the safe column. */
const block = (parent, y, style, txt = '') => {
  const el = h('div', { style: `position:absolute;left:${S.left}px;width:${S.right - S.left}px;top:${y}px;translate:0 -50%;text-align:center;${style}` }, txt);
  parent.appendChild(el);
  return el;
};

/* ---------- hook: three openings, one shown ---------- */

const LH = layer(C.ink);

// H1 "stop editing": timeline clips stack up, then one strike kills them all
const h1 = h('div', { style: 'position:absolute;inset:0' });
LH.appendChild(h1);
const clipColours = [C.cobalt, C.ember, C.signal, C.mute];
const clips = Array.from({ length: 12 }, (_, i) => {
  const row = i % 4, col = Math.floor(i / 4);
  const el = h('div', {
    style: `position:absolute;left:${S.left + 30 + col * 250}px;top:${760 + row * 74}px;width:${150 + ((i * 37) % 90)}px;height:56px;` +
      `border-radius:10px;background:${clipColours[row]}`,
  });
  h1.appendChild(el);
  return el;
});
const strike = h('div', { style: `position:absolute;left:${S.left}px;top:900px;width:${S.right - S.left}px;height:22px;background:${C.bone};transform-origin:0 50%;rotate:-8deg` });
h1.appendChild(strike);
const h1Text = block(h1, 520, `${typo('big')}color:${C.bone}`);
const h1Split = splitText(h1Text, V.hook.onscreen, { mask: true });

// H2 "this video is code": the frame, then it slides aside for the code
const h2 = h('div', { style: 'position:absolute;inset:0' });
LH.appendChild(h2);
const h2Code = h('div', {
  // left half of the safe column: the frame slides into the right half
  style: `position:absolute;left:${S.left}px;top:760px;width:430px;padding:30px;border-radius:24px;background:${C.panel};` +
    `${mono(21)}color:${C.bone};white-space:pre`,
}, 'export function render(t) {\n  word.style.transform =\n    `scale(${spring(t)})`;\n}');
h2.appendChild(h2Code);
const h2Frame = makePhoto(h2, '../assets/promo/nocode-frame.jpg', { x: S.left + 134, y: 500, w: 500, hgt: 890, radius: 44, bg: C.panel });
const h2Text = block(h2, 380, `${typo('big')}color:${C.signal}`, V.hook.onscreen);

// H3 "0 timelines. 1 function.": two numbers slam in
const h3 = h('div', { style: 'position:absolute;inset:0' });
LH.appendChild(h3);
const [h3a, h3b] = V.hook.onscreen.split('. ').map((s, i) => {
  const [num, ...rest] = s.replace(/\.$/, '').split(' ');
  const row = block(h3, 620 + i * 420, '');
  const n = h('div', { style: `${disp(330, { s: 118 })}color:${i ? C.signal : C.ember}` }, num);
  const w = h('div', { style: `${typo('big')}color:${C.bone};margin-top:-10px` }, rest.join(' '));
  row.append(n, w);
  return { row, n, w };
});
const world3 = h3;

/* ---------- message ---------- */

const LM = layer(C.cobalt);
// one row per sentence: a line break inside a sentence reads as two thoughts
const msgRows = V.message.line.toUpperCase().split(/(?<=\.)\s+/);
// sized from the longest sentence, in Archivo's condensed width, so any brief fits the safe column
const msgSize = Math.min(130, Math.floor((S.right - S.left) / (Math.max(...msgRows.map((r) => r.length)) * 0.56)));
const msgSplit = msgRows.map((line, i) =>
  splitText(block(LM, 760 + (i - (msgRows.length - 1) / 2) * msgSize * 1.12, `${disp(msgSize, { s: 78, lh: 1 })}color:${C.bone};white-space:nowrap;word-spacing:0.18em`), line, { mask: true }));
const maker = makeLowerThird(LM, 'Gonzolt', 'made motionkit, open source', {
  x: S.left + 24, y: 1080, bar: C.signal, type: `${typo('line')}font-weight:900;color:${C.bone}`, small: `${mono(30)}color:${C.bone}`,
});

/* ---------- product: the film itself, in a phone ---------- */

const LP = layer(C.ink);
const dustP = makeDust(LP, 50, C.bone, { seed: 3, size: [2, 6] });
const phone = h('div', { style: `position:absolute;left:${MID - 270}px;top:330px;width:540px;height:900px;border-radius:64px;padding:18px;background:${C.panel};box-shadow:0 40px 80px rgba(0,0,0,0.55)` });
LP.appendChild(phone);
const screenShot = makePhoto(phone, '../assets/promo/nocode-frame.jpg', { x: 18, y: 18, w: 504, hgt: 864, radius: 48 });
const phoneShine = makeShine(screenShot, { kind: 'box', width: 9 });
const free = makeBadge(LP, 'FREE', { x: S.right - 70, y: 420, size: 230, shape: 'burst', bg: C.signal, fg: C.ink, type: `${typo('line')}font-weight:900` });
const codeTag = block(LP, 1180, `${mono(34)}color:${C.signal}`, 'render(t) → mp4');

/* ---------- proof: numbers you can check in the repo ---------- */

const LF = layer(C.ink);
const stats = [[26, 'EFFECTS'], [3, 'CAPTION STYLES'], [0, 'TIMELINES']].map(([n, label], i) => {
  const row = block(LF, 480 + i * 270, '');
  const num = h('div', { style: `${disp(200, { s: 112 })}color:${i === 2 ? C.ember : C.signal}` }, '0');
  const lab = h('div', { style: `${typo('label')}color:${C.bone};letter-spacing:6px` }, label);
  row.append(num, lab);
  return { row, num, n };
});

/* ---------- end card ---------- */

const LE = layer(C.ink);
const logo = h('div', { style: `width:180px;height:180px;border-radius:44px;display:grid;place-items:center;background:${C.signal};${disp(92, { s: 100 })}color:${C.ink}` }, 'mk');
const card = makeEndCard(LE, {
  logo, headline: 'MAKE VIDEOS IN CODE', cta: V.cta.button, handle: 'github.com/Gonzolt/motionkit',
  type: `${typo('big')}`, ctaType: `${typo('line')}font-weight:900`, small: `${mono(30)}`,
  button: C.signal, buttonFg: C.ink, colour: C.bone, top: 300,
});
const bio = makeSticker(LE, `${V.cta.sticker} ↓`, { x: MID, y: S.bottom - 50, bg: C.ember, fg: C.bone, type: `${typo('label')}` });

/* ---------- finish ---------- */

const G = makeGrain(stage);
makeGuides(stage);

const LAYERS = { hook: LH, message: LM, product: LP, proof: LF, end: LE };
const scene = (t) => SCENES.find((s) => t >= s.t0 && t < s.t1)?.id ?? 'end';

/* ---------- render ---------- */

function render(t) {
  const now = scene(t);
  for (const [id, L] of Object.entries(LAYERS)) css(L, 'visibility', id === now ? 'visible' : 'hidden');
  // every scene but the first lands with a short rise: hard cuts, soft landings
  for (const [id, L] of Object.entries(LAYERS)) if (id !== 'hook') xform(L, { y: 90 * (1 - go(t, T(id), T(id, 0.28), E.outExpo)) });

  /* hook */
  css(h1, 'display', V.hook.id === 'H1' ? 'block' : 'none');
  css(h2, 'display', V.hook.id === 'H2' ? 'block' : 'none');
  css(h3, 'display', V.hook.id === 'H3' ? 'block' : 'none');
  if (V.hook.id === 'H1') {
    clips.forEach((c, i) => {
      const p = stagger(t, i, { start: 0.05, each: 0.045, dur: 0.35 });
      opacity(c, Math.min(1, p * 3) * (1 - 0.6 * go(t, 1.25, 1.45)));
      xform(c, { x: -160 * (1 - p) });
    });
    css(strike, 'transform', `scaleX(${go(t, 1.1, 1.3, E.outExpo).toFixed(4)})`);
    h1Split.words.forEach((w, i) => charIn([...w.children], t, { start: 0.15 + i * 0.22, each: 0.02, from: { y: 1.1 } }));
    const sh = shake(t, [1.3], { amp: 18, rot: 1 });
    xform(h1, { x: sh.x, y: sh.y, rot: sh.rot });
  } else if (V.hook.id === 'H2') {
    const slide = go(t, 0.9, 1.5, E.inOutExpo);
    // ends with its right edge inside SAFE.right, clear of the like rail
    xform(h2Frame, { x: 195 * slide, s: 1 - 0.36 * slide, rot: 5 * slide });
    kenBurns(h2Frame, go(t, 0, 2.4, E.linear), { to: { s: 1.08, x: 0, y: -20 } });
    opacity(h2Code, go(t, 1.1, 1.4));
    xform(h2Code, { x: -60 * (1 - go(t, 1.1, 1.6, E.outExpo)) });
    glow(h2Code, 18 * go(t, 1.3, 1.8), C.cobalt);
    opacity(h2Text, go(t, 0.05, 0.25));
    xform(h2Text, { s: 1.25 - 0.25 * spring(t - 0.05, { duration: 0.4, bounce: 0.35 }) });
  } else {
    [h3a, h3b].forEach((r, i) => {
      const t0 = 0.15 + i * 0.85;
      opacity(r.row, t >= t0 ? 1 : 0);
      xform(r.n, { s: t >= t0 ? 1.5 - 0.5 * spring(t - t0, { duration: 0.35, bounce: 0.4 }) : 1 });
      opacity(r.w, go(t, t0 + 0.2, t0 + 0.4));
    });
    const sh = shake(t, [0.15, 1.0], { amp: 16, rot: 0.8 });
    xform(world3, { x: sh.x, y: sh.y, rot: sh.rot });
  }

  /* message: word by word, then the maker's strap */
  msgSplit.flatMap((s) => s.words).forEach((w, i) => charIn([...w.children], t, { start: T('message', 0.1 + i * 0.16), each: 0.018, from: { y: 1.1 } }));
  lowerThird(maker, t, T('message', 1.2), Tend('message', -0.1));

  /* product: the phone settles, the photo pushes in, a shine, the badge */
  const pp = spring(t - T('product'), { duration: 0.6, bounce: 0.2 });
  xform(phone, { y: 220 * (1 - pp), rot: -4 * (1 - pp) });
  kenBurns(screenShot, go(t, T('product'), Tend('product'), E.linear));
  shine(phoneShine, go(t, T('product', 0.8), T('product', 1.6), E.inOut));
  badge(free, t, T('product', 1.5), { hide: now !== 'product' });
  opacity(codeTag, go(t, T('product', 2.2), T('product', 2.5)));
  dust(dustP, t, now === 'product' ? 0.8 : 0);

  /* proof: the numbers count up one after another */
  stats.forEach((s, i) => {
    const a = T('proof', 0.1 + i * 0.35);
    opacity(s.row, go(t, a, a + 0.15));
    countTo(s.num, t, a, a + 0.6, s.n);
  });

  /* end card */
  endCard(card, t, T('end', 0.05));
  sticker(bio, t, T('end', 1.0), { hide: now !== 'end' });

  grain(G, t, 0.1);
}

runFilm({ scenes: SCENES, duration: DURATION, render, ready: preload(['../assets/promo/nocode-frame.jpg']) });
