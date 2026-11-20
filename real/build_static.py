"""Static data for the first snapshot: auctions, news, calendar, ECB key rates.

Every value below was read on 19 Nov 2026 by a research agent on the official page given in `url`,
through the web reading tool (a transcription, not a raw download). Nothing here is estimated.
The daily pipeline will replace this file by fetchers that parse the same pages.
"""
import json, pathlib, sys

OUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "/home/claude/egb/data")
OUT.mkdir(parents=True, exist_ok=True)

FA = "https://www.deutsche-finanzagentur.de/en/federal-securities/issuances/issuance-results"
FA_CAL = "https://www.deutsche-finanzagentur.de/en/federal-securities/issuances/issuance-calendar"
AFT = "https://www.aft.gouv.fr/en/dernieres-adjudications"
AFT_BOND = "https://www.aft.gouv.fr/en/node/13741"
AFT_RULE = "https://www.aft.gouv.fr/en/node/13516"
BDI = "https://www.bancaditalia.it/media/comunicati/documenti/2026-02/cs_aste_BTP_12112026.pdf"
TES_B = "https://www.tesoro.es/deuda-publica/subastas/resultado-ultimas-subastas/bonos-del-estado"
TES_O = "https://www.tesoro.es/deuda-publica/subastas/resultado-ultimas-subastas/obligaciones-del-estado"
TES_CAL = "https://www.tesoro.es/deuda-publica/subastas/calendario"


def r(country, date, security, isin, bids_m, allotted_m, avg_yield, stop_yield, cover, url, **extra):
    """One auction result. Amounts arrive in EUR million and are stored in EUR billion."""
    return dict(country=country, date=date, security=security, isin=isin,
                bids_bn=None if bids_m is None else round(bids_m / 1000, 3),
                amount_bn=None if allotted_m is None else round(allotted_m / 1000, 3),
                avg_yield=avg_yield, stop_yield=stop_yield, bid_cover=cover, url=url, **extra)


results = [
    # Spain, Tesoro Publico. Stop yield = marginal rate. ISIN is not shown on the page.
    r("ES", "2026-11-19", "Bono 2.60% 31 May 2031", None, 3739.11, 1444.03, 3.475, 3.486, 2.59, TES_B),
    r("ES", "2026-11-19", "Obligacion 3.75% 30 Jul 2034", None, 5193.52, 2322.47, 3.765, 3.770, 2.24, TES_B),
    r("ES", "2026-11-19", "Obligacion 3.20% 31 Oct 2035", None, 3061.44, 1666.29, 3.842, 3.850, 1.84, TES_O),
    # Germany, Finanzagentur. Allotted excludes the amount retained for the secondary market. No stop yield is published.
    r("DE", "2026-11-18", "Bund 3.30% 15 Nov 2033", "DE000BU27022", 3417, 2271.72, 3.27, None, 1.5, FA),
    r("DE", "2026-11-17", "Schatz 3.00% 13 Dec 2028", "DE000BU22155", 6822, 3807.17, 3.10, None, 1.8, FA),
    # Italy, Banca d'Italia. Uniform-price auction: the yield is the yield at the auction price.
    r("IT", "2026-11-12", "BTP 3.00% 15 Sep 2029", "IT0005716839", 3840.5, 2500, 3.58, None, 1.54, BDI),
    r("IT", "2026-11-12", "BTP 3.35% 15 Sep 2033", "IT0005722845", 5006.755, 3250, 4.04, None, 1.54, BDI),
    r("IT", "2026-11-12", "BTP Green 4.10% 30 Apr 2046", "IT0005631608", 2536, 1500, 4.73, None, 1.69, BDI),
    r("DE", "2026-11-11", "Bund 2.90% 15 Aug 2056", "DE000BU2D012", 1398, 1078, 3.66, None, 1.3, FA),
    r("DE", "2026-11-11", "Bund 3.40% 15 May 2047", "DE000BU2T000", 1560, 853, 3.65, None, 1.8, FA),
    # France, AFT bond page: amount is the total issued, cover and bids were not read on an AFT page for this date.
    r("FR", "2026-11-05", "OAT 3.70% 25 Nov 2036", "FR0014018YR0", None, 6578, 4.74, None, None, AFT_BOND),
    r("ES", "2026-11-05", "Obligacion 3.50% 31 Jan 2041", None, 2855.81, 1569.78, 4.092, 4.101, 1.82, TES_O),
    r("DE", "2026-11-04", "Bund 2.60% 15 May 2041", "DE000BU2F009", 1145, 864, 3.57, None, 1.3, FA),
    r("DE", "2026-11-04", "Bund 1.25% 15 Aug 2048", "DE0001102432", 1812, 799.61, 3.67, None, 2.3, FA),
    # France, AFT monthly page (October 2026). Allotted = competitive round. No stop yield is published, only a stop price.
    r("FR", "2026-10-15", "OAT 2.70% 25 Feb 2031", "FR001400Z2L7", 4744, 2041, 4.01, None, 2.32, AFT),
    r("FR", "2026-10-15", "OAT 0.00% 25 Nov 2031", "FR0014002WK3", 5370, 2337, 4.10, None, 2.30, AFT),
    r("FR", "2026-10-15", "OAT 3.25% 25 Feb 2032", "FR0014018OI0", 8480, 3691, 4.16, None, 2.30, AFT),
    r("FR", "2026-10-15", "OAT 3.50% 25 Nov 2033", "FR001400L834", 8762, 3931, 4.41, None, 2.23, AFT),
    r("ES", "2026-10-15", "Bono 2.35% 31 Mar 2029", None, 4956.69, 2400.00, 3.313, 3.315, 2.07, TES_B),
    r("FR", "2026-10-01", "OAT 3.70% 25 Nov 2036", "FR0014018YR0", 12564, 6271, 4.93, None, 2.00, AFT),
    r("FR", "2026-10-01", "OAT 3.80% 25 Jun 2037", "FR0014017Z10", 4623, 1531, 4.97, None, 3.02, AFT),
    r("FR", "2026-10-01", "OAT 1.25% 25 May 2038", "FR0014009O62", 5290, 2134, 5.06, None, 2.48, AFT),
    r("FR", "2026-10-01", "OAT 2.00% 25 May 2048", "FR0013257524", 5010, 2063, 5.40, None, 2.43, AFT),
]

upcoming = [
    dict(country="DE", date="2026-11-25", title="Bund 3.00% 15 Aug 2036, reopening", amount_bn=5.0, url=FA_CAL),
    dict(country="DE", date="2026-12-01", title="Bobl 2.90% 8 Oct 2031, reopening", amount_bn=4.5, url=FA_CAL),
    dict(country="FR", date="2026-12-03", title="Long-term OAT auction (first Thursday rule, lines not announced yet)", amount_text="not announced", url=AFT_RULE),
    dict(country="DE", date="2026-12-08", title="Schatz 3.00% 13 Dec 2028, reopening", amount_bn=4.0, url=FA_CAL),
    dict(country="ES", date="2026-12-10", title="Bonos and Obligaciones (lines not announced yet)", amount_text="not announced", url=TES_CAL),
    dict(country="ES", date="2026-12-17", title="Bonos and Obligaciones (lines not announced yet)", amount_text="not announced", url=TES_CAL),
    dict(country="ES", date="2027-01-07", title="Bonos and Obligaciones (lines not announced yet)", amount_text="not announced", url=TES_CAL),
    dict(country="ES", date="2027-01-21", title="Bonos and Obligaciones (lines not announced yet)", amount_text="not announced", url=TES_CAL),
]

json.dump(dict(
    asof="2026-11-19",
    note_results="Medium and long-term lines only. Read on 19 Nov 2026 on the issuers' pages. Germany: allotted amount excludes the retention. "
                 "Italy: single-price auction, so the yield is the yield at the auction price. France, 5 Nov: bids and cover were not read on an AFT page. "
                 "France, 19 Nov: result not read yet.",
    note_upcoming="Germany and Spain: read on the issuers' calendars. France: date from the AFT calendar rule, not from a dated calendar. Italy: calendar not read yet.",
    results=results, upcoming=upcoming), open(OUT / "auctions.json", "w"), indent=1)

# ---------------------------------------------------------------- news (titles and links as read in the official feeds)
ECB = "https://www.ecb.europa.eu"
BBK = "https://www.bundesbank.de/en/press/press-releases/federal-securities/"
news = [
    dict(date="2026-11-19", source="Banco de Espana feed, ECB release", title="ECB keeps capital requirements broadly stable for 2027",
         url="https://www.bde.es/wbe/en/noticias-eventos/actualidad-bce/notas-prensa-bce/el-bce-mantiene-basicamente-estables-los-requerimientos-de-capital-para-2027-y-centra-sus-prioridades-en-la-resiliencia-financiera-y-operativa-de-las-entidades-de-credito.html"),
    dict(date="2026-11-18", source="Bundesbank", title="Reopening Federal bond issue: auction result", url=BBK + "reopening-federal-bond-issue-auction-result-1016424"),
    dict(date="2026-11-17", source="Bundesbank", title="Reopening of Federal Treasury notes: auction result", url=BBK + "reopening-of-federal-treasury-notes-auction-result-964542"),
    dict(date="2026-11-17", source="Bundesbank", title="Invitation to bid by auction: reopening 7-year Federal bond", url=BBK + "invitation-to-bid-by-auction-reopening-7-year-federal-bond--1016244"),
    dict(date="2026-11-16", source="ECB", title="Frank Elderson: Smart supervision for small banks", url=ECB + "/press/inter/date/2026/html/ecb.in261116_1~11dd7f62af.en.html"),
    dict(date="2026-11-16", source="ECB", title="Boris Vujcic: Risks and resilience in the euro area financial system", url=ECB + "/press/key/date/2026/html/ecb.sp261116~db374b56ab.en.html"),
    dict(date="2026-11-13", source="ECB", title="Isabel Schnabel: Made in Europe", url=ECB + "/press/key/date/2026/html/ecb.sp261113~3883f1f187.en.html"),
    dict(date="2026-11-10", source="ECB", title="Philip R. Lane: The science and practice of monetary policy communication", url=ECB + "/press/key/date/2026/html/ecb.sp261110_1~9725b7aa07.en.html"),
    dict(date="2026-11-10", source="ECB", title="Piero Cipollone: Cash and the digital euro", url=ECB + "/press/key/date/2026/html/ecb.sp261110~9422461bad.en.html"),
    dict(date="2026-10-29", source="ECB", title="Monetary policy decisions", url=ECB + "/press/pr/date/2026/html/ecb.mp261029~9a493adf17.en.html"),
    dict(date="2026-09-10", source="ECB", title="Monetary policy decisions", url=ECB + "/press/pr/date/2026/html/ecb.mp260910~314e508016.en.html"),
    dict(date="2026-07-23", source="ECB", title="Monetary policy decisions", url=ECB + "/press/pr/date/2026/html/ecb.mp260723~29f24d99bc.en.html"),
    dict(date="2026-06-11", source="ECB", title="Monetary policy decisions", url=ECB + "/press/pr/date/2026/html/ecb.mp260611~4d41bd5e83.en.html"),
]
json.dump(dict(note="Titles and links read on 19 Nov 2026 in the ECB, Bundesbank and Banco de Espana feeds. The ECB copy read was three days old. Press feeds are not included: their terms of use have not been read yet.",
               items=news), open(OUT / "news.json", "w"), indent=1)

# ---------------------------------------------------------------- calendar and ECB key rates
MEET = ECB + "/press/calendars/mgcgc/html/index.en.html"
ESTAT = "https://ec.europa.eu/eurostat/web/main/news/release-calendar"
events = [dict(date=d, kind="ECB", title="ECB monetary policy decision and press conference", url=MEET)
          for d in ["2026-12-17", "2027-02-04", "2027-03-18", "2027-04-29", "2027-06-10", "2027-07-22", "2027-09-09", "2027-10-28", "2027-12-16"]]
events += [dict(date=d, kind="ECB", title="ECB monetary policy decision", url=ECB + "/press/govcdec/mopo/2026/html/index_include.en.html")
           for d in ["2026-10-29", "2026-09-10", "2026-07-23", "2026-06-11", "2026-04-30", "2026-03-19", "2026-02-05"]]
events += [dict(date=d, kind="Data", title="Euro area inflation, flash estimate (Eurostat)", url=ESTAT) for d in ["2026-12-01", "2027-01-06", "2027-02-02", "2027-03-02"]]
events += [dict(date=d, kind="Data", title="Euro area inflation, final HICP (Eurostat)", url=ESTAT) for d in ["2026-12-17", "2027-01-19", "2027-02-24"]]
events += [dict(date="2026-12-07", kind="Data", title="GDP main aggregates and employment (Eurostat)", url=ESTAT),
           dict(date="2027-01-29", kind="Data", title="Euro area GDP, preliminary flash estimate (Eurostat)", url=ESTAT),
           dict(date="2027-02-15", kind="Data", title="Euro area GDP and employment, flash estimate (Eurostat)", url=ESTAT),
           dict(date="2027-03-05", kind="Data", title="GDP main aggregates and employment (Eurostat)", url=ESTAT)]
events += [dict(date=d, kind="Data", title="Euro area unemployment (Eurostat)", url=ESTAT) for d in ["2026-12-02", "2027-01-07", "2027-02-01", "2027-03-04"]]
key_rates = [  # effective date, deposit facility, main refinancing operations, marginal lending facility
    dict(date="2026-09-16", dfr=2.50, mro=2.65, mlf=2.90), dict(date="2026-06-17", dfr=2.25, mro=2.40, mlf=2.65),
    dict(date="2025-06-11", dfr=2.00, mro=2.15, mlf=2.40), dict(date="2025-04-23", dfr=2.25, mro=2.40, mlf=2.65),
    dict(date="2025-03-12", dfr=2.50, mro=2.65, mlf=2.90), dict(date="2025-02-05", dfr=2.75, mro=2.90, mlf=3.15),
]
json.dump(dict(note="ECB dates read on the ECB calendar, Eurostat dates on the Eurostat release calendar (read up to early March 2027). Auctions come from the Auctions tab. Rating reviews and national statistics calendars are not loaded yet.",
               key_rates=key_rates, key_rates_url=ECB + "/stats/policy_and_exchange_rates/key_ecb_interest_rates/html/index.en.html", events=events), open(OUT / "events.json", "w"), indent=1)
print("static data written to", OUT, "| results:", len(results), "upcoming:", len(upcoming), "news:", len(news), "events:", len(events))
