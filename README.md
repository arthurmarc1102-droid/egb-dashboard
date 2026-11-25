# EGB Dashboard

Dashboard of euro-area government bond (EGB) markets, built on public daily data (official fixings, not closing prices): curves and spreads to Germany, slopes, butterflies, boxes, z-scores and percentiles, regressions, betas and correlations, a builder for any weighted structure, a chart workbench, z-score backtests with sensitivity grids and scans, PCA of the curve with factor-neutral butterflies, carry and roll-down, rich / cheap against a fitted Nelson-Siegel curve, short rates, Eurex bond futures (basis, implied repo, cheapest-to-deliver), auctions, news and calendar. Every table and chart exports to CSV.

Author: Arthur Marc. Plain HTML, CSS and JavaScript (D3 for charts). Everything derived is computed in the browser from the JSON files in `data/`.

## Status

- Data refreshed each weekday by GitHub Actions (`.github/workflows/update.yml`, about 19:17 UTC and 06:23 UTC), history since January 2015.
- Sources: Bundesbank (German par curve, euro short-term rate, German bond prices), Banque de France (TEC indices, Euronext), Banco de Espana, Eurostat, Eurex, ECB / Bundesbank / Banco de Espana news feeds.
- Each run is compared with a snapshot of 19 Nov 2026 in which every value was read twice independently: see `data/raw/update_log.txt`.
- French TEC indices (Euronext Paris) and Eurex data are shown with the written authorisation of their publishers.
- No swap or asset swap data, and no daily Italian curve: no free source that allows reuse was found.
- German, Spanish and Italian auction results and the event calendar are refreshed automatically. French results are not: the AFT site refuses scripted access, so they stay at the reading of 19 Nov 2026.
- Before each publication the data and the page are checked (`pipeline/verify.py`, `pipeline/page_check.mjs` in a headless browser, desktop and phone). If a check fails, the data are not published. Result of the last run: `data/raw/verify.txt`.

## Layout

- `index.html`, `data/`: the page and its data (served by GitHub Pages).
- `data/raw/`: archives (Eurex settlements, basket file) and the log of the last run.
- `pipeline/update.py`: downloads, checks and builds the data files. `pipeline/sources.py`: source list and known limits.
- `src/`: page sources (`index.html`, `style.css`, `app.js`, `home.js` for the brief, `lab.js` for the builder, PCA, carry and backtests). `python3 build.py` assembles them into `index.html`.
- `preview.png`: picture shown when the link is shared, redrawn by the pipeline when new daily fixings are published.
- `tests/`: comparison of the page with independent Python implementations (`pipeline/check_home.py` for the brief, word for word; `pipeline/check_lab.py` for backtests, PCA, fitted curve, carry and roll-down).
- `docs/`: source audit, architecture, plan and journal (in French).
