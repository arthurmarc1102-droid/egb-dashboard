# EGB Dashboard — Audit des sources

Audit du 19 novembre 2026 : 6 agents de recherche en parallèle, puis un agent de complément (France, Italie, Espagne) et 5 agents de lecture de données.

## 1. Comment lire cet audit

- **VÉRIFIÉ** = la donnée a été lue ce jour-là sur la page ou l'API officielle. La lecture passe par un outil de lecture web qui retranscrit le contenu : ce n'est pas un fichier brut téléchargé.
- **DOCUMENTÉ** = la source existe et sa documentation a été lue, mais la donnée n'a pas pu être lue.
- **NON VÉRIFIÉ** = adresse repérée, contenu non lu.
- **ÉCARTÉ** = conditions d'utilisation incompatibles avec une page publique, ou source arrêtée.

Trois limites de l'environnement de test, à garder en tête :
1. Le téléchargement direct (curl) est bloqué pour tous les sites de données : l'environnement n'autorise que les dépôts de code. **Aucun fichier brut n'a donc été téléchargé et aucun en-tête CORS n'a pu être lu.** Le « test réel » de chaque source est une lecture, pas un téléchargement.
2. L'outil de lecture web refuse certains sites (règle robots.txt) : c'est le cas de l'API de données de la BCE.
3. L'outil a un quota horaire, atteint deux fois. Une partie des sources n'a pas pu être lue.

Conséquence : le premier lancement du script quotidien (sur GitHub Actions, voir le plan) sera le vrai test de téléchargement.

## 2. Résultat en une page

| Besoin | Résultat | Source retenue | Limite |
|---|---|---|---|
| Courbe Allemagne, quotidien | **VÉRIFIÉ** | Bundesbank, API `BBSIS` | Courbe estimée (Svensson), 2 décimales |
| Courbe France, quotidien | **VÉRIFIÉ, mais non republiable** | Banque de France, indices TEC (Euronext) | Rediffusion interdite sans accord écrit d'Euronext ; quelques jours atypiques dans la publication |
| Courbe Espagne, quotidien | **VÉRIFIÉ** | Banco de España, table 1.3 | 3, 5, 10, 15 ans ; série bruitée ; J+2 |
| Courbe Italie, quotidien | **NON VÉRIFIÉ** | Banca d'Italia, table BMK0200 (documentée) | Non téléchargée ; reproduction restreinte |
| 10 ans par pays, mensuel | **VÉRIFIÉ** | Eurostat `irt_lt_mcby_m` | Mensuel seulement |
| Prix par ISIN, Allemagne | **VÉRIFIÉ** | Bundesbank, API `BBSSY` | Prix de midi, pas une clôture |
| Prix par ISIN, France, Italie, Espagne | **Rien d'utilisable** | — | Borsa Italiana et BME interdisent la reprise ; rien trouvé pour la France |
| €STR | **VÉRIFIÉ** | BCE, republié par la Bundesbank (`BBMMB`) | — |
| Euribor | **VÉRIFIÉ**, non affiché | Bundesbank `BBIG1`, Suomen Pankki | Licence EMMI à confirmer |
| Taux directeurs BCE | **VÉRIFIÉ** | Page BCE | — |
| Swaps, asset swaps | **N'existe pas gratuitement** | — | ASW seulement approximatif, plus tard |
| Futures Eurex : cours de compensation | **VÉRIFIÉ** | API du site Eurex | 36 jours d'historique ; **publication interdite sans accord écrit** |
| Paniers livrables, facteurs de conversion | **VÉRIFIÉ** | CSV Eurex | Même réserve de publication |
| Adjudications DE, FR, IT, ES | **VÉRIFIÉ** | Finanzagentur, AFT, Banca d'Italia, Tesoro | AFT instable, MEF inaccessible |
| Actualités | **VÉRIFIÉ** | Flux BCE, Bundesbank, Banco de España | Presse : aucune CGU lue, rien retenu |
| Calendrier | **VÉRIFIÉ** | BCE (réunions), Eurostat (publications) | Notations et calendriers nationaux non lus |

## 3. Détail par thème

### 3.1 Courbes et rendements quotidiens par pays

**Allemagne — Bundesbank, VÉRIFIÉ.**
- Taux au pair : `https://api.statistiken.bundesbank.de/rest/data/BBSIS/D.I.ZAR.ZI.EUR.S1311.B.A604.R10XX.R.A.A._Z._Z.A?format=sdmx&lang=en&lastNObservations=10` (remplacer `R10XX` par `R01XX` à `R30XX` ; plusieurs maturités avec `+`).
- Zéro-coupon : même clé avec `ZST` à la place de `ZAR`.
- Paramètres : `startPeriod`, `endPeriod`, `lastNObservations`. Les week-ends reviennent vides : à filtrer.
- Historique depuis 1997 (30 ans depuis 2000). Quotidien, disponible le lendemain matin. Sans clé.
- Format lu : `format=sdmx`. Le format CSV existe mais l'outil de lecture ne le lit pas.
- Conditions : reproduction libre avec la mention « Source : Deutsche Bundesbank ».
- Lu le 18/11/2026 : 2 ans 3,12 ; 5 ans 3,17 ; 10 ans 3,41 ; 30 ans 3,73 (taux au pair). Concorde avec le PDF du jour de la Bundesbank.
- Chargé dans le dashboard : 9 maturités, 331 jours (01/08/2025 au 18/11/2026), 2 979 valeurs lues deux fois par deux agents avec un découpage différent, **100 % identiques**.

**France — Banque de France, indices TEC : VÉRIFIÉ, usage privé seulement.**
- Page quotidienne : `https://www.banque-france.fr/fr/statistiques/taux-et-cours/indices-obligataires-2026-11-17` (une page par jour).
- Historique complet : `https://webstat.banque-france.fr/export/csv-columns/fr/selection/5385693`. CSV, séparateur « ; », virgule décimale, plus récent en premier, depuis le 03/11/2004. Colonnes dans l'ordre 1, 10, 15, 2, 20, 25, 3, 30, 5, 7 ans (séries `FM.D.FR.EUR.FR2.BB.FRMOYTECn.HSTA`).
- Contenu : TEC 1, 2, 3, 5, 7, 10, 15, 20, 25, 30 ans. Rendement d'un titre d'État fictif de maturité constante, par interpolation linéaire entre obligations de référence.
- Lu le 17/11/2026 : TEC 2 à 3,657 ; TEC 5 à 4,281 ; TEC 10 à 4,913 ; TEC 30 à 5,456. Page et export concordent sur 50 valeurs.
- Lu le 18/11/2026 sur la page du jour, deux lectures identiques : TEC 2 à 3,636 ; TEC 5 à 4,214 ; TEC 10 à 4,836 ; TEC 30 à 5,382.
- L'export a un jour de retard sur la page du jour : lu le 19/11, il s'arrêtait au 17/11 alors que la page du 18/11 donnait déjà le 18/11. Les jours sans valeur y sont notés « - ».
- Chargé dans le dashboard : 9 maturités affichées (10 lues), 332 jours du 01/08/2025 au 18/11/2026. Les 3 310 valeurs de l'export ont été lues deux fois par deux agents avec un découpage différent : **100 % identiques**. Les 10 valeurs du 18/11 viennent de la page du jour, lue deux fois.
- **Troisième contrôle, sur une publication distincte de l'export** : 296 valeurs sur 33 jours comparées aux pages quotidiennes de la Banque de France (pages du 02/01, 02/02, 11/03, 13/03, 15/09, 06/10, 08/10 et 17/11/2026) : **0 écart**. Lectures conservées dans `staging/ext/fr_bdf_daily_pages_check.txt`.
- Jours atypiques, signalés par les deux agents de lecture. **VÉRIFIÉ : ils figurent à l'identique sur les pages quotidiennes, donc dans la publication elle-même.** Aucune valeur n'a été corrigée.
  - 01, 02 et 05/10/2026 : TEC 2 inchangé à 3,688 trois jours de suite, TEC 1 à 3,366 les 02 et 05/10, TEC 3 à 3,762 les 30/09 et 01/10, alors que les maturités voisines bougent de 8 à 15 pb.
  - 09/03/2026 : TEC 1 (2,41) au-dessus de TEC 2 (2,36). Le même jour, le 2 ans allemand monte de 10 pb puis revient le lendemain. Le spread France–Allemagne 2 ans passe de 19 à 2 pb, puis revient à 18 pb.
  - 29/12/2025 : TEC 15 à 3,85, contre 3,96 le lendemain.
  - 31/12/2025 : mêmes valeurs que le 30/12 sur les dix maturités.
  - Effet mesuré : sans ces six jours, aucun z-score français ne bouge de plus de 0,13. Sur la fenêtre 1 an, les plus bas des spreads 2, 3, 5 et 7 ans contre l'Allemagne tombent le 09/03/2026.
- NON VÉRIFIÉ : la cause de ces valeurs ; l'heure de calcul de l'indice (la page ne la donne pas) ; le 24/12/2025, absent de l'export (page de ce jour non lue).
- **Conditions, lues sur la page du 18/11/2026** : valeurs données pour information seulement ; redistribution, sous-licence et usage commercial interdits sans autorisation écrite préalable d'Euronext Paris ; indices calculés et administrés par Euronext Paris, à partir de données MTS France. Seule adresse de contact sur la page : `indexEOD@euronext.com`. Chargé dans la version privée du dashboard uniquement.
- Les pages de février et mars 2026 portaient une notice différente : pas de données dérivées des indices sans autorisation écrite de la Banque de France, contact `1482-TEC-UT@banque-france.fr`. Cette clause n'apparaît plus sur la page du 18/11/2026. La demande d'autorisation doit donc citer aussi les données dérivées (spreads, z-scores).
- Arrêté : les « taux indicatifs des bons du Trésor et OAT » de la Banque de France (10 juillet 2024). Écartée : sa courbe zéro-coupon (redistribution interdite).

**Espagne — Banco de España, VÉRIFIÉ.**
- Table 1.3 : `https://www.bde.es/webbe/en/estadisticas/compartido/datos/pdf/ti_1_3e.pdf`. Obligations à 3, 5, 10 et 15 ans, plus des tranches (1-2 ans, plus de 2 ans, plus de 4 ans). Pas de 2 ans exact, pas de 30 ans. Le PDF donne 7 semaines de quotidien et 12 fins de mois.
- Historique complet : `https://www.bde.es/webbe/es/estadisticas/compartido/datos/csv/ead002.csv` (49 séries, depuis 1979). Codes : `D_G0B1F0ZN` (3 ans), `D_G0B1F0ZO` (5 ans), `D_G0B1F0ZP` (10 ans), `D_G0B1F0ZQ` (15 ans). L'outil de lecture n'a reçu le fichier que jusqu'en 2016 : fin du fichier NON VÉRIFIÉE, à télécharger par le script.
- API `https://app.bde.es/bierest/resources/srdatosapp/listaSeries?...` : documentée, refusée à l'outil de lecture.
- Nature : taux établis par le Banco de España à partir des opérations de marché, pas des cotations de benchmark. Définition exacte non vérifiée. Les variations quotidiennes sont bruitées (corrélation de 0,3 avec le Bund sur 33 jours).
- Publication deux jours ouvrés après la date de référence (annonce du 03/07/2026).
- Conditions : réutilisation gratuite avec la mention imposée « Fuente: Elaboración propia con datos extraídos del sitio web del Banco de España (www.bde.es) », la date de mise à jour, sans altération.
- Lu le 17/11/2026 : 3 ans 3,36 ; 5 ans 3,47 ; 10 ans 3,95 ; 15 ans 4,20. Deux lectures identiques (136 valeurs).

**Italie — NON VÉRIFIÉ.**
- Rendistato (`https://www.bancaditalia.it/compiti/operazioni-mef/rendistato-rendiob/index.html`) : lu, mais mensuel et par tranche de durée résiduelle.
- Rendements benchmark quotidiens : table `BMK0200` de la base statistique de la Banca d'Italia, documentée comme quotidienne (BTP 3, 10, 30 ans vus dans `BMK0100`). Non téléchargée : le site statistique demande un navigateur.
- Conditions du site Banca d'Italia : usage personnel ; pas de reproduction sur un site tiers sans autorisation écrite, sauf jeux « open data » sous CC BY 4.0.

**Multi-pays.**
- Eurostat, 10 ans quotidien par pays (`irt_lt_mcby_d`) : ne répond plus. Les miroirs s'arrêtent en juin 2025. Considéré comme arrêté.
- Eurostat, 10 ans **mensuel** par pays (`irt_lt_mcby_m`) : VÉRIFIÉ. `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/irt_lt_mcby_m?format=JSON&geo=DE&lastTimePeriod=36`. Depuis 1980, publié environ 10 jours après la fin du mois. Licence CC BY 4.0.
- Eurostat, courbes zone euro quotidiennes (`irt_euryld_d`) : VÉRIFIÉ, mais agrégat zone euro seulement, avec 2 jours de retard.
- BCE, jeu YC : zone euro seulement. BCE, jeux FM et IRS : pas de rendement quotidien par pays.
- FRED : mensuel au mieux.

### 3.2 Prix par obligation (ISIN)

**Allemagne — Bundesbank, VÉRIFIÉ.**
- `https://api.statistiken.bundesbank.de/rest/data/BBSSY/D.KCP+KDP+REN.EUR..DE000BU2Z056.?format=sdmx_json&lastNObservations=3`
- `KCP` prix pied de coupon, `KDP` prix coupon couru inclus, `REN` rendement. Environ 123 titres, historique depuis l'émission.
- C'est un prix de référence fixé vers midi à Francfort, pas un cours de clôture.
- Contrôle fait : pour 12 titres sur 16, le coupon couru et le rendement recalculés à partir du prix retombent sur les valeurs publiées à 4 décimales. Les 4 autres sont des souches émises en 2026 avec un premier coupon long.
- Fichier mensuel PDF et XLSX : `https://www.bundesbank.de/de/service/bundeswertpapiere/kurse-und-renditen` (sert aussi de référentiel : ISIN, coupon, échéance, volume).

**France, Italie, Espagne — rien d'utilisable.** Borsa Italiana : usage personnel, copie et téléchargement automatique interdits. BME : toute reproduction exige un accord écrit ; les pages de cotations se chargent en JavaScript. France : aucun prix par ligne trouvé. Pistes restantes, non lues : encours AFT, CSV du MEF, liste des actifs éligibles de la BCE (référentiels, pas des prix).

### 3.3 Taux courts, swaps

- **€STR** : page BCE (dernier jour) et API Bundesbank `https://api.statistiken.bundesbank.de/rest/data/BBMMB/D.EU000A2X2A25.WT?format=sdmx&lang=en&lastNObservations=5`. Lu : 2,441 % le 17/11/2026. La BCE ne facture pas l'€STR et n'impose pas de licence. Chargé : 332 jours, deux lectures identiques.
- **API de la BCE** (`data-api.ecb.europa.eu`, jeux EST, FM, YC) : identifiants vérifiés sur le portail, **téléchargement non testable ici**. Exemple à tester par le script : `https://data-api.ecb.europa.eu/service/data/EST/B.EU000A2X2A25.WT?lastNObservations=5&format=csvdata`.
- **Euribor** 1 semaine à 12 mois : VÉRIFIÉ sur trois republications qui concordent (Bundesbank `BBIG1`, Suomen Pankki, Banco de España), avec un jour de retard. Lu le 17/11/2026 : 3 mois 2,784 ; 6 mois 3,007 ; 12 mois 3,361. **Non affiché** : l'EMMI réserve l'usage aux fins non commerciales et encadre la redistribution. À confirmer auprès de l'EMMI.
- **Taux directeurs** : page BCE. Depuis le 16/09/2026 : dépôt 2,50 ; refinancement 2,65 ; prêt marginal 2,90.
- **Swaps euro, asset swaps, courbe €STR à terme** : aucune source gratuite et réutilisable trouvée.

### 3.4 Eurex

- **Cours de compensation, volumes, positions ouvertes** : `https://www.eurex.com/api/v1/overallstatistics/34656?busdate=20261118`. Identifiants : FGBS 34678, FGBM 34670, FGBL 34656, FGBX 42066, FOAT 34684, FBTP 34680. Endpoint non documenté, celui qui alimente les pages du site. JSON, sans clé.
- **Historique : 36 jours de bourse glissants seulement.** Il faut archiver chaque jour.
- **Paniers livrables et facteurs de conversion** : `https://www.eurex.com/resource/blob/2845860/81b162533ca60711fb05dc13ac5a60c0/data/deliverable-bonds-and-conversion-factors.csv` (passer par la page de liste, l'adresse peut changer).
- Lu, séance du 18/11/2026 (échéance décembre) : Schatz 104,92 ; Bobl 113,01 ; Bund 121,98 ; Buxl 104,70 ; OAT 109,21 ; BTP 112,42. Deux lectures identiques.
- Contrôles : positions ouvertes égales entre l'API et le rapport quotidien ; 38 facteurs de conversion sur 48 recalculés à 6 décimales.
- **Conditions d'utilisation : point bloquant.** Le site interdit de copier ou publier son contenu sans accord écrit ; seule une copie pour usage personnel non commercial est permise. Le téléchargement quotidien par script est prévu par Eurex, la republication ne l'est pas. Contact : data.services@deutsche-boerse.com.
- Options : emplacement des cours de compensation non vérifié.

### 3.5 Adjudications

| Pays | Source | Champs | Statut |
|---|---|---|---|
| DE | Finanzagentur, `https://www.deutsche-finanzagentur.de/en/federal-securities/issuances/issuance-results` (page, PDF, XLSX annuel et historique depuis 1999) ; calendrier `.../issuance-calendar` | Offres, alloué, rétention, prix moyen, rendement moyen, couverture | VÉRIFIÉ, recoupé avec la Bundesbank |
| FR | AFT, `https://www.aft.gouv.fr/en/dernieres-adjudications` et fiches par titre | Demandé, servi, prix limite, taux moyen, couverture | VÉRIFIÉ en partie : 6 adresses sur 16 refusées |
| IT | Banca d'Italia, communiqués PDF sous `https://www.bancaditalia.it/media/comunicati/` | Offert, demandé, attribué, prix, rendement, couverture | VÉRIFIÉ (une lecture). Site du MEF inaccessible |
| ES | Tesoro Público, `https://www.tesoro.es/deuda-publica/subastas/resultado-ultimas-subastas/obligaciones-del-estado` ; calendrier `.../subastas/calendario` | Demandé, adjugé, taux marginal, taux moyen, couverture | VÉRIFIÉ. Pas d'ISIN |

Le « taux limite » n'est publié que par l'Espagne. L'Italie adjuge à prix unique. Conditions : AFT, réutilisation permise si gratuite, non commerciale, sans altération, avec source et date ; Banca d'Italia, pas de reproduction sur un site tiers sans autorisation écrite (pour une page publique, passer par le site du MEF) ; Finanzagentur, aucune condition de réutilisation trouvée sur les pages lues.

### 3.6 Actualités et calendrier

- Flux retenus : BCE `https://www.ecb.europa.eu/rss/press.html`, Bundesbank `https://www.bundesbank.de/service/rss/en/633306/feed.rss`, Banco de España `https://www.bde.es/wbe/en/inicio/rss/rss-noticias/`.
- Les flux sont courts (10 à 20 éléments) : il faut les archiver à chaque passage. La copie du flux BCE lue avait 3 jours.
- Pas de flux trouvé pour l'AFT, la Finanzagentur, le Tesoro et le MEF.
- **Presse : rien retenu**, aucune CGU n'a pu être lue.
- Réunions BCE : `https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html`. Prochaine décision : 17 décembre 2026.
- Publications Eurostat : JSON `https://ec.europa.eu/eurostat/o/calendars/eventsJson?...` (lu jusqu'à début mars 2027).
- Calendriers des agences de notation et calendriers statistiques nationaux : NON VÉRIFIÉ.

## 4. Conditions d'utilisation : ce qui bloque ou reste à confirmer

| Source | Ce que disent les conditions | Conséquence |
|---|---|---|
| Eurex | Pas de copie ni de publication sans accord écrit ; une copie pour usage personnel non commercial | Onglet Futures privé |
| Euronext (TEC France) | Information seulement ; redistribution, sous-licence et usage commercial interdits sans autorisation écrite préalable d'Euronext Paris. Contact sur la page : `indexEOD@euronext.com` | Courbe française en version privée seulement ; demande d'autorisation à envoyer |
| EMMI (Euribor) | Usage non commercial, redistribution encadrée | Non affiché, à confirmer |
| Banca d'Italia | Pas de reproduction sur un site tiers sans autorisation écrite | Adjudications italiennes : passer par le MEF avant publication |
| Borsa Italiana, BME | Reprise des prix interdite | Écartées |
| Banque de France, courbe zéro-coupon | Redistribution interdite | Écartée |
| Banco de España | Réutilisation gratuite avec mention imposée et date | Utilisable |
| AFT | Réutilisation gratuite, non commerciale, sans altération, avec source et date | Utilisable |
| Tesoro Público | Reproduction fidèle avec citation ; pas de licence ouverte explicite | Utilisable, à confirmer |
| BCE | Réutilisation libre avec citation | Utilisable |
| Bundesbank | Réutilisation gratuite des statistiques, source citée, sans modification | Utilisable |
| Eurostat | CC BY 4.0 | Utilisable |
| Finanzagentur | Aucune condition trouvée sur les pages lues | À confirmer |
| Presse, agences de notation | Non lues | Rien retenu |

## 5. Points non vérifiés

- Tout téléchargement réel par script, et les en-têtes CORS de toutes les sources.
- L'API de données de la BCE.
- Italie : la table quotidienne BMK0200 de la Banca d'Italia.
- France : la cause des jours atypiques des indices TEC, l'heure de calcul de l'indice, et le 24/12/2025.
- Espagne : la fin du fichier CSV complet (2017 à 2026) et la définition exacte des taux.
- Les prix par ISIN hors Allemagne.
- Le résultat de l'adjudication française du 19/11/2026 ; le taux de couverture AFT du 05/11/2026 ; le calendrier italien.
- L'heure de publication de chaque source.
- Les cours de compensation des options Eurex.
