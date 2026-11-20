# EGB Dashboard

Dashboard of euro-area government bond (EGB) markets, built on public end-of-day data: curves and spreads to Germany, slopes, butterflies, z-scores and percentiles, regressions and correlations, short rates, Eurex bond futures (basis, implied repo, cheapest-to-deliver), auctions, news and calendar.

Author: Arthur Marc. Plain HTML, CSS and JavaScript (D3 for charts). Everything derived is computed in the browser from the JSON files in `data/`.

## Status

- Data refreshed each weekday by GitHub Actions (`.github/workflows/update.yml`, about 19:17 UTC and 06:23 UTC), history since January 2015.
- Sources: Bundesbank (German par curve, euro short-term rate, German bond prices), Banque de France (TEC indices, Euronext), Banco de Espana, Eurostat, Eurex, ECB / Bundesbank / Banco de Espana news feeds.
- Each run is compared with a snapshot of 19 Nov 2026 in which every value was read twice independently: see `data/raw/update_log.txt`.
- French TEC indices (Euronext Paris) and Eurex data are shown with the written authorisation of their publishers.
- No swap or asset swap data: no free source was found. Auctions and the event calendar are not refreshed automatically yet.

## Layout

- `index.html`, `data/`: the page and its data (served by GitHub Pages).
- `data/raw/`: archives (Eurex settlements, basket file) and the log of the last run.
- `pipeline/update.py`: downloads, checks and builds the data files. `pipeline/sources.py`: source list and known limits.
- `src/`: page sources. `python3 build.py` assembles them into `index.html`.
- `docs/`: source audit, architecture, plan and journal (in French).
