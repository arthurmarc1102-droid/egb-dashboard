// Opens the page with the new data in a headless browser: visits every tab on desktop and phone, then uses the page like a person
// (builds and saves a structure, finds it in the RV screen, backtests it, downloads a CSV, sets a custom date range). Fails on any script error.
import http from 'http'; import fs from 'fs'; import path from 'path';
const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright');
const root = path.resolve(process.argv[2] || '.');
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(root, u === '/' ? 'index.html' : u);
  if (!f.startsWith(root) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': f.endsWith('.json') ? 'application/json' : 'text/html' }); r.end(fs.readFileSync(f)); }).listen(8765);
const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {}); const errors = [], out = [];
async function newPage(vp) {
  const page = await b.newPage({ viewport: vp, acceptDownloads: true }); page.on('pageerror', e => errors.push(`${vp.width}px: ${e}`));
  if (process.env.LOCAL_D3) { await page.route('https://cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(process.env.LOCAL_D3) })); await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' })); }
  return page;
}
const check = (ok, what) => { out.push(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) errors.push(what); };
for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  const page = await newPage(vp);
  await page.goto('http://localhost:8765/'); await page.waitForSelector('#tabs button', { timeout: 20000 });
  const tabs = await page.$$eval('#tabs button', bs => bs.map(x => x.id.replace('tab-', '')));
  for (const t of tabs) {
    await page.click('#tab-' + t); await page.waitForTimeout(t === 'curvelab' || t === 'backtest' ? 1500 : 700);
    const n = await page.$$eval('#view .panel', ps => ps.length), empty = await page.$$eval('#view .empty', es => es.map(e => e.innerText));
    out.push(`${vp.width}px ${t}: ${n} panels${empty.length ? ', empty: ' + empty.join(' | ').slice(0, 160) : ''}`);
    if (!n) errors.push(`${vp.width}px ${t}: no panel`);
    const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2); if (wide) errors.push(`${vp.width}px ${t}: page wider than the screen`);
  }
  out.push(`${vp.width}px header: ${await page.$eval('#asof', e => e.innerText)}`);
  await page.close();
}
// ---- interactions, desktop
const page = await newPage({ width: 1440, height: 900 });
await page.goto('http://localhost:8765/#builder'); await page.waitForSelector('#p-build');
await page.click('#p-build button:has-text("Fly")'); await page.waitForTimeout(300);
const legs = await page.$$eval('#p-build .legrow', r => r.length); check(legs === 3, `builder: Fly template gives 3 legs (${legs})`);
await page.fill('#p-build input[type=text]', 'Test fly'); await page.press('#p-build input[type=text]', 'Tab'); await page.waitForTimeout(200);
await page.click('#p-build button:has-text("Save")'); await page.waitForTimeout(400);
const saved = await page.$$eval('#p-saved tbody tr', r => r.map(x => x.innerText)); check(saved.some(x => x.includes('Test fly')), 'builder: saved structure listed');
const prevLevel = await page.$eval('#p-bprev .stat .v', e => e.innerText); check(/\d/.test(prevLevel), `builder: preview level ${prevLevel}`);
await page.click('#tab-rv'); await page.waitForTimeout(500); await page.click('#p-rv button:has-text("Custom")'); await page.waitForTimeout(400);
const rvRows = await page.$$eval('#p-rv tbody tr', r => r.map(x => x.innerText)); check(rvRows.length === 1 && rvRows[0].includes('Test fly'), 'RV screen: custom structure in category Custom');
await page.click('#tab-builder'); await page.waitForTimeout(400); await page.click('#p-saved button:has-text("Backtest")'); await page.waitForTimeout(1200);
const btName = await page.$eval('#p-bt-ctl select', s => s.options[s.selectedIndex].text); check(btName === 'Test fly', `backtest opened on the custom structure (${btName})`);
const before = await page.$eval('#p-bt-stats .stat .v', e => e.innerText);
await page.fill('#p-bt-ctl input[aria-label="Entry level of |z|"]', '1'); await page.press('#p-bt-ctl input[aria-label="Entry level of |z|"]', 'Tab'); await page.waitForTimeout(800);
const after = await page.$eval('#p-bt-stats .stat .v', e => e.innerText); check(before !== after, `backtest reruns when a rule changes (${before} -> ${after})`);
await page.click('#p-bt-scan button:has-text("Run")'); await page.waitForTimeout(2500);
const scan = await page.$$eval('#p-bt-scan tbody tr', r => r.length); check(scan > 10, `backtest scan lists ${scan} structures`);
const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }).catch(() => null), page.click('#p-bt-trades button:has-text("CSV")')]);
const csv = dl ? fs.readFileSync(await dl.path(), 'utf8') : ''; check(csv.startsWith('signal_date,entry_date') && csv.split('\n').length > 2, `CSV download of trades (${csv.split('\n').length - 1} rows)`);
await page.click('#tab-curves'); await page.waitForTimeout(400); await page.click('#filters button:has-text("Custom")'); await page.waitForTimeout(400);
await page.fill('#filters input[aria-label="Chart range from"]', '2022-01-03'); await page.press('#filters input[aria-label="Chart range from"]', 'Tab'); await page.waitForTimeout(300);
await page.fill('#filters input[aria-label="Chart range to (empty: latest)"]', '2022-12-30'); await page.press('#filters input[aria-label="Chart range to (empty: latest)"]', 'Tab'); await page.waitForTimeout(600);
await page.click('#p-yield-hist button:has-text("Table")'); await page.waitForTimeout(400);
const dates = await page.$$eval('#p-yield-hist tbody tr td:first-child', tds => tds.map(t => t.innerText)); check(dates.length > 200 && dates[0].includes('2022') && dates[dates.length - 1].includes('2022'), `custom range 2022: ${dates.length} rows, ${dates[dates.length - 1]} to ${dates[0]}`);
await page.click('#tab-builder'); await page.waitForTimeout(400);
await page.selectOption('#p-wb select', { label: 'DE 2s10s' }); await page.waitForTimeout(400); await page.click('#p-wb button:has-text("Level")'); await page.waitForTimeout(300);
const wbCharts = await page.$$eval('#p-wb svg', s => s.length); check(wbCharts === 2, `workbench: yields and bp structures on two charts (${wbCharts})`);
await page.click('#p-wb button:has-text("Change since start")'); await page.waitForTimeout(300);
check(await page.$$eval('#p-wb svg', s => s.length) === 1, 'workbench: change since start on one chart');
await page.close(); await b.close(); srv.close();
const txt = out.map(x => 'PAGE  ' + x).join('\n') + '\n' + errors.map(x => 'FAIL  page ' + x).join('\n') + (errors.length ? '\n' : '');
if (fs.existsSync(path.join(root, 'data/raw'))) fs.appendFileSync(path.join(root, 'data/raw/verify.txt'), txt);
console.log(out.join('\n')); if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
