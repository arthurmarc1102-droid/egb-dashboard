"""Download test (run 6): Eurex online statistics pages for options on bond futures: product numbers, page content, API calls. Report in probe/report.md."""
import urllib.request, datetime, pathlib, json, re, html
UA = {"User-Agent": "egb-dashboard/1.0 (+https://github.com/arthurmarc1102-droid/egb-dashboard)"}
S = "https://www.eurex.com/ex-en/data/statistics/market-statistics-online/100!onlineStats"
A = "https://www.eurex.com/api/v1/"
def get(u):
    with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=90) as r: return r.read()
def text(b): return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", re.sub(r"(?s)<(script|style).*?</\1>", " ", b.decode("utf-8", "replace")))))
raw = pathlib.Path("probe/raw"); raw.mkdir(parents=True, exist_ok=True)
out = [f"# Download test, Eurex options statistics, {datetime.datetime.utcnow():%Y-%m-%d %H:%M} UTC\n"]
js = json.loads(get(A + f"overallstatistics/34656?busdate={datetime.date.today():%Y%m%d}"))
days = sorted(datetime.datetime.strptime(x[:10], "%d-%m-%Y").date() for x in js["header"]["tradingDates"]); bus = days[-2 if len(days) > 1 else -1].strftime("%Y%m%d")
out.append(f"trading dates offered: {days[0]} to {days[-1]}; test date {bus}")
ids = {}
try:
    b = get(f"{S}?busDate={bus}&productGroupId=13328&viewType=2"); page = b.decode("utf-8", "replace"); (raw / "eurex_group_13328.html").write_bytes(b)
    out.append(f"## group page: {len(b)} bytes; api urls in page: {sorted(set(re.findall(r'api/v1/[A-Za-z0-9_/]+', page)))[:20]}")
    for m in re.finditer(r'href="([^"]*productId=(\d+)[^"]*)"[^>]*>\s*([A-Z0-9]{3,5})\s*<', page): ids[m.group(3)] = (m.group(2), html.unescape(m.group(1)))
    if not ids:
        for m in re.finditer(r'productId=(\d+)', page): ids.setdefault("id" + m.group(1), (m.group(1), ""))
    out.append("  product numbers: " + ", ".join(f"{k} {v[0]}" for k, v in sorted(ids.items()))[:1500])
except Exception as e: out.append(f"## group page: FAILED {e}")
for code in ("OGBL", "OGBM", "OGBS"):
    if code not in ids: out.append(f"## {code}: product number not found"); continue
    pid, link = ids[code]; out.append(f"\n## {code} = product {pid}; link on the group page: {link[:200]}")
    for label, url in [("overallstatistics", A + f"overallstatistics/{pid}?busdate={bus}"),
                       ("page, calls, viewType 3", f"{S}?productGroupId=13328&productId={pid}&viewType=3&cp=Call&busDate={bus}"),
                       ("page, link as given", ("https://www.eurex.com" + link if link.startswith("/") else link) if link else "")]:
        if not url: continue
        try:
            b = get(url); (raw / f"eurex_{code}_{label.split(',')[0].replace(' ', '_')}.txt").write_bytes(b[:400000])
            if label == "overallstatistics":
                j = json.loads(b); rows = j.get("dataRows", []); out.append(f"- {label}: {len(b)} bytes, header {json.dumps({k: v for k, v in j.get('header', {}).items() if k != 'tradingDates'})[:200]}, {len(rows)} rows, types {sorted({str(r.get('contractType')) for r in rows})}")
                out += ["    " + json.dumps(r)[:420] for r in rows[:3]]
            else:
                p = b.decode("utf-8", "replace"); t = text(b); i = t.find("Strike")
                out.append(f"- {label}: {len(b)} bytes; api urls {sorted(set(re.findall(r'api/v1/[A-Za-z0-9_/]+', p)))[:12]}; month/cp links {sorted(set(re.findall(r'(?:month|year|cp|viewType)=[A-Za-z0-9]+', p)))[:40]}")
                out.append("    text around the table: " + (t[max(0, i - 300): i + 1500] if i >= 0 else t[:600]))
        except Exception as e: out.append(f"- {label}: FAILED {e}\n    {url}")
(pathlib.Path("probe") / "report.md").write_text("\n".join(out) + "\n"); print("\n".join(out)[:8000])
