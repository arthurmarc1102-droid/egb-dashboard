"""Download test of auction and calendar sources, run on GitHub Actions. Saves each response in probe/raw/ and a summary in probe/report.md."""
import urllib.request, datetime, pathlib, re, time
UA = {"User-Agent": "egb-dashboard/1.0 (+https://github.com/arthurmarc1102-droid/egb-dashboard)"}
FA = "https://www.deutsche-finanzagentur.de/fileadmin/user_upload/Institutionelle-investoren/auktionen/"
MEF = "https://www.dt.mef.gov.it/en/debito_pubblico/emissioni_titoli_di_stato_interni/risultati_aste/"
ES_EV = "https://ec.europa.eu/eurostat/o/calendars/eventsJson"
PROBES = [
    ("fa_results.xlsx", FA + "emissionsergebnisse_aktuell_en.xlsx"),
    ("fa_history.xlsx", FA + "emissionshistorie_en.xlsx"),
    ("mef_btp10", MEF + "risultati_aste_btp_10_anni/index.html"),
    ("mef_btp5", MEF + "risultati_aste_btp_5_anni/index.html"),
    ("mef_archive", MEF + "achivio_dati_storici/"),
    ("eurostat_ev1", ES_EV + "?start=2026-11-30T00:00:00&end=2027-01-11T00:00:00&theme=&category=&keywords=&isEuroindicator=true&authorInclude=&authorExclude="),
    ("eurostat_ev2", ES_EV + "?start=2026-11-30&end=2027-01-11"),
    ("eurostat_ev3", ES_EV + "?start=2026-11-30T00%3A00%3A00%2B01%3A00&end=2027-01-11T00%3A00%3A00%2B01%3A00&timeZone=Europe%2FLuxembourg"),
]
raw = pathlib.Path("probe/raw"); raw.mkdir(parents=True, exist_ok=True)
out = [f"# Download test, auctions and calendars, {datetime.datetime.utcnow():%Y-%m-%d %H:%M} UTC\n"]
for name, url in PROBES:
    t = time.time()
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90) as r:
            body = r.read(); status = r.status; ctype = r.headers.get("Content-Type"); final = r.geturl()
    except Exception as e:
        body = getattr(e, "read", lambda: b"")() or b""; status = getattr(e, "code", type(e).__name__); ctype = "-"; final = url
    txt = body.decode("utf-8", "replace")
    (raw / name).write_bytes(body) if name.endswith(".xlsx") else (raw / f"{name}.txt").write_text(txt[:2_000_000])
    links = sorted(set(re.findall(r'href="([^"]+\.(?:csv|xlsx?|pdf|json)[^"]*)"', txt)))[:40]
    out.append(f"## {name}\n- url: {url}\n- final: {final}\n- status: {status} | type: {ctype} | bytes: {len(body)} | {time.time()-t:.1f}s\n- file links: {links}\n")
(pathlib.Path("probe") / "report.md").write_text("\n".join(out))
print("\n".join(out))
