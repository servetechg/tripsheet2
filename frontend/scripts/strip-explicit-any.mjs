/**
 * Bulk-remove common explicit `any` patterns under frontend/src.
 * Run from repo root: node frontend/scripts/strip-explicit-any.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, name.name);
    if (name.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name.name)) out.push(p);
  }
  return out;
}

const replacements = [
  [/catch \((\w+): any\)/g, 'catch ($1: unknown)'],
  [/\(p: any\[\]\)/g, '(p)'],
  [/\(prev: any\[\]\)/g, '(prev)'],
  [/\(l: any\)/g, '(l)'],
  [/\(u: any\)/g, '(u)'],
  [/\(d: any\)/g, '(d)'],
  [/\(c: any\)/g, '(c)'],
  [/\(a: any\)/g, '(a)'],
  [/\(s: any\)/g, '(s)'],
  [/\(m: any\)/g, '(m)'],
  [/\(i: any\)/g, '(i)'],
  [/\(inv: any\)/g, '(inv)'],
  [/\(doc: any\)/g, '(doc)'],
  [/\(b: any\)/g, '(b)'],
  [/\(x: any\)/g, '(x)'],
  [/\(row: any\)/g, '(row)'],
  [/\(t: any\)/g, '(t)'],
  [/\(p: any\)/g, '(p)'],
  [/\(loc: any\)/g, '(loc)'],
  [/\(e: any\)/g, '(e)'],
  [/\(err: any\)/g, '(err)'],
  [/\(updated: any\)/g, '(updated)'],
  [/\(list as any\[\]\)/g, '(list)'],
  [/\(rows as any\[\]\)/g, '(rows)'],
  [/\(body as any\)/g, '(body)'],
  [/\(f as any\)/g, '(f)'],
  [/\(initialF as any\)/g, '(initialF)'],
  [/\) as any;/g, ');'],
  [/useRef<any>\(/g, 'useRef<HTMLDivElement | null>('],
  [/disabledMatchers: any\[\]/g, 'disabledMatchers: import("react-day-picker").Matcher[]'],
  [/onBlur\?: \(e\?: any\)/g, 'onBlur?: (e?: React.FocusEvent<HTMLInputElement>)'],
  [/invite: any \| null/g, 'invite: import("@/types/dtos").InviteDetailDto | null'],
  [/company: any \| null/g, 'company: import("@/types/dtos").PlatformCompany | { id: string; name: string } | null'],
];

for (const file of walk(root)) {
  let text = fs.readFileSync(file, 'utf8');
  let next = text;
  for (const [re, rep] of replacements) {
    next = next.replace(re, rep);
  }
  if (next !== text) fs.writeFileSync(file, next);
}

console.log('strip-explicit-any: done');
