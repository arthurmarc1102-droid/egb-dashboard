# EGB Dashboard — Architecture, plan et journal

Mis à jour le 19 novembre 2026.

## 1. Ce qui existe aujourd'hui

Un artefact Claude nommé **EGB Dashboard**. C'est un instantané daté du 19/11/2026 : il n'est pas encore mis à jour automatiquement.

**Version publique depuis le 20/11/2026.** Arthur indique avoir obtenu les autorisations écrites d'Euronext Paris (indices TEC) et de Deutsche Börse (Eurex). Ces accords n'ont pas été vus par Claude : leurs conditions exactes (mention à afficher, délai, périmètre) restent à reporter sur la page. Construction : `build_market.py --spain --france --authorised`, `build_futures.py --authorised`, `build_sources.py --france --authorised`.

Neuf onglets, en anglais :

| Onglet | Contenu | Données réelles chargées |
|---|---|---|
| Monitor | Vue du matin : taux, variations, spreads, forme de courbe, z-scores extrêmes, adjudications, blotter | Oui |
| Curves | Courbe du jour (comparaison 1 semaine, 1 mois, 3 mois), historiques par maturité, pentes, spreads | Oui |
| RV screen | Toutes les structures triables, détail avec moyenne glissante et bandes, spread libre entre deux séries | Oui (Allemagne, France, Espagne partielle) |
| Analysis | Régression entre deux séries, bêta glissant, matrice de corrélations | Oui |
| Rates | €STR, taux directeurs BCE | Oui |
| Futures (private) | Cours de compensation Eurex, paniers livrables, base, repo implicite, CTD pour les contrats allemands | Oui, aperçu privé |
| Auctions | Calendrier et derniers résultats DE, FR, IT, ES | Oui |
| Blotter | Titres officiels, calendrier des catalyseurs, taux directeurs | Oui |
| Sources | Statut de chaque source, méthodes, limites connues | Oui |

Filtres communs en haut de page : pays, fenêtre de z-score (1, 3, 6, 12 mois), période des graphiques.

## 2. Architecture

```
index.html          interface + moteur de calcul (HTML, CSS, JavaScript, graphiques D3)
data/market.json    séries : taux quotidiens, taux mensuels par pays, €STR
data/auctions.json  résultats et calendrier des adjudications
data/news.json      titres et liens
data/events.json    calendrier, taux directeurs BCE
data/futures.json   Eurex : cours, paniers, base, CTD (aperçu privé)
data/sources.json   statut de chaque source, limites
```

Trois choix à retenir :

1. **Tout est calculé dans le navigateur** à partir des fichiers JSON : spreads, pentes, butterflies, boxes, z-scores, percentiles, régressions, corrélations. Les fichiers ne contiennent que des données publiées.
2. **Aucun appel à un site externe depuis la page.** Les en-têtes CORS n'ont pas pu être testés, et un artefact Claude ne peut pas appeler de site externe. Le script quotidien télécharge, la page lit des fichiers statiques.
3. **La page et les données sont séparées.** Mettre à jour le dashboard, c'est remplacer les fichiers `data/`. Supprimer `data/futures.json` fait disparaître l'onglet Futures. Les séries non republiables portent `"restricted": true` dans `market.json` : la version publique se construit sans elles (`build_market.py` sans l'option `--france`).

Format d'une série dans `market.json` :
```json
{"id": "DE_10Y", "group": "yield", "country": "DE", "tenor": 10, "unit": "pct",
 "decimals": 2, "source": "bbk_curve", "dates": ["2025-08-01", "..."], "values": [2.72, "..."]}
```
Groupes : `yield` (quotidien, par pays et maturité), `yield_m` (10 ans mensuel par pays), `mm` (taux courts). La page construit seule toutes les structures que les séries chargées permettent : ajouter un pays ou une maturité ne demande aucun changement de code.

## 3. Formules

| Mesure | Définition |
|---|---|
| Spread | taux du pays moins taux allemand à la même maturité, en pb |
| Pente | taux long moins taux court, en pb |
| Butterfly | 2 × corps moins les deux ailes, en pb |
| Box | pente du pays moins pente allemande, en pb |
| Z-score | (dernier niveau − moyenne) / écart-type d'échantillon, sur la fenêtre choisie, dernier jour inclus ; exige 90 % de la fenêtre |
| Percentile | part de la fenêtre sous le dernier niveau |
| Régression | moindres carrés sur les variations quotidiennes en pb, sur les jours communs |
| Rendement approché | −duration modifiée × variation de taux + portage du taux ; duration d'une obligation au pair à coupon annuel ; ni roll-down ni convexité |
| Base brute | prix pied de coupon − facteur de conversion × cours du future |
| Repo implicite | ((future × facteur + coupon couru à la livraison) / (prix + coupon couru au règlement) − 1) × 360 / jours |
| Base nette | base brute − portage, avec un financement à l'€STR (pas un taux de repo) |
| CTD | obligation au repo implicite le plus élevé |

Couleurs : rouge = taux plus haut, spread plus large, niveau bon marché (cheap) ; bleu = l'inverse (rich). Une couleur fixe par pays.

Contrôle fait le 19/11 : niveaux, variations, z-scores, percentiles, bêta et R² recalculés en Python indépendamment de la page, résultats identiques. Coupon couru et rendement des obligations allemandes recalculés à partir du prix : identiques à la source pour 12 titres sur 16 (les 4 autres ont un premier coupon long).

## 4. Comment les données de l'instantané ont été chargées

L'environnement de travail ne peut pas télécharger de fichiers sur les sites de données. Chaque série a donc été lue par un outil de lecture web, **deux fois, par deux agents indépendants avec un découpage différent**, puis comparée valeur par valeur. Seules les valeurs identiques dans les deux lectures sont gardées.

| Donnée | Valeurs | Écarts entre les deux lectures |
|---|---|---|
| Courbe allemande, 9 maturités, 331 jours | 2 979 | 0 |
| €STR, 332 jours | 332 | 0 |
| Courbe française TEC, export, 10 maturités, 331 jours | 3 310 | 0 |
| Courbe française TEC, page du 18/11/2026, deux derniers jours | 20 | 0 |
| Taux espagnols 3, 5, 10, 15 ans, 34 jours | 136 | 0 |
| 10 ans mensuel, 8 pays, 36 mois | 288 | 0 sur les 84 points relus |
| Cours de compensation Eurex, 6 contrats | 18 | 0 |

Contrôle supplémentaire pour la France : 296 valeurs sur 33 jours comparées aux pages quotidiennes de la Banque de France, une publication distincte de l'export. Aucun écart. Les jours qui paraissaient anormaux (début octobre 2026, 9 mars 2026, fin décembre 2025) y figurent à l'identique : ils viennent de la publication, pas de la lecture. Ils sont gardés tels quels et décrits dans l'onglet Sources.

Les scripts de construction sont dans l'espace de travail de la session : `real/build_market.py`, `real/build_futures.py`, `real/build_static.py`, `real/build_sources.py`, et les sources de la page dans `src/`.

## 5. Architecture cible, gratuite

```
Dépôt GitHub public "egb-dashboard"
├── index.html, data/            ← servis par GitHub Pages (lien public)
├── pipeline/fetch_*.py          ← un module par source
├── pipeline/build.py            ← contrôles, calculs de base/CTD, écriture des JSON
└── .github/workflows/daily.yml  ← GitHub Actions, chaque jour ouvré vers 7 h (Paris)
```

- GitHub Actions télécharge les fichiers bruts (aucune restriction réseau), les valide, écrit `data/*.json` et les enregistre dans le dépôt. GitHub Pages sert la page. Coût : zéro.
- Le dépôt sert aussi d'archive. C'est nécessaire : Eurex ne garde que 36 jours, les flux d'actualités 10 à 20 éléments, les paniers livrables ne sont pas historisés.
- La page actuelle se copie telle quelle dans le dépôt.
- **Ce qu'il faut de toi : un compte GitHub**, connecté à Claude ou un dépôt vide créé à la main.

Alternative sans GitHub, une tâche planifiée Claude qui relit les sources chaque matin : possible mais fragile (quota de lecture, sites refusés, retranscription au lieu de fichiers bruts). Non recommandée.

## 6. Plan en 3 versions, révisé après l'audit

### v1 — courbes, spreads, z-scores, adjudications
- Fait : interface complète ; Allemagne (9 maturités, 15 mois) ; France (9 maturités, 15 mois, version privée) ; Espagne (4 maturités, 7 semaines) ; 10 ans mensuel pour 8 pays ; adjudications des 4 pays ; blotter ; €STR et taux BCE.
- **Ce qui manque pour une version publique complète :**
  1. France : autorisation écrite d'Euronext Paris pour republier les indices TEC. Sans elle, la France reste en mensuel dans la version publique.
  2. Italie : aucune courbe quotidienne vérifiée. Pistes : table BMK0200 de la Banca d'Italia (à tester par script, conditions restrictives), ou taux implicite du future BTP (accord Deutsche Börse).
  3. Espagne : passer du PDF (7 semaines) au fichier CSV complet du Banco de España ; la série reste bruitée et sans 2 ans ni 30 ans.
- Reste à faire : pipeline quotidien sur GitHub ; adjudications automatisées et archivées (Italie par le MEF) ; suivi des taux avant et après chaque adjudication.

### v2 — futures
- Fait en aperçu privé : cours de compensation des 6 contrats, paniers, facteurs de conversion, base, repo implicite et CTD des 4 contrats allemands.
- Reste : archiver chaque jour (36 jours seulement chez Eurex) ; spreads entre futures (BTP contre Bund) en taux implicite ; prix par obligation pour les paniers OAT et BTP ; **accord écrit de Deutsche Börse avant toute publication** ; options ensuite.

### v3 — analyse avancée
- Carry et roll-down (courbe zéro-coupon Bundesbank, financement à l'€STR) ; ACP de la courbe ; backtests de signaux de z-score ; inflation ; Euribor et asset swaps approximatifs si les licences le permettent.

## 7. Décisions à prendre

1. **GitHub** : oui ou non pour l'hébergement et la mise à jour quotidienne.
2. **Eurex** : demander l'accord de Deutsche Börse (data.services@deutsche-boerse.com), ou garder l'onglet Futures privé.
3. **France** : envoyer à Euronext la demande d'autorisation de republier les indices TEC (brouillon de mail préparé le 19/11). Adresse donnée sur la page de la Banque de France : `indexEOD@euronext.com`.
4. **Euribor** : demander confirmation à l'EMMI pour un affichage non commercial avec un jour de retard.
5. **Nom affiché** sur la page (ton nom, ton LinkedIn) : pas encore tranché.

## 8. Journal

**19/11/2026**
- Cadrage : 45 questions, réponses orales, résumé validé. Cahier des charges enregistré dans le projet.
- Audit des sources par 6 agents en parallèle (voir « Audit des sources »).
- Constat : l'environnement Claude ne peut ni télécharger sur les sites de données, ni les appeler depuis un artefact. Décision : page statique + fichiers JSON, pipeline à faire tourner sur GitHub Actions.
- Page construite et testée (ordinateur et téléphone) d'abord avec des données de test, jamais publiées.
- Données réelles chargées par double lecture indépendante ; aucun écart.
- Constat de l'audit : Allemagne et Espagne ont une source quotidienne officielle republiable ; la France en a une (TEC) réservée à l'usage personnel ; rien de vérifié pour l'Italie ; Eurex réservé à l'usage personnel.
- Décision d'Arthur : charger la courbe française pour un usage personnel. L'artefact devient une version privée, marquée comme telle.
- Onglet Futures construit avec base, repo implicite et CTD pour les contrats allemands, marqué privé.
- Artefact publié en privé (11 h 20 UTC), puis mis à jour avec la France.
- Rapports des deux agents de lecture des indices TEC (vers 11 h 40 UTC) : fichiers identiques, mais plusieurs jours atypiques signalés. Contrôle sur les pages quotidiennes de la Banque de France : 296 valeurs, 0 écart ; les jours atypiques sont dans la publication. Effet mesuré sur les z-scores : 0,13 au plus.
- France portée au 18/11/2026 à partir de la page du jour (deux lectures), l'export s'arrêtant au 17/11. Allemagne et France sont maintenant à la même date. Spread 10 ans France–Allemagne au 18/11 : 142,6 pb.
- Conditions d'utilisation des indices TEC relues sur la page du 18/11/2026 ; adresse de contact Euronext trouvée. Notes ajoutées dans l'onglet Sources. Artefact republié (11 h 51 UTC).

**20/11/2026**
- Arthur : « j'ai toutes les autorisations ». Option `--authorised` ajoutée aux scripts ; mentions « version privée » retirées de la page, de l'onglet Futures et des sources ; mentions d'autorisation ajoutées. Artefact republié (16 h 43 UTC).
- GitHub toujours non connecté à Claude : pas encore de mise à jour quotidienne ni de dépôt.
- Dépôt GitHub public créé : `arthurmarc1102-droid/egb-dashboard`. Page, données, scripts et docs poussés ; GitHub Pages activé (branche `main`, racine). Lien public : https://arthurmarc1102-droid.github.io/egb-dashboard/ (page testée dans Chrome, données chargées).
- Reste : scripts de téléchargement quotidien (`pipeline/`) et GitHub Actions. Le dépôt ne contient pas les lectures brutes (`staging/`), seulement les fichiers JSON publiés.
- Pipeline quotidien en place (`pipeline/update.py`, GitHub Actions, en semaine vers 19 h 17 et 6 h 23 UTC). Premier vrai test de téléchargement : les 13 sources répondent (HTTP 200) depuis GitHub.
- Historique chargé depuis janvier 2015 : Allemagne 3 018 jours, France 3 042, Espagne environ 3 000 (15 ans : 2 449), €STR depuis octobre 2019, 10 ans mensuel 8 pays depuis 2015.
- Contrôle contre l'instantané lu deux fois du 19/11 : 6 723 valeurs communes, 0 écart. Cours Eurex du 18/11 archivés : 12 sur 12 identiques à la lecture du 19/11.
- Une valeur écartée comme erreur de publication : Espagne 5 ans le 08/07/2016 (1,75 % entre 0,23 et 0,24). Règle : saut isolé de 75 pb ou plus dans les deux sens. Chaque cas est listé dans `data/raw/update_log.txt`.
- Eurex : archive quotidienne dans `data/raw/eurex_settle.csv` (37 séances récupérées, du 30/09 au 19/11/2026) ; paniers et CTD recalculés chaque jour.
- Pas encore automatisés : adjudications, calendrier.
- Adjudications automatisées : Allemagne (classeurs Finanzagentur, 1 044 adjudications depuis 2015, calendrier), Espagne (pages du Tesoro, calendrier), Italie (60 PDF de résultats du MEF). France : le site de l'AFT bloque les scripts (protection anti-robots, HTTP 403), non contourné ; résultats du 19/11 gardés, dates par la règle AFT. Conditions de réutilisation du MEF non trouvées (page 404).
- Calendrier automatisé : réunions BCE (17 à venir), taux directeurs BCE (12 changements), publications Eurostat (indicateurs euro, 75 jours).
- Contrôles : 61 chiffres d'adjudication et les taux BCE comparés à la lecture du 19/11, 0 écart. Écran RV recalculé en Python sur les 4 fenêtres : 268 lignes, 0 écart. Futures : 47 obligations, facteurs de conversion, base brute et CTD, 0 écart.
- Chaque passage est vérifié avant publication (`pipeline/verify.py`, `pipeline/page_check.mjs` dans un navigateur sans écran, ordinateur et téléphone). Si un contrôle échoue, les données ne sont pas publiées, GitHub envoie un e-mail et les journaux sont dans `data/raw/`.
