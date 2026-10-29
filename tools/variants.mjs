#!/usr/bin/env node
/* Render every ad variant a brief defines, each with its own id.
 *
 *   node tools/variants.mjs --film lab/promo --brief campaigns/launch/brief.json --shots
 *   node tools/variants.mjs --film lab/promo --brief campaigns/launch/brief.json --matrix --fps 30
 *   node tools/variants.mjs --film lab/promo --brief campaigns/launch/brief.json --only H2-M1-C1,H3-M2-C1
 *
 * Default is a HOOK TEST: every hook with the first message and CTA, because
 * the hook decides whether anyone sees the rest. --matrix renders hooks x
 * messages x CTAs. --shots grabs frames instead of encoding (seconds, not
 * minutes): by default three frames inside the hook window, side by side.
 *
 * The film reads its variant from ?v=<id> (lib/promo.js variant()). Output
 * goes to out/<campaign>/variants/: <id>.mp4 (or <id>/ frames) plus
 * manifest.csv, so a result from the ad dashboard can be traced back to the
 * exact hook, message and CTA.
 *
 * Other flags pass through to export.mjs: --fps --blur --shutter --audio --crf.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './browser.mjs';
import { variantIds } from '../lib/promo.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const a = parseArgs(process.argv.slice(2));
if (!a.film || !a.brief) {
  console.error('need --film <brand>/<name> and --brief <campaigns/x/brief.json>');
  process.exit(2);
}

const brief = JSON.parse(await readFile(resolve(a.brief), 'utf8'));
const campaign = basename(dirname(resolve(a.brief)));
const [brand, name] = a.film.split('/');
const OUT = resolve(a.out ?? join(ROOT, 'out', campaign, 'variants'));
await mkdir(OUT, { recursive: true });

const ids = variantIds(brief, { matrix: !!a.matrix, only: a.only });
if (ids.length > 12 && !a.shots) console.warn(`${ids.length} exports: that is a lot of render time. --shots first, or --only.`);

const SERVE = Number(a.serve ?? 5191);
const byId = (list, id) => list.find((x) => x.id === id) ?? {};
const rows = [['id', 'hook', 'angle', 'onscreen', 'message', 'cta', 'file']];

for (const id of ids) {
  const [hid, mid, cid] = id.split('-');
  const url = `http://127.0.0.1:${SERVE}/brands/${brand}/films/${name}.html?export&v=${id}`;
  let file, r;
  if (a.shots) {
    file = join(OUT, id);
    const at = a.at ?? '0.4,1.2,2.0';
    r = spawnSync(process.execPath, [join(ROOT, 'tools', 'shot.mjs'), '--url', url, '--serve', String(SERVE), '--at', at, '--out', file, '--nosheet'],
      { stdio: 'inherit' });
  } else {
    file = join(OUT, `${id}.mp4`);
    const pass = ['fps', 'blur', 'shutter', 'audio', 'crf'].flatMap((k) => (a[k] ? [`--${k}`, String(a[k])] : []));
    r = spawnSync(process.execPath, [join(ROOT, 'tools', 'export.mjs'), '--url', url, '--serve', String(SERVE), '--out', file, ...pass],
      { stdio: 'inherit' });
  }
  if (r.status !== 0) { console.error(`variant ${id} failed`); process.exit(1); }
  const hk = byId(brief.hooks, hid);
  rows.push([id, hid, hk.angle ?? '', hk.onscreen ?? '', byId(brief.messages, mid).line ?? '', byId(brief.ctas, cid).button ?? '', file]);
}

const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n') + '\n';
await writeFile(join(OUT, 'manifest.csv'), csv, 'utf8');
console.log(`\n${ids.length} variant${ids.length === 1 ? '' : 's'} → ${OUT}`);
