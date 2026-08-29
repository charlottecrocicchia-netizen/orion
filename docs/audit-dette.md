# Audit de dette — Chantier Hygiène

**Date : 2026-08-29 · HEAD `f069ef2` · 358 commits · aucun code modifié dans ce lot.**

Méthode : six balayages indépendants sur pièce (code mort, incohérences, modularité,
tests, doc vs réel, infra), chaque constat vérifié par chemin:ligne ou commande.
Les suites unitaires ont été exécutées ; le serveur a été inspecté en lecture seule
(`ssh orion-vps`) ; rien n'a été corrigé, prune, ni committé côté serveur.

## Verdict en trois phrases

Le code vivant est propre — zéro TODO/FIXME sur 358 commits, zéro test snapshot,
zéro dépendance morte, la frontière FK workspace↔corpus tenue à 100 %, ~710 lignes
de code mort certain seulement. La dette réelle est ailleurs : **des canons écrits
puis non adoptés** (`LENS_PARAM` contourné 38 fois, `breadcrumb.tsx` mort le jour
de sa naissance, la doctrine « jamais 0 % » appliquée sur 1 surface sur 7) et **une
documentation qui a décroché du produit** (README figé au 31 juillet avec un
quickstart qui aboutit à une porte fermée, 9 chantiers livrés absents du CHANGELOG,
13 docs de conception qui jurent « rien n'est codé » sur du code en production).
Le point le plus dangereux n'est pas dans le code : l'archive brute R5-NSF, déclarée
non re-téléchargeable, n'existe que sur ce Mac (hors git) et dans un volume du VPS —
aucun runbook ne la transfère, aucune sauvegarde ne la couvre.

---

## Tableau récapitulatif priorisé

Gravité : **B** bloquant · **G** gênant · **C** cosmétique. Effort : heures / session / chantier.

### Bloquant

| # | Item | Où | Effort |
|---|---|---|---|
| B1 | Archive brute R5-NSF (« seule archive brute, pas re-téléchargeable ») hors git, hors sauvegarde, hors runbook de provisionnement | `backend/data/r5-nsf/` (gitignoré), `docs/runbook-nsf-obligations.md` §1, `infra/README.md` | heures–session |
| B2 | README mort depuis le 31/07 : « Phase 0, no real data », sources fausses (ANR/ADEME/LIFE), quickstart qui aboutit à une porte auth fermée sans issue documentée | `README.md` (dernier commit `17e632c`) | session |
| B3 | CHANGELOG : 9 chantiers livrés en prod sans aucune entrée (accès privé/comptes, Reference Engine R1–R4, R5B, A1 Aviation, M0–M1.4, Lens Room, lot F NUTS, outillage local, pondération coentreprises) | `CHANGELOG.md` (trou du 06/08 au 22/08, ~120 commits feat/fix) | chantier |
| B4 | Runbook de déploiement étape 9 = `git pull && make up`, supplanté par `deploy.sh` atomique mais jamais corrigé — et **cité comme référence** par `reste-a-faire.md` §4 | `docs/conception-deploiement.md` §4 ; `docs/a-faire/reste-a-faire.md` §4 | heures |
| B5 | Smoke test de `deploy.sh` vise `localhost:8080` alors que la prod écoute sur 80 : `make deploy` sort en erreur après une bascule réussie (dette connue de `reste-a-faire.md` §8, absente d'`infra/README.md`) | `infra/deploy.sh` (dernière ligne) | heures |
| B6 | `etat-des-lieux-produit.md` (« écrit pour des regards extérieurs ») déclare `/calls` et `/workspace` « vitrine sans fonction » — les deux sont fonctionnels — et ignore `/money`, `/nsf-obligations`, `/login` | `docs/etat-des-lieux-produit.md` (22/08) | 1 h de bandeau, chantier pour la refonte |
| B7 | Test UKRI raté par le moteur de chaîne : 3 financeurs en dur dans **10 registres** de `chain.py`, dont un défaut silencieux `.get(funder.code, "cordis")` (`:606`) qui présenterait des livres sterling comme une contribution UE en euros, et un `continue` (`:266`) qui rendrait un financeur chargé invisible à la racine `/chain/funders` | `backend/src/orion/search/chain.py:59-126, 150-199, 266, 606, 1123, 1185, 1236` | session (registre `FUNDER_PROFILE`) |
| B8 | Test UKRI côté front : `sourceLabel` retombe sur `"CORDIS"` par défaut (le commentaire jure « a badge can never lie about its origin ») et `moneySymbol` retombe sur `€` — un badge et une devise faux par construction pour toute source nouvelle | `frontend/src/lib/format.ts:7, 13-15, 253-256` ; `money-trail.tsx:86` | heures |
| B9 | Renommage `sector`→`lens` promis « diff d'une ligne » par `LENS_PARAM` — en réalité 38 sites écrivent `sector=` en dur, dont 32 URLs de decks dans `stories.ts` | `frontend/src/lib/lens.ts:31` vs `stories.ts`, `home.tsx:340`, `call-detail.tsx:308`, `lens-room.tsx:92`, `landing.tsx:146`, `about-data.tsx:175` | chantier |
| B10 | La doctrine B2 (plancher, godet neutre, non-ventilé jamais caché) n'est testée qu'à travers les rayons d'étoiles (`[data-star]`, `data-r`) : remplacer la scène détruit la preuve des invariants | `frontend/src/test/money-trail.test.tsx:688-886` (~13 tests) | chantier |
| B11 | Zéro test unitaire sur `lib/api.ts` (1 129 l.) et `pages/explorer.tsx` (1 464 l.) ; scène céleste (1 725 l.) couverte uniquement par l'e2e ; `seed_e2e.py`, fondation des 35 specs, non testé | `frontend/src/lib/api.ts`, `pages/explorer.tsx`, `backend/scripts/seed_e2e.py` | chantier |
| B12 | Couplage d'ordre entre modules pytest : 8 fixtures `scope="module"` committent puis nettoient par `DELETE` en clair (dont `DELETE FROM countries WHERE code='FR'` inconditionnel ×2 et 3 `DELETE` sans WHERE) — la suite n'est verte que dans un ordre | `backend/tests/test_call_actors.py:15-30,162`, `test_call_opportunities.py`, `test_nsf_obligations.py:298`, `test_accounts.py:47` | chantier |
| B13 | Docs `conception-a1-aviation.md` (« AUCUNE règle chargée » — lentille published v2, 179 règles) et `conception-r4-ppp.md` (« aucun code, aucune surface touchée » — R4B livré) : un lecteur peut recharger/écraser sur leur foi | `docs/conception-a1-aviation.md`, `docs/conception-r4-ppp.md` | heures (bandeaux) |
| B14 | Cache d'agrégats non invalidé par une source hors `CORPUS_SOURCES` : toute source nouvelle servirait des chiffres périmés en silence ; et `ATTRIBUTIONS` sans entrée = fiche projet sans mention de licence (règle n°1 de `data-sources.md`) | `backend/src/orion/search/service.py:34` ; `api/projects.py:12-22` | heures |

### Gênant

| # | Item | Où | Effort |
|---|---|---|---|
| G1 | Version affichée : le runtime backend annonce `0.1.0` (`__init__.py` jamais bumpé par la release `87f39eb`) → la page à-propos affiche « v0.4.0 » au pied et « Version 0.1.0 » dans l'état système, rationalisé après coup dans l'état des lieux au lieu d'être corrigé | `backend/src/orion/__init__.py:1` → `main.py:47`, `api/health.py:34` → `frontend/src/pages/about-data.tsx:281` ; footer en dur `i18n.ts:1267,2905` | heures |
| G2 | 11 autres docs de conception « périmés-et-trompeurs » (« rien n'est codé » sur du livré) : e2-acteurs, space-natif, symetrie-geo, drill-etats, couverture, globe-accueil, recherche-composable, architecture-site, a-euros-constants, parcours-visualisations, architecture-information | `docs/conception-*.md`, `docs/architecture-*.md` | session (bandeaux d'état) |
| G3 | `roadmap.md` se déclare « tenu à jour à chaque validation » et s'arrête au 18/08 : Lens Room « après A1 seulement » (livrée le 19/08), Reference Engine et Workspace absents en totalité | `docs/roadmap.md` | session |
| G4 | Job `deploy` de la CI : contredit « deliberately no CI/CD » d'`infra/README.md`, tire de GHCR contre la décision D1, et court-circuite la porte snapshot D7 bis (un `workflow_dispatch` déploierait sans confirmation) | `.github/workflows/ci.yml:218-245` | heures |
| G5 | `auth.ts` jette le `detail` d'erreur (`throw new Error("HTTP …")`) : tout le parcours connexion ne peut pas distinguer `INVALID_LINK` d'un 400 générique — et 3 grammaires de `detail` backend coexistent, dont une (dict) illisible par `api.ts:29` | `frontend/src/lib/auth.ts:29-36` ; `backend/src/orion/api/{auth,calls,dossiers,explore,chain}.py` | heures + demi-session |
| G6 | La vue B2 recalcule de la sémantique comptable : non-ventilé agrégé refait côté client (seuil `> 1` local), invariant « montant d'un appel = somme des projets » en dur, famille déduite par préfixe de clé, liste blanche des mesures dupliquée avec repli « clé brute affichée » | `frontend/src/pages/money-trail.tsx:66-80, 87-88, 117-123, 968-993` | session |
| G7 | Scène céleste non extractible : `SHOWN_SLOTS=11` (constante de mise en scène) décide du contenu du godet « + N autres » ; `SCENE_TINTS` est une Map module-level jamais purgée dont dépend le fil d'Ariane ; `.chamber` habille des surfaces sans étoile | `money-trail.tsx:550, 620-632, 975-980` ; `index.css:276-459` | chantier (extraction) |
| G8 | Dossiers durables (socle) stockent des IDs internes de corpus non stables : `programme=<programmes.id>` (clé auto-incrément) et des `organisations.id` que `dedup/merge.py:143` supprime — une vue sauvegardée peut pourrir sans détection ni message | `backend/src/orion/api/explore.py:33` ; `ingest/dedup/merge.py:95-145` ; `frontend/src/pages/saved-dossier.tsx:89` | session |
| G9 | Doublons de formatage : montants (5 réimplémentations, dont `stat-hero` en `€…B` codé en dur et un seuil d'axe divergent dans `charts.tsx:236`), parts % (6 implémentations, la doctrine anti-faux-zéro de `format-share.ts` suivie par 1 surface sur 7), dates (4 conventions, seule `lib/calls.ts` fixe un `timeZone` — décalage d'un jour possible sur des deadlines) | `frontend/src/components/stat-hero.tsx:40`, `charts.tsx:236`, `lib/format-share.ts`, `lib/calls.ts` et consorts | session cumulée |
| G10 | `breadcrumb.tsx` né mort le 27/08 (0 importeur) alors que la conception B2 §15.2 le déclare partagé ; 7 fils d'Ariane recopiés à la main, seul le mort a la sémantique `ol/li` + `aria-current` | `frontend/src/components/breadcrumb.tsx` ; 6 hubs + `TrailBreadcrumb` | demi-session |
| G11 | Palette sombre forkée : `.dark .chamber` redéfinit 17 tokens dont **5 divergent silencieusement** de `.dark` (`--background`, `--surface`, `--muted-foreground`, `--border`, `--border-soft`) et 12 sont recopiés à l'identique — toute évolution de charte à faire deux fois | `frontend/src/index.css:50-75` vs `:287-306` | demi-session |
| G12 | 32 clés i18n mortes ×2 langues (~80 l.), dont deux générations de l'accueil superposées à 2 lignes d'écart — `i18n.ts` ne se lit plus comme la vérité du vocabulaire produit ; et une clé absente des deux langues s'affiche brute à l'écran sans qu'aucun test l'attrape | `frontend/src/i18n.ts:115-126, 179-182, 431-451…` (liste au volet ①) | heures |
| G13 | Aucun outil de couverture configuré (ni vitest coverage, ni pytest-cov, ni CI) ; gold tests NSF (194 l.) skippés en permanence en CI faute d'artefacts | `frontend/package.json`, `backend/pyproject.toml`, `backend/tests/test_nsf_obligations_gold.py:30` | session / chantier |
| G14 | 12 `eslint-disable exhaustive-deps` sans justification (jusqu'à 28 jours d'âge, concentrés sur `search-composer`, `explorer`, `world-globe`) ; import différé `explore.py:34` signant un cycle `search`↔`ingest` | grep `frontend/src` ; `backend/src/orion/search/explore.py:34` | demi-session |
| G15 | Deux venvs backend concurrents (`backend/.venv` py3.13 vs `~/.venvs/orion-backend` imposé par le Makefile) : `uv run pytest` nu ≠ `make test` ; et le `find backend/.venv -name "*.pth"` du Makefile vise le mauvais venv (neutralisé par `|| true`) | `Makefile` | session |
| G16 | Rotation des sauvegardes : les dumps manuels pré-migration (`orion-pre-*`) matchent le glob `orion-*.dump -mtime +7 -delete` et sont supprimés silencieusement après 7 jours ; restauration d'essai exigée par le script lui-même, aucune trace datée d'une exécution | VPS `~/orion/infra/backup-db.sh` ; `~/backups` (15 dumps, 20 G) | heures |
| G17 | Logs Docker prod sans rotation : pas de `daemon.json`, aucune section `logging:` dans `compose.prod.yml` → json-file non borné (postgres up 7 j) — bombe lente | VPS `/etc/docker/`, `~/orion/infra/compose.prod.yml` | heures |
| G18 | CI muette depuis le 26/08 (échec en 5 s à chaque push, quota) : aucun filet — plan de réactivation au §6 | `.github/workflows/ci.yml` ; `gh run list` | heures (le 01/09) |
| G19 | `/money` sans aucune spec e2e (la surface la plus interactive du produit) alors que chaque autre chantier a la sienne (36 specs) | `frontend/e2e/` | demi-session |
| G20 | Nommage backend incohérent : `api/nsf_obligations.py` vs `search/nsfobligations.py`, deux moitiés du même domaine créées le même jour avec deux orthographes ; `callstatus.py`, `constanteuro.py`, `ftcalls/` concaténés | `backend/src/orion/` | heures |
| G21 | 42 des 47 endpoints retournent `dict[str, Any]` : l'OpenAPI n'a aucun schéma, le front maintient 55 interfaces à la main — deux contrats parallèles sans vérification croisée | `backend/src/orion/api/*.py` vs `frontend/src/lib/api.ts` | chantier |
| G22 | Monolithes : `money-trail.tsx` 2 299 l. (8 rôles, 20 % de `pages/`), `search/chain.py` 1 358 l., `search/explore.py` 1 417 l., `i18n.ts` 3 247 l. (63 importeurs), `api.ts` 1 129 l. (42 importeurs) | — | chantier |
| G23 | `hebergement.md` : tuning §2 désynchronisé des deux compose (3 valeurs de `shared_buffers`, 3 tailles de base contradictoires) ; §§7-8 présentent comme ouvertes des décisions exécutées depuis 5 semaines | `docs/hebergement.md` | heures |
| G24 | `world-tints.ts` et `stories.ts` codent `space`/`aviation` en dur alors que `lens.ts` promet « plus aucune surface ne sait ce qu'est space » | `frontend/src/lib/world-tints.ts:4-7`, `stories.ts` | session |
| G25 | `METRICS` (`explore.py:31`) : constante d'énumération jamais branchée sur la validation — piège pour qui y ajoutera une métrique en croyant l'activer | `backend/src/orion/search/explore.py:31` vs `api/explore.py:84-163` | heures |

### Cosmétique

| # | Item | Où | Effort |
|---|---|---|---|
| C1 | Code mort certain : `partner-graph.tsx` (97 l., mort depuis `fd6324e` du 03/08 — confirmé), bloc CSS `.lens-room-*` + keyframes (~38 l., orphelin depuis `fc9f0b6`), package `analytics/` vide, `useActiveLens`, `fix_org_types.py` (one-shot accompli), 2 constantes Python, 2 maquettes design non liées | volet ① — ~710 l. au total | session (~2 h 30) |
| C2 | `BRIEF.md` : archive fondatrice non marquée comme telle (chiffres ×6,6, positionnement inversé) — à bander, surtout pas à réécrire | `BRIEF.md` | 15 min |
| C3 | 3 scripts utiles mais introuvables : `audit_ppp_conventions.py` (filet méthodologique, 0 référence), `claude-dev.sh` (absent d'`outillage-local.md`), `install-local.sh` (0 occurrence dans `docs/`) — à référencer, pas à supprimer | `backend/scripts/`, `scripts/`, `infra/launcher/` | heures |
| C4 | `design-doctrine.md` « prime sur tout » mais ignore `ROOM_TOKENS` et `.chamber`, et a été arbitrée contre en recette B2.10 sans le consigner | `docs/design-doctrine.md` | heures |
| C5 | ~600 tailles `[Npx]` arbitraires sans échelle typographique (record : `money-trail.tsx`, 96) ; 24 couleurs hex en dur dans le TSX recopiant des tokens existants | `frontend/src` | chantier / heures |
| C6 | Assertions couplées à l'implémentation : `dataset.r === "5"`, `closest("div.border-b")`, comptage de `<polyline>`, IDs `ck-opt-*`, sélecteurs e2e `.pin-spacer` (classe interne GSAP) et `[class*='snap-x']` | volet ④, détail ci-dessous | session cumulée |
| C7 | 8 copies du patch `URLSearchParams`, 4 micro-graphes SVG jamais mutualisés, 3 accès `localStorage` sans try/catch, fenêtres « matures » copiées 3 fois avec replis divergents, `lib/workspace.ts` homonyme trompeur du socle | volet ② | heures chacun |
| C8 | VPS : ~7 G Docker récupérables (cache de build 5,8 G + 2 images dangling 1 G), vestiges `~/r5-nsf-staging` (392 M) et `~/transfer-b01` (119 M, zips CORDIS), 15 paquets apt upgradables | VPS | heures |
| C9 | Message du commit `f069ef2` annonce « CHANGELOG réécrit » pour 34 lignes dans un seul bullet ; commentaire mort « participants en donut » à `money-trail.tsx:1950` ; §§15.13-15.15 sans marqueur de supersession | `CHANGELOG.md`, `money-trail.tsx:1950`, `conception-b…md` | minutes |
| C10 | Vitest : 43 s CPU d'instanciation jsdom pour 26 s de tests (21 environnements, `i18n.ts` réimporté) | `frontend/vitest` config | heures |

---

## ① Le code mort et les vestiges — moisson courte, et c'est prouvé

`noUnusedLocals`/`noUnusedParameters` étant actifs, seul du code mort *structurel*
peut survivre. Total mort certain : **~710 lignes, une session de nettoyage**.

- **`partner-graph.tsx` : mort confirmé** (97 l.). Dernier importeur retiré par
  `fd6324e` (03/08), remplacé par `collaborators-map` + `role-timeline`. Seules
  références restantes : deux docs de conception.
- **Les directions abandonnées n'ont rien laissé** — vérifié piste par piste :
  les 9 sélecteurs des trois directions B2.10 ont tous disparu ; le donut de
  `f2179ae` est parti avec tout son code (revendication « zéro dette morte »
  tenue) ; **`d5b325b` (B2.11 annulé) ne touche que le CHANGELOG** — le chantier
  annulé n'avait jamais été committé, et Orbite/Carte stellaire/montgolfières
  sont *l'état livré actuel*, pas un vestige. Le CSS orphelin restant vient de
  plus loin : le bloc `.lens-room-*` (`index.css:525-562`) rendu obsolète par la
  scène optique `fc9f0b6`.
- **i18n : 32 clés mortes ×2 langues**, dont deux générations de l'accueil
  superposées (`entryThemes*` vs `doorDiscover*`) et le bloc « signaux »
  supplanté par le ticker. 223 clés à construction dynamique sont couvertes par
  41 motifs de template relevés — **inauditables par grep, à ne pas toucher**.
- **Pièges à ne PAS supprimer** : les 5 tokens `--region-*` (consommés via
  `` `var(--region-${region})` ``, `regions.ts:31`), `donut-chart.tsx` (celui de
  l'Explorateur, pas celui retiré en `f2179ae`), les 33 tokens `@theme inline`
  (ils génèrent des classes utilitaires, pas des `var()`).
- **Dépendances : rien à retirer**, ni npm (29 vérifiées, y compris `gsap`,
  `@types/node`, le `httpx2` justifié en commentaire) ni pip. Seule réserve :
  `@radix-ui/react-slot` n'existe que pour un prop `asChild` jamais passé —
  à garder si le motif `<Button asChild><Link/>` est anticipé.

## ② Les incohérences — le vrai motif : des canons contournés

- **0.1.0 vs 0.4.0 : réel, et rationalisé au lieu d'être réglé.** La release
  `87f39eb` a bumpé les deux manifestes mais pas `backend/src/orion/__init__.py:1`,
  qui alimente l'OpenAPI et le bloc santé de la page à-propos. Le pied de page
  « v0.4.0 » est une chaîne i18n dupliquée dans les deux bundles. L'état des
  lieux du 22/08 a inventé après coup un « numéro d'API distinct » que rien dans
  le code ne justifie. Un bump exige aujourd'hui d'éditer 5 fichiers.
- **Zéro TODO/FIXME/HACK sur tout le dépôt** (vérifié avec les équivalents
  français) — propriété suivie et documentée. La dette n'est pas là : elle est
  dans **l'abstraction extraite puis contournée dans les heures qui suivent** —
  `LENS_PARAM` (38 sites en dur), `format-share.ts` (1 importeur sur 7 surfaces
  concernées), `breadcrumb.tsx` (0), `chain-routes.ts` (2 appels, 6 URLs
  réécrites à la main dans le même fichier), `country-flags.tsx` (1).
- **Deux clients HTTP** : `auth.ts` jette le code d'erreur que `api.ts`
  documente comme vital — tout le parcours connexion est aveugle aux refus typés.
- **`.dark .chamber`** : 5 tokens divergents, 12 recopiés — la charte sombre
  vit en deux exemplaires non testés.
- Doublons complets (montants, parts, dates, troncatures, fenêtres matures,
  micro-graphes, patch URLSearchParams) : voir tableau G9/C7.
- **Dérogations linter** : 12 `exhaustive-deps` sans justification (le plus vieux
  a 28 jours) ; côté backend 11 `noqa` sur 14 sont justifiés en clair — les 8
  `ARG001` signalent en creux un paramètre `force` accepté par 8 modules
  d'ingestion et honoré par aucun (un protocole partagé serait la vraie correction).

## ③ La modularité réelle — trois frontières tiennent, une casse

- **Moteur de chaîne ↔ représentation : propre côté backend** (`chain.py`
  n'importe que decimal/typing/sqlalchemy/models, zéro fuite de vue, adaptateur
  API mince). Côté front, la vue recalcule 4 morceaux de sémantique comptable
  (G6) — « l'UI ne devine rien, elle lit » est tenue à ~85 %.
- **Scène céleste : remplaçable sans toucher au backend, pas sans toucher au
  reste.** ~440 l. de scène et ~190 l. de CSS sont incrustées dans la page ;
  `SHOWN_SLOTS` décide du *contenu* montré, pas seulement de la forme ;
  `SCENE_TINTS` est un état global hors React ; et 13 tests de doctrine sont
  écrits en assertions de rayon d'étoile (B10). Après découplage : une session
  pour changer de scène ; aujourd'hui : un chantier.
- **Test UKRI : la promesse « zéro changement de moteur » est vraie pour le
  Reference Engine** (juridictions, macro, taux — GBP déjà présent, architecture
  exemplaire) **et fausse pour le moteur de chaîne** : 6-7 fichiers à créer,
  **24 à modifier**, dont 11 avec 500, omission silencieuse ou affichage faux.
  Les deux pires : `chain.py:606` (livres sterling présentées comme contribution
  UE en euros) et `chain.py:266` (financeur chargé mais invisible à la racine).
  Le chantier préalable est un registre unique `FUNDER_PROFILE` avec refus
  explicite — une session, à faire *avant* toute source nouvelle.
- **Socle workspace : frontière FK tenue à 100 %**, vérifiée sur les 37
  `ForeignKey` du dépôt et la migration 0030. Le couplage résiduel est
  sémantique (G8) : des IDs internes non stables dans les URLs persistées,
  que la dédup peut faire pourrir sans détection.
- **Shotgun surgery** : le cluster « par source de financement » touche 13 sites
  répartis sur les deux langages, dont 4 à fallback silencieux ; `i18n.ts` et
  `api.ts` sont les deux hubs où tout converge.

## ④ Les tests et leur valeur

- **État mesuré** : frontend 21 fichiers / 169 tests / 169 verts en 18,5 s.
  Backend : 372 tests collectés en 1,1 s, non exécutables sans Postgres local
  (Docker éteint au moment de l'audit — service absent, pas défaut de suite ;
  durée réelle non mesurée, plafond CI 15 min). E2E non lancé (35 specs,
  1 worker assumé, 2 moteurs pour le ticker).
- **Le skip ticker n'est pas revenu.** Supprimé le 23/08 (`9a4e1d2`), remplacé
  par `expect.poll`, absent de HEAD, aucune réintroduction dans l'historique.
  Le dépôt compte **un seul skip au total** — NSF gold, nommé et documenté
  (mais permanent en CI : un verrou qui ne tourne jamais n'est pas un verrou, G13).
- **Zéro snapshot, zéro `only`, zéro `toHaveClass`** — la discipline « interroger
  par rôle ARIA » est réellement tenue en majorité. Les couplages restants :
  `data-*`/`dataset.r === "5"` dans `money-trail.test.tsx`, comptage de balises
  dans `bump-chart`, sélecteurs `.pin-spacer` (interne GSAP) et `[class*='snap-x']`
  en e2e (C6).
- **Les trous qui comptent** : `api.ts`, `explorer.tsx`, la scène céleste,
  `now-ticker`+`stories` (la zone qui a produit les skips de course),
  `seed_e2e.py` (si la graine dérive, 35 specs mentent ensemble), et côté
  backend `callstatus.py`, `ingest/prices/`, `auth/deps.py` (B11, G13).
- **Le risque structurel** : l'isolation par committed-state + DELETE manuels
  (B12) — verte dans un seul ordre, avec 93 assertions ordonnées qui amplifient.

## ⑤ La doc face au réel

- **Classement des 21 `conception-*.md`** : 7 à jour (dont B2 §15.16 « état
  livré », accès-privé, déploiement annexes, reference-engine amendé), 2 périmés
  mais datés comme tels, **13 périmés-et-trompeurs** — ils affirment « rien
  n'est codé / soumis à arbitrage » sur des chantiers en production (B13, G2).
  Le remède est mécanique : un bandeau « ÉTAT : LIVRÉ le …, commit … — document
  historique » en tête de chacun. Une session, aucun contenu à réécrire.
- **README : le pire fichier du dépôt** (B2). Jamais retouché en 358 commits.
  Le quickstart documenté aboutit à une landing dont la porte est fermée
  (`auth_dev=False`, allowlist vide = porte close) sans qu'aucun chemin
  d'entrée soit documenté — les chemins qui marchent (`claude-dev.sh`,
  `orion-local.sh`) ne sont cités nulle part. L'exigence BRIEF §6 (« un tiers
  lance en 15 minutes ») n'est plus tenue.
- **CHANGELOG : sous-déclare massivement, ne sur-déclare jamais** (B3). Le
  fichier n'a pas bougé du 06/08 au 22/08 (~120 commits feat/fix). Aucune
  entrée fantôme trouvée — c'est le bon sens de l'erreur, mais le pivot
  « produit privé » lui-même (changement de nature du produit) n'a zéro ligne.
- **Runbooks** : l'essentiel tient (noms de conteneurs, volumes, commandes
  d'ingestion, annexe C de restauration, runbook NSF §2/§4 — tous vérifiés
  exacts). Trois cassures : l'étape 9 supplantée (B4), le smoke test 8080 (B5),
  et le trou R5-NSF (B1). Plus `hebergement.md` désynchronisé (G23) et
  `outillage-local.md` qui ignore `install-local.sh` et date son corpus
  d'avant B0.1 (C3).

## ⑥ L'infra

**Serveur (sain dans l'ensemble)** : disque 60 % (43 G/72 G) dont 20 G de
sauvegardes ; 5 conteneurs up et healthy ; `/var/log` sous logrotate ; 0 paquet
apt orphelin, 15 upgradables, pas de reboot requis. Le cron de dump tourne
chaque nuit sans échec depuis sa pose.

Les quatre points à traiter : la rotation qui avale les dumps manuels
pré-migration (G16 — exclure `pre-` du glob ou dossier séparé), l'absence de
rotation des logs Docker (G17 — `daemon.json` ou `logging:` dans le compose),
la restauration d'essai jamais tracée alors que le script l'exige (G16), et
~7 G Docker récupérables + 511 M de vestiges home (C8). Le hors-site repose sur
le backup OVH du disque entier (affirmé, non vérifié ici) — **sauf** pour
l'archive R5-NSF qui n'est dans aucun périmètre (B1).

**CI — plan de réactivation au 1er septembre** (proposé, non exécuté) :

1. Les deux demandes du brief sont **déjà en place** : `timeout-minutes` sur les
   5 jobs (15/15/30/20/20, garde-fou de l'incident du 19/08 commenté dans le
   workflow) et cache Playwright par version avec install `chromium firefox`
   seuls sous timeout propre. Rien à ajouter avant réactivation.
2. Le 01/09 : déclencher un `workflow_dispatch` (sans `deploy`) sur la tête de
   main — valide les 4 jobs d'un coup sans attendre un push.
3. Poser un guetteur sur ce run id précis (jamais de boucle sur un id vide ;
   le tuer si un push le supersède).
4. Au premier run vert, vérifier : cache Playwright hit, budget latence
   `bench_api.py` tenu, et si `prune-cache: false` (contournement uv 0.12.5
   du 17/08) est encore nécessaire.
5. Ensuite seulement, réévaluer la décision D1 (build sur serveur vs images du
   registre — `deploy.sh` la conditionne explicitement à « tant que la CI n'en
   publie pas de fraîches ») et le sort du job `deploy` (G4 : en l'état il
   court-circuite la porte snapshot).
6. Coût de garde : les timeouts plafonnent un incident à ~100 min de quota.

---

## Recommandation d'ordre de traitement

**Lot 0 — les heures qui enlèvent du danger (avant tout le reste)**
B1 (rsync + archivage R5-NSF), B5 (smoke test), B4 (étape 9 + renvoi de
`reste-a-faire.md`), B13 (bandeaux a1-aviation et r4-ppp), G16 (glob de
rotation + une restauration d'essai tracée), G17 (rotation logs Docker),
G4 (garde-fou ou retrait du job deploy). Une journée, risque nul, danger réel éliminé.

**Lot 1 — la doc redevient vraie (avant d'écrire une ligne de code)**
B2 (README), B3 (CHANGELOG, ~9 bullets — la matière est dans les docs de
conception), B6 + G2 + G3 (bandeaux d'état + roadmap), C2 (bandeau BRIEF),
G1 (aligner les versions + brancher le footer). Deux à trois sessions.
C'est le lot le plus rentable : chaque futur chantier (et chaque agent) lit ces fichiers.

**Lot 2 — le nettoyage sec**
C1 (~710 l. de mort certain, ordre : retraits secs puis CSS avec recette
`/lenses` puis i18n sous filet de parité), G12 inclus, C3 (référencer les
3 scripts orphelins), G20 (renommages), C9. Une session.

**Lot 3 — les canons réadoptés (le cœur de « simple, bien fait »)**
G5 (client HTTP unique + grammaire de `detail` unifiée), G9 (un seul
formateur par famille : montants, parts, dates), G10 (brancher les 7 fils
d'Ariane sur `Breadcrumb`), G11 (déforker `.chamber`), G14, G25, C7.
Deux à trois sessions, chacune avec recette visuelle.

**Lot 4 — la modularité avant UKRI (préalable à toute source nouvelle)**
B7 + B14 (registre `FUNDER_PROFILE` backend avec refus explicite),
B8 (fallbacks front qui refusent au lieu de mentir), G6 (rapatrier la
sémantique comptable au moteur). Deux sessions. **Tant que ce lot n'est pas
fait, ajouter une source produit des chiffres faux en silence — ne pas
commencer UKRI avant.**

**Lot 5 — les tests qui prouvent la doctrine**
B10 (réécrire les 13 tests B2 sur la couche de spécification, pas le DOM),
B11 (couvrir `api.ts`, `seed_e2e.py`, le ticker), B12 (isolation pytest par
savepoint partout), G13 (couverture + sortir le skip NSF de la permanence),
G19 (une spec `/money`). Un chantier, découpable.

**Lot 6 — les chantiers de fond, à ouvrir un par un quand un besoin les motive**
B9 (`sector`→`lens` avec rétrocompatibilité des URLs de decks), G7 (extraire la
scène), G8 (identifiants publics dans les dossiers), G21 (schémas OpenAPI),
G22 (découpage des monolithes), C5 (échelle typographique). Aucun n'est urgent ;
tous deviennent moins chers une fois les lots 3-5 faits.

**Ce qui est en bon état et qu'il faut le dire** : zéro TODO, zéro snapshot,
zéro skip sauvage, zéro dépendance morte, frontière FK workspace tenue,
retraits B2.9→B2.12 propres et vérifiés, Reference Engine extensible comme
promis, backend de chaîne sans fuite de vue, sauvegardes quotidiennes vertes,
serveur sain. La doctrine « zéro dette connue » est crédible : l'écart mesuré
ici est un arriéré documentaire et six chantiers structurels identifiés —
pas une érosion générale.
