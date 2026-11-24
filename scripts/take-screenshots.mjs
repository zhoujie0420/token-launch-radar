// Takes the three dossier screenshots of the token radar dashboard from out/:
// 1-board.png (the board), 2-detail.png (a protocol's detail view), 3-filtered.png (a filtered view).
// Serves out/ on localhost, drives it with Playwright's headless Chromium, and writes PNGs at
// 1440x900 into the project's screenshots/. Run: node scripts/take-screenshots.mjs (needs playwright: npm i playwright in /tmp/shot-tool)
// Playwright lives in /tmp/shot-tool (npm i playwright there); fall back to it when the project has no copy.
let chromium;
try { ({ chromium } = await import('playwright')); } catch { ({ chromium } = await import('/tmp/shot-tool/node_modules/playwright/index.mjs')); }
import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const root = join(project, 'out');
const shotsDir = join(project, 'screenshots');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]).replace(/^\/+/, '') || 'dashboard/index.html';
  const p = join(root, urlPath);
  if (!p.startsWith(root) || !existsSync(p) || !statSync(p).isFile()) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': mime[extname(p)] || 'application/octet-stream' });
  res.end(readFileSync(p));
});
await new Promise((r) => server.listen(8901, '127.0.0.1', r));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
try {
  await page.goto('http://127.0.0.1:8901/dashboard/index.html');
  await page.waitForSelector('table tbody tr', { timeout: 10000 });
  console.log('board rows rendered:', await page.locator('table tbody tr').count());
  await page.screenshot({ path: join(shotsDir, '1-board.png') });

  await page.locator('table tbody tr').first().click();
  await page.waitForSelector('dialog[open]', { timeout: 5000 });
  await page.waitForTimeout(200);
  console.log('detail open for:', await page.locator('#detail-title').textContent());
  await page.screenshot({ path: join(shotsDir, '2-detail.png') });

  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('dialog')?.open, null, { timeout: 5000 });
  await page.selectOption('#category', 'Dexs');
  await page.waitForTimeout(300);
  console.log('filtered rows (Dexs):', await page.locator('table tbody tr').count());
  await page.screenshot({ path: join(shotsDir, '3-filtered.png') });

  console.log('page errors:', errors.length === 0 ? 'none' : errors);
} finally {
  await browser.close();
  server.close();
}
for (const f of ['1-board.png', '2-detail.png', '3-filtered.png']) {
  const s = statSync(join(shotsDir, f));
  console.log(f, s.size, 'bytes');
}
