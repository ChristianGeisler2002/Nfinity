const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const ignored = new Set(['node_modules', '.git', 'dist', 'data', 'uploads']);
let checked = 0;
let failures = 0;
function syntax(source, filename) {
  const result = spawnSync(process.execPath, [/^\s*(?:export|import)\s/m.test(source) ? '--input-type=module' : '--input-type=commonjs', '--check'], { input: source, encoding: 'utf8' });
  checked += 1;
  if (result.status !== 0) {
    failures += 1;
    console.error(path.relative(root, filename), result.stderr);
  }
}
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.(js|cjs)$/.test(entry.name)) syntax(fs.readFileSync(file, 'utf8'), file);
    else if (entry.name.endsWith('.html')) {
      const html = fs.readFileSync(file, 'utf8');
      for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
        if (!/\bsrc=|application\/json/i.test(match[1]) && match[2].trim()) syntax(match[2], file);
      }
    }
  }
}
walk(root);
console.log(`Checked ${checked} JavaScript sources and inline scripts; ${failures} failures.`);
process.exitCode = failures ? 1 : 0;
