"""Download test (run 3): Eurostat daily EMU convergence yields (irt_lt_mcby_d). Report in probe/report.md."""
import urllib.request, datetime, pathlib, json, re
UA = {"User-Agent": "egb-dashboard/1.0 (+https://github.com/arthurmarc1102-droid/egb-dashboard)"}
API = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/irt_lt_mcby_d?format=JSON&"
GEO = ["DE", "FR", "IT", "ES", "NL", "BE", "AT", "PT", "IE", "FI", "GR"]
def get(u):
    with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=120) as r: return r.read()
raw = pathlib.Path("probe/raw"); raw.mkdir(parents=True, exist_ok=True)
out = [f"# Download test, Eurostat daily convergence yields, {datetime.datetime.utcnow():%Y-%m-%d %H:%M} UTC\n"]
q = "&".join(f"geo={g}" for g in GEO)
for label, extra in [("since 2015-01-01", "&sinceTimePeriod=2015-01-01"), ("since 2026-09-01", "&sinceTimePeriod=2026-09-01"), ("last 15 periods", "&lastTimePeriod=15")]:
    url = API + q + extra
    try:
        b = get(url); js = json.loads(b)
    except Exception as e:
        out.append(f"## {label}: FAILED {e}\n  {url}"); continue
    geo = js["dimension"]["geo"]["category"]["index"]; tim = js["dimension"]["time"]["category"]["index"]; nt = len(tim)
    inv_t = {v: k for k, v in tim.items()}; days = [inv_t[i] for i in range(nt)]
    out.append(f"## {label}: {len(b)} bytes, updated {js.get('updated')}, {nt} periods from {days[0]} to {days[-1]}, {len(js['value'])} values")
    out.append(f"  url: {url}")
    out.append(f"  dimensions: { {k: list(v['category']['index'])[:4] for k, v in js['dimension'].items() if k not in ('geo', 'time')} }, flags: {len(js.get('status', {}))}")
    for g in GEO:
        if g not in geo: out.append(f"  - {g}: not in the answer"); continue
        vals = [(days[i], js["value"].get(str(geo[g] * nt + i))) for i in range(nt)]
        have = [(d, v) for d, v in vals if v is not None]
        if not have: out.append(f"  - {g}: no value"); continue
        out.append(f"  - {g}: {len(have)} values, first {have[0][0]}, last 6: " + ", ".join(f"{d} {v}" for d, v in have[-6:]))
    if label.startswith("since 2026"): (raw / "eurostat_mcby_d_recent.json").write_bytes(b)
for name, url in [("eurostat_mcby_metadata", "https://ec.europa.eu/eurostat/cache/metadata/en/irt_lt_mcby_esms.htm"), ("eurostat_copyright", "https://ec.europa.eu/eurostat/web/main/help/copyright-notice")]:
    try:
        b = get(url); txt = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", re.sub(r"(?s)<(script|style).*?</\1>", " ", b.decode("utf-8", "replace"))))
        (raw / f"{name}.txt").write_text(txt); out.append(f"- {name}: {len(b)} bytes, {len(txt)} chars of text")
    except Exception as e: out.append(f"- {name}: FAILED {e}")
(pathlib.Path("probe") / "report.md").write_text("\n".join(out) + "\n"); print("\n".join(out))
