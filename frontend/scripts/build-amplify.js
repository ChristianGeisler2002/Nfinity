const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');

function apiBaseUrl() {
  if ((process.env.NODE_ENV === 'production' || process.env.CI === 'true') && !process.env.NFINITY_API_BASE_URL) throw new Error('Set NFINITY_API_BASE_URL for a deployment build.');
  const raw = String(process.env.NFINITY_API_BASE_URL || 'http://127.0.0.1:3000').trim().replace(/\/+$/, '');
  if (!raw) {
    throw new Error('NFINITY_API_BASE_URL is required. Set it to the public Elastic Beanstalk HTTPS origin.');
  }

  const url = new URL(raw);
  const local = ['127.0.0.1', 'localhost'].includes(url.hostname) && url.protocol === 'http:';
  if ((!local && url.protocol !== 'https:') || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('NFINITY_API_BASE_URL must be an HTTPS origin with no path, query, credentials, or trailing slash.');
  }
  return url.origin;
}

function copy(source, destination) {
  fs.cpSync(path.join(root, source), path.join(dist, destination), { recursive: true });
}

function filesUnder(directory, extension) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...filesUnder(fullPath, extension));
    else if (entry.name.endsWith(extension)) files.push(fullPath);
  }
  return files;
}

const apiOrigin = apiBaseUrl();
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

// Root copies provide launch URLs while /public remains available for existing links.
copy('public', '.');
copy('public', 'public');
copy('apps', 'apps');
copy(path.join('core', 'api'), path.join('core', 'api'));
copy(path.join('core', 'automation'), path.join('core', 'automation'));
copy(path.join('core', 'scenarios'), path.join('core', 'scenarios'));
copy('client_configs', 'client_configs');

const runtimeConfig = `window.NFINITY_API_BASE_URL = ${JSON.stringify(apiOrigin)};\n`;
fs.writeFileSync(path.join(dist, 'runtime-config.js'), runtimeConfig);
fs.writeFileSync(path.join(dist, 'public', 'runtime-config.js'), runtimeConfig);

for (const htmlFile of filesUnder(dist, '.html')) {
  const html = fs.readFileSync(htmlFile, 'utf8');
  const patched = html.replace(/connect-src 'self'[^;]*(;|(?="))/g, `connect-src 'self' ${apiOrigin};`);
  if (html.includes('Content-Security-Policy') && !patched.includes(`connect-src 'self' ${apiOrigin}`)) {
    throw new Error(`Could not inject API origin into CSP: ${path.relative(root, htmlFile)}`);
  }
  fs.writeFileSync(htmlFile, patched);
}

console.log(`Amplify artifact ready: ${path.relative(root, dist)} -> ${apiOrigin}`);
