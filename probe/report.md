# Download test, Eurex option series and Banca d'Italia BMK0200, 2026-11-25 15:21 UTC

test date 20261123; OGBL expiries offered: [('20261127', 'W'), ('20261204', 'W'), ('20261211', 'W'), ('20261218', 'W'), ('20261223', 'M'), ('20270108', 'W'), ('20270122', 'M'), ('20270219', 'M'), ('20270521', 'M')]
## page scripts: 7
- https://www.eurex.com/blueprint/ruxitagentjs_ICA15789NPRTUVXfqrux_10349261020121938.js: 396464 chars, api strings [], statistics words []
- https://www.eurex.com/resource/settings/options/cookiebanner/additional_cookie_script-2125908-5.js: 5329 chars, api strings [], statistics words []
- https://www.eurex.com/resource/settings/options/cookiebanner/eds_exchange_cookie-2125914-48.js: 146388 chars, api strings [], statistics words []
- https://www.eurex.com/resource/themes/eurex-facelift/js/chunkPathById-3852728-57.js: 5657 chars, api strings [], statistics words []
- https://www.eurex.com/resource/themes/eurex-facelift/js/commons-3627262-67.js: 92494 chars, api strings [], statistics words []
- https://www.eurex.com/resource/themes/eurex-facelift/js/eurex-facelift-2226540-98.js: 67074 chars, api strings [], statistics words ['statistics']
- https://www.eurex.com/resource/themes/eurex-facelift/js/eurex-head-2266692-95.js: 577604 chars, api strings [], statistics words []

## candidate endpoints for OGBL, expiry 20261223
- statistics/70050?busdate=20261123&cp=Call&month=12&year=2026: HTTP Error 404: Not Found
- detailstatistics/70050?busdate=20261123&cp=Call&month=12&year=2026: HTTP Error 404: Not Found
- OK overallstatistics/70050?busdate=20261123&cp=Call&month=12&year=2026: 2420 bytes, keys ['header', 'meta', 'dataRows'], 9 rows, row keys ['date', 'callVolume', 'callOpenInterest', 'putVolume', 'putOpenInterest', 'putCallRatio', 'total', 'contractType']
- overallstatistics/70050/20261223?busdate=20261123: HTTP Error 404: Not Found
- statistics/70050/20261223?busdate=20261123: HTTP Error 404: Not Found
- contractstatistics/70050?busdate=20261123&date=20261223&cp=C: HTTP Error 404: Not Found
- singlestatistics/70050?busdate=20261123&date=20261223: HTTP Error 404: Not Found
- OK overallstatistics/70050?busdate=20261123&date=20261223&contractType=M&cp=Call: 2420 bytes, keys ['header', 'meta', 'dataRows'], 9 rows, row keys ['date', 'callVolume', 'callOpenInterest', 'putVolume', 'putOpenInterest', 'putCallRatio', 'total', 'contractType']
- statistics/70050?busdate=20261123: HTTP Error 404: Not Found
- detailedstatistics/70050?busdate=20261123&date=20261223: HTTP Error 404: Not Found
- dailystatistics/70050?busdate=20261123&date=20261223: HTTP Error 404: Not Found

## Banca d'Italia BMK0200 DATA: 214037 bytes, starts with b'PK\x03\x04'
- file 20261111_113355-TIMESERIES-MULTICUBE.csv: 771799 chars, 13871 lines; header: "DATA_OSS";"MFN_BMK.D.001A.922.0.EUR.9";"MFN_BMK.D.020.922.0.EUR.203";"MFN_BMK.D.020.922.0.EUR.205";"MFN_BMK.D.020.922.0.EUR.210";"MFN_BMK.D.020.922.0.EUR.230";"MFN_BMK.D.035A.922.0.EUR.9"
    dates found: 0, from None to None
    column DATA_OSS: 13870 distinct values (not listed)
    column MFN_BMK.D.001A.922.0.EUR.9: 6544 distinct values (not listed)
    column MFN_BMK.D.020.922.0.EUR.203: 8468 distinct values (not listed)
    column MFN_BMK.D.020.922.0.EUR.205: 9116 distinct values (not listed)
    column MFN_BMK.D.020.922.0.EUR.210: 8728 distinct values (not listed)
    column MFN_BMK.D.020.922.0.EUR.230: 8071 distinct values (not listed)
    column MFN_BMK.D.035A.922.0.EUR.9: 8688 distinct values (not listed)

## Banca d'Italia BMK0200 ALL: 216134 bytes, starts with b'PK\x03\x04'
- file BMK0200_LEGEND.csv: 1170 chars, 21 lines; header: "Object Type";"Code";"Description"
    dates found: 0, from None to None
    column Object Type: ['', 'Attribute', 'Classification variable', 'General definitions', 'Key Family', 'Measure', 'Multidimensional cube', 'Publication', 'Statistical table', 'Time series', 'Variable']
    column Code: ['', 'Attribute', 'BMK', 'Key identifier component', 'MFN', 'MFN_BMK.D.001A.922.0.EUR.9', 'MFN_BMK.D.020.922.0.EUR.203', 'MFN_BMK.D.020.922.0.EUR.205', 'MFN_BMK.D.020.922.0.EUR.210', 'MFN_BMK.D.020.922.0.EUR.230', 'MFN_BMK.D.035A.922.0.EUR.9', 'Measure', 'Sequence of data points, measured typically at successive points in time spaced at uniform time intervals', 'Set of information with the same data structure', 'Set of multidimensional cubes or time series grouped for publication', 'Set of statistical tables contextually published', 'Variable']
    column Description: ['Gross yield of benchmark 10-year BTP', 'Gross yield of benchmark 3-year BTP', 'Gross yield of benchmark 30-year BTP', 'Gross yield of benchmark 5-year BTP', 'Gross yield of benchmark CCT', 'Gross yield of benchmark CTZ', 'The financial market', 'Titoli di Stato Guida']
- file BMK0200_STRUCTURE.csv: 7352 chars, 96 lines; header: "Cube";"Variable";"Description";"Type";"Domain";"Domain values"
    dates found: 0, from None to None
    column Cube: ['', 'Legend', 'MFN_BMK.D.001A.922.0.EUR.9', 'MFN_BMK.D.020.922.0.EUR.203', 'MFN_BMK.D.020.922.0.EUR.205', 'MFN_BMK.D.020.922.0.EUR.210', 'MFN_BMK.D.020.922.0.EUR.230', 'MFN_BMK.D.035A.922.0.EUR.9']
    column Variable: ['', 'AT', 'COMP_TIT', 'DATA_OSS', 'DESCRIPTION', 'DURORI', 'FONTE', 'FREQ', 'MS', 'NOTE', 'SCALA', 'STATUS', 'TDATO', 'TIME_FORMAT', 'UNMIS', 'VALORE', 'VALUTAZ', 'VALUTA_DENOM', 'VC']
    column Description: ['', 'Attribute', 'Classification Variable', 'DESCRIPTION', 'Frequency', 'Measure', 'Notes', 'Observation date', 'Operation currency', 'Original maturity', 'Scale', 'Source of data', 'Status of observation', 'TIME FORMAT', 'Type of data', 'Type of securities', 'Unit', 'Valuation', 'Value']
    column Type: ['AT', 'MS', 'VC']
    column Domain: ['AUTODESCRIPTIVE', 'CL_TIME_FORMAT', 'COMPTIT', 'DURATA', 'FONTE', 'FREQUENZA', 'NUMBER', 'SCALA', 'STATOSSERV', 'TEMPO', 'TIPODATO', 'UNMIS', 'VALUT', 'VALUTISO']
    column Domain values: 26 distinct values (not listed)
- file BMK0200_DATA.csv: 771799 chars, 13871 lines; header: "DATA_OSS";"MFN_BMK.D.001A.922.0.EUR.9";"MFN_BMK.D.020.922.0.EUR.203";"MFN_BMK.D.020.922.0.EUR.205";"MFN_BMK.D.020.922.0.EUR.210";"MFN_BMK.D.020.922.0.EUR.230";"MFN_BMK.D.035A.922.0.EUR.9"
    dates found: 0, from None to None
    column DATA_OSS: 13870 distinct values (not listed)
    column MFN_BMK.D.001A.922.0.EUR.9: 6544 distinct values (not listed)
    column MFN_BMK.D.020.922.0.EUR.203: 8468 distinct values (not listed)
    column MFN_BMK.D.020.922.0.EUR.205: 9116 distinct values (not listed)
    column MFN_BMK.D.020.922.0.EUR.210: 8728 distinct values (not listed)
    column MFN_BMK.D.020.922.0.EUR.230: 8071 distinct values (not listed)
    column MFN_BMK.D.035A.922.0.EUR.9: 8688 distinct values (not listed)
- file BMK0200_DOMAIN.csv: 836 chars, 23 lines; header: "Domain";"Element";"Description"
    dates found: 0, from None to None
    column Domain: ['CL_TIME_FORMAT', 'COMPTIT', 'DURATA', 'FONTE', 'FREQUENZA', 'SCALA', 'STATOSSERV', 'TIPODATO', 'UNMIS', 'VALUT', 'VALUTISO']
    column Element: ['', '-2', '0', '001A', '020', '035A', '102', '203', '205', '210', '230', '9', '922', 'BIVA', 'D', 'E', 'EUR', 'L', 'M', 'NP', 'P', 'Z']
    column Description: ['10 years', '3 years', '30 years', '5 years', 'BTPS', 'Bank of italy computations based on various sources', 'CCTS', 'CCYYMMDD', 'Daily', 'Estimated value', 'Euro', 'Gross yield', 'Information provided with two decimal points', 'Missing value', 'Missing value; data exist but were not collected', 'NORMALE', 'Nil or less than half the final digit shown', 'Not required', 'Provisional value', 'Pure numbers', 'Total maturity', 'Zero-coupon bonds with maturity over one year']
