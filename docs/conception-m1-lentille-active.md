# Conception M1 — la lentille active (arbitrages TRANCHÉS le 2026-08-18)

*2026-08-18 — cadre : rendre la lentille active **générique** (servie
par le registre, plus un seul « space » en dur au front) et
**explicite** (nommée à l'écran) sur les surfaces existantes, avec
**Space seule lentille publiée**. Aucun Aviation, aucune Lens Room,
aucune intersection. Les invariants I1-I4 de la
[conception mère](conception-multi-lentilles.md) s'appliquent en
entier.*

---

## 1. La notion centrale — « la lentille active »

Une vue a **zéro ou une** lentille active (D3), résolue de l'URL seule.
Deux points d'accès uniques, un par côté (I1) :

- **Front : `useActiveLens()`** — LE seul module qui lit et écrit le
  paramètre. Il résout `{slug, coreOnly, meta}`, où `meta` vient de
  `stats.lenses` (publiées seulement, ordre de rang). Le nom du
  paramètre (`sector` aujourd'hui, `lens` demain) vit dans ce module et
  nulle part ailleurs — le basculement I1 sera un diff d'une ligne plus
  une normalisation d'URL, jamais une chasse.
- **Back : `parse_sector` / `valid_sector`** — déjà en place depuis M0.

Les **mots** d'une lentille vivent en i18n sous `lens.<slug>.*` (name,
direct, enabling, la phrase du hero, la porte). Pour `space`, les
libellés **validés du chantier Space natif font foi, verbatim** :
« Spatial direct », « Spatial + habilitant », le hero qui dit
« direct + habilitant » dans la phrase même. Aucun troisième terme (I3).

## 2. Les lots

### M1.0 — le vocabulaire technique s'aligne (I3, un seul geste)

`adjacent → enabling` partout où le terme est technique, en un commit :
la valeur en base (migration 0025 : `UPDATE` + contrainte CHECK), la
colonne `tag` de `lenses/space.csv`, le chargeur (`TAGS`), la clé de
payload (`stats.lenses[].enabling`, alias `space` compris), les clés de
journal (`space_enabling`), les tests. Interdit en deux temps :
renommer la base sans le payload créerait un troisième état
(home.tsx:262 lit `stats.space.adjacent`).

**Les LIBELLÉS utilisateur ne bougent pas d'un pixel** — « Spatial
direct », « Spatial + habilitant », « direct + habilitant » : verbatim
Space natif. Mais deux textes utilisateur **nommaient le tag
technique** et deviendraient faux le jour du renommage — ils partent
donc dans le même geste (relevé sur pièce, sinon troisième terme
visible, ce qu'I3 interdit) :

- le **hint** du chip, `explorer.sector.enablingHint` (EN + FR) : la
  glose « (adjacent) » perd son objet — le tag S'APPELLE désormais
  `enabling`, que le hint dit déjà en toutes lettres (« technologies
  habilitantes ») ; la parenthèse disparaît, le hint devient exact ;
- l'**À-propos**, « les technologies habilitantes taguées adjacentes » :
  décrit la donnée, donc devient factuellement faux — le tag s'y nomme
  désormais `enabling` (règle maison : une promesse affichée reste vraie
  le jour où la donnée change).

Ne sont PAS touchés les emplois anglais sans rapport (`explore-view`,
`partner-graph` : la diapo adjacente, la liste adjacente).

### M1.1 — le socle générique (rendu strictement identique)

- `useActiveLens()` + bascule du front sur `stats.lenses` (l'alias
  `space` reste servi jusqu'à M1.3 — le lot est réversible).
- **SectorChip** servi par le registre : les valeurs viennent de
  `stats.lenses`, les libellés de `lens.<slug>.*` — le composant ne
  connaît plus « space ». Menu à deux entrées par lentille publiée +
  « Toute la R&D » ; à une seule lentille publiée, le menu est
  visuellement IDENTIQUE à aujourd'hui.
- **Dossier** : la phrase de cadrage (`dossier.tsx:36`) devient
  générique — le ternaire « space » disparaît, le rendu pour space ne
  change pas.
- **Decks** : `stories.ts` passe de `space: true` à `lens: "space"` ;
  la section d'analyses se généralise (une section par lentille publiée
  qui a des decks, ordre de rang — « Espace » aujourd'hui, identique).

### M1.2 — le refus unifié (arbitrage 3, tranché)

**Un `sector` invalide qui retombe en silence sur 700 000 projets est
un lien qui ment** — U2 l'interdit. Règle UNIQUE sur toutes les
surfaces qui comprennent `sector`, dès M1 (et non au basculement
`lens=`) :

| Cas | Comportement |
|---|---|
| Valeur **publiée** | Vue cadrée (inchangé) |
| Paramètre **absent** | Vue non cadrée (inchangé) |
| Valeur **inconnue, draft ou retirée** | **Erreur explicite** — jamais de repli silencieux |

Côté **API** : `400` (aujourd'hui l'Explorateur renvoie son refus
autrement et la recherche ignore en silence — les deux s'alignent).
Côté **front** : page douce — « Cette lentille n'est pas disponible —
Orion ne peut pas reproduire cette vue », avec la porte vers la vue non
cadrée. Le front décide sur le registre publié qu'il a déjà
(`stats.lenses`), donc il dit la même chose que l'API.

Surfaces concernées : `/explore` (angles de decks compris — ce sont des
URL d'Explorateur), `/projects`. Nouveaux e2e pour ce comportement ;
les 71 existants restent verts sans modification.

### M1.3 — les surfaces, une à une

| Surface | Ce qui change | Ce qui ne change pas |
|---|---|---|
| **Accueil** | Le hero lit **le rang 1 publié** de `stats.lenses` (compteurs, constellation, porte — par `lens.<slug>.*`) ; les **lignes verticales** des autres lentilles publiées s'insèrent au-dessus de la ligne corpus (aucune aujourd'hui → invisible) | Le rendu actuel, pixel pour pixel ; le jeton de marque (D5) ; la ligne corpus |
| **Explorateur / Recherche** | Rien de plus que M1.1 (chip générique) | Placement, gestes, grammaire |
| **Fiche projet** | **Badges de lentille** — « Spatial · cœur », « Spatial · habilitant » : LA surface du chevauchement (D3.4, aujourd'hui inexistante). L'API projet expose `lens_tags: [{lens, tag}]`, lentilles publiées seulement | Tout le reste de la fiche |
| **Fiches org / groupe / pays** | **Rien en M1** — frontière déclarée : le cadrage vit où la grammaire vit (Explorateur, recherche, decks). Étendre `sector` aux hubs est consigné comme évolution, pas décidé ici | Tout |
| **Dossier** | La phrase générique (M1.1) ; les dossiers sauvegardés `sector=space` restent vrais (D2) | Blocs, gestes |
| **Partage** | Aucune mécanique nouvelle — **l'URL est le partage**. Critère de recette : tout lien copié d'une vue cadrée reproduit exactement le périmètre à l'ouverture | Les gestes de copie/collecte existants |
| **À-propos** | La section « La lentille spatiale » devient **un bloc méthode par lentille publiée** (le texte spatial actuel, verbatim, devient le bloc `space`) ; le **recouvrement chiffré** (« X projets portent deux lentilles », via `stats.overlap_projects`) n'apparaît qu'à **≥ 2 publiées** — jamais un compteur à zéro fictif | Licences, sources, la promesse d'honnêteté |
| **Header / contexte** | **Rien au header** (arbitrage 1) — mais le **titre du document devient dynamique** : `[Lentille] · [Vue] — Orion` sur une vue cadrée, `[Vue] — Orion` hors lentille. Le mécanisme de métadonnées **reçoit la lentille active** (il est statique aujourd'hui, `index.html:8`) | Le jeton « Orion Space Intelligence » (D5) ; **aucune image OG dynamique** dans ce chantier |
| **Stats** | `overlap_projects` ajouté ; puis M1.4 | La forme du bloc `lenses` |

### M1.4 — la dépose de l'alias

`stats.space` retiré du payload ; `Stats` (types front), home, mocks de
tests suivent. Témoins API avant/après : la différence exacte est
`{ space absent, adjacent→enabling }`, rien d'autre.

## 3. Les invariants d'URL

- **U1 — le paramètre.** M1 émet `sector=` partout, comme aujourd'hui —
  **rien ne migre** (I1). Toute lecture/écriture passe par
  `useActiveLens()`. `lens=` est la cible consignée ; son jour venu, la
  bascule normalisera les anciennes URL — un chantier propre et daté.
- **U2 — la reproductibilité.** Toute vue cadrée porte son périmètre
  dans l'adresse ; un lien partagé reproduit exactement la vue. Le chip
  suit l'URL, jamais l'inverse.
- **U3 — les valeurs.** `<slug>` (cœur + habilitant) et `<slug>-direct`
  (cœur seul), lentilles **publiées** seulement (I2). Inconnu, draft ou
  retiré : **refus explicite partout** (M1.2) — 400 côté API, page
  douce côté front. Jamais de repli silencieux : un lien qui retombe
  sur le corpus entier ment sur ce qu'il montre.
- **U4 — le silence.** L'état non cadré n'écrit rien dans l'URL ; le
  chip disparaît. Jamais un `sector=` vide, jamais un cadrage muet.
- **U5 — une seule lentille par vue.** Le paramètre est scalaire ;
  aucune liste, aucun opérateur (amendement M0 n° 2).

## 4. Les arbitrages — TRANCHÉS le 2026-08-18

- **A — Header / contexte : RIEN au header.** « ORION / SPACE » reste
  conditionné à A1 (D5 amendée). En revanche le **titre du document
  devient dynamique** — `[Lentille] · [Vue] — Orion` sur une vue
  cadrée, `[Vue] — Orion` hors lentille — et le **mécanisme de
  métadonnées reçoit la lentille active**. Pas d'image OG dynamique
  dans ce chantier. Exécution : M1.3.
- **B — la lentille de graine : VALIDÉE, mais SYNTHÉTIQUE.** Son nom
  est neutre — `test-lens` ou équivalent, **jamais `aviation`** : aucune
  hypothèse métier sur la vraie lentille à venir. Elle n'existe que
  dans la graine e2e, **jamais dans `curation/`** — c'est le motif
  ORBITGUARD (une donnée inventée vit dans la graine, jamais dans le
  registre de production). Une **assertion garantit qu'elle ne peut pas
  être produite par le registre de production** : un test lit
  `curation/lenses/registry.csv` et échoue si un slug de graine y
  apparaît. Exécution : M1.3 (elle sert la recette des surfaces
  multi-lentilles).
- **C — le refus : UNIFIÉ dès M1**, pas au basculement `lens=`. C'est
  le lot M1.2 ci-dessus. Motif fondateur : *un `sector` invalide qui
  retombe en silence sur 700 000 projets est un lien qui ment* — U2
  l'exige.

**I3 confirmé, sans amendement** : stockage canonique `core`/`enabling`,
libellés utilisateur « direct / + habilitant » dans `lens.<slug>.*`,
verbatim Space natif. La variante « Cœur / Cœur + technologies
habilitantes » est **écartée** — les libellés sont recettés, enseignés
par le deck 2, assertés par les e2e, et la généricité est déjà servie
par les clés i18n par lentille.

## 5. La recette M1 — lot par lot (arrêt et recette entre chaque)

**Invariant de tous les lots** : les **71 e2e existants verts sans
modification** — ni assertion retouchée, ni test supprimé, ni couverture
affaiblie. Générique ne veut pas dire différent.

**M1.0 — le vocabulaire.** Témoins API avant/après dont la **seule**
différence est `adjacent → enabling` (clé du bloc `lenses` et de l'alias
`space`) ; tout le reste à l'octet. Le hint du chip et la phrase de
l'À-propos ne nomment plus un tag qui n'existe pas ; les libellés
« Spatial direct » / « Spatial + habilitant » sont intacts — les e2e
existants, qui les assertent, en sont la preuve. Chargeur rejoué en
prod : mêmes comptes qu'avant, sous le nouveau nom.

**M1.1 — le socle.** Rendu strictement identique à une lentille
publiée : le chip, le dossier, la section « Espace » des analyses ne
changent pas d'un pixel alors que plus rien n'est en dur. Preuve
négative : `grep` de `"space"` dans les composants génériques revient
vide.

**M1.2 — le refus.** Nouveaux e2e : `?sector=zzz`, `?sector=<draft>` et
`?sector=<retired>` donnent la page douce sur `/explore` **et**
`/projects` (jamais le corpus entier en silence) ; l'API répond `400` ;
`?sector=space` et l'absence de paramètre sont inchangés.

**M1.3 — les surfaces.** Titre de document : `Spatial · Explorateur —
Orion` sur une vue cadrée, `Explorateur — Orion` sans lentille.
Généricité prouvée par la lentille de graine synthétique : deux groupes
au menu du chip, ligne verticale sur la home, badges des deux mondes
sur un projet partagé — **et l'assertion qu'aucun slug de graine ne
peut venir du registre de production**. Chevauchement visible :
ORBITGUARD porte « Spatial · cœur » ; un projet hors lentille n'affiche
rien. À-propos : blocs méthode par lentille publiée, recouvrement
chiffré seulement à ≥ 2 publiées.

**M1.4 — l'alias.** Témoins API : différence exactement
`{ space absent }`.

**À chaque lot** : pytest, vitest, lint, CI verte avec lien, prod
reconstruite au tampon, puis recette fondatrice.

## 6. Ce que M1 ne fait pas

Aucun `lens=` émis (I1) ; aucun cadrage sur les fiches org/groupe/pays
(consigné) ; **aucune Aviation, aucune règle aéro, aucun nom de
verticale future** — la lentille de recette est synthétique ; aucune
Lens Room ; aucune intersection (grammaire scalaire, U5) ; aucune image
OG dynamique ; le jeton de marque intact (D5) ; la DA intacte — le
chip, les badges et les lignes verticales réutilisent les composants et
tokens existants.
