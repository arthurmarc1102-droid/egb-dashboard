"""Download test (run 13): details for Belgium (NBB maturities, history), Riksbank government bond series, Portugal (BPstat secondary market),
Austria (OeNB reports). Report in probe/report.md."""
import urllib.request, datetime, pathlib, json, re, csv, io

UA = {"User-Agent": "egb-dashboard/1.0 (+https://github.com/arthurmarc1102-droid/egb-dashboard)"}
raw = pathlib.Path("probe/raw"); raw.mkdir(parents=True, exist_ok=True)
out = [f"# Download test, BE NL PT AT details, {datetime.datetime.now(datetime.timezone.utc):%Y-%m-%d %H:%M} UTC\n"]
def get(u, accept=None):
    h = dict(UA)
    if accept: h["Accept"] = accept
    with urllib.request.urlopen(urllib.request.Request(u, headers=h), timeout=180) as r: return r.read()

# ---- Belgium: maturities and history
try:
    b = get("https://nsidisseminate-stat.nbb.be/rest/data/BE2,DF_IROLOBE2,1.0/D..F?startPeriod=2015-01-01", "application/vnd.sdmx.data+csv;version=1.0.0")
    (raw / "nbb_irolobe2_daily.csv").write_bytes(b)
    rows = list(csv.DictReader(io.StringIO(b.decode())))
    by = {}
    for r in rows: by.setdefault(r["IROLOBE2_MATUR"], []).append(r["TIME_PERIOD"])
    out.append(f"## NBB daily fixed-maturity OLO yields since 2015: {len(b)} bytes, {len(rows)} rows")
    for m in sorted(by, key=lambda x: (len(x), x)): out.append(f"  - {m}: {len(by[m])} values, {min(by[m])} to {max(by[m])}")
except Exception as e: out.append(f"## NBB daily: FAILED {e}")
try:
    b = get("https://nsidisseminate-stat.nbb.be/rest/dataflow/BE2/DF_IROLOBE2/1.0?references=all", "application/vnd.sdmx.structure+json;version=1.0")
    js = json.loads(b); txt = json.dumps(js)
    out.append(f"## NBB structure: {len(b)} bytes; names: " + str(sorted(set(re.findall(r'"name": "([^"]{3,80})"', txt)))[:40]))
except Exception as e: out.append(f"## NBB structure: FAILED {e}")
# ---- Riksbank: full list of government bond series
try:
    ser = json.loads(get("https://api.riksbank.se/swea/v1/Series"))
    out.append("## Riksbank government bond series")
    for s in ser:
        if "GVB" in s["seriesId"]: out.append(f"  - {s['seriesId']}: {s['shortDescription']} | {s['longDescription'][:120]} | source {s.get('source')} | {s['observationMinDate']} to {s['observationMaxDate']} closed {s['seriesClosed']}")
except Exception as e: out.append(f"## Riksbank: FAILED {e}")
p = raw / "riksbank_api_page.html"
# ---- Portugal: BPstat secondary market domain
try:
    js = json.loads(get("https://bpstat.bportugal.pt/data/v1/domains/26/datasets/?lang=EN"))
    out.append("## BPstat domain 26 (secondary market) datasets")
    for it in js["link"]["item"]:
        ds = it["extension"]["id"]; out.append(f"  - {ds}: {it['label'][:200]} | {it['extension'].get('num_series')} series, updated {it['extension'].get('obs_updated_at')}")
        try:
            d = json.loads(get(f"https://bpstat.bportugal.pt/data/v1/domains/26/datasets/{ds}/?lang=EN"))
            (raw / f"bpstat_26_{ds}.json").write_text(json.dumps(d)[:2_000_000])
            dims = d.get("dimension", {}); out.append("      dimensions: " + "; ".join(f"{k}: {[v['label'] for v in dd.get('category', {}).get('label', {}).values()][:0] or list(dd.get('category', {}).get('label', {}).values())[:12]}" for k, dd in dims.items() if k not in ('reference_date', 'time')))
            ext = d.get("extension", {}); sers = ext.get("series", [])
            out.append(f"      {len(sers)} series; first: " + "; ".join(f"{s.get('id')} {s.get('label','')[:90]}" for s in sers[:25]))
            t = d.get("dimension", {}).get("reference_date", {}).get("category", {}).get("index", [])
            if t: out.append(f"      dates: {len(t)}, from {t[0] if isinstance(t, list) else list(t)[0]} to {t[-1] if isinstance(t, list) else list(t)[-1]}")
        except Exception as e: out.append(f"      detail: FAILED {e}")
except Exception as e: out.append(f"## BPstat: FAILED {e}")
# ---- Austria: OeNB report page, look for data download links and report numbers
try:
    t = get("https://www.oenb.at/isawebstat/stabfrage/createReport?lang=EN&original=false&report=2.8").decode("utf-8", "replace")
    txt = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", re.sub(r"(?s)<(script|style).*?</\1>", " ", t)))
    out.append("## OeNB report 2.8 text: " + txt[:1500])
    out.append("  links: " + str(sorted(set(re.findall(r'href="([^"]*(?:report=|export|download|csv|xls)[^"]*)"', t)))[:30]))
except Exception as e: out.append(f"## OeNB: FAILED {e}")
for rep in ("2.8.1", "2.8.2", "2.9", "2.8.3"):
    try:
        t = get(f"https://www.oenb.at/isawebstat/stabfrage/createReport?lang=EN&original=false&report={rep}").decode("utf-8", "replace")
        txt = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", re.sub(r"(?s)<(script|style).*?</\1>", " ", t)))
        i = txt.find("Table"); out.append(f"## OeNB report {rep}: " + txt[max(0, i - 100): i + 900])
        out.append("  export links: " + str(sorted(set(re.findall(r'href="([^"]*(?:export|download|csv|xls|ISAWEB_|dataservice)[^"]*)"', t)))[:12]))
    except Exception as e: out.append(f"## OeNB report {rep}: FAILED {e}")
(pathlib.Path("probe") / "report.md").write_text("\n".join(out) + "\n"); print("\n".join(out)[:12000])
