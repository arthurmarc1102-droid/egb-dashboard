"""Download test (run 5): Eurex statistics API, what it returns for futures and which product numbers are options. Report in probe/report.md."""
import urllib.request, datetime, pathlib, json, time
UA = {"User-Agent": "egb-dashboard/1.0 (+https://github.com/arthurmarc1102-droid/egb-dashboard)"}
B = "https://www.eurex.com/api/v1/overallstatistics/"
def get(u):
    with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=90) as r: return r.read()
raw = pathlib.Path("probe/raw"); raw.mkdir(parents=True, exist_ok=True)
out = [f"# Download test, Eurex statistics API, {datetime.datetime.utcnow():%Y-%m-%d %H:%M} UTC\n"]
day = None
try:
    b = get(B + f"34656?busdate={datetime.date.today():%Y%m%d}"); js = json.loads(b); (raw / "eurex_fgbl.json").write_bytes(b)
    hd = js.get("header", {}); days = hd.get("tradingDates", []); day = days[-1] if days else None
    out.append(f"## FGBL (34656): {len(b)} bytes, top keys {list(js)}, header keys {list(hd)}")
    out.append("  header without dates: " + json.dumps({k: v for k, v in hd.items() if k != "tradingDates"})[:900])
    rows = js.get("dataRows", []); out.append(f"  {len(rows)} rows, keys of a row: {list(rows[0]) if rows else None}")
    out.append("  first row: " + json.dumps(rows[0])[:700] if rows else "  no row")
    out.append(f"  last trading dates: {days[-3:]}")
except Exception as e: out.append(f"## FGBL: FAILED {e}")
bus = (datetime.datetime.strptime(day[:10], "%d-%m-%Y").strftime("%Y%m%d") if day else f"{datetime.date.today():%Y%m%d}")
out.append(f"\n## scan of product numbers, busdate {bus}")
found = {}
for pid in list(range(34630, 34720)) + list(range(42050, 42080)):
    try:
        js = json.loads(get(B + f"{pid}?busdate={bus}")); hd = js.get("header", {}); rows = js.get("dataRows", [])
        label = {k: v for k, v in hd.items() if k != "tradingDates" and isinstance(v, (str, int, float))}
        types = sorted({str(r.get("contractType")) for r in rows})
        out.append(f"- {pid}: {len(rows)} rows, contract types {types}, {json.dumps(label)[:260]}")
        found[pid] = js
    except Exception as e:
        if "404" not in str(e): out.append(f"- {pid}: {e}")
    time.sleep(0.15)
for pid, js in found.items():
    rows = js.get("dataRows", [])
    if any(str(r.get("contractType")) not in ("M", "None") for r in rows) or any("strike" in json.dumps(r).lower() for r in rows[:3]):
        (raw / f"eurex_{pid}.json").write_text(json.dumps(js)[:200000]); out.append(f"\n## {pid} sample rows\n  " + "\n  ".join(json.dumps(r)[:500] for r in rows[:4]))
(pathlib.Path("probe") / "report.md").write_text("\n".join(out) + "\n"); print("\n".join(out)[:6000])
