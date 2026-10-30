#!/usr/bin/env node
/* Look at a move the way an animator does: many frames, close together.
 *
 *   node tools/strip.mjs --film lab/motionlab --from 2.5 --to 3.3 --fps 15
 *   node tools/strip.mjs --film lab/motionlab --from 7.9 --to 8.5 --fps 20 --cols 10
 *   node tools/strip.mjs --film lab/motionlab --from 2.9 --to 3.6 --fps 60 --probe '#word'
 *   node tools/strip.mjs --film lab/motionlab --from 2.5 --to 3.3 --probe '#word' --json
 *
 * WHY. A contact sheet (`shot.mjs --sheet`) is for the whole film's rhythm. It
 * cannot see a 0.3 s transition: at 12 sheet frames over 14 s you may get ONE
 * frame inside it. Judging easing, overshoot, blur and shape from that is
 * guessing. This samples a window at the rate you choose (15–30 fps shows the
 * shape of a move; 60 shows every frame the viewer gets) and lays the frames
 * out in time order with their timestamps.
 *
 * --probe <css selector> also measures that element in every frame — its box
 * (centre x/y, width, height) and opacity, in frame pixels — and tells you what
 * the motion actually did: how long it took, when it was halfway, whether it
 * overshot, and which of the standard curves it resembles. Numbers beat
 * squinting at frames when the question is "is this ease-out or ease-in-out?"
 */

import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parseArgs, filmUrl, filmWantsGL, startServer, withPage, waitForFilm } from './browser.mjs';
import { reporter, assertFilm } from './report.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = parseArgs(process.argv.slice(2));
const rep = reporter(args);
await assertFilm(ROOT, args.film, rep);
const result = { film: args.film, frames: [], strip: null, probe: null };

const PORT = Number(args.port ?? 9361);
const W = Number(args.width ?? 1080), H = Number(args.height ?? 1920);
const OUT = resolve(args.out ?? join(ROOT, 'out', 'strips', args.film.replace('/', '-')));
const TILE = Number(args.tile ?? 270);
const sel = args.probe ? args.probe.replace(/^['"]|['"]$/g, '') : null;

const server = await startServer(ROOT, Number(args.serve ?? 5183));
const url = filmUrl(server.port, args.film);

try {
  await withPage({ url, port: PORT, width: W, height: H, gl: filmWantsGL(ROOT, args.film) }, async (cdp) => {
    const { duration } = await waitForFilm(cdp, url);
    const from = Number(args.from ?? 0), to = Math.min(Number(args.to ?? Math.min(duration, from + 1)), duration);
    const fps = Number(args.fps ?? 15);
    const n = Math.max(2, Math.round((to - from) * fps) + 1);
    const times = Array.from({ length: n }, (_, i) => from + i / fps);

    await rm(OUT, { recursive: true, force: true });
    await mkdir(OUT, { recursive: true });

    const files = [], samples = [];
    for (let i = 0; i < times.length; i++) {
      const t = times[i];
      await cdp.eval(`window.PK.frame(${t.toFixed(5)})`, true);
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 88, fromSurface: true });
      const name = join(OUT, `f${String(i).padStart(4, '0')}.jpg`);
      await writeFile(name, Buffer.from(data, 'base64'));
      files.push({ name, t });
      result.frames.push({ t, file: name });
      if (sel) {
        const m = await cdp.eval(`(() => {
          const el = document.querySelector(${JSON.stringify(sel)});
          if (!el) return null;
          const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
          return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height,
                   o: parseFloat(cs.opacity), v: cs.visibility !== 'hidden' };
        })()`);
        samples.push({ t, ...(m ?? { x: NaN, y: NaN, w: NaN, h: NaN, o: NaN, v: false }) });
      }
    }

    /* ---- the strip ---- */
    const cols = Number(args.cols ?? Math.min(8, files.length));
    const rows = Math.ceil(files.length / cols);
    const sheet = join(OUT, '_strip.png');
    const inputs = files.flatMap((f) => ['-i', f.name]);
    const repeat = (sym, k) => (k === 0 ? '0' : Array(k).fill(sym).join('+'));
    const drawn = files.map((f, i) =>
      `[${i}:v]scale=${TILE}:-1,drawtext=text='${f.t.toFixed(3)}':x=8:y=8:fontsize=22:fontcolor=white:` +
      `box=1:boxcolor=black@0.7:boxborderw=6[v${i}]`).join(';');
    const layout = files.map((_, i) => `${repeat('w0', i % cols)}_${repeat('h0', Math.floor(i / cols))}`).join('|');
    const filter = `${drawn};${files.map((_, i) => `[v${i}]`).join('')}xstack=inputs=${files.length}:layout=${layout}:fill=black[out]`;
    const r = spawnSync('ffmpeg', ['-y', ...inputs, '-filter_complex', filter, '-map', '[out]', sheet], { encoding: 'utf8' });
    if (r.status !== 0) rep.warn(r.error ? `strip sheet skipped: ffmpeg did not run (${r.error.code ?? r.error.message}); the frames are in ${OUT}`
                                         : r.stderr.split('\n').slice(-6).join('\n'));
    else result.strip = sheet, rep.log(`strip ${files.length} frames @ ${fps} fps, ${from.toFixed(2)}–${to.toFixed(2)} s (${cols}x${rows}): ${sheet}`);

    /* ---- the probe ---- */
    if (sel) {
      if (samples.every((s) => Number.isNaN(s.x))) {
        rep.warn(`\nprobe: nothing matches ${sel}`);
        result.probe = { selector: sel, matched: false };
      } else {
        await writeFile(join(OUT, 'probe.csv'),
          ['t,x,y,w,h,opacity', ...samples.map((s) => [s.t, s.x, s.y, s.w, s.h, s.o].map((v) => +v.toFixed(3)).join(','))].join('\n'));
        result.probe = { selector: sel, matched: true, csv: join(OUT, 'probe.csv'), ...report(samples, fps) };
      }
    }
  });
} finally {
  server.close();
}
rep.done(result);

/* Which channel moved most, and what shape did that movement have? */
function report(samples, fps) {
  const chans = ['x', 'y', 'w', 'h', 'o'];
  const range = (k) => {
    const v = samples.map((s) => s[k]).filter((x) => !Number.isNaN(x));
    return v.length ? Math.max(...v) - Math.min(...v) : 0;
  };
  // Opacity is 0…1 so it needs weighting up to compete with pixels.
  const scored = chans.map((k) => ({ k, r: range(k), score: range(k) * (k === 'o' ? 500 : 1) }));
  const main = scored.sort((a, b) => b.score - a.score)[0];
  rep.log('\nprobe', sel);
  rep.log('  ' + scored.map((c) => `${c.k}: Δ${c.r.toFixed(1)}`).join('   '));
  if (main.r < 0.5 && main.k !== 'o') { rep.log('  nothing moved in this window'); return { moved: false }; }
  if (main.k === 'o' && main.r < 0.01) { rep.log('  nothing moved in this window'); return { moved: false }; }

  const v = samples.map((s) => s[main.k]);
  const a = v[0], b = v[v.length - 1];
  const span = b - a;
  const prog = v.map((x) => (x - a) / (span || 1));
  const t0 = samples[0].t;
  const firstMove = samples.find((s, i) => Math.abs(prog[i]) > 0.02);
  const when = (p) => { const i = prog.findIndex((q) => q >= p); return i < 0 ? null : samples[i].t; };
  const tStart = firstMove ? firstMove.t : t0, t50 = when(0.5), t90 = when(0.9), t98 = when(0.98);
  const over = Math.max(...prog) - 1;

  // Peak speed, from finite differences of the main channel.
  let peak = 0, peakT = t0;
  for (let i = 1; i < v.length; i++) {
    const sp = Math.abs(v[i] - v[i - 1]) * fps;
    if (sp > peak) { peak = sp; peakT = (samples[i].t + samples[i - 1].t) / 2; }
  }

  const f = (x) => (x === null ? '—' : x.toFixed(3) + ' s');
  rep.log(`  channel ${main.k}: ${a.toFixed(1)} → ${b.toFixed(1)}`);
  rep.log(`  starts ${f(tStart)}   50 % ${f(t50)}   90 % ${f(t90)}   98 % ${f(t98)}`);
  rep.log(`  peak speed ${peak.toFixed(0)} /s at ${peakT.toFixed(3)} s   overshoot ${(over * 100).toFixed(1)} %`);

  let kind = null;
  if (t50 !== null && t98 !== null && t98 > tStart) {
    const half = (t50 - tStart) / (t98 - tStart);
    const peakFrac = (peakT - tStart) / (t98 - tStart);
    if (over > 0.03) kind = 'springs / overshoots';
    else if (half < 0.22) kind = 'very strong ease-out (expo): most of the travel at the start';
    else if (half < 0.36) kind = 'ease-out';
    else if (half < 0.6 && peakFrac > 0.3 && peakFrac < 0.7) kind = 'ease-in-out (symmetric)';
    else if (half >= 0.6) kind = 'ease-in: slow start — avoid for anything entering';
    else kind = 'close to linear';
    rep.log(`  50 % at ${(half * 100).toFixed(0)} % of the move, peak speed at ${(peakFrac * 100).toFixed(0)} %  →  ${kind}`);
  }
  // A one-line plot, so the curve can be read without opening the CSV.
  const bars = '▁▂▃▄▅▆▇█';
  const line = prog.map((p) => bars[Math.max(0, Math.min(7, Math.round(p * 7)))]).join('');
  rep.log(`  ${line}`);
  rep.log(`  csv: ${join(OUT, 'probe.csv')}`);
  return { moved: true, channel: main.k, from: a, to: b, start: tStart, t50, t90, t98,
           peakSpeed: +peak.toFixed(1), peakAt: +peakT.toFixed(3), overshoot: +over.toFixed(4), curve: kind };
}
