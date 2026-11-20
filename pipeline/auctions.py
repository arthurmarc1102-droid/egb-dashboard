"""Auctions and calendar for the EGB Dashboard: writes data/auctions.json and data/events.json, archives in data/raw/.

Germany  results: Finanzagentur workbooks (history since 1999, current year); upcoming: issuance calendar page
Spain    results: Tesoro Publico result pages (latest auctions, archived each run); upcoming: auction calendar page
Italy    results: MEF result PDFs (about ten per line, archived each run); upcoming: none found
France   AFT pages refuse scripts (bot protection): results from the 19 Nov 2026 reading, upcoming from the AFT calendar rule
Calendar ECB meeting calendar and key rates page, Eurostat release calendar (euro indicators)
"""
import csv, datetime as dt, html, io, json, pathlib, re, time
from collections import OrderedDict

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA, RAW = ROOT / "data", ROOT / "data" / "raw"
TODAY = dt.date.today()
FA = "https://www.deutsche-finanzagentur.de"
MEF = "https://www.dt.mef.gov.it"
MEF_RES = MEF + "/en/debito_pubblico/emissioni_titoli_di_stato_interni/risultati_aste/"
MEF_PAGES = ["risultati_aste_btp_short_term/index.html", "risultati_aste_btp_3_anni/index.html", "risultati_aste_btp_5_anni/index.html",
             "risultati_aste_btp_7_anni/index.html", "risultati_aste_btp_10_anni/index.html", "risultati_aste_btp_15_anni/index.html",
             "risultati_aste_btp_20_anni/index.html", "risultati_aste_btp_30_anni/index.html", "risultati_aste_btp_green/"]
TESORO = "https://www.tesoro.es/deuda-publica/subastas/"
COLS = ["country", "date", "security", "isin", "bids_bn", "amount_bn", "avg_yield", "stop_yield", "bid_cover", "url"]
MON = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()


def fmt_sec(kind, coupon, maturity):
    m = dt.date.fromisoformat(maturity)
    return f"{kind}{f' {coupon:.2f}%' if coupon is not None else ''} {m.day:02d} {MON[m.month-1]} {m.year}"


def plain(t):
    t = re.sub(r"<script.*?</script>|<style.*?</style>", " ", t, flags=re.S)
    t = re.sub(r"<(tr|br|p|div|h\d|li)[^>]*>", "\n", t); t = re.sub(r"<t[dh][^>]*>", " | ", t)
    t = html.unescape(re.sub(r"<[^>]+>", " ", t)); t = re.sub(r"[ \t\xa0]+", " ", t); return re.sub(r"\n\s*\n+", "\n", t)


def dmy(s, sep="."):
    d, m, y = s.strip().split(sep); return dt.date(int(y), int(m), int(d)).isoformat()


def num(x):
    x = (x or "").strip().replace(".", "").replace(",", ".") if isinstance(x, str) and "," in x else x
    try: return float(x)
    except (TypeError, ValueError): return None


def load_archive(name):
    p = RAW / name; out = OrderedDict()
    if p.exists():
        for r in csv.DictReader(open(p)):
            for k in ("bids_bn", "amount_bn", "avg_yield", "stop_yield", "bid_cover"): r[k] = float(r[k]) if r.get(k) not in (None, "") else None
            r["isin"] = r.get("isin") or None; out[(r["date"], r["security"])] = r
    return out


def save_archive(name, rows):
    with open(RAW / name, "w", newline="") as fh:
        w = csv.DictWriter(fh, COLS); w.writeheader()
        for k in sorted(rows, reverse=True): w.writerow({c: ("" if rows[k].get(c) is None else rows[k].get(c)) for c in COLS})


# ---------------------------------------------------------------- Germany
def de_results(get, log):
    import openpyxl
    rows = OrderedDict()
    for f in ("emissionshistorie_en.xlsx", "emissionsergebnisse_aktuell_en.xlsx"):
        wb = openpyxl.load_workbook(io.BytesIO(get(f"{FA}/fileadmin/user_upload/Institutionelle-investoren/auktionen/{f}", binary=True)), read_only=True, data_only=True)
        n = 0
        for r in wb.active.iter_rows(values_only=True):
            r = list(r) + [None] * 20
            if not isinstance(r[1], dt.datetime) or not isinstance(r[2], str) or not re.fullmatch(r"DE[A-Z0-9]{9}\d", r[2]): continue
            kind, proc = str(r[3]).strip(), str(r[9] or "").strip()
            if kind.startswith("Bubill") or proc not in ("Auc", "M-A") or r[1].year < 2015 or not isinstance(r[5], dt.datetime): continue
            cpn = r[4] * 100 if isinstance(r[4], (int, float)) else None
            sec = fmt_sec(kind, cpn, r[5].date().isoformat())
            rows[(r[1].date().isoformat(), sec)] = dict(country="DE", date=r[1].date().isoformat(), security=sec, isin=r[2],
                bids_bn=round(r[10] / 1000, 3) if isinstance(r[10], (int, float)) else None, amount_bn=round(r[13] / 1000, 3) if isinstance(r[13], (int, float)) else None,
                avg_yield=r[16] if isinstance(r[16], (int, float)) else None, stop_yield=None, bid_cover=r[18] if isinstance(r[18], (int, float)) else None,
                url=f"{FA}/en/federal-securities/issuances/issuance-results"); n += 1
        log(f"  Germany {f}: {n} coupon-bond auctions since 2015")
    return rows


def de_upcoming(get, log):
    t = plain(get(f"{FA}/en/federal-securities/issuances/issuance-calendar"))
    i = t.find("Date | Issuance | Volume | Coupon | Maturity"); t = t[i:t.find("Upcoming Issues", i)] if i >= 0 else ""
    out = []
    for m in re.finditer(r"(\d{2}\.\d{2}\.\d{4})\s*\|\s*([A-Za-z/]+(?: ?/ ?g)?)\s*\(\s*([RN])\s*\)\s*(DE[A-Z0-9]{9}\d)?\s*\|\s*([\d.,]+)\s*€\s*bn\s*\|\s*([\d.,]+ ?%|-)\s*\|\s*(\d{2}\.\d{2}\.\d{4})", t):
        d, kind, rn, isin, vol, cpn, mat = m.groups()
        if kind.startswith("Bubill") or dmy(d) < TODAY.isoformat(): continue
        c = float(cpn.replace("%", "").strip()) if "%" in cpn else None
        out.append(dict(country="DE", date=dmy(d), title=f"{fmt_sec(kind.replace(' ', ''), c, dmy(mat))}, {'reopening' if rn == 'R' else 'new issue'}",
                        isin=isin, amount_bn=float(vol), url=f"{FA}/en/federal-securities/issuances/issuance-calendar"))
    log(f"  Germany calendar: {len(out)} upcoming coupon-bond auctions")
    return out


# ---------------------------------------------------------------- Spain
def es_results(get, log):
    rows = OrderedDict()
    for page, url in (("bonos-del-estado", TESORO + "resultado-ultimas-subastas/bonos-del-estado"), ("obligaciones-del-estado", TESORO + "resultado-ultimas-subastas/obligaciones-del-estado")):
        t = plain(get(url)); t = t[t.find("(Importes en millones de euros)"):]
        def row(label):
            m = re.search(r"\|\s*" + re.escape(label) + r"\s*\n((?:\s*\|\s*[^|\n]*\n?)+?)(?=\s*\|\s*[A-Z][a-zé]|\s*\[1\]|$)", t)
            return [x.strip() for x in re.findall(r"\|\s*([^|\n]*)", m.group(1))] if m else []
        names, dates, mats = row("Denominación"), row("Fecha subasta"), row("Fecha vencimiento")
        bids, allot, marg, avg, cov = row("Nominal solicitado"), row("Nominal adjudicado"), row("Tipo de interés marginal"), row("Tipo de interés medio"), row("Ratio de cobertura")
        n = 0
        for j, d in enumerate(dates):
            if not re.fullmatch(r"\d{2}/\d{2}/\d{4}", d): continue
            nm = names[j] if j < len(names) else ""; mm = re.match(r"([BO])\s+([\d,]+)%", nm)
            kind = "Bono" if nm.startswith("B") else "Obligacion"
            sec = fmt_sec(kind, float(mm.group(2).replace(",", ".")) if mm else None, dmy(mats[j], "/"))
            g = lambda L: num(L[j]) if j < len(L) else None
            rows[(dmy(d, "/"), sec)] = dict(country="ES", date=dmy(d, "/"), security=sec, isin=None,
                bids_bn=round(g(bids) / 1000, 3) if g(bids) is not None else None, amount_bn=round(g(allot) / 1000, 3) if g(allot) is not None else None,
                avg_yield=g(avg), stop_yield=g(marg), bid_cover=g(cov), url=url); n += 1
        log(f"  Spain {page}: {n} auctions on the page")
    return rows


def es_upcoming(get, log):
    t = get(TESORO + "calendario"); i = t.find("Bonos y Obligaciones del Estado 20"); t = t[i:] if i >= 0 else ""
    out = []
    for tr in re.findall(r"<tr.*?</tr>", t, flags=re.S):
        ds = re.findall(r"\d{2}\.\d{2}\.\d{4}", re.sub(r"<[^>]+>", " ", tr))
        if len(ds) >= 5 and dmy(ds[0]) >= TODAY.isoformat():
            out.append(dict(country="ES", date=dmy(ds[0]), title="Bonos y Obligaciones auction (lines announced the week before)", url=TESORO + "calendario"))
    log(f"  Spain calendar: {len(out)} upcoming bond auctions")
    return out


# ---------------------------------------------------------------- Italy
def it_results(get, log, arch):
    from pypdf import PdfReader
    seen = {r["url"] for r in arch.values()}; new = 0
    for p in MEF_PAGES:
        try: page = get(MEF_RES + p)
        except Exception as e: log(f"  Italy {p}: page failed ({e})"); continue
        for u in sorted(set(re.findall(r'href="([^"]+Auction-Results[^"]*\.pdf)"', page))):
            url = MEF + u if u.startswith("/") else u
            if url in seen: continue
            try: txt = "\n".join(pg.extract_text() or "" for pg in PdfReader(io.BytesIO(get(url, binary=True))).pages)
            except Exception as e: log(f"  Italy PDF failed {url.split('/')[-1]}: {e}"); continue
            f = lambda lab: (re.search(re.escape(lab) + r"\s+([^\n]+)", txt) or [None, None])[1]
            try:
                d = dt.datetime.strptime(f("Auction Date").strip(), "%B %d, %Y").date().isoformat()
                mat = dt.datetime.strptime(f("Maturity Date").strip(), "%B %d, %Y").date().isoformat()
            except (AttributeError, ValueError): log(f"  Italy PDF not read {url.split('/')[-1]}"); continue
            title = (f("Auction Results:") or "").upper(); kind = "BTP Green" if "GREEN" in title else ("BTP Short Term" if "SHORT" in title else "BTP")
            cpn = (re.search(r"Coupon(?:\(\*\))?\s+([\d.]+%)", txt) or [None, None])[1]; cpn = float(cpn.strip().rstrip("%")) if cpn and re.fullmatch(r"[\d.]+%", cpn.strip()) else None
            n = lambda lab: float(f(lab).replace(",", "").rstrip("%")) if f(lab) and re.fullmatch(r"[\d,.]+%?", f(lab).strip()) else None
            sec = fmt_sec(kind, cpn, mat)
            arch[(d, sec)] = dict(country="IT", date=d, security=sec, isin=(f("ISIN Code") or "").strip() or None,
                                  bids_bn=round(n("Amount Bid") / 1000, 3) if n("Amount Bid") else None, amount_bn=round(n("Amount Allotted") / 1000, 3) if n("Amount Allotted") else None,
                                  avg_yield=n("Gross Yield"), stop_yield=None, bid_cover=n("Bid To Cover Ratio"), url=url); new += 1; seen.add(url)
            time.sleep(0.2)
    log(f"  Italy: {new} new result PDFs read, archive {len(arch)} auctions")
    return arch


# ---------------------------------------------------------------- France
def fr_upcoming():
    """AFT rule: long-term OAT on the first Thursday of the month, medium-term on the third Thursday. Not a dated calendar."""
    out = []
    for k in range(4):
        y, m = TODAY.year + (TODAY.month - 1 + k) // 12, (TODAY.month - 1 + k) % 12 + 1
        thu = [dt.date(y, m, d) for d in range(1, 29) if dt.date(y, m, d).weekday() == 3]
        for d, what in ((thu[0], "Long-term OAT auction (first Thursday rule, lines not announced yet)"), (thu[2], "Medium-term OAT auction (third Thursday rule, lines not announced yet)")):
            if d >= TODAY and not (m == 8 or (m == 12 and what.startswith("Medium"))):
                out.append(dict(country="FR", date=d.isoformat(), title=what, amount_text="not announced", url="https://www.aft.gouv.fr/en/calendrier-des-adjudications"))
    return out


# ---------------------------------------------------------------- calendar
def ecb_meetings(get):
    t = get("https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html"); out = []
    for d, txt in re.findall(r"<dt[^>]*>(.*?)</dt>\s*<dd[^>]*>(.*?)</dd>", t, re.S):
        d = re.sub(r"<[^>]+>", "", d).strip(); txt = re.sub(r"<[^>]+>|\s+", " ", txt).strip()
        if re.fullmatch(r"\d{2}/\d{2}/\d{4}", d) and "monetary policy meeting" in txt and "non-monetary" not in txt and "Day 2" in txt and dmy(d, "/") >= TODAY.isoformat():
            out.append(dict(date=dmy(d, "/"), kind="ECB", title="ECB monetary policy decision and press conference", url="https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html"))
    return out


def ecb_key_rates(get):
    t = plain(get("https://www.ecb.europa.eu/stats/policy_and_exchange_rates/key_ecb_interest_rates/html/index.en.html"))
    t = t[t.find("Date (with effect from)"):]
    out = []
    for y, d, mo, dfr, mro, mbr, mlf in re.findall(r"\|\s*(\d{4})\s*\|\s*(\d{1,2}) (\w{3})\.?\s*\|\s*(-?[\d.]+)\s*\|\s*(-|[\d.]+)\s*\|\s*(-|[\d.]+)\s*\|\s*(-?[\d.]+)", t):
        if mo[:3] not in MON: continue
        out.append(dict(date=dt.date(int(y), MON.index(mo[:3]) + 1, int(d)).isoformat(), dfr=float(dfr), mro=float(mro if mro != "-" else mbr), mlf=float(mlf)))
        if len(out) >= 12: break
    return out


def eurostat_releases(get):
    from urllib.parse import quote
    a, b = TODAY.isoformat() + "T00:00:00+01:00", (TODAY + dt.timedelta(days=75)).isoformat() + "T00:00:00+01:00"
    js = json.loads(get(f"https://ec.europa.eu/eurostat/o/calendars/eventsJson?start={quote(a)}&end={quote(b)}&timeZone=Europe%2FLuxembourg"))
    out = []
    for e in js:
        if not e.get("euroind") or not any(t.get("label") == "Data release" for t in e.get("types", [])): continue
        out.append(dict(date=e["start"][:10], kind="Data", title=f"{e['title']} ({e.get('period', '')}), Eurostat".replace(" ()", ""), url="https://ec.europa.eu/eurostat/news/release-calendar"))
    return out


# ---------------------------------------------------------------- main
def update(get, log):
    snap = json.load(open(DATA / "checks" / "snapshot_2026-11-19_auctions.json"))
    res, up, failed = [], [], []
    def run(label, fn):
        try: return fn()
        except Exception as e: failed.append(label); log(f"  {label}: FAILED ({e})"); return None
    log("Auctions:")
    de = run("Germany results", lambda: de_results(get, log))
    if de: save_archive("auctions_de.csv", de)
    de = de or load_archive("auctions_de.csv")
    es_arch = load_archive("auctions_es.csv"); es = run("Spain results", lambda: es_results(get, log))
    if es: es_arch.update(es); save_archive("auctions_es.csv", es_arch)
    it_arch = load_archive("auctions_it.csv"); it = run("Italy results", lambda: it_results(get, log, it_arch))
    if it: save_archive("auctions_it.csv", it)
    fr = [r for r in snap["results"] if r["country"] == "FR"]
    cut = (TODAY - dt.timedelta(days=400)).isoformat()
    for src in (de.values(), es_arch.values(), it_arch.values(), fr):
        res += [r for r in src if r["date"] >= cut]
    res.sort(key=lambda r: (r["date"], r["country"]), reverse=True)
    up += run("Germany calendar", lambda: de_upcoming(get, log)) or [u for u in snap["upcoming"] if u["country"] == "DE" and u["date"] >= TODAY.isoformat()]
    up += run("Spain calendar", lambda: es_upcoming(get, log)) or [u for u in snap["upcoming"] if u["country"] == "ES" and u["date"] >= TODAY.isoformat()]
    up += fr_upcoming(); up.sort(key=lambda u: u["date"])

    # check against the readings of 19 Nov 2026
    tot = bad = 0; diffs = []
    cur = {(r["country"], r["date"], r.get("isin") or r["security"]): r for r in res}
    for s in snap["results"]:
        if s["country"] == "FR": continue
        c = cur.get((s["country"], s["date"], s.get("isin") or s["security"])) or next((r for r in res if r["country"] == s["country"] and r["date"] == s["date"] and abs((r["amount_bn"] or 0) - (s["amount_bn"] or 0)) < 0.0015), None)
        if not c: diffs.append(("missing", s["country"], s["date"], s["security"])); continue
        for k in ("bids_bn", "amount_bn", "avg_yield", "stop_yield", "bid_cover"):
            if s.get(k) is None: continue
            tot += 1
            if c.get(k) is None or abs(c[k] - s[k]) > 0.0015: bad += 1; diffs.append((s["country"], s["date"], k, s[k], c.get(k)))
    log(f"  Auctions against the readings of 19 Nov 2026: {tot} figures compared, {bad} differences, {diffs[:8]}")

    note_r = ("Medium and long-term lines. Germany: Finanzagentur workbook, allotted amount excludes the retention, history since 2015 in data/raw/auctions_de.csv. "
              "Spain: Tesoro Publico result pages, archived each day. Italy: MEF result PDFs, single-price auction, so the yield is the yield at the auction price. "
              "France: the AFT site refuses automated access, so French results are those read on 19 Nov 2026 and are not refreshed.")
    note_u = "Germany and Spain: issuers' calendars, read each day. France: date from the AFT calendar rule, not from a dated calendar. Italy: no machine-readable calendar found."
    json.dump(dict(asof=TODAY.isoformat(), note_results=note_r, note_upcoming=note_u, results=res, upcoming=up, failed=failed),
              open(DATA / "auctions.json", "w"), ensure_ascii=False, indent=0)
    log(f"  auctions.json: {len(res)} results in the last 400 days, {len(up)} upcoming; failed: {failed}")

    # ---- events
    ev_old = json.load(open(DATA / "events.json"))
    log("Calendar:")
    ecb = run("ECB meetings", lambda: ecb_meetings(get)); kr = run("ECB key rates", lambda: ecb_key_rates(get)); eu = run("Eurostat releases", lambda: eurostat_releases(get))
    keep = lambda kind: [e for e in ev_old["events"] if e["kind"] == kind and e["date"] >= TODAY.isoformat()]
    events = (ecb or keep("ECB")) + (eu or keep("Data"))
    events.sort(key=lambda e: e["date"])
    if kr:
        snap_kr = {r["date"]: r for r in ev_old.get("key_rates", [])}
        mism = [(r["date"], r, snap_kr[r["date"]]) for r in kr if r["date"] in snap_kr and any(abs(r[k] - snap_kr[r["date"]][k]) > 1e-9 for k in ("dfr", "mro", "mlf"))]
        log(f"  ECB key rates: {len(kr)} changes read, latest {kr[0]}; against previous file: {len(mism)} differences {mism[:3]}")
    log(f"  ECB meetings: {len(ecb or [])}, Eurostat euro-indicator releases: {len(eu or [])}")
    ev_old.update(events=events, key_rates=kr or ev_old.get("key_rates", []),
                  note="ECB meeting calendar and key rates from the ECB site, euro-indicator releases from the Eurostat release calendar, read each day.")
    json.dump(ev_old, open(DATA / "events.json", "w"), ensure_ascii=False, indent=0)
