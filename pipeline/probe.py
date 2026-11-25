"""Download test (run 11): samples for two new modules.
(a) Eurex options on bond futures by strike (endpoint seen in the product page: overallstatistics with filtertype=detail);
(b) Bundesbank yields of the inflation-linked Federal securities and of nominal bonds of close maturity; (c) Eurostat HICP excluding tobacco.
Raw answers are saved in probe/raw/ so that the code can be developed against real data. Report in probe/report.md."""
import urllib.request, datetime, pathlib, json, time
UA = {"User-Agent": "egb-dashboard/1.0 (+https://github.com/arthurmarc1102-droid/egb-dashboard)"}
A = "https://www.eurex.com/api/v1/overallstatistics/"
BBK = "https://api.statistiken.bundesbank.de/rest/data"
def get(u):
    with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=120) as r: return r.read()
raw = pathlib.Path("probe/raw"); raw.mkdir(parents=True, exist_ok=True)
out = [f"# Download test, options by strike, inflation-linked bonds, HICP, {datetime.datetime.now(datetime.timezone.utc):%Y-%m-%d %H:%M} UTC\n"]
def sdmx(js):
    st = js["data"]["structure"]["dimensions"]; dims = st["series"]; obs = st["observation"][0]["values"]; res = {}
    for key, s in js["data"]["dataSets"][0]["series"].items():
        ids = tuple(dims[k]["values"][int(i)]["id"] for k, i in enumerate(key.split(":")))
        res[ids] = {obs[int(o)]["id"]: float(v[0]) for o, v in s["observations"].items() if v and v[0] is not None}
    return res
# ---- (a) Eurex options
try:
    js = json.loads(get(A + f"70050?busdate={datetime.date.today():%Y%m%d}"))
    days = sorted(datetime.datetime.strptime(x[:10], "%d-%m-%Y").date() for x in js["header"]["tradingDates"]); out.append(f"## Eurex: {len(days)} trading dates offered, {days[0]} to {days[-1]}")
    last = days[-1].strftime("%Y%m%d")
    for code, pid in [("OGBL", 70050), ("OGBM", 70042), ("OGBS", 70040), ("OGBX", 2266776), ("OOAT", 70058), ("OBTP", 70060)]:
        try:
            b = get(A + f"{pid}?busdate={last}&filtertype=overview"); ov = json.loads(b); (raw / f"opt_{code}_overview_{last}.json").write_bytes(b)
            exps = [(r["date"], r["contractType"], int(r.get("total", 0)), int(r.get("callOpenInterest", 0) + r.get("putOpenInterest", 0))) for r in ov.get("dataRows", [])]
            out.append(f"- {code} ({pid}) on {last}: expiries (date, type, volume, open interest) {exps}")
            for exp, typ, *_ in [e for e in exps if e[1] == "M"][:3]:
                b = get(A + f"{pid}?filtertype=detail&productdate={exp}&busdate={last}&contracttype={typ}"); d = json.loads(b); (raw / f"opt_{code}_{exp}_{last}.json").write_bytes(b)
                c, p = d.get("dataRowsCall", []), d.get("dataRowsPut", []); ks = sorted(r["strike"] for r in c)
                out.append(f"    {exp}: {len(c)} calls, {len(p)} puts, strikes {ks[0] if ks else None} to {ks[-1] if ks else None}, calls with open interest {sum(1 for r in c if r.get('openInterest'))}, header {d.get('header')}")
                time.sleep(0.2)
        except Exception as e: out.append(f"- {code}: FAILED {e}")
    for d0 in (days[0], days[len(days) // 2], days[-2]):
        bus = d0.strftime("%Y%m%d")
        try:
            ov = json.loads(get(A + f"70050?busdate={bus}&filtertype=overview")); exp = next(r["date"] for r in ov["dataRows"] if r["contractType"] == "M")
            b = get(A + f"70050?filtertype=detail&productdate={exp}&busdate={bus}&contracttype=M"); d = json.loads(b); (raw / f"opt_OGBL_{exp}_{bus}.json").write_bytes(b)
            out.append(f"- OGBL history check, {bus}: first monthly expiry {exp}, {len(d.get('dataRowsCall', []))} calls, {len(d.get('dataRowsPut', []))} puts")
        except Exception as e: out.append(f"- OGBL history check {bus}: FAILED {e}")
except Exception as e: out.append(f"## Eurex: FAILED {e}")
# ---- (b) Bundesbank: inflation-linked Federal securities and nominal comparators
out.append("\n## Bundesbank, yields by ISIN since 2015")
for isin, what in [("DE0001030559", "linker 0.50% Apr 2030"), ("DE0001030583", "linker 0.10% Apr 2033"), ("DE0001030575", "linker 0.10% Apr 2046"),
                   ("DE0001102499", "nominal 0% Feb 2030"), ("DE000BU2Z007", "nominal 2.30% Feb 2033"), ("DE0001102341", "nominal 2.50% Aug 2046")]:
    try:
        b = get(f"{BBK}/BBSSY/D.KCP+KDP+REN.EUR..{isin}.?format=sdmx_json&lang=en&startPeriod=2015-01-01"); (raw / f"bbk_{isin}.json").write_bytes(b); d = sdmx(json.loads(b))
        for k, v in sorted(d.items()):
            ds = sorted(v); out.append(f"- {isin} ({what}) {'.'.join(k)}: {len(v)} values, {ds[0]} to {ds[-1]}, last {v[ds[-1]]}")
    except Exception as e: out.append(f"- {isin} ({what}): FAILED {e}")
    time.sleep(0.2)
# ---- (c) Eurostat: HICP excluding tobacco, euro area
out.append("\n## Eurostat, HICP excluding tobacco")
E = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/"
for name, url in [("prc_hicp_minr", E + "prc_hicp_minr?format=JSON&lang=EN&geo=EA&coicop18=TOT_X_TBC&sinceTimePeriod=2014-01"), ("prc_hicp_fpd", E + "prc_hicp_fpd?format=JSON&lang=EN&geo=EA&coicop18=TOT_X_TBC&lastTimePeriod=6"),
                  ("prc_hicp_midx (old)", E + "prc_hicp_midx?format=JSON&lang=EN&geo=EA&coicop=TOT_X_TBC&unit=I15&lastTimePeriod=4")]:
    try:
        b = get(url); js = json.loads(b); (raw / f"eurostat_{name.split(' ')[0]}.json").write_bytes(b)
        dims = {k: list(v["category"]["index"])[:6] for k, v in js["dimension"].items() if k != "time"}; tim = js["dimension"]["time"]["category"]["index"]; inv = {v: k for k, v in tim.items()}
        out.append(f"- {name}: {len(b)} bytes, updated {js.get('updated')}, dimensions {dims}, sizes {js.get('size')}, {len(js['value'])} values, periods {inv[0]} to {inv[len(inv) - 1]}")
        out.append(f"    last values by flat index: {[(k, v) for k, v in list(js['value'].items())[-4:]]}")
    except Exception as e: out.append(f"- {name}: FAILED {e}\n    {url}")
(pathlib.Path("probe") / "report.md").write_text("\n".join(out) + "\n"); print("\n".join(out)[:9000])
