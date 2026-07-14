/**
 * One-shot splitter: extracts App.jsx sections into the target TS architecture.
 * Run: node scripts/split-app.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const src = path.join(root, 'src');
const appPath = path.join(src, 'App.jsx');
const lines = fs.readFileSync(appPath, 'utf8').split(/\r?\n/);

function slice(start, end) {
  // 1-based inclusive
  return lines.slice(start - 1, end).join('\n');
}

function write(rel, content) {
  const full = path.join(src, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content.replace(/\n+$/, '') + '\n', 'utf8');
  console.log('wrote', rel);
}

// Extract function body between braces for a function starting at line `start`
function extractFn(startLine, endLine) {
  return slice(startLine, endLine);
}

// ─── Config / package files (outside src) ─────────────────────────────────────
fs.writeFileSync(
  path.join(root, 'package.json'),
  JSON.stringify(
    {
      name: 'tripsheet',
      private: true,
      version: '0.0.0',
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'tsc -b && vite build',
        lint: 'oxlint',
        preview: 'vite preview',
      },
      dependencies: {
        '@tripsheet/shared': 'file:../shared',
        react: '^19.2.7',
        'react-dom': '^19.2.7',
        'react-router-dom': '^7.6.2',
      },
      devDependencies: {
        '@types/react': '^19.2.17',
        '@types/react-dom': '^19.2.3',
        '@vitejs/plugin-react': '^6.0.3',
        oxlint: '^1.71.0',
        typescript: '~5.8.2',
        vite: '^8.1.1',
      },
    },
    null,
    2
  ) + '\n'
);

fs.writeFileSync(
  path.join(root, 'tsconfig.json'),
  JSON.stringify(
    {
      files: [],
      references: [{ path: './tsconfig.app.json' }, { path: './tsconfig.node.json' }],
    },
    null,
    2
  ) + '\n'
);

fs.writeFileSync(
  path.join(root, 'tsconfig.app.json'),
  JSON.stringify(
    {
      compilerOptions: {
        tsBuildInfoFile: './node_modules/.tmp/tsconfig.app.tsbuildinfo',
        target: 'ES2022',
        useDefineForClassFields: true,
        lib: ['ES2022', 'DOM', 'DOM.Iterable'],
        module: 'ESNext',
        skipLibCheck: true,
        moduleResolution: 'bundler',
        allowImportingTsExtensions: true,
        verbatimModuleSyntax: true,
        moduleDetection: 'force',
        noEmit: true,
        jsx: 'react-jsx',
        strict: true,
        noUnusedLocals: false,
        noUnusedParameters: false,
        erasableSyntaxOnly: true,
        noFallthroughCasesInSwitch: true,
        noUncheckedSideEffectImports: true,
        baseUrl: '.',
        paths: {
          '@/*': ['./src/*'],
          '@tripsheet/shared': ['../shared/src/index.ts'],
          '@tripsheet/shared/*': ['../shared/src/*'],
        },
      },
      include: ['src'],
    },
    null,
    2
  ) + '\n'
);

fs.writeFileSync(
  path.join(root, 'tsconfig.node.json'),
  JSON.stringify(
    {
      compilerOptions: {
        tsBuildInfoFile: './node_modules/.tmp/tsconfig.node.tsbuildinfo',
        target: 'ES2023',
        lib: ['ES2023'],
        module: 'ESNext',
        skipLibCheck: true,
        moduleResolution: 'bundler',
        allowImportingTsExtensions: true,
        verbatimModuleSyntax: true,
        moduleDetection: 'force',
        noEmit: true,
        strict: true,
        noUnusedLocals: false,
        noUnusedParameters: false,
        erasableSyntaxOnly: true,
        noFallthroughCasesInSwitch: true,
        noUncheckedSideEffectImports: true,
      },
      include: ['vite.config.ts'],
    },
    null,
    2
  ) + '\n'
);

fs.writeFileSync(
  path.join(root, 'vite.config.ts'),
  `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tripsheet/shared': path.resolve(__dirname, '../shared/src'),
    },
  },
})
`
);

fs.writeFileSync(
  path.join(root, 'index.html'),
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>TripSheet</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`
);

console.log('Wrote package/tsconfig/vite/index.html');

// Mark that infrastructure is done — component extraction continues in split-app-parts.mjs
console.log('Part 1 done. Run split will continue...');
