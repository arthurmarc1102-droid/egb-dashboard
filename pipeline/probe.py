"""Download test of auction and calendar sources, run on GitHub Actions. Saves each response in probe/raw/ and a summary in probe/report.md."""
import urllib.request, datetime, pathlib, re, time
UA = {"User-Agent": "egb-dashboard/1.0 (+https://github.com/arthurmarc1102-droid/egb-dashboard)"}
PROBES = [
    ("fa_results", "https://www.deutsche-finanzagentur.de/en/federal-securities/issuances/issuance-results"),
    ("fa_calendar", "https://www.deutsche-finanzagentur.de/en/federal-securities/issuances/issuance-calendar"),
    ("aft_last", "https://www.aft.gouv.fr/en/dernieres-adjudications"),
    ("aft_calendar", "https://www.aft.gouv.fr/en/calendrier-des-adjudications"),
    ("aft_calendar_fr", "https://www.aft.gouv.fr/fr/calendrier-des-adjudications"),
    ("tesoro_bonos", "https://www.tesoro.es/deuda-publica/subastas/resultado-ultimas-subastas/bonos-del-estado"),
    ("tesoro_obligaciones", "https://www.tesoro.es/deuda-publica/subastas/resultado-ultimas-subastas/obligaciones-del-estado"),
    ("tesoro_calendar", "https://www.tesoro.es/deuda-publica/subastas/calendario"),
    ("mef_results_it", "https://www.dt.mef.gov.it/it/debito_pubblico/emissioni_titoli_di_stato_interni/risultati_aste/"),
    ("mef_results_en", "https://www.dt.mef.gov.it/en/debito_pubblico/emissioni_titoli_di_stato_interni/risultati_aste/"),
    ("mef_calendar_en", "https://www.dt.mef.gov.it/en/debito_pubblico/emissioni_titoli_di_stato_interni/calendario_emissioni/"),
    ("ecb_meetings", "https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html"),
    ("ecb_key_rates", "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/key_ecb_interest_rates/html/index.en.html"),
    ("eurostat_events", f"https://ec.europa.eu/eurostat/o/calendars/eventsJson?start={datetime.date.today()}&end={datetime.date.today() + datetime.timedelta(days=120)}"),
    ("eurostat_calendar_page", "https://ec.europa.eu/eurostat/news/release-calendar"),
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
    (raw / f"{name}.txt").write_text(txt[:2_000_000])
    links = sorted(set(re.findall(r'href="([^"]+\.(?:csv|xlsx?|pdf|json)[^"]*)"', txt)))[:40]
    out.append(f"## {name}\n- url: {url}\n- final: {final}\n- status: {status} | type: {ctype} | bytes: {len(body)} | {time.time()-t:.1f}s\n- file links: {links}\n")
(pathlib.Path("probe") / "report.md").write_text("\n".join(out))
print("\n".join(out))
