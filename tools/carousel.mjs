#!/usr/bin/env node
/* Carousel posts (Instagram, LinkedIn) as PNGs, in the brand's own look.
 *
 *   node tools/carousel.mjs --deck campaigns/launch/carousel.json
 *   node tools/carousel.mjs --deck campaigns/launch/carousel.json --out out/launch/carousel --only 0,5
 *
 * The deck is data (layouts: cover, point, list, stat, quote, cta, image);
 * tools/carousel/slide.js draws one slide with the brand's theme.js tokens and
 * typo() roles, mapped through brands/<brand>/profile.json. Default size is
 * 1080x1350 (4:5, the tallest the Instagram feed shows); set "size" in the
 * deck for 1080x1080. Writes 01.png … plus a contact sheet when ffmpeg is on PATH.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, startServer, withPage } from './browser.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const a = parseArgs(process.argv.slice(2));
if (!a.deck) {
  console.error('need --deck <campaigns/x/carousel.json>');
  process.exit(2);
}
const deckPath = resolve(a.deck);
const deck = JSON.parse(await readFile(deckPath, 'utf8'));
const [W, H] = (deck.size ?? '1080x1350').split('x').map(Number);
const OUT = resolve(a.out ?? join(ROOT, 'out', basename(dirname(deckPath)), 'carousel'));
await mkdir(OUT, { recursive: true });

const PORT = Number(a.serve ?? 5193);
const server = await startServer(ROOT, PORT);
const deckUrl = '/' + relative(ROOT, deckPath).split('\\').join('/');
const only = a.only ? String(a.only).split(',').map(Number) : deck.slides.map((_, i) => i);
const slideUrl = (i) => `http://127.0.0.1:${PORT}/tools/carousel/index.html?deck=${encodeURIComponent(deckUrl)}&i=${i}`;

const files = [];
try {
  await withPage({ url: slideUrl(only[0]), port: Number(a.port ?? 9371), width: W, height: H }, async (cdp) => {
    for (const i of only) {
      await cdp.send('Page.navigate', { url: slideUrl(i) });
      // wait for the module to define READY, then for its fonts and images
      for (let k = 0; k < 100 && !(await cdp.eval('!!window.READY').catch(() => false)); k++) await new Promise((r) => setTimeout(r, 100));
      await cdp.eval('window.READY', true);
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
      const file = join(OUT, `${String(i + 1).padStart(2, '0')}.png`);
      await writeFile(file, Buffer.from(data, 'base64'));
      files.push(file);
      console.log(`${String(i + 1).padStart(2)}  ${deck.slides[i].type.padEnd(6)}  ${file}`);
    }
  });
} finally {
  server.close();
}

if (files.length > 1) {
  const sheet = join(OUT, '_sheet.png');
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...files.flatMap((f) => ['-i', f]),
    '-filter_complex', `${files.map((_, i) => `[${i}]`).join('')}hstack=${files.length},scale=${Math.min(3600, files.length * 400)}:-1`, sheet],
  { encoding: 'utf8' });
  if (r.status === 0) console.log(`\nsheet: ${sheet}`);
}
