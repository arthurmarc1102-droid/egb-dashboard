// Reads what the page shows in the Backtest and PCA & carry tabs for given settings, as JSON.
import http from 'http'; import fs from 'fs'; import path from 'path';
const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright');
const [,, rootDir, caseFile] = process.argv; const dataDir = rootDir + '/data'; const cases = JSON.parse(fs.readFileSync(caseFile));
const srv = http.createServer((q, res) => { const u = q.url.split('?')[0]; const f = u === '/' ? rootDir + '/index.html' : u.startsWith('/data/') ? path.join(dataDir, u.slice(6)) : null;
  if (!f || !fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': f.endsWith('.json') ? 'application/json' : 'text/html' }); res.end(fs.readFileSync(f)); }).listen(8767);
const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {}); const out = {}, errs = [];
async function open(state, tab) {
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } }); page.on('pageerror', e => errs.push(tab + ': ' + e));
  if (process.env.LOCAL_D3) await page.route('https://cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(process.env.LOCAL_D3) }));

  await page.addInitScript(([s, c]) => { localStorage.setItem('egb-state', JSON.stringify(s)); localStorage.setItem('egb-custom', JSON.stringify(c)); }, [state, cases.custom || []]);
  await page.goto('http://localhost:8767/#' + tab); await page.waitForTimeout(2200); return page;
}
const tableOf = (page, sel) => page.$$eval(sel + ' table.t tbody tr', trs => trs.map(tr => [...tr.querySelectorAll('td')].map(td => td.innerText.trim())));
for (const [k, bt] of Object.entries(cases.backtests)) {
  const page = await open({ tab: 'backtest', btSel: bt.id, bt: bt.p, countries: ['DE', 'FR', 'ES'] }, 'backtest');
  out['bt_' + k] = await page.$$eval('#p-bt-stats .stat', ss => Object.fromEntries(ss.map(s => [s.querySelector('.k').innerText.trim(), s.querySelector('.v').innerText.trim()])));
  await page.close();
}
for (const [c, win] of cases.pcaPage) {
  const page = await open({ tab: 'curvelab', clC: c, clWin: win, clHor: '3M', countries: ['DE', 'FR', 'ES'], tables: { 'p-pca-load': true } }, 'curvelab');
  out[`pca_${c}_${win}`] = { foot: await page.$eval('#p-pca-load footer', e => e.innerText), loadings: await tableOf(page, '#p-pca-load'), resid: await tableOf(page, '#p-pca-rc'), fly: await tableOf(page, '#p-pca-fly'), ns: await tableOf(page, '#p-ns'), carry: await tableOf(page, '#p-carry') };
  await page.close();
}
console.log(JSON.stringify({ errs, out })); await b.close(); srv.close();
