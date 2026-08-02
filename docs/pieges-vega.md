# Pièges de Vega — ce qu'on ne reproduira pas

**Statut : v2** (2026-08-02). Sources : leçons du prompt fondateur (BRIEF.md
§1-§3), vision & personas (architecture-information.md §9), et les **huit
leçons UX de la fondatrice** (fournies le 2026-08-02, intégrées en §4).

Règle d'or inchangée : les leçons de Vega se lisent, son code jamais.

## 1. Ce qui n'allait pas (documenté) — et la règle Orion

| # | Le piège vécu sur Vega | La règle pour Orion | Où elle vit déjà |
|---|---|---|---|
| V1 | **Monolithe** : un `server.py` de ~26 500 lignes | Modulaire dès le premier commit ; fichiers courts, responsabilités nettes | ingestion / api / search / frontend séparés depuis la phase 0 |
| V2 | **Base non reproductible** : SQLite 2,3 Go hors repo, transmise à la main, corruption WAL | La base n'est jamais précieuse : `make ingest` reconstruit tout depuis les sources publiques | pipelines idempotents, journal d'ingestion, seed e2e |
| V3 | **Déploiement pénible** : `dist/` commité, bundles de 913 Mo, jamais hébergé | Déployable dès le jour 1, artefacts hors repo, CI qui build/teste | Docker + Caddy + GHCR + CI verte exigée |
| V4 | **Aucune authentification** | Comptes/organisations pensés dans le schéma dès le début, activés en P6 | à honorer au schéma dès la vague 1 des sources |
| V5 | **Mises à jour manuelles** | Ingestion planifiée, logs, fraîcheur visible | scheduler hebdomadaire + à-propos des données |

## 2. Les pièges implicites — lus entre les lignes du brief

Ceux-là ne sont pas numérotés dans le brief, mais tout le cahier des charges
est écrit contre eux :

- **Le prototype qui n'engage à rien.** Vega est resté un outil interne : pas
  de client, pas de compte, pas de prix. → Orion se juge à la « définition du
  succès » du brief : démontrable à un prospect *sans rien lancer en local*.
  Chaque phase se termine démo-prête, déployée, testée.
- **La donnée brute jetée à l'écran.** Le différenciateur d'Orion est
  *l'intelligence* du financé — pas l'accès aux données (elles sont publiques).
  → Une page qui liste sans hiérarchiser, compter, comparer ou tendre n'a pas
  sa place ; c'est la doctrine des listes (rangs, tendances, tabular) et des
  « Analyses prêtes ».
- **Le design en dernier.** Le brief exige un produit « nettement plus beau
  que les outils du marché » — la leçon en creux d'un prototype où le design
  n'était pas le sujet. → La doctrine de design est une référence canonique,
  pas un vernis final ; la checklist des 10 pièges est un critère de recette.
- **L'écran pour personne.** Vega servait sa créatrice ; un produit sert des
  personas. → Règle §9 : chaque écran nomme le persona qu'il sert d'abord —
  « un écran qui ne sert clairement aucun des trois n'est pas construit ».

## 3. La synthèse en une phrase

Vega prouvait que la donnée existait ; Orion doit prouver qu'elle **répond à
des questions** — celles de trois personnes précises, vite, avec des sources
citées, sur un produit qu'on peut vendre.

## 4. Les huit leçons UX de la fondatrice (2026-08-02)

| # | Le piège vécu sur Vega | La règle pour Orion | État |
|---|---|---|---|
| U1 | **Données mal choisies, mal préparées** — tout le reste en souffrait | La donnée se choisit sur critères documentés et se **prépare avant de se montrer** | ✅ appliqué (registre des sources, licences, dédoublonnage, campagnes qualité) — à maintenir comme discipline, pas comme acquis |
| U2 | **Le nom codé en dur partout** — le renommage fut un cauchemar | La marque visible est une **configuration**, jamais des chaînes disséminées | ⚠️ audité (2026-08-02) : ~15 points visibles — logo, layout (©, aria), `index.html`, 10 libellés i18n ; backend sain (identifiants techniques seulement, pas la marque). **Chantier hygiène léger** : constante `BRAND` + interpolation i18n `{{brand}}` |
| U3 | **Rien n'était modulable** — chaque évolution cassait l'existant | Ossature extensible, gabarits uniques (hub unique, Explorateur whitelisté) | ✅ au cœur d'Orion — ne jamais y déroger |
| U4 | **La dette empilée** — des couches sur des couches, jamais de refonte propre | La dette se **paie tout de suite ou se date dans un backlog visible** ; jamais de « on verra » silencieux | ✅ pratiqué (dette perf chiffrée et datée, backlogs explicites) — la règle est désormais écrite |
| U5 | **Les entités légales au lieu des groupes** — CORDIS donne les filiales, l'industriel veut Thales entier | Une **hiérarchie groupe → entités** : vue consolidée ET détail par entité ; le garde-fou anti-fusion reste (il a raison), la couche groupe vient par-dessus | ❌ angle mort partagé avec Vega — **chantier données majeur, à la roadmap** (rejoint les homonymes CNRS et RNSR) ; précurseur UI : la mention « fiche consolidée » du poste de veille |
| U6 | **La catégorisation, chantier permanent** — difficile mais cruciale | La taxonomie est un investissement continu, pas un acquis | 🟡 euroSciVoc niveau 2 en place (41 thèmes FR) ; devant nous : couverture ANR, taxonomie plus métier |
| U7 | **La recherche ne comprenait pas ce qu'on tapait** | **Suggestions à la frappe** (projets, organisations, thèmes, pays), tolérance aux fautes, langage naturel en P4 | ⚠️ fuzzy organisations ✓, texte libre R4 ✓ ; **l'autocomplete manque — le chantier le plus rentable à court terme** (dixit la fondatrice), ajouté aux actionnables |
| U8 | **Le ton** — ni jargon, ni infantilisant, jamais « rendu IA » | Déjà notre doctrine (ton éditorial, checklist des 10 pièges) | ✅ la leçon de Vega confirme la doctrine |

Chaque ⚠️/❌/🟡 vit désormais dans la [roadmap](roadmap.md) ou dans l'ordre
d'implémentation de la [conception parcours](conception-parcours-visualisations.md).
