#!/bin/sh
# Recomputes the lab figures (backtests, PCA, fitted curve, carry and roll-down) in Python and compares them with what the page shows.
set -e
node tests/read_lab_page.mjs . tests/lab_case.json > /tmp/lab_page.json
python pipeline/check_lab.py data/market.json tests/lab_case.json > /tmp/lab_py.json
python tests/compare_lab.py /tmp/lab_page.json /tmp/lab_py.json | tee /tmp/lab_check.txt
