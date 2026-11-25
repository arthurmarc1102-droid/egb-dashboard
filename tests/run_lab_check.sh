#!/bin/sh
# Recomputes the brief (closing note, moves, z-scores, curve ladder) and the lab figures (backtests, PCA, fitted curve, carry and roll-down)
# in Python and compares them with what the page shows.
set -e
node tests/read_lab_page.mjs . tests/lab_case.json > /tmp/lab_page.json
python pipeline/check_lab.py data/market.json tests/lab_case.json > /tmp/lab_py.json
python pipeline/check_home.py data/market.json data/futures.json "$(python -c "import json;print(json.dumps(json.load(open('tests/lab_case.json'))['home']))")" > /tmp/home_py.json
python tests/compare_lab.py /tmp/lab_page.json /tmp/lab_py.json /tmp/home_py.json | tee /tmp/lab_check.txt
