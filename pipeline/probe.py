"""Download test (run 14): Portugal (BPstat secondary market dataset), Austria (OeNB data service), Netherlands (DSTA file).
Report in probe/report.md; raw samples in probe/raw/."""
import urllib.request, datetime, pathlib, json, re

UA = {"User-Agent": "egb-dashboard/1.0 (+https://github.com/arthurmarc1102-droid/egb-dashboard)"}
raw = pathlib.Path("probe/raw"); raw.mkdir(parents=True, exist_ok=True)
out = [f"# Download test, PT AT NL, {datetime.datetime.now(datetime.timezone.utc):%Y-%m-%d %H:%M} UTC\n"]
def get(u, accept=None):
    h = dict(UA)
    if accept: h["Accept"] = accept
    with urllib.request.urlopen(urllib.request.Request(u, headers=h), timeout=180) as r: return r.read()
def text(b): return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", re.sub(r"(?s)<(script|style).*?</\1>", " ", b.decode("utf-8", "replace"))))

# ---- Portugal: BPstat, domain 26 (secondary market)
B = "https://bpstat.bportugal.pt/data/v1"
for ds in ("690b7b36fd36c0dbe249c48cbbc39524", "93441ab6408be15acced35b8ed98cd97"):
    for suffix in (f"/domains/26/datasets/{ds}/?lang=EN", f"/datasets/{ds}/?lang=EN", f"/domains/26/datasets/{ds}/series/?lang=EN"):
        try:
            b = get(B + suffix); (raw / f"bpstat{suffix.replace('/', '_')[:80]}.json").write_bytes(b[:3_000_000])
            out.append(f"## OK BPstat {suffix}: {len(b)} bytes\n  " + b[:2500].decode("utf-8", "replace"))
        except Exception as e: out.append(f"## FAILED BPstat {suffix}: {e}")

# ---- Austria: OeNB data service (documented at oenb.at, 'Data service')
for u in ["https://www.oenb.at/isadataservice/hierarchy?lang=EN",
          "https://www.oenb.at/isadataservice/main?lang=EN",
          "https://www.oenb.at/en/Statistics/User-Defined-Tables/interest-rates-and-exchange-rates/austrian-government-bond-yields.html",
          "https://www.oenb.at/en/Statistics/Standardized-Tables/interest-rates-and-exchange-rates/austrian-government-bond-yields.html",
          "https://www.oenb.at/en/Statistics/Data-Service.html"]:
    try:
        b = get(u); t = text(b)
        out.append(f"## OK OeNB {u}: {len(b)} bytes\n  text: {t[:900]}")
        out.append("  links: " + str(sorted(set(re.findall(r'(?:href|src)="([^"]*(?:isadataservice|isawebstat|createReport|report=|\.csv|\.xlsx?)[^"]*)"', b.decode('utf-8', 'replace'))))[:25]))
    except Exception as e: out.append(f"## FAILED OeNB {u}: {e}")

# ---- Netherlands: DSTA document page and file
for u in ["https://english.dsta.nl/documents/2025/04/30/yields-on-dsls-from-2010-onwards", "https://english.dsta.nl/latest/statistical-information/yields-on-dsls"]:
    try:
        b = get(u); p = b.decode("utf-8", "replace")
        links = sorted(set(re.findall(r'href="([^"]+)"', p))); cand = [l for l in links if re.search(r"(?i)\.ods|\.xlsx|/binaries/|/documents/.*yields|download", l)]
        out.append(f"## OK DSTA {u}: {len(b)} bytes; candidate links {cand[:20]}")
        for l in cand:
            if re.search(r"(?i)\.ods|\.xlsx|/binaries/", l):
                f = l if l.startswith("http") else "https://english.dsta.nl" + l
                try:
                    d = get(f); (raw / "dsta_yields_2010.ods").write_bytes(d); out.append(f"  OK file {f}: {len(d)} bytes, starts {d[:4]!r}"); break
                except Exception as e: out.append(f"  FAILED file {f}: {e}")
    except Exception as e: out.append(f"## FAILED DSTA {u}: {e}")

(pathlib.Path("probe") / "report.md").write_text("\n".join(out) + "\n"); print("\n".join(out)[:12000])
