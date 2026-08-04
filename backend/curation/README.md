# Curation des groupes — le fichier est l'interface

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
