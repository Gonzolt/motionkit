#!/usr/bin/env node
/* The brand guard.
 *
 *   node tools/lint.mjs                      # every brand
 *   node tools/lint.mjs --brand lab
 *
 * This exists because "remember to use the tokens" is not a plan. Film four
 * for a brand will have a slightly different teal from film one unless
 * something mechanical stops it, and by then both are published and one of
 * them is wrong. So: a film file that names a colour, a font or a raw px type
 * size fails the check, and `export.mjs` refuses to run.
 *
 * What is allowed where:
 *
 *   brands/<b>/theme.js, theme.css   the ONLY place a hex may appear.
 *                                    Mirrored from the app's own source.
 *   brands/<b>/screens/*.js          components. Tokens only.
 *   brands/<b>/films/*.js            a scene table, timings and beats.
 *   lib/*.js                         brand-neutral. No colours at all.
 *
 * Greys used for a shadow or a scrim are not brand colours, so rgba(0,0,0,x)
 * and rgba(255,255,255,x) pass. Everything else has to come from a token.
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(
  process.argv.slice(2).join(' ').split('--').filter(Boolean)
    .map((s) => s.trim().split(/\s+/)).map(([k, v = 'true']) => [k, v]),
);

const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const RGB = /\brgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g;
const FONT_FAMILY = /font-family\s*:/g;
const FONT_SIZE_PX = /font-size\s*:\s*\$?\{?\s*\d/g;
/* `new Date()` with no argument is the wall clock. `new Date('2026-03-12')` is
   a fixed point and is exactly how a film pins its "today" so it cannot expire
   — flagging it would push authors towards timestamps, which is worse. */
const WALL_CLOCK = /\bDate\.now\s*\(|\bnew Date\s*\(\s*\)|\bperformance\.now\s*\(/;

const problems = [];
const add = (file, line, msg) => problems.push({ file: relative(ROOT, file), line, msg });

async function walk(dir, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.') || e.name === 'out') continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) await walk(p, out);
    else out.push(p);
  }
  return out;
}

/** A grey with no hue is a shadow or a scrim, not a brand colour. */
const neutral = (r, g, b) => r === g && g === b;

function scan(file, text, { allowColour, allowFont }) {
  /* A file whose whole job is a physical material — brushed titanium, printed
     paper, a national flag — is not drawing the brand and cannot use its
     tokens. It says so once at the top with a reason, rather than carrying a
     comment on forty gradient stops. The reason is the point: it makes the
     exemption reviewable instead of invisible. */
  const fileAllow = /motionkit-allow-file:\s*(.+)/.exec(text.slice(0, 2000));
  if (fileAllow) { allowColour = true; allowFont = true; }

  const lines = text.split('\n');
  lines.forEach((line, i) => {
    // A line that says why it is an exception is an exception. It has to name
    // a reason, so it shows up in review rather than becoming a habit.
    if (/motionkit-allow:/.test(line)) return;
    const n = i + 1;

    if (!allowColour) {
      for (const m of line.matchAll(HEX)) {
        const v = m[0].slice(1);
        const same = v.length >= 6 && v[0] === v[2] && v[2] === v[4] && v[1] === v[3] && v[3] === v[5];
        if (!same && !/^(000|fff|0{6,8}|f{6,8})$/i.test(v)) {
          add(file, n, `hardcoded colour ${m[0]} — import it from the brand's theme.js`);
        }
      }
      for (const m of line.matchAll(RGB)) {
        if (!neutral(+m[1], +m[2], +m[3])) {
          add(file, n, `hardcoded colour ${m[0]}) — import it from the brand's theme.js`);
        }
      }
    }

    if (!allowFont && FONT_FAMILY.test(line)) {
      add(file, n, 'font-family in a film — the brand stylesheet owns the typeface');
      FONT_FAMILY.lastIndex = 0;
    }
    if (!allowFont && FONT_SIZE_PX.test(line) && !/typo\(/.test(line)) {
      add(file, n, 'raw font-size — use typo(role) so the app\'s own scale is the only scale');
      FONT_SIZE_PX.lastIndex = 0;
    }

    // The determinism rule, checked rather than trusted. These make a film's
    // frames differ between the preview and the export, and the failure looks
    // like a flaky renderer rather than a rule that was broken.
    if (WALL_CLOCK.test(line)) {
      add(file, n, 'reads the wall clock — every frame must be a pure function of t');
    }
    if (/\bMath\.random\(/.test(line)) {
      add(file, n, 'Math.random() — use the seeded rng() from lib/anim.js');
    }
    if (/@keyframes|transition\s*:|animation\s*:/.test(line) && !/none/.test(line)) {
      add(file, n, 'a CSS transition or animation — the film clock draws every frame, nothing animates itself');
    }
    if (/backdrop-filter/.test(line) && !/none/.test(line)) {
      add(file, n, 'backdrop-filter under a scaled ancestor is very expensive and these surfaces are opaque');
    }
  });
}

const brands = args.brand
  ? [args.brand]
  : (await readdir(join(ROOT, 'brands'), { withFileTypes: true }))
      .filter((e) => e.isDirectory()).map((e) => e.name);

for (const file of await walk(join(ROOT, 'lib'))) {
  if (!file.endsWith('.js')) continue;
  scan(file, await readFile(file, 'utf8'), { allowColour: false, allowFont: false });
}

for (const brand of brands) {
  const dir = join(ROOT, 'brands', brand);
  try { await stat(dir); } catch { console.error(`no brand "${brand}"`); process.exit(2); }

  let sawTheme = false;
  for (const file of await walk(dir)) {
    const rel = relative(dir, file);
    if (!/\.(js|css|html)$/.test(rel)) continue;
    const isTheme = rel === 'theme.js' || rel === 'theme.css';
    if (isTheme) sawTheme = true;
    const text = await readFile(file, 'utf8');
    scan(file, text, {
      allowColour: isTheme,
      // Screens carry the app's real components, so they set sizes via typo();
      // theme.css declares the @font-face rules. A film file does neither.
      allowFont: isTheme || rel.startsWith('screens/'),
    });
  }
  if (!sawTheme) add(dir, 0, `brand "${brand}" has no theme.js — every colour in its films is therefore unanchored`);
}

if (!problems.length) {
  console.log(`clean · ${brands.join(', ')}`);
  process.exit(0);
}

const byFile = new Map();
for (const p of problems) {
  if (!byFile.has(p.file)) byFile.set(p.file, []);
  byFile.get(p.file).push(p);
}
for (const [file, list] of byFile) {
  console.error(`\n${file}`);
  for (const p of list) console.error(`  ${String(p.line).padStart(4)}  ${p.msg}`);
}
console.error(`\n${problems.length} problem${problems.length === 1 ? '' : 's'}. ` +
  'A genuine exception takes a "motionkit-allow: <reason>" comment on the line.');
process.exit(1);
