"""Download test (run 8): the script chunks of the Eurex statistics page, to find the API call that returns option series by strike. Report in probe/report.md."""
import urllib.request, datetime, pathlib, json, re
UA = {"User-Agent": "egb-dashboard/1.0 (+https://github.com/arthurmarc1102-droid/egb-dashboard)"}
S = "https://www.eurex.com/ex-en/data/statistics/market-statistics-online/100!onlineStats"
A = "https://www.eurex.com/api/v1/"
def get(u, extra=None):
    with urllib.request.urlopen(urllib.request.Request(u, headers={**UA, **(extra or {})}), timeout=120) as r: return r.read()
out = [f"# Download test, Eurex statistics page scripts, {datetime.datetime.utcnow():%Y-%m-%d %H:%M} UTC\n"]
page = get(f"{S}?productGroupId=13328&productId=70050&viewType=3").decode("utf-8", "replace")
out.append("data attributes and config in the page: " + str(sorted(set(re.findall(r'data-[a-z\-]*(?:url|api|endpoint|stat)[a-z\-]*="[^"]{0,160}"', page)))[:20]))
out.append("components named in the page: " + str(sorted(set(re.findall(r'(?:data-component|data-module|data-react-class|is)="([A-Za-z0-9_\-]{3,60})"', page)))[:40]))
i = page.find("onlineStats"); out.append("around the statistics container: " + re.sub(r"\s+", " ", page[page.find("<main"):][:200]))
for m in re.finditer(r'(?i)<[^>]*(?:statistic|onlinestat)[^>]*>', page): out.append("  tag: " + m.group(0)[:300])
chunk = next((s for s in re.findall(r'<script[^>]+src="([^"]+)"', page) if "chunkPathById" in s), None)
paths = []
if chunk:
    t = get("https://www.eurex.com" + chunk).decode("utf-8", "replace"); paths = sorted(set(re.findall(r'["\'](/resource/[^"\']+?\.js)["\']', t)))
    out.append(f"## chunk map: {len(t)} chars, {len(paths)} script paths; start: {t[:300]}")
hits = 0
for p in paths:
    try: t = get("https://www.eurex.com" + p).decode("utf-8", "replace")
    except Exception as e: out.append(f"- {p}: FAILED {e}"); continue
    api = sorted(set(re.findall(r'api/v1/[A-Za-z0-9_\-/]*', t)))
    if api or "tatistic" in t:
        out.append(f"- {p}: {len(t)} chars, api strings {api[:30]}")
        for m in list(re.finditer(r'api/v1/', t))[:6]: out.append("    context: " + t[max(0, m.start() - 260): m.start() + 420].replace("\n", " ")); hits += 1
out.append(f"contexts printed: {hits}")
(pathlib.Path("probe") / "report.md").write_text("\n".join(out) + "\n"); print("\n".join(out)[:9000])
