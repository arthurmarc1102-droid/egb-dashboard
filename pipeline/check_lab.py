"""Independent Python implementation of the lab calculations (backtest, PCA, carry and roll-down, Nelson-Siegel, custom structures),
written from the rules stated on the page, not from its code. Used to check the page: python3 pipeline/check_lab.py data/market.json case.json"""
import json, math, sys
import numpy as np

M = json.load(open(sys.argv[1]))
Y = {}; MM = {}
for s in M["series"]:
    if s["group"] == "yield": Y.setdefault(s["country"], {})[s["tenor"]] = dict(zip(s["dates"], s["values"]))
    if s["group"] == "mm": MM[s["id"]] = dict(zip(s["dates"], s["values"]))

def join(maps):
    ds = [d for d in sorted(maps[0]) if all(d in m for m in maps)]; return ds, np.array([[m[d] for m in maps] for d in ds])

def structure(legs):  # legs: [(country, tenor, weight)] on yields in %, result in bp
    ds, X = join([Y[c][t] for c, t, w in legs]); return ds, X @ np.array([w for *_, w in legs]) * 100

def backtest(d, v, win, entry, exit_, stop, max_hold, cost, side="both", mode="revert", lag=1):
    L = len(v); z = np.full(L, np.nan)
    for i in range(win - 1, L):
        w = v[i - win + 1:i + 1]; sd = w.std(ddof=1)
        if sd > 0: z[i] = (v[i] - w.mean()) / sd
    start, to = win - 1, L - 1; trades = []; dirn = 0; ie = -1; t = start
    ok = lambda s: side == "both" or (side == "long" and s > 0) or (side == "short" and s < 0)
    while t <= to:
        zt = z[t]
        if not np.isnan(zt):
            if dirn == 0:
                if t + lag > to: break
                s = 0
                if abs(zt) >= entry: s = (1 if zt > 0 else -1) * (1 if mode == "trend" else -1)
                if s and ok(s): dirn = s; ie = t + lag; trades.append(dict(dir=s, ie=ie))
            elif t >= ie:
                zz = zt * dirn if mode == "trend" else -zt * dirn; why = None
                if zz <= exit_: why = "target"
                elif mode != "trend" and stop > 0 and zz >= stop: why = "stop"
                elif max_hold > 0 and t - ie >= max_hold: why = "time"
                if why and t + lag <= to:
                    x = t + lag; trades[-1].update(ix=x, why=why, pnl=dirn * (v[x] - v[ie]) - cost, days=x - ie); dirn = 0; t = x; continue
        t += 1
    if trades and "ix" not in trades[-1]:
        tr = trades[-1]; tr.update(ix=to, why="open", pnl=tr["dir"] * (v[to] - v[tr["ie"]]) - cost, days=to - tr["ie"])
    pos = np.zeros(L)
    for tr in trades: pos[tr["ie"] + 1: tr["ix"] + 1] = tr["dir"]
    costs = np.zeros(L)
    for tr in trades: costs[tr["ix"]] += cost
    daily = np.zeros(to - start + 1)
    for k, i in enumerate(range(start + 1, to + 1), 1): daily[k] = pos[i] * (v[i] - v[i - 1]) - costs[i]
    eq = np.cumsum(daily); mdd = float(np.min(eq - np.maximum.accumulate(eq)))
    n = len(trades); wins = sum(tr["pnl"] > 0 for tr in trades)
    return dict(total=float(eq[-1]), trades=n, hit=wins / n * 100 if n else None, avg=float(np.mean([tr["pnl"] for tr in trades])) if n else None,
                days=float(np.mean([tr["days"] for tr in trades])) if n else None, mdd=mdd, sharpe=float(daily[1:].mean() / daily[1:].std(ddof=1) * math.sqrt(252)),
                inmarket=float((pos[start:to + 1] != 0).mean() * 100))

def pca(c, n):
    ts = sorted(Y[c]); ds, X = join([Y[c][t] for t in ts]); dX = np.diff(X, axis=0)[-n:] * 100
    C = np.cov(dX, rowvar=False); val, vec = np.linalg.eigh(C); o = np.argsort(val)[::-1]; val, vec = val[o], vec[:, o]
    if vec[:, 0].sum() < 0: vec[:, 0] *= -1
    if vec[-1, 1] - vec[0, 1] < 0: vec[:, 1] *= -1
    if vec[1:-1, 2].mean() - (vec[0, 2] + vec[-1, 2]) / 2 < 0: vec[:, 2] *= -1
    lv = X[-n:] * 100; x = lv - lv.mean(axis=0); f = x @ vec[:, :3]; res = x - f @ vec[:, :3].T
    rz = (res[-1] - res.mean(axis=0)) / res.std(axis=0, ddof=1)
    return ts, val / val.sum(), vec, res[-1], rz

def fly_weights(ts, vec, a, b, c):
    i, j, k = ts.index(a), ts.index(b), ts.index(c); A = np.array([[vec[i, 0], vec[k, 0]], [vec[i, 1], vec[k, 1]]]); wa, wc = np.linalg.solve(A, [vec[j, 0], vec[j, 1]])
    return 2 * wa, 2 * wc

def carry_roll(c, h):
    estr = MM["ESTR"]; fund = estr[max(estr)]; ts = sorted(Y[c]); y = np.array([Y[c][t][max(Y[c][t])] for t in ts]); out = []
    for t, yt in zip(ts, y):
        yd = yt / 100; D = (1 - (1 + yd) ** -t) / yd; carry = (yt - fund) * 100 * h / D
        r = t - h; roll = (yt - np.interp(r, ts, y)) * 100 if ts[0] <= r <= ts[-1] else None
        out.append((t, carry, roll))
    return out

def ns_residuals(c, n):
    ts = np.array(sorted(Y[c]), float); ds, X = join([Y[c][int(t)] for t in ts]); X = X[-n:]
    lams = 0.3 * (10 / 0.3) ** (np.arange(41) / 40); res = []
    for row in X:
        best = None
        for l in lams:
            x = ts / l; a = (1 - np.exp(-x)) / x; B = np.column_stack([np.ones_like(ts), a, a - np.exp(-x)])
            beta, *_ = np.linalg.lstsq(B, row, rcond=None); fit = B @ beta; sse = ((row - fit) ** 2).sum()
            if best is None or sse < best[0]: best = (sse, fit)
        res.append((row - best[1]) * 100)
    res = np.array(res); return ts, res[-1], (res[-1] - res.mean(0)) / res.std(0, ddof=1)

if __name__ == "__main__":
    case = json.load(open(sys.argv[2])); out = {}
    for k, b in case.get("backtests", {}).items():
        ds, v = structure(b["legs"]); q = b["p"]; out["bt_" + k] = backtest(ds, v, q["win"], q["entry"], q["exit"], q["stop"], q["maxHold"], q["cost"], q["side"], q["mode"], q["lag"])
    for c, n in case.get("pca", []):
        ts, share, vec, r, rz = pca(c, n); out[f"pca_{c}_{n}"] = dict(share=[float(x) for x in share[:3] * 100], resid=[float(x) for x in r], z=[float(x) for x in rz], fly_2_5_10=[float(x) for x in fly_weights(ts, vec, 2, 5, 10)] if {2, 5, 10} <= set(ts) else None, loadings=vec[:, :3].T.tolist())
    for c, h in case.get("carry", []):
        out[f"carry_{c}_{h}"] = [(t, float(ca), None if ro is None else float(ro)) for t, ca, ro in carry_roll(c, h)]
    for c, n in case.get("ns", []):
        ts, r, rz = ns_residuals(c, n); out[f"ns_{c}_{n}"] = dict(resid=[float(x) for x in r], z=[float(x) for x in rz])
    print(json.dumps(out))
