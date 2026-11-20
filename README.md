# EGB Dashboard

Dashboard of euro-area government bond (EGB) markets, built on public end-of-day data: curves and spreads to Germany, slopes, butterflies, z-scores and percentiles, regressions and correlations, short rates, Eurex bond futures (basis, implied repo, cheapest-to-deliver), auctions, news and calendar.

Author: Arthur Marc. Plain HTML, CSS and JavaScript (D3 for charts). Everything derived is computed in the browser from the JSON files in `data/`.

## Status

- The data in `data/` is a **snapshot dated 19 November 2026** (close of 18 November). It is not refreshed automatically yet.
- Every series was read twice, independently, and only identical values were kept. The Sources tab lists each source, its status and its known limits.
- French TEC indices (Euronext Paris) and Eurex data are shown with the written authorisation of their publishers.
- No swap or asset swap data: no free source was found.

## Layout

- `index.html`, `data/`: the page and its data (served by GitHub Pages).
- `src/`: page sources. `python3 build.py` assembles them into one `index.html`.
- `real/`: scripts that build the data files from the readings.
- `docs/`: source audit, architecture, plan and journal (in French).
