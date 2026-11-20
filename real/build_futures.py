"""Build data/futures.json: Eurex settlement prices, deliverable baskets, and basis / implied repo / CTD for German contracts.

Inputs (all transcriptions of official pages read on 19 Nov 2026):
  - Eurex settlement prices of 18 Nov 2026, read twice (first reading hard-coded below, second in staging/C/eurex_settle.csv)
  - Eurex deliverable bonds and conversion factors (CSV read by the audit)
  - Bundesbank prices by ISIN (clean KCP, dirty KDP, yield REN), staging/C/bbssy.csv
Method, for each deliverable bond of the front contract:
  gross basis  = clean price - conversion factor x futures settlement price
  implied repo = ((futures x CF + accrued at delivery) / (clean + accrued at settlement) - 1) x 360 / days
  net basis    = gross basis - carry, carry = coupon accrued over the period - financing of the dirty price at the euro short-term rate
  CTD          = bond with the highest implied repo
Accrued at settlement is the Bundesbank dirty price minus clean price (value date T+2). No coupon falls before delivery for these bonds.
"""
import csv, json, pathlib, sys, datetime, collections

ST = pathlib.Path("/home/claude/egb-dev/staging")
_ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
OUT = pathlib.Path(_ARGS[0] if _ARGS else "/home/claude/egb/data")
BASKETS = pathlib.Path("/home/claude/audit/raw/agent4_eurex_webfetch_transcriptions/deliverable-bonds-and-conversion-factors.6contracts.webfetch-transcription.csv")
ASOF = datetime.date(2026, 11, 18)
PRODUCTS = [("FGBS", "Euro-Schatz", "DE", 6), ("FGBM", "Euro-Bobl", "DE", 6), ("FGBL", "Euro-Bund", "DE", 6), ("FGBX", "Euro-Buxl", "DE", 4),
            ("FOAT", "Euro-OAT", "FR", 6), ("FBTP", "Long-Term Euro-BTP", "IT", 6)]
FIRST_READ = {  # settlement prices read by the audit on the Eurex statistics endpoint (session of 18 Nov 2026)
    ("FGBL", "20261208"): 121.98, ("FGBL", "20270308"): 122.01, ("FGBL", "20270608"): 121.25,
    ("FGBM", "20261208"): 113.01, ("FGBM", "20270308"): 112.25, ("FGBM", "20270608"): 113.32,
    ("FGBS", "20261208"): 104.92, ("FGBS", "20270308"): 104.86, ("FGBS", "20270608"): 105.07,
    ("FGBX", "20261208"): 104.70, ("FGBX", "20270308"): 104.10, ("FGBX", "20270608"): 104.32,
    ("FOAT", "20261208"): 109.21, ("FOAT", "20270308"): 108.40, ("FOAT", "20270608"): 107.91,
    ("FBTP", "20261208"): 112.42, ("FBTP", "20270308"): 111.71, ("FBTP", "20270608"): 111.46,   # read by the main session at 11:08 UTC
}
log = []


def f(x):
    try: return float(x)
    except (TypeError, ValueError): return None


def add_bdays(d, n):
    while n:
        d += datetime.timedelta(days=1)
        if d.weekday() < 5: n -= 1
    return d


def delivery_day(expiry):                       # 10th calendar day of the delivery month, next weekday if needed
    d = datetime.date(int(expiry[:4]), int(expiry[4:6]), 10)
    while d.weekday() > 4: d += datetime.timedelta(days=1)
    return d


# ---- settlement prices: keep a price only when the two readings agree
second = {}
p = ST / "C/eurex_settle.csv"
if p.exists():
    for r in csv.DictReader(open(p)):
        second[(r["product"], r["expiry"])] = dict(settle=f(r["settle"]), volume=f(r["volume"]), oi=f(r["open_interest"]), last=f(r.get("last")))
else:
    log.append("second reading of Eurex settlement prices missing")
settle = {}
for k in sorted(set(FIRST_READ) | set(second)):
    a, b = FIRST_READ.get(k), (second.get(k) or {}).get("settle")
    if a is not None and b is not None and abs(a - round(b, 2)) < 1e-9: settle[k] = a
    elif a is None and b is not None: log.append(f"settle {k}: single reading {b} (not confirmed, kept out)")
    elif b is None: log.append(f"settle {k}: second reading missing, first {a} (kept out)")
    else: log.append(f"settle {k}: MISMATCH first {a} second {b} (kept out)")

# ---- baskets
baskets = collections.defaultdict(list)
for line in open(BASKETS):
    if line.startswith("#") or not line.strip(): continue
    contract, isin, cpn, mat, cf = line.strip().split(";")
    prod, _, expiry, _ = contract.split()
    d, mth, y = mat.split(".")
    baskets[(prod, expiry)].append(dict(isin=isin, coupon=float(cpn), maturity=f"{y}-{mth}-{d}", cf=float(cf)))

# ---- Bundesbank prices, latest date per ISIN
px = collections.defaultdict(dict)
p = ST / "C/bbssy.csv"
if p.exists():
    for r in csv.DictReader(open(p)):
        if f(r["value"]) is not None: px[r["isin"]][(r["measure"], r["date"])] = f(r["value"])
else:
    log.append("Bundesbank prices by ISIN missing")
estr = None
mk = OUT / "market.json"
if mk.exists():
    for s in json.load(open(mk))["series"]:
        if s["id"] == "ESTR": estr, estr_date = s["values"][-1], s["dates"][-1]

bond_settle = add_bdays(ASOF, 2)
products = []
for code, name, country, notional in PRODUCTS:
    contracts = []
    for expiry in sorted({e for (pr, e) in baskets if pr == code}):
        k = (code, expiry)
        deliv = delivery_day(expiry); days = (deliv - bond_settle).days
        label = datetime.date(int(expiry[:4]), int(expiry[4:6]), 1).strftime("%b %y")
        rowsb = []
        for b in baskets[k]:
            row = dict(b)
            kcp, kdp, ren = (px[b["isin"]].get((m_, ASOF.isoformat())) for m_ in ("KCP", "KDP", "REN"))
            if k in settle and kcp is not None and kdp is not None and expiry == "20261208":
                F = settle[k]; ai_set = kdp - kcp; ai_del = ai_set + b["coupon"] * days / 365.0
                row.update(price=kcp, gross_basis=round(kcp - b["cf"] * F, 4),
                           implied_repo=round(((F * b["cf"] + ai_del) / (kcp + ai_set) - 1) * 360 / days * 100, 3))
                row["yield"] = ren
                if estr is not None:
                    carry = b["coupon"] * days / 365.0 - (kcp + ai_set) * estr / 100 * days / 360.0
                    row["net_basis"] = round(row["gross_basis"] - carry, 4)
            rowsb.append(row)
        priced = [r for r in rowsb if "implied_repo" in r]
        if priced:
            best = max(priced, key=lambda r: r["implied_repo"]); best["ctd"] = True
            log.append(f"{code} {label}: CTD {best['isin']} implied repo {best['implied_repo']} % gross basis {best['gross_basis']} ({len(priced)}/{len(rowsb)} bonds priced)")
        sec = second.get(k) or {}
        contracts.append(dict(expiry=expiry, label=label, delivery=deliv.isoformat(), settle=settle.get(k),
                              volume=sec.get("volume"), open_interest=sec.get("oi"), basket=rowsb))
    contracts = [c for c in contracts if c["settle"] is not None][:2] or contracts[:2]   # front and next
    products.append(dict(code=code, name=name, country=country, notional_coupon=notional, contracts=contracts))

AUTHORISED = "--authorised" in sys.argv
note = (("Settlement prices and deliverable baskets: Eurex, shown with the written consent of Deutsche Boerse. " if AUTHORISED else
         "Private preview. Settlement prices and deliverable baskets come from Eurex, whose site terms do not allow publication without written consent from Deutsche Boerse: "
         "this tab must be removed, or consent obtained, before the page is shared. ")
        + f"Basis, implied repo and cheapest-to-deliver are shown for the German front contracts only. Bond prices are the Bundesbank reference prices of {ASOF.strftime('%d %b %Y')}, "
        "set around midday in Frankfurt, while futures settle at 17:15 CET, so the basis is indicative. "
        f"Bond value date {bond_settle.strftime('%d %b %Y')}, delivery on the 10th of the delivery month. "
        + (f"Net basis finances the bond at the euro short-term rate ({estr:.3f} % on {datetime.date.fromisoformat(estr_date).strftime('%d %b %Y')}), not at a repo rate. " if estr is not None else "")
        + "No free price by bond is verified yet for French and Italian bonds, so their baskets show conversion factors only.")
json.dump(dict(asof=ASOF.isoformat(), private=not AUTHORISED, sources=["eurex", "bbk_prices"], note=note, products=products), open(OUT / "futures.json", "w"), indent=1)
print("\n".join(log)); print("futures.json written:", [(p_["code"], [(c["label"], c["settle"], len(c["basket"])) for c in p_["contracts"]]) for p_ in products])
