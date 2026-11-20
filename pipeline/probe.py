"""Download test of every source, run on GitHub Actions. Writes probe/report.md: status, size, start and end of each response."""
import urllib.request, datetime, pathlib, time
UA = {"User-Agent": "egb-dashboard/0.1 (+https://github.com/arthurmarc1102-droid/egb-dashboard)"}
BBK = "https://api.statistiken.bundesbank.de/rest/data"
D = datetime.date.today()
PROBES = [
    ("bbk_par_sdmxjson", f"{BBK}/BBSIS/D.I.ZAR.ZI.EUR.S1311.B.A604.R10XX.R.A.A._Z._Z.A?format=sdmx_json&lang=en&startPeriod=2026-11-10"),
    ("bbk_par_csv", f"{BBK}/BBSIS/D.I.ZAR.ZI.EUR.S1311.B.A604.R10XX.R.A.A._Z._Z.A?format=csv&lang=en&startPeriod=2026-11-10"),
    ("bbk_par_history_depth", f"{BBK}/BBSIS/D.I.ZAR.ZI.EUR.S1311.B.A604.R02XX+R10XX+R30XX.R.A.A._Z._Z.A?format=sdmx_json&lang=en&startPeriod=2015-01-01&endPeriod=2015-01-09"),
    ("bbk_estr", f"{BBK}/BBMMB/D.EU000A2X2A25.WT?format=sdmx_json&lang=en&startPeriod=2026-11-10"),
    ("bbk_bond_prices", f"{BBK}/BBSSY/D.KCP+KDP+REN.EUR..DE000BU2Z056.?format=sdmx_json&lastNObservations=3"),
    ("bdf_tec_export", "https://webstat.banque-france.fr/export/csv-columns/fr/selection/5385693"),
    ("bdf_tec_daily_page", f"https://www.banque-france.fr/fr/statistiques/taux-et-cours/indices-obligataires-{D.isoformat()}"),
    ("bde_ead002_csv", "https://www.bde.es/webbe/es/estadisticas/compartido/datos/csv/ead002.csv"),
    ("eurostat_mcby_m", "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/irt_lt_mcby_m?format=JSON&geo=DE&geo=FR&lastTimePeriod=3"),
    ("eurex_stats_fgbl", f"https://www.eurex.com/api/v1/overallstatistics/34656?busdate={(D - datetime.timedelta(days=1)).strftime('%Y%m%d')}"),
    ("eurex_deliverables", "https://www.eurex.com/ex-en/data/clearing-files/notified-deliverable-bonds-conversion-factors"),
    ("rss_ecb", "https://www.ecb.europa.eu/rss/press.html"),
    ("rss_bbk", "https://www.bundesbank.de/service/rss/en/633306/feed.rss"),
]
out = [f"# Download test, {datetime.datetime.utcnow():%Y-%m-%d %H:%M} UTC, run on GitHub Actions\n"]
for name, url in PROBES:
    t = time.time()
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90) as r:
            body = r.read(); status = r.status; ctype = r.headers.get("Content-Type")
    except Exception as e:
        body = getattr(e, "read", lambda: b"")() or b""; status = getattr(e, "code", type(e).__name__); ctype = "-"
    txt = body.decode("utf-8", "replace")
    out.append(f"## {name}\n- url: {url}\n- status: {status} | type: {ctype} | bytes: {len(body)} | {time.time()-t:.1f}s\n\n```\n{txt[:1500]}\n```\n\n... end:\n\n```\n{txt[-700:] if len(txt) > 1500 else ''}\n```\n")
p = pathlib.Path("probe"); p.mkdir(exist_ok=True); (p / "report.md").write_text("\n".join(out))
print("\n".join(l for l in out if l.startswith("## ") or l.startswith("- status")))
