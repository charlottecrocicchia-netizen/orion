# Phase 2 — Recherche et navigation

- **Statut : proposé le 2026-07-31, en attente de validation**
- **Objectif : le parcours de démo de 5 minutes fonctionne, vite et avec élégance.** C'est lui qui définit « fini », pas la liste des pages :

> Chercher « hydrogen » → filtrer par programme / années / pays → ouvrir un projet → naviguer vers une organisation participante → voir son portefeuille de projets et ses montants.

Trois exigences structurantes intégrées dès la conception : le parcours comme critère d'acceptation (un test de bout en bout le rejouera à chaque CI), le design comme livrable de premier rang (direction artistique validée avant l'implémentation), et la recherche multilingue FR/EN native.

## 1. Direction artistique d'abord (jalon bloquant pour l'UI, pas pour le backend)

Premier livrable de la phase : **trois pistes maquettées simplement** — même écran de recherche et même fiche organisation déclinés trois fois, en clair et en sombre, servis en local pour comparaison côte à côte. Chaque piste comprend : marque (raffinement du logo constellation), palette complète (tokens), couple typographique (polices open source auto-hébergées, zéro dépendance Google Fonts), et le « toucher » des composants (densité, bordures, ombres, rayons).

- **Piste A — « Observatoire »** : fond quasi noir bleuté, accents indigo → cyan, chiffres en tabular figures, filets fins ; héritage direct de l'identité actuelle, parenté Linear / CB Insights.
- **Piste B — « Éditorial data »** : clair par défaut avec sombre soigné, serif d'affichage pour les titres + sans humaniste pour la donnée, accents ambre sur fond crème ; esthétique « rapport d'analyste premium ».
- **Piste C — « Instrument »** : très haute densité, bordures 1 px, zéro ombre, accent unique signal ; esthétique terminal financier raffinée, la plus radicale.

Validation par la fondatrice (choix d'une piste, ou mix explicite) → les tokens deviennent le socle CSS ; l'implémentation UI ne démarre qu'après. La recommandation d'architecture visuelle : **la home devient la recherche** (le produit est la démo) ; la landing marketing arrive en phase 6 avec le pricing.

## 2. Recherche multilingue — architecture

La base contient des textes anglais (CORDIS) et français + anglais (ANR, les deux langues existent dans les payloads bruts mais une seule est stockée aujourd'hui). Le modèle évolue pour porter le multilingue proprement :

- **Table `project_texts`** (`project_id`, `lang`, `title`, `abstract`, vecteur FTS généré, unicité `(project_id, lang)`) : une ligne par langue disponible. CORDIS → 1 ligne `en` ; ANR → lignes `fr` et `en` quand les deux existent (ingestion ANR mise à jour, re-run idempotent depuis le cache). `projects.title` reste l'affichage canonique de secours. Extensible à toute langue future (JP…) sans migration.
- **Deux configurations FTS Postgres** : `orion_en` (english + unaccent) et `orion_fr` (french + unaccent). Chaque ligne de texte est indexée avec la configuration de sa langue (stemming correct : « catalyseurs » ↔ « catalyseur », « catalysts » ↔ « catalyst »).
- **Requête bilingue** : la saisie est interprétée dans les deux configurations et confrontée aux lignes de sa langue (`websearch_to_tsquery`, GIN). Les cognats se croisent naturellement (« hydrogen » retrouve « hydrogène » après unaccent + stemming) ; la vraie traversée sémantique inter-langues reste le rôle de la couche LLM (phase 4) — limite assumée et documentée.
- **Organisations** : noms propres → pas de stemming ; config `simple` + unaccent, plus le trigramme (déjà indexé) pour tolérer les fautes de frappe.
- **Affichage** : le contenu s'affiche dans la langue de l'interface quand elle existe, sinon dans sa langue source avec badge de langue et bascule « voir l'original ».

## 3. API de recherche et fiches

- `GET /api/search` : `q`, type (projets / organisations), facettes `funder`, `programme`, `country`, `year_from/to`, `amount_min/max`, `org_type`, tri (pertinence / montant / date), pagination. La réponse porte **les décomptes de facettes** sous filtres courants (l'UX différenciante des produits data premium) et des extraits surlignés (`ts_headline`).
- `GET /api/projects/{id}` : fiche complète — montants formatés, hiérarchie de programme, appel, topics, participants (rôle, pays, montant, lien organisation), **attribution de la source** (mention CC-BY / ODbL affichée dès maintenant — obligation de licence).
- `GET /api/organisations/{id}` (+ portefeuille paginé) : identité (pays, type, identifiants PIC/SIREN/RNSR), KPIs (financement total EUR, nb de projets, nb en coordination, période d'activité), portefeuille triable, mini-répartitions par année et par programme (SVG maison léger — la vraie dataviz ECharts reste en phase 3).
- Cible de performance : **p95 < 300 ms en local sur les 119 k projets** (le seuil de bascule de l'ADR 0001) — mesuré et publié, index composites si nécessaire.

## 4. UI

React Router entre en scène : routes `/` (recherche), `/projects/:id`, `/organisations/:id`, **état des filtres dans l'URL** (liens partageables, bouton retour fiable). Vitesse perçue : squelettes partout, recherche instantanée débouncée, tables virtualisées (TanStack Virtual), préchargement des fiches au survol. i18n EN/FR complet, dark mode au niveau de la DA retenue.

## Jalons

1. **DA** : 3 pistes maquettées → choix de la fondatrice (~15-20 min de son côté).
2. **Moteur** : `project_texts` + configs FTS + `/api/search` avec facettes + tests FR/EN + chiffres de perf réels. (Avance en parallèle du jalon 1.)
3. **UI recherche** : page complète dans la DA retenue, filtres URL, résultats projets/organisations.
4. **Fiches** : projet + organisation, navigation croisée, attributions.
5. **Recette** : le parcours de démo automatisé en **test Playwright** (jeu de données seedé depuis les fixtures, joué en CI), i18n et dark/light vérifiés, perf publiée, CHANGELOG, tag `v0.2.0`.

## Définition du « fini » = le parcours, chronométré

- [ ] Taper « hydrogen » renvoie des résultats pertinents FR + EN en < 300 ms (p95 local)
- [ ] Filtrer par programme, années et pays ajuste résultats **et** décomptes de facettes ; l'URL reflète l'état
- [ ] Ouvrir un projet : fiche complète, participants cliquables, attribution source visible
- [ ] Naviguer vers une organisation : portefeuille, montants agrégés, KPIs — les 5 étapes s'enchaînent en moins de 5 minutes sans écran figé
- [ ] Le même parcours rejoué en français (« hydrogène ») fonctionne
- [ ] Test e2e Playwright du parcours vert en CI ; suites backend/frontend vertes
- [ ] DA validée par la fondatrice avant l'UI ; dark et light soignés ; densité lisible
- [ ] Tag `v0.2.0`, CHANGELOG, docs à jour

## Hors périmètre (volontairement)

- Partenariats, tendances, carte, benchmark (phase 3) — la fiche organisation reste portefeuille + montants
- Recherche en langage naturel et synthèses (phase 4)
- Nouvelles sources (France 2030, LIFE/OpenAIRE), resserrage du dédoublonnage (phase 3)
- Alertes, comptes, exports

## Risques

| Risque | Parade |
|---|---|
| Croisement inter-langues limité aux cognats | Assumé et documenté ; la phase 4 (LLM) apporte la traversée sémantique |
| Facettes multiples coûteuses sur 119 k lignes | Mesure d'abord ; index composites, puis vues matérialisées si p95 > 300 ms |
| L'ambition design déborde le calendrier | La DA validée fige les tokens ; composants shadcn restylés, pas de sur-mesure par écran |
| Playwright + données seedées en CI trop lourd | Repli explicite : e2e complet en local (`make e2e`), smoke réduit en CI |
| Re-run ANR pour `project_texts` | Idempotent, depuis le cache local (~2 min), prouvé en phase 1 |

## Estimation

- Développement : 3 à 5 sessions (DA : 1 ; moteur : 1 ; UI recherche : 1-1,5 ; fiches : 1 ; recette : 0,5)
- Fondatrice : choisir la direction artistique (~15-20 min), puis recette du parcours
