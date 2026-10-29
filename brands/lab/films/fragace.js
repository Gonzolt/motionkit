/* fragace — every Medal ace on music1, cut with the frag-edit skill. 16:9, 60 fps.
 *
 * Cold open: the finale's ace kill, slow and black-and-white. Colour comes on
 * with the drop into ace 0818; a phone holding ace 0613 pops over its ace and
 * swallows the frame; a burst of the other eleven aces' ace kills, half a beat
 * each; ace 0924 to the song's hard stop, desaturating, then black.
 *
 * music1 has no vocal, so there is no lyric track (frag-edit: clean level plus
 * one signature, the burst). The only text is a small kill counter under the
 * crosshair. No white flashes.
 *
 * Every time comes from fragace.plan.js, which audio/fragace/make_fragace.py
 * writes from the verified kill frames and music1's measured beats. Footage is
 * a JPEG per source frame in out/fragace/<clip>/ (1280x720, shown at 1.5x).
 *
 *   python brands/lab/audio/fragace/make_fragace.py
 *   node tools/shot.mjs   --film lab/fragace --scenes --width 1920 --height 1080
 *   node tools/export.mjs --film lab/fragace --fps 60 --width 1920 --height 1080 --audio out/fragace/mix.m4a
 */

import { opacity, css, xform, alpha, clamp } from '../../../lib/anim.js';
import { runFilm, preload } from '../../../lib/stage.js';
import { fromScenes } from '../../../lib/scenes.js';
import { h } from '../../../lib/dom.js';
import { E, go, track } from '../../../lib/motion.js';
import { speedRamp, shake, dirBlur, flashCheck } from '../../../lib/fx.js';
import { wordAt, makeLyric, lyric, makeCard, card, makeEdgeInk, edgeInk } from '../../../lib/frag.js';
import { C, disp } from '../theme.js';
import { PLAN } from './fragace.plan.js';

const W = 1920, H = 1080;
const FPS = PLAN.fps;
const S = PLAN.sections;
const { SCENES, DURATION } = fromScenes(Object.entries(S).map(([id, [t0, t1]]) => ({ id, t0, t1 })));
const DROP_T = S.a[0];

/* No full-frame flash anywhere; the burst's hard cuts are the only dark/bright
   risk and come at 2.8 a second. Checked here so a retime cannot sneak past 3. */
const BURST_CUTS = PLAN.pieces.filter((p) => p.tag === 'burst').map((p) => p.f0);
const bad = flashCheck(BURST_CUTS);
if (bad.length) throw new Error(`burst cuts too fast for the flash rule: ${JSON.stringify(bad)}`);

/* ---------- the time map ---------- */

const src = (p, t) => p.sa + speedRamp(t, p.keys) - speedRamp(p.fa, p.keys);
const MAIN = [...PLAN.pieces].sort((a, b) => a.show - b.show);
const mainAt = (t) => {
  let cur = MAIN[0];
  for (const p of MAIN) if (t >= p.show) cur = p;
  return cur;
};
const CARD_PIECE = PLAN.pieces.find((p) => p.tag === 'card');
const frameUrl = (clip, n) => `../../../out/fragace/${clip}/f${String(n).padStart(5, '0')}.jpg`;
/** Source frame for piece p at t, kept inside the frames the script extracted. */
function frameOf(p, t) {
  const a = Math.round(src(p, p.f0) * FPS), b = Math.round(src(p, p.f1) * FPS);
  return Math.min(Math.max(a, b), Math.max(Math.min(a, b), Math.round(src(p, t) * FPS)));
}

/* Cuts: a jump cut inside one ace is hidden in a whip; a cut between clips is hard with a kick. */
const CUTS = MAIN.filter((p, i) => i > 0 && p.show > 0).map((p) => {
  const prev = MAIN[MAIN.indexOf(p) - 1];
  return { t: p.show, whip: prev.clip === p.clip };
});
const KILLS = PLAN.kills.filter((k) => !k.burst && k.n > 0);
const BURST_HITS = PLAN.kills.filter((k) => k.burst).map((k) => k.t);
const ACE_HITS = PLAN.kills.filter((k) => k.ace && !k.burst).map((k) => k.t);
const COUNT = KILLS.map((k, i) => ({ w: String(k.n), s: k.t, e: (KILLS[i + 1] && KILLS[i + 1].n > k.n ? KILLS[i + 1].t : k.t + 1.1) }));

/* ---------- layers ---------- */

const stage = document.getElementById('stage');
css(stage, 'background', C.ink);
const world = h('div', { style: 'position:absolute;inset:0;transform-origin:50% 50%' });
const img = h('img', { alt: '', decoding: 'sync', style: `position:absolute;left:0;top:0;width:${W}px;height:${H}px` });
world.appendChild(img);
stage.appendChild(world);

const ink = makeEdgeInk(stage, C.ember, { W, H, depth: 0.05 });

const phone = makeCard(stage, { w: 820, kind: 'phone', paper: C.ink, ink: C.mute, heart: C.ember });
const cardImg = h('img', { alt: '', decoding: 'sync', style: `position:absolute;inset:0;width:${phone.sw}px;height:${phone.sh}px` });
phone.screen.insertBefore(cardImg, phone.big);

const counter = makeLyric(stage, { x: W / 2, y: H / 2 + 92, style: `${disp(58, { s: 80, w: 800, ls: 1 })}` });

const black = h('div', { style: `position:absolute;inset:0;background:${C.ink};visibility:hidden` });
stage.appendChild(black);

/* Black-and-white: the cold open (cut to colour on the drop), and the outro. */
const mono = track([[0, 1], [DROP_T, 1, E.out, 'hold'], [DROP_T + 0.001, 0], [PLAN.monoOut[0], 0], [PLAN.monoOut[1], 1, E.inOut]]);

/* ---------- render ---------- */

const live = new Set();
const decayAfter = (t, times, tau) => {
  let a = 0;
  for (const k of times) if (t >= k) a = Math.max(a, Math.exp(-(t - k) / tau));
  return a;
};

function render(t) {
  live.clear();
  const p = mainAt(t);
  const n = frameOf(p, t);
  const u = frameUrl(p.clip, n);
  if (img.getAttribute('src') !== u) img.setAttribute('src', u);
  live.add(img);

  // cuts: a whip blur either side of a jump cut, a small push-in after every cut
  let whip = 0, kick = 0;
  for (const c of CUTS) {
    const d = t - c.t;
    // the source is usually mid-flick already: a short, light whip is enough to hide the join
    if (c.whip && Math.abs(d) < 0.12) whip = Math.max(whip, Math.exp(-Math.abs(d) / 0.025));
    if (d >= 0 && d < 0.5) kick = Math.max(kick, Math.exp(-d / 0.12));
  }
  dirBlur(img, 40 * whip, 0);

  // kills: a small shake, the ace a little more; the camera never rests at 1.0 so shake has margin
  const sh = shake(t, KILLS.map((k) => k.t), { amp: 9, rot: 0.35, decay: 9 });
  const big = shake(t, ACE_HITS, { amp: 16, rot: 0.6, decay: 6, seed: 3 });
  xform(world, { x: sh.x + big.x, y: sh.y + big.y, rot: sh.rot + big.rot, s: 1.04 + 0.035 * kick });
  const m = mono(t);
  css(world, 'filter', m > 0.001 ? `grayscale(${m.toFixed(3)}) contrast(${(1 + 0.18 * m).toFixed(3)})` : 'none');

  // edge ink: every kill, longer on the aces, lighter through the burst
  const inkAmt = Math.max(
    0.6 * decayAfter(t, KILLS.filter((k) => !k.ace).map((k) => k.t), 0.3),
    0.8 * decayAfter(t, ACE_HITS.filter((k) => k > DROP_T), 0.6),
    0.4 * decayAfter(t, BURST_HITS, 0.22),
  );
  edgeInk(ink, t < S.end[0] ? inkAmt : 0, t);

  // the phone: ace 0613 pops over ace 0818's slow-mo and swallows the frame on the beat
  const cp = CARD_PIECE;
  const portal = card(phone, t, PLAN.card.in, PLAN.card.out, { x: W / 2 + 330, y: H / 2 - 20, frameW: W, frameH: H, tilt: 12, fly: 0.3 });
  if (t >= PLAN.card.in && t < PLAN.card.out) {
    const cu = frameUrl(cp.clip, frameOf(cp, t));
    if (cardImg.getAttribute('src') !== cu) cardImg.setAttribute('src', cu);
    live.add(cardImg);
  }

  // kill counter under the crosshair, 1-5 per ace
  const inAce = (t >= S.a[0] && t < S.burst[0]) || (t >= S.c[0] && t < S.end[0]);
  lyric(counter, t, inAce ? wordAt(COUNT, t, { hold: 0, lead: 1 / 60 }) : null, { base: C.bone, hot: C.ember, glow: alpha(C.ink, 0.9), ghost: false });

  opacity(black, t >= S.end[0] ? 1 : 0);
  return portal;
}

function settle() {
  return Promise.all([...live].filter((im) => im.getAttribute('src')).map((im) => im.decode().catch(() => {})));
}

const first = MAIN[0];
runFilm({ scenes: SCENES, duration: DURATION, render, settle, ready: preload([frameUrl(first.clip, frameOf(first, 0))]), frameW: W, frameH: H });
