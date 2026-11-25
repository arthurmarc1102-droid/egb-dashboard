"""Independent Python implementation of the lab calculations (backtest, PCA, carry and roll-down, Nelson-Siegel, custom structures),
written from the rules stated on the page, not from its code. Used to check the page: python3 pipeline/check_lab.py data/market.json case.json"""
import bisect, json, math, sys
import datetime as dt
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

def zscores(v, win):
    L = len(v); z = np.full(L, np.nan)
    for i in range(win - 1, L):
        w = v[i - win + 1:i + 1]; sd = w.std(ddof=1)
        if sd > 0: z[i] = (v[i] - w.mean()) / sd
    return z

# ---- carry and roll-down through time: bp of yield per calendar day, for one constant-maturity yield
EST = MM.get("ESTR", {}); EST_D = sorted(EST)
def carry_per_day(c, t):
    out = {}; shorter = sorted((x for x in Y[c] if x < t), reverse=True)
    for d, y in Y[c][t].items():
        j = bisect.bisect_right(EST_D, d) - 1; s = next((x for x in shorter if d in Y[c][x]), None)
        if j < 0 or s is None: continue
        yd = y / 100; D = (1 - (1 + yd) ** -t) / yd if yd > 1e-9 else t        # par bond paying once a year; maturity when the yield is not positive
        out[d] = ((y - EST[EST_D[j]]) / D + (y - Y[c][s][d]) / (t - s)) * 100 / 365
    return out
def structure_carry(legs, ds):
    net = {}
    for c, t, w in legs: net[(c, t)] = net.get((c, t), 0) + w
    maps = [(w, carry_per_day(c, t)) for (c, t), w in net.items() if w]
    return np.array([sum(w * m[d] for w, m in maps) if all(d in m for _, m in maps) else np.nan for d in ds])
def days_between(a, b): return (dt.date.fromisoformat(b) - dt.date.fromisoformat(a)).days

def backtest(d, v, win, entry, exit_, stop, max_hold, cost, side="both", mode="revert", lag=1, lo=0, hi=None, cs=None, z=None):
    """cs: carry of one unit of the structure in bp per calendar day, by date (or None). A long position pays it."""
    L = len(v); z = zscores(v, win) if z is None else z
    acc = np.zeros(L); gap = np.zeros(L, bool); c0 = -1
    if cs is not None:
        fin = np.where(np.isfinite(cs))[0]
        if len(fin):
            c0 = int(fin[0])
            for i in range(1, L):
                if np.isfinite(cs[i - 1]): acc[i] = acc[i - 1] + cs[i - 1] * days_between(d[i - 1], d[i])
                else: acc[i] = acc[i - 1]; gap[i] = True
    use = c0 >= 0
    start, to = max(win - 1, lo, c0 if use else 0), (L - 1 if hi is None else hi); trades = []; dirn = 0; ie = -1; t = start
    ok = lambda s: side == "both" or (side == "long" and s > 0) or (side == "short" and s < 0)
    def close(tr, x, why):
        cy = -tr["dir"] * (acc[x] - acc[tr["ie"]]) if use else 0.0
        tr.update(ix=x, why=why, carry=cy, pnl=tr["dir"] * (v[x] - v[tr["ie"]]) + cy - cost, days=x - tr["ie"])
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
                    x = t + lag; close(trades[-1], x, why); dirn = 0; t = x; continue
        t += 1
    if trades and "ix" not in trades[-1]: close(trades[-1], to, "open")
    pos = np.zeros(L)
    for tr in trades: pos[tr["ie"] + 1: tr["ix"] + 1] = tr["dir"]
    costs = np.zeros(L)
    for tr in trades: costs[tr["ix"]] += cost
    daily = np.zeros(max(to - start + 1, 0))
    for k, i in enumerate(range(start + 1, to + 1), 1): daily[k] = pos[i] * ((v[i] - v[i - 1]) - (acc[i] - acc[i - 1])) - costs[i]
    eq = np.cumsum(daily); mdd = float(np.min(eq - np.maximum.accumulate(eq))) if len(eq) else 0.0
    n = len(trades); wins = sum(tr["pnl"] > 0 for tr in trades); sd = daily[1:].std(ddof=1) if len(daily) > 2 else 0.0
    return dict(total=float(eq[-1]) if len(eq) else 0.0, trades=n, hit=wins / n * 100 if n else None, avg=float(np.mean([tr["pnl"] for tr in trades])) if n else None,
                days=float(np.mean([tr["days"] for tr in trades])) if n else None, mdd=mdd, sharpe=float(daily[1:].mean() / sd * math.sqrt(252)) if sd > 0 else None,
                inmarket=float((pos[start:to + 1] != 0).mean() * 100) if to >= start else None, carry=float(sum(tr["carry"] for tr in trades)) if use else None,
                missing=int(sum(1 for i in range(start + 1, to + 1) if pos[i] and gap[i])) if use else 0, start=d[start] if start < L else None,
                daily=daily, pnls=[tr["pnl"] for tr in trades], carries=[tr["carry"] for tr in trades])

# ---- walk-forward: before each test block, the pair (z window, entry) with the best Sharpe ratio on the training span is kept
WF_WINS = [21, 63, 126, 252, 504]; WF_ENTS = [1, 1.5, 2, 2.5, 3]
def walk_forward(d, v, q, train, test, cs=None):
    L = len(v); to = L - 1; c0 = 0
    if cs is not None:
        fin = np.where(np.isfinite(cs))[0]; c0 = int(fin[0]) if len(fin) else 0
        if not len(fin): cs = None
    s0 = max(WF_WINS[-1] - 1, c0) + train; zc = {}
    def run(w, en, a, b, ex=None):
        if w not in zc: zc[w] = zscores(v, w)
        return backtest(d, v, w, en, min(q["exit"], en - 0.1) if ex is None else ex, q["stop"], q["maxHold"], q["cost"], q["side"], q["mode"], q["lag"], lo=a, hi=b, cs=cs, z=zc[w])
    def best(a, b, need):
        pick = None
        for w in WF_WINS:
            for en in WF_ENTS:
                r = run(w, en, a, b)
                if r["trades"] >= need and r["sharpe"] is not None and r["sharpe"] > (pick["sharpe"] + 1e-9 if pick else 0): pick = dict(win=w, entry=en, sharpe=r["sharpe"])
        return pick
    blocks = []; daily = []; pnls = []; carries = []; s = s0
    while s < to:
        e = min(s + test - 1, to); pick = best(s - train, s - 1, 3)
        if pick:
            r = run(pick["win"], pick["entry"], s, e); daily += list(r["daily"]); pnls += r["pnls"]; carries += r["carries"]
            blocks.append(dict(d[s:s + 1] and {"from": d[s], "to": d[e]}, win=pick["win"], entry=pick["entry"], sharpe=pick["sharpe"], trades=r["trades"], pnl=r["total"]))
        else:
            daily += [0.0] * (e - s + 1); blocks.append({"from": d[s], "to": d[e], "win": None, "entry": None, "sharpe": None, "trades": 0, "pnl": 0.0})
        s += test
    if not blocks: return dict(blocks=[])
    daily = np.array(daily); eq = np.cumsum(daily); sd = daily[1:].std(ddof=1)
    fixed = run(q["win"], q["entry"], s0, to, ex=q["exit"]); hp = best(s0, to, 1); hind = run(hp["win"], hp["entry"], s0, to) if hp else None
    return dict(blocks=blocks, total=float(eq[-1]), trades=len(pnls), hit=sum(x > 0 for x in pnls) / len(pnls) * 100 if pnls else None, sharpe=float(daily[1:].mean() / sd * math.sqrt(252)) if sd > 0 else None,
                mdd=float(np.min(eq - np.maximum.accumulate(eq))), traded=sum(b["win"] is not None for b in blocks), fixed=fixed["total"], hind=hind["total"] if hind else None,
                hind_pair=[hp["win"], hp["entry"]] if hp else None, carry=float(sum(carries)) if cs is not None else None, start=d[s0], end=d[to])

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
        ds, v = structure(b["legs"]); q = b["p"]
        r = backtest(ds, v, q["win"], q["entry"], q["exit"], q["stop"], q["maxHold"], q["cost"], q["side"], q["mode"], q["lag"], cs=structure_carry(b["legs"], ds) if q.get("carry") else None)
        out["bt_" + k] = {x: y for x, y in r.items() if x not in ("daily", "pnls", "carries")}
    for k, b in case.get("walkforward", {}).items():
        ds, v = structure(b["legs"]); q = b["p"]
        out["wf_" + k] = walk_forward(ds, v, q, b["wf"]["train"], b["wf"]["test"], structure_carry(b["legs"], ds) if q.get("carry") else None)
    for c, n in case.get("pca", []):
        ts, share, vec, r, rz = pca(c, n); out[f"pca_{c}_{n}"] = dict(share=[float(x) for x in share[:3] * 100], resid=[float(x) for x in r], z=[float(x) for x in rz], fly_2_5_10=[float(x) for x in fly_weights(ts, vec, 2, 5, 10)] if {2, 5, 10} <= set(ts) else None, loadings=vec[:, :3].T.tolist())
    for c, h in case.get("carry", []):
        out[f"carry_{c}_{h}"] = [(t, float(ca), None if ro is None else float(ro)) for t, ca, ro in carry_roll(c, h)]
    for c, n in case.get("ns", []):
        ts, r, rz = ns_residuals(c, n); out[f"ns_{c}_{n}"] = dict(resid=[float(x) for x in r], z=[float(x) for x in rz])
    print(json.dumps(out))
