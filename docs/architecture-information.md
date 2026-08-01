# Architecture de l'information — Orion

- **Statut : proposé le 2026-07-31, en attente de validation**
- **Objet : la maison entière** — sitemap complet (phases 2 à 7), modèle de navigation et gabarits de pages. On n'implémente que la phase 2, mais chaque mur posé aujourd'hui doit tenir quand les étages arriveront.
- **Méthode : benchmark d'abord** (concurrents + produits data adjacents), puis principes, puis structure.

## 1. Ce que font les meilleurs — et ce qu'on en retient

| Produit | Ce qui marche | Leçon pour Orion |
|---|---|---|
| **Dimensions** | Quatre entités interconnectées (publications, grants, brevets, essais) ; la valeur naît des liens chercheur ↔ organisation ↔ financeur ↔ pays | Le graphe d'entités est le produit. Chaque fiche est un carrefour, jamais une feuille morte |
| **Our World in Data** | Hiérarchie topics → explorers → graphiques ; chemins narratifs qui transforment la masse en compréhension ; entrée par thème, par pays, par indicateur | Multiplier les **portes d'entrée** (thème, pays, programme) vers le même corpus ; le contexte narratif rend l'exploration simple |
| **Dealroom** | Hubs multi-dimensionnels (secteur, géographie, performance) ; dashboards d'écosystème par ville ; listes vivantes (« hot this week ») | Les **pages hub** par dimension sont le moteur de la découverte ; la fraîcheur crée le retour |
| **Crunchbase** | Fiches entités fortement interliées + listes « discover » par catégorie/lieu ; profil = agrégat de signaux | Un seul gabarit de fiche entité, décliné ; les listes curées comme produit d'appel |
| **CB Insights** | Progressive disclosure exemplaire : synthèse lisible d'abord, profondeur analytique en un clic ; esthétique data premium | L'essentiel immédiat, l'expertise à un clic — jamais l'inverse |
| **KAILA** | Quatre usages nommés (financer, analyser les tendances, veiller, trouver des partenaires) ; segmentation par profil | Nommer les usages dans la navigation aide les non-spécialistes à se situer |
| **Spinbase** | Recherche en langage libre + % de correspondance ; « éliminer les filtres complexes » pour les non-experts | La recherche libre est la porte des non-spécialistes (notre phase 4) ; les filtres restent la porte des experts. Il faut les deux |

**L'anti-modèle commun** : le portail Funding & Tenders officiel — riche et illisible, tout au même niveau, aucun chemin. La confusion vient rarement du volume, presque toujours de l'absence de hiérarchie et de liens.

## 2. Principes directeurs (les exigences fondatrices, transformées en règles)

1. **Deux modes, une seule structure.** Le *chercheur* (sait ce qu'il veut) entre par la recherche et les filtres ; l'*explorateur* (veut découvrir) entre par les hubs (thème, pays, programme, organisation) et rebondit de fiche en fiche. Chaque page sert les deux : résultats filtrables **et** rebonds contextuels.
2. **Aucun cul-de-sac.** Toute page se termine par un bloc standard **« Explorer à partir d'ici »** : entités liées, hubs parents, recherches suggérées. Une fiche projet mène à ses organisations, son programme, ses thèmes, ses projets similaires ; une organisation mène à ses partenaires, ses programmes, son pays.
3. **Progressive disclosure.** Chaque gabarit définit explicitement trois niveaux : *l'essentiel* (visible immédiatement, compréhensible par un non-spécialiste), *le détail* (un clic : onglets, « voir tout »), *l'expert* (exports, identifiants pivots, données brutes, API). On ne montre jamais le niveau 3 avant le niveau 1.
4. **Le périmètre géographique est un contexte global, pas une page.** Voir §4 — c'est la décision structurante pour le multi-pays.
5. **Richesse maximale, simplicité maximale — la tension est arbitrée page par page.** Chaque gabarit du §6 déclare « on montre d'abord / on révèle ensuite ». La densité vit dans les tableaux et les onglets, jamais dans le premier écran.
6. **Aucune page figée.** Chaque gabarit est une **pile de sections optionnelles (slots)** alimentées par un registre de capacités : une nouvelle source, une nouvelle phase = de nouvelles sections qui s'insèrent, jamais une refonte. (Leçon Vega n° 1 côté produit.)

## 3. Modèle de navigation

**Barre globale** (persistante, cinq zones) :

```
[Orion]   Projects  Organisations  Explore ▾  [Analytics]  [Calls]   ⌕ ⌘K   [🌍 Europe + FR]  EN  ◐  [Compte]
```

- **Recherche omniprésente** : champ visible en permanence + palette ⌘K (projets, organisations, programmes, pays, thèmes — préfigure la recherche en langage naturel de la phase 4, qui s'installera au même endroit).
- **Explore ▾** : le menu de la découverte — Pays, Programmes, Thèmes, (plus tard : Classements, Cartes). C'est la porte d'entrée de l'explorateur.
- **Analytics** et **Calls** apparaissent aux phases 3 et 5 (nav additive : on ajoute des entrées, on n'en déplace jamais).
- **Fil d'Ariane** sur toutes les pages profondes (`Projects › HYDEA` ; `Explore › Countries › France`).
- **Footer** : sitemap complet, sources et licences (`/about-data`), changelog, statut des données.

## 4. Le périmètre géographique (décision structurante)

**Modèle : un sélecteur de périmètre global (scope), persistant, dans la barre.**

- Un *scope* = un ensemble de bailleurs (aujourd'hui : `EU` = Commission européenne, `FR` = ANR ; demain `US`, `UK`, `JP`…). Le scope par défaut : **« Europe + France »** (tout ce qui existe).
- Le scope **filtre par défaut** recherches, hubs et analytics ; il est porté par l'URL (`?scope=eu,fr`) — partageable, stable.
- Les **fiches restent globales** : une organisation japonaise partenaire d'un projet H2020 a une fiche, quel que soit le scope. Le scope teinte les agrégats affichés (« financements dans votre périmètre »), jamais l'existence des entités.
- Les **hubs pays** (`/explore/countries/:code`) existent pour tous les pays participants (213 aujourd'hui) — le hub d'un pays non couvert par un bailleur ingéré montre ce qu'on sait (participations) et annonce ce qui manque (« les financements nationaux japonais ne sont pas encore couverts »). C'est notre surface d'extension naturelle.
- **Abonnements par zone (phase 6)** : les plans se mappent sur les scopes (ex. Europe seul / Europe + US). Le sélecteur devient le point de contact commercial : un scope non souscrit est visible mais verrouillé (teaser honnête, pas de mur opaque).
- **Ajouter un pays = zéro refonte** : nouveau funder + nouvelle option de scope + hub pays déjà existant qui s'enrichit.

## 5. Sitemap complet (la maison entière)

Légende : **[P2]** implémenté en phase 2 · [P3]-[P7] phases futures · *(slot)* = section d'un gabarit existant, pas une page.

```
/                                  [P2] Accueil = recherche + chiffres héros + entrées d'exploration
├─ /projects                       [P2] Résultats projets (filtres, facettes, tri, URL partageable)
│  └─ /projects/:id                [P2] Fiche projet
├─ /organisations                  [P2] Résultats organisations
│  └─ /organisations/:id           [P2] Hub organisation (portefeuille, montants)
│       ├─ …/partners              [P3] onglet partenariats (récurrents, réseau)
│       └─ …/trends                [P3] onglet évolution temporelle
├─ /explore                        [P2 minimal] La porte de la découverte
│  ├─ /explore/countries           [P2] Liste pays → /explore/countries/:code   [P2 minimal, enrichi P3]
│  ├─ /explore/programmes          [P2] Hiérarchie bailleurs → programmes → /explore/programmes/:id
│  └─ /explore/topics              [P3] Hubs thématiques (euroSciVoc, axes ANR)
├─ /analytics                      [P3] Tendances, cartographie des partenariats, carte Europe, benchmark
│  ├─ /analytics/trends            [P3]
│  ├─ /analytics/partnerships      [P3]
│  ├─ /analytics/map               [P3]
│  └─ /analytics/benchmark         [P3]
├─ /calls                          [P5] Catalogue des appels ouverts / à venir
│  ├─ /calls/:id                   [P5] Fiche appel (dates, budget, TRL, lien officiel)
│  └─ /calls/match                 [P5] Matching sémantique depuis un profil / une description
├─ /alerts                         [P5] Alertes paramétrables (nouveaux calls, deadlines, concurrents)
├─ /workspace                      [P6] Espace privé du client
│  ├─ /workspace/lists             [P6] Listes suivies (organisations, projets, calls)
│  ├─ /workspace/notes             [P6]
│  └─ /workspace/settings          [P6] Équipe, rôles, abonnement
├─ /account                        [P6] Profil, connexion
├─ /pricing                        [P6] Plans (par zone géographique, cf. §4)
├─ /about-data                     [P2] Sources, licences, attributions, fraîcheur (existe déjà en API)
└─ /admin                          [P6] Tableau de bord interne (pipelines, volumétrie, usage)
```

La **recherche en langage naturel (P4)** n'est pas une page : elle habite la palette ⌘K et la barre de recherche, avec une zone de réponse synthétique + citations au-dessus des résultats classiques.

## 6. Gabarits de pages

Cinq gabarits couvrent tout le site. Chacun déclare : *montrer d'abord* / *révéler ensuite* / *portes de sortie* / *slots d'extension*.

### G1 — Accueil / Recherche (`/`)
- **Montrer d'abord** : chiffres héros animés (€211 Md, 119 172 projets, 103 457 organisations), la constellation des financements, recherche centrale, suggestions de thèmes.
- **Révéler ensuite** : entrées d'exploration (pays, programmes, thèmes), fraîcheur des sources.
- **Portes de sortie** : tout — c'est le hall d'entrée.
- **Slots** : bloc « nouveautés » (P3+), accès calls (P5), reprise de session workspace (P6).

### G2 — Liste de résultats (`/projects`, `/organisations`, plus tard `/calls`)
- **Montrer d'abord** : compte total, résultats classés (titre, montant, années, programme), filtres actifs.
- **Révéler ensuite** : facettes complètes avec décomptes, tri, pagination ; densité tableau au choix (vue confortable / vue dense).
- **Portes de sortie** : chaque ligne → fiche ; chaque facette → hub correspondant (« France · 611 » → hub France).
- **Slots** : nouvelles facettes par source, export (P6), colonne « suivi » workspace (P6).

### G3 — Fiche projet (`/projects/:id`)
- **Montrer d'abord** : titre (langue de l'UI), acronyme, montant, dates, bailleur/programme, participants principaux avec rôles.
- **Révéler ensuite** : résumé complet (bascule de langue), tous les participants avec montants, thématiques, appel d'origine, attribution de source.
- **Portes de sortie** : chaque participant → hub organisation ; programme → hub programme ; thèmes → hubs thème ; « projets similaires » (P3 sémantique, P2 = même appel/thème).
- **Slots** : publications/résultats (extension possible), position dans les tendances (P3), calls similaires ouverts (P5).

### G4 — Hub d'entité (`/organisations/:id`, `/explore/countries/:code`, `/explore/programmes/:id`, `/explore/topics/:id`)
**Un seul gabarit** pour toutes les entités agrégantes — c'est lui qui rend le site explorable :
- **Montrer d'abord** : identité + KPIs héros (financement total, nb projets, période, rang dans le scope), mini-courbe temporelle.
- **Révéler ensuite** : onglets — Portefeuille (P2) · Partenaires (P3) · Tendances (P3) · dimensions propres à l'entité.
- **Portes de sortie** : top entités liées (une organisation → ses partenaires et programmes ; un pays → ses organisations et thèmes phares ; un programme → ses gros bénéficiaires), chacune cliquable.
- **Slots** : chaque phase ajoute un onglet ou une carte, l'ossature ne bouge pas. Les hubs pays/programme en P2 sont **minimaux mais réels** (KPIs + portefeuille) : mieux qu'une page « bientôt », moins qu'un dashboard.

### G5 — Canvas analytique (`/analytics/*`, P3)
- **Montrer d'abord** : une visualisation, une question, les contrôles essentiels (période, scope).
- **Révéler ensuite** : dimensions croisées, tableaux sous-jacents, export.
- **Portes de sortie** : tout point de donnée est cliquable vers sa fiche ou son hub.
- **Slots** : nouveaux canvas = nouvelles entrées du menu Analytics, gabarit identique.

(Les gabarits `Fiche call` (P5) et `Workspace` (P6) dérivent de G3 et G2 respectivement — mêmes règles.)

## 7. Règles d'évolution (aucune page figée)

1. **Registre de capacités** : le frontend interroge l'API (`/api/sources` aujourd'hui, enrichi ensuite) pour savoir quelles sources, langues et modules existent ; les sections s'affichent en fonction. Ajouter l'ADEME ou le Japon n'exige aucun changement de gabarit.
2. **Nav additive** : on ajoute des entrées (Analytics, Calls), on ne renomme ni ne déplace jamais ce qui existe.
3. **URLs stables pour toujours** : `/projects/:id` et `/organisations/:id` sont des contrats. Les identifiants internes ne fuient jamais dans les slugs marketing.
4. **Slots avant pages** : toute nouvelle information cherche d'abord sa place comme section d'un gabarit existant ; une nouvelle page n'est créée que si la dimension est vraiment nouvelle.
5. **Feature flags par phase** : les branches [P3+] du sitemap existent dans le routeur derrière des drapeaux — la structure est prête avant le contenu.

## 8. Ce que la phase 2 implémente concrètement

G1 (accueil-recherche complet), G2 (projets + organisations), G3 (fiche projet), G4 (hub organisation complet ; hubs pays et programme **minimaux** : KPIs + portefeuille + portes de sortie), `/about-data`, le sélecteur de scope (une seule option active « Europe + France », mais le mécanisme et l'URL sont en place), le bloc « Explorer à partir d'ici » sur toutes les fiches. Le reste du sitemap vit dans le routeur derrière des drapeaux.

**Ajout au parcours de démo** (proposition) : entre l'étape 4 et 5, un rebond par un hub — projet → organisation → *hub France* → retour recherche filtrée — pour prouver qu'aucune page n'est un cul-de-sac.

## 9. Vision & personas (consigné le 1ᵉʳ août 2026 — guide les phases 3 à 7)

La vision de la fondatrice, à relire avant chaque conception d'écran.

### Les personas — chaque écran se pense pour des profils réels

| Persona | Chez qui | Ce qu'il cherche | Ce que le site doit lui donner |
|---|---|---|---|
| **Le veilleur technologique** | Safran, Thales, Airbus | qui travaille sur quoi, quelles technologies émergent, qui coordonne | recherche thématique fine, tendances par thème, réseaux de partenaires, alertes (P5+) |
| **Le business developer** | Total, Engie | où est l'argent, quels consortiums rejoindre, quels appels arrivent | montants et parts par acteur, benchmark concurrents, calls à venir (P5), export |
| **L'analyste académique** | CNRS, CEA, universités | positionnement de son labo, comparaison entre pairs, historique d'un domaine | hubs organisation riches, comparaisons Explorateur, séries longues, citations de sources |

Règle : à chaque nouvel écran, dire lequel de ces trois profils il sert d'abord —
un écran qui ne sert clairement aucun des trois n'est pas construit.

### Le tableau de bord configurable (phase 6)

À la connexion, l'utilisateur compose sa page d'accueil : il épingle des vues de
l'Explorateur (chaque vue étant déjà une URL, l'épinglage est naturel), des
organisations suivies, des recherches sauvegardées. La page d'accueil connectée
est un assemblage personnel, pas une page éditoriale.

### La homepage vitrine (phase 6)

Distincte de l'outil : une page publique de présentation, style Apple/SpaceX —
grands chiffres animés, la constellation, les histoires — qui vend le produit.
L'outil (recherche, explorateur, hubs) vit derrière ; l'accueil actuel de l'outil
(recherche-first) reste l'accueil des utilisateurs connectés jusqu'à P6.

### Passé / futur (phase 5)

Quand les appels à projets arrivent, la navigation sépare explicitement **ce qui
a été financé** (le passé, nos données actuelles) de **ce qui va l'être** (calls
ouverts et à venir), avec des ponts : depuis un hub organisation, « les appels
où ce profil candidaterait » ; depuis un call, « les projets déjà financés sur ce
thème ».

### Exigence transverse : jamais un rendu « site fait par IA »

Typographie choisie (Instrument Sans + Inter, jamais les défauts système),
couleurs qui appartiennent à une palette pensée et validée (contrastes, CVD),
finitions (états de survol, focus, vides, chargements, mouvements avec
reduced-motion). Chaque livraison visuelle se juge à cette barre : si un écran
pouvait sortir d'un générateur, il n'est pas fini.
