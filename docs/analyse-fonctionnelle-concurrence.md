# Analyse fonctionnelle de la concurrence

**Statut : proposé** (itération avec la fondatrice avant toute implémentation).
Collecte du 2026-08-02, sur pièces : pages produit, fonctionnalités, pricing
publics des 8 outils visités au navigateur ; produits data adjacents repris
de l'[étude d'orientation](etude-orientation-ux.md). Fonctionnalités
uniquement — pas de design ici. Croisé avec les
[parcours personas](conception-parcours-visualisations.md), les
[Pièges de Vega](pieges-vega.md) et la [roadmap](roadmap.md).

## 0. Ce que la visite a appris de chacun

| Outil | En une phrase | À retenir pour Orion |
|---|---|---|
| **Funding Institutional** (Elsevier, fundinginstitutional.com) | La plus grosse base du marché : 45k opportunités + **9M de grants passés ($4,4T)**, recos, alertes deadlines, exports + **API**, intégration Pure/Scopus | Le « passé » à l'échelle mondiale existe déjà — notre défense est la **profondeur analytique**, pas le volume ; l'API est un argument enterprise réel |
| **Pivot-RP** (Clarivate) | Base éditorialement **curée** (34k opps, 20k funders) + 5M grants passés ; Funding Advisor IA par profil ; **newsletters automatisées, listes curées, groupes de partage** ; news politiques R&D | Le research office est un UTILISATEUR-ANIMATEUR : il redistribue (newsletters, listes, branding). La curation humaine est vendue comme qualité |
| **KAILA** (Zabala) | Le frontal : 171k projets UE, 19,9k opps, 226k innovateurs ; **veille concurrentielle assumée** (projets, partenariats, financements des concurrents), tendances, partenaires ; **rapports téléchargeables** ; freemium + tutoriels par cas d'usage | Nos quatre promesses sont les siennes — la différence se jouera sur la profondeur (benchmark, coordination, trajectoires) et l'exécution. Le **rapport téléchargeable** est vendu comme fonction de coopération |
| **Spinbase** (Spinverse) | « Décrivez votre idée » → calls + partenaires + projets similaires avec **% de correspondance** ; 2 étapes, zéro filtre ; essai 2 semaines ; la home segmente **par persona** (villes / universités / entreprises) | Le texte libre à % de match est LE standard d'accueil des non-experts ; le benchmark « mon idée vs projets financés » est un pont passé→futur que nous pouvons faire en mieux |
| **FundFit** (Streamlyne) | Matching IA quotidien par profil chercheur, philanthropie incluse ; **notifications poussées dans Slack** ; constitution d'équipes best-fit | L'outil vient à l'utilisateur (Slack/email), pas l'inverse — l'alerte est un FLUX entrant, pas une page à visiter |
| **Espace Subventions Entreprises** (BNP/KPMG/WeGrant) | Plateforme FR : 250-400 dispositifs (50 Md€/an, UE+national+régional), **test d'éligibilité en quelques clics**, puis accompagnement humain jusqu'au versement | L'attente des TPE/ETI françaises : l'éligibilité IMMÉDIATE et la prise en charge. Couverture régionale française — un axe que personne d'autre ne fait sérieusement |
| **GrantForward** | 37k opportunités, 5,5M awards, 572k profils chercheurs ; recos par profil (publications), alertes, saved searches ; « by academics for researchers » | Le profil chercheur alimenté par les publications est le moteur des recos académiques |
| **Granter.ai** | L'agent IA de bout en bout : matching + éligibilité auto, **rédaction des candidatures par IA** évaluée contre les critères officiels, gestion post-approbation (jalons, reporting) ; sales-led | Le marché monte vers l'EXÉCUTION (écrire, soumettre, gérer). À décider explicitement : hors périmètre Orion (voir §4, R7) |
| *Adjacents (étude orientation)* | Dimensions (graphe recherche), Crunchbase/Dealroom (données entreprises, signaux, listes suivies, alertes) | Les patterns de veille génériques : listes suivies + alertes + export — partout |

**Note de méthode** : la page produit d'Elsevier redirige vers son portail
général ; le produit vit sur son domaine dédié (données « July 2024 » —
vitalité commerciale à surveiller). Pricing détaillé rarement public
(KAILA freemium affiché ; Spinbase/FI/GF essais gratuits ; Pivot/Granter/ESE
sales-led).

## 1. Le tableau comparatif fonctionnel

Légende : ✓✓ fort · ✓ présent · 🟡 partiel · ✗ absent. Colonne Orion :
l'état RÉEL d'aujourd'hui (pas la roadmap).

| Fonctionnalité | FI | Pivot | KAILA | Spinbase | FundFit | ESE | GrantFwd | Granter | **Orion (réel)** |
|---|---|---|---|---|---|---|---|---|---|
| Recherche full-text + facettes | ✓ | ✓ | ✓ | 🟡 (volontairement) | ✓ | 🟡 | ✓✓ | 🟡 | **✓✓** |
| Recherche langage naturel / sémantique | 🟡 | ✓ | 🟡 | ✓✓ (% match) | ✓ | ✗ | 🟡 | ✓ | **🟡** (parseur règles ; LLM P4) |
| Autocomplete / suggestions | ✓ | ✓ | 🟡 | n/a | ✓ | ✗ | ✓ | 🟡 | **✓** (lot 1) |
| Base d'opportunités / calls | ✓✓ 45k | ✓✓ 34k | ✓ 19,9k | ✓ | ✓ | ✓ 400 | ✓✓ 37k | ✓ | **✗** (P5) |
| Base de projets financés (le passé) | ✓✓ 9M mondial | ✓ 5M | ✓ 171k UE | 🟡 40k | ✗ | ✗ | ✓ 5,5M | ✗ | **✓** 119k UE+FR |
| Analytique du financé (tendances, acteurs) | ✓ | 🟡 | ✓ | 🟡 | ✗ | ✗ | 🟡 | ✗ | **✓✓** (Explorateur, thèmes, coordination) |
| Veille concurrentielle organisations | 🟡 | ✗ | ✓✓ | ✗ | ✗ | ✗ | ✗ | ✗ | **✓✓** (hubs, poste de veille, signaux) |
| Benchmark multi-organisations | ✗ | ✗ | 🟡 | ✗ | ✗ | ✗ | ✗ | ✗ | **✓✓** (/compare, 4 orgs) |
| Découverte de partenaires | ✓ | ✓✓ (profils WoS) | ✓ | ✓ | ✓✓ (teams) | ✗ | ✓ | 🟡 | **🟡** (partenariats existants, pas de reco) |
| Matching profil/idée → opportunités | ✓ | ✓✓ | 🟡 | ✓✓ | ✓✓ | ✓ (éligibilité) | ✓✓ | ✓✓ | **✗** (P5) |
| Alertes (email, deadlines, nouveautés) | ✓ | ✓✓ | ✓ | ✓ | ✓✓ (+Slack) | 🟡 | ✓✓ | ✓✓ (24/7) | **✗** (P5) |
| Comptes, recherches sauvegardées, suivis | ✓ | ✓✓ | ✓ | ✓ | ✓ | ✓ | ✓✓ | ✓ | **✗** (P6) |
| Partage interne (groupes, newsletters) | ✓ (Pure) | ✓✓ | 🟡 | ✗ | ✓ (Slack) | ✗ | ✓ | 🟡 | **✗** |
| Exports / rapports | ✓✓ (+API) | ✓ | ✓✓ (rapports) | 🟡 | ✓ | ✗ | ✓ | ✓ | **🟡** (CSV cité ; pas de dossier) |
| API publique | ✓✓ | ✗ | ✗ | ✗ | ✗ | ✗ | 🟡 | ✗ | **✗** (OpenAPI interne prêt) |
| Sources citées ligne à ligne | 🟡 | 🟡 | 🟡 | ✗ | ✗ | ✗ | 🟡 | ✗ | **✓✓** (pills CORDIS/ANR, licences) |
| Couverture France nationale (ANR+) | 🟡 | 🟡 | ✗ | ✗ | ✗ | ✓✓ (FR incl. régional) | 🟡 | ✓ | **✓✓** (ANR profond ; ADEME/F2030 à venir) |
| Rédaction de candidatures (IA) | ✗ | ✗ | ✗ | ✗ | ✗ | 🟡 (humain) | ✗ | ✓✓ | **✗** (hors périmètre proposé) |
| Gestion post-award | ✗ | 🟡 | ✗ | ✗ | ✗ | ✓ (humain) | ✗ | ✓ | **✗** (hors périmètre) |
| Essai self-serve / freemium | ✓ | ✗ | ✓✓ (free tier) | ✓✓ | ✓ | ✗ | ✓ | ✗ | **✗** (pas de comptes) |
| Guidage par persona / cas d'usage à l'arrivée | 🟡 | ✓ (2 rôles) | ✓ (tutoriels) | ✓✓ (3 cibles) | ✓ | ✓ | ✓ | ✓ | **✓** (portes d'intention, analyses prêtes) |

## 2. Les standards du marché qu'Orion n'a pas (encore)

Par ordre de gravité commerciale — ce qu'un prospect nous opposera en démo :

1. **Les appels à projets + le matching + les alertes** — 7 outils sur 8 les
   vendent EN PREMIER ; c'est la définition même de la catégorie pour le
   marché. Notre P5 n'est pas une option, c'est le ticket d'entrée. (Le brief
   l'avait vu juste ; le marché le confirme violemment.)
2. **Les comptes et la persistance** (recherches sauvegardées, organisations
   suivies, espaces d'équipe) — 8/8. Sans eux, pas de récurrence, pas
   d'alertes, pas de vente. P6 confirmée.
3. **Le partage interne** — newsletters, listes curées, groupes (Pivot),
   push Slack (FundFit) : l'acheteur (research office, cellule Europe) est un
   REDISTRIBUTEUR. Prévoir dès P6 le « partager cette vue à l'équipe ».
4. **Le rapport/dossier exportable** — KAILA en fait un argument, FI a
   exports+API. Notre lot 4 (le dossier) est confirmé par le marché.
5. **L'essai self-serve** — KAILA freemium, Spinbase/FI/GF essais. Notre
   « démontrable sans rien lancer » (définition du succès) devra devenir
   « essayable sans nous parler ». P6 pricing.
6. **L'API publique** — seul FI l'a vraiment : différenciateur enterprise
   accessible (notre OpenAPI existe déjà en interne). P6/P7.

## 3. Ce qu'Orion a et qu'eux n'ont pas (nos arguments de démo)

1. **Le benchmark multi-organisations côte à côte** — personne ne l'a
   (KAILA effleure). C'est notre écran de vente n°1 face à un industriel.
2. **La profondeur veille du financé** : trajectoires, coordination
   (qui pilote), partenariats récurrents visualisés, poste de veille avec
   signaux seuillés — KAILA liste, nous analysons.
3. **La France en profondeur** (ANR aujourd'hui, ADEME/France 2030 en
   vague 1) DANS le même outil que l'Europe — ESE couvre la France sans
   analytique ; les européens ignorent le national. Le combo est unique.
4. **La donnée sourcée ligne à ligne** (pills CORDIS/ANR, licences,
   fiches consolidées annoncées) — argument de confiance décisif en
   entreprise, personne ne le fait à ce niveau.
5. **L'exigence visuelle** — après la doctrine, aucune démo du marché ne
   ressemble à la nôtre (KAILA et GrantForward datent ; Pivot est
   institutionnel). Ce n'est pas cosmétique : c'est la vitesse de lecture.
6. **(P4) Le langage naturel avec citations** sur le passé — Spinbase le
   fait sur les calls ; personne ne le fait sérieusement sur 119k projets
   financés avec sources.

## 4. Recommandations priorisées

**R1 — P5 : concevoir les calls comme le marché les attend, plus notre
twist.** Le standard : catalogue filtrable + matching par description libre
avec % (Spinbase) + test d'éligibilité rapide (ESE) + alertes deadlines
(tous). Notre twist unique, que PERSONNE n'a : **l'alerte sur le passé**
(« préviens-moi quand un concurrent gagne un projet quantique ») et le pont
« qui a gagné les calls similaires » depuis chaque call (notre corpus est
fait pour ça). → Roadmap P5, cahier des charges enrichi.

**R2 — P6 : comptes = persistance + redistribution.** Saved searches,
orgs suivies, épinglage (déjà prévu) **plus** le partage d'équipe (vue
partagée, digest email hebdo d'espace) — l'acheteur redistribue. → Roadmap
P6, périmètre étendu d'une ligne.

**R3 — Le dossier (lot 4 en cours) est validé par le marché** — le faire
exportable ET partageable (URL de dossier) pour préparer R2. → Inchangé,
priorité confirmée.

**R4 — API publique en P6/P7** : documenter l'OpenAPI existante comme
produit (auth par clé, quotas par plan). Argument enterprise face à FI.
→ Roadmap P6/P7, une ligne.

**R5 — Essai self-serve dès P6 pricing** : un tier gratuit borné (à la
KAILA) plutôt qu'un mur de démo. → Décision de modèle à trancher en P6.

**R6 — Découverte de partenaires (M3 du brief)** : le marché la fait par
profils/opportunité ; notre angle : par DONNÉES du financé (« qui complète
les consortiums comme le vôtre »). À concevoir en P5 avec le matching.

**R7 — Hors périmètre assumé, à écrire dans la roadmap** : la rédaction IA
de candidatures et la gestion post-award (Granter, suites admin). C'est un
AUTRE métier (exécution vs intelligence) ; s'y étendre diluerait le
différenciateur. On le dit une fois, par écrit, pour ne plus y revenir.

### Croisements

- **Pièges de Vega** : U7 (la recherche qui comprend) est le standard du
  marché (Spinbase/Pivot) — notre lot 1 était le bon premier pas ; U5 (les
  groupes) est prérequis des alertes concurrent de R1 (on s'abonne à
  « Thales », pas à 12 entités) — la couche groupes monte d'un cran en
  priorité vague 1.
- **Parcours personas** : le veilleur obtient en R1 son « quoi de neuf »
  (alerte concurrent) ; le BD obtient en R1+R3 son pont calls→dossier ;
  l'analyste bénéficie de R4 (API) et des fiches consolidées (U5).
- **Doctrine** : rien dans R1-R7 ne crée d'écran nouveau sans persona ;
  les principes (honnêteté, sources, seuils) s'appliquent aux alertes
  comme au reste (une alerte sans seuil est du spam).

## 5. Ce que ça change à la roadmap (proposition)

1. P5 (calls) : cahier des charges enrichi — matching % par description
   libre, éligibilité rapide, alertes deadlines ET alertes passé
   (concurrents/thèmes), pont « calls similaires déjà gagnés », découverte
   de partenaires data-driven (R6).
2. P6 : + partage d'équipe (R2), + API produit (R4), + essai self-serve
   (R5).
3. Vague 1 données : la couche groupes (U5) promue prérequis des alertes
   concurrent.
4. Hors périmètre écrit : rédaction de candidatures, post-award (R7).
