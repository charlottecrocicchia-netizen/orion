# Conception — Parcours utilisateur & bibliothèque de visualisations

> **ÉTAT : PARTIELLEMENT LIVRÉ — document historique.** Les Angles
> (`555dbdc`), le dossier (`028f41b`), la timeline par rôle et la carte
> des collaborateurs (`fd6324e`) sont en production ; le reste du
> catalogue n'a pas été ouvert. Le statut « proposé » ci-dessous date du
> 2026-08-02. *(Bandeau posé le 2026-08-29, Hygiène G2.)*

**Statut : proposé** (itération avec la fondatrice avant toute implémentation).
Compagnon de [pieges-vega.md](pieges-vega.md). S'appuie sur la vision §9
(personas), l'étude d'orientation (R1-R7), la doctrine de design, et les
méthodes des skills dataviz / frontend-design / web-interface-guidelines.
Références marché déjà étudiées et réutilisées ici : KAILA, Spinbase,
Dimensions, Crunchbase, Dealroom, CB Insights, PitchBook, Bloomberg (étude
d'orientation) ; Apple, Stripe, Linear, OWID, Polaris (doctrine).

---

## 1. Les parcours réels — trois personnes, pas trois abstractions

Méthode : pour chacun, un scénario concret déroulé sur le produit **tel qu'il
existe aujourd'hui**, clic par clic ; ce qu'il emporte ; où ça coince. Les
manques alimentent le tableau §2.

### 1a. Le veilleur technologique (Safran, Thales, Airbus)

**Sa question du lundi matin : « qui monte sur la propulsion hydrogène, et
avec qui ? »**

1. Arrive sur l'accueil → tape « l'hydrogène par pays depuis 2020 » (le texte
   libre R4 le comprend) → Explorateur pré-rempli, courbes par pays.
2. Bascule la dimension sur **coordination** → voit qui pilote (la métrique
   coordination existe, MIN_COORDINATION_SAMPLE le protège des faux signaux).
3. Ouvre le hub d'un coordinateur qui l'intrigue → portefeuille, **partenaires
   récurrents** (le graphe + la liste), trajectoire.
4. Rebondit de partenaire en partenaire (les hubs s'enchaînent sans impasse).
5. Repart avec : des captures d'écran et un CSV de l'Explorateur.

**Où ça coince aujourd'hui, honnêtement :**
- Le hub organisation ne montre pas **son profil thématique** (« sur quoi
  travaille Thales ? » — on a les top programmes, pas les top thèmes ; la
  donnée existe, l'API compare la sert déjà par organisation). *Manque léger.*
- « **Quoi de neuf depuis ma dernière visite ?** » n'existe pas : pas de
  compte, pas de suivi, pas d'alertes (P5/P6 par conception). C'est LE cœur
  du métier de veilleur — il faut le dire : avant P5, Orion est pour lui un
  outil d'enquête, pas encore de veille.
- Les **nouveaux entrants** d'un thème (organisations dont la première
  participation est récente) ne sont pas repérables. Calculable dès
  aujourd'hui — c'est une vue d'Explorateur qui manque, pas une donnée.

### 1b. Le business developer (Total, Engie)

**Sa question : « où est l'argent du stockage d'énergie, quels consortiums
rejoindre ? »**

1. Accueil → porte « Explorer les 41 disciplines » → treemap des montants
   par programme sur sa requête.
2. Explorateur : métrique financements, dimension organisation → le top des
   acteurs financés, part de chacun (grille Attio, tendances ↑↓).
3. Hub des deux leaders → partenaires récurrents = la carte des consortiums
   existants ; le pill CORDIS l'emmène sur la fiche officielle du projet
   phare pour le montage exact.
4. `/compare` sur 3 concurrents → totaux comparés en barres, trajectoires
   superposées, thèmes et partenaires côte à côte.
5. Repart avec : le CSV, des captures pour ses slides.

**Où ça coince :**
- **Il repart avec des captures.** Pour un BD, le livrable est un dossier —
  aujourd'hui rien n'assemble « ma question + les 4 vues + les sources » en
  un document propre à poser en réunion. *Le manque le plus actionnable
  (« le dossier », §5.3).* 
- **Les appels à venir** : la porte l'annonce pour P5 ; d'ici là, la moitié
  « futur » de sa question n'a pas de réponse dans Orion. Assumé, daté.
- **La découverte de partenaires** « qui complèterait notre consortium ? »
  (M3 du brief) n'a pas d'écran ; les partenariats existants en donnent une
  approximation inversée, pas une recommandation.

### 1c. L'analyste académique (CNRS, CEA, universités)

**Sa question : « comment mon organisme se compare-t-il à ses pairs sur dix
ans, et d'où vient la croissance ? »**

1. Recherche « CNRS » → best-match card → hub : chiffre héros, trajectoire
   dessinée, portefeuille de 4 943 projets, période 2007-2027.
2. `/compare` CNRS vs Fraunhofer vs Max Planck (le picker fuzzy les trouve) ;
   séries longues superposées depuis 2005, KPIs, coordination.
3. Explorateur : dimension thème filtrée sur son domaine → la série longue
   du domaine, la table jumelle pour les valeurs exactes.
4. Repart avec : le CSV cité (l'export porte l'attribution de licence), les
   pills sources sur chaque projet.

**Où ça coince :**
- **La granularité.** Le CNRS d'Orion est l'entité consolidée ; l'analyste
  veut souvent SON laboratoire. Les homonymes à PIC distincts sont des
  garde-fous d'identifiants qui font leur travail — mais il faut le dire à
  l'écran (« cette fiche consolide N entités sources » n'existe pas). Le
  rattachement labo→organisme est un chantier de données (RNSR), pas d'UI.
- **La normalisation** : comparer CNRS (32 000 personnes) à un institut de
  800 n'a de sens qu'en trajectoire, pas en valeur absolue. Une option
  « base 100 à l'année N » dans compare résoudrait 80 % du besoin sans
  données nouvelles. *Manque léger.*
- **L'annotation** (« marquer ce pic 2023, c'est notre PEPR ») attend
  l'espace de travail P6.

### Synthèse des parcours

Le produit d'aujourd'hui **répond bien à l'enquête ponctuelle** (les trois
personas aboutissent en ≤ 5 clics, sans impasse, sources citées) ; il ne
répond **pas encore à la récurrence** (suivre, être alerté, retrouver) ni au
**livrable** (emporter un dossier, pas des captures). C'est cohérent avec le
plan de phases — mais deux manques sont actionnables sans attendre P5/P6 :
le profil thématique des organisations et le dossier exportable.

## 2. Sections exigées vs état — le tableau honnête

| Ce que le parcours exige | État | Quand |
|---|---|---|
| Recherche + facettes + hubs + Explorateur + compare | ✅ en place | — |
| Sources citées partout (crédibilité) | ✅ pills CORDIS/ANR + attributions | — |
| Profil thématique d'une organisation | ❌ manque (donnée déjà servie par l'API compare) | **proposable maintenant** |
| Nouveaux entrants d'un thème | ❌ manque (calculable) | proposable maintenant (vue Explorateur) |
| Base 100 dans compare | ❌ manque (client-side) | proposable maintenant |
| Le « dossier » exportable | ❌ manque | **cœur de cette conception (§5.3)** |
| Mention « fiche consolidée (N entités) » | ❌ manque (métadonnée existante) | proposable maintenant |
| Calls ouverts/à venir | ⏳ annoncé daté sur l'accueil | P5 |
| Suivi, alertes, « quoi de neuf » | ⏳ nécessite comptes | P5-P6 |
| Épinglage / dashboard personnel | ⏳ | P6 |
| Granularité laboratoire (RNSR) | ⏳ chantier données | vague 2+ |

## 3. La bibliothèque de visualisations — la question choisit la forme

Principe (skill dataviz) : **la forme se choisit avant la couleur, et parfois
la bonne forme n'est pas un graphique**. Chaque entrée : la question type,
la forme, son statut chez nous. La palette de séries validée et la table
jumelle restent des invariants ; jamais de double axe, jamais de camembert,
jamais de teinte générée au-delà des six.

### 3a. Ce qu'on a déjà — et qui reste juste

| Question | Forme en place | Verdict |
|---|---|---|
| « Combien au total ? » | Chiffre héros + count-up (accueil, fiches) | ✅ la bonne forme (stat, pas chart) |
| « Comment ça évolue ? » | LinesChart multi-séries, end-labels | ✅ |
| « Qui domine ? » | Barres horizontales rangées (Explorateur, compare) | ✅ encodage longueur |
| « Où va l'argent (hiérarchie) ? » | Treemap programmes | ✅ (garder < 2 niveaux) |
| « Ça bouge comment, en un clin d'œil ? » | Sparkline + TrendDelta dans les listes | ✅ |
| « Où géographiquement ? » | Choroplèthe séquentielle + globe | ✅ (gelé) |
| « Qui collabore avec qui ? » | PartnerGraph + flux géo | ✅ pour le 1er degré |

### 3b. Ce qui manque — six formes, chacune payée par une question de persona

| # | Question (persona) | Forme proposée | Règle d'usage |
|---|---|---|---|
| B1 | « Qui **monte**, qui décroche ? » (veilleur) | **Bump chart** (rangs dans le temps, 5-6 séries max, direct-labels) | les rangs, pas les valeurs ; sinon LinesChart |
| B2 | « Un acteur face au champ » (analyste) | **Emphasis** : sa série en accent, les pairs en gris | LA forme sous-employée ; devient le défaut de compare quand > 2 orgs |
| B3 | « Avant/après » (2 périodes, N acteurs) | **Dumbbell** (2 points reliés par entité) | remplace les doubles barres |
| B4 | « Intensité sur deux dimensions » (thème × pays, année × programme) | **Heatmap** séquentielle une teinte | jamais de rainbow ; table jumelle obligatoire |
| B5 | « Composition qui évolue » (BD) | **Aires empilées** ≤ 4 séries, ordre fixe | au-delà de 4 → petits multiples |
| B6 | « Répartition des tailles de projets » (analyste) | **Histogramme** (barres de distribution) | log-bins si la traîne l'exige, dit en clair |

Écarté en conscience : **sankey/chord** pour les flux de collaboration —
spectaculaires, illisibles au-delà de 15 liens, et notre besoin (« qui avec
qui, combien ») est mieux servi par la heatmap B4 + le graphe existant.
La doctrine tranche : la variété sert la lecture, pas le spectacle.

## 4. Les « Angles » — le carrousel de graphiques à la Apple

**Le concept.** Une question n'a pas UNE visualisation : elle a des angles.
« L'hydrogène » se regarde en trajectoire, en acteurs, en géographie, en
coordinations, en partenariats. Aujourd'hui l'Explorateur les offre tous —
mais l'utilisateur doit les *composer*. Les **Angles** les mettent en scène :
un carrousel horizontal plein cadre, un angle par écran ; glisser à droite =
l'angle suivant de la même question ; chaque angle est une vraie vue
Explorateur (donc une URL, donc partageable, donc épinglable en P6).

**Ce que ça devient dans le produit** : les « Analyses prêtes » cessent
d'être des liens — chacune devient un *deck* d'angles. « Où va l'argent de
l'hydrogène ? » = [trajectoire] → [par programme] → [par pays] → [qui
coordonne] → [le champ des acteurs, emphase sur le premier]. Le composeur
reste l'outil expert en dessous ; les Angles sont la lecture guidée.

**Spec d'interaction** (web-interface-guidelines) :
- CSS `scroll-snap-type: x mandatory`, slides `scroll-snap-align: center` —
  compositor-friendly, aucun JS de position ; défilement naturel trackpad/
  tactile/molette+shift.
- Flèches ‹ › visibles (boutons réels, hit ≥ 44 px), clavier ← → quand le
  carrousel a le focus, points de pagination cliquables avec labels
  (`aria-label` « Angle 2 sur 5 — par programme »).
- L'URL suit l'angle actif (`?angle=2`) : deep-link, retour arrière fidèle.
- Jamais d'auto-avance ; `prefers-reduced-motion` → le snap reste (c'est du
  scroll), seules les transitions décoratives tombent.
- Chaque slide : le graphique + sa phrase-titre (le composeur en lecture) +
  la table jumelle accessible ; les données se chargent à l'approche
  (angle n±1 préchargé).
- Mobile : mêmes gestes, pagination en points ; les flèches disparaissent.

**Où il vit** : ① l'Explorateur, au-dessus du composeur, quand la vue vient
d'une Analyse prête ; ② les fiches pays/organisation pourront à terme ouvrir
« les angles » de leur entité (P6). L'accueil ne change pas.

## 5. Les écrans transformés — maquettes

### 5.1 L'Explorateur en mode Angles — [maquette](design/angles-explorateur.html)

Le carrousel plein cadre sur « Où va l'argent de l'hydrogène ? » : cinq
angles réels, flèches, points, phrase-titre par angle, composeur replié en
dessous (« Ajuster cette vue »). Persona premier servi : le veilleur (mais
c'est la porte d'entrée de tous).

### 5.2 Le hub organisation « poste de veille » — [maquette](design/hub-poste-de-veille.html)

La fiche record gagne les deux sections que le parcours 1a exige :
**Profil thématique** (top 5 thèmes en barres, part du portefeuille — la
donnée que l'API compare sert déjà) et **Signaux** (nouveaux partenaires des
24 derniers mois, thème en accélération — calculés, datés). La sidebar
gagne « fiche consolidée : N entités sources » quand c'est le cas.
Persona : le veilleur d'abord, l'analyste ensuite.

### 5.3 Le dossier — spec enrichie (leçons de la spec externe, 2026-08-02)

**Le principe adopté : le dossier est un assemblage de BLOCS CITÉS.**
Chaque bloc porte : son titre éditorial, sa vue (le graphique ou la table),
**sa requête** (l'URL Explorateur — reproductible en un clic), **la date
des données** (le stamp d'ingestion) et **ses sources** (attributions de
licence). Aucun chiffre orphelin : le lecteur du dossier peut remonter de
chaque affirmation à sa vue vivante. Notre avantage structurel : chaque
vue étant déjà une URL canonique, le « snapshot » ne coûte rien — il est
l'architecture même du produit.

Principe transverse consigné au passage : **deux régimes, guidé et
expert, sur les mêmes objets** — texte libre, Analyses prêtes et Angles
sont le régime guidé ; le composeur est le régime expert ; le dossier les
réunit (on y verse depuis les deux).

### 5.3 bis Le dossier — wireframe d'origine

Le manque n°1 du BD. Proposition sobre : sur l'Explorateur et compare, un
bouton « Ajouter au dossier » ; un panneau latéral accumule les vues (titre,
miniature, source) ; « Emporter » produit une page imprimable propre
(stylesheet print dédiée : une vue par page, la phrase-composeur en titre,
tables jumelles, attributions de licence, date des données). Zéro PDF
serveur, zéro dépendance : le navigateur imprime. À maquetter au tour
suivant si le principe te va.

```
┌────────────────────────────────────────────┬──────────────┐
│  Explorateur / Compare                     │  DOSSIER (3) │
│  [vue courante]                            │  ▪ hydrogène │
│                            [+ Au dossier]  │    par pays  │
│                                            │  ▪ CNRS vs   │
│                                            │    Fraunhofer│
│                                            │  ▪ treemap   │
│                                            │  [Emporter →]│
└────────────────────────────────────────────┴──────────────┘
```

## 6. Ce que cette conception ne fait pas

Pas de nouvelle dimension de données, pas d'écran pour un persona fantôme,
pas de forme « parce qu'elle est belle » : chaque ajout est adossé à une
question d'un des trois personas et à une règle de la doctrine. Le globe et
la carte sont gelés et n'apparaissent pas ici.

## 7. Après ta validation — ordre proposé (révisé après les leçons UX de Vega)

1. **Autocomplete de recherche** (leçon U7 — promu en tête sur décision
   fondatrice : c'est la porte d'entrée des trois parcours) : endpoint
   suggest (organisations, thèmes, pays, acronymes ; le trigram existant
   sert déjà la tolérance aux fautes) + combobox accessible motif APG.
2. Hub « poste de veille » (profil thématique + signaux + mention
   consolidée) — le plus de valeur par ligne de code, et le précurseur UI
   de la couche groupes (U5).
3. Les Angles sur les Analyses prêtes de l'Explorateur.
4. Le dossier (maquette d'abord, puis print stylesheet).
5. Formes B1-B6 au fil des besoins des lots précédents (le bump chart
   arrive avec les Angles ; la heatmap avec le poste de veille) ; hygiène
   U2 (constante marque + i18n `{{brand}}`) glissée dans le premier lot
   frontend qui s'y prête.

La **couche groupes** (U5) est un chantier données, pas un lot de ce
chantier UI : cadrée à la [roadmap](roadmap.md) avec la vague 1.

### Backlog ajouté en recette du lot 2 (comparaison KAILA, 2026-08-02)

La fiche organisation devra encore gagner, dans un lot ultérieur :
① la **timeline financements/projets** (montants ET nombre de projets dans
le temps — la TrajectorySpark actuelle est volontairement sommaire) ;
② le **split participé/coordonné** lisible d'un regard (barres, jamais un
donut — doctrine) ; ③ la **carte des collaborateurs** ; ④ l'export
**« rapport organisation »** — le dossier du BD **monte en priorité**
(KAILA en fait un bouton central de fiche). Orion garde ses avantages
(profil thématique en parts, signaux seuillés, consolidation) : on
complète, on ne copie pas.
