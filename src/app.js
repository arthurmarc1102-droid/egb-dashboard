/* EGB Dashboard: client-side engine.
   The page reads static JSON files from ./data and computes every derived number in the browser.
   No server and no build step: the same files work on any static host.

   Sections: 1 constants and state, 2 helpers, 3 series maths, 4 universe of structures,
             5 small graphics, 6 charts, 7 views, 8 shell (tabs, filters, routing). */
(function () {
  'use strict';

  // ===================================================================== 1. constants and state
  const COUNTRIES = { DE: 'Germany', FR: 'France', IT: 'Italy', ES: 'Spain', NL: 'Netherlands', BE: 'Belgium', AT: 'Austria', PT: 'Portugal' };
  const ORDER = ['DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'PT'];
  const REF = 'DE';                                   // spreads and boxes are quoted against Germany
  const SLOPES = [[2, 10], [5, 30], [2, 5], [5, 10], [10, 30], [2, 30]];
  const FLIES = [[2, 5, 10], [5, 10, 30], [2, 10, 30], [5, 7, 10], [10, 15, 30], [10, 20, 30]];
  const HEADLINE = [2, 5, 10, 30];                    // maturities shown when several countries share the matrix
  const WINDOWS = { '1M': 21, '3M': 63, '6M': 126, '1Y': 252, '2Y': 504 };          // z-score windows, in observations
  const RANGES = { '3M': 63, '6M': 126, '1Y': 252, '2Y': 504, '5Y': 1260, 'Max': Infinity, 'Custom': 'custom' }; // chart look-back
  const HORIZONS = { '1D': 1, '1W': 5, '1M': 21, 'YTD': 'ytd' };
  const HEAT_BP = { '1D': 10, '1W': 20, '1M': 40, 'YTD': 80 };           // change (bp) at which the tint saturates
  const HEAT_RET = { '1D': 0.5, '1W': 1, '1M': 2, 'YTD': 4 };            // same, for approximate returns (%)
  const CATS = { all: 'All', outright: 'Outright', spread: 'Spread', slope: 'Slope', fly: 'Fly', box: 'Box', custom: 'Custom' };
  // Sections: id -> [label, what the screen is for, filters it uses]
  const TAB = {
    home: ['Brief', 'The latest fixings in one screen: what moved, what looks stretched, what comes next.', ['countries', 'win']],
    monitor: ['Monitor', 'Yields, changes and spreads to Germany at the latest fixing.', ['countries', 'win', 'range']],
    curves: ['Curves', 'Curve snapshots and the history of yields, slopes and spreads.', ['countries', 'range']],
    rates: ['Rates', 'The euro short-term rate and the ECB policy rates.', ['range']],
    rv: ['RV screen', 'Every spread, slope, butterfly and box, ranked by z-score.', ['countries', 'win', 'range']],
    builder: ['Builder', 'Build any weighted structure, save it, and chart anything against anything.', ['win', 'range']],
    analysis: ['Analysis', 'Regressions, betas and correlations between any two series.', ['countries', 'win', 'range']],
    curvelab: ['PCA & carry', 'Principal components, carry and roll-down, rich and cheap against a fitted curve.', ['countries']],
    backtest: ['Backtest', 'Test a z-score rule on any structure, with costs and no look-ahead.', ['countries']],
    futures: ['Futures', 'Eurex bond futures: settlement, deliverable baskets, basis and cheapest to deliver.', []],
    auctions: ['Auctions', 'Government bond auctions: calendar and results.', ['countries']],
    blotter: ['News & calendar', 'Official headlines and the events that can move rates.', ['countries']],
    sources: ['Sources & methods', 'Where every number comes from, how it is computed, and what it cannot tell.', []],
  };
  // Spaces: [id, label, short label for the phone bar, sections]
  const SPACES = [['home', 'Brief', 'Brief', ['home']], ['markets', 'Markets', 'Markets', ['monitor', 'curves', 'rates']],
    ['relval', 'Relative value', 'RV', ['rv', 'builder', 'analysis', 'curvelab', 'backtest']],
    ['supply', 'Futures & supply', 'Futures', ['futures', 'auctions']], ['news', 'News & sources', 'News', ['blotter', 'sources']]];

  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const COL = {};                                     // resolved colours, filled at start-up
  const DATA = { market: null, auctions: null, news: null, events: null, sources: null, futures: null };
  let U = [];                                         // universe of structures built from the yield series
  let BYID = new Map();

  const S = Object.assign({
    tab: 'home', last: {}, countries: null, win: '3M', range: '1Y', horizon: '1D', metric: 'bp', tenor: 10,
    shape: 'level', compare: 'none', slope: '2s10s', rvCat: 'all', rvSort: 'absz', rvDir: -1, rvSel: null,
    pairA: null, pairB: null, regY: null, regX: null, corrSet: null, aucCountry: 'all', futSel: null, tables: {},
    from: '', to: '', bDraft: null, bEdit: null, wbIds: null, wbMode: 'level', bt: null, btSel: null, clC: null, clWin: '1Y', clHor: '3M', clFly: null
  }, restore());

  function restore() { try { return JSON.parse(localStorage.getItem('egb-state') || '{}'); } catch (e) { return {}; } }
  function persist() { try { localStorage.setItem('egb-state', JSON.stringify(S)); } catch (e) { /* storage is optional */ } }

  // ===================================================================== 2. helpers
  const MINUS = '−', DASH = '–';
  function num(x, d, sign) {
    if (!Number.isFinite(x)) return DASH;
    const s = Math.abs(x).toFixed(d), zero = Number(s) === 0;
    return (x < 0 && !zero ? MINUS : (sign && !zero ? '+' : '')) + s;
  }
  const bp = x => num(x, 1, true);
  const parseD = iso => new Date(iso + 'T00:00:00Z');
  const fDay = d3.utcFormat('%d %b %Y'), fShort = d3.utcFormat('%d %b'), fDow = d3.utcFormat('%a %d %b %Y'), fMon = d3.utcFormat('%b %Y');
  const day = iso => fDay(parseD(iso));

  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style') el.style.cssText = v;
      else if (k === 'svg') el.innerHTML = v;                       // only for SVG strings built in this file
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat(3)) { if (kid == null || kid === false) continue; el.append(kid.nodeType ? kid : document.createTextNode(String(kid))); }
    return el;
  }
  function seg(options, current, onPick, label) {
    return h('div', { class: 'seg', role: 'group', 'aria-label': label || null },
      options.map(([val, text, swatch]) => h('button', { type: 'button', 'aria-pressed': String(val === current), onclick: () => onPick(val) },
        swatch ? h('i', { class: 'swatch', style: 'background:' + swatch }) : null, text)));
  }
  function select(groups, current, onPick, label) {
    const el = h('select', { class: 'sel', 'aria-label': label, onchange: e => onPick(e.target.value) });
    for (const [gname, opts] of groups) {
      const target = gname ? h('optgroup', { label: gname }) : el;
      for (const [val, text] of opts) target.append(h('option', { value: val, selected: val === current }, text));
      if (gname) el.append(target);
    }
    return el;
  }
  function set(patch) { Object.assign(S, patch); persist(); render(); }

  // ===================================================================== 3. series maths
  // A series is { dates: [ISO strings, ascending], values: [numbers] }.

  /** Inner join on dates: keep the days where every input has a value, then apply fn to the row. */
  function join(list, fn) {
    const maps = list.slice(1).map(s => { const m = new Map(); s.dates.forEach((d, i) => m.set(d, s.values[i])); return m; });
    const dates = [], values = [];
    list[0].dates.forEach((d, i) => {
      const row = [list[0].values[i]];
      for (const m of maps) row.push(m.get(d));
      if (row.every(Number.isFinite)) { dates.push(d); values.push(fn(...row)); }
    });
    return { dates, values };
  }

  /** Rolling mean and sample standard deviation over the last n observations, current one included. */
  function rolling(values, n) {
    const mean = new Array(values.length).fill(NaN), sd = new Array(values.length).fill(NaN);
    for (let i = n - 1; i < values.length; i++) {
      let s = 0; for (let j = i - n + 1; j <= i; j++) s += values[j];
      const m = s / n; let q = 0; for (let j = i - n + 1; j <= i; j++) q += (values[j] - m) * (values[j] - m);
      mean[i] = m; sd[i] = Math.sqrt(q / (n - 1));
    }
    return { mean, sd };
  }

  /** Index of the observation h steps back, or of the last observation of the previous year for 'ytd'. */
  function backIndex(s, hz) {
    const L = s.values.length;
    if (hz === 'ytd') { const yr = s.dates[L - 1].slice(0, 4); for (let i = L - 1; i >= 0; i--) if (s.dates[i].slice(0, 4) < yr) return i; return -1; }
    return L - 1 - hz;
  }

  /** Change over a horizon, always in basis points (yields are stored in %, spreads already in bp). */
  function change(s, hz) {
    const i = backIndex(s, hz); if (i < 0) return NaN;
    return (s.values[s.values.length - 1] - s.values[i]) * (s.unit === 'pct' ? 100 : 1);
  }

  /** Approximate total return (%) of a par bond of that maturity over the horizon:
      minus modified duration times the yield change, plus the running yield earned over the period.
      Duration is that of an annual-pay par bond at the starting yield. Roll-down and convexity are ignored. */
  function approxReturn(s, hz) {
    const i = backIndex(s, hz); if (i < 0 || !s.tenor) return NaN;
    const L = s.values.length, y0 = s.values[i], y1 = s.values[L - 1], y = y0 / 100;
    const dur = Math.abs(y) < 1e-9 ? s.tenor : (1 - Math.pow(1 + y, -s.tenor)) / y;
    const days = (parseD(s.dates[L - 1]) - parseD(s.dates[i])) / 864e5;
    return -dur * (y1 - y0) + y0 * days / 365;
  }

  /** Level statistics over the last n observations: z-score, percentile, range. */
  function stats(s, n) {
    const L = s.values.length; if (!L) return null;
    const last = s.values[L - 1], w = s.values.slice(Math.max(0, L - n));
    const out = { last, n: w.length, full: w.length >= n, date: s.dates[L - 1] };
    if (w.length >= Math.max(20, 0.9 * n)) {
      const mean = d3.mean(w), sd = d3.deviation(w);
      Object.assign(out, { mean, sd, min: d3.min(w), max: d3.max(w), z: sd > 0 ? (last - mean) / sd : NaN,
        pct: 100 * (w.filter(v => v < last).length + 0.5 * w.filter(v => v === last).length) / w.length });
    } else Object.assign(out, { mean: NaN, sd: NaN, min: NaN, max: NaN, z: NaN, pct: NaN });
    return out;
  }

  /** Day-to-day changes in bp of several structures, on the days they all share. Returns { dates, cols }. */
  function jointChanges(list) {
    const j = join(list, (...row) => row);
    const k = list.map(s => (s.unit === 'pct' ? 100 : 1)), dates = [], cols = list.map(() => []);
    for (let i = 1; i < j.values.length; i++) { dates.push(j.dates[i]); list.forEach((_, c) => cols[c].push((j.values[i][c] - j.values[i - 1][c]) * k[c])); }
    return { dates, cols, levels: j };
  }

  /** Ordinary least squares y = alpha + beta x. */
  function ols(x, y) {
    const n = x.length; if (n < 3) return null;
    const mx = d3.mean(x), my = d3.mean(y); let sxx = 0, sxy = 0, syy = 0;
    for (let i = 0; i < n; i++) { const dx = x[i] - mx, dy = y[i] - my; sxx += dx * dx; sxy += dx * dy; syy += dy * dy; }
    if (!(sxx > 0) || !(syy > 0)) return null;
    const beta = sxy / sxx;
    return { beta, alpha: my - beta * mx, r2: (sxy * sxy) / (sxx * syy), corr: sxy / Math.sqrt(sxx * syy), n };
  }

  const tail = (s, n) => (n === 'custom' ? inRange(s) : Number.isFinite(n) ? { ...s, dates: s.dates.slice(-n), values: s.values.slice(-n) } : s);

  // ===================================================================== 4. universe of structures
  /** Build every outright, spread, slope, butterfly and box the loaded yield series allow. */
  function buildUniverse(market) {
    const Y = {};
    for (const s of market.series) if (s.group === 'yield') (Y[s.country] = Y[s.country] || {})[s.tenor] = s;
    const out = [], tenors = c => Object.keys(Y[c] || {}).map(Number).sort((a, b) => a - b);
    const add = o => { if (o.values.length > 1) out.push(o); };
    const src = (...ss) => [...new Set(ss.map(s => s.source))];
    for (const c of ORDER) for (const t of tenors(c)) {
      const s = Y[c][t];
      add({ id: `${c}_${t}Y`, cat: 'outright', country: c, tenor: t, name: `${c} ${t}Y`, long: `${COUNTRIES[c]} ${t}-year yield`, unit: 'pct', decimals: s.decimals, dates: s.dates, values: s.values, src: src(s) });
    }
    for (const c of ORDER) if (c !== REF && Y[REF]) for (const t of tenors(c)) if (Y[REF][t]) {
      add({ id: `${c}-${REF}_${t}Y`, cat: 'spread', country: c, tenor: t, name: `${c}${DASH}${REF} ${t}Y`, long: `${COUNTRIES[c]} minus ${COUNTRIES[REF]}, ${t}-year`, unit: 'bp',
        ...join([Y[c][t], Y[REF][t]], (a, b) => (a - b) * 100), src: src(Y[c][t], Y[REF][t]) });
    }
    for (const c of ORDER) for (const [a, b] of SLOPES) if (Y[c] && Y[c][a] && Y[c][b]) {
      add({ id: `${c}_${a}s${b}s`, cat: 'slope', country: c, legs: `${a}s${b}s`, name: `${c} ${a}s${b}s`, long: `${COUNTRIES[c]} ${b}-year minus ${a}-year`, unit: 'bp',
        ...join([Y[c][a], Y[c][b]], (x, y) => (y - x) * 100), src: src(Y[c][a], Y[c][b]) });
    }
    for (const c of ORDER) for (const [a, b, d] of FLIES) if (Y[c] && Y[c][a] && Y[c][b] && Y[c][d]) {
      add({ id: `${c}_${a}s${b}s${d}s`, cat: 'fly', country: c, legs: `${a}s${b}s${d}s`, name: `${c} ${a}s${b}s${d}s`, long: `${COUNTRIES[c]} butterfly: 2 x ${b}-year minus ${a}-year minus ${d}-year`, unit: 'bp',
        ...join([Y[c][a], Y[c][b], Y[c][d]], (x, y, z) => (2 * y - x - z) * 100), src: src(Y[c][a], Y[c][b], Y[c][d]) });
    }
    for (const c of ORDER) if (c !== REF) for (const [a, b] of SLOPES) if (Y[c] && Y[REF] && Y[c][a] && Y[c][b] && Y[REF][a] && Y[REF][b]) {
      add({ id: `${c}-${REF}_${a}s${b}s`, cat: 'box', country: c, legs: `${a}s${b}s`, name: `${c}${DASH}${REF} ${a}s${b}s box`, long: `${COUNTRIES[c]} ${a}s${b}s slope minus ${COUNTRIES[REF]} ${a}s${b}s slope`, unit: 'bp',
        ...join([Y[c][a], Y[c][b], Y[REF][a], Y[REF][b]], (ca, cb, ra, rb) => ((cb - ca) - (rb - ra)) * 100), src: src(Y[c][a], Y[c][b], Y[REF][a], Y[REF][b]) });
    }
    return out;
  }
  const inst = id => BYID.get(id);
  const shown = c => S.countries.includes(c);
  const hasDaily = c => U.some(u => u.country === c && u.cat === 'outright');
  const monthly = () => DATA.market.series.filter(x => x.group === 'yield_m');
  const availCountries = () => ORDER.filter(c => hasDaily(c) || monthly().some(x => x.country === c));
  const DC = () => S.countries.filter(hasDaily);       // selected countries that have daily yields
  const dailyNames = () => { const n = ORDER.filter(hasDaily).map(c => COUNTRIES[c]); return n.length > 1 ? n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1] : n.join(''); };
  const visible = () => U.filter(u => u.cat === 'custom' || shown(u.country));
  const tenorsAvail = () => [...new Set(U.filter(u => u.cat === 'outright').map(u => u.tenor))].sort((a, b) => a - b);
  const level = u => num(u.values[u.values.length - 1], u.unit === 'pct' ? (u.decimals || 3) : 1);
  const unitLabel = u => (u.unit === 'pct' ? '%' : 'bp');
  function sourceLine(ids) {
    const names = [...new Set(ids)].map(id => { const s = (DATA.sources && DATA.sources.sources || []).find(x => x.id === id); return s ? s.short || s.name : id; });
    return names.length ? 'Source: ' + names.join(', ') + '. Details under Sources.' : '';
  }

  // ===================================================================== 5. small graphics
  /** Diverging tint: warm above zero, cool below, nothing at zero. */
  function heat(v, clamp) {
    if (!Number.isFinite(v) || !v) return 'transparent';
    const c = d3.color(v > 0 ? COL.up : COL.down); c.opacity = 0.6 * Math.min(1, Math.abs(v) / clamp);
    return c.opacity < 0.03 ? 'transparent' : c.formatRgb();
  }
  const zDot = z => (!Number.isFinite(z) || Math.abs(z) < 1 ? COL.ink2 : z > 0 ? COL.up : COL.down);

  /** Where the latest value sits in its window: min to max track, mean tick, band of one standard deviation, dot for today. */
  function rangeBar(st, w) {
    w = w || 108;
    if (!st || !Number.isFinite(st.min) || st.max === st.min) return '';
    const x = v => 6 + (w - 12) * (v - st.min) / (st.max - st.min);
    const lo = Math.max(st.min, st.mean - st.sd), hi = Math.min(st.max, st.mean + st.sd);
    return `<svg width="${w}" height="16" viewBox="0 0 ${w} 16" role="img" aria-label="Range position"><line x1="6" x2="${w - 6}" y1="8" y2="8" stroke="${COL.axis}"/>` +
      `<rect x="${x(lo).toFixed(1)}" y="5" width="${Math.max(1, x(hi) - x(lo)).toFixed(1)}" height="6" fill="${COL.flat}"/>` +
      `<line x1="${x(st.mean).toFixed(1)}" x2="${x(st.mean).toFixed(1)}" y1="3" y2="13" stroke="${COL.ink3}"/>` +
      `<circle cx="${x(st.last).toFixed(1)}" cy="8" r="4" fill="${zDot(st.z)}" stroke="${COL.surface}" stroke-width="2"/></svg>`;
  }
  function spark(values, w, hgt) {
    w = w || 84; hgt = hgt || 20;
    if (values.length < 2) return '';
    const x = d3.scaleLinear().domain([0, values.length - 1]).range([2, w - 5]), ext = d3.extent(values);
    const y = d3.scaleLinear().domain(ext[0] === ext[1] ? [ext[0] - 1, ext[1] + 1] : ext).range([hgt - 3, 3]);
    const path = d3.line().x((d, i) => x(i)).y(d => y(d))(values), L = values.length - 1;
    return `<svg width="${w}" height="${hgt}" viewBox="0 0 ${w} ${hgt}" aria-hidden="true"><path d="${path}" fill="none" stroke="${COL.ink3}" stroke-width="1.25" stroke-linejoin="round"/>` +
      `<circle cx="${x(L).toFixed(1)}" cy="${y(values[L]).toFixed(1)}" r="2.5" fill="${COL.ink}"/></svg>`;
  }
  function zChip(z) {
    return h('span', { class: 'zchip', style: 'background:' + heat(z, 3), title: 'Z-score of the level over the selected window' }, num(z, 2, true));
  }
  function heatCell(text, v, clamp, title) { return h('td', { class: 'heat', style: 'background:' + heat(v, clamp), title: title || null }, h('span', null, text)); }
  function ctry(c, withName) { return h('span', { class: 'ctry' }, h('i', { class: 'swatch', style: 'background:' + COL[c] }), h('span', { class: 'name' }, c), withName ? h('span', { class: 'muted' }, COUNTRIES[c]) : null); }

  // ===================================================================== 6. charts
  const redraws = [];                                  // functions to call again when the width changes
  function mount(host, draw) { redraws.push(() => draw(host)); requestAnimationFrame(() => draw(host)); return host; }

  function tooltip(host) {
    const tip = h('div', { class: 'tip', hidden: true }); host.append(tip);
    return {
      show(px, rows, title) {
        tip.replaceChildren(h('div', { class: 'd' }, title), rows.map(r => h('div', { class: 'r' }, r.color ? h('i', { style: 'background:' + r.color }) : null, h('span', { class: 'n' }, r.name), h('b', null, r.value))));
        tip.hidden = false;
        const W = host.clientWidth, tw = tip.offsetWidth;
        tip.style.left = Math.max(0, Math.min(W - tw, px + 14 + tw > W ? px - tw - 14 : px + 14)) + 'px';
        tip.style.top = (host.querySelector('svg').offsetTop + 6) + 'px';
      },
      hide() { tip.hidden = true; }
    };
  }
  /** Height for a drawing: its minimum, or the room left in a panel stretched by its row neighbours. */
  function fillHeight(host, min) {
    if (!host.classList.contains('fill')) return min;
    const used = [...host.children].reduce((a, c) => a + c.offsetHeight, 0);
    return Math.max(min, Math.min(460, host.clientHeight - used));
  }
  function xTickFormat(domain) {
    const span = (domain[1] - domain[0]) / 864e5;
    if (span < 150) return d3.utcFormat('%d %b');
    if (span < 900) return d => (d.getUTCMonth() === 0 ? d3.utcFormat('%b %Y')(d) : d3.utcFormat('%b')(d));
    return d3.utcFormat('%b %y');
  }
  const signFix = s => s.replace('-', MINUS);

  /** Multi-series time chart with a crosshair that reads every series at the nearest date.
      o = { series:[{name,short,color,dates,values}], decimals, unit, height, bands:{mean,sd}, zero, guides:[y...], endLabels } */
  function lineChart(host, o) {
    host.replaceChildren(); host.classList.add('chart');
    const series = o.series.filter(s => s.values.length > 1);
    if (!series.length) { host.append(h('div', { class: 'empty' }, 'Not enough history to draw this chart.')); return; }
    if (series.length > 1) host.append(h('div', { class: 'legend' }, series.map(s => h('span', null, h('i', { style: 'background:' + s.color }), s.name))));
    const W = Math.max(260, Math.floor(host.clientWidth || 600)), H = fillHeight(host, o.height || 240), dec = o.decimals == null ? 2 : o.decimals;
    const m = { t: 10, r: o.endLabels === false ? 12 : 62, b: 22, l: 42 };
    const svg = d3.select(host).append('svg').attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', o.label || 'Time series chart');
    const T = series.map(s => s.dates.map(parseD));
    const x = d3.scaleUtc().domain([d3.min(T, t => t[0]), d3.max(T, t => t[t.length - 1])]).range([m.l, W - m.r]);
    let lo = d3.min(series, s => d3.min(s.values)), hi = d3.max(series, s => d3.max(s.values));
    const B = o.bands;
    if (B) { B.mean.forEach((mu, i) => { if (Number.isFinite(mu) && Number.isFinite(B.sd[i])) { lo = Math.min(lo, mu - 2 * B.sd[i]); hi = Math.max(hi, mu + 2 * B.sd[i]); } }); }
    for (const gv of o.guides || []) { lo = Math.min(lo, gv); hi = Math.max(hi, gv); }
    if (o.zero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
    if (lo === hi) { lo -= 1; hi += 1; }
    const pad = (hi - lo) * 0.07, y = d3.scaleLinear().domain([lo - pad, hi + pad]).range([H - m.b, m.t]);
    const yt = y.ticks(5), yf = y.tickFormat(5);
    const grid = svg.append('g');
    grid.selectAll('line').data(yt).join('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', d => Math.round(y(d)) + .5).attr('y2', d => Math.round(y(d)) + .5).attr('stroke', COL.rule);
    grid.selectAll('text').data(yt).join('text').attr('class', 'tick').attr('x', m.l - 6).attr('y', d => y(d)).attr('dy', '.32em').attr('text-anchor', 'end').text(d => signFix(yf(d)));
    const xt = x.ticks(Math.max(2, Math.floor((W - m.l - m.r) / 78))), xf = xTickFormat(x.domain());
    svg.append('g').selectAll('text').data(xt).join('text').attr('class', 'tick').attr('x', d => x(d)).attr('y', H - 6).attr('text-anchor', 'middle').text(d => xf(d));
    svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', H - m.b + .5).attr('y2', H - m.b + .5).attr('stroke', COL.axis);
    if (lo < 0 && hi > 0) svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', Math.round(y(0)) + .5).attr('y2', Math.round(y(0)) + .5).attr('stroke', COL.axis);
    for (const gv of o.guides || []) svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', Math.round(y(gv)) + .5).attr('y2', Math.round(y(gv)) + .5).attr('stroke', COL.axis);
    if (B) {
      const pts = T[0].map((t, i) => ({ t, mu: B.mean[i], sd: B.sd[i] })), ok = d => Number.isFinite(d.mu) && Number.isFinite(d.sd);
      const band = k => d3.area().defined(ok).x(d => x(d.t)).y0(d => y(d.mu - k * d.sd)).y1(d => y(d.mu + k * d.sd))(pts);
      svg.append('path').attr('d', band(2)).attr('fill', COL.ink3).attr('opacity', .09);
      svg.append('path').attr('d', band(1)).attr('fill', COL.ink3).attr('opacity', .11);
      svg.append('path').attr('d', d3.line().defined(ok).x(d => x(d.t)).y(d => y(d.mu))(pts)).attr('fill', 'none').attr('stroke', COL.ink3).attr('stroke-width', 1);
    }
    series.forEach((s, k) => {
      svg.append('path').attr('d', d3.line().x((d, i) => x(T[k][i])).y(d => y(d))(s.values)).attr('fill', 'none').attr('stroke', s.color).attr('stroke-width', 2).attr('stroke-linejoin', 'round').attr('stroke-linecap', 'round');
    });
    // end dots and direct labels, pushed apart with leader lines when they would collide
    const ends = series.map((s, k) => ({ s, x: x(T[k][T[k].length - 1]), y: y(s.values[s.values.length - 1]), v: s.values[s.values.length - 1] }));
    if (o.endLabels !== false) {
      const lab = ends.map(e => ({ e, ly: e.y })).sort((a, b) => a.ly - b.ly);
      for (let pass = 0; pass < 8; pass++) for (let i = 1; i < lab.length; i++) { const gap = lab[i].ly - lab[i - 1].ly; if (gap < 13) { const push = (13 - gap) / 2; lab[i - 1].ly -= push; lab[i].ly += push; } }
      for (const l of lab) {
        l.ly = Math.max(m.t + 4, Math.min(H - m.b - 2, l.ly));
        if (Math.abs(l.ly - l.e.y) > 2) svg.append('line').attr('x1', l.e.x + 5).attr('x2', l.e.x + 10).attr('y1', l.e.y).attr('y2', l.ly).attr('stroke', COL.ink3);
        const tx = svg.append('text').attr('class', 'endlabel').attr('x', l.e.x + 12).attr('y', l.ly).attr('dy', '.32em');
        if (series.length > 1 && l.e.s.short) tx.append('tspan').text(l.e.s.short + ' ');
        tx.append('tspan').attr('fill', COL.ink).text(num(l.e.v, dec));
      }
    }
    for (const e of ends) svg.append('circle').attr('cx', e.x).attr('cy', e.y).attr('r', 4).attr('fill', e.s.color).attr('stroke', COL.surface).attr('stroke-width', 2);
    // crosshair
    const all = [...new Set(series.flatMap(s => s.dates))].sort(), allT = all.map(parseD);
    const maps = series.map(s => { const mp = new Map(); s.dates.forEach((d, i) => mp.set(d, s.values[i])); return mp; });
    const hair = svg.append('line').attr('y1', m.t).attr('y2', H - m.b).attr('stroke', COL.ink2).attr('opacity', 0);
    const dots = series.map(s => svg.append('circle').attr('r', 4).attr('fill', s.color).attr('stroke', COL.surface).attr('stroke-width', 2).attr('opacity', 0));
    const tip = tooltip(host), bis = d3.bisector(d => d).center;
    function move(ev) {
      const [px] = d3.pointer(ev, svg.node()), i = bis(allT, x.invert(px)), iso = all[i], cx = x(allT[i]);
      hair.attr('x1', cx).attr('x2', cx).attr('opacity', .5);
      const rows = [];
      series.forEach((s, k) => { const v = maps[k].get(iso); dots[k].attr('opacity', v == null ? 0 : 1); if (v != null) { dots[k].attr('cx', cx).attr('cy', y(v)); rows.push({ color: s.color, name: s.name, value: num(v, dec) + (o.unit ? ' ' + o.unit : '') }); } });
      if (B) { const j = series[0].dates.indexOf(iso); if (j >= 0 && Number.isFinite(B.mean[j])) rows.push({ name: 'Rolling mean', value: num(B.mean[j], dec) }, { name: 'Z-score', value: num((series[0].values[j] - B.mean[j]) / B.sd[j], 2, true) }); }
      tip.show(cx, rows, (o.dateFmt || fDow)(allT[i]));
    }
    svg.append('rect').attr('x', m.l).attr('y', m.t).attr('width', W - m.l - m.r).attr('height', H - m.t - m.b).attr('fill', 'transparent')
      .on('pointermove', move).on('pointerdown', move).on('pointerleave', () => { hair.attr('opacity', 0); dots.forEach(d => d.attr('opacity', 0)); tip.hide(); });
  }

  /** Yield curve by maturity point. curves = [{name, color, faded, points:[{t, v}]}] */
  function curveChart(host, o) {
    host.replaceChildren(); host.classList.add('chart');
    const curves = o.curves.filter(c => c.points.length);
    if (!curves.length) { host.append(h('div', { class: 'empty' }, 'No curve points loaded for the selected countries.')); return; }
    const main = curves.filter(c => !c.faded);
    if (main.length > 1) host.append(h('div', { class: 'legend' }, main.map(c => h('span', null, h('i', { style: 'background:' + c.color }), c.name)),
      curves.some(c => c.faded) ? h('span', null, h('i', { style: 'background:' + COL.ink3 + ';opacity:.6' }), o.fadedLabel) : null));
    const W = Math.max(260, Math.floor(host.clientWidth || 600)), H = fillHeight(host, o.height || 260), m = { t: 12, r: 16, b: 34, l: 42 };
    const svg = d3.select(host).append('svg').attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', 'Yield curves by maturity');
    const tenors = [...new Set(curves.flatMap(c => c.points.map(p => p.t)))].sort((a, b) => a - b);
    const x = d3.scalePoint().domain(tenors).range([m.l + 14, W - m.r - 14]);
    const vals = curves.flatMap(c => c.points.map(p => p.v)); let lo = d3.min(vals), hi = d3.max(vals); if (lo === hi) { lo -= .1; hi += .1; }
    const pad = (hi - lo) * .08, y = d3.scaleLinear().domain([lo - pad, hi + pad]).range([H - m.b, m.t]), yt = y.ticks(5), yf = y.tickFormat(5);
    svg.append('g').selectAll('line').data(yt).join('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', d => Math.round(y(d)) + .5).attr('y2', d => Math.round(y(d)) + .5).attr('stroke', COL.rule);
    svg.append('g').selectAll('text').data(yt).join('text').attr('class', 'tick').attr('x', m.l - 6).attr('y', d => y(d)).attr('dy', '.32em').attr('text-anchor', 'end').text(d => signFix(yf(d)));
    const lab = [];                                                           // maturity labels: benchmarks first, the others where there is room
    for (const t of [2, 5, 10, 30, 1, 3, 7, 15, 20, ...tenors].filter((t, i, a) => tenors.includes(t) && a.indexOf(t) === i)) if (lab.every(s => Math.abs(x(s) - x(t)) >= 24)) lab.push(t);
    svg.append('g').selectAll('text').data(lab).join('text').attr('class', 'tick').attr('x', d => x(d)).attr('y', H - m.b + 15).attr('text-anchor', 'middle').text(d => d + 'Y');
    svg.append('text').attr('class', 'axis-label').attr('x', (m.l + W - m.r) / 2).attr('y', H - 3).attr('text-anchor', 'middle').text('Maturity');
    svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', H - m.b + .5).attr('y2', H - m.b + .5).attr('stroke', COL.axis);
    const line = d3.line().x(p => x(p.t)).y(p => y(p.v));
    for (const c of curves) {
      svg.append('path').attr('d', line(c.points)).attr('fill', 'none').attr('stroke', c.color).attr('stroke-width', c.faded ? 1.25 : 2).attr('opacity', c.faded ? .45 : 1).attr('stroke-linejoin', 'round');
      if (!c.faded) svg.append('g').selectAll('circle').data(c.points).join('circle').attr('cx', p => x(p.t)).attr('cy', p => y(p.v)).attr('r', 4).attr('fill', c.color).attr('stroke', COL.surface).attr('stroke-width', 2);
    }
    const tip = tooltip(host), hair = svg.append('line').attr('y1', m.t).attr('y2', H - m.b).attr('stroke', COL.ink2).attr('opacity', 0);
    function move(ev) {
      const [px] = d3.pointer(ev, svg.node()); const t = tenors.reduce((a, b) => (Math.abs(x(b) - px) < Math.abs(x(a) - px) ? b : a));
      hair.attr('x1', x(t)).attr('x2', x(t)).attr('opacity', .5);
      const rows = curves.map(c => { const p = c.points.find(q => q.t === t); return p ? { color: c.color, name: c.name + (c.faded ? ' (' + o.fadedLabel + ')' : ''), value: num(p.v, o.decimals || 3) + ' %' } : null; }).filter(Boolean);
      tip.show(x(t), rows, t + '-year');
    }
    svg.append('rect').attr('x', m.l).attr('y', m.t).attr('width', W - m.l - m.r).attr('height', H - m.t - m.b).attr('fill', 'transparent')
      .on('pointermove', move).on('pointerdown', move).on('pointerleave', () => { hair.attr('opacity', 0); tip.hide(); });
  }

  /** Scatter of daily changes with the fitted line. Hover picks the nearest point. */
  function scatterChart(host, o) {
    host.replaceChildren(); host.classList.add('chart');
    const pts = o.points; if (pts.length < 3) { host.append(h('div', { class: 'empty' }, 'Not enough common observations for a regression.')); return; }
    const W = Math.max(260, Math.floor(host.clientWidth || 600)), H = o.height || 300, m = { t: 12, r: 16, b: 38, l: 48 };
    const svg = d3.select(host).append('svg').attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', 'Scatter of daily changes with regression line');
    const ex = d3.extent(pts, p => p.x), ey = d3.extent(pts, p => p.y), px = (ex[1] - ex[0]) * .08 || 1, py = (ey[1] - ey[0]) * .08 || 1;
    const x = d3.scaleLinear().domain([ex[0] - px, ex[1] + px]).range([m.l, W - m.r]), y = d3.scaleLinear().domain([ey[0] - py, ey[1] + py]).range([H - m.b, m.t]);
    const xt = x.ticks(6), yt = y.ticks(5);
    svg.append('g').selectAll('line').data(yt).join('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', d => Math.round(y(d)) + .5).attr('y2', d => Math.round(y(d)) + .5).attr('stroke', d => (d === 0 ? COL.axis : COL.rule));
    svg.append('g').selectAll('line').data(xt).join('line').attr('y1', m.t).attr('y2', H - m.b).attr('x1', d => Math.round(x(d)) + .5).attr('x2', d => Math.round(x(d)) + .5).attr('stroke', d => (d === 0 ? COL.axis : COL.rule));
    svg.append('g').selectAll('text').data(yt).join('text').attr('class', 'tick').attr('x', m.l - 6).attr('y', d => y(d)).attr('dy', '.32em').attr('text-anchor', 'end').text(d => signFix(y.tickFormat(5)(d)));
    svg.append('g').selectAll('text').data(xt).join('text').attr('class', 'tick').attr('x', d => x(d)).attr('y', H - m.b + 15).attr('text-anchor', 'middle').text(d => signFix(x.tickFormat(6)(d)));
    svg.append('text').attr('class', 'axis-label').attr('x', (m.l + W - m.r) / 2).attr('y', H - 4).attr('text-anchor', 'middle').text(o.xLabel);
    svg.append('text').attr('class', 'axis-label').attr('transform', `translate(12,${(m.t + H - m.b) / 2}) rotate(-90)`).attr('text-anchor', 'middle').text(o.yLabel);
    if (o.fit) { const d = x.domain(); svg.append('line').attr('x1', x(d[0])).attr('x2', x(d[1])).attr('y1', y(o.fit.alpha + o.fit.beta * d[0])).attr('y2', y(o.fit.alpha + o.fit.beta * d[1])).attr('stroke', COL.ink).attr('stroke-width', 1.5).attr('clip-path', 'inset(0)'); }
    svg.append('g').selectAll('circle').data(pts).join('circle').attr('cx', p => x(p.x)).attr('cy', p => y(p.y)).attr('r', 3).attr('fill', o.color).attr('opacity', .7);
    const last = pts[pts.length - 1];
    svg.append('circle').attr('cx', x(last.x)).attr('cy', y(last.y)).attr('r', 5).attr('fill', COL.ink).attr('stroke', COL.surface).attr('stroke-width', 2);
    svg.append('text').attr('class', 'endlabel').attr('x', x(last.x) + (x(last.x) > W - 90 ? -9 : 9)).attr('y', y(last.y) + (o.fit && o.fit.beta > 0 ? 16 : -8)).attr('text-anchor', x(last.x) > W - 90 ? 'end' : 'start').text('Latest');
    const del = d3.Delaunay.from(pts, p => x(p.x), p => y(p.y)), tip = tooltip(host);
    const ring = svg.append('circle').attr('r', 6).attr('fill', 'none').attr('stroke', COL.ink).attr('stroke-width', 1.5).attr('opacity', 0);
    function move(ev) {
      const [mx, my] = d3.pointer(ev, svg.node()), p = pts[del.find(mx, my)];
      ring.attr('cx', x(p.x)).attr('cy', y(p.y)).attr('opacity', 1);
      tip.show(x(p.x), [{ name: o.xName, value: bp(p.x) + ' bp' }, { name: o.yName, value: bp(p.y) + ' bp' }], fDow(parseD(p.d)));
    }
    svg.append('rect').attr('x', m.l).attr('y', m.t).attr('width', W - m.l - m.r).attr('height', H - m.t - m.b).attr('fill', 'transparent')
      .on('pointermove', move).on('pointerdown', move).on('pointerleave', () => { ring.attr('opacity', 0); tip.hide(); });
  }

  // ---------- panel wrappers
  function panel(o, ...body) {
    return h('section', { class: 'panel ' + (o.span || ''), id: o.id },
      h('header', null, h('h2', null, o.title), o.sub ? h('span', { class: 'sub' }, o.sub) : null, o.tools ? h('div', { class: 'tools' }, o.tools) : null),
      h('div', { class: 'panel-body' }, body), o.foot ? h('footer', null, o.foot) : null);
  }
  /** A chart panel with its table twin: the Table button swaps the drawing for the same numbers in rows. */
  function chartPanel(o) {
    const asTable = !!S.tables[o.id], host = h('div', { class: asTable ? null : 'fill' });
    const toggle = h('button', { class: 'linkbtn', type: 'button', 'aria-pressed': String(asTable), onclick: () => { S.tables[o.id] = !asTable; persist(); render(); } }, 'Table');
    if (asTable) {
      const t = o.table();
      host.append(h('div', { class: 'scroll', style: 'max-height:300px;overflow-y:auto' }, h('table', { class: 't' },
        h('thead', null, h('tr', null, t.head.map(c => h('th', null, c)))), h('tbody', null, t.rows.map(r => h('tr', null, r.map(c => h('td', null, c))))))));
    } else mount(host, o.draw);
    return panel({ ...o, tools: [o.tools, csvButton(o.id.replace(/^p-/, ''), () => o.table()), toggle] }, host);
  }
  /** Rows for the table twin of a multi-series chart, newest first. */
  function seriesTable(series, dec, fmt) {
    const dates = [...new Set(series.flatMap(s => s.dates))].sort().reverse();
    const maps = series.map(s => { const m = new Map(); s.dates.forEach((d, i) => m.set(d, s.values[i])); return m; });
    return { head: ['Date', ...series.map(s => s.name)], rows: dates.map(d => [(fmt || day)(d), ...maps.map(m => num(m.get(d), dec))]) };
  }
  const countrySeries = (list, n) => list.map(u => ({ ...tail(u, n), color: COL[u.country], short: u.country }));

  // ===================================================================== 7. views
  // ---------- 7.1 monitor
  const lastDate = () => d3.max(U.filter(u => u.cat === 'outright'), u => u.dates[u.dates.length - 1]);
  /** Country label, with the date of its last observation when it lags the page date. */
  function ctryRow(c) {
    const u = U.find(x => x.cat === 'outright' && x.country === c), d = u && u.dates[u.dates.length - 1];
    return h('span', { class: 'ctry' }, h('i', { class: 'swatch', style: 'background:' + COL[c] }), h('span', { class: 'name' }, c), h('span', { class: 'muted' }, COUNTRIES[c] + (d && d < lastDate() ? ', ' + fShort(parseD(d)) : '')));
  }
  /** Every maturity of one country, every horizon, with z-score and range. */
  function panelByMaturity(c, span) {
    const ret = S.metric === 'ret', n = WINDOWS[S.win], outs = U.filter(u => u.cat === 'outright' && u.country === c);
    const cell = (u, k) => { const d = change(u, HORIZONS[k]), r = approxReturn(u, HORIZONS[k]); return ret ? heatCell(num(r, 2, true), -r, HEAT_RET[k]) : heatCell(bp(d), d, HEAT_BP[k]); };
    return panel({ id: 'p-yields', span, title: `${COUNTRIES[c]}: yields by maturity`, sub: ret ? 'level in %, approximate total return in %' : 'level in %, changes in bp',
      tools: seg([['bp', 'Change'], ['ret', 'Return']], S.metric, v => set({ metric: v }), 'Metric'), foot: sourceLine(outs.flatMap(u => u.src)) },
      h('div', { class: 'scroll' }, h('table', { class: 't' },
        h('thead', null, h('tr', null, ['Maturity', 'Yield', '1D', '1W', '1M', 'YTD', 'Z ' + S.win, 'Pctile', 'Range ' + S.win].map(x => h('th', null, x)))),
        h('tbody', null, outs.map(u => { const st = stats(u, n); return h('tr', { class: 'click' + (Math.abs(st.z) >= 2 ? ' hot' : ''), onclick: () => go('rv', { rvSel: u.id, rvCat: 'all' }) },
          h('td', null, h('span', { class: 'name' }, u.tenor + 'Y')), h('td', { class: 'lvl' }, level(u)), ...Object.keys(HORIZONS).map(k => cell(u, k)),
          h('td', null, zChip(st.z)), h('td', null, num(st.pct, 0)), h('td', { svg: rangeBar(st) })); })))));
  }
  /** Countries in rows, maturities in columns: the headline points plus every maturity at least two countries share. */
  function panelMatrix(span) {
    const dc = DC(), hz = HORIZONS[S.horizon], ret = S.metric === 'ret';
    const count = t => dc.filter(c => inst(`${c}_${t}Y`)).length;
    const head2 = HEADLINE.filter(t => count(t) >= 2);
    const tenors = head2.length >= 2 ? HEADLINE.filter(t => count(t) >= 1) : tenorsAvail().filter(t => count(t) >= 2 || (HEADLINE.includes(t) && count(t) >= 1));
    const head = h('tr', null, h('th', null, 'Country'), tenors.map(t => [h('th', null, t + 'Y'), h('th', null, ret ? 'Ret %' : S.horizon)]));
    const rows = dc.map(c => h('tr', null, h('td', null, ctryRow(c)), tenors.map(t => {
      const u = inst(`${c}_${t}Y`); if (!u) return [h('td', { class: 'muted' }, DASH), h('td', { class: 'muted' }, DASH)];
      const d = change(u, hz), r = approxReturn(u, hz);
      return [h('td', { class: 'lvl' }, level(u)), ret ? heatCell(num(r, 2, true), -r, HEAT_RET[S.horizon]) : heatCell(bp(d), d, HEAT_BP[S.horizon])];
    })));
    return panel({ id: 'p-matrix', span, title: 'Yields by country', sub: ret ? `level in %, approximate total return over ${S.horizon}` : `level in %, change over ${S.horizon} in bp`,
      tools: seg(Object.keys(HORIZONS).map(k => [k, k]), S.horizon, v => set({ horizon: v }), 'Change horizon'),
      foot: sourceLine(U.filter(u => u.cat === 'outright' && dc.includes(u.country)).flatMap(u => u.src)) },
      h('div', { class: 'scroll' }, h('table', { class: 't' }, h('thead', null, head), h('tbody', null, rows))));
  }
  // ---------- monthly 10-year yields by country (used while daily yields exist for one country only)
  const monthOf = iso => fMon(parseD(iso));
  function monthlySpreads() {
    const M = monthly().filter(x => x.tenor === 10), ref = M.find(x => x.country === REF);
    return M.filter(x => x.country !== REF && ref && shown(x.country)).map(x => ({ country: x.country, name: `${x.country}${DASH}${REF}`, short: x.country, color: COL[x.country], ...join([x, ref], (a, b) => (a - b) * 100) }));
  }
  function panelMonthly(span) {
    const M = monthly().filter(x => x.tenor === 10 && shown(x.country)), sp = new Map(monthlySpreads().map(x => [x.country, x]));
    if (!M.length) return panel({ id: 'p-monthly', span, title: '10-year yields by country' }, h('div', { class: 'empty' }, 'No cross-country yield is loaded for the selected countries.'));
    const last = d3.max(M, x => x.dates[x.dates.length - 1]), back = (x, k) => (x.values.length > k ? x.values[x.values.length - 1] - x.values[x.values.length - 1 - k] : NaN);
    return panel({ id: 'p-monthly', span, title: '10-year yields by country', sub: `monthly averages, ${monthOf(last)}`,
      foot: sourceLine(M.map(x => x.source)).replace(' Details under Sources.', '') + ` Daily yields are loaded for ${dailyNames()} only: see Sources.` },
      h('div', { class: 'scroll' }, h('table', { class: 't' }, h('thead', null, h('tr', null, ['Country', '10Y %', 'vs DE bp', '1M', '12M'].map(x => h('th', null, x)))),
        h('tbody', null, M.map(x => { const q = sp.get(x.country), L = x.values.length;
          return h('tr', null, h('td', null, ctry(x.country, true)), h('td', { class: 'lvl' }, num(x.values[L - 1], 2)),
            q ? h('td', { class: 'lvl' }, num(q.values[q.values.length - 1], 0)) : h('td', { class: 'muted' }, DASH),
            q ? heatCell(num(back(q, 1), 0, true), back(q, 1), 30) : heatCell(num(back(x, 1) * 100, 0, true), back(x, 1) * 100, 30),
            q ? heatCell(num(back(q, 12), 0, true), back(q, 12), 80) : heatCell(num(back(x, 12) * 100, 0, true), back(x, 12) * 100, 80)); })))));
  }
  function panelMonthlyChart(id, span) {
    const series = monthlySpreads();
    return chartPanel({ id, span, title: '10-year spreads to Germany', sub: 'bp, monthly averages',
      draw: host => lineChart(host, { series, decimals: 0, unit: 'bp', dateFmt: fMon, label: 'Monthly 10-year spreads to Germany' }), table: () => seriesTable(series, 0, monthOf),
      foot: sourceLine(monthly().map(x => x.source)) });
  }
  function tenorSeg() { return seg(tenorsAvail().map(t => [t, t + 'Y']), S.tenor, v => set({ tenor: v }), 'Maturity'); }
  const spreadTenors = () => [...new Set(U.filter(u => u.cat === 'spread').map(u => u.tenor))].sort((a, b) => a - b);
  const spreadTenor = () => { const t = spreadTenors(); return t.includes(S.tenor) ? S.tenor : t.includes(10) ? 10 : t[0]; };
  const spreadSeg = () => seg(spreadTenors().map(t => [t, t + 'Y']), spreadTenor(), v => set({ tenor: v }), 'Maturity');
  const hasSpreads = () => U.some(u => u.cat === 'spread');
  function panelSpreads() {
    const T = spreadTenor(), n = WINDOWS[S.win], hz = HORIZONS[S.horizon], list = visible().filter(u => u.cat === 'spread' && u.tenor === T);
    const body = list.length ? h('div', { class: 'scroll' }, h('table', { class: 't' },
      h('thead', null, h('tr', null, ['Spread', 'bp', S.horizon, 'Z ' + S.win, 'Pctile', 'Range ' + S.win].map(c => h('th', null, c)))),
      h('tbody', null, list.map(u => { const st = stats(u, n), d = change(u, hz);
        return h('tr', { class: 'click' + (Math.abs(st.z) >= 2 ? ' hot' : ''), onclick: () => go('rv', { rvSel: u.id, rvCat: 'all' }) }, h('td', null, ctry(u.country), ' ', h('span', { class: 'muted' }, 'vs ' + REF)),
          h('td', { class: 'lvl' }, level(u)), heatCell(bp(d), d, HEAT_BP[S.horizon]), h('td', null, zChip(st.z)), h('td', null, num(st.pct, 0)), h('td', { svg: rangeBar(st) })); }))))
      : h('div', { class: 'empty' }, `No daily spread for the selected countries. Daily yields are loaded for ${dailyNames()} only.`);
    return panel({ id: 'p-spreads', span: 's5', title: 'Spreads to Germany, daily', sub: `${T}-year, in bp`, tools: spreadSeg(),
      foot: (sourceLine(list.flatMap(u => u.src)) + ' The curves are not built the same way: see Sources.').trim() }, body);
  }
  function panelShape() {
    const n = WINDOWS[S.win], legs = [...SLOPES.map(l => [`${l[0]}s${l[1]}s`, 'slope']), ...FLIES.map(l => [`${l[0]}s${l[1]}s${l[2]}s`, 'fly'])]
      .filter(([lg]) => DC().some(c => inst(`${c}_${lg}`)));
    const hz = HORIZONS[S.horizon];
    const rich = DC().filter(c => U.filter(u => u.country === c && (u.cat === 'slope' || u.cat === 'fly')).length >= 3);
    if (rich.length <= 1 && legs.length) {
      const c = rich[0] || DC().find(x => legs.some(([lg]) => inst(`${x}_${lg}`)));
      return panel({ id: 'p-shape', span: 's6', title: 'Curve shape', sub: `${COUNTRIES[c]}, slopes and butterflies in bp` },
        h('div', { class: 'scroll' }, h('table', { class: 't' },
          h('thead', null, h('tr', null, ['Structure', 'Level', '1D', '1W', '1M', 'Z ' + S.win, 'Range ' + S.win].map(x => h('th', null, x)))),
          h('tbody', null, legs.map(([lg, kind]) => { const u = inst(`${c}_${lg}`); if (!u) return null; const st = stats(u, n);
            return h('tr', { class: 'click' + (Math.abs(st.z) >= 2 ? ' hot' : ''), onclick: () => go('rv', { rvSel: u.id, rvCat: 'all' }) },
              h('td', null, h('span', { class: 'name' }, lg), ' ', h('span', { class: 'muted' }, kind)), h('td', { class: 'lvl' }, level(u)),
              ...['1D', '1W', '1M'].map(k => { const d = change(u, HORIZONS[k]); return heatCell(bp(d), d, HEAT_BP[k]); }), h('td', null, zChip(st.z)), h('td', { svg: rangeBar(st) })); })))));
    }
    const body = legs.length ? h('div', { class: 'scroll' }, h('table', { class: 't' },
      h('thead', null, h('tr', null, h('th', null, 'Structure'), rich.map(c => h('th', null, ctry(c))))),
      h('tbody', null, legs.map(([lg, kind]) => h('tr', null, h('td', null, h('span', { class: 'name' }, lg), ' ', h('span', { class: 'muted' }, kind)), rich.map(c => {
        const u = inst(`${c}_${lg}`); if (!u) return h('td', { class: 'muted' }, DASH);
        const st = stats(u, n), d = change(u, hz);
        const text = S.shape === 'z' ? num(st.z, 2, true) : S.shape === 'chg' ? bp(d) : level(u);
        const td = S.shape === 'chg' ? heatCell(text, d, HEAT_BP[S.horizon]) : heatCell(text, st.z, 3, `Level ${level(u)} bp, z-score ${num(st.z, 2, true)} over ${S.win}`);
        td.classList.add('click'); td.style.cursor = 'pointer'; td.addEventListener('click', () => go('rv', { rvSel: u.id, rvCat: 'all' })); return td;
      }))))))
      : h('div', { class: 'empty' }, 'Slopes and butterflies need at least two maturities per country. Only one maturity is loaded so far.');
    return panel({ id: 'p-shape', span: 's6', title: 'Curve shape', sub: S.shape === 'chg' ? `change over ${S.horizon} in bp` : `${S.shape === 'z' ? 'z-score' : 'level in bp'}, tinted by z-score over ${S.win}`,
      tools: seg([['level', 'Level'], ['z', 'Z-score'], ['chg', 'Change']], S.shape, v => set({ shape: v }), 'Number shown') }, body);
  }
  function panelExtremes(span, k) {
    const n = WINDOWS[S.win];
    const list = visible().filter(u => u.cat !== 'outright').map(u => ({ u, st: stats(u, n) })).filter(o => Number.isFinite(o.st.z)).sort((a, b) => Math.abs(b.st.z) - Math.abs(a.st.z)).slice(0, k || 9);
    const body = list.length ? h('div', { class: 'zlist' }, list.map(({ u, st }) => [
      h('a', { class: 'zn', href: '#rv', title: u.long, onclick: e => { e.preventDefault(); go('rv', { rvSel: u.id, rvCat: 'all' }); } }, u.name),
      h('div', { class: 'ztrack' }, h('div', { class: 'zbar ' + (st.z >= 0 ? 'pos' : 'neg'), style: `width:${(50 * Math.min(3, Math.abs(st.z)) / 3).toFixed(1)}%` })),
      h('div', { class: 'zv' }, num(st.z, 2, true))]))
      : h('div', { class: 'empty' }, `No z-score yet: the loaded history is shorter than the ${S.win} window.`);
    return panel({ id: 'p-extremes', span: span || 's6', title: 'Largest z-scores', sub: `spreads, slopes, flies and boxes, ${S.win} window, scale ${MINUS}3 to +3` }, body);
  }
  function panelSpreadChart(id, span) {
    const T = spreadTenor(), list = visible().filter(u => u.cat === 'spread' && u.tenor === T), series = countrySeries(list, RANGES[S.range]);
    return chartPanel({ id: id || 'p-spread-chart', span: span || 's6', title: `${T}-year spreads to Germany, daily`, sub: 'bp', tools: id ? spreadSeg() : null,
      draw: host => lineChart(host, { series, decimals: 1, unit: 'bp', label: 'Spreads to Germany over time' }), table: () => seriesTable(series, 1), foot: sourceLine(list.flatMap(u => u.src)) });
  }
  function auctionRows(list, upcoming) {
    return list.map(a => h('div', { class: 'item' }, h('span', { class: 'when' }, fShort(parseD(a.date))),
      h('span', { class: 'what' }, ctry(a.country), ' ', a.url ? h('a', { href: a.url, target: '_blank', rel: 'noopener' }, a.security || a.title) : (a.security || a.title)),
      h('span', { class: 'who' }, upcoming ? (a.amount_text || (Number.isFinite(a.amount_bn) ? `EUR ${num(a.amount_bn, 1)} bn` : 'size not announced'))
        : [Number.isFinite(a.amount_bn) ? `EUR ${num(a.amount_bn, 2)} bn` : null, Number.isFinite(a.avg_yield) ? `avg yield ${num(a.avg_yield, 3)} %` : null, Number.isFinite(a.bid_cover) ? `cover ${num(a.bid_cover, 2)}x` : null].filter(Boolean).join(', '))));
  }
  function panelAuctionsMini() {
    const A = DATA.auctions; let body;
    if (!A) body = h('div', { class: 'empty' }, 'Auction data is not loaded yet.');
    else {
      const up = (A.upcoming || []).filter(a => shown(a.country)).slice(0, 4), res = (A.results || []).filter(a => shown(a.country)).slice(0, 4);
      body = [up.length ? [h('div', { class: 'sub', style: 'color:var(--ink-3)' }, 'Next'), h('div', { class: 'feed short' }, auctionRows(up, true))] : null,
        res.length ? [h('div', { class: 'sub', style: 'color:var(--ink-3);margin-top:6px' }, 'Latest results'), h('div', { class: 'feed short' }, auctionRows(res, false))] : null];
    }
    return panel({ id: 'p-auctions-mini', span: 's3', title: 'Auctions', tools: h('a', { href: '#auctions' }, 'All') }, body);
  }
  function newsRows(items) {
    return items.map(n => h('div', { class: 'item' }, h('span', { class: 'when' }, fShort(parseD(n.date))),
      h('span', { class: 'what' }, n.url ? h('a', { href: n.url, target: '_blank', rel: 'noopener' }, n.title) : n.title), h('span', { class: 'who' }, n.source)));
  }
  /** Calendar entries: the events file plus the upcoming auctions of the selected countries. */
  function allEvents() {
    const ev = ((DATA.events && DATA.events.events) || []).slice();
    for (const a of ((DATA.auctions && DATA.auctions.upcoming) || [])) if (shown(a.country)) ev.push({ date: a.date, kind: 'Auction', title: `${COUNTRIES[a.country]}: ${a.title}`, url: a.url, size: Number.isFinite(a.amount_bn) ? `EUR ${num(a.amount_bn, 1)} bn` : null });
    return ev.sort((a, b) => a.date.localeCompare(b.date));
  }
  function nextEvents(k) { const today = new Date().toISOString().slice(0, 10); return allEvents().filter(e => e.date >= today).slice(0, k); }
  function panelBlotterMini() {
    const N = DATA.news, ev = nextEvents(3); let body = [];
    if (ev.length) body.push(h('div', { class: 'sub', style: 'color:var(--ink-3)' }, 'Next events'), h('div', { class: 'feed short' }, ev.map(e => h('div', { class: 'item' }, h('span', { class: 'when' }, fShort(parseD(e.date))), h('span', { class: 'what' }, e.title), h('span', { class: 'who' }, e.kind)))));
    if (N && N.items && N.items.length) body.push(h('div', { class: 'sub', style: 'color:var(--ink-3);margin-top:6px' }, 'Headlines'), h('div', { class: 'feed short' }, newsRows(N.items.slice(0, 4))));
    if (!body.length) body = h('div', { class: 'empty' }, 'News and calendar are not loaded yet.');
    return panel({ id: 'p-blotter-mini', span: 's3', title: 'Blotter', tools: h('a', { href: '#blotter' }, 'All') }, body);
  }
  function viewMonitor() {
    const dc = DC(), multi = dc.length > 1, sp = hasSpreads(), mo = monthly().length > 0, focus = dc.includes(REF) ? REF : dc[0];
    if (!focus) return h('div', { class: 'grid' }, mo ? [panelMonthly('s5'), panelMonthlyChart('p-monthly-chart', 's7')] : null, panelAuctionsMini(), panelBlotterMini());
    return h('div', { class: 'grid' },
      multi ? [panelMatrix('s7'), sp ? panelSpreads() : panelMonthly('s5')] : null,
      panelByMaturity(focus, 's7'), multi && sp && mo ? panelMonthly('s5') : !multi && mo ? panelMonthly('s5') : panelExtremes('s5'),
      panelShape(), multi && sp && mo || !multi && mo ? panelExtremes('s6') : null,
      sp ? panelSpreadChart() : mo ? panelMonthlyChart('p-monthly-chart', 's6') : null, panelAuctionsMini(), panelBlotterMini(),
      sp && mo ? panelMonthlyChart('p-monthly-chart', 's12') : null);
  }

  // ---------- 7.2 curves
  function viewCurves() {
    const cmp = { none: null, '1W': 5, '1M': 21, '3M': 63 }[S.compare];
    const curves = [];
    for (const c of DC()) {
      const outs = U.filter(u => u.cat === 'outright' && u.country === c);
      if (cmp) curves.push({ name: c, color: COL[c], faded: true, points: outs.filter(u => u.values.length > cmp).map(u => ({ t: u.tenor, v: u.values[u.values.length - 1 - cmp] })) });
      curves.push({ name: COUNTRIES[c], color: COL[c], points: outs.map(u => ({ t: u.tenor, v: u.values[u.values.length - 1] })) });
    }
    const outs = visible().filter(u => u.cat === 'outright' && u.tenor === S.tenor), ySeries = countrySeries(outs, RANGES[S.range]);
    const slopeIds = [...new Set(U.filter(u => u.cat === 'slope' || u.cat === 'fly').map(u => u.legs))];
    if (!slopeIds.includes(S.slope)) S.slope = slopeIds[0];
    const sl = visible().filter(u => (u.cat === 'slope' || u.cat === 'fly') && u.legs === S.slope), slSeries = countrySeries(sl, RANGES[S.range]);
    return h('div', { class: 'grid' },
      chartPanel({ id: 'p-curve', span: 's6', title: 'Curve snapshot', sub: 'yield in %, by maturity point',
        tools: seg([['none', 'Today'], ['1W', 'vs 1W'], ['1M', 'vs 1M'], ['3M', 'vs 3M']], S.compare, v => set({ compare: v }), 'Compare with'),
        draw: host => curveChart(host, { curves, fadedLabel: S.compare + ' ago', decimals: (U.find(u => u.cat === 'outright') || {}).decimals }),
        table: () => ({ head: ['Country', ...tenorsAvail().map(t => t + 'Y')], rows: DC().map(c => [COUNTRIES[c], ...tenorsAvail().map(t => { const u = inst(`${c}_${t}Y`); return u ? level(u) : DASH; })]) }),
        foot: sourceLine(U.filter(u => u.cat === 'outright' && shown(u.country)).flatMap(u => u.src)) }),
      chartPanel({ id: 'p-yield-hist', span: 's6', title: `${S.tenor}-year yields`, sub: '%', tools: tenorSeg(),
        draw: host => lineChart(host, { series: ySeries, decimals: (outs[0] && outs[0].decimals) || 3, unit: '%', label: 'Yield history by country' }), table: () => seriesTable(ySeries, (outs[0] && outs[0].decimals) || 3), foot: sourceLine(outs.flatMap(u => u.src)) }),
      slopeIds.length ? chartPanel({ id: 'p-slope-hist', span: 's6', title: `${S.slope} by country`, sub: 'bp',
        tools: select([['', slopeIds.map(s => [s, s])]], S.slope, v => set({ slope: v }), 'Slope or butterfly'),
        draw: host => lineChart(host, { series: slSeries, decimals: 1, unit: 'bp', label: 'Slope history by country' }), table: () => seriesTable(slSeries, 1) })
        : panel({ id: 'p-slope-hist', span: 's6', title: 'Slopes and butterflies' }, h('div', { class: 'empty' }, 'Slopes and butterflies need at least two maturities per country. Only one maturity is loaded so far.')),
      hasSpreads() ? panelSpreadChart('p-spread-hist', 's6') : panelMonthlyChart('p-monthly-chart', 's6'),
      hasSpreads() && monthly().length ? panelMonthlyChart('p-monthly-chart', 's12') : null);
  }

  // ---------- 7.3 RV screen
  function rvRows() {
    const n = WINDOWS[S.win];
    let rows = visible().filter(u => S.rvCat === 'all' || u.cat === S.rvCat).map(u => { const st = stats(u, n); return { u, st, d1: change(u, 1), d5: change(u, 5), d21: change(u, 21), absz: Math.abs(st.z) }; });
    const key = { name: r => r.u.name, last: r => r.st.last, d1: r => r.d1, d5: r => r.d5, d21: r => r.d21, z: r => r.st.z, absz: r => r.absz, pct: r => r.st.pct }[S.rvSort] || (r => r.absz);
    rows.sort((a, b) => { const x = key(a), y = key(b); if (typeof x === 'string') return S.rvDir * x.localeCompare(y); return (Number.isFinite(x) ? 0 : 1) - (Number.isFinite(y) ? 0 : 1) || S.rvDir * (x - y); });
    return rows;
  }
  function detailPanel(u, id, span, title) {
    const n = WINDOWS[S.win], st = stats(u, n), dec = u.unit === 'pct' ? (u.decimals || 3) : 1, r = RANGES[S.range];
    const roll = rolling(u.values, n), cut = rangeStart(u.dates), cutEnd = S.range === 'Custom' && S.to ? d3.bisectRight(u.dates, S.to) : u.dates.length; void r;
    const view = { name: u.name, color: u.country ? COL[u.country] : COL.DE, dates: u.dates.slice(cut, cutEnd), values: u.values.slice(cut, cutEnd) };
    const bands = { mean: roll.mean.slice(cut, cutEnd), sd: roll.sd.slice(cut, cutEnd) };
    const z = { name: 'Z-score', color: COL.ink2, dates: view.dates, values: view.values.map((v, i) => (v - bands.mean[i]) / bands.sd[i]) };
    const zOk = { ...z, dates: z.dates.filter((d, i) => Number.isFinite(z.values[i])), values: z.values.filter(Number.isFinite) };
    const host = h('div'), host2 = h('div');
    mount(host, el => lineChart(el, { series: [view], bands, decimals: dec, unit: unitLabel(u), height: 230, label: u.long }));
    mount(host2, el => lineChart(el, { series: [zOk], decimals: 2, height: 130, guides: [-2, 2], zero: true, label: 'Rolling z-score' }));
    const stat = (k, v, small) => h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v, small ? h('small', null, small) : null));
    return panel({ id, span, title: title || u.name, sub: u.long, foot: sourceLine(u.src) },
      h('div', { class: 'stats' }, stat('Level', level(u), unitLabel(u)), stat('1D', bp(change(u, 1)), 'bp'), stat('1W', bp(change(u, 5)), 'bp'), stat('1M', bp(change(u, 21)), 'bp'),
        stat('Z ' + S.win, num(st.z, 2, true)), stat('Percentile', num(st.pct, 0)), stat('Mean', num(st.mean, dec)), stat('Std dev', num(st.sd, dec)), stat('Range', `${num(st.min, dec)} to ${num(st.max, dec)}`)),
      h('div', { class: 'sub', style: 'color:var(--ink-3);padding-bottom:2px' }, `Level with ${S.win} rolling mean, bands at one and two standard deviations`), host,
      h('div', { class: 'sub', style: 'color:var(--ink-3);padding:6px 0 2px' }, `Z-score over a ${S.win} rolling window, guides at ${MINUS}2 and +2`), host2);
  }
  function viewRV() {
    const rows = rvRows();
    if (!rows.some(r => r.u.id === S.rvSel)) S.rvSel = rows.length ? rows[0].u.id : null;
    const cols = [['name', 'Structure'], ['last', 'Level'], ['z', 'Z ' + S.win], ['pct', 'Pctile'], ['d1', '1D'], ['d5', '1W'], ['d21', '1M']];
    const sortBy = k => set(S.rvSort === k ? { rvDir: -S.rvDir } : { rvSort: k, rvDir: k === 'name' ? 1 : -1 });
    const table = h('table', { class: 't' },
      h('thead', null, h('tr', null, cols.map(([k, t]) => h('th', { class: 'sortable', 'aria-sort': S.rvSort === k ? (S.rvDir > 0 ? 'ascending' : 'descending') : null, onclick: () => sortBy(k) }, t)),
        h('th', null, 'Range ' + S.win), h('th', null, 'Trend'))),
      h('tbody', null, rows.map(({ u, st, d1, d5, d21 }) => h('tr', { class: 'click' + (Math.abs(st.z) >= 2 ? ' hot' : ''), 'aria-selected': String(u.id === S.rvSel), onclick: () => set({ rvSel: u.id }) },
        h('td', null, h('span', { class: 'name' }, u.name), ' ', h('span', { class: 'muted' }, unitLabel(u))), h('td', { class: 'lvl' }, level(u)),
        h('td', null, zChip(st.z)), h('td', null, num(st.pct, 0)),
        heatCell(bp(d1), d1, HEAT_BP['1D']), heatCell(bp(d5), d5, HEAT_BP['1W']), heatCell(bp(d21), d21, HEAT_BP['1M']), h('td', { svg: rangeBar(st) }), h('td', { svg: spark(u.values.slice(-Math.min(u.values.length, WINDOWS[S.win]))) })))));
    const sel = inst(S.rvSel);
    // custom spread
    const opts = [['Outrights', U.filter(u => u.cat === 'outright').map(u => [u.id, u.name])], ['Spreads', U.filter(u => u.cat === 'spread').map(u => [u.id, u.name])],
      ['Slopes', U.filter(u => u.cat === 'slope').map(u => [u.id, u.name])], ['Flies', U.filter(u => u.cat === 'fly').map(u => [u.id, u.name])]].filter(g => g[1].length);
    const outs = U.filter(u => u.cat === 'outright');
    if (!inst(S.pairA)) S.pairA = (outs[1] || outs[0] || {}).id; if (!inst(S.pairB)) S.pairB = (outs[0] || {}).id;
    const A = inst(S.pairA), Bq = inst(S.pairB); let custom;
    if (A && Bq && A.unit === Bq.unit && A.id !== Bq.id) {
      const k = A.unit === 'pct' ? 100 : 1, j = join([A, Bq], (a, b) => (a - b) * k);
      custom = detailPanel({ id: 'custom', cat: 'custom', name: `${A.name} minus ${Bq.name}`, long: 'custom spread in bp, on the days both series have a value', unit: 'bp', country: A.country, ...j, src: [...A.src, ...Bq.src] }, 'p-custom', 's12', 'Custom spread');
      custom.querySelector('header').append(h('div', { class: 'tools' }, select(opts, S.pairA, v => set({ pairA: v }), 'First leg'), h('span', { class: 'muted' }, 'minus'), select(opts, S.pairB, v => set({ pairB: v }), 'Second leg')));
    } else {
      custom = panel({ id: 'p-custom', span: 's12', title: 'Custom spread', tools: [select(opts, S.pairA, v => set({ pairA: v }), 'First leg'), h('span', { class: 'muted' }, 'minus'), select(opts, S.pairB, v => set({ pairB: v }), 'Second leg')] },
        h('div', { class: 'empty' }, 'Pick two different series of the same kind: two yields, or two structures quoted in bp.'));
    }
    return h('div', { class: 'grid' },
      panel({ id: 'p-rv', span: 's7', title: 'Relative value screen', sub: `${rows.length} structures, changes in bp`, tools: seg(Object.entries(CATS).filter(([k]) => k === 'all' || U.some(u => u.cat === k)), S.rvCat, v => set({ rvCat: v }), 'Category') },
        rows.length ? h('div', { class: 'scroll', style: 'max-height:640px;overflow-y:auto' }, table) : h('div', { class: 'empty' }, 'No structure in this category for the selected countries.')),
      sel ? detailPanel(sel, 'p-detail', 's5') : panel({ id: 'p-detail', span: 's5', title: 'Detail' }, h('div', { class: 'empty' }, 'Select a row to see its history.')),
      custom);
  }

  // ---------- 7.4 analysis
  function viewAnalysis() {
    const n = WINDOWS[S.win], all = U, groups = Object.entries(CATS).filter(([k]) => k !== 'all').map(([k, name]) => [name, all.filter(u => u.cat === k).map(u => [u.id, u.name])]).filter(g => g[1].length);
    const outs10 = all.filter(u => u.cat === 'outright');
    if (!inst(S.regY)) S.regY = (outs10.find(u => u.country !== REF && u.tenor === 10 && u.values.length > 120) || inst(`${REF}_30Y`) || outs10[1] || outs10[0] || {}).id;
    if (!inst(S.regX)) S.regX = (inst(`${REF}_10Y`) || outs10[0] || {}).id;
    const Yi = inst(S.regY), Xi = inst(S.regX); let reg, rollPanel;
    const tools = [select(groups, S.regY, v => set({ regY: v }), 'Dependent series'), h('span', { class: 'muted' }, 'on'), select(groups, S.regX, v => set({ regX: v }), 'Explanatory series')];
    if (Yi && Xi && Yi.id !== Xi.id) {
      const jc = jointChanges([Yi, Xi]), L = jc.dates.length, from = Math.max(0, L - n);
      const y = jc.cols[0].slice(from), x = jc.cols[1].slice(from), d = jc.dates.slice(from), fit = ols(x, y);
      const pts = x.map((v, i) => ({ x: v, y: y[i], d: d[i] }));
      // beta-weighted spread on levels, in bp
      let resid = null;
      if (fit) { const ky = Yi.unit === 'pct' ? 100 : 1, kx = Xi.unit === 'pct' ? 100 : 1; const lv = jc.levels.values.slice(-Math.min(jc.levels.values.length, n)).map(r => r[0] * ky - fit.beta * r[1] * kx); resid = { last: lv[lv.length - 1], z: (lv[lv.length - 1] - d3.mean(lv)) / d3.deviation(lv) }; }
      const stat = (k, v, small) => h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v, small ? h('small', null, small) : null));
      const host = h('div');
      mount(host, el => scatterChart(el, { points: pts, fit, color: COL[Yi.country] || COL.DE, xLabel: `Daily change in ${Xi.name}, bp`, yLabel: `Daily change in ${Yi.name}, bp`, xName: Xi.name, yName: Yi.name }));
      reg = panel({ id: 'p-reg', span: 's7', title: 'Regression', sub: `daily changes in bp, last ${y.length} observations (${S.win} window)`, tools, foot: sourceLine([...Yi.src, ...Xi.src]) },
        fit ? h('div', { class: 'stats' }, stat('Beta', num(fit.beta, 2)), stat('R squared', num(fit.r2, 2)), stat('Correlation', num(fit.corr, 2)), stat('Alpha', num(fit.alpha, 2, true), 'bp per day'), stat('Observations', String(fit.n)),
          resid ? stat('Beta-weighted spread', num(resid.last, 1), 'bp') : null, resid ? stat('Its z-score', num(resid.z, 2, true)) : null) : null, host,
        fit ? h('p', { class: 'prose', style: 'margin:6px 0 0' }, `A 1 bp move in ${Xi.name} has gone with a ${num(fit.beta, 2)} bp move in ${Yi.name}. The beta-weighted spread is ${Yi.name} minus beta times ${Xi.name}, on levels.`) : null);
      // rolling beta
      const rb = { name: `Beta of ${Yi.name} on ${Xi.name}`, color: COL[Yi.country] || COL.DE, dates: [], values: [] };
      for (let i = n; i <= L; i++) { const f = ols(jc.cols[1].slice(i - n, i), jc.cols[0].slice(i - n, i)); if (f) { rb.dates.push(jc.dates[i - 1]); rb.values.push(f.beta); } }
      const rbv = tail(rb, RANGES[S.range]);
      rollPanel = chartPanel({ id: 'p-rollbeta', span: 's5', title: 'Rolling beta', sub: `${S.win} window`, draw: el => lineChart(el, { series: [rbv], decimals: 2, height: 300, label: 'Rolling beta' }), table: () => seriesTable([rbv], 2) });
    } else {
      reg = panel({ id: 'p-reg', span: 's7', title: 'Regression', tools }, h('div', { class: 'empty' }, 'Pick two different series.'));
      rollPanel = panel({ id: 'p-rollbeta', span: 's5', title: 'Rolling beta' }, h('div', { class: 'empty' }, 'Pick two different series.'));
    }
    // correlation matrix
    const sets = [];
    for (const c of DC()) sets.push([`c${c}`, `${COUNTRIES[c]}: all maturities`, U.filter(u => u.cat === 'outright' && u.country === c)]);
    for (const t of tenorsAvail()) sets.push([`y${t}`, `${t}-year yields by country`, visible().filter(u => u.cat === 'outright' && u.tenor === t)]);
    for (const t of tenorsAvail()) sets.push([`s${t}`, `${t}-year spreads to Germany`, visible().filter(u => u.cat === 'spread' && u.tenor === t)]);
    const usable = sets.filter(s => s[2].length >= 2);
    if (!usable.some(s => s[0] === S.corrSet)) S.corrSet = usable.length ? usable[0][0] : null;
    const cs = usable.find(s => s[0] === S.corrSet); let corr;
    if (cs) {
      const jc = jointChanges(cs[2]), from = Math.max(0, jc.dates.length - n), cols = jc.cols.map(c => c.slice(from)), k = cols.length;
      const M = cols.map((a, i) => cols.map((b, j) => (i === j ? 1 : (ols(a, b) || { corr: NaN }).corr)));
      corr = panel({ id: 'p-corr', span: 's12', title: 'Correlation of daily changes', sub: `last ${cols[0].length} common observations (${S.win} window)`, tools: select([['', usable.map(s => [s[0], s[1]])]], S.corrSet, v => set({ corrSet: v }), 'Series set') },
        h('div', { class: 'scroll heatwrap' }, h('table', { class: 't' }, h('thead', null, h('tr', null, h('th', null, ''), cs[2].map(u => h('th', null, u.name)))),
          h('tbody', null, cs[2].map((u, i) => h('tr', null, h('td', null, h('span', { class: 'name' }, u.name)), M[i].map((v, j) => h('td', { class: 'hm', style: 'background:' + (i === j ? 'transparent' : heat(v, 1)) }, i === j ? h('span', { class: 'muted' }, '1') : num(v, 2)))))))));
      void k;
    } else corr = panel({ id: 'p-corr', span: 's12', title: 'Correlation of daily changes' }, h('div', { class: 'empty' }, 'At least two series are needed.'));
    return h('div', { class: 'grid' }, reg, rollPanel, corr);
  }

  // ---------- 7.5 rates and futures (generic: one table and one chart per group)
  function groupView(group, title, emptyText, unit, dec) {
    const list = (DATA.market.series || []).filter(s => s.group === group);
    if (!list.length) return h('div', { class: 'grid' }, panel({ id: 'p-' + group, title }, h('div', { class: 'empty' }, emptyText)));
    const palette = ORDER.map(c => COL[c]);
    const series = list.map((s, i) => ({ name: s.name, short: s.short || '', color: palette[i % palette.length], ...inRange({ dates: s.dates, values: s.values }) }));
    const rows = list.map(s => { const u = { ...s, unit: s.unit || 'pct' }; const L = s.values.length; return h('tr', null, h('td', null, h('span', { class: 'name' }, s.name)), h('td', { class: 'lvl' }, num(s.values[L - 1], dec)), h('td', null, day(s.dates[L - 1])),
      ...['1D', '1W', '1M'].map(k => { const d = change(u, HORIZONS[k]); return heatCell(unit === 'bp' || u.unit === 'pct' ? bp(d) : num(d, 2, true), d, HEAT_BP[k]); })); });
    const chartSeries = series.slice(0, 8);
    return h('div', { class: 'grid' },
      panel({ id: 'p-' + group + '-table', span: 's5', title, foot: sourceLine(list.map(s => s.source)) }, h('div', { class: 'scroll' }, h('table', { class: 't' },
        h('thead', null, h('tr', null, ['Series', 'Last', 'Date', '1D', '1W', '1M'].map(c => h('th', null, c)))), h('tbody', null, rows)))),
      chartPanel({ id: 'p-' + group + '-chart', span: 's7', title: 'History', sub: '%', draw: el => lineChart(el, { series: chartSeries, decimals: dec, height: 300, label: title + ' history' }), table: () => seriesTable(chartSeries, dec) }),
      group === 'mm' ? keyRatesPanel('s12') : null);
  }


  // ---------- 7.5b futures: settlement prices and deliverable baskets
  function viewFutures() {
    const F = DATA.futures, int = d3.format(','), all = [];
    for (const p of F.products) for (const c of p.contracts) all.push({ p, c, key: p.code + ' ' + c.label });
    if (!all.some(x => x.key === S.futSel)) S.futSel = (all.find(x => x.c.basket && x.c.basket.length) || all[0]).key;
    const sel = all.find(x => x.key === S.futSel);
    const contracts = h('table', { class: 't' },
      h('thead', null, h('tr', null, ['Contract', 'Expiry', 'Settle', 'Volume', 'Open interest'].map(c => h('th', null, c)))),
      h('tbody', null, all.map(({ p, c, key }) => h('tr', { class: 'click', 'aria-selected': String(key === S.futSel), onclick: () => set({ futSel: key }) },
        h('td', null, h('span', { class: 'name' }, p.name), ' ', h('span', { class: 'muted' }, p.code)), h('td', null, c.label), h('td', { class: 'lvl' }, num(c.settle, 2)),
        h('td', null, Number.isFinite(c.volume) ? int(c.volume) : DASH), h('td', null, Number.isFinite(c.open_interest) ? int(c.open_interest) : DASH)))));
    const b = (sel.c.basket || []).slice().sort((x, y) => x.maturity.localeCompare(y.maturity)), priced = b.some(x => Number.isFinite(x.price));
    const basket = b.length ? h('div', { class: 'scroll' }, h('table', { class: 't' },
      h('thead', null, h('tr', null, ['ISIN', 'Coupon', 'Maturity', 'Conv. factor', ...(priced ? ['Price', 'Yield', 'Gross basis', 'Net basis', 'Implied repo'] : [])].map(c => h('th', null, c)))),
      h('tbody', null, b.map(x => h('tr', { class: x.ctd ? 'hot' : null }, h('td', null, h('span', { class: 'name' }, x.isin), x.ctd ? h('span', { class: 'pill ok', style: 'margin-left:8px' }, 'CTD') : null),
        h('td', null, num(x.coupon, 3) + ' %'), h('td', null, day(x.maturity)), h('td', { class: 'lvl' }, num(x.cf, 6)),
        ...(priced ? [h('td', null, num(x.price, 3)), h('td', null, Number.isFinite(x.yield) ? num(x.yield, 3) + ' %' : DASH), h('td', null, num(x.gross_basis, 3)), h('td', null, num(x.net_basis, 3)), h('td', { class: 'lvl' }, Number.isFinite(x.implied_repo) ? num(x.implied_repo, 2) + ' %' : DASH)] : []))))))
      : h('div', { class: 'empty' }, 'No deliverable basket loaded for this contract.');
    return h('div', { class: 'grid' },
      panel({ id: 'p-fut', span: 's5', title: 'Eurex bond futures', sub: F.asof ? 'daily settlement, ' + day(F.asof) : null, foot: sourceLine(F.sources || []) }, h('div', { class: 'scroll' }, contracts)),
      panel({ id: 'p-basket', span: 's7', title: `${sel.p.name} ${sel.c.label}: deliverable basket`, sub: `notional coupon ${sel.p.notional_coupon} %`,
        foot: priced ? 'Basis in price points. CTD = highest implied repo. See the note below for the method and its limits.' : 'Basis, implied repo and cheapest-to-deliver need a clean price per bond. No free price source is verified for this issuer yet.' }, basket),
      F.note ? panel({ id: 'p-fut-note', span: 's12', title: 'Reading this page' }, h('div', { class: 'prose' }, h('p', null, F.note))) : null);
  }

  // ---------- 7.6 auctions
  function viewAuctions() {
    const A = DATA.auctions;
    if (!A) return h('div', { class: 'grid' }, panel({ id: 'p-auc', title: 'Auctions' }, h('div', { class: 'empty' }, 'Auction data is not loaded yet.')));
    const f = a => shown(a.country), res = (A.results || []).filter(f), up = (A.upcoming || []).filter(f);
    const link = a => (a.url ? h('a', { href: a.url, target: '_blank', rel: 'noopener' }, 'Source') : '');
    const tail_ = a => (Number.isFinite(a.stop_yield) && Number.isFinite(a.avg_yield) ? num((a.stop_yield - a.avg_yield) * 100, 1) : DASH);
    return h('div', { class: 'grid' },
      panel({ id: 'p-auc-up', span: 's5', title: 'Upcoming auctions', sub: 'as announced by the issuers', foot: A.note_upcoming || null },
        up.length ? h('div', { class: 'scroll' }, h('table', { class: 't' }, h('thead', null, h('tr', null, ['Date', 'Issuer', 'What', 'Size', ''].map((c, i) => h('th', { class: i === 2 ? 'l' : null }, c)))),
          h('tbody', null, up.map(a => h('tr', null, h('td', null, fDow(parseD(a.date))), h('td', null, ctry(a.country)), h('td', { class: 'l wrap' }, a.title || a.security), h('td', null, a.amount_text || (Number.isFinite(a.amount_bn) ? num(a.amount_bn, 1) + ' bn' : DASH)), h('td', null, link(a)))))))
          : h('div', { class: 'empty' }, 'No upcoming auction loaded for the selected countries.')),
      panel({ id: 'p-auc-res', span: 's7', title: 'Latest results', sub: 'amounts in EUR bn, yields in %, tail = stop yield minus average yield in bp', foot: A.note_results || null },
        res.length ? h('div', { class: 'scroll' }, h('table', { class: 't' }, h('thead', null, h('tr', null, ['Date', 'Issuer', 'Security', 'Allotted', 'Bids', 'Cover', 'Avg yield', 'Stop yield', 'Tail', ''].map((c, i) => h('th', { class: i === 2 ? 'l' : null }, c)))),
          h('tbody', null, res.map(a => h('tr', null, h('td', null, day(a.date)), h('td', null, ctry(a.country)), h('td', { class: 'l wrap' }, a.security, a.isin ? h('span', { class: 'muted' }, ' ' + a.isin) : null),
            h('td', null, num(a.amount_bn, 2)), h('td', null, num(a.bids_bn, 2)), h('td', { class: 'lvl' }, Number.isFinite(a.bid_cover) ? num(a.bid_cover, 2) + 'x' : DASH), h('td', null, num(a.avg_yield, 3)), h('td', null, num(a.stop_yield, 3)), h('td', null, tail_(a)), h('td', null, link(a)))))))
          : h('div', { class: 'empty' }, 'No auction result loaded for the selected countries.')));
  }

  function keyRatesPanel(span) {
    const E = DATA.events, kr = (E && E.key_rates) || []; if (!kr.length) return null;
    return panel({ id: 'p-keyrates', span, title: 'ECB key interest rates', sub: 'in %, by date of effect',
      foot: E.key_rates_url ? h('a', { href: E.key_rates_url, target: '_blank', rel: 'noopener' }, 'Source: ECB') : null },
      h('div', { class: 'scroll' }, h('table', { class: 't' }, h('thead', null, h('tr', null, ['With effect from', 'Deposit facility', 'Main refinancing', 'Marginal lending'].map(c => h('th', null, c)))),
        h('tbody', null, kr.map((r, i) => h('tr', null, h('td', null, day(r.date), i === 0 ? h('span', { class: 'pill', style: 'margin-left:8px' }, 'current') : null), h('td', { class: 'lvl' }, num(r.dfr, 2)), h('td', null, num(r.mro, 2)), h('td', null, num(r.mlf, 2))))))));
  }
  // ---------- 7.7 blotter
  function viewBlotter() {
    const N = DATA.news, E = DATA.events, today = new Date().toISOString().slice(0, 10);
    const ev = allEvents(), future = ev.filter(e => e.date >= today), past = ev.filter(e => e.date < today).reverse().slice(0, 12);
    const evRow = e => h('div', { class: 'item' }, h('span', { class: 'when' }, fDay(parseD(e.date))), h('span', { class: 'what' }, e.url ? h('a', { href: e.url, target: '_blank', rel: 'noopener' }, e.title) : e.title), h('span', { class: 'who' }, [e.kind, e.note].filter(Boolean).join(', ')));
    const ratesPanel = keyRatesPanel('s12');
    return h('div', { class: 'grid' },
      panel({ id: 'p-news', span: 's7', title: 'Headlines', sub: 'official feeds, newest first', foot: (N && N.note) || null },
        N && N.items && N.items.length ? h('div', { class: 'feed', tabindex: '0' }, newsRows(N.items)) : h('div', { class: 'empty' }, 'News feeds are not loaded yet.')),
      panel({ id: 'p-events', span: 's5', title: 'Calendar', sub: 'events that can move rates', foot: (E && E.note) || null },
        ev.length ? [h('div', { class: 'feed', tabindex: '0' }, future.map(evRow)), past.length ? [h('div', { class: 'sub', style: 'color:var(--ink-3);margin-top:8px' }, 'Recent'), h('div', { class: 'feed short' }, past.map(evRow))] : null]
          : h('div', { class: 'empty' }, 'The calendar is not loaded yet.')), ratesPanel);
  }

  // ---------- 7.8 sources and methods
  function viewSources() {
    const M = DATA.sources || { sources: [] }, pill = s => h('span', { class: 'pill ' + ({ verified: 'ok', unverified: 'warn' }[s] || 'off') }, { verified: 'Verified', unverified: 'Not verified', planned: 'Planned', blocked: 'Not reachable' }[s] || s);
    const loaded = M.sources.filter(s => s.used), other = M.sources.filter(s => !s.used);
    const tbl = list => h('div', { class: 'scroll' }, h('table', { class: 't src' }, h('thead', null, h('tr', null, ['Dataset', 'Publisher', 'Covers', 'Frequency', 'Status', 'Note'].map((c, i) => h('th', { class: i ? 'l' : null }, c)))),
      h('tbody', null, list.map(s => h('tr', null, h('td', null, s.url ? h('a', { href: s.url, target: '_blank', rel: 'noopener' }, s.name) : s.name), h('td', { class: 'l', 'data-k': 'Publisher' }, s.publisher), h('td', { class: 'l wrap', 'data-k': 'Covers' }, s.covers), h('td', { class: 'l', 'data-k': 'Frequency' }, s.frequency), h('td', { class: 'l', 'data-k': 'Status' }, pill(s.status)), h('td', { class: 'l wrap', 'data-k': 'Note' }, s.note || ''))))));
    const methods = h('div', { class: 'prose' },
      h('h3', null, 'How the numbers are built'),
      h('p', null, 'Every derived number is computed in the browser from the published daily yields. Changes are in basis points.'),
      h('ul', null,
        h('li', null, h('code', null, 'Fixing'), ' = the official yield of a day, set during the trading day and not at the close. Germany: curve estimated by the Bundesbank, online the same afternoon. France: TEC indices, from prices taken at 11:00 and published around 11:30. Spain: yields from the trades of the day, published two business days later. A 1-day change runs from one fixing to the next.'),
        h('li', null, h('code', null, 'Spread'), ' = country yield minus German yield at the same maturity, in bp.'),
        h('li', null, h('code', null, 'Slope'), ' = long yield minus short yield, in bp (2s10s = 10-year minus 2-year).'),
        h('li', null, h('code', null, 'Butterfly'), ' = 2 x body minus the two wings, in bp (2s5s10s = 2 x 5-year minus 2-year minus 10-year).'),
        h('li', null, h('code', null, 'Box'), ' = country slope minus German slope, in bp.'),
        h('li', null, h('code', null, 'Z-score'), ' = (latest level minus mean) / sample standard deviation, over the selected window of observations, latest one included. It needs at least 90% of the window.'),
        h('li', null, h('code', null, 'Percentile'), ' = share of the window below the latest level.'),
        h('li', null, h('code', null, 'Regression'), ' = ordinary least squares on day-to-day changes in bp, on the days both series have a value.'),
        h('li', null, h('code', null, 'Daily note'), ' = sentences written by the page from the day\'s moves. Bull or bear: yields lower or higher. Steeper or flatter: 2s10s wider or narrower. Twist: the 2-year and the 10-year move by at least 1 bp in opposite directions. Parallel: 2s10s unchanged. A butterfly that rises means its belly cheapened. Moves below 0.05 bp read as unchanged.'),
        h('li', null, h('code', null, 'Largest moves'), ' = 1-day change divided by the standard deviation of the daily changes over the z-score window, the latest one included. One row per family: a country\'s 2, 5, 10 and 30-year yields, its spreads to Germany, its slopes.'),
        h('li', null, h('code', null, 'Approximate return'), ' = minus modified duration x yield change, plus the running yield over the period. Duration is that of an annual-pay par bond at the starting yield. Roll-down and convexity are ignored.')),
      h('h3', null, 'Reading the colours'),
      h('p', null, 'Red means a higher yield, a wider spread or a cheaper level. Blue means the opposite. Each country keeps one colour across all charts.'),
      M.notes && M.notes.length ? [h('h3', null, 'Known limits'), h('ul', null, M.notes.map(n => h('li', null, n)))] : null);
    return h('div', { class: 'grid' },
      panel({ id: 'p-src-used', span: 's12', title: 'Data on this page', sub: M.updated ? 'checked ' + day(M.updated) : null }, loaded.length ? tbl(loaded) : h('div', { class: 'empty' }, 'No source list loaded.')),
      other.length ? panel({ id: 'p-src-other', span: 's12', title: 'Sources audited, not used yet' }, tbl(other)) : null,
      panel({ id: 'p-methods', span: 's12', title: 'Methods' }, methods));
  }

/*__HOME__*/

/*__LAB__*/

  // ===================================================================== 8. shell
  const root = () => document.getElementById('view');
  function hasGroup(g) { return DATA.market && DATA.market.series.some(s => s.group === g); }
  const tabOK = id => !!TAB[id] && (id === 'rates' ? hasGroup('mm') : id === 'futures' ? !!(DATA.futures && DATA.futures.products && DATA.futures.products.length) : true);
  const spaceOf = tab => SPACES.find(s => s[3].includes(tab)) || SPACES[0];
  let filtersOpen = false;                             // phone only: the filter row folds into one button

  function renderShell() {
    const sp = spaceOf(S.tab), need = TAB[S.tab][2];
    document.getElementById('spaces').replaceChildren(...SPACES.filter(s => s[3].some(tabOK)).map(([id, name, short, tabs]) =>
      h('button', { class: 'space', type: 'button', id: 'space-' + id, 'aria-current': sp[0] === id ? 'page' : null, 'aria-label': name, 'data-tabs': tabs.filter(tabOK).join(','),
        onclick: () => go(S.last && tabs.includes(S.last[id]) && tabOK(S.last[id]) ? S.last[id] : tabs.find(tabOK)) }, h('span', { class: 'long' }, name), h('span', { class: 'short' }, short))));
    const tabs = sp[3].filter(tabOK), bar = document.getElementById('tabs');
    bar.hidden = tabs.length < 2; bar.parentNode.classList.toggle('solo', tabs.length < 2);
    bar.replaceChildren(...(tabs.length < 2 ? [] : tabs.map(id => h('button', { class: 'tab', role: 'tab', type: 'button', id: 'tab-' + id, 'aria-selected': String(S.tab === id), onclick: () => go(id) }, TAB[id][0]))));
    const on = bar.querySelector('[aria-selected="true"]'); if (on && bar.scrollWidth > bar.clientWidth) bar.scrollLeft = on.offsetLeft - (bar.clientWidth - on.offsetWidth) / 2;   // keep the open section in sight on a phone
    document.getElementById('about').textContent = TAB[S.tab][1];
    document.title = (S.tab === 'home' ? '' : TAB[S.tab][0] + ' | ') + 'EGB Dashboard';

    const avail = availCountries(), groups = [];
    const toggle = c => { const cur = S.countries.includes(c) ? S.countries.filter(x => x !== c) : ORDER.filter(x => S.countries.includes(x) || x === c); if (cur.length) set({ countries: cur }); };
    if (need.includes('countries')) groups.push(h('div', { class: 'fgroup' }, h('span', { class: 'flabel' }, 'Countries'), h('div', { class: 'seg', role: 'group', 'aria-label': 'Countries shown' },
      avail.map(c => h('button', { type: 'button', 'aria-pressed': String(S.countries.includes(c)), title: COUNTRIES[c] + (hasDaily(c) ? '' : ': monthly data only'), onclick: () => toggle(c) }, h('i', { class: 'swatch', style: 'background:' + COL[c] }), c)))));
    if (need.includes('win')) groups.push(h('div', { class: 'fgroup' }, h('span', { class: 'flabel' }, 'Z-score window'), seg(Object.keys(WINDOWS).map(k => [k, k]), S.win, v => set({ win: v }), 'Z-score window')));
    if (need.includes('range')) groups.push(h('div', { class: 'fgroup' }, h('span', { class: 'flabel' }, 'Chart range'),
      seg(Object.keys(RANGES).map(k => [k, k]), S.range, v => set(v === 'Custom' && !S.from ? { range: v, from: d3.timeFormat('%Y-%m-%d')(d3.timeYear.offset(new Date(), -3)) } : { range: v }), 'Chart range'),
      S.range === 'Custom' ? h('span', { class: 'daterange' }, h('input', { class: 'inp', type: 'date', value: S.from || '', 'aria-label': 'Chart range from', onchange: e => set({ from: e.target.value }) }), h('span', { class: 'muted' }, 'to'), h('input', { class: 'inp', type: 'date', value: S.to || '', 'aria-label': 'Chart range to (empty: latest)', onchange: e => set({ to: e.target.value }) })) : null));
    const f = document.getElementById('filters'); f.hidden = !groups.length; f.classList.toggle('open', filtersOpen);
    const summary = [need.includes('countries') ? S.countries.join(' ') : null, need.includes('win') ? 'z ' + S.win : null, need.includes('range') ? 'range ' + (S.range === 'Custom' ? 'by dates' : S.range) : null].filter(Boolean).join(', ');
    f.replaceChildren(h('button', { class: 'ftoggle', type: 'button', 'aria-expanded': String(filtersOpen), 'aria-controls': 'filters', onclick: () => { filtersOpen = !filtersOpen; renderShell(); } }, h('span', null, 'Filters'), h('span', { class: 'muted' }, summary)), ...groups,
      h('div', { class: 'legend-key fkey' }, h('span', null, h('i', { class: 'k-up' }), 'higher, wider, cheaper'), h('span', null, h('i', { class: 'k-down' }), 'lower, tighter, richer')));
  }
  function render() {
    redraws.length = 0; if (!tabOK(S.tab)) S.tab = 'home'; renderShell();
    const v = { home: viewHome, builder: viewBuilder, curvelab: viewCurveLab, backtest: viewBacktest, monitor: viewMonitor, curves: viewCurves, rv: viewRV, analysis: viewAnalysis, auctions: viewAuctions, blotter: viewBlotter, sources: viewSources,
      rates: () => groupView('mm', 'Money market and policy rates', '', '%', 3), futures: viewFutures }[S.tab] || viewHome;
    let node;
    try { node = v(); } catch (e) {
      // A screen that fails says so and offers the usual cure (settings saved by an older version); the error still reaches the console.
      node = h('div', { class: 'grid' }, panel({ id: 'p-error', title: 'This screen could not be drawn' },
        h('div', { class: 'empty' }, 'Something in the saved settings or in today\'s data stopped this screen. Resetting the settings usually fixes it; saved structures are kept.'),
        h('div', { class: 'row-actions' }, h('button', { class: 'btn primary', type: 'button', onclick: () => { try { localStorage.removeItem('egb-state'); } catch (x) { /* nothing to reset */ } location.hash = ''; location.reload(); } }, 'Reset settings and reload'),
          h('a', { href: '#home' }, 'Back to the brief'))));
      setTimeout(() => { throw e; });
    }
    root().replaceChildren(node);
    persist();
  }
  /** Open a section, optionally with a state patch (a selected structure, for instance). The address follows, so Back works. */
  function go(tab, patch) {
    if (!tabOK(tab)) tab = 'home';
    if (location.hash.replace('#', '').split('/')[0] !== tab) { try { history.pushState(null, '', '#' + tab); } catch (e) { location.hash = tab; } }
    S.last = Object.assign({}, S.last, { [spaceOf(tab)[0]]: tab });
    set(Object.assign({}, patch, { tab })); window.scrollTo(0, 0);
  }
  function fromHash() {
    const id = location.hash.replace('#', '').split('/')[0] || 'home';
    if (tabOK(id) && id !== S.tab) { S.last = Object.assign({}, S.last, { [spaceOf(id)[0]]: id }); set({ tab: id }); window.scrollTo(0, 0); }
  }
  /** Business days from one ISO date to another (weekends only: holidays are not known here). */
  function bizDays(a, b) { let n = 0; for (let d = parseD(a); d < parseD(b);) { d = new Date(+d + 864e5); if (d.getUTCDay() % 6) n++; } return n; }

  async function loadJSON(name) { try { const r = await fetch('data/' + name + '.json', { cache: 'no-cache' }); return r.ok ? await r.json() : null; } catch (e) { return null; } }

  async function start() {
    for (const c of ORDER) COL[c] = css('--c-' + c);
    Object.assign(COL, { up: css('--up'), down: css('--down'), flat: css('--flat'), ink: css('--ink'), ink2: css('--ink-2'), ink3: css('--ink-3'), rule: css('--rule'), axis: css('--axis'), surface: css('--surface') });
    const [market, auctions, news, events, sources, futures] = await Promise.all(['market', 'auctions', 'news', 'events', 'sources', 'futures'].map(loadJSON));
    Object.assign(DATA, { market, auctions, news, events, sources, futures });
    if (!market || !market.series || !market.series.length) {
      root().replaceChildren(h('div', { class: 'grid' }, panel({ id: 'p-missing', title: 'Market data did not load' },
        h('div', { class: 'empty' }, 'The page could not read its data file, so there is nothing to show yet. Check the connection and reload. If it still fails, the daily update may be running: try again in a few minutes.'),
        h('div', { class: 'row-actions' }, h('button', { class: 'btn primary', type: 'button', onclick: () => location.reload() }, 'Reload')))));
      return;
    }
    U = buildUniverse(market); BYID = new Map(U.map(u => [u.id, u])); initLab(market);
    const avail = availCountries();
    S.countries = (S.countries || avail).filter(c => avail.includes(c)); if (!S.countries.length) S.countries = avail;
    const tn = tenorsAvail(); if (!tn.includes(S.tenor)) S.tenor = tn.includes(10) ? 10 : tn[tn.length - 1];
    const id = location.hash.replace('#', '').split('/')[0]; S.tab = tabOK(id) ? id : 'home';      // no address: open on the brief
    const last = lastDate(), st = market.status || '', gap = bizDays(last, new Date().toISOString().slice(0, 10));
    document.getElementById('asof').replaceChildren(h('span', { class: 'pre' }, 'Fixings of '), h('b', null, fDow(parseD(last))));
    const warn = market.private ? 'Private version' : /Not refreshed/.test(st) ? 'Partial update' : gap > 4 ? 'Data may be out of date' : '';
    document.getElementById('status').replaceChildren(...(warn ? [h('span', { class: 'pill warn', title: st }, warn)] : []));
    document.getElementById('foot').replaceChildren(h('p', null, market.footer || ''),
      h('p', null, st ? st + ' ' : '', 'Built by Arthur Marc. ', h('a', { href: REPO, target: '_blank', rel: 'noopener' }, 'Code and data pipeline on GitHub'), '. ', h('a', { href: '#sources' }, 'Sources and methods'), '.'));
    render();
    window.addEventListener('hashchange', fromHash); window.addEventListener('popstate', fromHash);
    let w = root().clientWidth, timer = null;
    new ResizeObserver(() => { const nw = root().clientWidth; if (nw === w) return; w = nw; clearTimeout(timer); timer = setTimeout(() => redraws.forEach(fn => fn()), 120); }).observe(root());
  }
  start();
})();
