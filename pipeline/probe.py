"""Download test (run 4): is the Eurostat daily convergence dataset still published? Table of contents and SDMX attempts. Report in probe/report.md."""
import urllib.request, datetime, pathlib, re
UA = {"User-Agent": "egb-dashboard/1.0 (+https://github.com/arthurmarc1102-droid/egb-dashboard)"}
B = "https://ec.europa.eu/eurostat/api/dissemination/"
def get(u):
    with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=180) as r: return r.read()
raw = pathlib.Path("probe/raw"); raw.mkdir(parents=True, exist_ok=True)
out = [f"# Download test, Eurostat daily yields (catalogue and SDMX), {datetime.datetime.utcnow():%Y-%m-%d %H:%M} UTC\n"]
try:
    toc = get(B + "catalogue/toc/txt?lang=en").decode("utf-8", "replace"); lines = toc.splitlines()
    out.append(f"## table of contents: {len(toc)} bytes, {len(lines)} lines")
    hits = [l for l in lines if re.search(r"irt_lt_mcby|irt_euryld|irt_lt_gby|irt_h_|irt_st_d|_d\b.*(yield|interest)|(yield|interest).*daily", l, re.I)]
    out += ["  " + re.sub(r"\s+", " ", l)[:230] for l in hits[:60]]
    (raw / "eurostat_toc_interest.txt").write_text("\n".join(l for l in lines if re.search(r"irt_|interest rate|yield", l, re.I)))
except Exception as e: out.append(f"## table of contents: FAILED {e}")
tests = [("sdmx 2.1 data, daily, IT", B + "sdmx/2.1/data/irt_lt_mcby_d/D.MCBY.IT?startPeriod=2026-09-01&format=SDMX-CSV"),
         ("sdmx 2.1 data, daily, upper case", B + "sdmx/2.1/data/IRT_LT_MCBY_D/D.MCBY.IT?startPeriod=2026-09-01&format=SDMX-CSV"),
         ("sdmx 2.1 dataflow, daily", B + "sdmx/2.1/dataflow/ESTAT/irt_lt_mcby_d/latest?detail=allstubs"),
         ("statistics 1.0, daily, upper case", B + "statistics/1.0/data/IRT_LT_MCBY_D?format=JSON&geo=IT&lastTimePeriod=5"),
         ("statistics 1.0, monthly (control, known to work)", B + "statistics/1.0/data/irt_lt_mcby_m?format=JSON&geo=IT&lastTimePeriod=3"),
         ("sdmx 2.1 data, euro yield curves daily (control)", B + "sdmx/2.1/data/irt_euryld_d/D.PAR.Y10.EA?startPeriod=2026-11-01&format=SDMX-CSV")]
for label, url in tests:
    try: b = get(url); out.append(f"## {label}: {len(b)} bytes\n  {url}\n  " + b[:600].decode("utf-8", "replace").replace("\n", "\n  "))
    except Exception as e: out.append(f"## {label}: FAILED {e}\n  {url}")
(pathlib.Path("probe") / "report.md").write_text("\n".join(out) + "\n"); print("\n".join(out))
