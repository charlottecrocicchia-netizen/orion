# Chantier performance — instruction

> **Statut : EXÉCUTÉ le 2026-08-03** (instruction validée le même jour).
> Résultats, y compris ce qui contredit l'instruction, en fin de document.
> Intercalé avant NSF (décision du 2026-08-03) : la vague 1 va tripler
> le corpus et chaque source suivante paierait l'intérêt de cette dette.
> Toutes les mesures ci-dessous sont **réelles**, prises le 2026-08-03
> sur le corpus post-ANR (464 727 projets, 842 493 participations,
> 443 363 textes indexés — table `project_texts` : 2,5 Go), PostgreSQL
> réglé (shared_buffers 1 Go, work_mem 64 Mo), machine locale (VM Docker
> ~2,8 Go de RAM).

## 1. Le diagnostic — ce qui domine, mesuré pièce à pièce

**Trois régimes très différents se cachaient derrière « c'est lent » :**

| Régime | Mesure | Explication |
| --- | --- | --- |
| Cache applicatif chaud (même terme, même corpus) | **~20 ms partout** | le service cache résultats et ensembles de correspondance par terme (cap 64), clé = tampon d'ingestion |
| Terme jamais vu (tampons PG chauds) | **~22 s** (« protein », 103 841 correspondances) | l'anatomie ci-dessous |
| Après ingestion / démarrage (tout froid) | 22,5 s (« cancer »), 12,2 s (pays=FR) | même anatomie + I/O disque + **chaque run réussi invalide tous les caches** |

**Anatomie d'une recherche à terme neuf** (« protein », 104 k
correspondances, tampons chauds) — total ≈ 22 s :

| Pièce | Mesure | Cause dominante |
| --- | --- | --- |
| Match FTS + classement | **8 326 ms** | voir la découverte ① |
| Comptage total | 933 ms | re-scan de `projects` (465 k) contre l'ensemble |
| Facette bailleurs | **8 903 ms** → 1 076 ms avec stats | découverte ② (plans instables) |
| Facette programmes | 560 ms | re-scan |
| Facette pays | 785 ms | re-scan + jointure `participations` (842 k) |
| Facette années | 454 ms | re-scan |
| Page de résultats (tri pertinence) | 1 871 ms | découverte ④ |

**Les cinq découvertes** (chacune vérifiée par mesure) :

① **Le mur n'est pas `ts_rank`, c'est la lecture du heap.** Le match
seul, sans aucun classement, coûte déjà **7 975 ms** : le bitmap scan
doit lire 104 k lignes éparpillées dans une table de **2,5 Go qui ne
tient pas dans la RAM de la machine (VM ~2,8 Go)** — chaque terme neuf
relit le disque. Le classement n'ajoute que ~4 %.

② **La table temporaire de correspondances n'a jamais de
statistiques.** Le service crée `_orion_match` sans `ANALYZE` : le
planificateur estime au hasard et bascule parfois sur des plans
catastrophiques — la facette bailleurs passe de **8 903 ms à 1 076 ms**
avec la seule ligne `ANALYZE _orion_match`.

③ **Le même ensemble est re-scanné cinq fois.** Comptage + quatre
facettes refont chacun `p.id IN (SELECT … FROM _orion_match)` contre
les 465 k projets. Mesuré : une passe unique `GROUPING SETS`
(bailleurs + programmes + années) fait le travail de trois en
**629 ms** ; le comptage peut se lire du match lui-même (~13 ms).

④ **La page trie 104 k lignes pour en garder 20.** Le tri
jointure-puis-ORDER BY coûte 1 871 ms ; sélectionner d'abord le top-20
par rang dans le match (13 ms) puis charger 20 fiches par clé primaire
le remplace. **1 871 ms → ~30 ms.**

⑤ **Le filtre pays paie un `EXISTS` corrélé et un index manquant.**
`EXISTS (participations…)` : 836 ms ; la jointure directe
`count(DISTINCT project_id) WHERE country='FR'` : **78 ms**. Et
`participations` n'a **pas d'index (country_code, project_id)** — seuls
pkey, source_uid, organisation_id, project_id existent.

**Et une sixième, transverse : l'invalidation est trop brutale.** Le
tampon de cache est `max(finished_at)` de TOUS les runs réussis — un
run GLEIF hebdomadaire qui ne touche aucun projet invalide quand même
toutes les facettes projets. Après chaque nuit d'ingestion, le premier
visiteur repaie tout.

**L'index des pays (la carte, 4,6 s constatés en charge)** : agrégat
vivant sur les 842 k participations à chaque requête — exactement le
cas que `organisation_stats` (vue matérialisée, rafraîchie par le
pipeline) résout déjà ailleurs dans le code.

## 2. Les options, comparées au prix honnête

### O1 — Requêtes repensées + statistiques + index (sans structure nouvelle)

Contenu : `ANALYZE _orion_match` à la création ; comptage lu du match ;
facettes bailleurs/programmes/années en **une passe GROUPING SETS** ;
page en top-20-par-rang puis fetch par clé ; filtre pays en jointure
directe ; index composite `participations (country_code, project_id)`.

- **Gain mesuré** (pièces déjà chronométrées) : hors match FTS, une
  recherche à terme passe de ~13,5 s à **~1,5 s** ; le chemin pays de
  12,2 s à **< 0,5 s attendu** (78 ms + facettes refondues).
- **Coût** : refonte localisée de `service.py`, aucun objet nouveau,
  tests existants inchangés dans leur sémantique.
- **Risques** : faibles — mêmes résultats, requêtes différentes ; le
  garde-fou d'égalité (§4) le prouve.

### O2 — Agrégats matérialisés pour les chemins sans terme

Contenu : `country_stats` (l'index des pays servi en lecture O(1) — le
pattern `organisation_stats` existant), et les **facettes par défaut**
matérialisées (page /projects vierge).

- **Fraîcheur** : `REFRESH MATERIALIZED VIEW` exécuté **dans la chaîne
  d'ingestion elle-même** (étape finale, comme `organisation_stats`
  aujourd'hui) — jamais un cron séparé qui peut diverger.
- **Garantie de non-mensonge** (exigence fondatrice) : ① le REFRESH vit
  dans le même run que la donnée — s'il échoue, le run est en échec,
  visible au journal ; ② un **test CI** compare l'agrégat matérialisé au
  calcul vivant sur le corpus seedé — toute divergence casse la CI ;
  ③ le tampon de cache applicatif reste indexé sur la fin du run, donc
  aucune fenêtre où l'app servirait l'ancien agrégat avec un nouveau
  corpus.
- **Gain attendu** : index pays 4,6 s → **quelques ms constants**, quel
  que soit le volume.
- **Coût** : une migration, un REFRESH par chaîne, le test d'égalité.
- **Risque** : un futur chargeur qui oublierait le REFRESH — couvert par
  le placement (étape finale commune, pas par-chargeur) et par le test.

### O3 — Le mur FTS (les 8 s de match)

Trois sous-options, cumulables :

**O3a · Table de recherche maigre (spike à mesurer avant adoption).**
Une table `project_search(project_id, lang, vector)` où le vecteur est
condensé (titre pondéré A + N premiers mots du résumé) : ~10× plus
petite que `project_texts`, donc **résidente en cache** même à corpus
triplé. Le match cesse de lire 2,5 Go.
- Gain attendu : match 8 s → **< 1 s** (à prouver au spike, critère
  d'adoption : ≥ ×5).
- **Prix honnête** : une perte de rappel — les mots au-delà des N
  premiers mots du résumé ne matchent plus. Décision fondatrice
  incluse : N (proposition : 400 mots — les résumés NIH font souvent
  plus, les CORDIS rarement) et la mention au registre.
- Coût : nouvelle table + remplissage par la chaîne, invalidation par le
  même tampon.

**O3b · Préchauffage des termes fréquents.** Journal des termes cherchés
(compteur anonyme), et la fin de chaque chaîne d'ingestion re-matérialise
les 50 plus fréquents. Le pire cas premier-terme ne disparaît pas, il
sort du chemin utilisateur pour les termes qui comptent.
- Gain : le « premier matin après ingestion » redevient ~20 ms sur les
  termes courants. Coût : petite table + boucle de warm. Risque : nul.

**O3c · La RAM est un paramètre du produit, pas un détail.** La VM
locale à 2,8 Go ne peut pas cacher une table de 2,5 Go — et le corpus
va tripler. À acter : **Colima ≥ 8 Go en local** (réglage machine), et
le **dimensionnement VPS écrit noir sur blanc dans infra/README**
(règle : la table de recherche chaude doit tenir en RAM). Sans ça,
toutes les mesures locales mentiront et la prod découvrira le mur.

### O4 — Cache applicatif : affiner l'invalidation

Le cache existe et fait son travail à chaud. Contenu : le tampon
devient **par famille de tables touchées** (un run `gleif`/`wikidata`/
`groups` n'invalide plus les facettes projets ; un run source les
invalide). Gain : les caches survivent au rejeu hebdo de l'identité.
Coût : une table de correspondance run→familles, simple et documentée.
Risque : une invalidation manquée — couverte par le test d'égalité (§2)
qui tourne aussi en CI.

**Écarté (avec motif)** : moteur externe (Elasticsearch…) — l'ADR 0001
tient, Postgres n'a pas dit son dernier mot tant que O1-O3 ne sont pas
faits ; extension RUM — hors image pgvector, dépendance d'infra pour un
gain que O3a atteint sans elle.

## 3. La cible chiffrée, et la preuve qu'elle tient au triplement

Budgets sur les quatre parcours clés (P95, tampons PG chauds — le
régime « premier geste d'un utilisateur sur un terme neuf ») :

| Parcours | Aujourd'hui (terme neuf) | Cible après chantier | À corpus ×3 |
| --- | --- | --- | --- |
| Recherche avec terme (« protein », 104 k) | ~22 s | **≤ 1,5 s** sans O3a · **≤ 300 ms** si le spike O3a tient | argument ci-dessous |
| Filtre pays seul | 12,2 s | **≤ 300 ms** | idem |
| Index des pays (carte) | 0,4-4,6 s | **≤ 50 ms** (matérialisé) | O(1), invariant au volume |
| Fiche organisation (detail + partenaires) | 20-40 ms (sain) | **≤ 300 ms** garanti par le garde-fou | surveillé |
| Tout parcours, cache chaud | ~20 ms | inchangé | inchangé |

**Pourquoi ça tient à ×3** — deux arguments, puis une preuve :

1. **Argument de complexité** : chaque pièce refondue passe de
   O(|projets|) re-scanné cinq fois à O(|correspondances|) une fois
   (GROUPING SETS sur le match) ou O(top-N) (page) ; les matérialisés
   sont des lectures constantes ; le filtre pays devient une lecture
   d'index composite. Ce qui croît linéairement avec le corpus, c'est le
   match FTS — traité par O3a (table maigre qui reste résidente : ~250
   Mo aujourd'hui, ~750 Mo à ×3, sous la règle RAM d'O3c).
2. **Argument de charge** : le triplement vient de sources qui
   n'ajoutent pas de nouvelle forme de requête — les mêmes chemins,
   plus de lignes.
3. **La preuve, incluse dans la livraison** : un corpus synthétique ×3
   (duplication contrôlée des projets/participations/textes dans une
   base jetable) et **le banc rejoué dessus avant clôture** — les
   budgets du tableau doivent tenir sur cette base, mesures versées au
   document de clôture.

## 4. Le rituel de vérification — avant/après et garde-fou durable

1. **Le banc** : `backend/scripts/bench_api.py` — chronomètre les quatre
   parcours (3 passes, médiane et pire, régimes froid/terme-neuf/chaud),
   sortie JSON datée versée dans `docs/perf/`. Exécuté **avant** le
   chantier (l'état de référence est déjà pris : ce document), **après**
   chaque option livrée, et sur le corpus ×3.
2. **Le garde-fou CI** : un job qui lance le banc sur le corpus seedé
   e2e avec des **budgets serrés** (corpus minuscule → ~150 ms par
   parcours) et échoue au dépassement. Il n'attrape pas les murs de
   volume (le corpus CI est petit) mais attrape ce qui a causé nos
   dérives : **les régressions algorithmiques** — un plan qui bascule,
   un re-scan réintroduit, une facette qui perd son chemin d'index.
3. **Le relevé par chargeur** : la règle du registre s'étend — chaque
   nouvelle source (NSF et suivantes) livre sa ligne « perfs
   constatées » : le banc rejoué après chargement, chiffres au registre.
   La dérive ne peut plus être silencieuse : elle a un chiffre daté à
   chaque étape de la vague 1.
4. **Le test d'égalité** : matérialisé = vivant sur corpus seedé (§O2),
   en CI — un agrégat qui ment casse le build.

## 5. Périmètre et durée

**Dans le chantier** : O1 (requêtes+stats+index), O2 (country_stats +
facettes par défaut matérialisées, REFRESH en chaîne, test d'égalité),
O4 (invalidation par famille), O3b (préchauffage), **spike O3a mesuré**
(adopté seulement si ≥ ×5 et rappel accepté par la fondatrice — sinon
documenté et le budget recherche reste ≤ 1,5 s, dit au registre), O3c
(règle RAM actée dans infra/README + réglage Colima local), le banc, le
garde-fou CI, la preuve ×3.

**Hors chantier** (dits, pas oubliés) : moteur de recherche externe
(ADR 0001 tient) ; extension RUM ; pagination keyset des longues listes ;
perfs du globe/flux (chantier UI gelé) ; tout ce que le banc révélerait
de nouveau — au registre, chantier suivant.

**Durée estimée : ~1 semaine.** Jour 1-2 : O1 + banc (les gains sont
déjà chiffrés pièce à pièce, l'assemblage est le travail). Jour 3 : O2 +
test d'égalité. Jour 4 : spike O3a + décision + O3b/O4. Jour 5 : preuve
×3, garde-fou CI, mesures finales, registre et clôture.

**Deux décisions fondatrice incluses dans la validation** : ① la
profondeur du vecteur condensé O3a (proposition : titre + 400 premiers
mots du résumé) et l'acceptation de la perte de rappel dite ; ② la
règle RAM d'O3c (Colima 8 Go en local, dimensionnement VPS écrit).


---

# Résultats du chantier (2026-08-03)

## Ce qui a été livré

| Option | Décision | Mesure |
| --- | --- | --- |
| **Règle RAM** (Colima 3 → 8 Go) | livrée en premier | **le levier le plus fort du chantier** : recherche ×7,6, filtre pays ×5,4, à elle seule |
| **O1** — scope unique matérialisé, facettes en une passe, page top-N, semi-jointure pays, 3 index | livrée | filtre pays 1 602 → 524 ms, recherche 326 → 227 ms |
| **O2** — `country_stats` et `country_pair_stats` matérialisées | livrée | carte 3 160 → 20 ms au pire ; facette pays d'un filtre pays : lecture au lieu de calcul |
| **O3a** — matière condensée | **RETIRÉE** | voir ci-dessous |
| **O3b** — préchauffage des termes fréquents | **non retenue** | la mesure a montré que le préchauffage utile n'est pas celui des termes mais celui de la MATIÈRE (`pg_prewarm`) — noté comme piste d'exploitation, pas comme code |
| **O4** — invalidation par famille de sources | livrée | un run d'identité ne vide plus les caches du corpus (testé) |
| **Banc + garde-fou CI + preuve d'échelle** | livrés | `scripts/bench_api.py`, budgets en CI, `scripts/triple_corpus.py` |

## Les budgets, au corpus actuel (464 727 projets)

Mesure de clôture, caches chauds, protocole respecté :

| Parcours | Avant chantier | Clôture | Budget | Verdict |
| --- | --- | --- | --- | --- |
| Recherche à terme neuf | 2 221 ms | **303 ms** | 1 500 | ✅ |
| Recherche, cache chaud | 173 ms | **191 ms** | 300 | ✅ |
| Filtre pays | 7 995 ms | **245 ms** | 300 | ✅ |
| Index des pays (carte) | 3 847 ms au pire | **19 ms au pire** | 300 | ✅ |
| Fiche organisation | 27 ms | **9 ms** | 300 | ✅ |
| Partenaires | 6 ms | **5 ms** | 300 | ✅ |

## ⚠️ Ce que la preuve d'échelle a démenti

**L'instruction promettait que les budgets tiendraient au triplement, par
argument de complexité. La mesure dit non.** Corpus doublé (929 454
projets, base 8,8 Go, machine à 8 Go de RAM) :

| Parcours | Corpus nominal | Corpus ×2 | Facteur |
| --- | --- | --- | --- |
| Recherche à terme neuf | 303 ms | **10 120 ms** | ×33 |
| Filtre pays | 245 ms | **5 453 ms** | ×22 |
| Index des pays | 4 ms | **13 ms** | ×3 |
| Fiche organisation | 9 ms | **44 ms** | ×5 |

Le doublement des données multiplie les temps par bien plus que deux :
**ce n'est pas la complexité algorithmique qui gouverne, c'est la
mémoire**. Quand la matière chaude cesse de tenir en cache, chaque
requête retourne au disque. Confirmé par contre-épreuve : le même
corpus ×2 avec 5 Go de cache au lieu de 2 passe de 10 120 à 5 690 ms —
mieux, mais une base de 8,8 Go ne tient pas dans 5 Go.

**Les agrégats matérialisés, eux, encaissent le doublement sans broncher**
(carte : 4 → 13 ms). C'est la validation la plus nette d'O2 : ce qui est
pré-calculé devient insensible au volume.

### La règle de dimensionnement, chiffrée

Ce chantier transforme une note de bas de page en **décision produit** :

- corpus actuel (465 k projets) : base ~5 Go → **8 Go de RAM** suffisent
  (état local validé) ;
- corpus ×2 (930 k) : base ~9 Go → **16 Go** ;
- corpus ×3 attendu en fin de vague 1 (~1,4 M) : base ~13 Go →
  **24 à 32 Go de RAM**, avec `shared_buffers` autour du tiers.

**À porter au budget d'hébergement avant la mise en ligne.** Sans cette
RAM, aucune optimisation logicielle ne tiendra les 300 ms — le chantier
l'a mesuré des deux côtés.

## Le spike O3a : critère atteint, système contredit

En isolation : ×3,2 à ×10,7 selon le terme (médiane ×6,1), rappel
98,4 %, moitié moins de matière — le critère d'adoption validé (≥ ×5)
était atteint. Dans le système : la recherche passe de 203 à 913 ms.

La matière condensée ne REMPLACE pas les textes complets (les extraits
lisent le vrai texte), elle s'y ajoute — 1,3 Go de plus dans le cache
déjà saturé. Le budget était tenu sans elle. **Retirée** (migration
0016), mesure conservée.

Ce que le spike laisse comme piste, pour le jour où la RAM ne suivra
plus : retirer l'index plein texte une fois les extraits servis
autrement. Un chantier à instruire alors, pas à improviser.

## Le rituel installé

1. **Le banc** (`scripts/bench_api.py`) avec son protocole écrit — le
   cache applicatif survit entre deux exécutions, un « terme neuf » ne
   l'est qu'à la première mesure (piège rencontré deux fois).
2. **Le garde-fou CI** : budgets serrés sur le corpus seedé à chaque
   build. Il n'attrape pas les murs de volume, il attrape les
   régressions algorithmiques.
3. **Le test d'égalité** des matérialisés, plus un test qui vérifie que
   la liste des vues rafraîchies couvre le schéma réel — trois chemins
   d'écriture (chaîne, fixtures, seed CI) lisent désormais la même liste.
4. **Le relevé par chargeur** : chaque source de la vague 1 livre sa
   ligne de perfs constatées au registre, banc rejoué après chargement.

## Ce qui reste ouvert

- **La variabilité selon l'état du cache est énorme** sur cette machine
  (303 ms à 2 500 ms pour le même parcours selon le réchauffement).
  Après une ingestion ou un redémarrage, le produit est lent jusqu'à ce
  que la matière remonte en cache. Piste : un préchauffage explicite
  (`pg_prewarm`) en fin de chaîne — à instruire.
- **Le dimensionnement VPS** ci-dessus, à arbitrer au moment de
  l'hébergement.
- Les pistes écartées de l'instruction (moteur externe, RUM, pagination
  keyset) restent écartées.
