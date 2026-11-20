# Download test, 2026-11-20 17:00 UTC, run on GitHub Actions

## bbk_par_sdmxjson
- url: https://api.statistiken.bundesbank.de/rest/data/BBSIS/D.I.ZAR.ZI.EUR.S1311.B.A604.R10XX.R.A.A._Z._Z.A?format=sdmx_json&lang=en&startPeriod=2026-11-10
- status: 200 | type: application/vnd.sdmx.data+json;version=1.0.0;charset=UTF-8 | bytes: 4686 | 1.7s

```
{"meta":{"schema":"https://raw.githubusercontent.com/sdmx-twg/sdmx-json/develop/data-message/tools/schemas/1.0/sdmx-json-data-schema.json","id":"BBSIS_D_I_ZAR_ZI_EUR_S1311_B_A604_R10XX_R_A_A__Z__Z_A","test":false,"prepared":"2026-11-20T11:29:00.000Z","contentLanguages":["de"],"sender":{"id":"BBK","names":{"de":"Deutsche Bundesbank"},"contact":[{"name":"Deutsche Bundesbank","emails":["presse-information@bundesbank.de"]}]}},"data":{"structure":{"dimensions":{"dataSet":[{"id":"DATAFLOW","name":"DATAFLOW","keyPosition":0,"default":"BBSIS","values":[{"id":"BBSIS","name":"BBSIS"}]}],"series":[{"id":"BBK_STD_FREQ","name":"BBK_STD_FREQ","keyPosition":1,"default":"D","values":[{"id":"D","name":"D"}]},{"id":"BBK_SEIS_BEARER_REG","name":"BBK_SEIS_BEARER_REG","keyPosition":2,"default":"I","values":[{"id":"I","name":"I"}]},{"id":"BBK_SEIS_ITEM","name":"BBK_SEIS_ITEM","keyPosition":3,"default":"ZAR","values":[{"id":"ZAR","name":"ZAR"}]},{"id":"BBK_SEIS_VALUATION","name":"BBK_SEIS_VALUATION","keyPosition":4,"default":"ZI","values":[{"id":"ZI","name":"ZI"}]},{"id":"BBK_STD_CURRENCY","name":"BBK_STD_CURRENCY","keyPosition":5,"default":"EUR","values":[{"id":"EUR","name":"EUR"}]},{"id":"BBK_SEIS_ISSUER_CLASS","name":"BBK_SEIS_ISSUER_CLASS","keyPosition":6,"default":"S1311","values":[{"id":"S1311","name":"S1311"}]},{"id":"BBK_SEIS_LISTED_SUB","name":"BBK_SEIS_LISTED_SUB","keyPosition":7,"default":"B","values":[{"id":"B","name":"B"}]},{"id":"BBK_SEIS_SECURITY_CLASS","name":"BBK_SEIS_SECURITY_CLAS
```

... end:

```
values":[null,{"name":"-0.02"},{"name":"0.06"},{"name":"-0.01"},{"name":"0.08"},{"name":"0.02"},{"name":"-0.04"},{"name":"0.01"},{"name":"-0.05"}]},{"id":"OBS_STATUS","name":"OBS_STATUS","relationship":{"none":{}},"values":[null,{"name":"K"}]}]}},"dataSets":[{"action":"Replace","validFrom":"2026-11-20T11:29:00.245Z","series":{"0:0:0:0:0:0:0:0:0:0:0:0:0:0:0":{"attributes":[1,1,1,1,1,1,1],"observations":{"0":["3.28",1],"1":["3.34",2],"2":["3.33",3],"3":["3.41",4],"4":[null,0,1],"5":[null,0,1],"6":["3.43",5,0],"7":["3.39",6,0],"8":["3.41",5,0],"9":["3.42",7,0],"10":["3.37",8,0]}}},"links":[{"rel":"structure","urn":"urn:sdmx:org.sdmx.infomodel.datastructure.DataStructure=BBK:BBK_SEIS(1.0)"}]}]}}
```

## bbk_par_csv
- url: https://api.statistiken.bundesbank.de/rest/data/BBSIS/D.I.ZAR.ZI.EUR.S1311.B.A604.R10XX.R.A.A._Z._Z.A?format=csv&lang=en&startPeriod=2026-11-10
- status: 200 | type: application/vnd.bbk.data+csv;version=1.0.0;charset=UTF-8 | bytes: 623 | 0.6s

```
﻿"",BBSIS.D.I.ZAR.ZI.EUR.S1311.B.A604.R10XX.R.A.A._Z._Z.A,BBSIS.D.I.ZAR.ZI.EUR.S1311.B.A604.R10XX.R.A.A._Z._Z.A_FLAGS
"","Yields, derived from the term structure of interest rates, on listed Federal securities with annual coupon payments / residual maturity of 10.0 years / daily data",
Decimals,2,
Time format code,P1D,
category,ZRZS,
unit,PROZENT,
unit multiplier,One,
last update,2026-11-20 12:29:00,
2026-11-10,3.28,
2026-11-11,3.34,
2026-11-12,3.33,
2026-11-13,3.41,
2026-11-14,.,No value available
2026-11-15,.,No value available
2026-11-16,3.43,
2026-11-17,3.39,
2026-11-18,3.41,
2026-11-19,3.42,
2026-11-20,3.37,

```

... end:

```

```

## bbk_par_history_depth
- url: https://api.statistiken.bundesbank.de/rest/data/BBSIS/D.I.ZAR.ZI.EUR.S1311.B.A604.R02XX+R10XX+R30XX.R.A.A._Z._Z.A?format=sdmx_json&lang=en&startPeriod=2015-01-01&endPeriod=2015-01-09
- status: 200 | type: application/vnd.sdmx.data+json;version=1.0.0;charset=UTF-8 | bytes: 5620 | 0.7s

```
{"meta":{"schema":"https://raw.githubusercontent.com/sdmx-twg/sdmx-json/develop/data-message/tools/schemas/1.0/sdmx-json-data-schema.json","id":"BBSIS_D_I_ZAR_ZI_EUR_S1311_B_A604_R02XX-R10XX-R30XX_R_A_A__Z__Z_A","test":false,"prepared":"2026-11-20T11:29:01.000Z","contentLanguages":["de"],"sender":{"id":"BBK","names":{"de":"Deutsche Bundesbank"},"contact":[{"name":"Deutsche Bundesbank","emails":["presse-information@bundesbank.de"]}]}},"data":{"structure":{"dimensions":{"dataSet":[{"id":"DATAFLOW","name":"DATAFLOW","keyPosition":0,"default":"BBSIS","values":[{"id":"BBSIS","name":"BBSIS"}]}],"series":[{"id":"BBK_STD_FREQ","name":"BBK_STD_FREQ","keyPosition":1,"default":"D","values":[{"id":"D","name":"D"}]},{"id":"BBK_SEIS_BEARER_REG","name":"BBK_SEIS_BEARER_REG","keyPosition":2,"default":"I","values":[{"id":"I","name":"I"}]},{"id":"BBK_SEIS_ITEM","name":"BBK_SEIS_ITEM","keyPosition":3,"default":"ZAR","values":[{"id":"ZAR","name":"ZAR"}]},{"id":"BBK_SEIS_VALUATION","name":"BBK_SEIS_VALUATION","keyPosition":4,"default":"ZI","values":[{"id":"ZI","name":"ZI"}]},{"id":"BBK_STD_CURRENCY","name":"BBK_STD_CURRENCY","keyPosition":5,"default":"EUR","values":[{"id":"EUR","name":"EUR"}]},{"id":"BBK_SEIS_ISSUER_CLASS","name":"BBK_SEIS_ISSUER_CLASS","keyPosition":6,"default":"S1311","values":[{"id":"S1311","name":"S1311"}]},{"id":"BBK_SEIS_LISTED_SUB","name":"BBK_SEIS_LISTED_SUB","keyPosition":7,"default":"B","values":[{"id":"B","name":"B"}]},{"id":"BBK_SEIS_SECURITY_CLASS","name":"BBK_SEIS_S
```

... end:

```
0",0,1],"2":[null,1,0],"3":[null,1,0],"4":["-0.10",0,1],"5":["-0.10",0,1],"6":["-0.10",0,1],"7":["-0.10",0,1],"8":["-0.11",0,2]}},"0:0:0:0:0:0:0:0:1:0:0:0:0:0:0":{"attributes":[1,1,2,1,1,2,1],"observations":{"0":[null,1,0],"1":["0.57",0,3],"2":[null,1,0],"3":[null,1,0],"4":["0.53",0,4],"5":["0.49",0,4],"6":["0.45",0,4],"7":["0.50",0,5],"8":["0.53",0,6]}},"0:0:0:0:0:0:0:0:2:0:0:0:0:0:0":{"attributes":[1,1,3,2,1,3,1],"observations":{"0":[null,1,0],"1":["1.48",0,3],"2":[null,1,0],"3":[null,1,0],"4":["1.42",0,7],"5":["1.33",0,8],"6":["1.24",0,8],"7":["1.30",0,9],"8":["1.35",0,5]}}},"links":[{"rel":"structure","urn":"urn:sdmx:org.sdmx.infomodel.datastructure.DataStructure=BBK:BBK_SEIS(1.0)"}]}]}}
```

## bbk_estr
- url: https://api.statistiken.bundesbank.de/rest/data/BBMMB/D.EU000A2X2A25.WT?format=sdmx_json&lang=en&startPeriod=2026-11-10
- status: 200 | type: application/vnd.sdmx.data+json;version=1.0.0;charset=UTF-8 | bytes: 3075 | 0.5s

```
{"meta":{"schema":"https://raw.githubusercontent.com/sdmx-twg/sdmx-json/develop/data-message/tools/schemas/1.0/sdmx-json-data-schema.json","id":"BBMMB_D_EU000A2X2A25_WT","test":false,"prepared":"2026-11-20T12:17:44.000Z","contentLanguages":["de"],"sender":{"id":"BBK","names":{"de":"Deutsche Bundesbank"},"contact":[{"name":"Deutsche Bundesbank","emails":["presse-information@bundesbank.de"]}]}},"data":{"structure":{"dimensions":{"dataSet":[{"id":"DATAFLOW","name":"DATAFLOW","keyPosition":0,"default":"BBMMB","values":[{"id":"BBMMB","name":"BBMMB"}]}],"series":[{"id":"BBK_STD_FREQ","name":"BBK_STD_FREQ","keyPosition":1,"default":"D","values":[{"id":"D","name":"D"}]},{"id":"BBK_MAMM_EST1_BENCHMARK_ITEM","name":"BBK_MAMM_EST1_BENCHMARK_ITEM","keyPosition":2,"default":"EU000A2X2A25","values":[{"id":"EU000A2X2A25","name":"EU000A2X2A25"}]},{"id":"BBK_MAMM_EST1_DATA_TYPE_EST","name":"BBK_MAMM_EST1_DATA_TYPE_EST","keyPosition":3,"default":"WT","values":[{"id":"WT","name":"WT"}]}],"observation":[{"id":"TIME_PERIOD","name":"TIME_PERIOD","keyPosition":4,"values":[{"id":"2026-11-10","name":"2026-11-10"},{"id":"2026-11-11","name":"2026-11-11"},{"id":"2026-11-12","name":"2026-11-12"},{"id":"2026-11-13","name":"2026-11-13"},{"id":"2026-11-14","name":"2026-11-14"},{"id":"2026-11-15","name":"2026-11-15"},{"id":"2026-11-16","name":"2026-11-16"},{"id":"2026-11-17","name":"2026-11-17"},{"id":"2026-11-18","name":"2026-11-18"},{"id":"2026-11-19","name":"2026-11-19"}]}]},"attributes":{"series":[{"id":
```

... end:

```
":[{"id":"BBK_DIFF","name":"BBK_DIFF","relationship":{"none":{}},"values":[null,{"name":"0.0"},{"name":"-0.1"},{"name":"0.2"},{"name":"-0.2"},{"name":"0.1"},{"name":"-0.0"}]},{"id":"OBS_STATUS","name":"OBS_STATUS","relationship":{"none":{}},"values":[null,{"name":"H"}]}]}},"dataSets":[{"action":"Replace","validFrom":"2026-11-20T12:17:44.298Z","series":{"0:0:0":{"attributes":[1,1,1,1,1,1,1,1],"observations":{"0":["2.442",1],"1":["2.439",2],"2":["2.443",3],"3":["2.437",4],"4":[null,0,1],"5":[null,0,1],"6":["2.440",5,0],"7":["2.441",1,0],"8":["2.442",1,0],"9":["2.441",6,0]}}},"links":[{"rel":"structure","urn":"urn:sdmx:org.sdmx.infomodel.datastructure.DataStructure=BBK:BBK_MAMM_EST1(1.0)"}]}]}}
```

## bbk_bond_prices
- url: https://api.statistiken.bundesbank.de/rest/data/BBSSY/D.KCP+KDP+REN.EUR..DE000BU2Z056.?format=sdmx_json&lastNObservations=3
- status: 200 | type: application/vnd.sdmx.data+json;version=1.0.0;charset=UTF-8 | bytes: 3467 | 0.5s

```
{"meta":{"schema":"https://raw.githubusercontent.com/sdmx-twg/sdmx-json/develop/data-message/tools/schemas/1.0/sdmx-json-data-schema.json","id":"BBSSY_D_KCP-KDP-REN_EUR__DE000BU2Z056_","test":false,"prepared":"2026-11-20T11:29:20.000Z","contentLanguages":["de"],"sender":{"id":"BBK","names":{"de":"Deutsche Bundesbank"},"contact":[{"name":"Deutsche Bundesbank","emails":["presse-information@bundesbank.de"]}]}},"data":{"structure":{"dimensions":{"dataSet":[{"id":"DATAFLOW","name":"DATAFLOW","keyPosition":0,"default":"BBSSY","values":[{"id":"BBSSY","name":"BBSSY"}]}],"series":[{"id":"BBK_STD_FREQ","name":"BBK_STD_FREQ","keyPosition":1,"default":"D","values":[{"id":"D","name":"D"}]},{"id":"BBK_SEIS_ITEM","name":"BBK_SEIS_ITEM","keyPosition":2,"default":"KCP","values":[{"id":"KCP","name":"KCP"},{"id":"KDP","name":"KDP"},{"id":"REN","name":"REN"}]},{"id":"BBK_STD_CURRENCY","name":"BBK_STD_CURRENCY","keyPosition":3,"default":"EUR","values":[{"id":"EUR","name":"EUR"}]},{"id":"BBK_SEIS_SECURITY_CLASS","name":"BBK_SEIS_SECURITY_CLASS","keyPosition":4,"default":"A630","values":[{"id":"A630","name":"A630"}]},{"id":"BBK_SEIS_ISIN","name":"BBK_SEIS_ISIN","keyPosition":5,"default":"DE000BU2Z056","values":[{"id":"DE000BU2Z056","name":"DE000BU2Z056"}]},{"id":"BBK_SEIS_RATING","name":"BBK_SEIS_RATING","keyPosition":6,"default":"A","values":[{"id":"A","name":"A"}]}],"observation":[{"id":"TIME_PERIOD","name":"TIME_PERIOD","keyPosition":7,"values":[{"id":"2026-11-18","name":"2026-11-18"},{"id":"202
```

... end:

```
":"BBK_DIFF","name":"BBK_DIFF","relationship":{"none":{}},"values":[null,{"name":"-0.1"},{"name":"0.4"},{"name":"0.5"},{"name":"0.3"},{"name":"-1.7"}]}]}},"dataSets":[{"action":"Replace","validFrom":"2026-11-20T11:29:05.091Z","series":{"0:0:0:0:0:0":{"attributes":[1,1,1,1,1,1,1,1],"observations":{"0":["94.570",1],"1":["94.500",1],"2":["94.900",2]}},"0:1:0:0:0:0":{"attributes":[1,2,2,1,1,2,1,1],"observations":{"0":["95.2610",1],"1":["95.2123",1],"2":["95.6195",2]}},"0:2:0:0:0:0":{"attributes":[1,2,3,1,1,3,1,1],"observations":{"0":["3.3254",3],"1":["3.3357",4],"2":["3.2806",5]}}},"links":[{"rel":"structure","urn":"urn:sdmx:org.sdmx.infomodel.datastructure.DataStructure=BBK:BBK_SESY(1.0)"}]}]}}
```

## bdf_tec_export
- url: https://webstat.banque-france.fr/export/csv-columns/fr/selection/5385693
- status: 200 | type: text/csv | bytes: 455095 | 1.1s

```
﻿Titre :;Taux de l'Echéance Constante - 1 an;Taux de l'Echéance Constante - 10 ans;Taux de l'Echéance Constante - 15 ans;Taux de l'Echéance Constante - 2 ans;Taux de l'Echéance Constante - 20 ans;Taux de l'Echéance Constante - 25 ans;Taux de l'Echéance Constante - 3 ans;Taux de l'Echéance Constante - 30 ans;Taux de l'Echéance Constante - 5 ans;Taux de l'Echéance Constante - 7 ans
Code série :;FM.D.FR.EUR.FR2.BB.FRMOYTEC1.HSTA;FM.D.FR.EUR.FR2.BB.FRMOYTEC10.HSTA;FM.D.FR.EUR.FR2.BB.FRMOYTEC15.HSTA;FM.D.FR.EUR.FR2.BB.FRMOYTEC2.HSTA;FM.D.FR.EUR.FR2.BB.FRMOYTEC20.HSTA;FM.D.FR.EUR.FR2.BB.FRMOYTEC25.HSTA;FM.D.FR.EUR.FR2.BB.FRMOYTEC3.HSTA;FM.D.FR.EUR.FR2.BB.FRMOYTEC30.HSTA;FM.D.FR.EUR.FR2.BB.FRMOYTEC5.HSTA;FM.D.FR.EUR.FR2.BB.FRMOYTEC7.HSTA
Unité :;Pourcent (PC);Pourcent (PC);Pourcent (PC);Pourcent (PC);Pourcent (PC);Pourcent (PC);Pourcent (PC);Pourcent (PC);Pourcent (PC);Pourcent (PC)
Magnitude :;Unités (0);Unités (0);Unités (0);Unités (0);Unités (0);Unités (0);Unités (0);Unités (0);Unités (0);Unités (0)
Méthode d'observation :;Fin de période (E);Fin de période (E);Fin de période (E);Fin de période (E);Fin de période (E);Fin de période (E);Fin de période (E);Fin de période (E);Fin de période (E);Fin de période (E)
Source :;Euronext (EUXT);Euronext (EUXT);Euronext (EUXT);Euronext (EUXT);Euronext (EUXT);Euronext (EUXT);Euronext (EUXT);Euronext (EUXT);Euronext (EUXT);Euronext (EUXT)
2026-11-20;3,366;4,874;5,193;3,636;5,326;5,307;3,877;5,426;4,235;4,553
2026-11-19;3,394;4,884;5,195
```

... end:

```
11-17;2,25;3,8;4,02;2,42;4,26;;2,64;;3,08;3,42
2004-11-16;2,26;3,8;4,03;2,41;4,26;;2,64;;3,07;3,42
2004-11-15;2,24;3,83;4,06;2,39;4,29;;2,64;;3,09;3,44
2004-11-14;-;-;-;-;-;;-;;-;-
2004-11-13;-;-;-;-;-;;-;;-;-
2004-11-12;2,24;3,85;4,08;2,39;4,31;;2,65;;3,1;3,46
2004-11-11;2,27;3,9;4,13;2,45;4,36;;2,7;;3,16;3,51
2004-11-10;2,3;3,92;4,14;2,49;4,37;;2,73;;3,18;3,53
2004-11-09;2,31;3,95;4,17;2,51;4,4;;2,77;;3,22;3,57
2004-11-08;2,31;3,96;4,18;2,53;4,41;;2,79;;3,23;3,58
2004-11-07;-;-;-;-;-;;-;;-;-
2004-11-06;-;-;-;-;-;;-;;-;-
2004-11-05;2,26;3,91;4,15;2,45;4,38;;2,71;;3,17;3,52
2004-11-04;2,25;3,93;4,17;2,45;4,4;;2,71;;3,18;3,54
2004-11-03;2,27;3,97;4,2;2,49;4,44;;2,76;;3,23;3,59

```

## bdf_tec_daily_page
- url: https://www.banque-france.fr/fr/statistiques/taux-et-cours/indices-obligataires-2026-11-20
- status: 200 | type: text/html; charset=UTF-8 | bytes: 315621 | 0.1s

```
<!DOCTYPE html>
<html lang="fr" dir="ltr" prefix="content: http://purl.org/rss/1.0/modules/content/  dc: http://purl.org/dc/terms/  foaf: http://xmlns.com/foaf/0.1/  og: http://ogp.me/ns#  rdfs: http://www.w3.org/2000/01/rdf-schema#  schema: http://schema.org/  sioc: http://rdfs.org/sioc/ns#  sioct: http://rdfs.org/sioc/types#  skos: http://www.w3.org/2004/02/skos/core#  xsd: http://www.w3.org/2001/XMLSchema# ">
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0">
    <meta charset="utf-8" />
<link rel="canonical" href="https://www.banque-france.fr/fr/statistiques/taux-et-cours/indices-obligataires-2026-11-20" />
<meta property="og:site_name" content="Banque de France" />
<meta property="og:type" content="Webstat" />
<meta property="og:url" content="https://www.banque-france.fr/fr/statistiques/taux-et-cours/indices-obligataires-2026-11-20" />
<meta property="og:title" content="Indices obligataires - 2026-11-20 | Banque de France" />
<meta property="og:image" content="https://www.banque-france.fr/sites/bdf_espaces2/themes/custom/bdf_espaces2/assets/images/default.png" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:site" content="@banquedefrance" />
<meta name="twitter:title" content="Indices obligataires - 2026-11-20 | Banque de France" />
<meta name="twitter:image" content="https://www.banque-france.fr/sites/bdf_espaces2/themes/custom/bdf_espaces2/assets/images/default.png" />
<m
```

... end:

```
Az6KnR91XAgEK5M0Y1eOiJrOrDEXct_xDKkHD6Z4HylwzGblD-8Ucf59d_zjRHVqAymFPCm97Lv5enLs-ACe_zQo"></script>
<script src="https://cdn.jsdelivr.net/npm/jquery-validation@1.21.0/dist/jquery.validate.min.js"></script>
<script src="/sites/bdf_espaces2/files/js/js_UmKU8-2RXIei8dpWHQ9p_oNaH_V7hw7qI_jdC6irt6E.js?scope=footer&amp;delta=4&amp;language=fr&amp;theme=bdf_espaces2&amp;include=eJyNkOFuhTAIhV_I2mQv1FCKym4tXUEz337u6rYbtyX3H5zzQeDENATSCkj64scsEbJT2zKXsYuP3kSQqLnMUf80pBpLURehXXweJ5yg2WVuprI4QOOVukhm1AK9V1FKYeC8t-phMQm6xJntP2SkQg1yF0VMrUEN-wGN5foLZqZiyonCCpkTfF4bXt8WapvHtT-qHm-U2KQ9y_NAz6KnR91XAgEK5M0Y1eOiJrOrDEXct_xDKkHD6Z4HylwzGblD-8Ucf59d_zjRHVqAymFPCm97Lv5enLs-ACe_zQo"></script>

  </body>
</html>

```

## bde_ead002_csv
- url: https://www.bde.es/webbe/es/estadisticas/compartido/datos/csv/ead002.csv
- status: 200 | type: text/csv | bytes: 4219629 | 6.2s

```
"C�DIGO DE LA SERIE",DBLEESI500100000IBDI_2004.B,DBLEESI500300000IBDI_2004.B,D_DNBAA301,D_DNBAF172,D_DNBCEA72,D_DTES00B7,D_DTES00V7,D_DNBAF304,D_DTFK08A0,D_KG8SZ12M,D_DTES00U7,D_DTFK09A0,D_G0B1F0ZP,DBLEESI100000000IBDI.B,DBLEESI500600000IBDI_2004.B,D_DNBAA172,D_DNBAA317,D_DNBAE172,D_DNBAF301,D_DNBCEB72,D_DTED0I0G,D_KG8SZ06M,D_DNBAA572,D_DNBAD317,D_G0B1F0ZI,D_DNBAD304,D_DNBAS172,D_DTED0E0G,D_DTES00T7,D_G0B1F0ZE,D_G0B1F0ZO,D_G0B1F0ZQ,D_KG8SZ18M,DBLEESI500200000IBDI_2004.B,DBLEESI500400000IBDI_2004.B,D_DNBAA304,D_DNBAF317,D_DTED0H0G,D_DTES00S7,D_G0B1F0ZD,D_G0B1F0ZN,D_KG8SZ03M,DBLEESI500000000IBDI.B,DBLEESI500500000IBDI_2004.B,D_DNBAC172,D_DNBAD172,D_DNBAD301,D_DTED0C0G,D_DTED0G0G
"N�MERO SECUENCIAL",1148748,1148847,63915,579349,4573260,80395,80475,64017,4562341,631502,80465,4562340,97265,821340,1148958,579344,63931,579348,64014,4573259,74843,631500,5056707,63980,97260,63967,579345,74702,80455,97256,97264,303868,631503,1148779,1148891,63918,64030,74796,80445,97255,97263,631499,821341,1148925,579346,579347,63964,74655,74749
"ALIAS DE LA SERIE","%TI_1_6.3","%TI_1_6.4","%TI_1_7.11, %IT_NA_APP.84, %IT_NA_APP.85","%TI_1_7.7, %IT_NA_APP.81","%SI_2_2.4, %TI_1_1.3, %IT_NA_APP.74","%TI_1_3.1","%TI_1_3.5","%TI_1_7.10","%SI_2_2.3, %TI_1_1.2","%TI_1_3.15","%TI_1_3.4, %IT_NA_APP.106","%SI_2_2.1, %TI_1_1.1","%IT_NA_APP.111, %IT_NA_APP.112, %TI_1_3.11, %SI_1_5.64","%TI_1_6.8, %MF_NA_APP.42","%TI_1_6.7","%TI_1_7.2, %IT_NA_APP.77","%TI_1_7.14, %IT_NA_APP.86","%TI_1_7.6, %IT_NA_APP.80","%TI_1_7.13
```

... end:

```
692.20,"_",1.05,3.01,4.99,2.50,"_","_",2.44,1.27,3.94,4.34,2.42,"_",3.02,3.84,3.47,4.20,"_",2662.80,1969.60,3.90,1.79,"_",2.84,3.17,3.36,"_",1941.60,1573.40,2.48,2.78,4.28,"_","_"
"18 NOV 2026",3249.40,7552.70,3.82,3.35,2.90,"_","_",4.96,"_","_","_",2.65,"_",19373.30,678.90,"_",1.05,3.02,5.01,2.50,"_","_",2.44,1.27,"_",4.27,2.42,"_","_","_","_","_","_",2642.00,1964.30,3.90,1.78,"_","_","_","_","_",1915.60,1547.70,2.52,2.83,4.40,"_","_"
"19 NOV 2026",3224.70,7432.40,3.82,3.34,2.90,"_","_",4.98,"_","_","_",2.65,"_",19186.20,672.90,"_",1.05,3.04,5.01,2.50,"_","_",2.44,1.28,"_",4.28,2.38,"_","_","_","_","_","_",2603.80,1944.90,3.90,1.63,"_","_","_","_","_",1898.20,1536.70,2.53,2.85,4.31,"_","_"

```

## eurostat_mcby_m
- url: https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/irt_lt_mcby_m?format=JSON&geo=DE&geo=FR&lastTimePeriod=3
- status: 200 | type: application/json | bytes: 2633 | 0.5s

```
{"version":"2.0","class":"dataset","label":"EMU convergence criterion series - monthly data","source":"ESTAT","updated":"2026-11-12T11:00:00+0100","value":{"0":3.18500,"1":3.47300,"2":3.41600,"3":4.00000,"4":4.44000,"5":4.89000},"id":["freq","int_rt","geo","time"],"size":[1,1,2,3],"dimension":{"freq":{"label":"Time frequency","category":{"index":{"M":0},"label":{"M":"Monthly"}}},"int_rt":{"label":"Interest rate","category":{"index":{"MCBY":0},"label":{"MCBY":"EMU convergence criterion bond yields"}}},"geo":{"label":"Geopolitical entity (reporting)","category":{"index":{"DE":0,"FR":1},"label":{"DE":"Germany","FR":"France"}}},"time":{"label":"Time","category":{"index":{"2026-08":0,"2026-09":1,"2026-10":2},"label":{"2026-08":"2026-08","2026-09":"2026-09","2026-10":"2026-10"}}}},"extension":{"lang":"EN","id":"IRT_LT_MCBY_M","agencyId":"ESTAT","version":"1.0","datastructure":{"id":"IRT_LT_MCBY_M","agencyId":"ESTAT","version":"82.0"},"annotation":[{"type":"CREATED","date":"2009-03-27T17:52:43+0100"},{"type":"DISSEMINATION_DOI_XML","title":"<adms:identifier xmlns:adms=\"http://www.w3.org/ns/adms#\" xmlns:skos=\"http://www.w3.org/2004/02/skos/core.html\" xmlns:dct=\"http://purl.org/dc/terms/\" xmlns:rdf=\"http://www.w3.org/1999/02/22-rdf-syntax-ns#\"><adms:Identifier rdf:about=\"https://doi.org/10.2908/IRT_LT_MCBY_M\"><skos:notation rdf:datatype=\"http://purl.org/spar/datacite/doi\">10.2908/IRT_LT_MCBY_M</skos:notation><dct:creator rdf:resource=\"http://publications.europa.eu/resourc
```

... end:

```
:00:00+0100"},{"type":"ESMS_HTML","title":"Explanatory texts (metadata)","href":"https://ec.europa.eu/eurostat/cache/metadata/en/irt_lt_mcby_esms.htm"},{"type":"ESMS_SDMX","title":"Explanatory texts (metadata)","href":"https://ec.europa.eu/eurostat/api/dissemination/files?file=metadata/irt_lt_mcby_esms.sdmx.zip"},{"type":"OBS_COUNT","title":"12032"},{"type":"OBS_PERIOD_OVERALL_LATEST","title":"2026-10"},{"type":"OBS_PERIOD_OVERALL_OLDEST","title":"1980-01"},{"type":"SOURCE_INSTITUTIONS","text":"Eurostat"},{"type":"UPDATE_DATA","date":"2026-11-12T11:00:00+0100"},{"type":"UPDATE_STRUCTURE","date":"2026-11-12T11:00:00+0100"}],"positions-with-no-data":{"freq":[],"int_rt":[],"geo":[],"time":[]}}}
```

## eurex_stats_fgbl
- url: https://www.eurex.com/api/v1/overallstatistics/34656?busdate=20261119
- status: 200 | type: application/json;charset=UTF-8 | bytes: 1416 | 1.5s

```
{"header":{"volume":0.0,"openInterest":0.0,"underlyingClosingPrice":0.0,"tradingDates":["19-11-2026 12:00","18-11-2026 12:00","17-11-2026 12:00","16-11-2026 12:00","13-11-2026 12:00","12-11-2026 12:00","11-11-2026 12:00","10-11-2026 12:00","09-11-2026 12:00","06-11-2026 12:00","05-11-2026 12:00","04-11-2026 12:00","03-11-2026 12:00","02-11-2026 12:00","30-10-2026 12:00","29-10-2026 12:00","28-10-2026 12:00","27-10-2026 12:00","26-10-2026 12:00","23-10-2026 12:00","22-10-2026 12:00","21-10-2026 12:00","20-10-2026 12:00","19-10-2026 12:00","16-10-2026 12:00","15-10-2026 12:00","14-10-2026 12:00","13-10-2026 12:00","12-10-2026 12:00","09-10-2026 12:00","08-10-2026 12:00","07-10-2026 12:00","06-10-2026 12:00","05-10-2026 12:00","02-10-2026 12:00","01-10-2026 12:00","30-09-2026 12:00"]},"meta":{"productCode":"FGBL","isin":"DE0009652644","productType":"F"},"dataRows":[{"date":"20261208","open":121.97999999999996,"high":122.21000000000001,"low":121.52000000000004,"last":121.86999999999992,"dSettle":121.71999999999994,"volume":1063888.0,"openInt":1874986.0,"contractType":"M"},{"date":"20270308","open":122.01000000000012,"high":122.22999999999996,"low":121.55000000000008,"last":121.84999999999997,"dSettle":121.73999999999988,"volume":1572.0,"openInt":10820.0,"contractType":"M"},{"date":"20270608","open":0.0,"high":0.0,"low":0.0,"last":0.0,"dSettle":121.0,"volume":0.0,"openInt":2.0,"contractType":"M"}]}
```

... end:

```

```

## eurex_deliverables
- url: https://www.eurex.com/ex-en/data/clearing-files/notified-deliverable-bonds-conversion-factors
- status: 200 | type: text/html;charset=UTF-8 | bytes: 138061 | 0.9s

```

<!DOCTYPE html>
<html class="no-js" lang="en" dir="ltr"     data-js-iconsprite="/resource/crblob/2226488/e73e0326ac4d709ab336d51a0ddc2662/data/icon-sprite.svg.svg">
<head >
<meta charset="UTF-8">
<link rel="preload" href="/resource/themes/eurex-facelift/css/eurex-facelift-2226544-97.css" as="style">
<link rel="preload" href="/resource/themes/eurex-facelift/js/chunkPathById-3852728-57.js" as="script"><link rel="preload" href="/resource/themes/eurex-facelift/js/eurex-head-2266692-95.js" as="script">
<link rel="preload" href="/resource/themes/eurex-facelift/js/commons-3627262-67.js" as="script"><link rel="preload" href="/resource/themes/eurex-facelift/js/eurex-facelift-2226540-98.js" as="script">
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="Notified Bonds | Deliverable Bonds and Conversion Factors" />
<meta name="twitter:url" content="https://www.eurex.com/ex-en/data/clearing-files/notified-deliverable-bonds-conversion-factors">
<meta name="twitter:description" content="Notified Bonds for all Fixed Income Futures , Deliverable Bonds and Conversion Factors.
Conversion factor calculation for Euro-BTP Future
Conversion factor calculation for EUR-denominated bonds
Conversion factor calculation for CHF-denominated bonds" />
<meta property="og:site_name" content="Deutsche Börse Group"/>
<meta property="og:title" content="Notified Bonds | Deliverable Bonds and Conversion Factors"/>
<meta property="og:type" content="deriva
```

... end:

```
s="dbx-image-lightbox" data-image-lightbox data-label-open="Enlarge image" hidden>
<div class="dbx-image-lightbox__dialog" role="dialog" aria-modal="true" aria-label="Image view" tabindex="-1">
<button type="button" class="dbx-image-lightbox__close" aria-label="Close">
<span aria-hidden="true">&times;</span>
</button>
<figure class="dbx-image-lightbox__figure">
<img class="dbx-image-lightbox__img" alt="" />
<figcaption class="dbx-image-lightbox__caption" hidden></figcaption>
</figure>
</div>
</div>
<script src="/resource/themes/eurex-facelift/js/commons-3627262-67.js" ></script><script src="/resource/themes/eurex-facelift/js/eurex-facelift-2226540-98.js" ></script></body></html>

```

## rss_ecb
- url: https://www.ecb.europa.eu/rss/press.html
- status: 200 | type: application/rss+xml | bytes: 5783 | 0.7s

```
<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>
				<title>ECB - European Central Bank</title><link>https://www.ecb.europa.eu/</link><description>Latest releases on the ECB website - Press releases, speeches and interviews, press conferences.</description><language>en</language><copyright>Copyright 2026, European Central Bank</copyright>
				<webMaster>webmaster@ecb.europa.eu (ECB Webmaster)</webMaster><lastBuildDate>Fri, 20 Nov 2026 15:39:46 +0100</lastBuildDate>
				<category>Press</category>
				<generator>Automatic</generator>
				<docs>http://blogs.law.harvard.edu/tech/rss</docs><item><title> Christine Lagarde: Acting in time</title><link>https://www.ecb.europa.eu//press/key/date/2026/html/ecb.sp261120~e52bcc4db2.en.html</link><guid>https://www.ecb.europa.eu//press/key/date/2026/html/ecb.sp261120~e52bcc4db2.en.html</guid><pubDate>Fri, 20 Nov 2026 09:30:00 +0100</pubDate></item><item><title> Boris Vujčić: Financial Stability Review - November 2026</title><link>https://www.ecb.europa.eu//press/key/date/2026/html/ecb.sp261118~86f1e8147e.en.pdf</link><guid>https://www.ecb.europa.eu//press/key/date/2026/html/ecb.sp261118~86f1e8147e.en.pdf</guid><pubDate>Wed, 18 Nov 2026 10:00:00 +0100</pubDate></item><item><title> Risks from AI valuations, fiscal imbalances and geoeconomic tensions weigh on financial stability outlook</title><link>https://www.ecb.europa.eu//press/pr/date/2026/html/ecb.pr261118~83c5c60158.en.html</li
```

... end:

```
 in first three quarters of 2027 compared with the full year of 2026 </title><link>https://www.ecb.europa.eu//press/pr/date/2026/html/ecb.pr261104~caf181d7ac.en.html</link><guid>https://www.ecb.europa.eu//press/pr/date/2026/html/ecb.pr261104~caf181d7ac.en.html</guid><pubDate>Wed, 04 Nov 2026 01:00:00 +0100</pubDate></item><item><title> Boris Vujčić: Integrated, open and resilient: Europe’s strengths in a fragmenting world</title><link>https://www.ecb.europa.eu//press/key/date/2026/html/ecb.sp.261102~70003226e9.en.html</link><guid>https://www.ecb.europa.eu//press/key/date/2026/html/ecb.sp.261102~70003226e9.en.html</guid><pubDate>Mon, 02 Nov 2026 10:30:00 +0100</pubDate></item></channel></rss>
```

## rss_bbk
- url: https://www.bundesbank.de/service/rss/en/633306/feed.rss
- status: 200 | type: application/rss+xml;charset=UTF-8 | bytes: 7657 | 1.0s

```
<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:dc="http://purl.org/dc/elements/1.1/" version="2.0">
  <channel>
    <title>Latest</title>
    <link>https://www.bundesbank.de/en/homepage/rss/latest-633306</link>
    <description>Latest news and information at bundesbank.de</description>
    <language>en-GB</language>
    <dc:language>en-GB</dc:language>
    <item>
      <title>Invitation to bid – Federal Treasury discount paper (Bubills)</title>
      <link>https://www.bundesbank.de/en/press/press-releases/federal-securities/-invitation-to-bid-federal-treasury-discount-paper-bubills--1016580</link>
      <description />
      <enclosure url="https://www.bundesbank.de/resource/blob/1016580/0e8b105cc0fc7461d335398959552f1e/472B63F073F071307366337C94F8C870/2026-11-20-ausschreibung-download.pdf" length="162708" type="application/pdf" />
      <pubDate>Fri, 20 Nov 2026 09:00:00 GMT</pubDate>
      <guid>https://www.bundesbank.de/en/press/press-releases/federal-securities/-invitation-to-bid-federal-treasury-discount-paper-bubills--1016580</guid>
      <dc:creator />
      <dc:date>2026-11-20T09:00:00Z</dc:date>
    </item>
    <item>
      <title>Announcement of auction – Reopening 10-year Federal bond</title>
      <link>https://www.bundesbank.de/en/press/press-releases/federal-securities/announcement-of-auction-reopening-10-year-federal-bond-1016482</link>
      <description />
      <enclosure url="https://www.bundesbank.de/resource/blob/1016482/0c0fc90ca
```

... end:

```
undesbank.de/en/press/press-releases/federal-securities/invitation-to-bid-by-auction-reopening-of-federal-treasury-notes-1016080</link>
      <description />
      <enclosure url="https://www.bundesbank.de/resource/blob/1016080/19df39c53744399b1ce20dce7debc49b/472B63F073F071307366337C94F8C870/2026-11-16-ausschreibung-download.pdf" length="157131" type="application/pdf" />
      <pubDate>Mon, 16 Nov 2026 08:30:00 GMT</pubDate>
      <guid>https://www.bundesbank.de/en/press/press-releases/federal-securities/invitation-to-bid-by-auction-reopening-of-federal-treasury-notes-1016080</guid>
      <dc:creator />
      <dc:date>2026-11-16T08:30:00Z</dc:date>
    </item>
  </channel>
</rss>

```
