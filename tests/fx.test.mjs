import assert from 'node:assert/strict';
import { beatPulse, flicker, shake, hitStop, speedRamp } from '../lib/fx.js';

const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} !≈ ${b}`);

// beatPulse: 1 on the beat, decayed between, nothing before the first downbeat
near(beatPulse(1.0, 120), 1);
near(beatPulse(1.25, 120, { decay: 0.12 }), Math.exp(-0.25 / 0.12));
assert.equal(beatPulse(0.5, 120, { offset: 1 }), 0);
near(beatPulse(2.0, 120, { offset: 1, every: 2 }), 1);          // every other beat: 1, 2, 3 …
assert.ok(beatPulse(1.5, 120, { offset: 1, every: 2 }) < 0.02);

// flicker: deterministic, in range, dips sometimes
const f = Array.from({ length: 240 }, (_, i) => flicker(i / 24, { rate: 0.14 }));
assert.deepEqual(f, Array.from({ length: 240 }, (_, i) => flicker(i / 24, { rate: 0.14 })));
assert.ok(f.every((v) => v >= 0 && v <= 1));
assert.ok(f.some((v) => v < 0.6) && f.filter((v) => v > 0.9).length > 150, 'mostly on, sometimes out');

// shake: still before a hit and long after; hits add up
assert.deepEqual(shake(0.5, [1]), { x: 0, y: 0, rot: 0 });
assert.deepEqual(shake(5, [1]), { x: 0, y: 0, rot: 0 });
assert.ok(Math.abs(shake(1.04, [1]).x) > 0);

// hitStop: frozen during the hold, then late by exactly the hold
near(hitStop(0.4, [[0.5, 0.2]]), 0.4);
near(hitStop(0.6, [[0.5, 0.2]]), 0.5);
near(hitStop(0.7, [[0.5, 0.2]]), 0.5);
near(hitStop(1.0, [[0.5, 0.2]]), 0.8);

// speedRamp: the integral of a piecewise-linear speed, continuous, real time when flat
near(speedRamp(3, [[0, 1]]), 3);
near(speedRamp(2, [[0, 1], [1, 0.25], [2, 1]]), 1.25);
near(speedRamp(4, [[0, 1], [1, 0.25], [2, 1]]), 3.25);
for (let t = 0.01; t < 3; t += 0.01) {
  assert.ok(speedRamp(t, [[0, 1], [1, 0.25], [2, 2]]) > speedRamp(t - 0.01, [[0, 1], [1, 0.25], [2, 2]]), 'never runs backwards');
}

console.log('fx.test.mjs ok');
