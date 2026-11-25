import json, sys
P = json.load(open(sys.argv[1])); Q = json.load(open(sys.argv[2])); bad = tot = 0
import re
def pn(s):
    m = re.search(r'[-+]?\d+(?:\.\d+)?', s.replace('−', '-'))
    return float(m.group(0)) if m and s.strip() not in ('–', '') else None
def cmp(label, page, py, tol):
    global bad, tot; tot += 1
    if page is None or py is None:
        ok = page is None and py is None
    else: ok = abs(page - py) <= tol
    if not ok: bad += 1; print('DIFF', label, page, py)
print('page errors:', P['errs'])
K = {'Total P&L': ('total', .051), 'Trades': ('trades', 0), 'Hit ratio': ('hit', .51), 'Average trade': ('avg', .051), 'Average holding': ('days', .51), 'Max drawdown': ('mdd', .051), 'Sharpe (daily, annualised)': ('sharpe', .0051), 'Time in market': ('inmarket', .51)}
for k in ('A', 'B', 'C', 'D'):
    pg, py = P['out']['bt_' + k], Q['bt_' + k]
    for lab, (key, tol) in K.items(): cmp(f'backtest {k} {lab}', pn(pg[lab]), py[key], tol)
    print(f'backtest {k}: page', {l: pg[l] for l in ('Total P&L', 'Trades', 'Hit ratio')}, '| python', round(py['total'], 2), py['trades'], round(py['hit'] or 0, 1))
for (c, w), n in ((('DE', '1Y'), 252), (('FR', '2Y'), 504)):
    pg, py = P['out'][f'pca_{c}_{w}'], Q[f'pca_{c}_{n}']
    shares = [float(x.split(' ')[1]) for x in pg['foot'].split('changes: ')[1].split(', first')[0].split(', ')]
    for q in range(3): cmp(f'PCA {c} share PC{q+1}', shares[q], py['share'][q], .051)
    for i, row in enumerate(pg['loadings']):
        for q in range(3): cmp(f'PCA {c} loading {row[0]} PC{q+1}', pn(row[q + 1]), py['loadings'][q][i], .0006)
    for i, row in enumerate(pg['resid']): cmp(f'PCA {c} residual {row[0]}', pn(row[1]), py['resid'][i], .051); cmp(f'PCA {c} residual z {row[0]}', pn(row[2]), py['z'][i], .0051)
    if py['fly_2_5_10']: fl = pg['fly'][0]; cmp(f'PCA {c} fly 2Y weight', pn(fl[1]), -py['fly_2_5_10'][0], .0006); cmp(f'PCA {c} fly 10Y weight', pn(fl[3]), -py['fly_2_5_10'][1], .0006)
    nsq = Q[f'ns_{c}_{n}']
    for i, row in enumerate(pg['ns']): cmp(f'NS {c} residual {row[0]}', pn(row[3]), nsq['resid'][i], .051); cmp(f'NS {c} z {row[0]}', pn(row[4]), nsq['z'][i], .0051)
cr = [r for r in P['out']['pca_DE_1Y']['carry']]
for c in ('DE', 'FR'):
    py = Q[f'carry_{c}_0.25']; rows = [r for r in cr if r[0].startswith(c)]
    for r, (t, ca, ro) in zip(rows, py):
        cmp(f'carry {c} {t}Y', pn(r[2]), ca, .051); cmp(f'roll {c} {t}Y', pn(r[3]), ro, .051)
# ---- the brief: every sentence and number against the independent Python version (exact text)
if len(sys.argv) > 3:
    H = json.load(open(sys.argv[3])); G = P['out']['home']
    def same(label, page, py):
        global bad, tot; tot += 1
        if page != py: bad += 1; print('DIFF', label, '| page:', page, '| python:', py)
    same('brief headline', G['headline'], H['headline'])
    for k, v in H['lines'].items():
        if v is not None: same('brief line ' + k, G['lines'].get(k), v)
    same('brief movers, order', [r[0] for r in G['movers']], [r[0] for r in H['movers']])
    for r, e in zip(G['movers'], H['movers']):
        for i, what in ((1, 'level'), (2, '1D'), (3, 'std dev')): same(f'brief mover {e[0]} {what}', r[i], e[i])
    same('brief z-scores, order', [r[0] for r in G['extremes']], [r[0] for r in H['extremes']])
    for r, e in zip(G['extremes'], H['extremes']): same(f'brief z-score {e[0]}', r[1], e[1])
    same('brief ladder maturities', G['tenors'], H['tenors'])
    for i, (r, e) in enumerate(zip(G['ladder'], H['ladder'])):
        for t, a_, b_ in zip(H['tenors'], r, e): same(f'brief ladder row {i} {t}', a_, b_)
    print('brief:', G['headline'])
print(f'{tot} figures compared, {bad} differences')
sys.exit(1 if bad or P['errs'] else 0)
