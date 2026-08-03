# Roadmap d'exécution

> Fil de pilotage tenu à jour à chaque validation de la fondatrice.
> Règle inchangée : chaque chantier est proposé, validé, puis exécuté.

## ✅ CHANTIER UI — CLOS (v0.4.0, 2026-08-03)

**État final : toutes les recettes fondatrice de la vague sont validées
— navigation par intentions, doctrine appliquée partout, recherche
composable aux destinations partagées, dossier remplissable, une
Actualités au geste des decks (gel Firefox clos sur sa console), fiche
organisation en actes. Reste ouvert hors UI : la revue ODbL (blocante au
go-live) et les chantiers datés P5/P6.**

## Clos avec v0.4.0 — le chantier design (doctrine, étapes validées une à une)

Référence : [design-doctrine.md](design-doctrine.md).

| Étape | Contenu | Statut |
| --- | --- | --- |
| 1 — Fondations | Tokens typographiques, tabular figures globales, encre/hairlines/une ombre, Geist Mono, StatHero | **Validée** (2026-08-02) |
| 2 — Hero signature | Accueil en actes, hero piné GSAP (scrub), trois entrées éditoriales, footer parchemin | **Validée** (2026-08-02) |
| 3 — Explorateur & listes | Grilles type Attio/Linear, filtres Polaris, sparklines, hover réels ; lien source CORDIS/ANR sur chaque fiche projet | **Validée** (2026-08-02) |
| 3 bis — Globe en acte 3 | Globe V1 photo, constellation de flux, panneau pays, sélection lumineuse (9 retours fondatrice intégrés) | **Livrée** (2026-08-02) — gelée, on y reviendra |
| 4 — Fiches & benchmark | Layout record Attio, barres horizontales, TrajectorySpark | **Validée** (2026-08-02) |
| 5 — Passe anti-« IA » | Audit continu, checklist des 10 pièges à chaque écran | Continue |

## Chantier transverse — parcours & visualisations (conception validée à itérer)

Issu de la [conception parcours](conception-parcours-visualisations.md) et des
[leçons UX de Vega](pieges-vega.md) (2026-08-02). Ordre proposé, révisé après
les huit leçons :

1. **Autocomplete de recherche** — **livré** (2026-08-02, lot 1, recette
   validée).
2. **Hub « poste de veille »** — **livré** (2026-08-02, lot 2, recette
   validée).
3. **Les Angles** (+ peek Apple) — **livré, recette validée** (2026-08-02)
   avec trois retouches exécutées : labels lisibles en entier partout
   (« aucun texte tronqué » entre en checklist de recette), l'angle cumul
   remplacé par l'**avant/après** (dumbbell B3, fenêtres mûres alignées
   sur les signaux du poste de veille), et la présentation au niveau du
   deck (titre + phrase en lecture + une seule sortie vers le composeur).
   Règle générale actée : **pas de barres horizontales statiques par
   défaut** (carte pour le géographique ; les barres restent un choix, et
   le défaut des seuls taux classés et classements longs délibérés).
   **Recette deck hydrogène (même jour)** : les **treemaps quittent le
   produit** ; le **donut interactif** les remplace (amendement doctrine :
   ≤ 7 parts, « autres » honnête sur le total serveur, centre vivant,
   drill-down programme → sous-programmes via `?programme=`, nouveau
   paramètre whitelisté de l'API) ; « qui est financé » passe en
   trajectoires ; l'angle pays confirmé en carte (le doute venait d'un
   vieux build local, pas du code).
4. **Le dossier** — **livré** (2026-08-02, maquette v2 validée puis
   implémentée : collecte board + decks, compteur d'en-tête, page
   éditoriale aux vues vivantes annotées, « Emporter » en une section
   par page ; objet de session localStorage, durable avec les comptes
   P6). En recette sur site.
4 bis. **Fiche organisation complète** (recette lot 2 vs KAILA), élargie
   par la fondatrice (2026-08-03 : « belle et riche, pas seulement
   complète — LA page de démo ») : **première tranche livrée le jour
   même** — la fiche s'ouvre en actes numérotés à la grammaire des decks
   (01 · la timeline années par rôle, coordonné/participé empilés aux
   couleurs de séries, trois tuiles de stats, ligne de lecture au
   survol ; 02 · la carte des collaborateurs — nouvel endpoint
   pays-partenaires, choroplèthe séquentielle, règle du premier clic,
   hors-carte honnête — à côté de la liste des partenaires récurrents).
   Le graphe abstrait des partenaires a cédé sa place à la carte. En
   recette sur site.
5. Formes B1-B6 au fil des lots (B1 bump et B3 avant/après livrées) ;
   **hygiène U2** (constante marque) en chemin.

## Chantier « première visite » → refonte de l'architecture du site

Réveillé et élargi par la fondatrice (2026-08-02, recette lot 3) :
proposition livrée — [architecture-site.md](architecture-site.md)
(navigation par intentions Découvrir / Analyser / Construire / Espace de
travail ; cinq pages nouvelles dont deux placeholders élégants datés
P5/P6 ; mapping complet de l'existant) et sa
[maquette de navigation](design/navigation-maquette.html).
**Principe validé sur maquette (même jour) → implémentation par lots
testables en réel.** Exigences fondatrice : FR/EN partout, textes sans
odeur d'IA ; placeholders raffinés (dégradés subtils, ombres douces —
pas de pavés) ; le sélecteur « Europe + France » discret ou masqué tant
qu'une seule zone existe (la mécanique URL reste dessous, elle porte les
abonnements par zone) ; « Construire » à valider à l'usage.

État : **tous les lots livrés** (2026-08-02) — A-C (barre quatre
intentions, `/analyses`, placeholders raffinés, périmètre masqué), puis
**lot D** (les portes de l'accueil disent les verbes avec du contenu
vivant : la première organisation du corpus, le deck hydrogène, votre
dossier en cours ; le verbe futur reste daté et non cliquable) et
l'**index des thèmes** `/explore/themes` (41 disciplines : poids,
étincelle vingt ans, avant/après en fenêtres mûres, tri
montant/progression, chaque rangée ouvre l'Explorateur pré-composé —
entrée au menu Découvrir et au footer). Grande recette fondatrice du
même jour : globe/cartes et donuts **validés, on ne touche plus** ;
la page Programmes regroupée par cadre (cadres CE en rangées
éditoriales, 450 ANR en liste dense filtrable — plus de cartouches).

## La recherche composable — livrée (V1 en recette)

Principe validé sur maquette puis **implémentée le jour même** (la
fondatrice juge sur site) : la barre à tags typés vit sur /projects et
/organisations — pays, bailleur, programme, années, texte bilingue,
état dans l'URL, facettes poseuses de tags, exemples enseignants à
l'état vide. Reste de la [conception](conception-recherche-composable.md) :
le tag organisation (extension backend `organisation=`) et le filtre
thème exact, à la demande. Deuxième vague de la grande recette livrée
aussi : ambiances de l'accueil (tuile montante, recherche vivante,
globe entier aux trois vitesses de recette), programmes par source,
sept photos pays curées + silhouette élégante en fallback. Recette v4
(même jour) : correspondance pays MULTI-LOCALE (« Allemagne » sous
interface anglaise pose le tag pays — barre et palette, extensible),
fil d'actus au défilement réellement automatique (pause à l'intention,
plus au survol fantôme), et les actualités officielles dans le fil via
le relais /api/news (flux Commission DG R&I ; CORDIS sans RSS public,
ANR configuré mais vide — repli élégant, cache 30 min,
stale-on-error, lien à la source sur chaque news). Recette v5 (même
jour) : la une Actualités passe en **bande pleine largeur entre deux
hairlines** (étude en direct d'Apple Newsroom et du Now de Linear —
plus de pavé arrondi) : texte encre sur fond de page à gauche, matière
visuelle à droite ; les histoires sans image portent des **dessins
génératifs tirés de nos données** (duel en barres dessinées, percée en
trait qui monte, gros contrat en chiffre géant, mouvement en étincelle
réelle, constellation seedée pour les news sans visuel) ; la bande est
un **rail scroll-snap au geste exact des decks d'Angles** (swipe,
flèches, points, clavier), cadence de vrai carrousel (3,8 s), le filet
bas devient la barre de progression, et la section se révèle au scroll.
Recette v6 (2026-08-03) : la barre gelée au milieu — troisième membre
de la famille fantôme — tuée (seul le focus CLAVIER retient le
carrousel ; le pointermove synthétique post-scroll de Chrome ne compte
plus) ; et **toutes les barres proposent des destinations** en cours de
frappe (« Safran → la fiche organisation », « Allemagne → le pays »),
l'intelligence de la palette ⌘K extraite en module partagé et servie
par la palette, les barres composables (groupe « Aller à », le Entrée
validé inchangé) et la demande de l'accueil ; « + Ajouter au dossier »
posé sur les fiches organisation, pays et le benchmark (chaque fiche
verse sa vue signature comme bloc vivant de l'Explorateur).

## EN COURS — extension des sources, vague 1 (exécution ouverte)

**Plan validé le 2026-08-03** avec un amendement d'ordre fondatrice
(les premiers clients sont européens) :
[vague-1-instruction.md](vague-1-instruction.md) — socle identité
d'abord (**en cours**), puis NIH → NSF → **UKRI → SNSF → NWO →
Vinnova** → SBIR → USAspending (glisse en fin de vague s'il pèse) →
Grants.gov → OpenAIRE. Fondations déjà en place : le modèle `funders`
multi-juridictions/multi-devises prévu dès la phase 1.

Points d'attention connus :
- normalisation des montants (devises, années fiscales US/UK) ;
- **provenance par champ et conflits exposés** (jamais écrasés en
  silence) — principe adopté de la spec externe, critique dès que les
  sources se multiplient ; pointeurs d'API US/UK (Grants.gov, NIH, NSF,
  SBIR, USAspending, UKRI) versés au dossier d'instruction ;
- dédoublonnage inter-sources des organisations (les garde-fous
  identifiants existants s'appliquent) ;
- couverture géographique du globe/carte à étendre au-delà de l'Europe
  (la note d'honnêteté sur la couverture reste de mise) ;
- **flux longue distance sur le globe** : passer les lignes de la
  constellation en géodésiques projetées (les cordes d'écran actuelles ne
  tiennent pas visuellement au transatlantique) ;
- **la couche groupes** (leçon U5 de Vega ; cadrée le 2026-08-03 par les
  conclusions de la grande recherche) : cahier des charges complet dans
  [groupes-couche.md](groupes-couche.md) — canonical layering (tables
  `groups` + `entity_group_map`, JV pondérées marquées, jamais de
  fusion), sources retenues (GLEIF Golden Copy L1/L2/exceptions avec la
  lucidité des ~4 %, Wikidata, ponts SIREN↔LEI↔PIC ; vague B : EDGAR
  Exhibit 21, Companies House PSC, Splink), **registre des sources
  interdites** (OpenCorporates, D&B/Orbis/Capital IQ, PermID
  hiérarchies, Crunchbase), curation manuelle assistée des 100-200 plus
  gros groupes, trois vagues A/B/C, et la vision fondatrice de la fiche
  groupe (vue consolidée + carte monde des entités cliquable par entité
  ou continent + mini-map monde tournante en instrument de bord).
  **Conséquence sur le séquencement : la vague 1 s'ouvre par le socle
  identité** (tables groupes + GLEIF + ponts) avant les chargeurs US/UK ;
  EDGAR/PSC attendent leurs sources ; la curation court en continu dès le
  socle ; la fiche groupe jalonne la fin de vague A ;
- **grandes régions « manager »** (décision fondatrice 2026-08-02) : dès
  les sources mondiales, le globe et l'analyse doivent aussi raisonner en
  régions parlantes — Europe, Amérique du Nord, Asie… — comme dimension
  d'agrégation (Explorateur, benchmark, panneaux du globe). Spécification
  couleur retenue : **une teinte par région** (candidates : les six séries
  validées — Europe outremer, Amérique du Nord ochre, Asie teal…),
  l'**intensité continuant d'encoder le montant** dans chaque teinte, et le
  **pays sélectionné à l'encre** — hors de toute teinte de région, déjà en
  place sur le globe depuis 2026-08-02. Toute déclinaison passe au
  validateur de palette avant adoption.

## Puis — phase 5 : les appels (calls)

Cahier des charges enrichi par l'[analyse fonctionnelle de la concurrence]
(analyse-fonctionnelle-concurrence.md) (2026-08-02, à valider) : catalogue
filtrable + matching par description libre avec % de correspondance + test
d'éligibilité rapide + alertes deadlines — les standards du marché — PLUS
nos twists uniques : **alertes sur le passé** (un concurrent gagne un
projet sur mon thème), pont « qui a gagné les calls similaires », et
découverte de partenaires data-driven. Règles adoptées de la
[spec externe](lecons-spec-externe.md) : le **score de correspondance
toujours décomposé** (jamais un chiffre unique), un critère inconnu
n'est jamais traité comme incompatible, l'exclusion dure se fait avant
le classement. Prérequis : la couche groupes
(on s'abonne à « Thales », pas à 12 entités légales) — **différenciateur
frontal confirmé sur pièces** : KAILA fait regrouper 21 entités à la main
(Merge/Cross) à chaque session ; notre couche automatique le rend caduc.

**Hors périmètre assumé** (décision à confirmer) : rédaction IA de
candidatures et gestion post-award (le métier de Granter/Streamlyne — 
l'exécution) ; Orion reste l'intelligence.

Horizon Europe + ANR ouverts, reliés aux tendances (la promesse tenue par
la note « Phase 5 · automne 2026 » sur l'accueil). Navigation passé/futur
(vision §9 du [document d'architecture](architecture-information.md)).

## Horizon — phase 6

Périmètre étendu par l'analyse concurrence (à valider) : + partage
d'équipe (vues partagées, digest d'espace — l'acheteur redistribue),
+ API publique produit (l'OpenAPI interne, avec clés et quotas),
+ essai self-serve / tier gratuit borné (décision de modèle).

Dashboard configurable par persona ; homepage vitrine (le globe d'accueil
de 3 bis en est la première pierre). Voir [phase-6-notes.md](phase-6-notes.md).

## Prérequis go-live (rappel bloquant)

La revue juridique ODbL (ANR) reste un prérequis de mise en production
commerciale — voir [data-sources.md](data-sources.md).
