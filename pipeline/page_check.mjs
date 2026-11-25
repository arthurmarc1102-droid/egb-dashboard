// Opens the page with the new data in a headless browser: visits every space and section on desktop and phone, then uses the page like a person
// (reads the brief, builds and saves a structure, finds it in the RV screen, backtests it, downloads a CSV, sets a custom date range, goes back).
// Fails on any script error, empty screen or sideways overflow.
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
/** Go to a section the way a person does: the space first, then the section inside it. */
async function nav(page, id) {
  const sp = await page.$$eval('#spaces button', (bs, id) => { const x = bs.find(e => (e.dataset.tabs || '').split(',').includes(id)); return x ? x.id : null; }, id);
  if (!sp) throw new Error('no space holds the section ' + id);
  await page.click('#' + sp); await page.waitForTimeout(200);
  const tab = await page.$('#tab-' + id); if (tab) { await tab.click(); await page.waitForTimeout(200); }
  const at = await page.evaluate(() => location.hash); if (at !== '#' + id) throw new Error(`asked for ${id}, the address says ${at}`);
}
for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  const page = await newPage(vp);
  await page.goto('http://localhost:8765/'); await page.waitForSelector('#spaces button', { timeout: 20000 }); await page.waitForTimeout(600);
  check(await page.evaluate(() => !!document.querySelector('#p-note .headline')), `${vp.width}px: the page opens on the brief`);
  const spaces = await page.$$eval('#spaces button', bs => bs.map(x => ({ id: x.id, tabs: (x.dataset.tabs || '').split(',').filter(Boolean) })));
  check(spaces.length === 5 && spaces.reduce((a, s) => a + s.tabs.length, 0) === 13, `${vp.width}px: 5 spaces, 13 sections (${spaces.map(s => s.tabs.length).join('+')})`);
  for (const t of spaces.flatMap(s => s.tabs)) {
    await nav(page, t); await page.waitForTimeout(t === 'curvelab' || t === 'backtest' ? 1500 : 700);
    const n = await page.$$eval('#view .panel', ps => ps.length), empty = await page.$$eval('#view .empty', es => es.map(e => e.innerText));
    out.push(`${vp.width}px ${t}: ${n} panels${empty.length ? ', empty: ' + empty.join(' | ').slice(0, 160) : ''}`);
    if (!n) errors.push(`${vp.width}px ${t}: no panel`);
    if (await page.$('#p-error')) errors.push(`${vp.width}px ${t}: the screen could not be drawn`);
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); if (wide > 2) errors.push(`${vp.width}px ${t}: page wider than the screen by ${wide}px`);
  }
  const bar = await page.$eval('#spaces', e => getComputedStyle(e).position);
  check(vp.width > 900 ? bar !== 'fixed' : bar === 'fixed', `${vp.width}px: spaces ${vp.width > 900 ? 'in the masthead' : 'in a bar at the bottom of the screen'}`);
  out.push(`${vp.width}px header: ${await page.$eval('#asof', e => e.innerText)}`);
  await page.close();
}
// ---- the brief, desktop
const page = await newPage({ width: 1440, height: 900 });
await page.goto('http://localhost:8765/'); await page.waitForSelector('#p-note .headline'); await page.waitForTimeout(800);
await page.evaluate(() => document.fonts.ready);
out.push('fonts: ' + await page.evaluate(() => ['Newsreader', 'IBM Plex Sans Condensed', 'IBM Plex Sans'].map(n => { const f = [...document.fonts].filter(x => x.family.replace(/["']/g, '') === n);
  return `${n} ${f.filter(x => x.status === 'loaded').length} of ${f.length} faces loaded`; }).join(', ')));
const head = await page.$eval('#p-note .headline', e => e.innerText.trim());
check(/^(Bunds|OATs|Bonos)[ :].*(10-year yield (fell|rose) [\d.]+ bp to|10-year yield was unchanged at) [\d.]+ %/.test(head), `brief headline: ${head}`);
const movers = await page.$$eval('#p-movers tbody tr', r => r.length), zs = await page.$$eval('#p-extremes .zn', r => r.length), nxt = await page.$$eval('#p-next .item', r => r.length);
check(movers >= 1 && movers <= 5 && zs >= 1 && zs <= 6 && nxt >= 1, `brief: ${movers} moves, ${zs} z-scores, ${nxt} coming events`);
const lad = await page.evaluate(() => { const t = document.querySelector('#p-ladder table'), s = document.querySelector('#p-ladder svg'); const dots = [...s.querySelectorAll('circle')].slice(0, 3).map(c => +c.getAttribute('cx'));
  const cells = [...t.querySelectorAll('thead th')].slice(1, 4).map(c => { const r = c.getBoundingClientRect(), o = s.getBoundingClientRect(); return (r.left + r.right) / 2 - o.left; }); return { dots, cells }; });
check(lad.dots.every((x, i) => Math.abs(x - lad.cells[i]) < 1.5), `curve ladder: dots sit above their columns (${lad.dots.map(x => x.toFixed(0)).join(', ')} vs ${lad.cells.map(x => x.toFixed(0)).join(', ')})`);
await page.click('#p-movers tbody tr'); await page.waitForTimeout(500);
check(await page.evaluate(() => location.hash === '#rv' && !!document.querySelector('#p-rv')), 'brief: a move opens the RV screen');
await page.goBack(); await page.waitForTimeout(500);
check(await page.evaluate(() => !!document.querySelector('#p-note .headline')), 'the Back button returns to the brief');
// ---- builder, RV, backtest, CSV, custom range, workbench
await nav(page, 'builder'); await page.waitForSelector('#p-build');
await page.click('#p-build button:has-text("Fly")'); await page.waitForTimeout(300);
const legs = await page.$$eval('#p-build .legrow', r => r.length); check(legs === 3, `builder: Fly template gives 3 legs (${legs})`);
await page.fill('#p-build input[type=text]', 'Test fly'); await page.press('#p-build input[type=text]', 'Tab'); await page.waitForTimeout(200);
await page.click('#p-build button:has-text("Save")'); await page.waitForTimeout(400);
const saved = await page.$$eval('#p-saved tbody tr', r => r.map(x => x.innerText)); check(saved.some(x => x.includes('Test fly')), 'builder: saved structure listed');
const prevLevel = await page.$eval('#p-bprev .stat .v', e => e.innerText); check(/\d/.test(prevLevel), `builder: preview level ${prevLevel}`);
await nav(page, 'rv'); await page.waitForTimeout(500); await page.click('#p-rv button:has-text("Custom")'); await page.waitForTimeout(400);
const rvRows = await page.$$eval('#p-rv tbody tr', r => r.map(x => x.innerText)); check(rvRows.length === 1 && rvRows[0].includes('Test fly'), 'RV screen: custom structure in category Custom');
await nav(page, 'builder'); await page.waitForTimeout(400); await page.click('#p-saved button:has-text("Backtest")'); await page.waitForTimeout(1200);
const btName = await page.$eval('#p-bt-ctl select', s => s.options[s.selectedIndex].text); check(btName === 'Test fly', `backtest opened on the custom structure (${btName})`);
const before = await page.$eval('#p-bt-stats .stat .v', e => e.innerText);
await page.fill('#p-bt-ctl input[aria-label="Entry level of |z|"]', '1'); await page.press('#p-bt-ctl input[aria-label="Entry level of |z|"]', 'Tab'); await page.waitForTimeout(800);
const after = await page.$eval('#p-bt-stats .stat .v', e => e.innerText); check(before !== after, `backtest reruns when a rule changes (${before} -> ${after})`);
await page.click('#p-bt-scan button:has-text("Run")'); await page.waitForTimeout(2500);
const scan = await page.$$eval('#p-bt-scan tbody tr', r => r.length); check(scan > 10, `backtest scan lists ${scan} structures`);
// carry in the P&L, then the walk-forward test
await page.click('#p-bt-ctl [aria-label="Carry and roll-down in the P&L"] button:has-text("On")'); await page.waitForTimeout(900);
const carryOn = await page.$$eval('#p-bt-stats .stat .k', k => k.map(e => e.innerText.trim())), carryTxt = await page.$eval('#p-bt-stats p.muted', e => e.innerText);
check(carryOn.includes('Of which carry') || /cannot be computed/.test(carryTxt), `backtest: carry switched on (${carryOn.includes('Of which carry') ? 'carry shown in the results' : 'not available for this structure, and the page says so'})`);
await page.click('#p-wf button:has-text("Run walk-forward")'); await page.waitForSelector('#p-wf .stat, #p-wf .empty', { timeout: 60000 }); await page.waitForTimeout(600);
const wfStats = await page.$$eval('#p-wf .stat', s => s.length), wfRows = await page.$$eval('#p-wf tbody tr', r => r.length), wfSvg = await page.$$eval('#p-wf svg', s => s.length);
check(wfStats >= 8 && wfRows > 2 && wfSvg === 1, `walk-forward: ${wfStats} figures, ${wfRows} blocks, ${wfSvg} chart`);
const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }).catch(() => null), page.click('#p-bt-trades button:has-text("CSV")')]);
const csv = dl ? fs.readFileSync(await dl.path(), 'utf8') : ''; check(csv.startsWith('signal_date,entry_date') && csv.split('\n').length > 2, `CSV download of trades (${csv.split('\n').length - 1} rows)`);
await nav(page, 'curves'); await page.waitForTimeout(400); await page.click('#filters button:has-text("Custom")'); await page.waitForTimeout(400);
await page.fill('#filters input[aria-label="Chart range from"]', '2022-01-03'); await page.press('#filters input[aria-label="Chart range from"]', 'Tab'); await page.waitForTimeout(300);
await page.fill('#filters input[aria-label="Chart range to (empty: latest)"]', '2022-12-30'); await page.press('#filters input[aria-label="Chart range to (empty: latest)"]', 'Tab'); await page.waitForTimeout(600);
await page.click('#p-yield-hist button:has-text("Table")'); await page.waitForTimeout(400);
const dates = await page.$$eval('#p-yield-hist tbody tr td:first-child', tds => tds.map(t => t.innerText)); check(dates.length > 200 && dates[0].includes('2022') && dates[dates.length - 1].includes('2022'), `custom range 2022: ${dates.length} rows, ${dates[dates.length - 1]} to ${dates[0]}`);
await nav(page, 'builder'); await page.waitForTimeout(400);
await page.selectOption('#p-wb select', { label: 'DE 2s10s' }); await page.waitForTimeout(400); await page.click('#p-wb button:has-text("Level")'); await page.waitForTimeout(300);
const wbCharts = await page.$$eval('#p-wb svg', s => s.length); check(wbCharts === 2, `workbench: yields and bp structures on two charts (${wbCharts})`);
await page.click('#p-wb button:has-text("Change since start")'); await page.waitForTimeout(300);
check(await page.$$eval('#p-wb svg', s => s.length) === 1, 'workbench: change since start on one chart');
await page.close();
// ---- phone: the filter row folds and opens
const ph = await newPage({ width: 390, height: 844 });
await ph.goto('http://localhost:8765/#monitor'); await ph.waitForSelector('#filters .ftoggle'); await ph.waitForTimeout(600);
const folded = await ph.$$eval('#filters .fgroup', g => g.filter(e => e.offsetParent !== null).length);
await ph.click('#filters .ftoggle'); await ph.waitForTimeout(300);
const open = await ph.$$eval('#filters .fgroup', g => g.filter(e => e.offsetParent !== null).length);
check(folded === 0 && open === 3, `phone: filters folded (${folded} groups shown), then open (${open})`);
await ph.click('#filters button[title="France"]'); await ph.waitForTimeout(400);
check(await ph.$eval('#filters button[title="France"]', e => e.getAttribute('aria-pressed') === 'false'), 'phone: a country can be switched off from the open filters');
await ph.close();
// ---- picture shown when the link is shared: the brief at 1200 x 630, redrawn when new daily fixings are published
if (process.env.PREVIEW) {
  const pv = await newPage({ width: 1200, height: 630 });
  await pv.goto('http://localhost:8765/'); await pv.waitForSelector('#p-note .headline'); await pv.evaluate(() => document.fonts.ready); await pv.waitForTimeout(700);
  const close = await pv.$eval('#asof', e => e.innerText.replace(/\s+/g, ' ').trim()), stamp = path.join(root, 'data/raw/preview_close.txt');
  const serif = await pv.evaluate(() => [...document.fonts].some(f => f.family.replace(/["']/g, '') === 'Newsreader' && f.status === 'loaded'));
  if (!serif && !process.env.PREVIEW_ANY_FONT) out.push('share picture kept: the headline typeface did not load in this run');
  else if (fs.existsSync(process.env.PREVIEW) && fs.existsSync(stamp) && fs.readFileSync(stamp, 'utf8').trim() === close) out.push(`share picture kept: already drawn for "${close}"`);
  else { await pv.screenshot({ path: process.env.PREVIEW }); if (fs.existsSync(path.dirname(stamp))) fs.writeFileSync(stamp, close + '\n'); out.push(`share picture redrawn for "${close}", ${(fs.statSync(process.env.PREVIEW).size / 1024).toFixed(0)} kB`); }
  await pv.close();
}
await b.close(); srv.close();
const txt = out.map(x => 'PAGE  ' + x).join('\n') + '\n' + errors.map(x => 'FAIL  page ' + x).join('\n') + (errors.length ? '\n' : '');
if (fs.existsSync(path.join(root, 'data/raw'))) fs.appendFileSync(path.join(root, 'data/raw/verify.txt'), txt);
console.log(out.join('\n')); if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
