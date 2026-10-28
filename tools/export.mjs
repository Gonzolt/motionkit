#!/usr/bin/env node
/* Turn a film into a video. One exporter, every brand.
 *
 * Drives a headless Chromium over the DevTools protocol: seek to a frame, draw
 * it synchronously, grab it, hand it straight to ffmpeg's stdin. Nothing
 * touches the disk between the browser and the encoder, and because every
 * frame is a pure function of one number, the same command always produces the
 * same video.
 *
 *   node tools/export.mjs --film lab/nocode
 *   node tools/export.mjs --film lab/motionlab --fps 30
 *   node tools/export.mjs --film lab/nocode --from 6 --to 11   # one beat
 *   node tools/export.mjs --film lab/nocode --audio brands/lab/audio/nocode/mix.m4a
 *   node tools/export.mjs --film lab/motionlab --fps 30 --blur 6          # real motion blur
 *
 * --blur N renders N sub-frames inside each output frame's shutter-open time
 * and averages them, which is what a camera does. Everything blurs by its own
 * speed — type, shapes, a rotating camera, a wipe edge — with no per-effect
 * code. Cost is N times the render. --shutter 0.5 is a 180° shutter (default);
 * 0.25 is crisper, 1.0 smears fully. 6 is enough for 30 fps; use 8–12 at 60.
 *
 * ~10 s of film per minute of wall clock at 60 fps. Review contact sheets and
 * strips (shot.mjs, strip.mjs) first; an export is the slow last step.
 */

import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm, mkdir, copyFile, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findChrome, parseArgs, chromeFlags, filmUrl, filmWantsGL, startServer, CDP, waitForBrowser } from './browser.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = parseArgs(process.argv.slice(2));

if (!args.film && !args.url) {
  console.error('need --film <brand>/<name> (or a raw --url)');
  process.exit(2);
}

const FPS = Number(args.fps ?? 60);
const PORT = Number(args.port ?? 9333);
const CRF = args.crf ?? '17';
/* Frames go to the encoder as JPEG at quality 100 rather than PNG. Chromium
   spends ~660 ms encoding a 1080x1920 PNG and ~130 ms on the JPEG, which is
   the difference between a forty-minute export and a ten-minute one; the
   frames are thrown at H.264 4:2:0 afterwards anyway, so there is nothing
   left to preserve. --format png is there for the one time you need it. */
const FORMAT = args.format ?? 'jpeg';
const W = Number(args.width ?? 1080), H = Number(args.height ?? 1920);
const BLUR = Math.max(1, Math.round(Number(args.blur ?? 1)));
const SHUTTER = Number(args.shutter ?? 0.5);

const OUT = resolve(args.out ?? join(ROOT, 'out', `${(args.film ?? 'film').replace('/', '-')}.mp4`));
await mkdir(dirname(OUT), { recursive: true });
/* The encode is written beside OUT as name.exporting.mp4 and renamed on
   success. An MP4 is unplayable until ffmpeg writes its index at the very end,
   so a file under the final name must only ever be a finished one. */
const PART = join(dirname(OUT), `${basename(OUT, extname(OUT))}.exporting${extname(OUT)}`);
/* ffmpeg takes no frames for this long -> it has stopped reading; fail loudly
   instead of waiting for ever (a stalled pipe looks exactly like a slow render). */
const STALL_MS = Number(args.stall ?? 120) * 1000;

const server = await startServer(ROOT, Number(args.serve ?? 5178));
const url = args.url ?? filmUrl(server.port, args.film);

/* ---------- the browser ---------- */

const CHROME = findChrome();
const profile = await mkdtemp(join(tmpdir(), 'motionkit-export-'));
const browser = spawn(CHROME, chromeFlags({ width: W, height: H, profile, port: PORT, gl: filmWantsGL(ROOT, args.film) }),
  { stdio: ['ignore', 'ignore', 'pipe'] });

let cdp = null;
const cleanup = async () => {
  /* Hang up before anything else. An open WebSocket is a live handle, so a
     node that skips this sits in the event loop for ever with a finished video
     on disk, looking for all the world like a stalled encode. Raced, because a
     browser that shuts down promptly never gets round to answering the request
     that told it to. */
  if (cdp) {
    await Promise.race([
      cdp.send('Browser.close').catch(() => {}),
      new Promise((res) => setTimeout(res, 1500)),
    ]);
    cdp.ws.close();
  }
  browser.kill();
  server.close();
  await new Promise((res) => setTimeout(res, 200));
  await rm(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 }).catch(() => {});
};
process.on('SIGINT', async () => { await cleanup(); process.exit(130); });

await waitForBrowser(PORT);
const target = await (await fetch(
  `http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' },
)).json();

cdp = new CDP(target.webSocketDebuggerUrl);
await cdp.open();
await cdp.send('Page.enable');
await cdp.send('Runtime.enable');
// The frame must be exactly the film's, at 1:1, or the capture is a resample.
await cdp.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });

process.stdout.write('waiting for fonts and assets… ');
for (let i = 0; i < 200; i++) {
  if (await cdp.eval('!!window.PK').catch(() => false)) break;
  await new Promise((res) => setTimeout(res, 100));
}
if (!(await cdp.eval('!!window.PK').catch(() => false))) {
  console.error(`\nwindow.PK never appeared — the film threw before runFilm(). Open ${url} and look at the console.`);
  await cleanup();
  process.exit(1);
}
await cdp.eval('window.PK.ready', true);
const duration = await cdp.eval('window.PK.DURATION');
console.log('ready.');

/* ---------- the encoder ---------- */

const from = Number(args.from ?? 0);
const to = Math.min(Number(args.to ?? duration), duration);
const total = Math.round((to - from) * FPS);

/* A track, if one was named. It is assumed to start where the film does, so a
   partial export seeks into it by the same amount — otherwise `--from 16`
   would put bar 1 of the music under bar 9 of the picture. */
/* Read from a private copy: a mix rewritten while the export runs (re-muxing
   the audio in parallel) otherwise cuts ffmpeg's audio input mid-read, and
   with -shortest it then stops taking frames and the export hangs. */
const AUDIO = args.audio ? join(profile, `audio${extname(args.audio)}`) : null;
if (AUDIO) await copyFile(resolve(args.audio), AUDIO);

const ffmpeg = spawn('ffmpeg', [
  '-y',
  '-f', 'image2pipe', '-vcodec', FORMAT === 'png' ? 'png' : 'mjpeg',
  '-framerate', String(FPS * BLUR), '-i', '-',
  ...(AUDIO ? ['-ss', String(from), '-i', AUDIO] : []),
  ...(AUDIO ? ['-map', '0:v:0', '-map', '1:a:0', '-c:a', 'aac', '-b:a', '192k', '-shortest'] : []),
  '-c:v', 'libx264', '-preset', 'slow', '-crf', String(CRF),
  /* JPEG frames come in at full range and H.264 is delivered at limited, so
     convert rather than letting ffmpeg tag the file yuvj420p and hope every
     player reads the flag. The ones that do not crush the blacks — which on
     films this dark is most of the picture. */
  // Averaging N sub-frames: tmix gives, at input n, the mean of the N frames
  // ending at n, so keep the last of each group and restamp at the real rate.
  '-vf', (BLUR > 1 ? `tmix=frames=${BLUR},select='eq(mod(n\\,${BLUR})\\,${BLUR - 1})',setpts=N/${FPS}/TB,` : '') +
    'scale=in_range=full:out_range=limited,format=yuv420p',
  '-r', String(FPS),
  '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
  '-color_range', 'tv',
  '-profile:v', 'high', '-movflags', '+faststart',
  PART,
], { stdio: ['pipe', 'ignore', 'pipe'] });

let ffmpegErr = '';
ffmpeg.stderr.on('data', (d) => { ffmpegErr += d; });
const ffmpegClosed = once(ffmpeg, 'close');
const fail = async (why) => {
  ffmpeg.kill(); await cleanup(); await rm(PART, { force: true }).catch(() => {});
  console.error(`\n${why}\nffmpeg said:\n${ffmpegErr.split('\n').slice(-14).join('\n')}`);
  process.exit(1);
};
const stall = () => new Promise((res) => setTimeout(res, STALL_MS, 'stall'));

console.log(`${total} frames · ${FPS} fps · ${W}x${H} · ${FORMAT}${BLUR > 1 ? ` · ${BLUR}× motion blur, shutter ${SHUTTER}` : ''} → ${OUT}`);
const started = Date.now();

for (let i = 0; i < total; i++) {
  for (let j = 0; j < BLUR; j++) {
    // Sub-frames are spread across the open shutter, centred on the frame's own time.
    const t = from + i / FPS + (BLUR === 1 ? 0 : ((j + 0.5) / BLUR - 0.5) * SHUTTER / FPS);
    await cdp.eval(`window.PK.frame(${Math.max(0, t).toFixed(5)})`);
    const { data } = await cdp.send('Page.captureScreenshot', {
      format: FORMAT, quality: 100, captureBeyondViewport: false, fromSurface: true,
    });
    const buf = Buffer.from(data, 'base64');
    if (ffmpeg.exitCode !== null) await fail(`ffmpeg quit at frame ${i + 1} of ${total}.`);
    if (!ffmpeg.stdin.write(buf)) {
      const r = await Promise.race([once(ffmpeg.stdin, 'drain'), ffmpegClosed.then(() => 'closed'), stall()]);
      if (r === 'closed') await fail(`ffmpeg quit at frame ${i + 1} of ${total}.`);
      if (r === 'stall') await fail(`ffmpeg took no frames for ${STALL_MS / 1000}s at frame ${i + 1} of ${total}: the encode stalled.`);
    }
  }

  if (i % 30 === 0 || i === total - 1) {
    const done = (i + 1) / total;
    const left = ((Date.now() - started) / done) * (1 - done) / 1000;
    process.stdout.write(
      `\r  ${String(i + 1).padStart(5)} / ${total}  ${(done * 100).toFixed(1).padStart(5)}%` +
      `  ~${Math.ceil(left)}s left   `,
    );
  }
}

ffmpeg.stdin.end();
const [code] = await ffmpegClosed;
await cleanup();

if (code !== 0) {
  await rm(PART, { force: true }).catch(() => {});
  console.error(`\nffmpeg failed (${code}):\n${ffmpegErr.split('\n').slice(-14).join('\n')}`);
  process.exit(1);
}
await rename(PART, OUT);
console.log(`\ndone in ${Math.round((Date.now() - started) / 1000)}s → ${OUT}`);
