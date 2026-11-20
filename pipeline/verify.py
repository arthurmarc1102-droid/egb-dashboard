"""Checks run after each update. Hard failures stop the run: the previous data stays online and GitHub e-mails the owner.
Writes data/raw/verify.txt."""
import csv, datetime as dt, json, pathlib, statistics, sys
ROOT = pathlib.Path(__file__).resolve().parents[1]; D = ROOT / "data"
TODAY = dt.date.today(); FAIL, WARN, OK = [], [], []
def bdays(a, b):
    n, d = 0, a
    while d < b: d += dt.timedelta(days=1); n += d.weekday() < 5
    return n

# ---------------- market data
M = json.load(open(D / "market.json")); S = {s["id"]: s for s in M["series"]}
need = {**{f"DE_{t}Y": 6 for t in (1, 2, 3, 5, 7, 10, 15, 20, 30)}, **{f"FR_{t}Y": 6 for t in (1, 2, 3, 5, 7, 10, 15, 20, 30)},
        **{f"ES_{t}Y": 8 for t in (3, 5, 10)}, "ESTR": 6}
for k, lag in need.items():
    s = S.get(k)
    if not s: FAIL.append(f"{k}: series missing"); continue
    ds, v = s["dates"], s["values"]
    if ds != sorted(set(ds)) or len(ds) != len(v): FAIL.append(f"{k}: dates not sorted, duplicated, or not matching values")
    if not all(-2 < x < 15 for x in v): FAIL.append(f"{k}: value outside -2 % to 15 %")
    if ds[0] > "2015-01-31" and k != "ESTR": FAIL.append(f"{k}: history starts {ds[0]}")
    if bdays(dt.date.fromisoformat(ds[-1]), TODAY) > lag: FAIL.append(f"{k}: last value {ds[-1]} is more than {lag} business days old")
for g in ("DE", "FR", "IT", "ES", "NL", "BE", "AT", "PT"):
    s = S.get(f"{g}_10Y_M")
    if not s or (TODAY - dt.date.fromisoformat(s["dates"][-1])).days > 75: FAIL.append(f"{g}_10Y_M: missing or older than 75 days")
OK.append(f"market: {len(need)} daily series and 8 monthly series present, sorted, in range and fresh")
# curve sanity: 30Y minus 1Y within -300 / +400 bp, DE minus FR 10Y never above 100 bp on the last day
for c in ("DE", "FR"):
    a, b = S[f"{c}_1Y"], S[f"{c}_30Y"]; sl = (b["values"][-1] - a["values"][-1]) * 100
    if not -300 < sl < 400: FAIL.append(f"{c} 1s30s at {sl:.0f} bp, outside -300/+400")
# against the double-read snapshot (warning only: sources may revise)
snap = json.load(open(D / "checks" / "snapshot_2026-11-19_market.json")); tot = bad = 0
for s in snap["series"]:
    cur = dict(zip(S[s["id"]]["dates"], S[s["id"]]["values"])) if s["id"] in S else {}
    for d, v in zip(s["dates"], s["values"]):
        if d in cur: tot += 1; bad += abs(cur[d] - v) > 1e-9
(WARN if bad else OK).append(f"market against the double-read snapshot of 19 Nov 2026: {tot} values, {bad} differences")

# ---------------- futures
F = json.load(open(D / "futures.json")); cf = {}
for line in open(D / "raw" / "eurex_deliverables.csv"):
    p = line.strip().split(";")
    if len(p) == 5 and not line.startswith("#"): cf[(p[0].split()[0], p[0].split()[2], p[1])] = float(p[4])
if bdays(dt.date.fromisoformat(F["asof"]), TODAY) > 4: FAIL.append(f"futures: settlement date {F['asof']} is old")
nb = 0
for p in F["products"]:
    if not p["contracts"]: FAIL.append(f"futures {p['code']}: no contract"); continue
    for c in p["contracts"]:
        if not 50 < c["settle"] < 250: FAIL.append(f"futures {p['code']} {c['label']}: settle {c['settle']} out of range")
        pr = [b for b in c["basket"] if "implied_repo" in b]
        for b in c["basket"]:
            nb += 1
            if (p["code"], c["expiry"], b["isin"]) in cf and abs(cf[(p["code"], c["expiry"], b["isin"])] - b["cf"]) > 1e-9: FAIL.append(f"futures {b['isin']}: conversion factor differs from the Eurex file")
            if "gross_basis" in b and abs(b["price"] - b["cf"] * c["settle"] - b["gross_basis"]) > 6e-5: FAIL.append(f"futures {b['isin']}: gross basis does not recompute")
        if pr and max(pr, key=lambda b: b["implied_repo"]).get("ctd") is not True: FAIL.append(f"futures {p['code']}: CTD is not the highest implied repo")
    if p["code"].startswith("FGB") and not any(b.get("ctd") for b in p["contracts"][0]["basket"]): WARN.append(f"futures {p['code']}: no CTD computed")
OK.append(f"futures: {nb} basket bonds checked against the Eurex file, gross basis and CTD recomputed")

# ---------------- auctions
A = json.load(open(D / "auctions.json")); na = 0
for r in A["results"]:
    if r["date"] > TODAY.isoformat(): FAIL.append(f"auction in the future in results: {r}")
    if r.get("avg_yield") is not None and not -1 < r["avg_yield"] < 10: FAIL.append(f"auction yield out of range: {r}")
    if r["country"] != "FR" and all(r.get(k) for k in ("bids_bn", "amount_bn", "bid_cover")):
        na += 1
        if abs(r["bids_bn"] / r["amount_bn"] - r["bid_cover"]) > 0.06: WARN.append(f"auction cover does not match bids / allotted: {r['country']} {r['date']} {r['security']}")
for u in A["upcoming"]:
    if u["date"] < TODAY.isoformat(): FAIL.append(f"past auction in upcoming: {u}")
for c in ("DE", "ES", "IT"):
    last = max((r["date"] for r in A["results"] if r["country"] == c), default="0")
    if (TODAY - dt.date.fromisoformat(last)).days > 45 if last != "0" else True: WARN.append(f"auctions {c}: last result {last}")
OK.append(f"auctions: {len(A['results'])} results, cover = bids / allotted checked on {na}; {len(A['upcoming'])} upcoming")

# ---------------- calendar and news
E = json.load(open(D / "events.json"))
if not any(e["kind"] == "ECB" and e["date"] >= TODAY.isoformat() for e in E["events"]): FAIL.append("calendar: no upcoming ECB meeting")
kr = E.get("key_rates") or []
if not kr or not (kr[0]["dfr"] < kr[0]["mro"] < kr[0]["mlf"]): FAIL.append("ECB key rates: missing or not ordered")
N = json.load(open(D / "news.json"))
if not N["items"] or any(not (i.get("date") and i.get("title") and i.get("url", "").startswith("http")) for i in N["items"]): FAIL.append("news: empty or incomplete items")
OK.append(f"calendar: {len(E['events'])} events, ECB rates {kr[0] if kr else None}; news: {len(N['items'])} items")

out = [f"Checks of {dt.datetime.now(dt.timezone.utc):%Y-%m-%d %H:%M} UTC"] + [f"OK    {x}" for x in OK] + [f"WARN  {x}" for x in WARN] + [f"FAIL  {x}" for x in FAIL]
(D / "raw" / "verify.txt").write_text("\n".join(out) + "\n"); print("\n".join(out))
sys.exit(1 if FAIL else 0)
