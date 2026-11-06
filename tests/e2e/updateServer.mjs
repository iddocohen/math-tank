/**
 * Helper for tests/e2e/update.spec.ts (Phase 24 "Fast updates and cache cleanup"), in plain JavaScript because the
 * project has no Node type definitions: builds the game once per version into a temporary folder (APP_VERSION,
 * vite.config.ts) and serves one of the builds from a small server on a free port, switchable at run time.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { URL } from 'node:url';
import { extname, join, normalize } from 'node:path';
import process from 'node:process';

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json',
};

export async function startUpdateServer(versions) {
  const folder = mkdtempSync(join(tmpdir(), 'math-tank-update-'));
  const roots = {};
  for (const version of versions) {
    const out = join(folder, version);
    execFileSync('pnpm', ['exec', 'vite', 'build', '--outDir', out, '--emptyOutDir', '--logLevel', 'error'], {
      env: { ...process.env, APP_VERSION: version },
      stdio: 'ignore',
    });
    roots[version] = out;
  }
  let root = roots[versions[0]];
  const server = createServer((req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    let file = join(root, path);
    try {
      if (statSync(file).isDirectory()) file = join(file, 'index.html');
      const body = readFileSync(file);
      // As GitHub Pages does for a changed file: the browser asks again instead of using a long-lived copy.
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((resolve) => server.listen(0, 'localhost', resolve));
  return {
    url: `http://localhost:${server.address().port}`,
    serve(version) {
      root = roots[version];
    },
    async stop() {
      await new Promise((resolve) => server.close(() => resolve()));
      rmSync(folder, { recursive: true, force: true });
    },
  };
}
