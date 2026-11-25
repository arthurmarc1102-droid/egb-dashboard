  // ===================================================================== 7.0 brief: the last close in one screen
  // Every word and every number of the closing note is produced from the data files when the page loads.
  // Nothing is typed by hand, nothing is a forecast or an opinion. tests/ recomputes the same sentences in Python.
  const BOND = { DE: 'Bunds', FR: 'OATs', IT: 'BTPs', ES: 'Bonos', NL: 'DSLs', BE: 'OLOs', AT: 'RAGBs', PT: 'PGBs' };
  const REPO = 'https://github.com/arthurmarc1102-droid/egb-dashboard';
  const fDowS = d3.utcFormat('%a %d %b'), fMonY = d3.utcFormat('%b %Y');
  const lastOf = s => s.values[s.values.length - 1], dateOf = s => s.dates[s.dates.length - 1];
  const still = x => Math.abs(x) < 0.05;                             // a move below a twentieth of a basis point reads as unchanged
  const trim1 = x => { const s = Math.abs(x).toFixed(1); return s.endsWith('.0') ? s.slice(0, -2) : s; };
  const bpw = x => trim1(x) + ' bp';                                 // size of a move, in words: 4 bp, 6.5 bp
  const lv = x => (x < 0 && Number(Math.abs(x).toFixed(1)) !== 0 ? MINUS : '') + trim1(x);   // a level in bp: 26, 145.6, −5

  /** The benchmark curve of one country in one sentence, from the day's moves in its 2-year and 10-year yields.
      Desk vocabulary: bull = yields lower, bear = yields higher; steeper or flatter = 2s10s wider or narrower;
      twist = the two ends move by at least 1 bp in opposite directions; parallel = 2s10s unchanged. */
  function closeSentence(c) {
    const b = inst(`${c}_10Y`), a = inst(`${c}_2Y`), sl = inst(`${c}_2s10s`);
    if (!b || b.values.length < 2) return null;
    const d10 = change(b, 1);
    const ten = still(d10) ? `the 10-year yield was unchanged at ${level(b)} %` : `the 10-year yield ${d10 < 0 ? 'fell' : 'rose'} ${bpw(d10)} to ${level(b)} %`;
    const late = dateOf(b) < lastDate() ? ` Data to ${fShort(parseD(dateOf(b)))}.` : '';          // this curve has no value yet for the page's close
    if (!a || !sl || dateOf(a) !== dateOf(b)) return `${BOND[c]}${still(d10) ? '' : d10 < 0 ? ' rallied' : ' sold off'}: ${ten}.${late}`;   // one point only: no verdict on the whole curve when it did not move
    const d2 = change(a, 1), ds = change(sl, 1), mid = (d2 + d10) / 2, shape = still(ds) ? '' : ds > 0 ? 'steepened' : 'flattened';
    let verb;
    if (still(d2) && still(d10)) verb = '';                                  // other maturities may have moved: state the two facts, no verb
    else if (d2 * d10 < 0 && Math.abs(d2) >= 0.95 && Math.abs(d10) >= 0.95) verb = 'twist-' + shape;
    else if (!shape) verb = (mid < 0 ? 'rallied' : 'sold off') + ' in a parallel move';
    else verb = still(mid) ? shape : (mid < 0 ? 'bull-' : 'bear-') + shape;
    return `${BOND[c]}${verb ? ' ' + verb : ''}: ${ten}, 2s10s ${still(ds) ? 'unchanged' : bpw(ds) + (ds > 0 ? ' steeper' : ' flatter')} at ${lv(lastOf(sl))} bp.${late}`;
  }
  /** Spread of one country to Germany: level, move of the day, z-score on the selected window. */
  function spreadSentence(c, n) {
    const u = inst(`${c}-${REF}_10Y`) || U.find(x => x.cat === 'spread' && x.country === c);
    if (!u || u.values.length < 2) return null;
    const st = stats(u, n), d = change(u, 1);
    return { u, text: `${u.tenor}-year spread to Germany ${lv(st.last)} bp, ${still(d) ? 'unchanged' : bpw(d) + (d > 0 ? ' wider' : ' tighter')}` +
      (Number.isFinite(st.z) ? `, ${S.win} z-score ${num(st.z, 2, true)}` : '') + (dateOf(u) < lastDate() ? `. Data to ${fShort(parseD(dateOf(u)))}.` : '.') };
  }
  /** Long end and belly of one curve. A butterfly that rises means the body yield rose against the wings: the belly cheapened. */
  function shapeSentence(c) {
    const s = inst(`${c}_5s30s`) || inst(`${c}_10s30s`), f = inst(`${c}_2s5s10s`) || U.find(x => x.cat === 'fly' && x.country === c), parts = [];
    if (s && s.values.length > 1) { const d = change(s, 1); parts.push(`${s.legs} ${lv(lastOf(s))} bp, ${still(d) ? 'unchanged' : bpw(d) + (d > 0 ? ' steeper' : ' flatter')}`); }
    if (f && f.values.length > 1) { const d = change(f, 1); parts.push(`${f.legs} fly ${lv(lastOf(f))} bp, ${still(d) ? 'unchanged' : 'belly ' + bpw(d) + (d > 0 ? ' cheaper' : ' richer')}`); }
    return parts.length ? `${COUNTRIES[c]} ${parts.join('; ')}.` : null;
  }
  /** Text to nodes, keeping "10-year", "4 bp", "3.31 %" and "3M z-score +0.73" unbroken at line ends. */
  function nb(text) {
    const out = []; let i = 0;
    for (const m of text.matchAll(/\d+-year|(?:\d+[MY] )?z-score [\u2212+]?\d+(?:\.\d+)?|[\u2212+]?\d+(?:\.\d+)? (?:bp|%)/g)) { if (m.index > i) out.push(text.slice(i, m.index)); out.push(h('span', { style: 'white-space:nowrap' }, m[0])); i = m.index + m[0].length; }
    if (i < text.length) out.push(text.slice(i));
    return out;
  }
  const stretched = n => visible().filter(u => u.cat !== 'outright').map(u => ({ u, st: stats(u, n) })).filter(o => Number.isFinite(o.st.z)).sort((a, b) => Math.abs(b.st.z) - Math.abs(a.st.z));
  function futureSentence() {
    const F = DATA.futures, p = F && F.products && F.products.find(x => x.code === 'FGBL'), c0 = p && p.contracts[0]; if (!c0) return null;
    const ctd = (c0.basket || []).find(x => x.ctd);
    return `Bund future ${c0.label} settled at ${num(c0.settle, 2)}` + (ctd ? `; cheapest to deliver ${num(ctd.coupon, 2)}% ${fMonY(parseD(ctd.maturity))}, implied repo ${num(ctd.implied_repo, 2)} %` : '') +
      (F.asof && F.asof !== lastDate() ? ` (settlement of ${fShort(parseD(F.asof))})` : '') + '.';
  }

  // ---------- what comes next: auctions of the selected countries, the next ECB decision, first-tier euro-area data
  const KEY_DATA = /inflation|HICP|GDP|unemployment|sentiment/i;
  const todayISO = () => new Date().toISOString().slice(0, 10);
  const daysTo = iso => Math.round((parseD(iso) - parseD(todayISO())) / 864e5);
  const inDays = iso => { const k = daysTo(iso); return k <= 0 ? 'today' : k === 1 ? 'tomorrow' : `in ${k} days`; };
  function keyEvents() {
    const up = allEvents().filter(e => e.date >= todayISO());
    return [...up.filter(e => e.kind === 'Auction').slice(0, 3), ...up.filter(e => e.kind === 'ECB').slice(0, 1), ...up.filter(e => e.kind === 'Data' && KEY_DATA.test(e.title)).slice(0, 3)]
      .sort((a, b) => a.date.localeCompare(b.date));
  }
  function nextSentence() {
    const ev = keyEvents(), first = ev.find(e => e.kind !== 'ECB'), ecb = ev.find(e => e.kind === 'ECB'), parts = [];
    if (first) parts.push(`${first.title}${first.size ? ', ' + first.size : ''}, ${daysTo(first.date) > 1 ? 'on ' + fDowS(parseD(first.date)) : inDays(first.date)}.`);
    if (ecb) parts.push(`ECB decision on ${fDowS(parseD(ecb.date))}, ${inDays(ecb.date)}.`);
    return parts.join(' ') || null;
  }
  function panelNext(span) {
    const ev = keyEvents();
    return panel({ id: 'p-next', span, title: 'What comes next', sub: 'supply, ECB, first-tier data', tools: h('a', { href: '#blotter' }, 'Full calendar'),
      foot: 'Auctions of the selected countries, the next ECB decision, and euro-area inflation, GDP, unemployment and sentiment releases.' },
      ev.length ? h('div', { class: 'feed short' }, ev.map(e => h('div', { class: 'item' }, h('span', { class: 'when' }, fDowS(parseD(e.date))),
        h('span', { class: 'what' }, e.url ? h('a', { href: e.url, target: '_blank', rel: 'noopener' }, e.title) : e.title),
        h('span', { class: 'who' }, [e.kind, e.size, inDays(e.date)].filter(Boolean).join(', ')))))
        : h('div', { class: 'empty' }, 'No upcoming event is loaded. The calendar refreshes with the daily update.'));
  }

  // ---------- largest moves of the day, measured against the usual size of a daily move
  /** Last daily change in bp, and the same in standard deviations of the last n daily changes (today's included). */
  function dayMove(u, n) {
    const L = u.values.length, k = u.unit === 'pct' ? 100 : 1; if (L < 22) return null;
    const ch = []; for (let i = Math.max(1, L - n); i < L; i++) ch.push((u.values[i] - u.values[i - 1]) * k);
    const sd = d3.deviation(ch), d1 = ch[ch.length - 1];
    return ch.length >= 20 && sd > 0 ? { d1, sd, score: d1 / sd } : null;
  }
  /** One row per family (a country's benchmark yields, its spreads to Germany, its slopes): the family's largest move, then the k largest of those.
      Without the grouping, five maturities of one curve moving together would fill the list. */
  function movers(n, k) {
    const close = lastDate(), best = new Map();
    for (const u of visible()) {
      if (!(u.cat === 'slope' || ((u.cat === 'outright' || u.cat === 'spread') && HEADLINE.includes(u.tenor))) || dateOf(u) !== close) continue;
      const m = dayMove(u, n); if (!m || still(m.d1)) continue;
      const key = u.country + ' ' + u.cat, cur = best.get(key);
      if (!cur || Math.abs(m.score) > Math.abs(cur.m.score)) best.set(key, { u, m });
    }
    return [...best.values()].sort((a, b) => Math.abs(b.m.score) - Math.abs(a.m.score)).slice(0, k);
  }
  function panelMovers(span) {
    const n = WINDOWS[S.win], list = movers(n, 5);
    return panel({ id: 'p-movers', span, title: 'Largest moves of the day', sub: `the biggest in each family, against its usual daily move`,
      foot: `Families: a country's 2, 5, 10 and 30-year yields, its spreads to Germany, its slopes. Std dev = 1-day change divided by the standard deviation of the last ${n} daily changes. Butterflies and boxes are left out because German yields are published to the basis point.` },
      list.length ? h('div', { class: 'scroll' }, h('table', { class: 't' },
        h('thead', null, h('tr', null, ['Structure', 'Level', '1D bp', 'Std dev'].map(x => h('th', null, x)))),
        h('tbody', null, list.map(({ u, m }) => h('tr', { class: 'click', onclick: () => go('rv', { rvSel: u.id, rvCat: 'all' }) },
          h('td', null, h('span', { class: 'name' }, u.name)), h('td', { class: 'lvl' }, level(u), h('span', { class: 'muted' }, ' ' + unitLabel(u))),
          heatCell(bp(m.d1), m.d1, HEAT_BP['1D']), h('td', null, num(m.score, 1, true)))))))
        : h('div', { class: 'empty' }, 'No move to rank: the selected countries have no new close, or less than a month of history.'));
  }

  // ---------- curve ladder: the curves at the close, with the table underneath sharing the chart's columns
  const LADDER = [1, 2, 3, 5, 7, 10, 15, 20, 30];
  const ladderTenors = (cs, narrow) => {
    const t = (narrow ? [2, 5, 10, 30] : LADDER).filter(x => cs.some(c => inst(`${c}_${x}Y`)));
    return t.length >= 2 ? t : tenorsAvail().filter(x => cs.some(c => inst(`${c}_${x}Y`))).slice(0, narrow ? 4 : 9);
  };
  /** Each maturity is a band of equal width: the dot of the chart sits right above its yield and its change in the table. */
  function ladder(host, cs) {
    host.replaceChildren(); host.classList.add('chart');
    const W = Math.max(280, Math.floor(host.clientWidth || 640)), narrow = W < 560, tenors = ladderTenors(cs, narrow), hz = HORIZONS[S.horizon];
    const lab = narrow ? 60 : 118, cw = (W - lab) / tenors.length, H = narrow ? 170 : 216, m = { t: 14, b: 10 }, X = i => lab + (i + 0.5) * cw;
    const rows = cs.map(c => ({ c, p: tenors.map((t, i) => { const u = inst(`${c}_${t}Y`); return u ? { i, t, u, v: lastOf(u), d: change(u, hz) } : null; }) })).filter(r => r.p.some(Boolean));
    const vals = rows.flatMap(r => r.p.filter(Boolean).map(p => p.v)); let lo = d3.min(vals), hi = d3.max(vals); if (lo === hi) { lo -= .1; hi += .1; }
    const pad = (hi - lo) * .1, y = d3.scaleLinear().domain([lo - pad, hi + pad]).range([H - m.b, m.t]), yt = y.ticks(4), yf = y.tickFormat(4);
    const svg = d3.select(host).append('svg').attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', 'Yield curves at the close, one column per maturity');
    const band = svg.append('rect').attr('y', 0).attr('height', H).attr('width', cw).attr('fill', COL.ink).attr('opacity', 0);
    svg.append('g').selectAll('line').data(yt).join('line').attr('x1', lab).attr('x2', W).attr('y1', d => Math.round(y(d)) + .5).attr('y2', d => Math.round(y(d)) + .5).attr('stroke', COL.rule);
    svg.append('g').selectAll('text').data(yt).join('text').attr('class', 'tick').attr('x', lab - 10).attr('y', d => y(d)).attr('dy', '.32em').attr('text-anchor', 'end').text(d => signFix(yf(d)) + ' %');
    const line = d3.line().x(p => X(p.i)).y(p => y(p.v));
    for (const r of rows) {
      const pts = r.p.filter(Boolean);
      svg.append('path').attr('d', line(pts)).attr('fill', 'none').attr('stroke', COL[r.c]).attr('stroke-width', 2).attr('stroke-linejoin', 'round').attr('stroke-linecap', 'round');
      svg.append('g').selectAll('circle').data(pts).join('circle').attr('cx', p => X(p.i)).attr('cy', p => y(p.v)).attr('r', 4).attr('fill', COL[r.c]).attr('stroke', COL.surface).attr('stroke-width', 2);
    }
    // the table: one column per band, so numbers line up under the dots
    const cols = tenors.map(() => []), keep = (i, el) => { cols[i].push(el); el.addEventListener('pointerenter', () => on(i, false)); return el; };
    const table = h('table', { class: 't ladder-t', style: `width:${W}px` }, h('colgroup', null, h('col', { style: `width:${lab}px` }), tenors.map(() => h('col'))),
      h('thead', null, h('tr', null, h('th', null, 'Maturity'), tenors.map((t, i) => keep(i, h('th', null, t + 'Y'))))),
      h('tbody', null, rows.map(r => [
        h('tr', { class: 'lv' }, h('td', null, narrow ? ctry(r.c) : ctryRow(r.c)), r.p.map((p, i) => keep(i, p ? h('td', { class: 'lvl' }, level(p.u)) : h('td', { class: 'muted' }, DASH)))),
        h('tr', { class: 'chg' }, h('td', { class: 'muted' }, S.horizon + ', bp'), r.p.map((p, i) => keep(i, p ? heatCell(bp(p.d), p.d, HEAT_BP[S.horizon]) : h('td', { class: 'muted' }, DASH))))])));
    host.append(table);
    const tip = tooltip(host); let cur = -1;
    function on(i, withTip) {
      if (i !== cur) { if (cur >= 0) cols[cur].forEach(el => el.classList.remove('col-on')); cur = i; if (i >= 0) cols[i].forEach(el => el.classList.add('col-on')); }
      band.attr('x', lab + Math.max(0, i) * cw).attr('opacity', i >= 0 ? .06 : 0);
      if (i >= 0 && withTip) tip.show(X(i), rows.map(r => (r.p[i] ? { color: COL[r.c], name: COUNTRIES[r.c], value: `${level(r.p[i].u)} %, ${bp(r.p[i].d)} bp` } : null)).filter(Boolean), `${tenors[i]}-year, change over ${S.horizon}`);
      else tip.hide();
    }
    svg.append('rect').attr('x', lab).attr('y', 0).attr('width', W - lab).attr('height', H).attr('fill', 'transparent')
      .on('pointermove', ev => on(Math.max(0, Math.min(tenors.length - 1, Math.floor((d3.pointer(ev, svg.node())[0] - lab) / cw))), true))
      .on('pointerdown', ev => on(Math.max(0, Math.min(tenors.length - 1, Math.floor((d3.pointer(ev, svg.node())[0] - lab) / cw))), true))
      .on('pointerleave', () => on(-1, false));
    table.addEventListener('pointerleave', () => on(-1, false));
  }
  function panelLadder(span) {
    const cs = DC(), host = h('div');
    mount(host, el => ladder(el, cs));
    return panel({ id: 'p-ladder', span, title: 'Curves at the close', sub: `yield in %, change over ${S.horizon} in bp`,
      tools: [seg(Object.keys(HORIZONS).map(k => [k, k]), S.horizon, v => set({ horizon: v }), 'Change horizon'),
        csvButton('curves_at_close', () => { const t = ladderTenors(cs, false); return { head: ['country', 'measure', ...t.map(x => x + 'Y')],
          rows: cs.flatMap(c => [[c, 'yield_pct', ...t.map(x => { const u = inst(`${c}_${x}Y`); return u ? lastOf(u) : ''; })], [c, 'change_bp_' + S.horizon, ...t.map(x => { const u = inst(`${c}_${x}Y`); return u ? +change(u, HORIZONS[S.horizon]).toFixed(2) : ''; })]]) }; })],
      foot: (sourceLine(U.filter(u => u.cat === 'outright' && cs.includes(u.country)).flatMap(u => u.src)) + (cs.length > 1 ? ' The curves are not built the same way: see Sources.' : '')).trim() }, host);
  }

  // ---------- futures, auction results and headlines, in short
  function panelFuturesMini(span) {
    const F = DATA.futures;
    if (!F || !F.products || !F.products.length) return panel({ id: 'p-fut-mini', span, title: 'Bond futures' }, h('div', { class: 'empty' }, 'Futures data is not loaded. It comes back with the next daily update.'));
    const rows = F.products.filter(p => p.contracts.length).map(p => { const c = p.contracts[0], ctd = (c.basket || []).find(x => x.ctd);
      return h('tr', { class: 'click', onclick: () => go('futures', { futSel: p.code + ' ' + c.label }) }, h('td', null, h('span', { class: 'name' }, p.name), ' ', h('span', { class: 'muted' }, c.label)), h('td', { class: 'lvl' }, num(c.settle, 2)),
        h('td', null, ctd ? `${num(ctd.coupon, 2)}% ${fMonY(parseD(ctd.maturity))}` : DASH), h('td', null, ctd ? num(ctd.implied_repo, 2) + ' %' : DASH), h('td', null, ctd ? num(ctd.net_basis, 3) : DASH)); });
    return panel({ id: 'p-fut-mini', span, title: 'Bond futures', sub: F.asof ? 'Eurex settlement, ' + day(F.asof) : null, tools: h('a', { href: '#futures' }, 'Baskets and basis'),
      foot: 'Cheapest to deliver = highest implied repo. Basis is indicative: bond prices are midday reference prices, futures settle at 17:15 CET.' },
      h('div', { class: 'scroll' }, h('table', { class: 't' }, h('thead', null, h('tr', null, ['Front contract', 'Settle', 'Cheapest to deliver', 'Implied repo', 'Net basis'].map(x => h('th', null, x)))), h('tbody', null, rows))));
  }
  function panelResultsMini(span) {
    const A = DATA.auctions, res = A ? (A.results || []).filter(a => shown(a.country)).slice(0, 4) : [];
    return panel({ id: 'p-results-mini', span, title: 'Latest auctions', tools: h('a', { href: '#auctions' }, 'All results') },
      res.length ? h('div', { class: 'feed short' }, auctionRows(res, false)) : h('div', { class: 'empty' }, A ? 'No auction result for the selected countries.' : 'Auction data is not loaded yet.'));
  }
  function panelHeadlines(span) {
    const N = DATA.news, items = N && N.items ? N.items.slice(0, 5) : [];
    return panel({ id: 'p-headlines', span, title: 'Official headlines', tools: h('a', { href: '#blotter' }, 'All') },
      items.length ? h('div', { class: 'feed short' }, newsRows(items)) : h('div', { class: 'empty' }, 'News feeds are not loaded yet.'));
  }

  function viewHome() {
    const dc = DC(), n = WINDOWS[S.win], focus = dc.includes(REF) ? REF : dc[0];
    if (!focus) return h('div', { class: 'grid' },
      panel({ id: 'p-note', span: 's12', title: 'Closing note' }, h('div', { class: 'empty' }, `The note needs daily yields, which are loaded for ${dailyNames()} only. Select one of them in Countries.`)),
      panelNext('s4'), panelResultsMini('s4'), panelHeadlines('s4'));
    const lines = [], link = (label, tab, patch) => h('a', { href: '#' + tab, onclick: e => { e.preventDefault(); go(tab, patch); } }, label);
    for (const c of dc) if (c !== focus && c !== REF) { const s = spreadSentence(c, n); if (s) lines.push([COUNTRIES[c], link(COUNTRIES[c], 'rv', { rvSel: s.u.id, rvCat: 'all' }), s.text]); }
    const shape = shapeSentence(focus); if (shape) lines.push(['Curve', link('Curve', 'curves'), shape]);
    const top = stretched(n)[0];
    if (top) lines.push(['Stretched', link('Stretched', 'rv', { rvSel: top.u.id, rvCat: 'all' }), `${top.u.name} is the most stretched level on a ${S.win} window: z-score ${num(top.st.z, 2, true)}, percentile ${num(top.st.pct, 0)}.`]);
    const fut = futureSentence(); if (fut) lines.push(['Futures', link('Futures', 'futures'), fut]);
    const nxt = nextSentence(); if (nxt) lines.push(['Next', link('Next', 'blotter'), nxt]);
    const note = h('section', { class: 'panel note s5', id: 'p-note' },
      h('h2', { class: 'kicker' }, 'Closing note, ' + fDow(parseD(lastDate()))),
      h('p', { class: 'headline' }, nb(closeSentence(focus) || `${COUNTRIES[focus]}: not enough history for a closing sentence.`)),
      h('dl', { class: 'lines' }, lines.map(([k, label, text]) => [h('dt', null, label), h('dd', { 'data-k': k }, nb(text))])),
      h('p', { class: 'by' }, 'Written by the page from the data at each load. It describes the close; it is not a forecast or a recommendation.'));
    return h('div', { class: 'grid' }, note, panelLadder('s7'), panelMovers('s4'), panelExtremes('s4', 6), panelNext('s4'), panelFuturesMini('s8'), panelResultsMini('s6'), panelHeadlines('s6'));
  }
