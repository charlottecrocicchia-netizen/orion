# Conception M1 — la lentille active (À VALIDER, aucun code écrit)

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
journal (`space_enabling`), les tests. Les mots utilisateur ne bougent
pas d'un pixel — « + habilitant » était déjà le bon mot. Interdit en
deux temps : renommer la base sans le payload créerait un troisième
état (home.tsx:262 lit `stats.space.adjacent`).

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

### M1.2 — les surfaces, une à une

| Surface | Ce qui change | Ce qui ne change pas |
|---|---|---|
| **Accueil** | Le hero lit **le rang 1 publié** de `stats.lenses` (compteurs, constellation, porte — par `lens.<slug>.*`) ; les **lignes verticales** des autres lentilles publiées s'insèrent au-dessus de la ligne corpus (aucune aujourd'hui → invisible) | Le rendu actuel, pixel pour pixel ; le jeton de marque (D5) ; la ligne corpus |
| **Explorateur / Recherche** | Rien de plus que M1.1 (chip générique) | Placement, gestes, grammaire |
| **Fiche projet** | **Badges de lentille** — « Spatial · cœur », « Spatial · habilitant » : LA surface du chevauchement (D3.4, aujourd'hui inexistante). L'API projet expose `lens_tags: [{lens, tag}]`, lentilles publiées seulement | Tout le reste de la fiche |
| **Fiches org / groupe / pays** | **Rien en M1** — frontière déclarée : le cadrage vit où la grammaire vit (Explorateur, recherche, decks). Étendre `sector` aux hubs est consigné comme évolution, pas décidé ici | Tout |
| **Dossier** | La phrase générique (M1.1) ; les dossiers sauvegardés `sector=space` restent vrais (D2) | Blocs, gestes |
| **Partage** | Aucune mécanique nouvelle — **l'URL est le partage**. Critère de recette : tout lien copié d'une vue cadrée reproduit exactement le périmètre à l'ouverture | Les gestes de copie/collecte existants |
| **À-propos** | La section « La lentille spatiale » devient **un bloc méthode par lentille publiée** (le texte spatial actuel, verbatim, devient le bloc `space`) ; le **recouvrement chiffré** (« X projets portent deux lentilles », via `stats.overlap_projects`) n'apparaît qu'à **≥ 2 publiées** — jamais un compteur à zéro fictif | Licences, sources, la promesse d'honnêteté |
| **Header / contexte** | **Arbitrage ouvert** (§ 4.A) — recommandation : rien | Le jeton « Orion Space Intelligence » (D5) |
| **Stats** | `overlap_projects` ajouté ; puis M1.3 | La forme du bloc `lenses` |

### M1.3 — la dépose de l'alias

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
  retiré : l'Explorateur refuse (comportement M0 conservé) ; la
  recherche ignore le cadrage en silence — **aspérité historique
  conservée en M1**, consignée pour être unifiée au basculement `lens=`
  (§ 4.C).
- **U4 — le silence.** L'état non cadré n'écrit rien dans l'URL ; le
  chip disparaît. Jamais un `sector=` vide, jamais un cadrage muet.
- **U5 — une seule lentille par vue.** Le paramètre est scalaire ;
  aucune liste, aucun opérateur (amendement M0 n° 2).

## 4. Les arbitrages ouverts — à trancher avant exécution

- **A — Header / contexte.** Recommandation : **rien au header en M1**.
  Le chip par vue est LA vérité unique — un badge d'application
  dupliquerait l'état, et l'identité de contexte « ORION / SPACE » est
  actée pour la bascule de marque post-A1 (D5 amendée), pas pour M1.
  Option légère si tu la veux : le **titre du document** (onglet,
  favoris, partage) dit le contexte sur les vues cadrées — « Orion —
  Spatial » ; mécanisme neuf (le titre est statique aujourd'hui,
  `index.html:8`), une trentaine de lignes. Sinon : consigné avec la
  bascule ORION / SPACE.
- **B — la lentille de graine.** Pour PROUVER la généricité sans
  Aviation, la recette a besoin d'une deuxième lentille publiée quelque
  part : je propose une lentille **de graine e2e uniquement**
  (`seed_e2e`, comme ORBITGUARD est un projet inventé — la graine est
  fictive par nature et ne touche ni `curation/` ni la prod). Elle fait
  apparaître dans les tests : deux groupes au menu du chip, la ligne
  verticale de la home, les badges multiples sur un projet des deux
  mondes. Sans elle, ces surfaces ne seraient recettées qu'à A1. À
  valider explicitement au regard de « aucune lentille fictive » —
  l'amendement visait le REGISTRE produit, la graine est un banc
  d'essai.
- **C — le refus en recherche.** Unifier « valeur inconnue → refus
  explicite » (comme l'Explorateur) plutôt que le silence actuel de la
  recherche : je propose de le CONSIGNER au basculement `lens=` (pas de
  changement de comportement en M1, loi du chantier).

## 5. La recette M1

1. **Les 71 e2e existants, verts sans modification** — la loi de M0
   continue : générique ne veut pas dire différent.
2. **La non-régression des mots** : les e2e existants assertent déjà
   les libellés validés (« Spatial + habilitant », « Spatial direct »,
   /direct \+ habilitant/) — ils recettent donc `lens.space.*` par
   eux-mêmes.
3. **La généricité prouvée** (si B validé) : nouveaux e2e — deux
   lentilles publiées en graine ⇒ deux groupes au chip, ligne
   verticale home, badges des deux mondes sur un projet partagé ;
   la lentille draft de graine n'apparaît NULLE part.
4. **Le chevauchement visible** : ORBITGUARD porte « Spatial · cœur »
   sur sa fiche ; un projet hors lentille n'affiche rien.
5. **Les témoins API** avant/après M1.3 : différence exactement
   `{ space absent, adjacent→enabling }` — le reste à l'octet.
6. **Vitest, lint, CI verts** ; prod reconstruite au tampon, recette
   fondatrice sur les six surfaces (home, Explorateur, recherche,
   fiche projet, dossier, À-propos).

## 6. Ce que M1 ne fait pas

Aucun `lens=` émis (I1) ; aucun cadrage sur les fiches org/groupe/pays
(consigné) ; aucune Aviation, aucune règle aéro ; aucune Lens Room ;
aucune intersection (grammaire scalaire, U5) ; le jeton de marque
intact (D5) ; la DA intacte — le chip, les badges et les lignes
verticales réutilisent les composants et tokens existants.
