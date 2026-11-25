"""Download test (run 10): Eurex online statistics, options on Euro-Bund futures: the expiry overview page, then one expiry by strike. Report in probe/report.md."""
import urllib.request, datetime, pathlib, json, re, html
UA = {"User-Agent": "egb-dashboard/1.0 (+https://github.com/arthurmarc1102-droid/egb-dashboard)"}
S = "https://www.eurex.com/ex-en/data/statistics/market-statistics-online/100!onlineStats"
A = "https://www.eurex.com/api/v1/"
def get(u):
    with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=120) as r: return r.read().decode("utf-8", "replace")
def cell(x): return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", x))).strip()
def tables(page):
    res = []
    for t in re.findall(r"(?s)<table.*?</table>", page):
        head = [cell(x) for x in re.findall(r"(?s)<th[^>]*>(.*?)</th>", t)]
        rows = [[cell(x) for x in re.findall(r"(?s)<td[^>]*>(.*?)</td>", r)] for r in re.findall(r"(?s)<tr[^>]*>(.*?)</tr>", t)]
        res.append((head, [r for r in rows if r]))
    return res
raw = pathlib.Path("probe/raw"); raw.mkdir(parents=True, exist_ok=True)
out = [f"# Download test, Eurex options by strike, {datetime.datetime.utcnow():%Y-%m-%d %H:%M} UTC\n"]
js = json.loads(get(A + f"overallstatistics/70050?busdate={datetime.date.today():%Y%m%d}"))
days = sorted(datetime.datetime.strptime(x[:10], "%d-%m-%Y").date() for x in js["header"]["tradingDates"]); bus = days[-2].strftime("%Y%m%d")
def show(label, url, save=None):
    try: page = get(url)
    except Exception as e: out.append(f"## {label}: FAILED {e}\n  {url}"); return ""
    if save: (raw / save).write_text(page[:600000])
    tb = tables(page); out.append(f"## {label}: {len(page)} chars, {len(tb)} tables\n  {url}")
    for head, rows in tb: out.append(f"  - header {head[:16]}, {len(rows)} rows"); out.extend("      " + " | ".join(r)[:300] for r in rows[:4] + rows[-2:])
    m = re.search(r"Data is for[^<]*<[^>]*>([^<]*)", page); out.append(f"  date shown: {cell(m.group(0)) if m else 'not found'}")
    return page
p3 = show("OGBL overview (viewType 3)", f"{S}?productGroupId=13328&productId=70050&viewType=3&busDate={bus}")
for vt in ("4", "5", "6", "2", "3", "1", "0"):
    show(f"OGBL calls Jan 2027, viewType {vt}", f"{S}?productGroupId=13328&productId=70050&viewType={vt}&cp=Call&month=1&year=2027&busDate={bus}", f"eurex_ogbl_vt{vt}.html" if vt in ("4", "5") else None)
show("OGBL calls Jan 2027, month 01", f"{S}?productGroupId=13328&productId=70050&viewType=4&cp=Call&month=01&year=2027&busDate={bus}")
show("OGBL, order as on the group page", f"{S}?productGroupId=13328&productId=70050&viewType=3&month=01&year=2027&cp=Call&busDate={bus}")
show("FGBL futures detail (viewType 4)", f"{S}?productGroupId=13328&productId=34656&viewType=4&busDate={bus}")
(pathlib.Path("probe") / "report.md").write_text("\n".join(out) + "\n"); print("\n".join(out)[:9000])
