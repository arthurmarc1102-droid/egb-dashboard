// Opens the page with the new data in a headless browser, visits every tab, and fails on any script error or empty tab.
import http from 'http'; import fs from 'fs'; import path from 'path'; import { chromium } from 'playwright';
const root = path.resolve(process.argv[2] || '.');
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(root, u === '/' ? 'index.html' : u);
  if (!f.startsWith(root) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': f.endsWith('.json') ? 'application/json' : 'text/html' }); r.end(fs.readFileSync(f)); }).listen(8765);
const b = await chromium.launch(); const errors = []; const out = [];
for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  const page = await b.newPage({ viewport: vp }); page.on('pageerror', e => errors.push(`${vp.width}px: ${e}`));
  await page.goto('http://localhost:8765/'); await page.waitForSelector('#tabs button', { timeout: 20000 });
  const tabs = await page.$$eval('#tabs button', bs => bs.map(x => x.id.replace('tab-', '')));
  for (const t of tabs) {
    await page.click('#tab-' + t); await page.waitForTimeout(700);
    const n = await page.$$eval('#view .panel', ps => ps.length), empty = await page.$$eval('#view .empty', es => es.map(e => e.innerText));
    out.push(`${vp.width}px ${t}: ${n} panels${empty.length ? ', empty: ' + empty.join(' | ') : ''}`);
    if (!n) errors.push(`${vp.width}px ${t}: no panel`);
    const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2); if (wide) errors.push(`${vp.width}px ${t}: page wider than the screen`);
  }
  const asof = await page.$eval('#asof', e => e.innerText); out.push(`${vp.width}px header: ${asof}`);
  await page.close();
}
await b.close(); srv.close();
fs.appendFileSync(path.join(root, 'data/raw/verify.txt'), out.map(x => 'PAGE  ' + x).join('\n') + '\n' + errors.map(x => 'FAIL  page ' + x).join('\n') + (errors.length ? '\n' : ''));
console.log(out.join('\n')); if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
