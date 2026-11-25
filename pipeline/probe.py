"""Download test (run 7): (a) which API the Eurex statistics page calls for option series by strike; (b) structure of the Banca d'Italia table BMK0200
(column names, date range and row count only: no value is written, the bank's terms do not allow reproduction without authorisation). Report in probe/report.md."""
import urllib.request, datetime, pathlib, json, re, io, zipfile, csv
UA = {"User-Agent": "egb-dashboard/1.0 (+https://github.com/arthurmarc1102-droid/egb-dashboard)"}
S = "https://www.eurex.com/ex-en/data/statistics/market-statistics-online/100!onlineStats"
A = "https://www.eurex.com/api/v1/"
def get(u, extra=None):
    with urllib.request.urlopen(urllib.request.Request(u, headers={**UA, **(extra or {})}), timeout=120) as r: return r.read()
raw = pathlib.Path("probe/raw"); raw.mkdir(parents=True, exist_ok=True)
out = [f"# Download test, Eurex option series and Banca d'Italia BMK0200, {datetime.datetime.utcnow():%Y-%m-%d %H:%M} UTC\n"]
js = json.loads(get(A + f"overallstatistics/70050?busdate={datetime.date.today():%Y%m%d}"))
days = sorted(datetime.datetime.strptime(x[:10], "%d-%m-%Y").date() for x in js["header"]["tradingDates"]); bus = days[-2].strftime("%Y%m%d")
ov = json.loads(get(A + f"overallstatistics/70050?busdate={bus}")); exps = [(r["date"], r["contractType"]) for r in ov.get("dataRows", [])]
out.append(f"test date {bus}; OGBL expiries offered: {exps}")
# ---- (a) scripts of the page: every 'api/v1/...' string they contain
page = get(f"{S}?productGroupId=13328&productId=70050&viewType=3&busDate={bus}").decode("utf-8", "replace")
srcs = sorted(set(re.findall(r'<script[^>]+src="([^"]+)"', page))); out.append(f"## page scripts: {len(srcs)}")
found = {}
for s in srcs:
    u = s if s.startswith("http") else "https://www.eurex.com" + s
    if "eurex.com" not in u: out.append(f"- skipped (other host): {u[:120]}"); continue
    try:
        t = get(u).decode("utf-8", "replace"); hits = sorted(set(re.findall(r'api/v1/[A-Za-z0-9_\-/${}.+"\' ]{0,60}', t))); words = sorted(set(re.findall(r'[A-Za-z]*[Ss]tatistics[A-Za-z]*', t)))[:40]
        out.append(f"- {u[:140]}: {len(t)} chars, api strings {hits[:25]}, statistics words {words}")
        for h in hits: found[h] = u
        for m in re.finditer(r'overallstatistics', t): out.append("    context: " + t[max(0, m.start() - 350): m.start() + 500].replace("\n", " ")); break
    except Exception as e: out.append(f"- {u[:140]}: FAILED {e}")
# ---- candidate endpoints for one expiry, calls
exp = next((d for d, k in exps if k == "M"), exps[0][0] if exps else None)
out.append(f"\n## candidate endpoints for OGBL, expiry {exp}")
cands = [f"statistics/70050?busdate={bus}&cp=Call&month={exp[4:6]}&year={exp[:4]}", f"detailstatistics/70050?busdate={bus}&cp=Call&month={exp[4:6]}&year={exp[:4]}",
         f"overallstatistics/70050?busdate={bus}&cp=Call&month={exp[4:6]}&year={exp[:4]}", f"overallstatistics/70050/{exp}?busdate={bus}", f"statistics/70050/{exp}?busdate={bus}",
         f"contractstatistics/70050?busdate={bus}&date={exp}&cp=C", f"singlestatistics/70050?busdate={bus}&date={exp}", f"overallstatistics/70050?busdate={bus}&date={exp}&contractType=M&cp=Call",
         f"statistics/70050?busdate={bus}", f"detailedstatistics/70050?busdate={bus}&date={exp}", f"dailystatistics/70050?busdate={bus}&date={exp}"] if exp else []
for c in cands:
    try:
        b = get(A + c, {"Accept": "application/json"}); j = json.loads(b); rows = j.get("dataRows", []) if isinstance(j, dict) else j
        out.append(f"- OK {c}: {len(b)} bytes, keys {list(j)[:8] if isinstance(j, dict) else 'list'}, {len(rows)} rows, row keys {list(rows[0]) if rows else None}")
        if rows and any("strike" in k.lower() for k in rows[0]): out += ["    " + json.dumps(r)[:400] for r in rows[:3]]; (raw / "eurex_ogbl_series.json").write_bytes(b[:300000])
    except Exception as e: out.append(f"- {c}: {e}")
# ---- (b) Banca d'Italia BMK0200: structure only
for label, u in [("DATA", "https://a2a.bancaditalia.it/infostat/dataservices/export/EN/CSV/DATA/CUBE/BANKITALIA/DIFF/BMK0200"), ("ALL", "https://a2a.bancaditalia.it/infostat/dataservices/export/EN/CSV/ALL/CUBE/BANKITALIA/DIFF/BMK0200")]:
    try:
        b = get(u); out.append(f"\n## Banca d'Italia BMK0200 {label}: {len(b)} bytes, starts with {b[:4]!r}")
        z = zipfile.ZipFile(io.BytesIO(b))
        for n in z.namelist():
            t = z.read(n).decode("utf-8-sig", "replace"); lines = t.splitlines(); out.append(f"- file {n}: {len(t)} chars, {len(lines)} lines; header: {lines[0][:400] if lines else ''}")
            dates = sorted(set(re.findall(r"\b(?:19|20)\d\d-\d\d-\d\d\b", t))); out.append(f"    dates found: {len(dates)}, from {dates[0] if dates else None} to {dates[-1] if dates else None}")
            if lines and len(lines) > 1:
                rd = list(csv.reader(io.StringIO(t), delimiter=";" if lines[0].count(";") > lines[0].count(",") else ","))
                for i, col in enumerate(rd[0]):
                    vals = sorted({r[i] for r in rd[1:] if len(r) > i}); 
                    if len(vals) <= 25 and not any(re.fullmatch(r"-?\d+[.,]\d+", v) for v in vals): out.append(f"    column {col}: {vals}")
                    else: out.append(f"    column {col}: {len(vals)} distinct values (not listed)")
    except Exception as e: out.append(f"\n## Banca d'Italia BMK0200 {label}: FAILED {e}")
(pathlib.Path("probe") / "report.md").write_text("\n".join(out) + "\n"); print("\n".join(out)[:9000])
