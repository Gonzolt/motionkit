import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { variantIds, SAFE, CROPS } from '../lib/promo.js';
import { checkPost } from '../tools/copycheck.mjs';

const brief = JSON.parse(readFileSync(new URL('../campaigns/launch/brief.json', import.meta.url), 'utf8'));

// variants: a hook test by default, the full matrix on request, ids unique
assert.deepEqual(variantIds(brief), ['H1-M1-C1', 'H2-M1-C1', 'H3-M1-C1']);
const all = variantIds(brief, { matrix: true });
assert.equal(all.length, brief.hooks.length * brief.messages.length * brief.ctas.length);
assert.equal(new Set(all).size, all.length);
assert.deepEqual(variantIds(brief, { only: 'H2-M2-C1, H1-M1-C2' }), ['H2-M2-C1', 'H1-M1-C2']);

// every hook is fully specified: the four tracks Hook Lab promises
for (const h of brief.hooks) for (const k of ['id', 'angle', 'onscreen', 'vo', 'visual', 'sound']) assert.ok(h[k], `${h.id} has no ${k}`);

// the cross-platform safe box really is inside every platform's box, and inside the 4:5 crop
for (const [name, s] of Object.entries(SAFE)) {
  if (name === 'all') continue;
  assert.ok(SAFE.all.top >= s.top && SAFE.all.bottom <= s.bottom && SAFE.all.left >= s.left && SAFE.all.right <= s.right, `all ⊄ ${name}`);
}
assert.ok(SAFE.all.top >= CROPS.feed45.y && SAFE.all.bottom <= CROPS.feed45.y + CROPS.feed45.h, 'safe box inside the 4:5 crop');

// copy checks
const profile = { voice: { words_avoid: ['unlock'] } };
assert.deepEqual(checkPost({ platform: 'x', thread: ['short and fine'] }, profile), []);
assert.ok(checkPost({ platform: 'x', thread: ['a'.repeat(281)] }).some((p) => p.level === 'error'));
assert.ok(checkPost({ platform: 'instagram', caption: 'hi', hashtags: Array(31).fill('#a') }).some((p) => p.level === 'error'));
assert.ok(checkPost({ platform: 'instagram', caption: 'hi', hashtags: Array(6).fill('#a') }).some((p) => p.level === 'warn'));
assert.ok(checkPost({ platform: 'linkedin', text: 'Unlock it now' }, profile).some((p) => /avoid/.test(p.msg)));
assert.ok(checkPost({ platform: 'myspace', caption: 'x' })[0].level === 'error');
const posts = JSON.parse(readFileSync(new URL('../campaigns/launch/posts.json', import.meta.url), 'utf8'));
for (const p of posts.posts) assert.ok(!checkPost(p).some((x) => x.level === 'error'), `example ${p.platform} post fails its own check`);

console.log('social.test.mjs ok');
