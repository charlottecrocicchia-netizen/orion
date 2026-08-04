# Roadmap d'exécution

> Fil de pilotage tenu à jour à chaque validation de la fondatrice.
> Règle inchangée : chaque chantier est proposé, validé, puis exécuté.

## ✅ CHANTIER UI — CLOS (v0.4.0, 2026-08-03)

**État final : toutes les recettes fondatrice de la vague sont validées
— navigation par intentions, doctrine appliquée partout, recherche
composable aux destinations partagées, dossier remplissable, une
Actualités au geste des decks (gel Firefox clos sur sa console), fiche
organisation en actes. Reste ouvert hors UI : les chantiers datés
P5/P6 (le prérequis juridique ODbL a disparu avec le retrait de
l'ANR, 2026-08-03).**

## Clos avec v0.4.0 — le chantier design (doctrine, étapes validées une à une)

Référence : [design-doctrine.md](design-doctrine.md).

| Étape | Contenu | Statut |
| --- | --- | --- |
| 1 — Fondations | Tokens typographiques, tabular figures globales, encre/hairlines/une ombre, Geist Mono, StatHero | **Validée** (2026-08-02) |
| 2 — Hero signature | Accueil en actes, hero piné GSAP (scrub), trois entrées éditoriales, footer parchemin | **Validée** (2026-08-02) |
| 3 — Explorateur & listes | Grilles type Attio/Linear, filtres Polaris, sparklines, hover réels ; lien vers la source d'origine sur chaque fiche projet | **Validée** (2026-08-02) |
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
éditoriales, instituts en liste dense filtrable — plus de cartouches).

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
le relais /api/news (flux Commission DG R&I ; CORDIS sans RSS public
— repli élégant, cache 30 min,
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

## ✅ CLOS — le chantier performance (2026-08-03)

Décision fondatrice du 2026-08-03 : le goulot des facettes s'instruit
proprement avant toute nouvelle source. **Instruction livrée :**
[chantier-performance.md](chantier-performance.md) — diagnostic mesuré
pièce à pièce (le mur est la lecture du heap de project_texts, pas
ts_rank ; stats absentes sur la table de correspondances ; cinq re-scans
par requête ; tri de page 100× trop cher ; EXISTS pays 10× la jointure ;
invalidation de cache trop brutale), quatre options comparées au prix
honnête, cible 300 ms avec preuve au corpus ×3, banc + garde-fou CI +
relevé par chargeur. **Exécuté le jour même, résultats en fin de
document.** Les six parcours clés tiennent leur budget au corpus actuel
(recherche 2 221 → 303 ms, filtre pays 7 995 → 245 ms, carte 3 847 → 19
ms au pire). **Mais la preuve d'échelle dément la promesse de tenue au
triplement** : au corpus doublé les temps explosent (recherche 10 120
ms), parce que le facteur dominant n'est pas l'algorithmique mais la
MÉMOIRE. D'où une décision produit chiffrée à porter au budget
d'hébergement : 8 Go aujourd'hui, 16 Go au doublement, **24 à 32 Go pour
le corpus attendu en fin de vague 1**. Le spike condensé, validé sur
critère, a été retiré : il tenait en isolation et dégradait le système.

## EN COURS — extension des sources, vague 1 (exécution ouverte)

**Plan validé le 2026-08-03** avec un amendement d'ordre fondatrice
(les premiers clients sont européens) :
[vague-1-instruction.md](vague-1-instruction.md) — socle identité
(**livré**), puis NIH (**livré**) → NSF (**livré**) → **UKRI → SNSF →
NWO → Vinnova** → SBIR → USAspending (glisse en fin de vague s'il pèse)
→ Grants.gov → OpenAIRE. Fondations déjà en place : le modèle `funders`
multi-juridictions/multi-devises prévu dès la phase 1.

**Acquis de l'étape 2 (NSF, 2026-08-03)** : 235 071 projets, 118,8 Md€,
et surtout **la première collaboration américaine visible** — l'extension
nommée « fratries NSF » du [registre](data-sources.md) reconstitue
17 523 projets multi-établissements à partir de 42 240 financements
séparés, sous quatre gardes mesurées. Pont d'identité américain ouvert
au passage (7 495 UEI, 804 liens filiale→mère) pour la vague groupes.
**⚠️ Ce que NSF a rendu urgent, et qui passe avant UKRI :** la ligne de
perfs constatées ([registre](data-sources.md)) montre que **le budget de
300 ms est rompu** sur la recherche et le filtre pays à 699 798 projets.
La cause est celle qu'annonçait la preuve d'échelle — la mémoire, pas
l'algorithmique — et la règle de dimensionnement écrite à la clôture du
chantier performance **est atteinte, pas anticipée**. Décision de
dimensionnement à prendre (RAM de la VM locale et du futur VPS) avant
d'ajouter une source de plus.

**Puis, séquencement fondatrice du 2026-08-04 : PAUSE CHARGEMENTS** —
des tests utilisateurs réels sur le site, retouches de navigation selon
leurs retours, et seulement ensuite UKRI (première source non américaine
et non euro — GBP, année fiscale avril→mars, licence OGL à re-vérifier
le jour du chargement), puis SNSF, NWO, Vinnova, SBIR. USAspending et
OpenAIRE attendent le serveur ([hebergement.md](hebergement.md)).

**Écart constaté au passage (2026-08-03)** : la **couche identité n'a
jamais été chargée en prod** — `lei_records` y est vide, les métriques
groupes de l'étape 0 sont celles du dev. À corriger par un run
`gleif wikidata groups` en prod, dont le coût disque est à vérifier
d'abord (le miroir GLEIF pèse plusieurs Go).

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
- **grandes régions « manager »** (décision fondatrice 2026-08-02 ;
  **chantier EXÉCUTÉ le 2026-08-04** — conception validée 5/5 puis les
  quatre lots livrés le jour même :
  [chantier-regions-manager.md](chantier-regions-manager.md). A : le
  référentiel complet des cinq régions (249 codes, l'Antarctique seule
  exception écrite, les 27 orphelins rattachés), régions sur l'API,
  agrégats testés à l'égalité. B : le monde entier vivant — 174
  polygones + 75 pastilles de micro-territoires (Malte n'avait JAMAIS
  été affichée : pas de polygone dans le 110m), le globe de l'accueil
  aux teintes de régions, la règle « tout pays du corpus est cliquable,
  le gris est réservé à l'absence de donnée » gravée dans un test qui
  dérive du corpus semé (US, IL, MT). C : `?scope=` porté par l'URL
  (chips page pays, cadres par région, prêt pour les abonnements par
  zone), dimension « région » dans l'Explorateur (donut aux teintes de
  régions par clé), comparaison de régions, recherche cadrée. D : la
  passe « le site dit vrai » (couverture Europe-CORDIS · États-Unis
  NIH+NSF, à venir UKRI/SNSF/NWO/Vinnova — le Japon et « en
  préparation » ont disparu). 49 parcours e2e verts, Firefox compris.
  **Recette fondatrice en cours sur site.** Détail des décisions : dès
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

Horizon Europe et les appels internationaux ouverts, reliés aux tendances (la promesse tenue par
la note « Phase 5 · automne 2026 » sur l'accueil). Navigation passé/futur
(vision §9 du [document d'architecture](architecture-information.md)).

## Horizon — phase 6

Périmètre étendu par l'analyse concurrence (à valider) : + partage
d'équipe (vues partagées, digest d'espace — l'acheteur redistribue),
+ API publique produit (l'OpenAPI interne, avec clés et quotas),
+ essai self-serve / tier gratuit borné (décision de modèle).

Dashboard configurable par persona ; homepage vitrine (le globe d'accueil
de 3 bis en est la première pierre). Voir [phase-6-notes.md](phase-6-notes.md).

## Prérequis go-live

**Réglé le 2026-08-03 par suppression** : la revue juridique ODbL n'a
plus d'objet — **l'ANR est sortie d'Orion définitivement** (décision
fondatrice : marché cible international, aucune source ne vaut un risque
juridique). La **règle de licence** qui en découle est gravée au
[registre](data-sources.md) : n'entrent que domaine public, CC0, CC-BY,
Licence Ouverte, OGL ou équivalent limpide ; tout partage à l'identique
et toute zone grise sont un critère d'exclusion définitif. Aucun
prérequis juridique ne bloque plus la mise en production.
