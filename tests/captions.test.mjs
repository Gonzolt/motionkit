import assert from 'node:assert/strict';
import { chunk, pickEmphasis, RULES } from '../lib/captions.js';
import { flashCheck, flashAt } from '../lib/fx.js';
import { toSrt, toVtt, toAss } from '../tools/subs.mjs';

const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} !≈ ${b}`);
const W = (w, s, e, line = 0) => ({ w, s, e, line });

// never early: a chunk starts after its first word, by the late bias
const words = [W('No', 0, 0.2), W('After', 0.2, 0.5), W('Effects.', 0.5, 0.9), W('Just', 1.6, 1.8), W('code.', 1.8, 2.2)];
const cs = chunk(words);
assert.equal(cs.length, 2, 'breaks on the full stop');
near(cs[0].s, 0 + RULES.late);
assert.ok(cs.every((c, i) => c.s >= words.find((w) => w.w === c.words[0].w).s), 'no chunk before its word');

// a pause breaks; the hold ends before the next chunk; nothing overlaps
const cs2 = chunk([W('one', 0, 0.3), W('two', 1.0, 1.3), W('three', 1.3, 1.6)]);
assert.equal(cs2[0].text, 'one');
assert.ok(cs2[0].e <= cs2[1].s, 'chunks never overlap');
for (let i = 1; i < cs.length; i++) assert.ok(cs[i - 1].e <= cs[i].s);

// the word cap
const many = 'a b c d e f g'.split(' ').map((w, i) => W(w, i * 0.3, i * 0.3 + 0.25));
assert.ok(chunk(many).every((c) => c.words.length <= RULES.maxWords + 1));
assert.ok(chunk(many, { maxWords: 2 }).every((c) => c.words.length <= 3));

// emphasis: numbers first, never a stop word, a lone word only if it is a number
assert.equal(pickEmphasis([W('the', 0, 1), W('best', 0, 1), W('100', 0, 1)]), 2);
assert.equal(pickEmphasis([W('look.', 0, 1)]), -1);
assert.equal(pickEmphasis([W('5K', 0, 1)]), 0);
assert.equal(pickEmphasis([W('made', 0, 1), W('with', 0, 1), W('code.', 0, 1)]), 2, 'later content word wins a tie');
assert.equal(chunk(words, { emphasis: false })[0].emph, -1);
assert.equal(chunk(words, { emphasis: ['after'] })[0].emph, 1);

// sidecars
const srt = toSrt(cs);
assert.match(srt, /^1\n00:00:00,080 --> 00:00:0\d,\d{3}\nNo After Effects\.\n/);
assert.match(toVtt(cs), /^WEBVTT\n\n00:00:00\.080 --> /);
const ass = toAss(cs, { accent: '#D7FF3A' });
assert.match(ass, /Dialogue: 0,0:00:00\.08,/);
assert.ok(ass.includes('&H003AFFD7'), 'accent is written BGR');
assert.ok(toAss(cs, { preset: 'karaoke' }).includes('{\\k'), 'karaoke uses \\k');

// photosensitivity
assert.deepEqual(flashCheck([0, 0.5, 1.2, 2.0]), []);
assert.equal(flashCheck([0, 0.2, 0.4, 0.6]).length, 1, 'four in a second is caught');
near(flashAt(1, [1]), 1); near(flashAt(1.2, [1], { len: 0.1 }), 0);

console.log('captions.test.mjs ok');
