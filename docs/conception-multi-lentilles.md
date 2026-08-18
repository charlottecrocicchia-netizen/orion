# Conception — le multi-lentilles (VALIDÉE le 2026-08-17)

> **Validation fondatrice** : D1, D2, D3, D4, D6 telles quelles ; D5
> amendée ; deux amendements M0 ; M0 seul lancé (M1 sur validation
> explicite). Détail en fin de document. La vision design future vit
> dans [vision-lens-room.md](vision-lens-room.md) — un document de
> VISION : rien ne s'en développe avant A1.

*2026-08-17 — cadre fondateur : le spatial est la **première** verticale
d'Orion, pas la seule ; l'aéronautique est décidée deuxième (Clean Sky,
Clean Aviation, SESAR vivent déjà dans CORDIS ; la curation de groupes
couvre nativement les deux mondes). Le corpus ne change pas : une
lentille est un jeu de règles versionnées qui pose un tag, comme les 23
règles spatiales. **Aucune règle aéro ne s'écrit dans ce chantier** —
la généralisation du mécanisme d'abord, la curation aéro ensuite, avec
son propre travail.*

---

## 1. L'inventaire honnête — relevé sur pièce, pas récité

Le verdict d'ensemble : **le mécanisme est générique aux neuf dixièmes ;
le verrou structurel est la colonne.** `projects.space_tag` ne sait
porter qu'une lentille — un projet ne peut pas être spatial ET aéro
tant que le tag est une colonne.

| Surface | Générique | « Space » en dur | Sort |
|---|---|---|---|
| **Chargeur** `ingest/space_lens.py` | Presque tout : 3 familles de règles (programme en sous-arbre, thème par préfixe, texte cadré par source), validation tout-ou-rien sur la forme, résolution souple sur le corpus, core bat adjacent **structurellement**, retag total à chaque run | La colonne cible (l. 107-122), le fichier `space-lens.csv` (l. 38), le nom de run `space-lens` (l. 37) | **M0** : `lens_loader(slug)` — mêmes familles, mêmes validations, retag par lentille. `TEXT_SOURCES` reste global : c'est la liste des sources du corpus, pas un trait de la lentille |
| **Stockage** `models/projects.py:52` | Rien — une colonne `String(8)` = une seule lentille, deux tags impossibles | Tout | **M0** : la table `project_lens_tags` (§ 2) |
| **Filtres** `search/service.py:224-227`, `search/explore.py:603-610` | Le mécanisme entier : paramètre `sector` → clause SQL, `patch()` qui le transporte, `resolveView` | Les valeurs `"space"`/`"space-direct"` codées (`explore.py:432`, `api/search.py:44`, `api/explore.py:37` + descriptions API) | **M0** : validation par le registre, clauses `EXISTS` sur la table |
| **Compteurs** `/api/stats` (`aggregates.py:28-64`) | La forme du bloc — core, adjacent, funding, organisations, groupes, by_year — est le contrat générique d'une verticale | Les clés `space_*` et le bloc `space` | **M0** : bloc `lenses` en ordre de rang ; l'alias `space` survit jusqu'à M1 (le front ne bouge pas en M0) |
| **Chip** `sector-chip.tsx` | Le composant : menu radio, l'URL seule vérité, le silence = non cadré | `SECTOR_VALUES` et les libellés `explorer.sector.*` | **M1** : valeurs servies par l'API, libellés `lens.<slug>.*` |
| **Hero** `home.tsx` | La mécanique (StatHero, constellation, portes, ligne corpus) | La branche `spaceHero`, les clés `hero.spaceProjects/spaceOrgs/spaceGroups/subSpace`, la porte `spaceCta` | **M1** : le hero lit le rang 1 du registre (il reste spatial) ; les autres verticales en lignes (§ 4) |
| **Decks** `stories.ts` | Le mécanisme deck entier — un deck n'est que des URL | Le drapeau `space: true` — un booléen là où il faut un slug | **M1** : `lens?: string` |
| **Analyses** `analyses.tsx` | Les sections | La section unique « Espace » (`analyses.spaceTitle`) | **M1** : une section par lentille à decks, ordre du registre ; généralistes toujours dessous |
| **À-propos** `about-data.tsx` | — | La section « La lentille spatiale », texte en dur | **M1** : un bloc méthode par lentille + le recouvrement chiffré (§ 5) |
| **Dossier** `dossier.tsx:36` | La phrase de cadrage | Le ternaire `sector === "space" ? enabling : direct` | **M1** : suit les libellés par lentille |
| **Fiche projet** `project-detail.tsx` | — | **Relevé : zéro occurrence — le tag n'est affiché nulle part par projet.** Le chevauchement n'a pas encore de surface | **M1** : badges de lentille (§ 5) |
| **i18n** | La marque « Orion Space Intelligence » ne vit **que** dans i18n — déjà un jeton | 40 occurrences `space` | **M1** : réorganisation en `lens.<slug>.*` |
| **e2e** `space.spec.ts` | — | En dur à bon droit : c'est la recette de la verticale | **M0 n'y touche pas** — sa verdure inchangée EST la recette de M0 |

## 2. La lentille, objet de première classe

**Le stockage.** Une table à la place de la colonne :

```
project_lens_tags (
  project_id  → projects.id (CASCADE),
  lens        → lenses.slug,
  tag         core | adjacent (CHECK),
  PK (project_id, lens), index (lens, project_id)
)
```

Un projet porte autant de tags que de lentilles le lisent — le
chevauchement est permis par construction. `space_tag` est migré dedans
puis **supprimé** : une seule vérité. Coût : ~16 k lignes par lentille
face aux 700 k projets, le semi-join `EXISTS` est trivial pour la
machine. Pas d'alembic dans la maison : migration par script idempotent
(`CREATE TABLE IF NOT EXISTS` + `INSERT … SELECT` + `DROP COLUMN`),
comme les backfills précédents ; les bases neuves l'ont par `create_all`.

**Les règles.** `backend/curation/lenses/<slug>.csv` — schéma exact
actuel (`rule_type, value, tag, sources, evidence, source`), mêmes
validations, même doctrine : core bat adjacent structurellement, retag
total **par lentille** à chaque run, skip souple quand le corpus varie.
`space-lens.csv` déménage en `lenses/space.csv` par `git mv` —
l'historique suit. Le nom de run devient `lens-<slug>`.

**Le registre.** `backend/curation/lenses/registry.csv` (`slug, rang`),
versionné comme le reste. Le chargeur refuse un CSV hors registre, et
**mire** le registre dans une petite table `lenses (slug PK, rank)` —
le fichier reste la seule vérité éditable, la table sert les FK et la
validation `sector` côté requêtes. Le rang ordonne les verticales ;
rang 1 = le hero.

**Les périmètres.** Le contrat de TOUTE lentille est deux niveaux,
`core`/`adjacent` → « X direct » / « X + habilitant » — le vocabulaire
des périmètres est uniforme, seuls les mots de la verticale changent.
Une lentille sans règle `adjacent` est permise (les deux périmètres
coïncident alors, et c'est dit).

**Les mots.** Les libellés d'une lentille (`lens.<slug>.name`,
`.direct`, `.enabling`, la phrase du hero, le bloc À-propos) font
partie de sa **curation** : pas de règles sans ses mots, dans les deux
langues.

**La grammaire URL.** `sector=<slug>` (cœur + habilitant) et
`sector=<slug>-direct` (cœur seul). `space` et `space-direct` sont
**inchangés par construction** — zéro redirection, zéro compat à
écrire : toutes les URL existantes (decks, portes, dossiers, favoris de
recette) restent vraies. La validation passe de valeurs codées à « slug
au registre ». L'API `/api/stats` expose le bloc `lenses` en ordre de
rang : **le front n'a aucune liste de lentilles en dur, l'API est son
registre.**

## 3. La porte d'entrée — la home à deux verticales, et le nom

La home actuelle a trois étages ; la structure se généralise sans se
renverser :

- **Le hero reste LA verticale de rang 1** — le spatial. La promesse
  commerciale ne se dilue pas en sélecteur.
- **Chaque autre verticale chargée = une ligne discrète** au-dessus de
  la ligne corpus : ses chiffres réels (projets, financements), sa
  porte `?sector=<slug>`. La ligne n'apparaît que si la lentille a des
  projets tagués — jamais de porte vide. Jusqu'à la curation aéro, la
  home ne bouge donc **pas d'un pixel**.
- **La ligne corpus reste l'assise**, inchangée — c'est elle le total
  dédupliqué (§ 5).

**Le nom.** Recommandation : **garder « Orion Space Intelligence » dans
ce chantier.** La marque est la promesse de la verticale de tête, et
elle ne vit déjà que dans i18n — un jeton, interchangeable en une
ligne le jour venu. Le passage à « Orion » ombrelle (les verticales
nommées dessous) est une décision **commerciale**, à prendre quand
l'aéro aura ses règles et ses decks — le déclencheur naturel est
l'ouverture du chantier A1, pas l'existence d'un mécanisme vide.

## 4. Le chevauchement — la doctrine

**Une lentille est une lecture posée sur le corpus, jamais une
partition.** Quatre conséquences :

1. **Dans une vue cadrée sur une lentille, le projet compte plein.**
   Jamais de fraction, jamais de rattachement principal — un projet de
   navigation par satellite pour l'aviation est entièrement spatial ET
   entièrement aéro, c'est la nature d'une lecture.
2. **Les nombres de deux lentilles ne s'additionnent jamais.** Aucune
   surface ne montre de « total des verticales » — sommer des lectures
   double-compte les chevauchements (précédent maison : l'attribué JV).
   Le seul total est la ligne corpus, dédupliquée par construction.
3. **Le cadrage est UNE lentille à la fois.** Un seul paramètre
   `sector`, une lecture par vue — l'intersection (« spatial ET
   aéro ») n'entre pas dans la grammaire : c'est une curiosité de
   méthode, pas un geste d'exploration.
4. **Le chevauchement se voit là où il vit** : badges de lentille sur
   la fiche projet (« Spatial · cœur », « Aéronautique · habilitant » —
   surface aujourd'hui inexistante, relevé § 1), et le recouvrement
   chiffré à l'À-propos (« X projets portent les deux lentilles »),
   à côté des blocs méthode.

## 5. Les lots

**M0 — le mécanisme** (backend + plomberie, invisible) : la table et sa
migration (space migré, colonne supprimée), le chargeur générique
(`lenses/space.csv` premier client), le registre et sa table miroir, la
validation `sector` par registre, les clauses `EXISTS`, le bloc
`lenses` de `/api/stats` avec l'alias `space` conservé. **Recette :
rien ne bouge à l'écran** — la non-régression, c'est la suite e2e
existante, verte **sans une ligne modifiée**.

**M1 — les surfaces multi-verticales** : le chip alimenté par l'API,
les libellés `lens.<slug>.*` (dossier compris), les lignes verticales
de la home (invisibles tant qu'une seule lentille est chargée), les
sections d'analyses par lentille, les badges de lentille sur la fiche
projet, l'À-propos par lentille + recouvrement chiffré, `stories.ts`
en `lens: string`, l'alias `space` des stats retiré.

**A1 — la curation aéro** (chantier séparé, **hors de celui-ci**) : ses
règles avec le même sérieux que les 23 spatiales — programmes en
sous-arbres (Clean Sky, Clean Aviation, SESAR, à vérifier sur pièce),
thèmes euroSciVoc, motifs texte cadrés par source — sa note de tri, ses
mots i18n, sa recette. C'est là que se décide aussi le nom (§ 3).

**A2 — les decks aéro et sa porte** : après A1 seulement.

---

## Les décisions soumises — avant tout code

| # | Décision | Détail |
|---|---|---|
| **D1** | Le tag passe en **table** `project_lens_tags` ; `space_tag` migré puis **supprimé** | Une seule vérité ; le chevauchement permis par construction ; migration par script idempotent |
| **D2** | Grammaire `sector=<slug>` / `<slug>-direct` ; **`space` inchangé par construction** | Zéro redirection ; deux périmètres = contrat de toute lentille (« direct » / « + habilitant ») |
| **D3** | **Lecture, jamais partition** : plein dans chaque lentille, jamais sommé entre lentilles, une lentille par vue | Badges par projet + recouvrement chiffré à l'À-propos ; le seul total est la ligne corpus |
| **D4** | La home : **hero = rang 1** (le spatial), autres verticales en **lignes discrètes** au-dessus de la ligne corpus, seulement si chargées | La structure actuelle se généralise sans se renverser |
| **D5** | **Le nom ne change pas dans ce chantier** — « Orion » ombrelle est une décision commerciale, déclencheur : l'ouverture de A1 | La marque est déjà un jeton i18n, interchangeable en une ligne |
| **D6** | Lots **M0 → M1** ; A1/A2 chantiers suivants | Recette M0 = les 71 e2e inchangés et verts ; M1 quasi invisible jusqu'à l'aéro |

---

## Validation du 2026-08-17 — amendements fondatrice

**D5, amendée.** Le jeton « Orion Space Intelligence » reste inchangé
pour M0 et M1 — mais la cible de marque long terme est désormais
**actée** : **ORION est la marque ombrelle**, la lentille devient une
composante de l'identité de contexte — **ORION / SPACE**,
**ORION / AVIATION**. L'évolution ne s'exécute PAS pendant M0/M1 ; elle
s'appliquera quand A1 aura produit une deuxième lentille réelle,
validée et exploitable en production.

**Amendement M0 n° 1 — les familles.** Le registre porte dès M0 la
taxonomie à deux niveaux **famille → lentille**, par clé technique
stable indépendante de la langue (`family_key = aerospace_mobility`) —
le libellé utilisateur appartient à l'i18n et ne sert jamais
d'identifiant. Seule la famille réellement nécessaire existe :
`aerospace_mobility → space`. Aucune famille ou lentille fictive, aucun
chiffre inventé.

**Amendement M0 n° 2 — les intersections.** Les intersections de
lentilles (`SPACE × QUANTUM`) sont consignées au registre des évolutions
([roadmap](roadmap.md)) comme évolution majeure identifiée. Le modèle
de données (D1) permet naturellement plusieurs tags par projet — c'est
souhaité. D3 reste strictement applicable : **une seule lentille active
par vue** — dans M0 et M1, aucune intersection dans l'interface, aucune
syntaxe d'URL multi-lentilles, aucun opérateur AND/OU, aucun composant
préparatoire, aucune logique de sélection multiple. La porte reste
ouverte dans le modèle, jamais préimplémentée dans la grammaire.

## Exécution M0 — divergences constatées sur pièce (2026-08-17)

Trois écarts entre cette conception et le dépôt réel, résolus en faveur
du réel :

1. **La maison A alembic** — le § 2 disait « pas d'alembic, script
   idempotent » : faux (relevé trop vite ; `make migrate` = `alembic
   upgrade head`, et l'entrypoint de prod migre au démarrage). D1
   s'exécute donc en **révision 0023**, même effet, meilleure forme.
2. **Le nom de run est `<slug>-lens`, pas `lens-<slug>`** — la page
   À-propos affiche les runs par leur nom ; `space-lens` y est visible
   depuis la V1. Le motif `<slug>-lens` donne `space-lens` à
   l'identique : générique ET invisible, par construction.
3. **Le tampon de cache apprend les lentilles** — `_data_stamp`
   ignorait les runs de lentille : un retag ne rafraîchissait ni les
   stats ni l'Explorateur avant redémarrage (staleness préexistante,
   masquée par les redémarrages de déploiement). Les runs `%-lens`
   comptent désormais dans le tampon : requis pour que le mécanisme
   soit juste quand une lentille se recharge à chaud.

## Invariants post-M0 (fondatrice, 2026-08-18 — M0 validé)

**I1 — `lens` est la grammaire canonique future ; `sector` devient un
alias de compatibilité.** Rien ne migre maintenant : M1 continue
d'émettre `sector=` partout (aucune URL ne casse, aucune double forme
en circulation). Mais toute lecture/écriture du paramètre passe par UN
seul module de chaque côté (`useActiveLens()` au front,
`parse_sector`/`valid_sector` au back) — aucune surface nouvelle ne
propage `sector` en dur comme si c'était l'avenir. Le basculement
`sector→lens` (avec normalisation des anciennes URL) sera un geste
propre et daté, pas un effet de bord.

**I2 — une lentille porte un statut : `draft | published | retired`.**
Seule une lentille PUBLIÉE est exposée — validation d'URL, bloc
`lenses` de `/api/stats`, et un jour la Lens Room. `draft` se charge et
se vérifie en base sans exister pour le produit (le chemin d'A1 :
construire l'aviation en draft, la publier quand elle est vraie) ;
`retired` n'est plus rechargée ni exposée, ses tags restent gelés en
base (rien n'est supprimé). **Implémenté dès maintenant** (bon marché :
colonne au registre + migration 0024) — `space = published`.

**I3 — le vocabulaire est UNE paire, à deux registres.** Technique :
`core / enabling`. Utilisateur : « X direct » / « X + habilitant »,
en i18n — les libellés validés du chantier Space natif font foi.
Aucun troisième terme nulle part. L'alignement `adjacent → enabling`
(valeur en base, colonne des CSV de règles, clé de payload) n'est PAS
bon marché isolément — la home lit `stats.space.adjacent`
(home.tsx:262) : le renommer côté données seul créerait un TROISIÈME
état. Il se fait en **un seul geste au lot M1.0**, quand le front
bascule sur le bloc `lenses`.

**I5 — Orion classe ce que le projet DÉVELOPPE, pas l'équipement qu'il
UTILISE** (loi gravée le 2026-08-18, valable pour TOUTES les lentilles).
Un drone qui compte des oiseaux est un projet d'écologie, pas
d'aéronautique ; un avion de recherche atmosphérique est un projet de
climat ; un satellite qui sert à mesurer les sols est un projet
d'observation — la lentille suit l'OBJET du travail, jamais son outil.
C'est la loi qui tranche les négatifs difficiles du gold set (le
drone-outil, l'avion-instrument NSF), et elle vaut d'avance pour toute
lentille future.

**I6 — la hiérarchie de preuve** (gravée le 2026-08-18) :
**structurel > taxonomique > textuel**. `call` et `topic` sont des
preuves STRUCTURELLES de première classe — la source les affirme.
Le `theme` est taxonomique, le motif `text` est interprétatif. Un
`veto` textuel peut annuler un candidat issu du texte ou du thème,
**jamais une classification obtenue par `call` ou `topic`** : une
interprétation ne renverse pas un fait de la source.

**I7 — une règle taxonomique utilise le niveau sémantique fiable le
plus ÉTROIT** (gravé le 2026-08-18, décision S-C). Un nœud parent qui
couvre plusieurs domaines métier **ne peut pas servir de preuve de
lentille** : il récolte les voisins. Constat fondateur — le thème
`aerospace engineering` posé en habilitant spatial ramenait 99 %
d'aéronautique (1 263 projets, 4,9 Md€). Corollaire opératoire : on ne
remplace jamais un parent large par un autre parent large — on descend
au niveau qui parle du sujet, et lui seul.

**I8 — la confiance s'attache à une RÈGLE précise, jamais à une
famille de preuve entière** (gravé le 2026-08-18, décision T-B+). La
précision se mesure et se publie **par règle**. Constat fondateur : les
sept règles d'appel d'Aviation n'ont produit aucun faux positif, quand
trois règles de concept en produisaient cinq — or les deux familles
étaient déclarées « structurelles ». Une famille n'est pas une garantie ;
seule une règle mesurée l'est. Corollaire : `call` et `topic` restent
les preuves POSITIVES les plus fortes, mais aucune preuve n'est jamais
une preuve NÉGATIVE — un appel d'un autre domaine ne disqualifie rien
(DroneHopper, appel agriculture, développe bien un aéronef ; FALCon,
appel Space, porte de vraies technologies de vol).

**I9 — « aerospace » générique n'est une preuve NI d'Aviation NI de
Space** (gravé le 2026-08-18). Le mot, le thème et le nœud qui disent
« aérospatial » recouvrent deux mondes : chaque lentille doit gagner sa
classification par une preuve PLUS SPÉCIFIQUE — un appel qui la
finance, un concept qui la nomme, un texte qui la démontre. C'est
l'application directe d'I7 au cas le plus fréquent du domaine, et la
raison pour laquelle un projet comme AD-ASTRA (« Aerospace Districts »)
reste sans tag : rien n'y dit LAQUELLE des deux.

**I4 — le recalcul indépendant par lentille est une exigence d'A1,
pas un développement d'aujourd'hui.** Consigné : sélecteur CLI
(`orion-ingest lenses --lens aviation`), et versions/journaux PAR
lentille (le run `<slug>-lens` existe déjà ; A1 y ajoute la version du
fichier de règles — hash + date — dans le journal). Voir roadmap.

**I10 — une règle conçue sur un échantillon n'est jamais validée par
ce même échantillon** (gravé le 2026-08-18). L'échantillon qui a servi
à *voir* le signal en a épuisé le pouvoir de preuve : y mesurer 100 %
de justesse ne dit rien de la règle, seulement qu'elle décrit
correctement ce qu'on lui a montré. Toute règle apprise doit être
mesurée sur un **holdout** — des cas jamais vus lors de sa conception —
avant publication. Corollaire opératoire : les 200 projets revus de
l'échantillon taxonomique A1 sont désormais **brûlés** comme jeu de
validation ; ils restent utiles comme jeu de non-régression, jamais
comme preuve de généralisation.

**I11 — le vocabulaire des preuves ne se surévalue pas.** Quand un
candidat taxonomique est refermé par des motifs de texte, on écrit
« **candidat taxonomique + corroboration lexicale** » — jamais « deux
preuves indépendantes ». EuroSciVoc est lui-même dérivé des textes
CORDIS : les deux signaux sont corrélés par construction, et les
présenter comme indépendants gonflerait la confiance d'un facteur que
personne n'a mesuré. Le résultat d'un groupe lié est de classe
**taxonomique confirmée** — jamais structurelle (I6) : un veto futur
peut donc l'enlever.

## La grammaire des groupes liés (A1, 2026-08-18)

Deux types de règles s'ajoutent, et ne valent que par paire :

| Type | Classe | Rôle |
|---|---|---|
| `candidate` | taxonomique | un concept euroSciVoc EXACT qui **ouvre un pool** — il ne tague jamais seul |
| `confirm` | — | un motif qui **referme** le pool, sur un champ nommé (`scope`) |

Le champ `group` fait le lien, et lui seul : **une confirmation ne peut
jamais confirmer le candidat d'un autre groupe** — ni la proximité dans
le fichier, ni l'ordre des lignes ne créent d'appartenance (I8).

Le `scope` distingue explicitement les deux champs, parce qu'ils ne
disent pas la même chose :

- `title` — le **titre** seul : il nomme le SUJET du projet ;
- `text` — titre + résumé : il décrit le contexte, les exemples, les
  applications visées.

L'asymétrie est mesurée, pas supposée : sur les 200 projets revus,
« aircraft » au résumé ne vaut que 74,4 % de justesse (l'aviation y est
souvent citée en exemple — « one example being engine cooling in the
aviation industry »), là où au titre il désigne l'objet développé.

**Politique V1 : candidat ET corroboration titre ET corroboration
texte.** Un groupe incomplet — deux candidats, une confirmation
orpheline, un `scope` manquant — est refusé au CHARGEMENT, jamais en
silence.
