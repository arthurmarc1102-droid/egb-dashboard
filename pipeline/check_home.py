"""Independent Python implementation of the brief (daily note, largest moves, z-scores, curve ladder),
written from the rules stated on the page, not from its code. Prints what the page should show, as JSON.
python3 pipeline/check_home.py data/market.json data/futures.json '{"countries": ["DE", "FR", "ES"], "win": 63, "label": "3M"}'"""
import datetime as dt, json, sys
from decimal import Decimal, ROUND_HALF_UP
import numpy as np

M = json.load(open(sys.argv[1])); F = json.load(open(sys.argv[2])); P = json.loads(sys.argv[3])
ORDER = ["DE", "FR", "IT", "ES", "NL", "BE", "AT", "PT"]
NAME = dict(DE="Germany", FR="France", IT="Italy", ES="Spain", NL="Netherlands", BE="Belgium", AT="Austria", PT="Portugal")
BOND = dict(DE="Bunds", FR="OATs", IT="BTPs", ES="Bonos", NL="DSLs", BE="OLOs", AT="RAGBs", PT="PGBs")
SLOPES = [(2, 10), (5, 30), (2, 5), (5, 10), (10, 30), (2, 30)]; FLIES = [(2, 5, 10), (5, 10, 30), (2, 10, 30), (5, 7, 10), (10, 15, 30), (10, 20, 30)]
HEADLINE = [2, 5, 10, 30]; LADDER = [1, 2, 3, 5, 7, 10, 15, 20, 30]; MINUS, DASH = "−", "–"

# ---- number formats of the page: fixed decimals with halves rounded away from zero, a true minus sign
def fx(x, d): return str(Decimal(abs(float(x))).quantize(Decimal(1).scaleb(-d), rounding=ROUND_HALF_UP))
def num(x, d, sign=False):
    s = fx(x, d); zero = float(s) == 0
    return (MINUS if x < 0 and not zero else ("+" if sign and not zero else "")) + s
def bp(x): return num(x, 1, True)
def trim1(x): s = fx(x, 1); return s[:-2] if s.endswith(".0") else s
def bpw(x): return trim1(x) + " bp"
def lv(x): return (MINUS if x < 0 and float(fx(x, 1)) != 0 else "") + trim1(x)
def still(x): return abs(x) < 0.05
def short(iso): return dt.date.fromisoformat(iso).strftime("%d %b")

# ---- universe: yields, spreads to Germany, slopes, butterflies, boxes
Y = {}
for s in M["series"]:
    if s["group"] == "yield": Y.setdefault(s["country"], {})[s["tenor"]] = (dict(zip(s["dates"], s["values"])), s["decimals"])
def joined(maps, fn):
    ds = [d for d in sorted(maps[0]) if all(d in m for m in maps)]; return ds, [fn(*[m[d] for m in maps]) for d in ds]
U = []
def add(**k):
    if len(k["values"]) > 1: U.append(k)
y = lambda c, t: Y[c][t][0]
for c in ORDER:
    for t in sorted(Y.get(c, {})):
        ds = sorted(y(c, t)); add(id=f"{c}_{t}Y", name=f"{c} {t}Y", cat="outright", country=c, tenor=t, unit="pct", dec=Y[c][t][1], dates=ds, values=[y(c, t)[d] for d in ds])
for c in ORDER:
    if c != "DE":
        for t in sorted(Y.get(c, {})):
            if t in Y["DE"]: ds, v = joined([y(c, t), y("DE", t)], lambda a, b: (a - b) * 100); add(id=f"{c}-DE_{t}Y", name=f"{c}{DASH}DE {t}Y", cat="spread", country=c, tenor=t, unit="bp", dates=ds, values=v)
for c in ORDER:
    for a, b in SLOPES:
        if a in Y.get(c, {}) and b in Y[c]: ds, v = joined([y(c, a), y(c, b)], lambda p, q: (q - p) * 100); add(id=f"{c}_{a}s{b}s", name=f"{c} {a}s{b}s", cat="slope", country=c, legs=f"{a}s{b}s", unit="bp", dates=ds, values=v)
for c in ORDER:
    for a, b, d in FLIES:
        if all(k in Y.get(c, {}) for k in (a, b, d)): ds, v = joined([y(c, a), y(c, b), y(c, d)], lambda p, q, r: (2 * q - p - r) * 100); add(id=f"{c}_{a}s{b}s{d}s", name=f"{c} {a}s{b}s{d}s", cat="fly", country=c, legs=f"{a}s{b}s{d}s", unit="bp", dates=ds, values=v)
for c in ORDER:
    if c != "DE":
        for a, b in SLOPES:
            if all(k in Y.get(c, {}) for k in (a, b)) and all(k in Y["DE"] for k in (a, b)):
                ds, v = joined([y(c, a), y(c, b), y("DE", a), y("DE", b)], lambda ca, cb, ra, rb: ((cb - ca) - (rb - ra)) * 100); add(id=f"{c}-DE_{a}s{b}s", name=f"{c}{DASH}DE {a}s{b}s box", cat="box", country=c, legs=f"{a}s{b}s", unit="bp", dates=ds, values=v)
BY = {u["id"]: u for u in U}
CLOSE = max(u["dates"][-1] for u in U if u["cat"] == "outright")
SEL = [c for c in P["countries"] if any(u["country"] == c and u["cat"] == "outright" for u in U)]
VIS = [u for u in U if u["country"] in P["countries"]]
N, LABEL = P["win"], P["label"]

def change(u, k=1): return (u["values"][-1] - u["values"][-1 - k]) * (100 if u["unit"] == "pct" else 1)
def level(u): return num(u["values"][-1], u["dec"] if u["unit"] == "pct" else 1)
def stats(u):
    w = np.array(u["values"][-N:]); last = u["values"][-1]
    if len(w) < max(20, 0.9 * N): return None
    sd = w.std(ddof=1)
    return dict(last=last, z=(last - w.mean()) / sd if sd > 0 else float("nan"), pct=100 * ((w < last).sum() + 0.5 * (w == last).sum()) / len(w))

# ---- the daily note
def close_sentence(c):
    b, a, sl = BY.get(f"{c}_10Y"), BY.get(f"{c}_2Y"), BY.get(f"{c}_2s10s")
    d10 = change(b)
    ten = f"the 10-year yield was unchanged at {level(b)} %" if still(d10) else f"the 10-year yield {'fell' if d10 < 0 else 'rose'} {bpw(d10)} to {level(b)} %"
    late = f" Data to {short(b['dates'][-1])}." if b["dates"][-1] < CLOSE else ""
    if not a or not sl or a["dates"][-1] != b["dates"][-1]: return f"{BOND[c]}{'' if still(d10) else ' rallied' if d10 < 0 else ' sold off'}: {ten}.{late}"
    d2, ds = change(a), change(sl); mid = (d2 + d10) / 2; shape = "" if still(ds) else "steepened" if ds > 0 else "flattened"
    if still(d2) and still(d10): verb = ""
    elif d2 * d10 < 0 and abs(d2) >= 0.95 and abs(d10) >= 0.95: verb = "twist-" + shape
    elif not shape: verb = ("rallied" if mid < 0 else "sold off") + " in a parallel move"
    else: verb = shape if still(mid) else ("bull-" if mid < 0 else "bear-") + shape
    return f"{BOND[c]}{' ' + verb if verb else ''}: {ten}, 2s10s {'unchanged' if still(ds) else bpw(ds) + (' steeper' if ds > 0 else ' flatter')} at {lv(sl['values'][-1])} bp.{late}"
def spread_sentence(c):
    u = BY.get(f"{c}-DE_10Y") or next((x for x in U if x["cat"] == "spread" and x["country"] == c), None)
    if not u: return None
    st, d = stats(u), change(u)
    return (f"{u['tenor']}-year spread to Germany {lv(u['values'][-1])} bp, {'unchanged' if still(d) else bpw(d) + (' wider' if d > 0 else ' tighter')}"
            + (f", {LABEL} z-score {num(st['z'], 2, True)}" if st and st["z"] == st["z"] else "") + (f". Data to {short(u['dates'][-1])}." if u["dates"][-1] < CLOSE else "."))
def shape_sentence(c):
    s = BY.get(f"{c}_5s30s") or BY.get(f"{c}_10s30s"); f = BY.get(f"{c}_2s5s10s") or next((x for x in U if x["cat"] == "fly" and x["country"] == c), None); parts = []
    if s: d = change(s); parts.append(f"{s['legs']} {lv(s['values'][-1])} bp, {'unchanged' if still(d) else bpw(d) + (' steeper' if d > 0 else ' flatter')}")
    if f: d = change(f); parts.append(f"{f['legs']} fly {lv(f['values'][-1])} bp, {'unchanged' if still(d) else 'belly ' + bpw(d) + (' cheaper' if d > 0 else ' richer')}")
    return f"{NAME[c]} {'; '.join(parts)}." if parts else None
def ranked_z():
    r = [(u, stats(u)) for u in VIS if u["cat"] != "outright"]; r = [(u, s) for u, s in r if s and s["z"] == s["z"]]
    return sorted(r, key=lambda x: -abs(x[1]["z"]))
def future_sentence():
    p = next((x for x in F.get("products", []) if x["code"] == "FGBL"), None)
    if not p or not p["contracts"]: return None
    c0 = p["contracts"][0]; ctd = next((b for b in c0.get("basket", []) if b.get("ctd")), None)
    return (f"Bund future {c0['label']} settled at {num(c0['settle'], 2)}"
            + (f"; cheapest to deliver {num(ctd['coupon'], 2)}% {dt.date.fromisoformat(ctd['maturity']).strftime('%b %Y')}, implied repo {num(ctd['implied_repo'], 2)} %" if ctd else "")
            + (f" (settlement of {short(F['asof'])})" if F.get("asof") and F["asof"] != CLOSE else "") + ".")

# ---- largest moves: one row per family, then the five largest
def day_move(u):
    v = u["values"]; L = len(v); k = 100 if u["unit"] == "pct" else 1
    if L < 22: return None
    ch = np.array([(v[i] - v[i - 1]) * k for i in range(max(1, L - N), L)]); sd = ch.std(ddof=1)
    return (ch[-1], ch[-1] / sd) if len(ch) >= 20 and sd > 0 else None
best = {}
for u in VIS:
    if not (u["cat"] == "slope" or (u["cat"] in ("outright", "spread") and u["tenor"] in HEADLINE)) or u["dates"][-1] != CLOSE: continue
    m = day_move(u)
    if not m or still(m[0]): continue
    key = u["country"] + " " + u["cat"]
    if key not in best or abs(m[1]) > abs(best[key][1][1]): best[key] = (u, m)
movers = sorted(best.values(), key=lambda x: -abs(x[1][1]))[:5]

focus = "DE" if "DE" in SEL else SEL[0]
lines = {}
for c in SEL:
    if c not in (focus, "DE"):
        t = spread_sentence(c)
        if t: lines[NAME[c]] = t
lines["Curve"] = shape_sentence(focus)
rz = ranked_z()
if rz: lines["Stretched"] = f"{rz[0][0]['name']} is the most stretched level on a {LABEL} window: z-score {num(rz[0][1]['z'], 2, True)}, percentile {num(rz[0][1]['pct'], 0)}."
lines["Futures"] = future_sentence()
tenors = [t for t in LADDER if any(f"{c}_{t}Y" in BY for c in SEL)]
ladder = []
for c in SEL:
    us = [BY.get(f"{c}_{t}Y") for t in tenors]
    ladder.append([level(u) if u else DASH for u in us]); ladder.append([bp(change(u)) if u else DASH for u in us])
print(json.dumps(dict(close=CLOSE, headline=close_sentence(focus), lines=lines,
    movers=[[u["name"], level(u) + (" %" if u["unit"] == "pct" else " bp"), bp(m[0]), num(m[1], 1, True)] for u, m in movers],
    extremes=[[u["name"], num(s["z"], 2, True)] for u, s in rz[:6]], tenors=[f"{t}Y" for t in tenors], ladder=ladder), ensure_ascii=False))
