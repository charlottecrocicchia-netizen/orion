# Outillage local — Orion.app, corpus de recette, base e2e séparée

> Chantier confort local (2026-08-22). Tout ici est strictement local
> au Mac : aucun geste vers le VPS ni la production, jamais.

## Ouvrir Orion local (l'usage normal)

1. Double-cliquer sur **`Orion.app`** (Bureau).
2. Attendre Firefox (notification « Orion local est prêt »).
3. Saisir **`dev@lensorion.test`**.
4. Cliquer sur **« Ouvrir le lien de développement → »**.
5. Confirmer la connexion.

C'est le vrai flux d'authentification (token à usage unique, session,
cookies) — seule la livraison de l'email est remplacée, en local
uniquement (`ORION_AUTH_DEV`, impossible en production où le compose
l'épingle à `0`).

Un second double-clic ne duplique rien : il réutilise les services
sains et rouvre Firefox. **`Stop Orion.app`** (Bureau) arrête l'API et
le frontend ; la base Postgres de dev reste allumée (coût négligeable).
En ligne de commande : `./scripts/orion-local.sh` et
`./scripts/orion-local-stop.sh` (`--db` pour éteindre aussi la base).

## Initialisation du corpus (une fois)

`./scripts/bootstrap-local-review.sh` copie le corpus complet
(699 798 projets, photographie du 2026-08-21) depuis le volume local
`orion_pgdata` — jamais modifié — vers la base de dev `orion`, applique
les migrations, moissonne les appels Funding & Tenders, vérifie les
invariants. ~10-20 minutes, ~10 Go dans la VM Docker, dump réutilisable
dans `~/orion-dumps/`. Destructif pour la seule base de dev `orion`
(confirmation exigée ; `--yes` pour l'automate). Orion.app propose
cette initialisation au premier lancement si le corpus manque — jamais
en silence.

Honnêteté de perfs : la base de recette tourne sur le petit tuning du
Postgres de dev (256 Mo de cache) — les recherches plein-texte y sont
nettement plus lentes qu'en production. C'est un poste de recette
visuelle, pas un banc de performance.

## La base e2e est séparée — règle de survie

`./scripts/e2e-local.sh` détruit et resème librement **sa** base :
**`orion_e2e`**. Il ne touche plus jamais à `orion`, qui porte le
corpus de recette manuelle. (`orion_test` reste la base de pytest,
inchangée.) Ne restaurez jamais un corpus dans `orion_e2e` : la graine
synthétique est son contrat.

Nuance de PORTS (pas de bases) : la suite e2e monte son propre API sur
`:8000` — arrêter Orion local d'abord (`Stop Orion.app` ou
`./scripts/orion-local-stop.sh`), sinon la suite trouvera le port pris.
Les données, elles, sont isolées quoi qu'il arrive.

## Journaux et diagnostic

`~/Library/Logs/Orion/` : `launcher.log` (démarrages, arbitrage des
ports, choix corpus), `api.log`, `web.log`, `calls-refresh.log`. Aucun
lien magique ni token n'y est écrit.

## Conflit de port

Le lanceur arbitre 8000/5173 en trois classes : service démarré par
lui et sain → réutilisé ; processus Orion de ce dépôt (un uvicorn/vite
lancé à la main ou par un harnais) → arrêté proprement puis relancé ;
**processus étranger → jamais arrêté** — le lanceur affiche « Le port
N est utilisé par X ; Orion ne l'a pas arrêté » et s'arrête. Dans ce
cas : libérer le port soi-même, puis relancer Orion.app.

## Fraîcheur des appels

Au lancement, si la dernière moisson `calls` réussie date de plus de
24 h (ou n'existe pas), le lanceur la relance **en arrière-plan**
(`calls-refresh.log`) — l'interface s'ouvre sans attendre. Pas de
scheduler permanent en local : ce serait de la complexité gratuite.

## Les deux piles, pour mémoire

- **Recette (Orion.app)** : Postgres de dev + API `:8000` + vite
  `:5173`, hot reload, auth dev — c'est ici qu'on recette le code en
  cours.
- **Prod locale `:8080`** (`make up`, lanceur historique reconstruisible
  via `infra/launcher/install.sh`, désormais sous le nom « Orion prod
  locale.app ») : images construites, auth de prod, volume
  `orion_pgdata` — la source intacte du corpus.
