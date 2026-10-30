#!/usr/bin/env node
/* Grab frames to look at closely — single shots, or a contact sheet.
 *
 *   node tools/shot.mjs --film lab/nocode --at 1.2,4.8,9.6
 *   node tools/shot.mjs --film lab/nocode --sheet 12
 *   node tools/shot.mjs --film lab/nocode --scenes      # one per scene
 *   node tools/shot.mjs --film lab/nocode --safe-zone   # social UI guide
 *
 * Same machinery as the export, so what you look at is what will encode. Do
 * NOT use a browser-preview screenshot tool for this: it wedges after a few
 * navigations on these pages and costs minutes each time.
 *
 * Check frames AT REST POINTS AND MID-TRANSITION. Almost every bug found this
 * way was in the middle of a move — a card cropped at 40% of a push, a caption
 * overlapping the tab bar only while the camera was travelling. `--sheet`
 * samples evenly precisely so it cannot miss the middles; `--scenes` samples
 * the rest points.
 */

import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parseArgs, filmUrl, filmWantsGL, startServer, withPage, waitForFilm } from './browser.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = parseArgs(process.argv.slice(2));

if (!args.film && !args.url) {
  console.error('need --film <brand>/<name> (or a raw --url)');
  process.exit(2);
}

const PORT = Number(args.port ?? 9355);
const W = Number(args.width ?? 1080), H = Number(args.height ?? 1920);
const OUT = resolve(args.out ?? join(ROOT, 'out', 'frames', (args.film ?? 'film').replace('/', '-')));

const server = await startServer(ROOT, Number(args.serve ?? 5179));
const url = args.url ?? filmUrl(server.port, args.film, {
  ...(args.debug ? { debug: '' } : {}),
  ...(args['safe-zone'] ? { 'safe-zone': '' } : {}),
});

try {
  await withPage({ url, port: PORT, width: W, height: H, gl: filmWantsGL(ROOT, args.film) }, async (cdp) => {
    const { duration, scenes } = await waitForFilm(cdp, url);

    let times;
    let labels = null;
    if (args.at) {
      times = String(args.at).split(',').map(Number);
    } else if (args.scenes) {
      // A third into each scene: past the transition in, before the one out.
      times = scenes.map((s) => s.t0 + (s.t1 - s.t0) / 3);
      labels = scenes.map((s) => s.id);
    } else {
      const n = Number(args.sheet ?? 9);
      // Half-step in from each end, so the first frame is not frame zero
      // (which is usually black) and the last is not the final fade.
      times = Array.from({ length: n }, (_, i) => ((i + 0.5) / n) * duration);
    }

    await rm(OUT, { recursive: true, force: true });
    await mkdir(OUT, { recursive: true });

    const files = [];
    for (let i = 0; i < times.length; i++) {
      const t = times[i];
      await cdp.eval(`window.PK.frame(${t.toFixed(5)})`, true);
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
      const tag = labels ? `${String(i).padStart(2, '0')}-${labels[i]}` : `t${t.toFixed(2).replace('.', '_')}`;
      const name = join(OUT, `${tag}.png`);
      await writeFile(name, Buffer.from(data, 'base64'));
      files.push({ name, t, label: labels?.[i] });
      console.log(`${t.toFixed(2)}s  ${name}`);
    }

    /* The contact sheet. Reading eight full-size 1080x1920 PNGs one at a time
       is eight round trips and no sense of the film's rhythm; one sheet shows
       the whole cut at a glance and is the thing to review. */
    if (!args.nosheet && files.length > 1) {
      const cols = Number(args.cols ?? Math.min(4, files.length));
      const rows = Math.ceil(files.length / cols);
      const sheet = join(OUT, '_sheet.png');
      const inputs = files.flatMap((f) => ['-i', f.name]);

      // Every tile is scaled to the same width, so a coordinate is just w0 or
      // h0 added to itself. xstack rejects `w0*2`, which is why this is a sum.
      const repeat = (sym, n) => (n === 0 ? '0' : Array(n).fill(sym).join('+'));
      const drawn = files.map((f, i) =>
        `[${i}:v]scale=360:-1,drawtext=text='${(f.label ?? `${f.t.toFixed(1)}s`).replace(/[':\\]/g, '')}':` +
        `x=10:y=10:fontsize=24:fontcolor=white:box=1:boxcolor=black@0.65:boxborderw=8[v${i}]`,
      ).join(';');
      const layout = files.map((_, i) =>
        `${repeat('w0', i % cols)}_${repeat('h0', Math.floor(i / cols))}`).join('|');
      const filter = `${drawn};${files.map((_, i) => `[v${i}]`).join('')}` +
        `xstack=inputs=${files.length}:layout=${layout}:fill=black[out]`;
      const r = spawnSync('ffmpeg', ['-y', ...inputs, '-filter_complex', filter, '-map', '[out]', sheet],
        { encoding: 'utf8' });
      if (r.status === 0) console.log(`\nsheet (${cols}x${rows}): ${sheet}`);
      else console.error(`\ncontact sheet failed; the individual frames are fine.\n${r.stderr.split('\n').slice(-6).join('\n')}`);
    }
  });
} finally {
  server.close();
}
