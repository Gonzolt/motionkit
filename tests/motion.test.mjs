import assert from 'node:assert/strict';
import { E, bezier, spring, track, noise, rand, impact, speed, stagger } from '../lib/motion.js';

const near = (a, b, e = 1e-3) => assert.ok(Math.abs(a - b) < e, `${a} !≈ ${b}`);

// bezier endpoints and monotonic ease-out
for (const [n, f] of Object.entries(E)) if (typeof f === 'function' && n !== 'back') { near(f(0), 0); near(f(1), 1); }
near(bezier(0.25, 0.1, 0.25, 1)(0.5), 0.8024, 5e-3);          // CSS `ease` at 0.5 ≈ 0.802
assert.ok(E.outExpo(0.2) > 0.6, 'expo-out should have done most of its travel by 20 %');
assert.ok(E.in(0.2) < 0.1, 'ease-in should be slow at 20 %');

// spring: starts at 0, settles at 1, overshoots only when bouncy
near(spring(0, {}), 0); near(spring(3, { duration: 0.5, bounce: 0.3 }), 1, 1e-3);
const peak = (o) => Math.max(...Array.from({ length: 200 }, (_, i) => spring(i / 100, o)));
assert.ok(peak({ bounce: 0.35 }) > 1.05, 'bouncy spring must overshoot');
assert.ok(peak({ bounce: 0 }) <= 1.0001, 'critically damped must not overshoot');
assert.ok(peak({ bounce: -0.5 }) <= 1.0001, 'over-damped must not overshoot');

// track: holds outside, arrives with the destination key's curve
const tr = track([[1, 10], [2, 20, E.linear], [3, 0, E.linear]]);
near(tr(0), 10); near(tr(1.5), 15); near(tr(2.5), 10); near(tr(9), 0);

// determinism
assert.equal(noise(4, 1.37), noise(4, 1.37)); assert.equal(rand(2, 5), rand(2, 5));
assert.notEqual(rand(2, 5), rand(2, 6));
near(impact(0.5, 1, {}), 0); assert.ok(Math.abs(impact(1.05, 1, { amp: 30 })) > 0);
near(speed((x) => 3 * x, 2), 3);
assert.ok(stagger(0.1, 3, { each: 0.1 }) === 0 && stagger(5, 3) === 1);

// counters
import { fmtInt, fmtShort } from '../lib/type.js';
assert.equal(fmtInt(256929), '256,929'); assert.equal(fmtShort(51713500), '51.7M'); assert.equal(fmtShort(399), '399');
console.log('motion.test.mjs ok');
