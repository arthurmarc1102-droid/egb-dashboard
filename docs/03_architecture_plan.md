# EGB Dashboard — Architecture, plan et journal

Mis à jour le 25 novembre 2026.

## 1. Ce qui existe aujourd'hui

Un site public, hébergé gratuitement sur GitHub Pages : https://arthurmarc1102-droid.github.io/egb-dashboard/ . Les données sont mises à jour chaque jour ouvré par GitHub Actions, avec un historique depuis janvier 2015. L'ancien artefact Claude (instantané du 20/11/2026) n'est plus mis à jour.

**Autorisations.** Arthur indique avoir obtenu les autorisations écrites d'Euronext Paris (indices TEC) et de Deutsche Börse (Eurex). Ces accords n'ont pas été vus par Claude : leurs conditions exactes (mention à afficher, délai, périmètre) restent à reporter sur la page.

Depuis la refonte du 25/11/2026, la page s'ouvre sur le **Brief** et range 13 écrans dans 5 espaces, en anglais :

| Espace | Écrans | Contenu |
|---|---|---|
| Brief | Brief | Note de clôture écrite par la page à partir des données, courbes à la clôture avec leur tableau, plus forts mouvements, z-scores extrêmes, prochains événements, futures, dernières adjudications, titres |
| Markets | Monitor, Curves, Rates | Taux et variations par pays, spreads, pentes, historiques par maturité, €STR et taux directeurs BCE |
| Relative value | RV screen, Builder, Analysis, PCA & carry, Backtest | Structures triables avec z-score et percentile, structures sur mesure, régressions, bêtas, corrélations, ACP, carry et roll-down, rich/cheap, backtests de z-score |
| Futures & supply | Futures, Auctions | Cours de compensation Eurex, paniers livrables, base, repo implicite, CTD ; calendrier et résultats des adjudications |
| News & sources | News & calendar, Sources & methods | Titres officiels, calendrier, taux BCE ; statut de chaque source, méthodes, limites connues |

Filtres communs : pays, fenêtre de z-score (1, 3, 6, 12, 24 mois), période des graphiques (avec plage libre). Sur téléphone, les cinq espaces sont dans une barre fixe en bas de l'écran et les filtres se replient dans un bouton.

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

Sources de la page dans `src/` : `index.html` (gabarit), `style.css`, `app.js` (moteur et écrans), `home.js` (Brief), `lab.js` (builder, ACP, carry, backtests). `python3 build.py` les assemble en un seul `index.html`. `preview.png` est l'image affichée quand le lien est partagé ; le pipeline la redessine à chaque nouvelle clôture.

Trois choix à retenir :

1. **Tout est calculé dans le navigateur** à partir des fichiers JSON : spreads, pentes, butterflies, boxes, z-scores, percentiles, régressions, corrélations. Les fichiers ne contiennent que des données publiées.
2. **Aucun appel de données à un site externe depuis la page** (elle ne charge ailleurs que la bibliothèque D3, sur cdnjs, et les polices, sur Google Fonts). Les en-têtes CORS n'ont pas pu être testés, et un artefact Claude ne peut pas appeler de site externe. Le script quotidien télécharge, la page lit des fichiers statiques.
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

1. **Nom affiché** : depuis le 25/11, le pied de page indique « Built by Arthur Marc » avec un lien vers le dépôt GitHub. À confirmer par Arthur (ajouter LinkedIn, ou retirer).
2. **Mentions Euronext et Eurex** : reporter sur la page les conditions exactes des autorisations (non vues par Claude).
3. **Euribor** : demander confirmation à l'EMMI pour un affichage non commercial avec un jour de retard. Non chargé en attendant.
4. **AFT** : le site refuse les scripts. Demander à l'AFT un accès ou un fichier ; sinon les résultats français restent ceux lus le 19/11.

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

**21/11/2026**
- Plus de maturités : Allemagne 1 à 10 ans chaque année, puis 12, 15, 20, 25 et 30 ans (15 maturités) ; France TEC 25 ans ajouté (10 maturités).
- Nouveaux onglets : Builder (structure pondérée quelconque, jusqu'à 8 jambes, poids bêta, sauvegarde dans le navigateur, lien de partage ; tableau de bord des structures ; workbench jusqu'à 8 séries en niveau, variation ou z-score), PCA & carry (ACP sur fenêtre au choix, trajectoires des facteurs, rich/cheap à 3 facteurs, fly neutre aux 2 premiers facteurs, carry et roll-down 1M à 1Y, trades de courbe et de spread, courbe Nelson-Siegel ajustée et résidus), Backtest (z-score, retour à la moyenne ou tendance, achat/vente, seuils, stop, durée max, coûts, exécution à la clôture suivante, dates ; P&L, trades, grille de sensibilité, scan de toutes les structures).
- Plage de dates libre (Custom), fenêtre z 2 ans, export CSV sur tous les graphiques et tableaux.
- Vérifications : 204 chiffres de la page (4 backtests dont une structure perso, ACP DE 1 an et FR 2 ans, Nelson-Siegel, carry et roll-down) recalculés par une implémentation Python indépendante (numpy) : 0 écart. Contrôle navigateur étendu aux interactions (construire, sauvegarder, retrouver dans l'écran RV, backtester, scanner, télécharger un CSV, plage 2022, workbench). Les deux tournent à chaque mise à jour.

**25/11/2026 — refonte de l'interface (brief 04)**
- Navigation : 13 écrans rangés dans 5 espaces (Brief, Markets, Relative value, Futures & supply, News & sources). Les anciennes adresses (`#rv`, `#builder/s=…`) marchent toujours ; une adresse sans écran ouvre le Brief. Renommés : Blotter → News & calendar, Sources → Sources & methods.
- Brief : note de clôture écrite par la page à chaque chargement, avec des règles fixes listées dans Sources & methods : mouvement du jour (bull ou bear, steepening ou flattening, twist, parallèle), spreads à l'Allemagne avec z-score, 5s30s et fly, niveau le plus tendu, future Bund et CTD, prochain événement. Chaque mot dépend d'un chiffre chargé. Si la courbe d'un pays est en retard sur la clôture, la phrase le dit (« Data to 20 Nov »). Quand le 2 ans et le 10 ans n'ont pas bougé, la phrase donne les faits sans qualifier toute la courbe.
- Courbes à la clôture : chaque point du graphique est à la verticale de sa colonne dans le tableau (niveaux et variations sur 1 jour, 1 semaine, 1 mois, depuis le début de l'année).
- Plus forts mouvements : variation du jour divisée par l'écart-type des variations quotidiennes sur la fenêtre ; une ligne par famille (pays et type de structure).
- Identité : fond sombre unique, interface en encre neutre, couleur réservée aux données (rouge = taux plus haut, spread plus large, niveau moins cher ; bleu = l'inverse ; une couleur par pays). Deux voix : Newsreader (serif) pour le seul titre de la note, IBM Plex Sans Condensed pour les données.
- Téléphone : espaces dans une barre fixe en bas, filtres repliés dans un bouton (avec la légende des couleurs), panneaux bord à bord, tableau des sources en fiches, étiquettes de maturité allégées sur les graphiques étroits.
- États : écran d'erreur avec remise à zéro des réglages, message si les données ne se chargent pas, états vides explicites, focus clavier visible, lien d'évitement, animations coupées si le système le demande.
- Partage : balises Open Graph, icône, image `preview.png` (le Brief en 1200 × 630).
- Vérifications avant l'envoi : `pipeline/check_home.py` réécrit le Brief en Python, sans reprendre le code de la page ; comparaison mot pour mot (351 éléments avec le réglage par défaut, 0 écart ; 4 autres réglages de pays et de fenêtre, 0 écart). Contrôle navigateur réécrit pour la nouvelle navigation : 13 écrans à 1440 px et 390 px, aucun débordement horizontal, alignement graphique / tableau, builder, backtest, CSV, plage libre, bouton retour. Largeurs de 360 à 1200 px testées en local avec les vraies polices : aucun débordement. États testés : un seul pays, pays sans données quotidiennes, anciens réglages enregistrés, réglages cassés, fichier de données absent, navigation au clavier.

