"""Download test (run 12): official daily yields for Belgium, Netherlands, Austria, Portugal (and cross-checks from the Riksbank).
Report in probe/report.md; small raw samples in probe/raw/."""
import urllib.request, datetime, pathlib, json, re

UA = {"User-Agent": "egb-dashboard/1.0 (+https://github.com/arthurmarc1102-droid/egb-dashboard)"}
raw = pathlib.Path("probe/raw"); raw.mkdir(parents=True, exist_ok=True)
out = [f"# Download test, official daily yields BE NL AT PT, {datetime.datetime.now(datetime.timezone.utc):%Y-%m-%d %H:%M} UTC\n"]


def get(u, accept=None):
    h = dict(UA)
    if accept: h["Accept"] = accept
    with urllib.request.urlopen(urllib.request.Request(u, headers=h), timeout=120) as r: return r.read()


def try_(label, url, save=None, accept=None, show=500):
    try:
        b = get(url, accept)
        if save: (raw / save).write_bytes(b[:3_000_000])
        out.append(f"## OK {label}: {len(b)} bytes\n  {url}\n  " + b[:show].decode("utf-8", "replace").replace("\n", "\n  "))
        return b
    except Exception as e:
        out.append(f"## FAILED {label}: {e}\n  {url}"); return None


# ---- Riksbank: list of government bond series
b = try_("Riksbank series list", "https://api.riksbank.se/swea/v1/Series", show=0)
if b:
    try:
        ser = json.loads(b); gv = [s for s in ser if "GVB" in s.get("seriesId", "")]
        out.append("  government bond series: " + "; ".join(f"{s['seriesId']} ({s.get('shortDescription') or s.get('longDescription','')[:40]}, from {s.get('observationMinDate')})" for s in gv))
        out.append("  keys of a series: " + str(list(ser[0].keys())))
    except Exception as e: out.append(f"  parse: {e}")
try_("Riksbank NL 10Y since 2015", "https://api.riksbank.se/swea/v1/Observations/NLGVB10Y/2015-01-01/" + f"{datetime.date.today()}", save="riksbank_NLGVB10Y.json", show=200)
try_("Riksbank NL 5Y", "https://api.riksbank.se/swea/v1/Observations/NLGVB5Y/2026-11-01/" + f"{datetime.date.today()}", show=300)
try_("Riksbank DE 10Y (cross-check)", "https://api.riksbank.se/swea/v1/Observations/DEGVB10Y/2026-11-01/" + f"{datetime.date.today()}", show=300)
try_("Riksbank terms page", "https://www.riksbank.se/en-gb/statistics/interest-rates-and-exchange-rates/retrieving-interest-rates-and-exchange-rates-via-api/", save="riksbank_api_page.html", show=0)

# ---- Belgium
try_("Belgian Debt Agency, OLO reference prices XML", "https://www.debtagency.be/sites/default/files/content/download/files/dm_olos.xml", save="be_dm_olos.xml", show=900)
for u in ["https://nsidisseminate-stat.nbb.be/rest/data/BE2,DF_IROLOBE2,1.0/D..F?startPeriod=2026-11-01",
          "https://nsidisseminate-stat.nbb.be/rest/data/BE2,DF_IROLOBE2,1.0/all?startPeriod=2026-11-01&dimensionAtObservation=AllDimensions",
          "https://stat.nbb.be/restsdmx/sdmx.ashx/GetData/IROLOBE2/..D/all?startTime=2026-11-01",
          "https://stat.nbb.be/restsdmx/sdmx.ashx/GetDataStructure/IROLOBE2"]:
    try_("NBB.Stat fixed-maturity OLO yields", u, accept="application/vnd.sdmx.data+csv;version=1.0.0, application/xml;q=0.9, */*;q=0.8", show=700)
try_("NBB dataexplorer page", "https://dataexplorer.nbb.be/vis?lc=en&df%5Bds%5D=disseminate&df%5Bid%5D=DF_IROLOBE2&df%5Bag%5D=BE2&df%5Bvs%5D=1.0&dq=D..F", show=0, save="nbb_explorer.html")
p = raw / "nbb_explorer.html"
if p.exists():
    t = p.read_text(errors="replace"); out.append("  api hosts in explorer page: " + str(sorted(set(re.findall(r"https?://[a-z0-9\-\.]+nbb\.be[^\"' ]{0,60}", t)))[:15]))

# ---- Netherlands, DSTA file page
b = try_("DSTA yields on DSLs page", "https://english.dsta.nl/latest/statistical-information/yields-on-dsls", show=0, save="dsta_page.html")
if b:
    links = sorted(set(re.findall(r'href="([^"]+(?:\.ods|\.xlsx|\.xls|/documents/[^"]+))"', b.decode("utf-8", "replace"))))
    out.append("  links: " + str(links[:15]))
    for l in links:
        if "2010" in l or l.endswith((".ods", ".xlsx")):
            u = l if l.startswith("http") else "https://english.dsta.nl" + l
            d = try_("DSTA document", u, show=0)
            if d and d[:2] != b"PK":
                m = re.findall(r'href="([^"]+\.(?:ods|xlsx))"', d.decode("utf-8", "replace"))
                for f in m[:1]:
                    try_("DSTA file", f if f.startswith("http") else "https://english.dsta.nl" + f, save="dsta_yields.ods", show=0)
            elif d: (raw / "dsta_yields.ods").write_bytes(d)
            break

# ---- Austria, OeNB
for u in ["https://www.oenb.at/isadataservice/data?lang=EN&hierid=11&pos=VDBKISDUDR",
          "https://www.oenb.at/isawebstat/stabfrage/createReport?lang=EN&original=false&report=2.8",
          "https://www.oenb.at/en/Statistics/Standardized-Tables/interest-rates-and-exchange-rates/austrian-government-bond-yields/average-government-bond-yields-weighted-by-outstanding-amounts-daily-averages.html"]:
    b = try_("OeNB", u, show=300, save="oenb_" + str(abs(hash(u)) % 1000) + ".html")
    if b:
        t = b.decode("utf-8", "replace"); out.append("  data links: " + str(sorted(set(re.findall(r'(?:href|src)="([^"]*(?:isaweb|isadata|createReport|\.csv|\.xls|dataservice)[^"]*)"', t)))[:12]))

# ---- Portugal, BPstat API
b = try_("BPstat domains", "https://bpstat.bportugal.pt/data/v1/domains/?lang=EN", show=0, save="bpstat_domains.json")
if b:
    try:
        js = json.loads(b); items = js if isinstance(js, list) else js.get("results", js.get("data", []))
        hits = [d for d in items if re.search(r"secondary|market|interest|yield", json.dumps(d), re.I)]
        out.append("  domains matching: " + "; ".join(f"{d.get('id')} {d.get('label') or d.get('name')}" for d in hits[:20]))
        for d in hits[:4]:
            db = try_(f"BPstat datasets of domain {d.get('id')}", f"https://bpstat.bportugal.pt/data/v1/domains/{d.get('id')}/datasets/?lang=EN", show=0)
            if db:
                ds = json.loads(db); lst = ds if isinstance(ds, list) else ds.get("results", ds.get("link", {}).get("item", []) if isinstance(ds.get("link"), dict) else [])
                out.append("    " + json.dumps(ds)[:1500])
    except Exception as e: out.append(f"  parse: {e}")
try_("BPstat series search", "https://bpstat.bportugal.pt/data/v1/series/?lang=EN&search=treasury%20bonds%20yield", show=1500)

(pathlib.Path("probe") / "report.md").write_text("\n".join(out) + "\n"); print("\n".join(out)[:12000])
