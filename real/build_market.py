"""Build data/market.json from the staged transcriptions.

Each source was read twice, independently, with a different slicing (staging/A and staging/B, staging/C/*_A and *_B).
A value is kept only when both readings agree. Anything else is listed and left out: nothing is repaired or filled.
"""
import csv, json, pathlib, sys, datetime, collections

ST = pathlib.Path("/home/claude/egb-dev/staging")
OUT = pathlib.Path(next((a for a in sys.argv[1:] if not a.startswith("--")), "/home/claude/egb/data"))
TENORS = {"R01": 1, "R02": 2, "R03": 3, "R05": 5, "R07": 7, "R10": 10, "R15": 15, "R20": 20, "R30": 30}
COUNTRY = {"DE": "Germany", "FR": "France", "IT": "Italy", "ES": "Spain", "NL": "Netherlands", "BE": "Belgium", "AT": "Austria", "PT": "Portugal"}
report = []
USE_SPAIN = "--spain" in sys.argv
USE_FRANCE = "--france" in sys.argv      # TEC indices: private use only, see sources
AUTHORISED = "--authorised" in sys.argv  # Euronext and Eurex authorisations obtained by Arthur (20 Nov 2026)


def rows(path):
    if not path.exists():
        report.append(f"MISSING FILE {path}")
        return []
    with open(path, newline="") as fh:
        return [r for r in csv.DictReader(l for l in fh if not l.startswith("#")) if r.get("date") or r.get("geo")]


def num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def confirm(a, b, label):
    """Keep the keys present in both readings with the same value. Report everything else."""
    keep = {}
    only_a = sorted(set(a) - set(b)); only_b = sorted(set(b) - set(a))
    diff = [(k, a[k], b[k]) for k in sorted(set(a) & set(b)) if a[k] != b[k]]
    for k in set(a) & set(b):
        if a[k] == b[k] and a[k] is not None:
            keep[k] = a[k]
    report.append(f"{label}: A={len(a)} B={len(b)} confirmed={len(keep)} mismatches={len(diff)} onlyA={len(only_a)} onlyB={len(only_b)}")
    for d in diff[:40]: report.append(f"   MISMATCH {d}")
    for k in only_a[:15]: report.append(f"   only in A {k}")
    for k in only_b[:15]: report.append(f"   only in B {k}")
    return keep


def checks(label, dates, values, lo, hi, jump):
    bad = [d for d in dates if datetime.date.fromisoformat(d).weekday() > 4]
    if bad: report.append(f"   {label}: weekend dates {bad[:5]}")
    if dates != sorted(set(dates)): report.append(f"   {label}: dates not sorted or duplicated")
    out = [(d, v) for d, v in zip(dates, values) if not lo <= v <= hi]
    if out: report.append(f"   {label}: out of range {out[:5]}")
    j = [(dates[i], values[i - 1], values[i]) for i in range(1, len(values)) if abs(values[i] - values[i - 1]) > jump]
    if j: report.append(f"   {label}: large daily moves (kept, to review) {j[:8]}")


series = []

# ---------------------------------------------------------------- German par-yield curve (Bundesbank)
A = {(r["date"], c): num(r[c]) for r in rows(ST / "A/de_par.csv") for c in TENORS if c in r}
B = {}
for f in ("B/de_par_g1.csv", "B/de_par_g2.csv"):
    for r in rows(ST / f):
        for c in TENORS:
            if c in r: B[(r["date"], c)] = num(r[c])
ok = confirm(A, B, "German curve")
for code, t in TENORS.items():
    pts = sorted((d, v) for (d, c), v in ok.items() if c == code)
    if len(pts) < 30: report.append(f"   {code}: only {len(pts)} confirmed points, series dropped"); continue
    dates, values = [p[0] for p in pts], [p[1] for p in pts]
    checks(f"DE {t}Y", dates, values, -1, 10, 0.30)
    series.append(dict(id=f"DE_{t}Y", group="yield", country="DE", tenor=t, name=f"Germany {t}Y", unit="pct", decimals=2,
                       kind="par yield from the Svensson curve of listed Federal securities", source="bbk_curve", dates=dates, values=values))

# ---------------------------------------------------------------- euro short-term rate (Bundesbank republication of the ECB rate)
ea = {r["date"]: num(r["value"]) for r in rows(ST / "C/estr_A.csv")}
eb = {r["date"]: num(r["value"]) for r in rows(ST / "C/estr_B.csv")}
ok = confirm(ea, eb, "ESTR")
if len(ok) >= 30:
    dates = sorted(ok); values = [ok[d] for d in dates]
    checks("ESTR", dates, values, -1, 6, 0.30)
    series.append(dict(id="ESTR", group="mm", name="Euro short-term rate", short="ESTR", unit="pct", decimals=3, source="bbk_estr", dates=dates, values=values))

# ---------------------------------------------------------------- monthly 10-year yields by country (Eurostat)
m = collections.defaultdict(dict)
for r in rows(ST / "C/mcby_m.csv"):
    if num(r["value"]) is not None: m[r["geo"]][r["month"]] = num(r["value"])
chk = [(r["geo"], r["month"], num(r["value"])) for r in rows(ST / "C/mcby_B.csv")]      # second reading: last 11 to 13 months, 7 countries
bad = [(g, mo, v, m.get(g, {}).get(mo)) for g, mo, v in chk if m.get(g, {}).get(mo) != v]
report.append(f"Eurostat monthly 10Y: countries={sorted(m)} points={sum(len(v) for v in m.values())} control points={len(chk)} control mismatches={len(bad)}")
for b in bad: report.append(f"   CONTROL MISMATCH {b}")
for g in COUNTRY:
    if g not in m: continue
    months = sorted(m[g]); values = [m[g][x] for x in months]
    odd = [(months[i], values[i]) for i in range(len(values)) if not -1 <= values[i] <= 15 or (i and abs(values[i] - values[i - 1]) > 1.0)]
    if odd: report.append(f"   {g} monthly: values to review {odd[:6]}")
    series.append(dict(id=f"{g}_10Y_M", group="yield_m", country=g, tenor=10, name=f"{COUNTRY[g]} 10Y, monthly average", unit="pct", decimals=2,
                       source="eurostat_mcby", dates=[x + "-01" for x in months], values=values))

# ---------------------------------------------------------------- Spain: Banco de Espana table 1.3, daily rows of the PDF (about seven weeks)
def es_rows(path, cols):
    out = {}
    if not path.exists(): report.append(f"MISSING FILE {path}"); return out
    lines = [l for l in open(path) if not l.startswith("#")]
    for r in list(csv.reader(lines))[1:]:
        for idx, t in cols.items():
            v = num(r[idx])
            if v is not None: out[(r[0], t)] = v
    return out
ES_COLS = {8: 3, 10: 5, 11: 10, 12: 15}          # position of the 3, 5, 10 and 15-year bond columns among the 12 printed columns
ok = confirm(es_rows(ST / "ext/es_bde_ti_1_3_daily.csv", ES_COLS), es_rows(ST / "ext/es_bde_ti_1_3_daily_B.csv", ES_COLS), "Spain daily yields")
if USE_SPAIN:
    for t in sorted(set(ES_COLS.values())):
        pts = sorted((d, v) for (d, tt), v in ok.items() if tt == t)
        if len(pts) < 20: report.append(f"   ES {t}Y: only {len(pts)} points, series dropped"); continue
        dates, values = [p[0] for p in pts], [p[1] for p in pts]
        checks(f"ES {t}Y", dates, values, -1, 10, 0.30)
        series.append(dict(id=f"ES_{t}Y", group="yield", country="ES", tenor=t, name=f"Spain {t}Y", unit="pct", decimals=2,
                           kind="yield on the secondary market, Banco de Espana table 1.3", source="bde_yields", dates=dates, values=values))

# ---------------------------------------------------------------- France: TEC constant-maturity indices (Banque de France export, calculated by Euronext Paris)
TEC_ORDER = [1, 10, 15, 2, 20, 25, 3, 30, 5, 7]      # column order of the export
def tec_rows(path):
    out = {}
    if not path.exists(): report.append(f"MISSING FILE {path}"); return out
    for l in open(path):
        f = l.strip().split(";")
        if not l.strip() or l.startswith("#") or f[0] == "date": continue
        if len(f) != 11: report.append(f"   TEC line with {len(f)} fields skipped: {l.strip()[:60]}"); continue
        for mat, v in zip(TEC_ORDER, f[1:]):
            v = num(v.replace(",", "."))
            if v is not None: out[(f[0], mat)] = v
    return out
ta, tb = tec_rows(ST / "F/tec_A.csv"), tec_rows(ST / "F/tec_B.csv")
ok = confirm(ta, tb, "France TEC")
third = tec_rows(ST / "ext/fr_webstat_tec_daily_recent.csv")           # earlier reading by the audit, twelve recent days
bad3 = [(k, v, ok.get(k)) for k, v in third.items() if k in ok and ok[k] != v]
report.append(f"France TEC against the audit reading: {len([k for k in third if k in ok])} common points, mismatches={len(bad3)} {bad3[:5]}")


def page_tables(path):
    """Tables copied from the Banque de France daily pages: a line 'index;dd/mm/yyyy;...' then one line per index, values as printed."""
    out, dates = {}, None
    if not path.exists(): report.append(f"MISSING FILE {path}"); return out
    for l in open(path):
        l = l.strip()
        if not l or l.startswith("#"): continue
        f = l.split(";")
        if f[0] == "index":
            dates = [datetime.datetime.strptime(x, "%d/%m/%Y").date().isoformat() for x in f[1:]]; continue
        if dates is None or len(f) != len(dates) + 1 or not f[0].startswith("TEC"):
            report.append(f"   daily page line skipped in {path.name}: {l[:60]}"); continue
        mat = int(f[0][3:])
        for d, v in zip(dates, f[1:]):
            v = num(v.replace(",", "."))
            if v is None: continue
            if (d, mat) in out and out[(d, mat)] != v: report.append(f"   daily pages disagree with each other on {(d, mat)}: {out[(d, mat)]} and {v}")
            out[(d, mat)] = v
    return out

# The export stops one day before the daily page. The latest day comes from the daily page, read twice with two different questions.
pa, pb = page_tables(ST / "F/tec_page_2026-11-18_A.txt"), page_tables(ST / "F/tec_page_2026-11-18_B.txt")
okp = confirm({k: v for k, v in pa.items() if k in pb}, pb, "France TEC, daily page of 18 Nov (two readings, last two days)")
badp = [(k, v, ok[k]) for k, v in pa.items() if k in ok and ok[k] != v]
report.append(f"France TEC, daily page of 18 Nov against the export: {len([k for k in pa if k in ok])} common points, mismatches={len(badp)} {badp[:5]}")
added = {k: v for k, v in okp.items() if k not in ok}
if not badp:
    ok.update(added)
    report.append(f"France TEC: {len(added)} values added from the daily page for {sorted({k[0] for k in added})}, a day the export does not have yet")
else:
    report.append("France TEC: daily page not used, it disagrees with the export")

# Third check on the days that look odd and on a few others: the daily pages are a publication separate from the export.
chk = page_tables(ST / "ext/fr_bdf_daily_pages_check.txt")
common = [k for k in chk if k in ok]
badc = [(k, chk[k], ok[k]) for k in common if chk[k] != ok[k]]
report.append(f"France TEC against the Banque de France daily pages: {len(common)} common points on {len({k[0] for k in common})} dates, mismatches={len(badc)} {badc[:8]}")
miss = sorted({k[0] for k in chk if k not in ok})
if miss: report.append(f"   dates on the daily pages that the loaded history does not have: {miss}")
if USE_FRANCE:
    for mat in (1, 2, 3, 5, 7, 10, 15, 20, 30):
        pts = sorted((d, v) for (d, mm), v in ok.items() if mm == mat)
        if len(pts) < 30: report.append(f"   FR {mat}Y: only {len(pts)} confirmed points, series dropped"); continue
        dates, values = [p[0] for p in pts], [p[1] for p in pts]
        checks(f"FR {mat}Y", dates, values, -1, 12, 0.30)
        series.append(dict(id=f"FR_{mat}Y", group="yield", country="FR", tenor=mat, name=f"France {mat}Y", unit="pct", decimals=3, restricted=True,
                           kind="TEC constant-maturity index", source="bdf_tec", dates=dates, values=values))

last = max((s["dates"][-1] for s in series if s["group"] == "yield"), default=None)
json.dump(dict(generated=datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
               private=USE_FRANCE and not AUTHORISED,
               status=("Private version, not for sharing: it holds Euronext and Eurex data that may not be republished. " if USE_FRANCE and not AUTHORISED else "") + "Snapshot of 19 Nov 2026, not refreshed automatically yet.",
               footer="End-of-day data from official sources. Every source, its status and the methods are listed under Sources. No number on this page is estimated or filled in.",
               series=series), open(OUT / "market.json", "w"))
print("\n".join(report))
print("series written:", [(s["id"], len(s["values"]), s["dates"][0], s["dates"][-1]) for s in series])
print("last daily date:", last)
