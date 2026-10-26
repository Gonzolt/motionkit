
import { readdirSync, existsSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
function walk(d, out=[]) {
  for (const e of readdirSync(d, {withFileTypes:true})) {
    if (['node_modules','out','.git'].includes(e.name)) continue;
    const p = join(d, e.name);
    e.isDirectory() ? walk(p, out) : (p.endsWith('.js') && out.push(p));
  }
  return out;
}
let bad = 0;
for (const f of walk(process.cwd())) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/from\s+'(\.[^']+)'/g)) {
    const target = resolve(dirname(f), m[1]);
    if (!existsSync(target)) { console.log(`MISSING ${f.replace(process.cwd()+'/','')}  ->  ${m[1]}`); bad++; }
  }
}
console.log(bad ? `${bad} broken imports` : 'all imports resolve');
