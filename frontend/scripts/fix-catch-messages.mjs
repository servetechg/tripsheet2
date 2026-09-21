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

for (const file of walk(root)) {
  let text = fs.readFileSync(file, 'utf8');
  if (!/(\be|\berr)\?\.(message|body)/.test(text)) continue;

  if (!text.includes('getApiErrorMessage')) {
    if (text.includes("from '@/lib/format'")) {
      text = text.replace(
        /from '@\/lib\/format';/,
        (m) => m.replace("';", "';").replace(
          "from '@/lib/format';",
          "from '@/lib/format';\n// getApiErrorMessage imported below",
        ),
      );
      text = text.replace(
        /import \{([^}]+)\} from '@\/lib\/format';/,
        (match, names) => {
          const list = names.split(',').map((s) => s.trim());
          if (list.includes('getApiErrorMessage')) return match;
          return `import { ${names.trim()}, getApiErrorMessage } from '@/lib/format';`;
        },
      );
    } else {
      text = `import { getApiErrorMessage } from '@/lib/format';\n${text}`;
    }
  }

  text = text.replace(
    /notify\((\w+)\?\.message \|\| '([^']+)'/g,
    "notify(getApiErrorMessage($1, '$2')",
  );
  text = text.replace(
    /notify\((\w+)\?\.message \|\| "([^"]+)"/g,
    'notify(getApiErrorMessage($1, "$2")',
  );
  text = text.replace(
    /setErr\((\w+)\?\.message \|\| '([^']+)'\)/g,
    "setErr(getApiErrorMessage($1, '$2'))",
  );
  text = text.replace(
    /`([^`]*)\$\{(\w+)\?\.message/g,
    '`$1${getApiErrorMessage($2',
  );

  fs.writeFileSync(file, text);
}

console.log('fix-catch-messages: done');
