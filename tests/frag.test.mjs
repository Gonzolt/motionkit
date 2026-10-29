import assert from 'node:assert/strict';
import { wordAt, grow, stutter, segAt, polyAt } from '../lib/frag.js';

const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} !≈ ${b}`);

// wordAt: nothing before the first word, each word until the next, gaps after hold
const W = [{ w: 'MAKE', s: 1, e: 1.3 }, { w: 'ME', s: 1.5, e: 1.6 }, { w: 'YOURS', s: 3, e: 3.4, accent: 'only' }];
assert.equal(wordAt(W, 0.9), null);
assert.equal(wordAt(W, 1.2).text, 'MAKE');
assert.equal(wordAt(W, 1.5).text, 'ME');                        // the next word wins on its own start
assert.equal(wordAt(W, 2.0, { hold: 0.5 }).text, 'ME');
assert.equal(wordAt(W, 2.2, { hold: 0.5 }), null);               // 1.6 + 0.5 has passed: a gap
assert.equal(wordAt(W, 3.1).accent, 'only');
near(wordAt(W, 1.2).age, 0.2);
near(wordAt(W, 1.47, { lead: 1 / 30 }).t0, 1.5 - 1 / 30);       // lead shows it early

// grow: syllable by syllable, never ahead of its time
assert.equal(grow(['REA', 'DY'], [2, 2.3], 1.9), '');
assert.equal(grow(['REA', 'DY'], [2, 2.3], 2.1), 'REA');
assert.equal(grow(['REA', 'DY'], [2, 2.3], 2.3), 'READY');

// stutter + segAt: back to back, each shot starts `pre` before its move
const segs = stutter([{ clip: 'a', src: 10 }, { clip: 'b', src: 4 }, { clip: 'c', src: 7 }], { t0: 5, each: 0.1, pre: 0.05 });
assert.deepEqual(segs.map((s) => s.clip), ['a', 'b', 'c']);
near(segs[2].t1, 5.3);
assert.equal(segAt(segs, 4.99), null);
assert.equal(segAt(segs, 5.3), null);
assert.equal(segAt(segs, 5.12).seg.clip, 'b');
near(segAt(segs, 5.12).src, 4 - 0.05 + 0.02);
near(segAt(segs, 5.05).src, 10);                                 // the move lands 0.05 s into every shot

// polyAt: held outside, linear inside, same point count enforced
const P = [[1, [[0, 0], [10, 0], [10, 10]]], [2, [[10, 10], [20, 10], [20, 20]]]];
assert.deepEqual(polyAt(P, 0), P[0][1]);
assert.deepEqual(polyAt(P, 3), P[1][1]);
assert.deepEqual(polyAt(P, 1.5), [[5, 5], [15, 5], [15, 15]]);
assert.throws(() => polyAt([[0, [[0, 0]]], [1, [[0, 0], [1, 1]]]], 0.5));

console.log('frag.test.mjs ok');
