/**
 * Annotate useState(null)/useRef()/empty arrays for TS inference without @ts-nocheck.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(ent.name)) out.push(p);
  }
  return out;
}

for (const file of walk(root)) {
  let c = fs.readFileSync(file, 'utf8');
  const orig = c;
  c = c.replace(/useState\(null\)/g, 'useState<any>(null)');
  c = c.replace(/useState\(\{\}\)/g, 'useState<any>({})');
  c = c.replace(/useState\(\[\]\)/g, 'useState<any[]>([])');
  c = c.replace(/useRef\(\)/g, 'useRef<any>(null)');
  // Fix destructured default with : any already applied incorrectly patterns are fine
  if (c !== orig) {
    fs.writeFileSync(file, c);
    console.log('annotated', path.relative(root, file));
  }
}
console.log('done');
