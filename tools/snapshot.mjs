#!/usr/bin/env node
/* Approve frames once, then catch every change to them.
 *
 *   node tools/snapshot.mjs --film lab/nocode --update      # approve: write snapshots/lab-nocode/
 *   node tools/snapshot.mjs --film lab/nocode               # check against the approved frames
 *   node tools/snapshot.mjs --film lab/nocode --json        # one JSON result; exit 1 if anything changed
 *
 * A change to lib/ ripples into every film, and nobody re-watches every film
 * after every edit. Kinetograph's `snapshot` answers that: approve the frames
 * once, and later runs diff the same frames and point at what moved. Commit
 * snapshots/ next to the film so the approval travels with it.
 *
 * --update takes the frames from --frames / --n, or the middle of each scene,
 * and stores them at --scale (default 0.5) with the times in meta.json. A check
 * always re-renders exactly those times at the stored size. A frame fails when
 * more than --threshold of its pixels (default 0.001 = 0.1 %) moved by more
 * than --tol (default 24 of 255) in any channel. Failures write actual.png and
 * diff.png (changed pixels in red) to out/snapshots/<film>/.
 */

import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, filmUrl, filmWantsGL, startServer, withPage, waitForFilm } from './browser.mjs';
import { reporter, assertFilm, pickTimes } from './report.mjs';
import { grab, scaled, compare } from './pageimage.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = parseArgs(process.argv.slice(2));
const rep = reporter(args);
await assertFilm(ROOT, args.film, rep);

const slug = args.film.replace('/', '-');
const DIR = resolve(args.dir ?? join(ROOT, 'snapshots', slug));
const OUT = resolve(args.out ?? join(ROOT, 'out', 'snapshots', slug));
const UPDATE = args.update !== undefined && args.update !== 'false';
const tag = (t) => `t${t.toFixed(3).replace('.', '_')}.png`;
const rel = (p) => relative(ROOT, p).replaceAll('\\', '/');

let meta;
if (UPDATE) {
  meta = {
    film: args.film,
    width: Number(args.width ?? 1080),
    height: Number(args.height ?? 1920),
    scale: Number(args.scale ?? 0.5),
    tol: Number(args.tol ?? 24),
    threshold: Number(args.threshold ?? 0.001),
    times: null,
  };
} else {
  if (!existsSync(join(DIR, 'meta.json'))) {
    rep.fail('no-snapshot', `no approved frames in ${rel(DIR)}; run with --update first`, 2);
  }
  meta = JSON.parse(await readFile(join(DIR, 'meta.json'), 'utf8'));
  if (args.tol) meta.tol = Number(args.tol);
  if (args.threshold) meta.threshold = Number(args.threshold);
}

const server = await startServer(ROOT, Number(args.serve ?? 5193));
const url = filmUrl(server.port, args.film);
let result;
try {
  result = await withPage({ url, port: Number(args.port ?? 9373), width: meta.width, height: meta.height,
                            gl: filmWantsGL(ROOT, args.film) }, async (cdp) => {
    const film = await waitForFilm(cdp, url);
    const times = meta.times ?? pickTimes(args, film);
    const frames = [];

    if (UPDATE) {
      await rm(DIR, { recursive: true, force: true });
      await mkdir(DIR, { recursive: true });
      for (const t of times) {
        await cdp.eval(`window.PK.frame(${t.toFixed(5)})`, true);
        const file = join(DIR, tag(t));
        await writeFile(file, Buffer.from(await scaled(cdp, await grab(cdp), meta.scale), 'base64'));
        frames.push({ t, file: rel(file) });
        rep.log(`approved ${t.toFixed(2)}s  ${rel(file)}`);
      }
      meta.times = times;
      await writeFile(join(DIR, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
      return { film: args.film, updated: true, dir: rel(DIR), frames };
    }

    await rm(OUT, { recursive: true, force: true });
    for (const t of times) {
      await cdp.eval(`window.PK.frame(${t.toFixed(5)})`, true);
      const actual = await scaled(cdp, await grab(cdp), meta.scale);
      const approvedFile = join(DIR, tag(t));
      if (!existsSync(approvedFile)) {
        frames.push({ t, status: 'missing', message: `${rel(approvedFile)} is gone; run --update` });
        continue;
      }
      const cmp = await compare(cdp, (await readFile(approvedFile)).toString('base64'), actual, meta.tol);
      if (cmp.sizeMismatch) {
        frames.push({ t, status: 'changed', message: `size ${cmp.actual.join('x')} vs approved ${cmp.approved.join('x')}` });
        continue;
      }
      const changed = cmp.ratio > meta.threshold;
      const row = { t, status: changed ? 'changed' : 'same', changedRatio: +cmp.ratio.toFixed(6), bbox: cmp.bbox };
      if (changed) {
        await mkdir(OUT, { recursive: true });
        const a = join(OUT, tag(t).replace('.png', '-actual.png'));
        const d = join(OUT, tag(t).replace('.png', '-diff.png'));
        await writeFile(a, Buffer.from(actual, 'base64'));
        await writeFile(d, Buffer.from(cmp.diff, 'base64'));
        Object.assign(row, { actual: rel(a), diff: rel(d) });
      }
      frames.push(row);
    }
    return { film: args.film, updated: false, dir: rel(DIR), threshold: meta.threshold, frames,
             changed: frames.filter((f) => f.status !== 'same').length };
  });
} finally {
  server.close();
}

if (!rep.json && !result.updated) {
  for (const f of result.frames) {
    const pct = f.changedRatio !== undefined ? ` ${(f.changedRatio * 100).toFixed(3)} % of pixels` : '';
    const where = f.bbox ? ` in ${f.bbox.w}x${f.bbox.h} at ${f.bbox.x},${f.bbox.y}` : '';
    console.log(`${f.status === 'same' ? 'same   ' : 'CHANGED'} ${f.t.toFixed(2)}s${pct}${where}${f.diff ? `  ${f.diff}` : ''}${f.message ? `  ${f.message}` : ''}`);
  }
  console.log(result.changed ? `\n${result.changed} of ${result.frames.length} frames changed` : `\nall ${result.frames.length} frames match`);
}
if (!rep.json && result.updated) console.log(`\n${result.frames.length} frames approved in ${result.dir}`);
rep.done(result, result.changed ? 1 : 0);
