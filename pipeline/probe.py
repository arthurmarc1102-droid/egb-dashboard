"""Download test (run 2): Italian auction results (MEF pages and PDFs) and MEF legal notice. Saves text in probe/raw/."""
import urllib.request, datetime, pathlib, re, time, io
from pypdf import PdfReader
UA = {"User-Agent": "egb-dashboard/1.0 (+https://github.com/arthurmarc1102-droid/egb-dashboard)"}
BASE = "https://www.dt.mef.gov.it"
MEF = BASE + "/en/debito_pubblico/emissioni_titoli_di_stato_interni/risultati_aste/"
PAGES = ["risultati_aste_btp_short_term", "risultati_aste_btp_3_anni", "risultati_aste_btp_5_anni", "risultati_aste_btp_7_anni", "risultati_aste_btp_10_anni",
         "risultati_aste_btp_15_anni", "risultati_aste_btp_20_anni", "risultati_aste_btp_30_anni", "risultati_aste_btp_green"]
def get(u):
    with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=90) as r: return r.read()
raw = pathlib.Path("probe/raw"); raw.mkdir(parents=True, exist_ok=True)
out = [f"# Download test, Italian auctions, {datetime.datetime.utcnow():%Y-%m-%d %H:%M} UTC\n"]
for name, url in [("mef_legal", BASE + "/en/note_legali/"), ("mef_legal_it", BASE + "/it/note_legali/")]:
    try: b = get(url); (raw / f"{name}.txt").write_text(b.decode("utf-8", "replace")); out.append(f"- {name}: {len(b)} bytes")
    except Exception as e: out.append(f"- {name}: {e}")
for p in PAGES:
    url = MEF + p + "/" + ("" if p.endswith("green") else "index.html")
    try: page = get(url).decode("utf-8", "replace")
    except Exception as e: out.append(f"## {p}: page failed {e}"); continue
    pdfs = sorted(set(re.findall(r'href="([^"]+\.pdf)"', page)))
    def key(u):
        m = re.search(r"(\d{2})\.(\d{2})\.(\d{4})\.pdf$", u); return (m.group(3), m.group(2), m.group(1)) if m else ("0",)
    pdfs.sort(key=key)
    out.append(f"## {p}: {len(pdfs)} pdf links, last: {pdfs[-3:]}")
    for u in pdfs[-2:]:
        try:
            b = get(BASE + u if u.startswith("/") else u); txt = "\n".join(pg.extract_text() or "" for pg in PdfReader(io.BytesIO(b)).pages)
            (raw / f"mef_{p}_{key(u)[0]}{key(u)[1]}{key(u)[2]}.txt").write_text(txt); out.append(f"  - {u.split('/')[-1]}: {len(b)} bytes, {len(txt)} chars")
        except Exception as e: out.append(f"  - {u}: {e}")
        time.sleep(0.3)
(pathlib.Path("probe") / "report.md").write_text("\n".join(out)); print("\n".join(out))
