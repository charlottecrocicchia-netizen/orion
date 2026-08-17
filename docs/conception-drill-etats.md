# Conception — le drill-down par État américain (et les fédérations)

*2026-08-17 — instruction fondatrice, conception AVANT implémentation.
Verdict données d'abord, architecture ensuite, coût et équivalents
fédéraux en fin. Rien n'est commencé.*

## 1. Le verdict données : récupérable en entier, rien n'est perdu

Vérifié sur pièces dans les caches (tous présents sur disque) :

| Source | Champ | État du stockage | Exemple lu |
|---|---|---|---|
| **NSF** | `inst.inst_state_code` (bénéficiaire) — et `perf_st_code` (lieu d'exécution) existe aussi | **Non conservé** à l'ingestion ; **présent dans les 22 caches** nsf-2005..2026 | `NV` (Desert Research Institute, Reno) |
| **NIH** | colonne `ORG_STATE` du CSV RePORTER | **Non conservé** ; **présent dans les 21 caches** nih-projects-2005..2025 | — |
| **CORDIS** | `nutsCode` + `geolocation` par participation (organization.csv) | **Non conservé** ; **présent dans les 3 caches** FP7/H2020/Horizon | — |

Aucun retéléchargement nécessaire : une passe de **backfill** relit les
caches et pose la subdivision sur les participations existantes, appariée
par `source_uid` (la clé que chaque participation porte déjà). Cohérence
avec l'ingestion : nous avions choisi le côté BÉNÉFICIAIRE (le pays par
le nom) — l'État suit le même côté (`inst_state_code`, `ORG_STATE`) ; le
lieu d'exécution NSF (`perf_st_code`) reste documenté comme variante non
retenue, même registre que `perf_ctry_code`.

## 2. L'architecture proposée — la symétrie avec l'Europe par pays

**Modèle.** Une colonne `participations.subdivision_code` (ISO 3166-2 :
`US-NV`, `DE-BY`…) + pour CORDIS le NUTS brut conservé tel quel
(`participations.nuts_code`, NUTS3 souvent) — deux colonnes, migration
unique, remplies par une passe `subdivisions` du CLI (même famille que
`space-lens` : dérivée, rejouable, journalisée). Un référentiel
`subdivisions` (code, nom, pays) entre en base comme les régions manager
— complet par pays couvert, jamais une liste côté client (la règle
gravée).

**Géométrie.** Le pipeline `build-geo.mjs` gagne un scope pré-projeté
`us-states` depuis **Natural Earth admin-1** (domaine public, comme nos
pays — aucun sujet de licence) : 50 États + DC projetés sur la même
scène 900×675, Alaska/Hawaï en médaillons (le choix standard, dit dans
la légende). Le contrôle de complétude existant s'applique : tout code
du référentiel a son polygone ou sa pastille, sinon le build échoue.

**Surface.** La symétrie exacte avec l'Europe par pays :

- **la fiche pays États-Unis** porte la choroplèthe d'États comme carte
  principale (mêmes buckets LOG, même teinte de région
  nord-américaine, première activation = sélection + panneau résumé de
  l'État — financements, projets, premières organisations — seconde
  activation = la vue filtrée) ;
- **sur le globe et les cartes monde**, sélectionner les États-Unis
  ajoute au panneau la porte « Voir par État » (on n'ouvre jamais le
  drill d'office : premier clic explore, la règle) ;
- **l'URL** : `?subdivision=US-NV` rejoint la grammaire
  (`scope`/`sector`/`organisation`) — l'Explorateur gagne la dimension
  `by=subdivision` cadrée par `country=US`, le benchmark composable en
  hérite gratuitement (Californie vs Massachusetts en deux donuts).

## 3. Coût estimé (V1 États-Unis)

| Lot | Contenu | Coût |
|---|---|---|
| S1 | Migration + référentiel des États + passe backfill caches (NIH+NSF), tests | ~1,5 j |
| S2 | Géométrie admin-1 dans build-geo (médaillons AK/HI), complétude testée | ~1,5 j |
| S3 | Fiche pays US en choroplèthe d'États + panneau + `by=subdivision` API | ~2-3 j |
| S4 | Portes (globe/cartes), e2e, recette | ~1 j |

**Total : ~1 semaine.** Rejouable ensuite pour chaque fédération dont
les données ET la géométrie passent les règles.

## 4. Les équivalents fédéraux — ce que les données permettent

| Fédération | Données | Géométrie | Verdict |
|---|---|---|---|
| **États-Unis** | ✔ NIH `ORG_STATE` + NSF `inst_state_code`, caches complets | ✔ Natural Earth admin-1, domaine public | **V1 proposée ici** |
| **Länder allemands** | ✔ CORDIS `nutsCode` (les Länder = NUTS1 DE, DE1…DEG) | ❌ géométrie GISCO exclue (voir ci-dessous) ; Natural Earth admin-1 découpe bien les Länder mais l'appariement NE↔NUTS resterait à prouver Land par Land | **Données oui, carte non** |
| **Régions UE (NUTS1/2)** | ✔ CORDIS `nutsCode` sur toute l'Europe élargie ; **noms officiels licites** (CC BY 4.0) | ❌ géométrie GISCO exclue | **V1 SANS carte** (classement, barres, panneau) |
| Autres (CA, AU…) | ✖ nos sources ne portent pas leurs subdivisions | — | Attendra leurs sources |

Le point d'honnêteté : pour l'Europe, la VALEUR (quelles régions
captent les programmes-cadres) est disponible tout de suite — c'est la
géométrie qui pose une question de licence, pas la donnée. Une V1
« régions UE » non cartographique est donc possible dès S1-S3 livrés,
si tu la veux.

### Vérification GISCO du 2026-08-17 — la question est tranchée

Faite à la source, aux pages officielles Eurostat, et portée au
[registre des sources](data-sources.md). Deux objets, deux licences :

- **la géométrie** (limites administratives, dérivées d'EuroGeographics)
  est accordée à la condition que « *the data will not be used for
  commercial purposes* », et renvoie l'usage commercial à un **accord
  négocié** avec EuroGeographics → **exclusion définitive**, sur deux
  motifs de notre règle plutôt qu'un ;
- **la nomenclature NUTS** (codes ET noms de régions) est une donnée
  statistique Eurostat en **CC BY 4.0** (décision 2011/833/UE) :
  réutilisation commerciale explicitement autorisée avec mention de la
  source → **elle passe**, et le `nuts_code` de CORDIS avec elle.

Ce que ça change ici : la ligne « carte sous réserve » disparaît des
deux lignes européennes du tableau. Le lot F se fait **sans carte**,
avec les vrais noms de régions — ou ne se fait pas. Et l'appariement
Natural Earth↔NUTS est écarté par principe, pas seulement par prudence :
faire coïncider deux découpages différents fabriquerait une
approximation silencieuse, c'est-à-dire l'inverse exact de la règle du
lot E.

## 5. Décisions à trancher avant lancement

1. **Côté bénéficiaire confirmé** (contre lieu d'exécution NSF) — ma
   recommandation : oui, cohérence avec le pays.
2. **Périmètre V1** : États-Unis seuls, ou + la passe NUTS de backfill
   dès S1 (coût marginal ~0,5 j, la carte UE attendra) — ma
   recommandation : backfill NUTS inclus, surfaces UE plus tard.
3. **Médaillons AK/HI** : standard cartographique, à valider en
   maquette avec la choroplèthe.
