/* Captions from the word times, drawn by the film itself.
 *
 * The words a film is cut to (films/<film>.words.js, written by make_vo.py or
 * tools/transcribe.py) are also its captions. One source of truth: re-record
 * the voice and the captions re-time themselves with the picture.
 *
 *   const CAP = makeCaptions(stage, chunk(VO.words), { preset: 'pop', base, accent });
 *   captions(CAP, t);                                   // in render(t)
 *
 * `chunk()` is pure (no DOM), so tools/subs.mjs uses the same breaks for the
 * SRT / VTT / ASS sidecar files. Brand-neutral: the type and colours come in
 * as style strings from the brand's theme.
 */

import { css, opacity, xform } from './anim.js';
import { E, go, spring } from './motion.js';
import { h } from './dom.js';

/* The rules from i-hate-editing/rules/captions.md, as numbers. */
export const RULES = {
  late: 0.08,      // a caption shows this long AFTER the word starts: late is invisible, early is a bug
  gap: 0.35,       // a pause this long starts a new chunk
  maxWords: 3,     // four only when asked for
  minOn: 0.4,      // shorter than this cannot be read: merge with the next chunk
  hold: 0.3,       // how long the last chunk before a pause stays after its last word
};

/* Words that never take the emphasis: emphasis goes to the word carrying the meaning. */
const STOP = new Set(('a an the and or but if so to of in on at by for with is are was were be been am it its ' +
  'this that these those you your i we he she they them my me will can do does did have has had not no as ' +
  'from then than what when which who how why there here all just og i på er det en et som til av for med')
  .split(' '));

const bare = (w) => w.toLowerCase().replace(/[^\p{L}\p{N}%$€£.,]/gu, '').replace(/[.,]+$/, '');
const endsClause = (w) => /[.!?,;:…]["'”’)]*$/.test(w);

/**
 * The one word in `words` that carries the meaning: a number first, else the
 * longest non-stop word, the later one on a tie (English stresses the last
 * content word of a phrase). A lone word gets no emphasis unless it is a
 * number: when every one-word chunk is big, nothing is.
 */
export function pickEmphasis(words) {
  let best = -1, score = 0;
  words.forEach((x, i) => {
    const b = bare(x.w);
    if (!b || STOP.has(b)) return;
    const num = /\d/.test(b);
    if (words.length < 2 && !num) return;
    const s = (num ? 100 : 0) + b.length;
    if (s >= score) { score = s; best = i; }
  });
  return best;
}

/**
 * Words [{w, s, e}] → chunks [{s, e, text, words, emph}] on the same timeline.
 * Breaks on punctuation, then on a pause, then on `maxWords`. `emph` is an
 * index into `words` (-1 for none): pass `emphasis` as a list of words to
 * force it, `false` for none, or leave it to pickEmphasis().
 */
export function chunk(words, { late = RULES.late, gap = RULES.gap, maxWords = RULES.maxWords, minOn = RULES.minOn,
  hold = RULES.hold, emphasis = null } = {}) {
  const groups = [];
  let cur = [];
  words.forEach((x, i) => {
    cur.push(x);
    const next = words[i + 1];
    const pause = next ? next.s - x.e >= gap : true;
    const newLine = next && next.line !== undefined && next.line !== x.line;
    if (!next || endsClause(x.w) || pause || newLine || cur.length >= maxWords) {
      groups.push(cur);
      cur = [];
    }
  });

  // A flash of two short words cannot be read: fold it into its neighbour,
  // unless that breaks the ceiling by more than one word.
  for (let i = 0; i < groups.length - 1; i++) {
    const g = groups[i], n = groups[i + 1];
    const on = n[0].s - g[0].s;
    if (on < minOn && g.length + n.length <= maxWords + 1 && n[0].s - g[g.length - 1].e < gap) {
      groups.splice(i, 2, [...g, ...n]);
      i--;
    }
  }

  const want = Array.isArray(emphasis) ? new Set(emphasis.map(bare)) : null;
  return groups.map((g, i) => {
    const next = groups[i + 1];
    const s = g[0].s + late;
    const lastE = g[g.length - 1].e + late;
    // Stay up until the next chunk replaces it, or `hold` past the last word.
    const e = next ? Math.min(next[0].s + late, Math.max(lastE + hold, s + minOn)) : Math.max(lastE + hold, s + minOn);
    let emph = -1;
    if (want) emph = g.findIndex((x) => want.has(bare(x.w)));
    else if (emphasis !== false) emph = pickEmphasis(g);
    return { s, e, text: g.map((x) => x.w).join(' '), words: g.map((x) => ({ w: x.w, s: x.s + late, e: x.e + late })), emph };
  });
}

/* Readable over any picture without a box behind it: a dark outline from
 * every side plus one drop. Neutral black, so it belongs to no brand. */
export const OUTLINE = 'text-shadow:0 0 9px rgba(0,0,0,0.9),3px 3px 0 rgba(0,0,0,1),-3px -3px 0 rgba(0,0,0,1),' +
  '3px -3px 0 rgba(0,0,0,1),-3px 3px 0 rgba(0,0,0,1),5px 6px 0 rgba(0,0,0,0.55);';

/* Inside the TikTok / Reels clear area (lib/stage.js) on a 1080x1920 frame:
 * below the face line, left of the like rail, above the description. */
export const SAFE_BOX = { left: 90, right: 870, y: 1380 };

/**
 * Build every chunk once (hidden). Presets:
 *   pop      words land one by one as spoken, the emphasis word bigger and in the accent, with an overshoot
 *   karaoke  the whole chunk up at once, each word lights in the accent as it is spoken
 *   line     the whole chunk fades and rises in, no per-word motion: calm, for explainers
 *
 * `base` is the type for every word (font, size, colour) from the brand's
 * theme; `accent` the emphasis colour; `emphScale` how much bigger it is.
 * `y` is the line's centre in frame px; `box` its left/right edges.
 */
export function makeCaptions(parent, chunks, { preset = 'pop', base = '', accent = 'rgba(255,255,255,1)',
  emphScale = 1.25, y = SAFE_BOX.y, box = SAFE_BOX, outline = true, upper = true } = {}) {
  if (!PRESETS[preset]) throw new Error(`no caption preset "${preset}" — have: ${Object.keys(PRESETS).join(', ')}`);
  const layer = h('div', { 'aria-hidden': 'true', style: 'position:absolute;inset:0;pointer-events:none' });
  parent.appendChild(layer);
  const lines = chunks.map((c) => {
    const el = h('div', {
      style: `position:absolute;left:${box.left}px;width:${box.right - box.left}px;top:${y}px;translate:0 -50%;` +
        `text-align:center;visibility:hidden;${upper ? 'text-transform:uppercase;' : ''}${base};${outline ? OUTLINE : ''}`,
    });
    const spans = c.words.map((x, i) => {
      const sp = h('span', { style: 'display:inline-block;transform-origin:50% 70%' }, x.w);
      if (i === c.emph) css(sp, 'font-size', `${emphScale}em`);
      el.appendChild(sp);
      if (i < c.words.length - 1) el.appendChild(document.createTextNode(' '));
      return sp;
    });
    layer.appendChild(el);
    return { c, el, spans };
  });
  return { layer, lines, preset, accent };
}

const PRESETS = {
  pop(L, t, accent) {
    opacity(L.el, 1);
    xform(L.el, {});
    L.spans.forEach((sp, i) => {
      const x = L.c.words[i];
      const up = t >= x.s;
      opacity(sp, up ? 1 : 0);
      if (!up) return;
      // the emphasis word overshoots harder: motion is what makes it authored
      const k = i === L.c.emph ? 0.28 : 0.12;
      const s = 1 + k * (1 - spring(t - x.s, { duration: 0.32, bounce: 0.45 }));
      xform(sp, { s: Math.max(0.6, s), y: 14 * (1 - go(t, x.s, x.s + 0.12, E.out)) });
      css(sp, 'color', i === L.c.emph ? accent : '');
    });
  },
  karaoke(L, t, accent) {
    opacity(L.el, go(t, L.c.s, L.c.s + 0.08, E.out));
    L.spans.forEach((sp, i) => {
      const x = L.c.words[i];
      const lit = t >= x.s;
      css(sp, 'color', lit ? accent : '');
      xform(sp, { s: lit && t < x.e + 0.05 ? 1.08 : 1 });
    });
  },
  line(L, t) {
    const p = go(t, L.c.s, L.c.s + 0.22, E.out);
    opacity(L.el, Math.min(p, 1 - go(t, L.c.e - 0.12, L.c.e, E.in)));
    xform(L.el, { y: 18 * (1 - p) });
  },
};

/** Draw the captions for time `t`. A chunk is up from its `s` to its `e`; nothing else is. */
export function captions(cap, t, { hide = false } = {}) {
  const draw = PRESETS[cap.preset];
  for (const L of cap.lines) {
    const on = !hide && t >= L.c.s && t < L.c.e;
    css(L.el, 'visibility', on ? 'visible' : 'hidden');
    if (on) draw(L, t, cap.accent);
  }
}
