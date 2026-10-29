#!/usr/bin/env node
/* Check post copy against platform limits and the brand's own voice rules.
 *
 *   node tools/copycheck.mjs campaigns/launch/posts.json
 *
 * posts.json: { "brand": "lab", "posts": [ { "platform": "instagram",
 *   "caption": "…", "hashtags": ["#a"] }, { "platform": "x", "thread": ["…"] }, … ] }
 *
 * Errors (exit 1): over a hard limit. Warnings: a weak first line, too many
 * hashtags, words the profile bans, exclamation spam. Limits drift: these
 * are as of Oct 2026 and the sources disagree on some (Instagram hashtags:
 * reports say 30 dropped to 5 in Dec 2025), so check the app when it matters.
 */

import { readFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/* chars: hard cap of the main text; fold: what shows before "more", so the
   hook has to live there; tags: [warn above, error above]. */
export const LIMITS = {
  tiktok: { field: 'caption', chars: 4000, fold: 100, tags: [5, 30] },
  instagram: { field: 'caption', chars: 2200, fold: 125, tags: [5, 30] },
  'instagram-carousel': { field: 'caption', chars: 2200, fold: 125, tags: [5, 30] },
  reels: { field: 'caption', chars: 2200, fold: 125, tags: [5, 30] },
  linkedin: { field: 'text', chars: 3000, fold: 140, tags: [3, 10] },
  threads: { field: 'text', chars: 500, fold: 500, tags: [1, 1] },
  x: { field: 'thread', chars: 280, fold: 280, tags: [2, 5] },
  'youtube-shorts': { field: 'title', chars: 100, fold: 70, tags: [3, 15], extra: { description: 5000 } },
};

/** Problems with one post: [{ level: 'error'|'warn', msg }]. */
export function checkPost(post, profile = {}) {
  const out = [];
  const L = LIMITS[post.platform];
  if (!L) return [{ level: 'error', msg: `unknown platform "${post.platform}" (have ${Object.keys(LIMITS).join(', ')})` }];
  const parts = L.field === 'thread' ? (post.thread ?? []) : [post[L.field] ?? ''];
  if (!parts.length || !parts[0].trim()) out.push({ level: 'error', msg: `no ${L.field}` });
  const tags = post.hashtags ?? [];
  parts.forEach((txt, i) => {
    // hashtags appended to a single caption count toward its limit
    const full = L.field === 'thread' ? txt : [txt, tags.join(' ')].filter(Boolean).join('\n\n');
    const n = [...full].length;
    const where = parts.length > 1 ? ` (post ${i + 1})` : '';
    if (n > L.chars) out.push({ level: 'error', msg: `${n}/${L.chars} chars${where}` });
    if (i === 0) {
      const first = txt.split('\n')[0];
      if ([...first].length > L.fold) out.push({ level: 'warn', msg: `first line is ${[...first].length} chars; only ~${L.fold} show before "more": put the hook there` });
    }
    if ((txt.match(/!/g) ?? []).length > 1) out.push({ level: 'warn', msg: `more than one "!"${where}` });
    for (const w of profile.voice?.words_avoid ?? []) {
      if (new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(txt)) out.push({ level: 'warn', msg: `"${w}" is on the brand's avoid list${where}` });
    }
    const emoji = (txt.match(/\p{Extended_Pictographic}/gu) ?? []).length;
    if (emoji > 3) out.push({ level: 'warn', msg: `${emoji} emoji${where}` });
  });
  if (tags.length > L.tags[1]) out.push({ level: 'error', msg: `${tags.length} hashtags, the cap is ${L.tags[1]}` });
  else if (tags.length > L.tags[0]) out.push({ level: 'warn', msg: `${tags.length} hashtags; ${L.tags[0]} or fewer reads better (and Instagram may cap at 5)` });
  for (const [k, max] of Object.entries(L.extra ?? {})) {
    if (post[k] && [...post[k]].length > max) out.push({ level: 'error', msg: `${k}: ${[...post[k]].length}/${max} chars` });
  }
  return out;
}

async function main() {
  const file = process.argv[2];
  if (!file) { console.error('usage: node tools/copycheck.mjs <posts.json>'); process.exit(2); }
  const doc = JSON.parse(await readFile(resolve(file), 'utf8'));
  let profile = {};
  try { profile = JSON.parse(await readFile(join(ROOT, 'brands', doc.brand, 'profile.json'), 'utf8')); } catch { /* no profile: limits only */ }
  let errors = 0;
  for (const p of doc.posts) {
    const probs = checkPost(p, profile);
    errors += probs.filter((x) => x.level === 'error').length;
    console.log(`${probs.some((x) => x.level === 'error') ? 'FAIL' : probs.length ? 'warn' : ' ok '}  ${p.platform}`);
    for (const x of probs) console.log(`        ${x.level === 'error' ? '✗' : '!'} ${x.msg}`);
  }
  process.exit(errors ? 1 : 0);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
