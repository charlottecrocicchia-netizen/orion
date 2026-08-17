# Curation — le fichier est l'interface

## Les lentilles (`lenses/`)

`lenses/registry.csv` est le registre famille → lentille
(`family_key,slug,rank`) : la clé de famille est TECHNIQUE et stable
(`aerospace_mobility`), jamais un libellé — les mots vivent en i18n. Le
rang ordonne les verticales (rang 1 = le hero). Chaque lentille du
registre a son fichier de règles `lenses/<slug>.csv` (trois familles :
`programme` en sous-arbre, `theme` par préfixe euroSciVoc, `text` cadré
par source) — le chargeur (`orion-ingest lenses`) refuse autant un CSV
hors registre qu'une entrée sans CSV, mire le registre dans la table
`lenses`, et RÉTAGUE chaque lentille en entier sous son run
`<slug>-lens`. Une lentille est une LECTURE du corpus, jamais une
partition : un projet peut porter plusieurs lentilles, chaque vue n'en
lit qu'une, et les nombres de deux lentilles ne s'additionnent jamais
(conception multi-lentilles, D1-D3, validée 2026-08-17).

## Les groupes (`groups.csv`)

`groups.csv` porte les faits humains de la couche identité : une ligne =
un rattachement (`attach`) ou un refus (`refuse`), toujours avec son
évidence et sa source publiques. La revue de PR est l'interface de
curation ; le diff git est le journal d'audit.

| colonne | rôle |
|---|---|
| `group_lei` / `group_name` | le groupe (LEI d'abord, nom exact sinon) |
| `org_name` / `org_country` | l'organisation, par son nom EXACT du corpus + pays (portable, contrairement aux ids) |
| `decision` | `attach` ou `refuse` (un refus fait taire le radar des homonymes) |
| `confidence` | 0–1, obligatoire pour `attach` |
| `is_jv` / `share` | coentreprise pondérée : un 67/33 reste un 67/33 |
| `valid_from` / `valid_to` | fenêtre de validité (AAAA-MM-JJ, optionnelle) — une filiale cédée garde son histoire sans mentir sur le présent |
| `evidence` | la phrase qui justifie (lisible par un humain) |
| `source` | où le vérifier (registre, document public, site du groupe) |

Le chargeur (`orion.ingest.groups.curation`) est TOUT OU RIEN : une ligne
fausse — décision inconnue, évidence vide, organisation introuvable, JV
sans part — et rien ne se charge. Les lignes remplacent intégralement les
adhésions `method='curation'` et la table des refus à chaque run
(`make identity`, ou `make prod-ingest SOURCES="groups"`). Le rebuild
automatique gleif/wikidata ne touche jamais à la curation, et
réciproquement.

Les PROPOSITIONS en attente de validation vivent dans
`docs/curation-fournee-*.csv` — même format. Validées, elles se déplacent
ici telles quelles.
