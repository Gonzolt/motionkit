/* Timing for lab/nocode, derived from the voiceover's word timestamps.
 *
 * ONE source of truth for picture and sound: scene boundaries, camera hits and
 * the sound-effect track all come from this file, and the words come from
 * whisper (brands/lab/audio/nocode/make_vo.py). Re-record the voice and the
 * whole film re-times itself. Pure module: no DOM, so node can import it too
 * (tools: `node -e "import('./nocode.cues.js').then(m=>console.log(JSON.stringify(m.CUES)))"`).
 */

import { VO } from './nocode.words.js';

/** Word k (0-based) of voiceover line n: { s, e, w }. Throws if the script changed. */
export function word(n, k) {
  const ws = VO.words.filter((w) => w.line === n);
  if (!ws[k]) throw new Error(`no word ${k} in line ${n} (${VO.lines[n]?.text})`);
  return ws[k];
}
const s = (n, k) => word(n, k).s;
/* Picture lands a frame before the sound: the eye reads a cut faster than the
   ear reads a consonant, so a cut exactly on the word looks late. */
const LEAD = 1 / 30;
export const on = (n, k) => s(n, k) - LEAD;

export const DURATION = Math.round(VO.duration * 30) / 30;

export const SC = {
  hook:    0,
  okay:    on(1, 0) - 0.06,
  noae:    on(2, 0) - 0.05,
  model:   on(3, 0) - 0.05,
  code:    on(4, 0) - 0.05,
  ft:      on(5, 0) - 0.06,
  stretch: on(6, 0) - 0.06,
  camera:  on(7, 0) - 0.06,
  trans:   on(8, 4),               // "transition." starts the clock sweep
  layers:  on(9, 0),
  keys:    on(9, 1),
  graph:   on(9, 2),
  render:  on(9, 4),
  nope:    on(10, 0),
  loop:    on(11, 0) - 0.08,
  outro:   on(12, 0) - 0.12,
  end:     DURATION,
};

/* Every hit the viewer should FEEL: the picture punches (camera shake + zoom)
   and the sound track puts a matching effect on the same frame.
   kind: hit (thump+click), slam (bigger hit), whoosh (noise sweep), tick,
         rubber (pitch-bend for the stretch), riser (into the transition) */
export const CUES = [
  { t: s(0, 0), kind: 'slam', amp: 1.0 },
  { t: s(0, 1), kind: 'hit', amp: 0.6 },
  { t: SC.okay, kind: 'whoosh', amp: 0.7 },
  { t: s(1, 0), kind: 'hit', amp: 0.7 },
  { t: s(1, 1), kind: 'hit', amp: 0.8 },
  { t: SC.noae - 0.12, kind: 'whoosh', amp: 0.6 },
  { t: s(2, 2), kind: 'whoosh', amp: 0.5 },
  { t: s(2, 4), kind: 'slam', amp: 0.9 },
  { t: SC.model, kind: 'hit', amp: 0.6 },
  { t: s(3, 1), kind: 'tick', amp: 0.6 },
  { t: s(3, 2), kind: 'tick', amp: 0.6 },
  { t: s(3, 3), kind: 'slam', amp: 1.0 },
  { t: SC.code - 0.15, kind: 'whoosh', amp: 0.6 },
  { t: s(4, 1), kind: 'slam', amp: 1.0 },
  { t: SC.ft - 0.1, kind: 'whoosh', amp: 0.7 },
  { t: s(5, 6), kind: 'hit', amp: 0.5 },
  { t: SC.stretch - 0.12, kind: 'whoosh', amp: 0.8 },
  { t: s(6, 4), kind: 'rubber', amp: 1.0 },
  { t: SC.camera, kind: 'hit', amp: 0.6 },
  { t: s(7, 1) - 0.1, kind: 'whoosh', amp: 0.8 },
  { t: s(7, 2) - 0.1, kind: 'whoosh', amp: 0.9 },
  { t: s(7, 2) + 0.12, kind: 'hit', amp: 0.6 },
  { t: s(8, 0), kind: 'riser', amp: 0.8, until: SC.trans + 0.5 },
  { t: SC.trans + 0.5, kind: 'slam', amp: 0.8 },
  { t: SC.layers, kind: 'slam', amp: 0.9 },
  { t: SC.keys, kind: 'slam', amp: 0.8 },
  { t: SC.graph, kind: 'slam', amp: 0.8 },
  { t: SC.render, kind: 'slam', amp: 0.9 },
  { t: SC.nope, kind: 'slam', amp: 1.2 },
  { t: s(11, 0), kind: 'tick', amp: 0.9 },
  { t: s(11, 1), kind: 'tick', amp: 0.9 },
  { t: s(11, 2), kind: 'tick', amp: 0.9 },
  { t: s(11, 3), kind: 'tick', amp: 0.9 },
  { t: SC.outro, kind: 'whoosh', amp: 0.9 },
  { t: s(12, 2), kind: 'slam', amp: 1.0 },
  { t: s(12, 4), kind: 'hit', amp: 0.8 },
];
