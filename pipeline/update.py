"""Daily update of the EGB Dashboard, run by GitHub Actions.

1. Downloads every source (full history since 2015 where the source has it).
2. Keeps archives in data/raw/ for sources that only show a short window (Eurex: 36 trading days, news feeds).
3. Writes data/market.json, data/futures.json, data/news.json for the page.
4. Compares the result with the double-read snapshot of 19 Nov 2026 and writes data/raw/update_log.txt.
A source that fails keeps its previous values: nothing is filled in or estimated.
"""
import csv, datetime as dt, io, json, pathlib, re, sys, time, urllib.request, xml.etree.ElementTree as ET
from collections import defaultdict

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA, RAW = ROOT / "data", ROOT / "data" / "raw"
RAW.mkdir(parents=True, exist_ok=True)
START = "2015-01-01"
UA = {"User-Agent": "egb-dashboard/1.0 (+https://github.com/arthurmarc1102-droid/egb-dashboard)"}
BBK = "https://api.statistiken.bundesbank.de/rest/data"
LOG = []
def log(*a): LOG.append(" ".join(str(x) for x in a)); print(*a, flush=True)


def get(url, binary=False, tries=3):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
                b = r.read()
                return b if binary else b.decode("utf-8-sig", "replace")
        except Exception as e:
            log(f"  retry {i+1} {url[:90]}: {e}"); time.sleep(3 * (i + 1))
    raise RuntimeError(f"download failed: {url}")


def num(x):
    x = (x or "").strip().replace(",", ".")
    try: return float(x)
    except ValueError: return None


def sdmx(js):
    """SDMX-JSON 1.0 -> {series key tuple: {date: value}}"""
    st = js["data"]["structure"]["dimensions"]; dims = st["series"]; obs = st["observation"][0]["values"]
    out = {}
    for key, s in js["data"]["dataSets"][0]["series"].items():
        ids = tuple(dims[k]["values"][int(i)]["id"] for k, i in enumerate(key.split(":")))
        out[ids] = {obs[int(o)]["id"]: float(v[0]) for o, v in s["observations"].items() if v and v[0] is not None}
    return out


# ---------------------------------------------------------------- sources
DE_TENORS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 25, 30]
FR_TENORS = [1, 2, 3, 5, 7, 10, 15, 20, 25, 30]
BE_TENORS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 25, 30]
ES_CODES = {"D_G0B1F0ZN": 3, "D_G0B1F0ZO": 5, "D_G0B1F0ZP": 10, "D_G0B1F0ZQ": 15}
EZ = ["DE", "FR", "IT", "ES", "NL", "BE", "AT", "PT"]


def fetch_de():
    keys = "+".join(f"R{t:02d}XX" for t in DE_TENORS)
    d = sdmx(json.loads(get(f"{BBK}/BBSIS/D.I.ZAR.ZI.EUR.S1311.B.A604.{keys}.R.A.A._Z._Z.A?format=sdmx_json&lang=en&startPeriod={START}")))
    out = {}
    for k, v in d.items():
        t = int(next(x for x in k if re.fullmatch(r"R\d\dXX", x))[1:3]); out[t] = v
    return out


def fetch_estr():
    d = sdmx(json.loads(get(f"{BBK}/BBMMB/D.EU000A2X2A25.WT?format=sdmx_json&lang=en&startPeriod=2019-10-01")))
    return next(iter(d.values()))


def fetch_fr():
    txt = get("https://webstat.banque-france.fr/export/csv-columns/fr/selection/5385693")
    rows = list(csv.reader(io.StringIO(txt), delimiter=";"))
    codes = next(r for r in rows if r and r[0].startswith("Code"))
    ten = [int(re.search(r"FRMOYTEC(\d+)", c).group(1)) if "FRMOYTEC" in c else None for c in codes]
    out = defaultdict(dict)
    for r in rows:
        if not r or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", r[0]) or r[0] < START: continue
        for t, v in zip(ten[1:], r[1:]):
            if t in FR_TENORS and num(v) is not None: out[t][r[0]] = num(v)
    return out


MES = dict(ENE=1, FEB=2, MAR=3, ABR=4, MAY=5, JUN=6, JUL=7, AGO=8, SEP=9, OCT=10, NOV=11, DIC=12)
def fetch_es():
    txt = get("https://www.bde.es/webbe/es/estadisticas/compartido/datos/csv/ead002.csv", binary=True).decode("latin-1")
    rows = list(csv.reader(io.StringIO(txt)))
    col = {c: i for i, c in enumerate(rows[0])}
    out = defaultdict(dict)
    for r in rows[1:]:
        m = re.fullmatch(r"(\d{2}) ([A-Z]{3}) (\d{4})", r[0].strip()) if r else None
        if not m or m.group(2) not in MES: continue
        d = dt.date(int(m.group(3)), MES[m.group(2)], int(m.group(1))).isoformat()
        if d < START: continue
        for code, t in ES_CODES.items():
            v = num(r[col[code]]) if col.get(code) is not None and col[code] < len(r) else None
            if v is not None: out[t][d] = v
    return out


def fetch_be():
    """National Bank of Belgium, NBB.Stat dataflow DF_IROLOBE2: average yield on OLOs with a fixed residual term, daily."""
    txt = get(f"https://nsidisseminate-stat.nbb.be/rest/data/BE2,DF_IROLOBE2,1.0/D..F?startPeriod={START}")
    out = defaultdict(dict)
    for r in csv.DictReader(io.StringIO(txt)):
        m = re.fullmatch(r"(\d+)Y", r.get("IROLOBE2_MATUR", "")); v = num(r.get("OBS_VALUE", ""))
        if m and int(m.group(1)) in BE_TENORS and v is not None and re.fullmatch(r"\d{4}-\d{2}-\d{2}", r.get("TIME_PERIOD", "")): out[int(m.group(1))][r["TIME_PERIOD"]] = v
    if not out: raise RuntimeError("no Belgian yield in the answer")
    return out


def fetch_monthly():
    q = "&".join(f"geo={g}" for g in EZ)
    js = json.loads(get(f"https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/irt_lt_mcby_m?format=JSON&{q}&sinceTimePeriod=2015-01"))
    geo = js["dimension"]["geo"]["category"]["index"]; tim = js["dimension"]["time"]["category"]["index"]; nt = len(tim)
    inv_g = {v: k for k, v in geo.items()}; inv_t = {v: k for k, v in tim.items()}
    out = defaultdict(dict)
    for k, v in js["value"].items():
        k = int(k); out[inv_g[k // nt]][inv_t[k % nt] + "-01"] = v
    return out


# ---------------------------------------------------------------- Eurex
PRODUCTS = [("FGBS", 34678, "Euro-Schatz", "DE", 6), ("FGBM", 34670, "Euro-Bobl", "DE", 6), ("FGBL", 34656, "Euro-Bund", "DE", 6),
            ("FGBX", 42066, "Euro-Buxl", "DE", 4), ("FOAT", 34684, "Euro-OAT", "FR", 6), ("FBTP", 34680, "Long-Term Euro-BTP", "IT", 6)]
EUREX_CSV = RAW / "eurex_settle.csv"
EUREX_COLS = ["busdate", "product", "expiry", "settle", "volume", "open_interest"]


def eurex_archive():
    arch = {}
    if EUREX_CSV.exists():
        for r in csv.DictReader(open(EUREX_CSV)): arch[(r["busdate"], r["product"], r["expiry"])] = r
    first = json.loads(get(f"https://www.eurex.com/api/v1/overallstatistics/34656?busdate={dt.date.today():%Y%m%d}"))
    days = sorted(dt.datetime.strptime(x[:10], "%d-%m-%Y").date().isoformat() for x in first["header"]["tradingDates"])
    have = {k[0] for k in arch}
    new = 0
    for d in days:
        if d in have and d != days[-1]: continue
        for code, pid, *_ in PRODUCTS:
            try: js = json.loads(get(f"https://www.eurex.com/api/v1/overallstatistics/{pid}?busdate={d.replace('-', '')}"))
            except RuntimeError: continue
            for row in js.get("dataRows", []):
                if row.get("contractType") != "M" or not row.get("dSettle"): continue
                prec = 3 if code == "FGBS" else 2
                arch[(d, code, row["date"])] = dict(busdate=d, product=code, expiry=row["date"], settle=f"{round(row['dSettle'], prec)}",
                                                    volume=f"{int(row['volume'])}", open_interest=f"{int(row['openInt'])}"); new += 1
            time.sleep(0.2)
    with open(EUREX_CSV, "w", newline="") as fh:
        w = csv.DictWriter(fh, EUREX_COLS); w.writeheader(); [w.writerow(arch[k]) for k in sorted(arch)]
    log(f"Eurex: {len(days)} trading days offered ({days[0]} to {days[-1]}), {new} rows fetched, archive {len(arch)} rows")
    return arch


def fetch_baskets():
    page = get("https://www.eurex.com/ex-en/data/clearing-files/notified-deliverable-bonds-conversion-factors")
    links = sorted(set(re.findall(r'href="([^"]+?\.csv)"', page)))
    link = next((l for l in links if "deliverable" in l.lower()), None)
    if not link: raise RuntimeError(f"no basket CSV link; csv links: {links[:5]}")
    txt = get(link if link.startswith("http") else "https://www.eurex.com" + link)
    (RAW / "eurex_deliverables.csv").write_text(txt)
    log("Eurex basket file:", link, "| first lines:", " || ".join(txt.splitlines()[:4])[:600])
    out = defaultdict(list)
    for line in txt.splitlines():       # format: Contract;ISIN;Coupon;Maturity;ConvFac, contract like "FGBL SI 20261208 PS"
        f = [x.strip() for x in line.split(";")]
        if line.startswith("#") or len(f) != 5 or len(f[0].split()) != 4: continue
        prod, _, expiry, _ = f[0].split(); d_, m_, y_ = f[3].split(".")
        out[(prod, expiry)].append(dict(isin=f[1], coupon=num(f[2]), maturity=f"{y_}-{m_}-{d_}", cf=num(f[4])))
    log(f"Eurex baskets parsed: {len(out)} contracts, {sum(map(len, out.values()))} bonds")
    return out


# ---------------------------------------------------------------- news
FEEDS = [("ECB", "https://www.ecb.europa.eu/rss/press.html"), ("Bundesbank", "https://www.bundesbank.de/service/rss/en/633306/feed.rss"),
         ("Banco de Espana", "https://www.bde.es/wbe/en/inicio/rss/rss-noticias/")]


def update_news():
    path = DATA / "news.json"; old = json.load(open(path)) if path.exists() else {}
    items = {i["url"]: i for i in old.get("items", [])}
    for src, url in FEEDS:
        try: root = ET.fromstring(get(url).encode("utf-8"))
        except Exception as e: log(f"news {src}: failed {e}"); continue
        n = 0
        for it in root.iter("item"):
            link, title = (it.findtext("link") or "").strip(), (it.findtext("title") or "").strip()
            pd = it.findtext("pubDate") or it.findtext("{http://purl.org/dc/elements/1.1/}date") or ""
            try: d = dt.datetime.strptime(pd.strip()[:25].strip(), "%a, %d %b %Y %H:%M:%S").date().isoformat()
            except ValueError: d = pd[:10] if re.match(r"\d{4}-\d{2}-\d{2}", pd) else None
            if link and title and d: items.setdefault(link, dict(date=d, source=src, title=title, url=link)); n += 1
        log(f"news {src}: {n} items in feed")
    keep = sorted(items.values(), key=lambda i: i["date"], reverse=True)[:400]
    old.update(items=keep, updated=dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
               note="Titles and links from the ECB, Bundesbank and Banco de Espana feeds, read each day and archived (400 most recent). Press feeds are not included: their terms of use have not been read.")
    json.dump(old, open(path, "w"), ensure_ascii=False, indent=0)


# ---------------------------------------------------------------- build
def series(id_, group, country, tenor, name, data, decimals, source, **kw):
    ds = sorted(data)
    return dict(id=id_, group=group, country=country, tenor=tenor, name=name, unit="pct", decimals=decimals, source=source,
                dates=ds, values=[round(data[d], decimals) for d in ds], **kw)


def drop_spikes(name, data, bp=75):
    ds = sorted(data); bad = [b for a, b, c in zip(ds, ds[1:], ds[2:])
                             if (data[b] - data[a]) * (data[b] - data[c]) > 0 and min(abs(data[b] - data[a]), abs(data[b] - data[c])) * 100 >= bp]
    for d in bad: log(f"  {name}: {d} value {data[d]} dropped, isolated spike of {bp} bp or more against both neighbours")
    return {d: v for d, v in data.items() if d not in bad}


def checks(name, data, max_jump):
    ds = sorted(data); jumps = [(b, round((data[b] - data[a]) * 100, 1)) for a, b in zip(ds, ds[1:]) if abs(data[b] - data[a]) * 100 > max_jump]
    log(f"  {name}: {len(ds)} days {ds[0] if ds else '-'} to {ds[-1] if ds else '-'}" + (f", day moves above {max_jump} bp: {jumps[:6]}" if jumps else ""))


def main():
    prev = json.load(open(DATA / "market.json"))
    prev_by = {s["id"]: s for s in prev["series"]}
    out, ok = [], {}

    def run(label, fn):
        try: r = fn(); ok[label] = True; return r
        except Exception as e: ok[label] = False; log(f"{label}: FAILED ({e}); previous values kept"); return None

    de = run("Germany (Bundesbank)", fetch_de)
    fr = run("France (Banque de France TEC)", fetch_fr)
    es = run("Spain (Banco de Espana)", fetch_es)
    be = run("Belgium (National Bank of Belgium)", fetch_be)
    estr = run("ESTR (Bundesbank)", fetch_estr)
    mo = run("Monthly 10Y (Eurostat)", fetch_monthly)

    def add(id_, mk):
        if mk is not None: out.append(mk)
        elif id_ in prev_by: out.append(prev_by[id_])

    log("Checks:")
    for t in DE_TENORS:
        if de and de.get(t): de[t] = drop_spikes(f"DE {t}Y", de[t]); checks(f"DE {t}Y", de[t], 25)
        add(f"DE_{t}Y", series(f"DE_{t}Y", "yield", "DE", t, f"Germany {t}Y", de[t], 2, "bbk_curve", kind="par yield, estimated curve") if de and de.get(t) else None)
    add("ESTR", series("ESTR", "mm", "EA", 0, "Euro short-term rate", estr, 3, "bbk_estr") if estr else None)
    for g in EZ:
        add(f"{g}_10Y_M", series(f"{g}_10Y_M", "yield_m", g, 10, f"{g} 10Y, monthly average", mo[g], 4, "eurostat_mcby") if mo and mo.get(g) else None)
    for t in sorted(ES_CODES.values()):
        if es and es.get(t): es[t] = drop_spikes(f"ES {t}Y", es[t]); checks(f"ES {t}Y", es[t], 30)
        add(f"ES_{t}Y", series(f"ES_{t}Y", "yield", "ES", t, f"Spain {t}Y", es[t], 2, "bde_yields", kind="yield from market trades") if es and es.get(t) else None)
    for t in BE_TENORS:
        if be and be.get(t): be[t] = drop_spikes(f"BE {t}Y", be[t]); checks(f"BE {t}Y", be[t], 30)
        add(f"BE_{t}Y", series(f"BE_{t}Y", "yield", "BE", t, f"Belgium {t}Y", be[t], 2, "nbb_olo", kind="average yield on OLOs at a fixed residual term") if be and be.get(t) else None)
    for t in FR_TENORS:
        if fr and fr.get(t): fr[t] = drop_spikes(f"FR {t}Y", fr[t]); checks(f"FR {t}Y", fr[t], 25)
        add(f"FR_{t}Y", series(f"FR_{t}Y", "yield", "FR", t, f"France {t}Y", fr[t], 3, "bdf_tec", kind="TEC constant-maturity index") if fr and fr.get(t) else None)

    last = max(s["dates"][-1] for s in out if s["group"] == "yield")
    FOOTER = "Daily data from official sources. Every source, its status and the methods are listed under Sources. No data point is invented or filled in: everything else is computed from the published values."
    now = dt.datetime.now(dt.timezone.utc)
    failed = [k for k, v in ok.items() if not v]
    status = f"Updated {now:%d %b %Y %H:%M} UTC from official sources." + (f" Not refreshed this time: {', '.join(failed)}." if failed else "")
    json.dump(dict(generated=now.isoformat(timespec="seconds"), private=False, status=status,
                   footer=FOOTER, series=out), open(DATA / "market.json", "w"), separators=(",", ":"))
    log(f"market.json: {len(out)} series, last daily date {last}")

    # ---- comparison with the double-read snapshot of 19 Nov 2026
    snap = json.load(open(DATA / "checks" / "snapshot_2026-11-19_market.json"))
    now_by = {s["id"]: dict(zip(s["dates"], s["values"])) for s in out}
    tot = bad = 0; ex = []
    for s in snap["series"]:
        cur = now_by.get(s["id"], {})
        for d, v in zip(s["dates"], s["values"]):
            if d in cur:
                tot += 1
                if abs(cur[d] - v) > 1e-9: bad += 1; ex.append((s["id"], d, v, cur[d]))
    log(f"Against the double-read snapshot of 19 Nov 2026: {tot} common values, {bad} differences {ex[:10]}")

    # ---- news
    try: update_news()
    except Exception as e: log(f"news: FAILED ({e})")

    # ---- auctions and calendar
    try:
        sys.path.insert(0, str(ROOT / 'pipeline')); import auctions; auctions.update(get, log)
    except Exception as e: log(f"auctions: FAILED ({e})")

    # ---- futures
    try: build_futures(now_by)
    except Exception as e: log(f"futures: FAILED ({e}); previous file kept")
    (RAW / "update_log.txt").write_text(f"Run {now:%Y-%m-%d %H:%M} UTC\n" + "\n".join(LOG) + "\n")


def add_bdays(d, n):
    while n:
        d += dt.timedelta(days=1)
        if d.weekday() < 5: n -= 1
    return d


def delivery_day(expiry):
    d = dt.date(int(expiry[:4]), int(expiry[4:6]), 10)
    while d.weekday() > 4: d += dt.timedelta(days=1)
    return d


def build_futures(now_by):
    arch = eurex_archive()
    busdate = max(k[0] for k in arch)
    try: baskets = fetch_baskets()
    except Exception as e:
        log(f"Eurex baskets: FAILED ({e}); previous baskets kept"); baskets = None
    prev = json.load(open(DATA / "futures.json"))
    if not baskets:  # previous baskets, without the price columns
        baskets = {(p["code"], c["expiry"]): [dict(isin=b["isin"], coupon=b["coupon"], maturity=b["maturity"], cf=b["cf"]) for b in c.get("basket", [])]
                   for p in prev["products"] for c in p["contracts"]}
    estr_d = max(now_by["ESTR"]); estr = now_by["ESTR"][estr_d]
    # German bond prices on the futures business day (Bundesbank reference prices)
    fronts = {code: min(k[2] for k in arch if k[1] == code and k[0] == busdate) for code, *_ in PRODUCTS if code.startswith("FGB")}
    isins = sorted({b["isin"] for (p, e), bl in baskets.items() if fronts.get(p) == e for b in bl if b["isin"].startswith("DE")})
    px = defaultdict(dict)
    for isin in isins:
        try: d = sdmx(json.loads(get(f"{BBK}/BBSSY/D.KCP+KDP+REN.EUR..{isin}.?format=sdmx_json&lang=en&startPeriod={busdate}&endPeriod={busdate}")))
        except Exception as e: log(f"  price {isin}: {e}"); continue
        for k, v in d.items():
            meas = next(x for x in k if x in ("KCP", "KDP", "REN"))
            if busdate in v: px[isin][meas] = v[busdate]
        time.sleep(0.2)
    log(f"Bundesbank bond prices on {busdate}: {len(px)} of {len(isins)} German deliverable bonds")
    bd = dt.date.fromisoformat(busdate); bond_settle = add_bdays(bd, 2)
    products = []
    for code, pid, name, country, notional in PRODUCTS:
        exps = sorted({k[2] for k in arch if k[1] == code and k[0] == busdate})
        contracts = []
        for expiry in exps[:2]:
            r = arch[(busdate, code, expiry)]; F = float(r["settle"])
            deliv = delivery_day(expiry); days = (deliv - bond_settle).days
            bl = next((v for (p, e), v in baskets.items() if p == code and e.replace("-", "")[:6] == expiry[:6]), [])
            rows = []
            for b in bl:
                row = dict(b); q = px.get(b["isin"], {})
                if expiry == exps[0] and "KCP" in q and "KDP" in q and b["cf"]:
                    ai = q["KDP"] - q["KCP"]; ai_del = ai + b["coupon"] * days / 365.0
                    row.update(price=q["KCP"], gross_basis=round(q["KCP"] - b["cf"] * F, 4), **({"yield": q["REN"]} if "REN" in q else {}),
                               implied_repo=round(((F * b["cf"] + ai_del) / (q["KCP"] + ai) - 1) * 360 / days * 100, 3))
                    carry = b["coupon"] * days / 365.0 - (q["KCP"] + ai) * estr / 100 * days / 360.0
                    row["net_basis"] = round(row["gross_basis"] - carry, 4)
                rows.append(row)
            priced = [x for x in rows if "implied_repo" in x]
            if priced: max(priced, key=lambda x: x["implied_repo"])["ctd"] = True
            contracts.append(dict(expiry=expiry, label=dt.date(int(expiry[:4]), int(expiry[4:6]), 1).strftime("%b %y"), delivery=deliv.isoformat(),
                                  settle=F, volume=int(r["volume"]), open_interest=int(r["open_interest"]), basket=rows))
        products.append(dict(code=code, name=name, country=country, notional_coupon=notional, contracts=contracts))
    note = ("Settlement prices and deliverable baskets: Eurex, shown with the written consent of Deutsche Boerse. "
            f"Basis, implied repo and cheapest-to-deliver are shown for the German front contracts. Bond prices are the Bundesbank reference prices of {bd:%d %b %Y}, "
            "set around midday in Frankfurt, while futures settle at 17:15 CET, so the basis is indicative. "
            f"Bond value date {bond_settle:%d %b %Y}, delivery on the 10th of the delivery month. "
            f"Net basis finances the bond at the euro short-term rate ({estr:.3f} % on {dt.date.fromisoformat(estr_d):%d %b %Y}), not at a repo rate. "
            "No free price by bond is verified for French and Italian bonds, so their baskets show conversion factors only.")
    json.dump(dict(asof=busdate, private=False, sources=["eurex", "bbk_prices"], note=note, products=products), open(DATA / "futures.json", "w"), indent=1)
    log("futures.json: " + "; ".join(f"{p['code']} " + ", ".join(f"{c['label']} {c['settle']}" for c in p["contracts"]) for p in products))


if __name__ == "__main__":
    main()
