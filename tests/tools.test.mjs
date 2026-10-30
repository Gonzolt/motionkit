import assert from 'node:assert/strict';
import { pickTimes, codeFor } from '../tools/report.mjs';

const film = { duration: 10, scenes: [{ id: 'a', t0: 0, t1: 4 }, { id: 'b', t0: 4, t1: 10 }] };

// The middle of each scene by default: a rest point, not a frame of a move.
assert.deepEqual(pickTimes({}, film), [2, 7]);
// --frames wins, in seconds, and drops junk.
assert.deepEqual(pickTimes({ frames: '0,4.5,x,9' }, film), [0, 4.5, 9]);
// --n spreads evenly, half a step in from each end.
assert.deepEqual(pickTimes({ n: '4' }, film), [1.25, 3.75, 6.25, 8.75]);
// No scene table: 8 spread out, like Kinetograph's lint.
assert.equal(pickTimes({}, { duration: 8, scenes: [] }).length, 8);

assert.equal(codeFor(new Error('window.PK never appeared at http://x')), 'film-failed-to-load');
assert.equal(codeFor(new Error('no Chromium found. Run npm install')), 'no-browser');
assert.equal(codeFor('something else'), 'internal');

console.log('tools.test.mjs ok');
