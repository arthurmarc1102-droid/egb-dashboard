"""Write data/sources.json: what the page uses, what the audit of 19 Nov 2026 found, and the known limits.

Status meanings on the page:
  verified   = data read on the official source during the audit
  unverified = source located, content not read or not confirmed
  blocked    = could not be reached with the tools used for the audit
  planned    = not available for free, or kept out because of its terms
"""
import json, pathlib, sys

OUT = pathlib.Path(__file__).resolve().parents[1] / "data"
FRANCE = True                          # French TEC indices loaded
AUTH = True                            # Euronext and Eurex authorisations obtained (20 Nov 2026)
EXTRA = pathlib.Path(__file__).with_name("sources_extra.json")       # findings of the complementary audit, if any


def s(id, name, publisher, covers, frequency, status, used, url, note, short=None):
    return dict(id=id, name=name, short=short or publisher, publisher=publisher, covers=covers, frequency=frequency, status=status, used=used, url=url, note=note)


sources = [
    # ------------------------------------------------------------------ used on the page
    s("bbk_curve", "Term structure of listed Federal securities", "Deutsche Bundesbank", "Germany, par yields, 1 to 30 years, since 1997", "Daily, online the same afternoon", "verified", True,
      "https://www.bundesbank.de/en/statistics/money-and-capital-markets/interest-rates-and-yields/daily-term-structure-on-listed-federal-securities-651570",
      "Estimated curve (Svensson), two decimals: not quotes of benchmark bonds. Downloaded each weekday from the Bundesbank API. Reuse is free with the source named."),
    s("bde_yields", "Interest rates on the secondary market, table 1.3", "Banco de Espana", "Spain, government bonds at 3, 5, 10 and 15 years, daily since 2015 (file since 1979)", "Daily", "verified", True,
      "https://www.bde.es/webbe/es/estadisticas/compartido/datos/csv/ead002.csv",
      "Fuente: Elaboracion propia con datos extraidos del sitio web del Banco de Espana (www.bde.es), file ead002.csv. Yields set by the bank from market trades, not benchmark quotes: they move unevenly from day to day. Published two business days late. Downloaded each weekday."),
    s("nbb_olo", "Yields on OLOs at a fixed residual term (DF_IROLOBE2)", "National Bank of Belgium", "Belgium, 1 to 30 years, daily since 2015", "Daily", "verified", True,
      "https://dataexplorer.nbb.be/vis?lc=en&df%5Bds%5D=disseminate&df%5Bid%5D=DF_IROLOBE2&df%5Bag%5D=BE2&df%5Bvs%5D=1.0&dq=D..F",
      "Source: National Bank of Belgium, NBB.Stat. Average yield on OLOs with the given residual term, two decimals. Downloaded each weekday from the NBB SDMX service (tested from GitHub on 26 Nov 2026). The NBB allows distribution of its information when it is accurately presented and the NBB is cited."),
    s("bdp_yields", "Yield on fixed-rate Treasury bonds by residual maturity", "Banco de Portugal (data from LSEG)", "Portugal, 2, 3, 4, 5, 7 and 10 years, daily since 1993", "Daily values, file updated once a week", "verified", True,
      "https://bpstat.bportugal.pt/",
      "Source: Banco de Portugal, BPstat; the bank names LSEG as the originator. Downloaded each weekday from the BPstat API (tested from GitHub on 26 Nov 2026). The bank refreshes the file on the first business day of the week, so the last values can be several days old. ESCB reuse rules do not cover third-party data without the originator's permission: this is shown on that basis and would be removed on request."),
    s("riksbank_nl", "International government bond yields (NLGVB5Y, NLGVB10Y)", "Sveriges Riksbank (data from Refinitiv)", "Netherlands, 5 and 10 years, daily since 1987", "Daily", "verified", True,
      "https://www.riksbank.se/en-gb/statistics/interest-rates-and-exchange-rates/retrieving-interest-rates-and-exchange-rates-via-api/",
      "Source: Sveriges Riksbank, SWEA API; the bank names Refinitiv as the originator. Benchmark yields, not a fitted curve. Their spread to the Bundesbank curve mixes two methods: on 24 Nov 2026 the Riksbank 10-year spread Netherlands minus Germany was 13.4 bp, against about 9 bp when the Bundesbank curve is used for Germany. Downloaded each weekday (tested from GitHub on 26 Nov 2026). The Dutch State Treasury Agency publishes bond-by-bond yields once a month; they are not loaded yet."),
    s("eurostat_mcby", "Long-term government bond yields, Maastricht definition", "Eurostat", "10-year, by country, monthly averages since 1980", "Monthly, about 10 days after month end", "verified", True,
      "https://ec.europa.eu/eurostat/cache/metadata/en/irt_lt_mcby_esms.htm",
      "Stands in for daily yields in the countries that have none loaded."),
    s("bbk_estr", "Euro short-term rate", "ECB, republished by Deutsche Bundesbank", "Overnight rate, since October 2019", "Daily, next morning", "verified", True,
      "https://www.ecb.europa.eu/stats/financial_markets_and_interest_rates/euro_short-term_rate/html/index.en.html",
      "The ECB does not charge for the rate or license its use. Downloaded each weekday from the Bundesbank API.", short="ECB via Bundesbank"),
    s("ecb_rates", "Key ECB interest rates", "European Central Bank", "Deposit facility, main refinancing, marginal lending, since 1999", "At each change", "verified", True,
      "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/key_ecb_interest_rates/html/index.en.html", "Free reuse with the ECB named as source."),
    s("fa_auctions", "Issuance results and issuance calendar", "Deutsche Finanzagentur", "German auctions: bids, allotment, retention, yield, cover", "Same day", "verified", True,
      "https://www.deutsche-finanzagentur.de/en/federal-securities/issuances/issuance-results", "Checked against the Bundesbank press release. No reuse terms found on the pages read."),
    s("aft_auctions", "Last auctions and bond pages", "Agence France Tresor", "French auctions: bids, served, stop price, average yield, cover", "Monthly page, bond pages updated sooner", "verified", True,
      "https://www.aft.gouv.fr/en/dernieres-adjudications", "Reuse allowed when free, non-commercial and unaltered, with source and date. Access is uneven: several pages refused the reading tool."),
    s("bdi_auctions", "Auction press releases", "Banca d'Italia", "Italian auctions: offered, bids, allotted, price, yield, cover", "Same day, one PDF per auction", "verified", True,
      "https://www.bancaditalia.it/media/comunicati/", "Read once. The bank's site terms do not allow reproduction on another site without written authorisation: before sharing, switch to the Treasury (MEF) pages or ask."),
    s("tesoro_auctions", "Auction results and calendar", "Tesoro Publico", "Spanish auctions: bids, allotted, marginal and average yield, cover", "Same day", "verified", True,
      "https://www.tesoro.es/deuda-publica/subastas/calendario", "No ISIN on the pages. Reuse must be faithful and name the source."),
    s("feeds", "Official news feeds", "ECB, Deutsche Bundesbank, Banco de Espana", "Press releases, speeches, auction notices", "Continuous, 10 to 20 items per feed", "verified", True,
      "https://www.ecb.europa.eu/home/html/rss.en.html", "The ECB copy read was three days old: freshness to be confirmed by the daily script."),
    s("calendars", "Meeting and release calendars", "ECB, Eurostat", "Monetary policy meetings to 2028, euro area releases to March 2027", "As published", "verified", True,
      "https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html", "Rating review calendars and national statistics calendars are not loaded yet."),
    s("eurex", "Daily statistics and deliverable bonds", "Eurex", "Settlement, volume, open interest for six bond futures; baskets and conversion factors", "Daily, 36 trading days kept", "verified", True,
      "https://www.eurex.com/ex-en/data/clearing-files/notified-deliverable-bonds-conversion-factors",
      "Shown with the written consent of Deutsche Boerse." if AUTH else "Private preview only: the site terms do not allow publication without written consent from Deutsche Boerse."),
    s("bbk_prices", "Prices and yields of listed Federal securities, by ISIN", "Deutsche Bundesbank", "German bonds: clean price, dirty price, yield, since issue", "Daily, next morning", "verified", True,
      "https://www.bundesbank.de/de/service/bundeswertpapiere/kurse-und-renditen", "Reference price set around midday in Frankfurt, not a closing price."),
    # ------------------------------------------------------------------ audited, not used yet
    s("ecb_api", "ECB Data Portal API (rates, euro area yield curves)", "European Central Bank", "Euro short-term rate with volumes, key rates, AAA and all-issuer curves", "Daily", "blocked", False,
      "https://data.ecb.europa.eu/help/api/data", "Series keys checked on the portal. The download could not be tested here: to be run by the daily script."),
    s("eurostat_curve", "Euro area yield curves", "Eurostat, from ECB data", "Euro area aggregate only, spot rates, since 2004", "Daily, two days late", "verified", False,
      "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/irt_euryld_d?format=JSON&lang=EN&lastTimePeriod=3&maturity=Y10&yld_curv=SPOT_RT&bonds=CGB_EA_AAA", "No country detail."),
    s("bdf_oat", "Indicative rates of Treasury bills and OAT", "Banque de France", "France, daily", "Stopped on 10 July 2024", "planned", False,
      "https://www.banque-france.fr/fr/statistiques/themes-statistiques-et-series-webstat-associees/taux-et-cours", "The page sends readers to monthly figures from Agence France Tresor."),
    s("bdf_tec", "TEC constant-maturity indices, 1 to 30 years", "Banque de France, calculated by Euronext Paris", "France, daily since 2004", "Daily, around 11:30" if FRANCE else "Daily", "verified" if FRANCE else "planned", FRANCE,
      "https://www.banque-france.fr/fr/statistiques/taux-et-cours/indices-obligataires-2026-11-18",
      (("TEC indices are calculated and administered by Euronext Paris and shown with its written authorisation. " if AUTH else "Private use only: the page gives the values for information and forbids redistribution, sub-licensing and commercial use without prior written authorisation from Euronext Paris (contact on the page: indexEOD@euronext.com). ") +
       "Yields interpolated between the two nearest government bonds, from MTS prices taken at 11:00 (technical note of the Banque de France, 2020 version). Downloaded each weekday from the Banque de France export (history since 2004)." if FRANCE else
       "The data exist and were read (10-year at 4.913 % on 17 Nov 2026). Kept out: the page forbids redistribution without written authorisation from Euronext Paris."), short="Banque de France (TEC, Euronext)"),
    s("it_bmk", "Benchmark government bond yields, table BMK0200", "Banca d'Italia", "Italy, benchmark BTP yields (3, 10 and 30 years seen), daily", "Daily", "unverified", False,
      "https://www.bancaditalia.it/statistiche/tematiche/mercati/index.html",
      "Documented, not downloaded: the statistics site needs a browser. The bank's site terms restrict reproduction on other sites. Rendistato, also read, is monthly."),
    s("bdf_zc", "Zero-coupon yield curve", "Banque de France", "France", "Not read", "planned", False,
      "https://www.banque-france.fr/fr/courbes-des-taux-zero-coupon", "Kept out: redistribution is not allowed without written agreement."),
    s("euribor", "Euribor, 1 week to 12 months", "EMMI, republished by Bundesbank and Suomen Pankki", "Daily fixings with a one-day delay", "Daily", "verified", False,
      "https://www.bundesbank.de/en/statistics/money-and-capital-markets/interest-rates-and-yields/money-market-rates-651538",
      "Data verified on three sources. Not shown: redistribution is subject to EMMI's terms, to be confirmed for a public non-commercial page."),
    s("swaps", "Euro swap curves and asset swap levels", "None found", "Swaps against the euro short-term rate or Euribor, asset swaps by bond", "", "planned", False, None,
      "No free and reusable daily source was found. An asset swap proxy would need a swap curve first."),
    s("eurostat_mcby_d", "EMU convergence criterion series, daily data (irt_lt_mcby_d)", "Eurostat", "Daily 10-year yields by country, Italy included", "Withdrawn", "blocked", False,
      "https://ec.europa.eu/eurostat/cache/metadata/en/irt_lt_mcby_esms.htm",
      "No longer published: the dataset is absent from the Eurostat catalogue and every call to it returns HTTP 404 (tested from GitHub on 25 Nov 2026). The monthly series remain and are used."),
    s("bdi_bmk", "Benchmark government securities, gross yields, daily (table BMK0200)", "Banca d'Italia", "Italy: benchmark BTP at 3, 5, 10 and 30 years, CCT", "Daily values, file refreshed about once a month", "planned", False,
      "https://www.bancaditalia.it/footer/copyright",
      "The download works (tested from GitHub on 25 Nov 2026: 13,870 daily rows). Not loaded: the bank's terms require its prior written authorisation to reproduce content on another site, and these yields come from a third-party market. To request from statistiche@bancaditalia.it."),
    s("isin_other", "Prices by bond for France, Italy and Spain", "Stock exchanges and central banks", "Needed for rich/cheap and for OAT and BTP baskets", "", "unverified", False, None,
      "Borsa Italiana and BME terms forbid reusing their prices. No source found for France."),
]
notes = [
    "Daily yields since January 2015 for Germany, France and Spain, refreshed each weekday by a script on GitHub Actions. The French curve is the TEC index family of Euronext Paris, shown with its written authorisation. No daily Italian yield can be shown yet: Eurostat withdrew its daily series, and the daily table of Banca d'Italia needs a written authorisation (both are in the list of sources audited). Spreads for the other countries are shown on monthly averages.",
    "The three daily curves are not built the same way: an estimated par curve for Germany, yields interpolated between benchmark bonds for France, yields from market trades for Spain. Daily spreads are indicative.",
    "Yields are official daily fixings, not closing prices. The French TEC indices use prices taken at 11:00 and are published around 11:30. The German curve of a day is online the same afternoon (seen at 14:40 UTC on 25 Nov 2026); the Bundesbank reference prices of German bonds are set around midday. A 1-day change runs from one fixing to the next, and French and German yields may not be taken at the same time of day.",
    "Spanish yields are published two business days late, so Spain usually shows an older date than Germany and France.",
    "On 27 and 28 August and on 1 September 2026 the published German curve has a kink at the short end (2-year above 3-year). These are the values of the source.",
    "A few French days look odd and are kept as published, because the Banque de France daily pages show the same numbers: 1, 2 and 5 October 2026 (2-year unchanged at 3.688), 9 March 2026 (1-year above 2-year), 29 to 31 December 2025.",
    "French TEC values have two decimals until 24 July 2026 and three after. German yields have two decimals: a one basis point move is the smallest change the page shows for Germany.",
    "Each run is compared with a snapshot of 19 November 2026 in which every value was read twice by independent readings. The result is in data/raw/update_log.txt.",
    "Eurex keeps only 36 trading days of settlement prices: the script archives them each day, so futures history grows from November 2026.",
    "A daily value that jumps away from both neighbours by 75 bp or more and comes back is treated as a publication error and left out (for example Spain 5-year on 8 July 2016). Each one is listed in data/raw/update_log.txt.",
    "Auctions: Germany (Finanzagentur, history since 2015), Spain (Tesoro Publico) and Italy (MEF result PDFs) are refreshed each day. The AFT site refuses automated access, so French results are those read on 19 Nov 2026 and French dates follow the AFT calendar rule. The MEF terms of reuse were not found.",
    "Brief: the daily note is written by the page from the data at each load, with fixed rules listed under Methods; it describes the move from one fixing to the next and is not a forecast. An independent Python version of the same rules is compared with the page, word for word, at each update.",
    "Builder: any weighted sum of yields and structures, in bp (a weight of 1 on a yield adds that yield times 100). Saved structures stay in the browser and can be shared by link.",
    "Backtest: z on the window ending on the decision day, trade at the next fixing by default, P&L in bp of the structure with a flat cost per trade. Carry and roll-down can be added to the P&L: they are estimates from the constant-maturity curves, funded at the euro short-term rate (a proxy for repo), so a test with carry starts in October 2019 at the earliest. The main test is in sample; the walk-forward test picks the z window and the entry level on past data only, among 25 pairs, block after block.",
    "PCA: covariance of daily changes in bp over the chosen window. Rich / cheap: level residual after the first three components. Factor-neutral butterfly: wing weights that cancel the first two components.",
    "Carry and roll-down: funding at the euro short-term rate (a proxy, not repo), roll-down read on today's curve with linear interpolation between maturities. Fitted curve: Nelson-Siegel by least squares each day, decay parameter on a grid.",
    "Each run is checked before it is published: data present, sorted, in range and fresh; futures basis and CTD recomputed; auction cover equal to bids over allotted; every tab opened in a browser on desktop and phone, the builder, backtest, CSV export and custom range used like a person would; backtests with and without carry, walk-forward tests block by block, PCA, fitted curve and carry recomputed by an independent Python implementation and compared with the page. A failed check keeps the previous data online. Results in data/raw/verify.txt.",
]
if EXTRA.exists():
    extra = json.load(open(EXTRA))
    sources += extra.get("sources", []); notes += extra.get("notes", [])
import datetime
json.dump(dict(updated=datetime.date.today().isoformat(), sources=sources, notes=notes), open(OUT / "sources.json", "w"), indent=1)
print("sources.json:", len(sources), "sources,", len(notes), "notes")
