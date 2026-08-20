/**
 * Reliable copy of tenant SQL assets into dist (Windows-safe fallback for nest assets).
 */
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src', 'tenants', 'sql');
const destDir = path.join(__dirname, '..', 'dist', 'tenants', 'sql');

if (!fs.existsSync(srcDir)) {
  console.warn('copy-sql-assets: source missing', srcDir);
  process.exit(0);
}

fs.mkdirSync(destDir, { recursive: true });
for (const name of fs.readdirSync(srcDir)) {
  if (!name.endsWith('.sql')) continue;
  fs.copyFileSync(path.join(srcDir, name), path.join(destDir, name));
  console.log('copied', name, '→ dist/tenants/sql/');
}
