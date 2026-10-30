#!/usr/bin/env node
/* A motion path in one image: frames of a range stacked like onion skin.
 *
 *   node tools/onion.mjs --film lab/motionlab --range 2.5..3.3            # 6 frames
 *   node tools/onion.mjs --film lab/motionlab --from 2.5 --to 3.3 --n 10
 *   node tools/onion.mjs --film lab/nocode --range 9..10 --blend darken --json
 *
 * strip.mjs lays a move out frame by frame, which is right for timing. This
 * answers the other question — what path did it take, did it arc, where did it
 * overshoot — by stacking the frames: older poses fade, the newest is
 * brightest. Same idea as Kinetograph's `onion`.
 *
 * --range a..b is a to b inclusive (a..=b also works); --n frames, evenly
 * spaced. --blend lighten (dark films) or darken (light films); the default
 * picks from the first frame. --fade (0–1, default 0.28) is how much each
 * older pose dims per step.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, filmUrl, filmWantsGL, startServer, withPage, waitForFilm } from './browser.mjs';
import { reporter, assertFilm } from './report.mjs';
import { grab, onion } from './pageimage.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = parseArgs(process.argv.slice(2));
const rep = reporter(args);
await assertFilm(ROOT, args.film, rep);

let from = args.from !== undefined ? Number(args.from) : null;
let to = args.to !== undefined ? Number(args.to) : null;
if (args.range) {
  const m = /^\s*([\d.]+)\s*\.\.=?\s*([\d.]+)\s*$/.exec(args.range);
  if (!m) rep.fail('bad-range', `--range wants a..b in seconds, got "${args.range}"`, 2);
  [from, to] = [Number(m[1]), Number(m[2])];
}
const N = Math.max(2, Number(args.n ?? 6));
const W = Number(args.width ?? 1080), H = Number(args.height ?? 1920);

const server = await startServer(ROOT, Number(args.serve ?? 5195));
const url = filmUrl(server.port, args.film);
let result;
try {
  result = await withPage({ url, port: Number(args.port ?? 9375), width: W, height: H,
                            gl: filmWantsGL(ROOT, args.film) }, async (cdp) => {
    const { duration } = await waitForFilm(cdp, url);
    const a = Math.max(0, from ?? 0);
    const b = Math.min(duration, to ?? Math.min(duration, a + 1));
    if (!(b > a)) rep.fail('bad-range', `empty range ${a}..${b} (film is ${duration.toFixed(2)} s)`, 2);
    const times = Array.from({ length: N }, (_, i) => +(a + (i / (N - 1)) * (b - a)).toFixed(4));
    const frames = [];
    for (const t of times) {
      await cdp.eval(`window.PK.frame(${t.toFixed(5)})`, true);
      frames.push(await grab(cdp));
    }
    const label = `${a.toFixed(2)}–${b.toFixed(2)} s · ${N} frames`;
    const img = await onion(cdp, frames, { blend: args.blend ?? 'auto', fade: Number(args.fade ?? 0.28), label });
    const out = resolve(args.out ?? join(ROOT, 'out', 'onion', `${args.film.replace('/', '-')}-${a.toFixed(2)}-${b.toFixed(2)}.png`));
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, Buffer.from(img.png, 'base64'));
    return { film: args.film, from: a, to: b, n: N, times, blend: img.blend,
             out: relative(ROOT, out).replaceAll('\\', '/') };
  });
} finally {
  server.close();
}

rep.log(`onion ${result.n} frames ${result.from.toFixed(2)}–${result.to.toFixed(2)} s (${result.blend}): ${result.out}`);
rep.done(result);
