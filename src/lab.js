  // ===================================================================== 9. lab: custom structures, workbench, backtests, PCA, carry, fitted curve
  // Every number below is computed in the browser from data/market.json. pipeline/check_lab.py recomputes the same quantities in Python.

  const LAB_TABS = [['builder', 'Builder'], ['curvelab', 'PCA & carry'], ['backtest', 'Backtest']];
  const BT_DEF = { win: 63, entry: 2, exit: 0.5, stop: 4, maxHold: 60, cost: 0.5, side: 'both', mode: 'revert', lag: 1, from: '', to: '' };
  let BASE = [];                                          // universe built from the data, before custom structures
  const EXTRA = new Map();                                // series usable as legs but not shown in the screens (money market)

  // ---------- 9.1 custom structures
  const CUSTOM_KEY = 'egb-custom';
  function loadCustom() { try { const c = JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]'); return Array.isArray(c) ? c : []; } catch (e) { return []; } }
  let CUSTOM = loadCustom();
  function saveCustom() { try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(CUSTOM)); } catch (e) { /* storage is optional */ } }
  const legSeries = id => BASE.find(u => u.id === id) || EXTRA.get(id);

  /** Value of a weighted structure in bp: sum of weight x leg, yields converted from % to bp. */
  function buildCustom(c) {
    const legs = c.legs.map(l => ({ s: legSeries(l.id), w: Number(l.w) })).filter(l => l.s && Number.isFinite(l.w) && l.w !== 0);
    if (!legs.length) return null;
    const k = legs.map(l => (l.s.unit === 'pct' ? 100 : 1));
    const j = join(legs.map(l => l.s), (...v) => v.reduce((a, x, i) => a + legs[i].w * x * k[i], 0));
    const country = legs[0].s.country && COUNTRIES[legs[0].s.country] ? legs[0].s.country : REF;
    return { id: c.id, cat: 'custom', country, name: c.name || legsText(c.legs), long: 'custom: ' + legsText(c.legs) + ', in bp', unit: 'bp', ...j,
      src: [...new Set(legs.flatMap(l => l.s.src || []))], def: c };
  }
  function legsText(legs) {
    return legs.filter(l => Number(l.w)).map((l, i) => { const w = Number(l.w), s = legSeries(l.id), a = Math.abs(w);
      return (i === 0 ? (w < 0 ? MINUS : '') : (w < 0 ? ' ' + MINUS + ' ' : ' + ')) + (a === 1 ? '' : num(a, a % 1 ? 3 : 0).replace(/0+$/, '').replace(/\.$/, '') + MULT) + (s ? s.name : l.id); }).join('');
  }
  const MULT = '×';
  function rebuildUniverse() {
    const custom = CUSTOM.map(buildCustom).filter(u => u && u.values.length > 1);
    U = BASE.concat(custom); BYID = new Map(U.map(u => [u.id, u])); for (const [k, v] of EXTRA) if (!BYID.has(k)) BYID.set(k, v);
  }
  function initLab(market) {
    BASE = U.slice();
    for (const s of market.series) if (s.group === 'mm') EXTRA.set(s.id, { id: s.id, cat: 'rate', country: null, name: s.name.replace('Euro short-term rate', '€STR'), long: s.name, unit: 'pct', decimals: s.decimals, dates: s.dates, values: s.values, src: [s.source] });
    importFromHash(); rebuildUniverse();
  }
  // Share a structure: #builder/s=<base64 of JSON>
  function importFromHash() {
    const m = location.hash.match(/s=([A-Za-z0-9_\-]+)/); if (!m) return;
    try {
      const c = JSON.parse(decodeURIComponent(escape(atob(m[1].replace(/-/g, '+').replace(/_/g, '/')))));
      if (c && Array.isArray(c.legs) && !CUSTOM.some(x => JSON.stringify(x.legs) === JSON.stringify(c.legs))) { c.id = 'X' + Date.now().toString(36); CUSTOM.push(c); saveCustom(); }
      S.bSel = CUSTOM.length ? CUSTOM[CUSTOM.length - 1].id : S.bSel;
    } catch (e) { /* malformed link: ignored */ }
  }
  const shareLink = c => location.origin + location.pathname + '#builder/s=' + btoa(unescape(encodeURIComponent(JSON.stringify({ name: c.name, legs: c.legs })))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  // ---------- 9.2 CSV export
  function downloadCSV(name, head, rows) {
    const clean = v => { const s = String(v == null ? '' : v).replace(new RegExp(MINUS, 'g'), '-').replace(new RegExp(DASH, 'g'), ''); return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const txt = [head, ...rows].map(r => r.map(clean).join(',')).join('\n');
    const a = h('a', { href: URL.createObjectURL(new Blob([txt], { type: 'text/csv' })), download: name.replace(/[^\w\-]+/g, '_') + '.csv' });
    document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  const csvButton = (name, fn) => h('button', { class: 'linkbtn', type: 'button', title: 'Download as CSV', onclick: () => { const t = fn(); downloadCSV(name, t.head, t.rows); } }, 'CSV');
  /** Raw (unformatted) rows of several series, newest first, for CSV. */
  function rawTable(series) {
    const dates = [...new Set(series.flatMap(s => s.dates))].sort().reverse();
    const maps = series.map(s => { const m = new Map(); s.dates.forEach((d, i) => m.set(d, s.values[i])); return m; });
    return { head: ['date', ...series.map(s => s.name)], rows: dates.map(d => [d, ...maps.map(m => (m.has(d) ? +m.get(d).toFixed(6) : ''))]) };
  }

  // ---------- 9.3 date range helpers (global range, including a custom from / to)
  function rangeStart(dates) {
    if (S.range === 'Custom') { const i = d3.bisectLeft(dates, S.from || dates[0]); return Math.max(0, Math.min(i, dates.length - 1)); }
    const r = RANGES[S.range]; return Number.isFinite(r) ? Math.max(0, dates.length - r) : 0;
  }
  function inRange(s) {
    if (S.range !== 'Custom') return tail(s, RANGES[S.range]);
    const a = d3.bisectLeft(s.dates, S.from || s.dates[0]), b = S.to ? d3.bisectRight(s.dates, S.to) : s.dates.length;
    return { ...s, dates: s.dates.slice(a, b), values: s.values.slice(a, b) };
  }

  // ---------- 9.4 maths: backtest
  /** Z-score signal backtest on one series.
      Z is computed on the window ending on the decision day (that day included), like the RV screen.
      A decision taken at the fixing of day t is executed at the fixing of day t + lag (lag 1 by default: no look-ahead).
      Mean reversion: sell the structure when z >= entry, buy when z <= -entry; exit when |z| falls back to the exit level,
      stop when |z| reaches the stop level against the position, or after maxHold days. Trend: the opposite direction, exit on the exit level.
      P&L is in bp of the structure level (yields converted to bp), minus the round-trip cost charged at exit. */
  function backtest(u, p) {
    const k = u.unit === 'pct' ? 100 : 1, v = u.values.map(x => x * k), d = u.dates, L = v.length, n = Math.max(5, Math.round(p.win));
    const { mean, sd } = fastRolling(v, n), z = v.map((x, i) => (sd[i] > 0 ? (x - mean[i]) / sd[i] : NaN));
    const lag = p.lag ? 1 : 0, from = p.from ? d3.bisectLeft(d, p.from) : 0, to = p.to ? d3.bisectRight(d, p.to) - 1 : L - 1;
    const start = Math.max(n - 1, from), trades = [], pos = new Array(L).fill(0);
    let dir = 0, ie = -1, t = start;
    const allowed = s => p.side === 'both' || (p.side === 'long' && s > 0) || (p.side === 'short' && s < 0);
    for (t = start; t <= to; t++) {
      const zt = z[t]; if (!Number.isFinite(zt)) continue;
      if (dir === 0) {
        if (t + lag > to) break;
        let s = 0;
        if (Math.abs(zt) >= p.entry) s = p.mode === 'trend' ? Math.sign(zt) : -Math.sign(zt);
        if (s && allowed(s)) { dir = s; ie = t + lag; trades.push({ dir, signalDate: d[t], entryIdx: ie, entryDate: d[ie], entryLevel: v[ie], zIn: zt }); }
      } else if (t >= ie) {
        const zz = p.mode === 'trend' ? zt * dir : -zt * dir;      // distance of z from its mean in the direction of the trade signal
        let why = null;
        if (zz <= p.exit) why = 'target';
        else if (p.mode !== 'trend' && p.stop > 0 && zz >= p.stop) why = 'stop';
        else if (p.maxHold > 0 && t - ie >= p.maxHold) why = 'time';
        if (why && t + lag <= to) {
          const x = t + lag, tr = trades[trades.length - 1];
          Object.assign(tr, { exitIdx: x, exitDate: d[x], exitLevel: v[x], zOut: zt, why, days: x - ie, pnl: dir * (v[x] - v[ie]) - p.cost });
          dir = 0; t = x - 1;                                       // next decision from the exit day
        }
      }
    }
    const last = trades[trades.length - 1];
    if (last && last.exitIdx == null) Object.assign(last, { exitIdx: to, exitDate: d[to], exitLevel: v[to], zOut: z[to], why: 'open', days: to - last.entryIdx, pnl: last.dir * (v[to] - last.entryLevel) - p.cost });
    for (const tr of trades) for (let i = tr.entryIdx + 1; i <= tr.exitIdx; i++) pos[i] = tr.dir;  // position held over (i - 1, i]
    // daily equity, marked to market, cost charged on the exit day
    const eq = [], eqd = []; let cum = 0; const daily = [];
    const exitCost = new Map(trades.map(tr => [tr.exitIdx, p.cost]));
    for (let i = start; i <= to; i++) {
      const dp = i > start ? pos[i] * (v[i] - v[i - 1]) - (exitCost.get(i) || 0) : 0;
      cum += dp; daily.push(dp); eq.push(cum); eqd.push(d[i]);
    }
    let peak = -Infinity, mdd = 0; for (const e of eq) { peak = Math.max(peak, e); mdd = Math.min(mdd, e - peak); }
    const closed = trades.filter(tr => tr.why !== 'open'), wins = trades.filter(tr => tr.pnl > 0).length;
    const years = eqd.length > 1 ? (parseD(eqd[eqd.length - 1]) - parseD(eqd[0])) / (365.25 * 864e5) : NaN;
    const dm = d3.mean(daily.slice(1)), ds = d3.deviation(daily.slice(1));
    return { trades, closed: closed.length, wins, hit: trades.length ? wins / trades.length : NaN, total: cum, avg: trades.length ? d3.sum(trades, tr => tr.pnl) / trades.length : NaN,
      avgDays: trades.length ? d3.mean(trades, tr => tr.days) : NaN, mdd, perYear: years > 0 ? cum / years : NaN, sharpe: ds > 0 ? dm / ds * Math.sqrt(252) : NaN,
      inMarket: eqd.length ? pos.slice(start, to + 1).filter(x => x).length / eqd.length : NaN, equity: { dates: eqd, values: eq }, z: { dates: d, values: z }, level: { dates: d, values: v },
      start: d[start], end: d[to], years };
  }

  // ---------- 9.5 maths: symmetric eigen decomposition (Jacobi), PCA
  function eigSym(A) {
    const n = A.length, a = A.map(r => r.slice()), V = A.map((r, i) => r.map((_, j) => (i === j ? 1 : 0)));
    for (let sweep = 0; sweep < 100; sweep++) {
      let off = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += a[i][j] * a[i][j];
      if (off < 1e-22) break;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
        if (Math.abs(a[p][q]) < 1e-300) continue;
        const th = (a[q][q] - a[p][p]) / (2 * a[p][q]), t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) { const akp = a[k][p], akq = a[k][q]; a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq; }
        for (let k = 0; k < n; k++) { const apk = a[p][k], aqk = a[q][k]; a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk; }
        for (let k = 0; k < n; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq; }
      }
    }
    const idx = a.map((_, i) => i).sort((i, j) => a[j][j] - a[i][i]);
    return { values: idx.map(i => a[i][i]), vectors: idx.map(i => V.map(r => r[i])) };
  }
  /** PCA of daily yield changes (bp) for one country, on the last n common days.
      Signs: PC1 positive on average (level), PC2 rises with maturity (slope), PC3 positive in the middle (curvature). */
  function pca(c, n, tenors) {
    const legs = tenors.map(t => inst(`${c}_${t}Y`)).filter(Boolean);
    const jc = jointChanges(legs), from = Math.max(0, jc.cols[0].length - n), X = jc.cols.map(col => col.slice(from)), T = X[0].length, k = X.length;
    const mu = X.map(col => d3.mean(col)), C = X.map((a, i) => X.map((b, j) => { let s = 0; for (let t = 0; t < T; t++) s += (a[t] - mu[i]) * (b[t] - mu[j]); return s / (T - 1); }));
    const e = eigSym(C), tot = d3.sum(e.values);
    const vec = e.vectors.map((v, r) => {
      if (r === 0 && d3.sum(v) < 0) return v.map(x => -x);
      if (r === 1 && v[v.length - 1] - v[0] < 0) return v.map(x => -x);
      if (r === 2) { const mid = v.slice(1, -1); if (mid.length && d3.mean(mid) - (v[0] + v[v.length - 1]) / 2 < 0) return v.map(x => -x); }
      return v;
    });
    // factor paths: cumulative scores of the daily changes; levels residual against the first three factors
    const dates = jc.dates.slice(from), lv = jc.levels.values.slice(jc.levels.values.length - T).map(r => r.map(x => x * 100));
    const lmu = d3.range(k).map(i => d3.mean(lv, r => r[i]));
    const nf = Math.min(3, k), resid = lv.map(r => { const x = r.map((v, i) => v - lmu[i]); const f = d3.range(nf).map(q => d3.sum(x.map((v, i) => v * vec[q][i]))); return x.map((v, i) => v - d3.sum(d3.range(nf).map(q => f[q] * vec[q][i]))); });
    const scores = d3.range(Math.min(3, k)).map(q => { let s = 0; return X[0].map((_, t) => (s += d3.sum(X.map((col, i) => col[t] * vec[q][i])))); });   // raw changes, so the path shows the factor move over the window
    return { tenors: legs.map(u => u.tenor), legs, values: e.values, share: e.values.map(x => x / tot), vectors: vec, dates, scores, resid, T, lastLevels: lv[lv.length - 1] };
  }
  /** Weights of the two wings that make body - wa x A - wc x C neutral to the first two factors. Body weight 2 for comparison with 2b - a - c. */
  function pcaFlyWeights(P, ta, tb, tc) {
    const i = P.tenors.indexOf(ta), j = P.tenors.indexOf(tb), k = P.tenors.indexOf(tc); if (i < 0 || j < 0 || k < 0 || P.vectors.length < 2) return null;
    const [L1, L2] = P.vectors, det = L1[i] * L2[k] - L1[k] * L2[i]; if (Math.abs(det) < 1e-12) return null;
    const wa = (L1[j] * L2[k] - L1[k] * L2[j]) / det, wc = (L1[i] * L2[j] - L1[j] * L2[i]) / det;
    return { wa: 2 * wa, wb: 2, wc: 2 * wc };
  }

  // ---------- 9.6 maths: carry and roll-down
  const dmod = (y, T) => (y > 1e-9 ? (1 - Math.pow(1 + y, -T)) / y : T);    // annual-pay par bond, y in decimal
  function interp(points, T) {                                                // linear between tenors, no extrapolation
    for (let i = 1; i < points.length; i++) if (T >= points[i - 1].t && T <= points[i].t) { const a = points[i - 1], b = points[i]; return a.v + (b.v - a.v) * (T - a.t) / (b.t - a.t); }
    return NaN;
  }
  /** For a long position in the constant-maturity yield of tenor T over horizon h (years), in bp of yield:
      carry = (y - funding) x h / modified duration, roll-down = y(T) - y(T - h) read on today's curve. Funding at the latest euro short-term rate. */
  function carryRoll(c, h, funding) {
    const pts = U.filter(u => u.cat === 'outright' && u.country === c).map(u => ({ t: u.tenor, v: u.values[u.values.length - 1], u })).sort((a, b) => a.t - b.t);
    return pts.map(p => {
      const y = p.v, carry = (y - funding) * 100 * h / dmod(y / 100, p.t), roll = (y - interp(pts, p.t - h)) * 100;
      const ch = p.u.values.slice(-253).map((x, i, a) => (i ? (x - a[i - 1]) * 100 : NaN)).slice(1), vol = d3.deviation(ch) * Math.sqrt(h * 252);
      return { c, t: p.t, y, carry, roll, total: carry + (Number.isFinite(roll) ? roll : NaN), vol, ratio: (carry + roll) / vol, date: p.u.dates[p.u.dates.length - 1] };
    });
  }

  // ---------- 9.7 maths: Nelson-Siegel fit by day, residuals
  const nsLoad = (t, l) => { const x = t / l, a = (1 - Math.exp(-x)) / x; return [1, a, a - Math.exp(-x)]; };
  function solve3(A, b) {
    const M = A.map((r, i) => [...r, b[i]]);
    for (let c = 0; c < 3; c++) { let p = c; for (let r = c + 1; r < 3; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r; [M[c], M[p]] = [M[p], M[c]]; if (Math.abs(M[c][c]) < 1e-14) return null;
      for (let r = 0; r < 3; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k < 4; k++) M[r][k] -= f * M[c][k]; } }
    return M.map((r, i) => r[3] / M[i][i]);
  }
  const NS_LAMBDAS = d3.range(41).map(i => 0.3 * Math.pow(10 / 0.3, i / 40));
  function nsFit(ts, ys) {
    let best = null;
    for (const l of NS_LAMBDAS) {
      const X = ts.map(t => nsLoad(t, l)), A = [0, 1, 2].map(i => [0, 1, 2].map(j => d3.sum(X, r => r[i] * r[j]))), b = [0, 1, 2].map(i => d3.sum(X.map((r, k) => r[i] * ys[k])));
      const beta = solve3(A, b); if (!beta) continue;
      const fit = X.map(r => r[0] * beta[0] + r[1] * beta[1] + r[2] * beta[2]), sse = d3.sum(ys.map((y, k) => (y - fit[k]) ** 2));
      if (!best || sse < best.sse) best = { l, beta, fit, sse };
    }
    return best;
  }
  /** Residual (actual minus fitted, bp) of every tenor on each of the last n common days. Positive: yield above the fitted curve, cheap. */
  function nsResiduals(c, n) {
    const legs = U.filter(u => u.cat === 'outright' && u.country === c).sort((a, b) => a.tenor - b.tenor);
    if (legs.length < 4) return null;
    const j = join(legs, (...v) => v), from = Math.max(0, j.dates.length - n), ts = legs.map(u => u.tenor), res = [], dates = j.dates.slice(from); let lastFit = null;
    for (const row of j.values.slice(from)) { const f = nsFit(ts, row); res.push(row.map((y, k) => (y - f.fit[k]) * 100)); lastFit = f; }
    return { legs, ts, dates, res, lastFit, last: j.values[j.values.length - 1] };
  }

  // ---------- 9.8 small widgets
  const stat = (k, v, small) => h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v, small ? h('small', null, small) : null));
  function numInput(value, onSet, o) {
    return h('input', { class: 'inp', type: 'number', value: String(value), step: o.step || 'any', min: o.min, max: o.max, 'aria-label': o.label, title: o.label, style: o.w ? 'width:' + o.w : null,
      onchange: e => { const x = parseFloat(e.target.value); if (Number.isFinite(x)) onSet(x); } });
  }
  const field = (label, ctrl) => h('label', { class: 'field' }, h('span', null, label), ctrl);
  function seriesGroups(includeCustom, includeExtra) {
    const g = Object.entries(CATS).filter(([k]) => k !== 'all' && (k !== 'custom' || includeCustom)).map(([k, name]) => [name, U.filter(u => u.cat === k).map(u => [u.id, u.name])]);
    if (includeExtra && EXTRA.size) g.push(['Money market', [...EXTRA.values()].map(u => [u.id, u.name])]);
    return g.filter(x => x[1].length);
  }
  const PALETTE = () => [COL.DE, COL.FR, COL.IT, COL.ES, COL.NL, COL.BE, COL.AT, COL.PT];

  /** Sliding mean and sample standard deviation in O(L), on values re-centred on their first value for precision. */
  function fastRolling(values, n) {
    const L = values.length, mean = new Array(L).fill(NaN), sd = new Array(L).fill(NaN), c = values[0] || 0; let s = 0, q = 0;
    for (let i = 0; i < L; i++) {
      const x = values[i] - c; s += x; q += x * x;
      if (i >= n) { const y = values[i - n] - c; s -= y; q -= y * y; }
      if (i >= n - 1) { const m = s / n; mean[i] = m + c; sd[i] = Math.sqrt(Math.max(0, (q - n * m * m) / (n - 1))); }
    }
    return { mean, sd };
  }

  // ---------- 9.9 view: builder and workbench
  const TEMPLATES = {
    spread: () => [{ id: pickId(['FR_10Y', 'ES_10Y']), w: 1 }, { id: 'DE_10Y', w: -1 }],
    curve: () => [{ id: 'DE_2Y', w: -1 }, { id: 'DE_10Y', w: 1 }],
    fly: () => [{ id: 'DE_2Y', w: -1 }, { id: 'DE_5Y', w: 2 }, { id: 'DE_10Y', w: -1 }],
    box: () => [{ id: pickId(['FR_2Y', 'ES_3Y']), w: -1 }, { id: pickId(['FR_10Y', 'ES_10Y']), w: 1 }, { id: 'DE_2Y', w: 1 }, { id: 'DE_10Y', w: -1 }],
  };
  const pickId = ids => ids.find(i => legSeries(i)) || BASE[0].id;
  function draft() {
    if (!S.bDraft || !Array.isArray(S.bDraft.legs)) S.bDraft = { name: '', legs: TEMPLATES.spread() };
    S.bDraft.legs = S.bDraft.legs.filter(l => legSeries(l.id)); if (!S.bDraft.legs.length) S.bDraft.legs = TEMPLATES.curve();
    return S.bDraft;
  }
  function viewBuilder() {
    const D = draft(), groups = seriesGroups(false, true), n = WINDOWS[S.win];
    const upd = patch => { Object.assign(D, patch); set({ bDraft: D }); };
    const setLeg = (i, patch) => { const legs = D.legs.map((l, j) => (j === i ? { ...l, ...patch } : l)); upd({ legs }); };
    const preview = buildCustom({ id: 'draft', name: D.name || legsText(D.legs), legs: D.legs });
    const editing = CUSTOM.find(c => c.id === S.bEdit);
    const save = asNew => {
      if (!preview || preview.values.length < 2) return;
      const def = { id: asNew || !editing ? 'X' + Date.now().toString(36) : editing.id, name: (D.name || '').trim() || legsText(D.legs), legs: D.legs.map(l => ({ id: l.id, w: Number(l.w) })) };
      CUSTOM = asNew || !editing ? CUSTOM.concat(def) : CUSTOM.map(c => (c.id === def.id ? def : c)); saveCustom(); rebuildUniverse(); set({ bEdit: def.id });
    };
    const betaWeight = () => {   // second leg weight so that the two legs move together on the window: w2 = -w1 x beta(leg1 on leg2)
      if (D.legs.length !== 2) return; const a = legSeries(D.legs[0].id), b = legSeries(D.legs[1].id), jc = jointChanges([a, b]), f = ols(jc.cols[1].slice(-n), jc.cols[0].slice(-n));
      if (f) setLeg(1, { w: +(-Number(D.legs[0].w) * f.beta * (a.unit === 'pct' ? 100 : 1) / (b.unit === 'pct' ? 100 : 1)).toFixed(4) });
    };
    const legRows = D.legs.map((l, i) => h('div', { class: 'legrow' },
      numInput(l.w, w => setLeg(i, { w }), { label: 'Weight of leg ' + (i + 1), w: '84px', step: '0.1' }), h('span', { class: 'muted' }, MULT),
      select(groups, l.id, id => setLeg(i, { id }), 'Series of leg ' + (i + 1)),
      h('button', { class: 'linkbtn', type: 'button', title: 'Remove this leg', disabled: D.legs.length < 2, onclick: () => upd({ legs: D.legs.filter((_, j) => j !== i) }) }, 'Remove')));
    const share = editing ? h('button', { class: 'linkbtn', type: 'button', onclick: e => { const url = shareLink(editing); try { navigator.clipboard.writeText(url); e.target.textContent = 'Link copied'; } catch (x) { prompt('Link to this structure', url); } } }, 'Copy link') : null;
    const editor = panel({ id: 'p-build', span: 's5', title: editing ? 'Edit structure' : 'Build a structure', sub: 'any weighted sum of yields and structures, in bp',
      tools: [['spread', 'Spread'], ['curve', 'Curve'], ['fly', 'Fly'], ['box', 'Box']].map(([k, t]) => h('button', { class: 'linkbtn', type: 'button', title: 'Start from a ' + t.toLowerCase(), onclick: () => { S.bEdit = null; upd({ legs: TEMPLATES[k](), name: '' }); } }, t)) },
      h('div', { class: 'legs' }, legRows),
      h('div', { class: 'row-actions' }, D.legs.length < 8 ? h('button', { class: 'btn', type: 'button', onclick: () => upd({ legs: D.legs.concat({ id: D.legs[D.legs.length - 1].id, w: -1 }) }) }, 'Add leg') : null,
        D.legs.length === 2 ? h('button', { class: 'btn', type: 'button', title: `Set the second weight to minus the regression beta of leg 1 on leg 2 (daily changes, ${S.win} window)`, onclick: betaWeight }, 'Beta-weight leg 2') : null),
      field('Name', h('input', { class: 'inp', type: 'text', value: D.name || '', placeholder: legsText(D.legs), 'aria-label': 'Name of the structure', onchange: e => upd({ name: e.target.value }) })),
      h('p', { class: 'prose', style: 'margin:6px 0' }, 'Value = ', h('b', null, legsText(D.legs)), '. Yields count in bp: a weight of 1 on a 10-year yield adds that yield times 100. A weight of 2 on the body and ', MINUS, '1 on each wing gives the usual butterfly.'),
      h('div', { class: 'row-actions' }, h('button', { class: 'btn primary', type: 'button', disabled: !preview || preview.values.length < 2, onclick: () => save(false) }, editing ? 'Save changes' : 'Save'),
        editing ? h('button', { class: 'btn', type: 'button', onclick: () => save(true) }, 'Save as new') : null, share,
        editing ? h('button', { class: 'linkbtn', type: 'button', onclick: () => set({ bEdit: null, bDraft: { name: '', legs: D.legs } }) }, 'New structure') : null),
      h('p', { class: 'muted', style: 'margin:8px 0 0;font-size:12px' }, 'Saved structures stay in this browser and appear in the RV screen (category Custom), the analysis tab and the backtest. Copy link shares one.'));
    const prev = preview && preview.values.length > 1 ? detailPanel(preview, 'p-bprev', 's7', 'Preview')
      : panel({ id: 'p-bprev', span: 's7', title: 'Preview' }, h('div', { class: 'empty' }, 'These legs have no common date. Pick series that overlap in time.'));
    // saved structures
    const mine = U.filter(u => u.cat === 'custom');
    const saved = panel({ id: 'p-saved', span: 's12', title: 'Saved structures', sub: mine.length ? `${mine.length} in this browser, changes in bp` : 'none yet',
      tools: mine.length ? csvButton('custom_structures', () => ({ head: ['name', 'definition', 'level_bp', 'z_' + S.win, 'chg_1d', 'chg_1m'], rows: mine.map(u => { const st = stats(u, n); return [u.name, legsText(u.def.legs), +st.last.toFixed(3), +(st.z || 0).toFixed(3), +change(u, 1).toFixed(2), +change(u, 21).toFixed(2)]; }) })) : null },
      mine.length ? h('div', { class: 'scroll' }, h('table', { class: 't' }, h('thead', null, h('tr', null, ['Structure', 'Definition', 'Level', 'Z ' + S.win, 'Pctile', '1D', '1M', ''].map(c => h('th', null, c)))),
        h('tbody', null, mine.map(u => { const st = stats(u, n), d1 = change(u, 1), d21 = change(u, 21);
          return h('tr', { class: Math.abs(st.z) >= 2 ? 'hot' : null }, h('td', null, h('span', { class: 'name' }, u.name)), h('td', { class: 'muted' }, legsText(u.def.legs)), h('td', { class: 'lvl' }, num(st.last, 1)), h('td', null, zChip(st.z)), h('td', null, num(st.pct, 0)),
            heatCell(bp(d1), d1, HEAT_BP['1D']), heatCell(bp(d21), d21, HEAT_BP['1M']),
            h('td', { style: 'white-space:nowrap' }, h('button', { class: 'linkbtn', type: 'button', onclick: () => set({ bEdit: u.id, bDraft: { name: u.def.name, legs: u.def.legs.map(l => ({ ...l })) } }) }, 'Edit'), ' ',
              h('button', { class: 'linkbtn', type: 'button', onclick: () => { S.bt = { ...(S.bt || BT_DEF) }; S.btSel = u.id; go('backtest'); } }, 'Backtest'), ' ',
              h('button', { class: 'linkbtn', type: 'button', onclick: () => { CUSTOM = CUSTOM.filter(c => c.id !== u.id); saveCustom(); rebuildUniverse(); set({ bEdit: S.bEdit === u.id ? null : S.bEdit }); } }, 'Delete')));
        })))) : h('div', { class: 'empty' }, 'Build a structure above and save it: it will be listed here with its z-score and changes.'));
    return h('div', { class: 'grid' }, editor, prev, saved, workbench());
  }
  /** Any series together on one chart: levels, change since the start of the range, or rolling z-scores. */
  function workbench() {
    const all = seriesGroups(true, true);
    let ids = (S.wbIds || ['DE_10Y', 'FR_10Y']).filter(id => BYID.has(id)); if (!ids.length) ids = [U[0].id];
    const mode = S.wbMode || 'level', n = WINDOWS[S.win], pal = PALETTE();
    const raw = ids.map((id, i) => { const u = BYID.get(id); return { u, color: pal[i % pal.length] }; });
    const make = ({ u, color }) => {
      if (mode === 'z') { const { mean, sd } = fastRolling(u.values, n); const vals = u.values.map((v, i) => (v - mean[i]) / sd[i]); const ok = vals.map(Number.isFinite);
        return inRange({ name: u.name, short: '', color, dates: u.dates.filter((_, i) => ok[i]), values: vals.filter((_, i) => ok[i]) }); }
      const r = inRange({ name: u.name, short: '', color, dates: u.dates, values: u.values });
      if (mode === 'change') { const k = u.unit === 'pct' ? 100 : 1, v0 = r.values[0]; return { ...r, values: r.values.map(v => (v - v0) * k) }; }
      return r;
    };
    const groupsByUnit = mode === 'level' ? [['pct', '%', raw.filter(x => x.u.unit === 'pct')], ['bp', 'bp', raw.filter(x => x.u.unit !== 'pct')]].filter(g => g[2].length) : [[mode, mode === 'z' ? 'z-score' : 'bp', raw]];
    const charts = groupsByUnit.map(([key, unit, list]) => { const ser = list.map(make); const host = h('div');
      mount(host, el => lineChart(el, { series: ser, decimals: unit === '%' ? 3 : unit === 'z-score' ? 2 : 1, unit, height: groupsByUnit.length > 1 ? 220 : 320, guides: mode === 'z' ? [-2, 2] : null, zero: mode !== 'level', label: 'Workbench chart' }));
      return h('div', null, groupsByUnit.length > 1 ? h('div', { class: 'sub', style: 'color:var(--ink-3);padding:4px 0' }, unit === '%' ? 'Yields, %' : 'Structures, bp') : null, host); });
    const chips = h('div', { class: 'chips' }, ids.map((id, i) => h('span', { class: 'chip' }, h('i', { class: 'swatch', style: 'background:' + pal[i % pal.length] }), BYID.get(id).name,
      h('button', { type: 'button', class: 'x', title: 'Remove', 'aria-label': 'Remove ' + BYID.get(id).name, onclick: () => set({ wbIds: ids.filter(x => x !== id) }) }, '×'))),
      ids.length < 8 ? select([['', [['', 'Add a series…']]], ...all], '', v => v && set({ wbIds: ids.concat(v).filter((x, i, a) => a.indexOf(x) === i) }), 'Add a series') : null);
    return panel({ id: 'p-wb', span: 's12', title: 'Chart workbench', sub: 'up to 8 series, any mix, on the chart range above',
      tools: [seg([['level', 'Level'], ['change', 'Change since start'], ['z', 'Z-score ' + S.win]], mode, v => set({ wbMode: v }), 'Display'), csvButton('workbench', () => rawTable(groupsByUnit.flatMap(g => g[2].map(make))))],
      foot: mode === 'level' ? (groupsByUnit.length > 1 ? 'Yields and bp structures are drawn on two charts: one scale per unit, never two scales on one chart.' : 'Levels. Change since start puts every series in bp on one scale.') : mode === 'change' ? 'Change since the first day of the range, in bp for every series.' : `Rolling z-score on ${S.win}, guides at ${MINUS}2 and +2.` },
      chips, charts);
  }

  // ---------- 9.10 view: PCA, carry and roll-down, fitted curve
  const PCA_WIN = { '6M': 126, '1Y': 252, '2Y': 504, '5Y': 1260 };
  const HOR = { '1M': 1 / 12, '3M': 0.25, '6M': 0.5, '1Y': 1 };
  function viewCurveLab() {
    const cs = DC().filter(c => U.filter(u => u.cat === 'outright' && u.country === c).length >= 4);
    if (!cs.length) return h('div', { class: 'grid' }, panel({ id: 'p-cl', title: 'PCA & carry' }, h('div', { class: 'empty' }, 'Select a country with at least four daily maturities (Germany, France or Spain).')));
    if (!cs.includes(S.clC)) S.clC = cs[0];
    const c = S.clC, pw = S.clWin && PCA_WIN[S.clWin] ? S.clWin : '1Y', N = PCA_WIN[pw];
    const tenors = U.filter(u => u.cat === 'outright' && u.country === c).map(u => u.tenor).sort((a, b) => a - b);
    const P = pca(c, N, tenors), pal = [COL.ink, COL.DE, COL.FR, COL.IT];
    const ctl = [seg(cs.map(x => [x, COUNTRIES[x], COL[x]]), c, v => set({ clC: v }), 'Country'), seg(Object.keys(PCA_WIN).map(k => [k, k]), pw, v => set({ clWin: v }), 'PCA window')];
    // explained variance and loadings
    const curves = P.vectors.slice(0, 3).map((v, q) => ({ name: `PC${q + 1} (${num(P.share[q] * 100, 1)} %)`, color: pal[q + 1], points: P.tenors.map((t, i) => ({ t, v: v[i] })) }));
    const load = chartPanel({ id: 'p-pca-load', span: 's6', title: `${COUNTRIES[c]}: principal components`, sub: `daily changes, last ${P.T} days`, tools: ctl,
      draw: host => curveChart(host, { curves, decimals: 3, height: 250 }),
      table: () => ({ head: ['Maturity', 'PC1', 'PC2', 'PC3'], rows: P.tenors.map((t, i) => [t + 'Y', ...P.vectors.slice(0, 3).map(v => num(v[i], 3))]) }),
      foot: `Share of the variance of daily changes: ${P.share.slice(0, 3).map((s, q) => `PC${q + 1} ${num(s * 100, 1)} %`).join(', ')}, first three together ${num(d3.sum(P.share.slice(0, 3)) * 100, 1)} %. Loadings on unit vectors; PC1 level, PC2 slope, PC3 curvature by sign convention.` });
    const paths = P.scores.map((v, q) => ({ name: `PC${q + 1}`, short: `PC${q + 1}`, color: pal[q + 1], dates: P.dates, values: v }));
    const fac = chartPanel({ id: 'p-pca-path', span: 's6', title: 'Factor paths', sub: 'cumulative move of each factor over the window, bp of factor score', draw: host => lineChart(host, { series: paths, decimals: 1, unit: 'bp', zero: true, height: 250, label: 'Cumulative principal component scores' }), table: () => seriesTable(paths, 1) });
    // PCA rich / cheap
    const rc = P.tenors.map((t, i) => { const col = P.resid.map(r => r[i]), last = col[col.length - 1], m = d3.mean(col), s = d3.deviation(col); return { t, last, z: s > 0 ? (last - m) / s : NaN, pct: 100 * (col.filter(x => x < last).length + 0.5 * col.filter(x => x === last).length) / col.length }; });
    const rcp = panel({ id: 'p-pca-rc', span: 's6', title: 'Rich / cheap against three factors', sub: `level residual after the first three components, bp, ${pw} window`,
      tools: csvButton('pca_residuals_' + c, () => ({ head: ['tenor', 'residual_bp', 'z', 'percentile'], rows: rc.map(r => [r.t, +r.last.toFixed(3), +r.z.toFixed(3), +r.pct.toFixed(1)]) })) },
      h('div', { class: 'scroll' }, h('table', { class: 't' }, h('thead', null, h('tr', null, ['Maturity', 'Residual', 'Z', 'Pctile', 'Reading'].map(x => h('th', null, x)))),
        h('tbody', null, rc.map(r => h('tr', { class: Math.abs(r.z) >= 2 ? 'hot' : null }, h('td', null, r.t + 'Y'), heatCell(bp(r.last), r.last, 5), h('td', null, zChip(r.z)), h('td', null, num(r.pct, 0)),
          h('td', { class: 'muted' }, Math.abs(r.z) < 1 ? 'in line' : r.last > 0 ? 'cheap: yield above the factors' : 'rich: yield below the factors')))))),
      h('p', { class: 'muted', style: 'font-size:12px;margin:6px 0 0' }, 'Residual = yield level minus its projection on the first three components, both measured against their mean on the window.'));
    // PCA-neutral butterfly
    const tri = S.clFly && S.clFly.every(t => P.tenors.includes(t)) ? S.clFly : [P.tenors.includes(2) ? 2 : P.tenors[0], P.tenors.includes(5) ? 5 : P.tenors[1], P.tenors.includes(10) ? 10 : P.tenors[2]];
    const [ta, tb, tc] = tri, w = pcaFlyWeights(P, ta, tb, tc);
    const tsel = (i, lab) => select([['', P.tenors.map(t => [String(t), t + 'Y'])]], String(tri[i]), v => { const nt = tri.slice(); nt[i] = Number(v); set({ clFly: nt }); }, lab);
    let flyBody = h('div', { class: 'empty' }, 'Pick three different maturities, short wing, body, long wing.');
    if (w && ta < tb && tb < tc) {
      const legsP = [{ id: `${c}_${ta}Y`, w: -w.wa }, { id: `${c}_${tb}Y`, w: w.wb }, { id: `${c}_${tc}Y`, w: -w.wc }], legsC = [{ id: `${c}_${ta}Y`, w: -1 }, { id: `${c}_${tb}Y`, w: 2 }, { id: `${c}_${tc}Y`, w: -1 }];
      const fP = buildCustom({ id: 'pf', legs: legsP }), fC = buildCustom({ id: 'cf', legs: legsC }), sP = stats(fP, N), sC = stats(fC, N);
      const corr1 = (legs) => { const jc = jointChanges([buildCustom({ id: 't', legs }), inst(`${c}_10Y`) || P.legs[0]]); const f = ols(jc.cols[1].slice(-N), jc.cols[0].slice(-N)); return f ? f.corr : NaN; };
      flyBody = h('div', null, h('div', { class: 'scroll' }, h('table', { class: 't' }, h('thead', null, h('tr', null, ['Butterfly', `${ta}Y`, `${tb}Y`, `${tc}Y`, 'Level', 'Z ' + pw, 'Corr. with 10Y'].map(x => h('th', null, x)))),
        h('tbody', null, [['PCA-neutral', legsP, sP], ['Classic 50/50', legsC, sC]].map(([name, legs, st]) => h('tr', null, h('td', null, h('span', { class: 'name' }, name)), ...legs.map(l => h('td', null, num(l.w, 3, true))), h('td', { class: 'lvl' }, num(st.last, 1)), h('td', null, zChip(st.z)), h('td', null, num(corr1(legs), 2))))))),
        h('div', { class: 'row-actions' }, h('button', { class: 'btn', type: 'button', onclick: () => { S.bEdit = null; S.bDraft = { name: `${c} ${ta}s${tb}s${tc}s PCA fly`, legs: legsP.map(l => ({ ...l, w: +l.w.toFixed(4) })) }; go('builder'); } }, 'Open in Builder')),
        h('p', { class: 'muted', style: 'font-size:12px;margin:6px 0 0' }, `Wing weights that make the butterfly insensitive to the first two components on the ${pw} window, body weight 2. A correlation with the 10-year close to zero means the fly does not carry a level view.`));
    }
    const flyP = panel({ id: 'p-pca-fly', span: 's6', title: 'Factor-neutral butterfly', tools: [tsel(0, 'Short wing'), tsel(1, 'Body'), tsel(2, 'Long wing')] }, flyBody);
    // carry and roll-down
    const hk = S.clHor && HOR[S.clHor] ? S.clHor : '3M', H = HOR[hk], estr = EXTRA.get('ESTR'), fund = estr ? estr.values[estr.values.length - 1] : NaN;
    const cr = {}; for (const x of DC()) cr[x] = carryRoll(x, H, fund);
    const crRows = DC().flatMap(x => cr[x].map(r => r));
    const crTable = panel({ id: 'p-carry', span: 's7', title: 'Carry and roll-down', sub: `long position, ${hk} horizon, bp of yield`,
      tools: [seg(Object.keys(HOR).map(k => [k, k]), hk, v => set({ clHor: v }), 'Horizon'), csvButton('carry_roll_' + hk, () => ({ head: ['country', 'tenor', 'yield_pct', 'carry_bp', 'roll_bp', 'total_bp', 'vol_bp', 'ratio'], rows: crRows.map(r => [r.c, r.t, r.y, +r.carry.toFixed(3), Number.isFinite(r.roll) ? +r.roll.toFixed(3) : '', Number.isFinite(r.total) ? +r.total.toFixed(3) : '', +r.vol.toFixed(3), Number.isFinite(r.ratio) ? +r.ratio.toFixed(3) : '']) }))],
      foot: `Funding at the euro short-term rate, ${num(fund, 3)} % on ${estr ? day(estr.dates[estr.dates.length - 1]) : DASH}: a proxy, not a repo rate. Carry = (yield ${MINUS} funding) × horizon / modified duration. Roll-down = yield minus the yield of the maturity shortened by the horizon, read on today's curve, linear between maturities; not shown when that maturity is below the shortest one. Ratio = carry and roll over the ${hk} volatility of daily changes (last year).` },
      h('div', { class: 'scroll', style: 'max-height:420px;overflow-y:auto' }, h('table', { class: 't' }, h('thead', null, h('tr', null, ['Bond', 'Yield', 'Carry', 'Roll', 'Carry + roll', 'Vol ' + hk, 'Ratio'].map(x => h('th', null, x)))),
        h('tbody', null, crRows.map(r => h('tr', null, h('td', null, ctry(r.c), ' ', r.t + 'Y'), h('td', { class: 'lvl' }, num(r.y, 3)), h('td', null, bp(r.carry)), h('td', null, bp(r.roll)), heatCell(bp(r.total), r.total, 30), h('td', null, num(r.vol, 1)), h('td', null, num(r.ratio, 2, true))))))));
    const crCurves = DC().map(x => ({ name: COUNTRIES[x], color: COL[x], points: cr[x].filter(r => Number.isFinite(r.total)).map(r => ({ t: r.t, v: r.total })) }));
    const crChart = chartPanel({ id: 'p-carry-chart', span: 's5', title: 'Carry + roll by maturity', sub: `bp, ${hk}`, draw: host => curveChart(host, { curves: crCurves, decimals: 1, height: 300 }),
      table: () => ({ head: ['Maturity', ...DC().map(x => x)], rows: [...new Set(crRows.map(r => r.t))].sort((a, b) => a - b).map(t => [t + 'Y', ...DC().map(x => { const r = cr[x].find(q => q.t === t); return r ? num(r.total, 1) : DASH; })]) }) });
    // structures: curve trades and spreads to Germany, DV01-neutral
    const trades = [];
    for (const x of DC()) { const by = t => cr[x].find(r => r.t === t); for (const [a, b] of SLOPES) if (by(a) && by(b)) trades.push({ name: `${x} ${a}s${b}s flattener`, what: `long ${b}Y, short ${a}Y`, v: by(b).total - by(a).total }); }
    for (const x of DC()) if (x !== REF && cr[REF]) for (const r of cr[x]) { const g = cr[REF].find(q => q.t === r.t); if (g) trades.push({ name: `${x}${DASH}${REF} ${r.t}Y`, what: `long ${x}, short ${REF}`, v: r.total - g.total }); }
    const trP = panel({ id: 'p-carry-trades', span: 's12', title: 'Carry + roll of curve and spread trades', sub: `DV01-neutral, ${hk}, bp`, tools: csvButton('carry_trades_' + hk, () => ({ head: ['trade', 'position', 'carry_roll_bp'], rows: trades.map(t => [t.name, t.what, Number.isFinite(t.v) ? +t.v.toFixed(3) : '']) })) },
      h('div', { class: 'scroll', style: 'max-height:300px;overflow-y:auto' }, h('table', { class: 't' }, h('thead', null, h('tr', null, ['Trade', 'Position', 'Carry + roll'].map(x => h('th', null, x)))),
        h('tbody', null, trades.sort((a, b) => (b.v || -1e9) - (a.v || -1e9)).map(t => h('tr', null, h('td', null, h('span', { class: 'name' }, t.name)), h('td', { class: 'muted' }, t.what), heatCell(bp(t.v), t.v, 15)))))),
      h('p', { class: 'muted', style: 'font-size:12px;margin:6px 0 0' }, 'Each leg weighted to the same DV01, so the figure is the difference of the two carry + roll numbers. Positive: the position earns that many bp of yield over the horizon if the curve does not move.'));
    // fitted curve
    const ns = nsResiduals(c, N); let nsP;
    if (ns) {
      const rows = ns.ts.map((t, k) => { const col = ns.res.map(r => r[k]), last = col[col.length - 1], m = d3.mean(col), s = d3.deviation(col); return { t, y: ns.last[k], fit: ns.last[k] - last / 100, last, z: s > 0 ? (last - m) / s : NaN }; });
      const dense = d3.range(ns.ts[0], ns.ts[ns.ts.length - 1] + 0.001, 0.25).map(t => { const L = nsLoad(t, ns.lastFit.l); return { t, v: L[0] * ns.lastFit.beta[0] + L[1] * ns.lastFit.beta[1] + L[2] * ns.lastFit.beta[2] }; });
      const host = h('div');
      mount(host, el => fitChart(el, ns.ts.map((t, k) => ({ t, v: ns.last[k] })), dense, COL[c]));
      nsP = panel({ id: 'p-ns', span: 's12', title: `${COUNTRIES[c]}: rich / cheap against a fitted curve`, sub: `Nelson-Siegel curve fitted each day on the ${ns.ts.length} maturities, residual in bp, z on ${pw}`,
        tools: csvButton('nelson_siegel_' + c, () => ({ head: ['tenor', 'yield', 'fitted', 'residual_bp', 'z'], rows: rows.map(r => [r.t, r.y, +r.fit.toFixed(4), +r.last.toFixed(3), +r.z.toFixed(3)]) })) },
        h('div', { class: 'split' }, h('div', null, host),
          h('div', { class: 'scroll' }, h('table', { class: 't' }, h('thead', null, h('tr', null, ['Maturity', 'Yield', 'Fitted', 'Residual', 'Z'].map(x => h('th', null, x)))),
            h('tbody', null, rows.map(r => h('tr', { class: Math.abs(r.z) >= 2 ? 'hot' : null }, h('td', null, r.t + 'Y'), h('td', { class: 'lvl' }, num(r.y, 3)), h('td', null, num(r.fit, 3)), heatCell(bp(r.last), r.last, 5), h('td', null, zChip(r.z)))))))),
        h('p', { class: 'muted', style: 'font-size:12px;margin:6px 0 0' }, `Fit by least squares with the decay parameter chosen on a grid (today ${num(ns.lastFit.l, 2)} years). Positive residual: yield above the fitted curve, the maturity is cheap. The German series is itself a smoothed estimated curve, so its residuals are small by construction.`));
    } else nsP = panel({ id: 'p-ns', span: 's12', title: 'Fitted curve' }, h('div', { class: 'empty' }, 'At least four maturities are needed.'));
    return h('div', { class: 'grid' }, load, fac, rcp, flyP, crTable, crChart, trP, nsP);
  }
  /** Observed yields as dots and the fitted curve as a line, x = maturity in years. */
  function fitChart(host, pts, line, color) {
    host.replaceChildren(); host.classList.add('chart');
    host.append(h('div', { class: 'legend' }, h('span', null, h('i', { style: 'background:' + color }), 'Observed'), h('span', null, h('i', { style: 'background:' + COL.ink2 }), 'Fitted curve')));
    const W = Math.max(260, Math.floor(host.clientWidth || 500)), H = 260, m = { t: 10, r: 14, b: 32, l: 42 };
    const svg = d3.select(host).append('svg').attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', 'Observed yields and fitted curve');
    const x = d3.scaleLinear().domain([0, d3.max(pts, p => p.t)]).range([m.l, W - m.r]), ys = pts.map(p => p.v).concat(line.map(p => p.v));
    const y = d3.scaleLinear().domain(d3.extent(ys)).nice().range([H - m.b, m.t]);
    svg.append('g').selectAll('line').data(y.ticks(5)).join('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', d => Math.round(y(d)) + .5).attr('y2', d => Math.round(y(d)) + .5).attr('stroke', COL.rule);
    svg.append('g').selectAll('text').data(y.ticks(5)).join('text').attr('class', 'tick').attr('x', m.l - 6).attr('y', d => y(d)).attr('dy', '.32em').attr('text-anchor', 'end').text(d => y.tickFormat(5)(d));
    svg.append('g').selectAll('text').data(x.ticks(6)).join('text').attr('class', 'tick').attr('x', d => x(d)).attr('y', H - m.b + 15).attr('text-anchor', 'middle').text(d => d + 'Y');
    svg.append('path').attr('d', d3.line().x(p => x(p.t)).y(p => y(p.v))(line)).attr('fill', 'none').attr('stroke', COL.ink2).attr('stroke-width', 1.5);
    svg.append('g').selectAll('circle').data(pts).join('circle').attr('cx', p => x(p.t)).attr('cy', p => y(p.v)).attr('r', 4).attr('fill', color).attr('stroke', COL.surface).attr('stroke-width', 2);
    const tip = tooltip(host);
    svg.append('rect').attr('x', m.l).attr('y', m.t).attr('width', W - m.l - m.r).attr('height', H - m.t - m.b).attr('fill', 'transparent')
      .on('pointermove', ev => { const [px] = d3.pointer(ev, svg.node()); const p = pts.reduce((a, b) => (Math.abs(x(b.t) - px) < Math.abs(x(a.t) - px) ? b : a)); const f = line.reduce((a, b) => (Math.abs(b.t - p.t) < Math.abs(a.t - p.t) ? b : a));
        tip.show(x(p.t), [{ color, name: 'Observed', value: num(p.v, 3) + ' %' }, { color: COL.ink2, name: 'Fitted', value: num(f.v, 3) + ' %' }, { name: 'Residual', value: bp((p.v - f.v) * 100) + ' bp' }], p.t + '-year'); })
      .on('pointerleave', () => tip.hide());
  }

  // ---------- 9.11 view: backtest
  let SCAN = null;                                          // results of the last scan, kept in memory only
  function viewBacktest() {
    const p = Object.assign({}, BT_DEF, S.bt || {}); S.bt = p;
    if (!BYID.has(S.btSel) || EXTRA.has(S.btSel) && !U.includes(BYID.get(S.btSel))) S.btSel = (inst('FR-DE_10Y') || inst('DE_2s10s') || U[0]).id;
    const u = BYID.get(S.btSel), r = backtest(u, p), up = patch => set({ bt: Object.assign({}, p, patch) });
    const dmin = u.dates[0], dmax = u.dates[u.dates.length - 1];
    const ctl = panel({ id: 'p-bt-ctl', span: 's12', title: 'Z-score backtest', sub: 'rules, then results below; every change reruns the test',
      tools: [h('button', { class: 'linkbtn', type: 'button', onclick: () => set({ bt: { ...BT_DEF } }) }, 'Reset rules')] },
      h('div', { class: 'controls' },
        field('Structure', select(seriesGroups(true, false), S.btSel, v => set({ btSel: v }), 'Structure to test')),
        field('Signal', seg([['revert', 'Mean reversion'], ['trend', 'Trend']], p.mode, v => up({ mode: v }), 'Signal')),
        field('Side', seg([['both', 'Both'], ['long', 'Buy only'], ['short', 'Sell only']], p.side, v => up({ side: v }), 'Side')),
        field('Z window (days)', numInput(p.win, v => up({ win: Math.max(10, Math.round(v)) }), { label: 'Z-score window in trading days', min: 10, step: 1, w: '76px' })),
        field('Enter at |z|', numInput(p.entry, v => up({ entry: Math.max(0.1, v) }), { label: 'Entry level of |z|', step: 0.1, min: 0.1, w: '64px' })),
        field('Exit at |z|', numInput(p.exit, v => up({ exit: v }), { label: 'Exit level of |z|', step: 0.1, w: '64px' })),
        p.mode === 'revert' ? field('Stop at |z| (0 = none)', numInput(p.stop, v => up({ stop: Math.max(0, v) }), { label: 'Stop level of |z|, 0 for none', step: 0.1, min: 0, w: '64px' })) : null,
        field('Max days (0 = none)', numInput(p.maxHold, v => up({ maxHold: Math.max(0, Math.round(v)) }), { label: 'Maximum holding period in trading days', step: 1, min: 0, w: '64px' })),
        field('Cost, bp per trade', numInput(p.cost, v => up({ cost: Math.max(0, v) }), { label: 'Round-trip cost in bp', step: 0.1, min: 0, w: '64px' })),
        field('Execution', seg([[1, 'Next fixing'], [0, 'Same fixing']], p.lag, v => up({ lag: v }), 'Execution')),
        field('From', h('input', { class: 'inp', type: 'date', value: p.from || '', min: dmin, max: dmax, 'aria-label': 'Start date', onchange: e => up({ from: e.target.value }) })),
        field('To', h('input', { class: 'inp', type: 'date', value: p.to || '', min: dmin, max: dmax, 'aria-label': 'End date', onchange: e => up({ to: e.target.value }) }))));
    const st = panel({ id: 'p-bt-stats', span: 's4', title: 'Results', sub: `${day(r.start)} to ${day(r.end)}`, foot: sourceLine(u.src) },
      h('div', { class: 'stats stats2' }, stat('Total P&L', bp(r.total), 'bp'), stat('Per year', bp(r.perYear), 'bp'), stat('Trades', String(r.trades.length)), stat('Hit ratio', num(r.hit * 100, 0), '%'),
        stat('Average trade', bp(r.avg), 'bp'), stat('Average holding', num(r.avgDays, 0), 'days'), stat('Max drawdown', num(r.mdd, 1), 'bp'), stat('Sharpe (daily, annualised)', num(r.sharpe, 2)), stat('Time in market', num(r.inMarket * 100, 0), '%')),
      h('p', { class: 'muted', style: 'font-size:12px;margin:8px 0 0' }, `${u.name}: P&L in bp of the structure, long = gain when it rises. Carry, roll-down and financing are not included. ${p.lag ? 'Decision at a fixing, trade at the next fixing.' : 'Decision and trade at the same fixing: optimistic.'} In-sample test: the rules were not chosen out of sample.`));
    const eq = { name: 'Cumulative P&L', color: COL[u.country] || COL.DE, dates: r.equity.dates, values: r.equity.values };
    const eqP = chartPanel({ id: 'p-bt-eq', span: 's8', title: 'Cumulative P&L', sub: 'bp, marked to market each day, cost charged at exit', draw: host => lineChart(host, { series: [eq], decimals: 1, unit: 'bp', zero: true, height: 260, label: 'Cumulative P&L of the backtest' }), table: () => seriesTable([eq], 1) });
    // signal chart: z-score with the thresholds, and the position
    const i0 = r.level.dates.indexOf(r.start), i1 = r.level.dates.indexOf(r.end) + 1;
    const zs = { name: 'Z-score', color: COL.ink2, dates: r.z.dates.slice(i0, i1), values: r.z.values.slice(i0, i1) };
    const posMap = new Map(); for (const tr of r.trades) for (let i = tr.entryIdx + 1; i <= tr.exitIdx; i++) posMap.set(r.level.dates[i], tr.dir);
    const lvl = { name: u.name, color: COL[u.country] || COL.DE, dates: r.level.dates.slice(i0, i1), values: r.level.values.slice(i0, i1) };
    const ps = { name: 'Position', color: COL[u.country] || COL.DE, dates: lvl.dates, values: lvl.dates.map(d => posMap.get(d) || 0) };
    const h1 = h('div'), h2 = h('div'), h3 = h('div');
    mount(h1, el => lineChart(el, { series: [lvl], decimals: 1, unit: 'bp', height: 170, label: 'Level of the structure' }));
    mount(h2, el => lineChart(el, { series: [zs], decimals: 2, height: 130, guides: p.mode === 'revert' && p.stop > 0 ? [-p.entry, p.entry, -p.stop, p.stop] : [-p.entry, p.entry], zero: true, label: 'Rolling z-score with entry levels' }));
    mount(h3, el => lineChart(el, { series: [ps], decimals: 0, height: 80, zero: true, endLabels: false, label: 'Position: +1 long, -1 short' }));
    const sig = panel({ id: 'p-bt-sig', span: 's8', title: 'Signal and position', sub: `${u.name}, z on ${p.win} days` },
      h('div', { class: 'sub', style: 'color:var(--ink-3)' }, 'Level, bp'), h1, h('div', { class: 'sub', style: 'color:var(--ink-3);padding-top:6px' }, `Z-score, guides at ±${p.entry}${p.mode === 'revert' && p.stop > 0 ? ' and ±' + p.stop : ''}`), h2,
      h('div', { class: 'sub', style: 'color:var(--ink-3);padding-top:6px' }, 'Position: +1 long, ' + MINUS + '1 short'), h3);
    const tradeRows = r.trades.slice().reverse();
    const trP = panel({ id: 'p-bt-trades', span: 's4', title: 'Trades', sub: `${r.trades.length}, newest first`,
      tools: csvButton('backtest_trades', () => ({ head: ['signal_date', 'entry_date', 'side', 'entry_level_bp', 'z_in', 'exit_date', 'exit_level_bp', 'z_out', 'reason', 'days', 'pnl_bp'], rows: r.trades.map(t => [t.signalDate, t.entryDate, t.dir > 0 ? 'buy' : 'sell', +t.entryLevel.toFixed(3), +t.zIn.toFixed(3), t.exitDate, +t.exitLevel.toFixed(3), Number.isFinite(t.zOut) ? +t.zOut.toFixed(3) : '', t.why, t.days, +t.pnl.toFixed(3)]) })) },
      tradeRows.length ? h('div', { class: 'scroll', style: 'max-height:430px;overflow-y:auto' }, h('table', { class: 't' }, h('thead', null, h('tr', null, ['In', 'Side', 'Out', 'Why', 'Days', 'P&L'].map(x => h('th', null, x)))),
        h('tbody', null, tradeRows.map(t => h('tr', null, h('td', null, fShort(parseD(t.entryDate)) + ' ' + t.entryDate.slice(2, 4)), h('td', null, t.dir > 0 ? 'Buy' : 'Sell'), h('td', null, fShort(parseD(t.exitDate)) + ' ' + t.exitDate.slice(2, 4)),
          h('td', { class: 'muted' }, t.why), h('td', null, String(t.days)), heatCell(bp(t.pnl), t.pnl, 20)))))) : h('div', { class: 'empty' }, 'No trade with these rules: lower the entry level or lengthen the period.'));
    // sensitivity to the two main rules
    const wins = [21, 63, 126, 252, 504], ents = [1, 1.5, 2, 2.5, 3];
    const grid = wins.map(wn => ents.map(en => backtest(u, { ...p, win: wn, entry: en, exit: Math.min(p.exit, en - 0.1) })));
    const mx = d3.max(grid.flat(), g => Math.abs(g.total)) || 1;
    const sens = panel({ id: 'p-bt-sens', span: 's6', title: 'Sensitivity to the rules', sub: 'total P&L in bp (trades), other rules unchanged',
      tools: csvButton('backtest_sensitivity', () => ({ head: ['window', ...ents.map(e => 'entry_' + e)], rows: wins.map((wn, i) => [wn, ...grid[i].map(g => +g.total.toFixed(2))]) })) },
      h('div', { class: 'scroll' }, h('table', { class: 't' }, h('thead', null, h('tr', null, h('th', null, 'Window \\ entry |z|'), ents.map(e => h('th', null, String(e))))),
        h('tbody', null, wins.map((wn, i) => h('tr', null, h('td', null, h('span', { class: 'name' }, wn + ' days')), grid[i].map((g, j) => h('td', { class: 'hm click', title: `${g.trades.length} trades, hit ${num(g.hit * 100, 0)} %`, style: 'background:' + heat(g.total, mx) + (wn === p.win && ents[j] === p.entry ? ';outline:1px solid var(--ink)' : ''), onclick: () => up({ win: wn, entry: ents[j] }) },
          num(g.total, 0, true), h('small', { class: 'muted' }, ` (${g.trades.length})`)))))))),
      h('p', { class: 'muted', style: 'font-size:12px;margin:6px 0 0' }, 'Click a cell to use those rules. A good result in one cell only is more likely luck than a rule.'));
    // scan every structure
    const scanP = panel({ id: 'p-bt-scan', span: 's6', title: 'Same rules on every structure', sub: SCAN ? `${SCAN.rows.length} structures, ${SCAN.when}` : 'click Run to test all structures of the selected countries',
      tools: [h('button', { class: 'btn', type: 'button', onclick: () => { const rows = U.filter(x => (x.cat === 'custom' || shown(x.country))).map(x => ({ u: x, r: backtest(x, p) })).filter(x => x.r.trades.length); rows.sort((a, b) => b.r.total - a.r.total); SCAN = { rows, when: 'rules of ' + new Date().toLocaleTimeString() }; render(); } }, 'Run'),
        SCAN ? csvButton('backtest_scan', () => ({ head: ['structure', 'total_bp', 'per_year_bp', 'trades', 'hit_ratio', 'avg_trade_bp', 'max_drawdown_bp', 'sharpe'], rows: SCAN.rows.map(({ u: x, r: q }) => [x.name, +q.total.toFixed(2), +(q.perYear || 0).toFixed(2), q.trades.length, +(q.hit || 0).toFixed(3), +(q.avg || 0).toFixed(2), +q.mdd.toFixed(2), +(q.sharpe || 0).toFixed(2)]) })) : null] },
      SCAN ? h('div', { class: 'scroll', style: 'max-height:360px;overflow-y:auto' }, h('table', { class: 't' }, h('thead', null, h('tr', null, ['Structure', 'Total', 'Per year', 'Trades', 'Hit', 'Max DD', 'Sharpe'].map(x => h('th', null, x)))),
        h('tbody', null, SCAN.rows.map(({ u: x, r: q }) => h('tr', { class: 'click', 'aria-selected': String(x.id === S.btSel), onclick: () => set({ btSel: x.id }) }, h('td', null, h('span', { class: 'name' }, x.name)), heatCell(bp(q.total), q.total, 200), h('td', null, bp(q.perYear)), h('td', null, String(q.trades.length)), h('td', null, num(q.hit * 100, 0) + ' %'), h('td', null, num(q.mdd, 0)), h('td', null, num(q.sharpe, 2))))))) : h('div', { class: 'empty' }, 'The scan runs the current rules on every structure: about one second.'));
    return h('div', { class: 'grid' }, ctl, st, eqP, sig, trP, sens, scanP);
  }
