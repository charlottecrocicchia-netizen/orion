# Inventaire des capacités annoncées — carnet de construction

Lot 0 du chantier Capacités annoncées (2026-08-20). Audit sur pièce :
prod `:8080` parcourue écran par écran, code et base vérifiés pour
chaque annonce. Aucun code modifié. Ce document recense ce qui est
annoncé, dans quel état réel — l'ordre de construction n'y est pas :
il appartient à Charlotte.

## Récapitulatif

| Capacité | Badge | État réel | Dépendances | Taille |
|---|---|---|---|---|
| Appels — catalogue & matching | P5 · automne 2026 | fondations partielles (2 051 appels historiques en base, aucune API, aucun appel à venir) | source nouvelle (licence à vérifier), modèle étendu, matching | gros |
| Espace de travail | P6 · 2027 | rien — vitrine pure | infra comptes/équipes (le socle de presque tout le reste) | gros |
| Rapports partagés | P6 · 2027 | rien — entrée de menu inerte | comptes + équipes, dossier comme base | moyen-gros |
| Alertes | P5–P6 | rien — entrée de menu inerte | événements d'ingestion (P5) puis comptes (P6) | moyen-gros |
| Durabilité du dossier | P6 (mention) | dossier vivant en localStorage ; durabilité : rien | comptes | petit-moyen |
| Périmètre « + habilitant » aviation | *(sans badge)* | prêt mais débranché — l'infra enabling existe, la revue des 3 projets manque | revue de publication (décision, pas du code) | petit |
| Vague 1 des sources (UKRI…) | *(sans badge)* | annonce périmée aux deux tiers : NIH et NSF déjà livrés ; UKRI à venir | validation licence OGL, chantier d'ingestion | moyen-gros |

## Détail par capacité

### 1. Appels à projets — catalogue et matching · `P5 · automne 2026`

**Où.** Quatre emplacements, badge identique partout :
- menu **Découvrir** → « Appels — catalogue et matching », badge `P5 · autumn 2026` ;
- **`/calls`**, page vitrine dédiée (« Orion · Appels · phase 5 ») ;
- **home cadrée**, porte « Suivre » : « les alertes et les suivis — appels à l'automne 2026, l'espace de travail en 2027 », badge `Phase 5 · automne 2026` ;
- **footer**, colonne Explorer : « Appels (P5 · automne 2026) ».

**Ce qui est promis** (les quatre features de `/calls`) : un catalogue
filtrable des appels ouverts et à venir avec les filtres de
l'Explorer ; un matching décomposé (« jamais un score unique : chaque
critère dit sa part ») ; le test d'éligibilité rapide (« un critère
inconnu n'est jamais un critère incompatible ») ; les ponts vers le
passé (qui a gagné les appels similaires) plus des alertes sur vos
thèmes. La page ferme honnêtement : « Pas de formulaire, pas de liste
d'attente — la date suffit. »

**État réel du code.** Fondations partielles. La table `calls` existe
([funding.py:34](../backend/src/orion/models/funding.py)) avec **2 051
appels historiques** — ceux sous lesquels les projets du corpus ont
été financés — et sa docstring anticipe : *« extended in phase 5 for
upcoming calls »*. Seule exposition : le nom de l'appel sur la fiche
projet ([projects.py:52](../backend/src/orion/api/projects.py)). Aucun
router `calls`, aucun appel *à venir* en base, aucun matching. Côté
front, [calls.tsx](../frontend/src/pages/calls.tsx) est une vitrine
`PhasePlaceholder` pure.

**Dépendances.** ① Une **source nouvelle** : les appels ouverts/à
venir (portail Funding & Tenders de l'UE ou équivalent) — **licence à
vérifier avant tout** (règle gravée : domaine public, CC0, CC-BY,
Licence Ouverte, OGL seulement ; zone grise = exclusion). ② Extension
du modèle (dates d'ouverture/clôture, budgets, critères
d'éligibilité). ③ Le matching s'appuie sur l'existant (lentilles,
thèmes euroSciVoc — déjà là). ④ Le volet « alertes sur vos thèmes »
enjambe vers les comptes (voir Alertes).

**Taille : gros** — plusieurs chantiers (ingestion nouvelle source,
catalogue, matching, éligibilité).

### 2. Espace de travail — comptes, équipes · `P6 · 2027`

**Où.** Menu **Espace** → « Workspace — suivis, recherches
sauvegardées, alertes », badge `P6 · 2027` ; **`/workspace`**, vitrine
dédiée (« Orion · Espace de travail · phase 6 », « comptes · équipes ·
abonnements de zone ») ; **footer** : « Espace de travail (P6 · 2027) ».

**Ce qui est promis.** Organisations suivies (« leurs signaux viennent
à vous »), recherches sauvegardées, alertes, partage d'équipe (« vos
vues et dossiers, passés à ceux qui décident »). La vitrine ferme :
« Cette page dit la date, et s'arrête là. »

**État réel du code.** Rien. [workspace.tsx](../frontend/src/pages/workspace.tsx)
est une vitrine `PhasePlaceholder` ; aucune table `users`/`accounts`/
`teams`, aucune authentification, aucun stockage par utilisateur nulle
part dans le backend.

**Dépendances.** C'est la capacité-SOCLE : l'infra comptes
(authentification, identité, équipes, stockage par utilisateur) est le
prérequis explicite de la durabilité du dossier, des rapports
partagés, des recherches sauvegardées et des alertes personnalisées.
Rien dans le produit actuel n'en pose la première pierre.

**Taille : gros.**

### 3. Rapports partagés · `P6 · 2027`

**Où.** Menu **Construire** → « Rapports partagés — vues d'équipe,
digests », badge `P6 · 2027`. Entrée **inerte** (`disabled`, sans
lien) — avec Alertes, l'une des deux seules entrées de menu sans
destination.

**Ce qui est promis.** Des vues d'équipe et des digests — le dossier
qui passe de l'individu au collectif.

**État réel du code.** Rien : pas de page, pas de route, pas de
backend. L'entrée de menu ([intent-nav.tsx:95-100](../frontend/src/components/intent-nav.tsx))
est la seule trace.

**Dépendances.** Comptes et équipes (P6) obligatoires ; le dossier
(vivant) en est la base naturelle côté contenu.

**Taille : moyen-gros** — une fois les comptes posés.

### 4. Alertes · `P5–P6`

**Où.** Menu **Espace** → « Alertes — un concurrent gagne un projet
sur votre thème », badge `P5–P6`. Entrée **inerte** (`disabled`, sans
lien). Évoquées aussi par `/calls` (f4 : « plus des alertes sur vos
thèmes ») et `/workspace` (f3).

**Ce qui est promis.** Être prévenu quand quelque chose bouge sur ses
thèmes — l'exemple donné : un concurrent gagne un projet.

**État réel du code.** Rien — ni détection d'événements, ni canal de
notification, ni préférence utilisateur. Le badge à cheval `P5–P6`
dit honnêtement l'étalement : la détection d'événements peut naître
avec les appels (P5), la personnalisation durable exige les comptes
(P6).

**Dépendances.** ① Des événements à détecter — l'ingestion sait déjà
dater ses passages (`ingestion_runs`), mais aucun diff « quoi de
neuf » n'existe. ② Un destinataire — sans comptes, pas d'alerte
personnelle durable.

**Taille : moyen-gros**, en deux temps comme son badge.

### 5. Durabilité du dossier · mention `P6`

**Où.** **`/dossier`** (page non vide) : bandeau « conservé dans ce
navigateur — les comptes (P6) le rendront durable », répété dans le
pied de page du dossier. Constaté à l'écran après collecte d'une vue.

**Ce qui est promis.** Le dossier survivra au navigateur — il suivra
son propriétaire.

**État réel du code.** Le dossier lui-même est **vivant** :
collecte depuis l'Explorer, réordonnancement, renommage, annotation,
retrait, « Emporter » (impression). Stockage
[localStorage pur](../frontend/src/lib/dossier.ts). La durabilité
annoncée : rien — c'est un sous-produit direct des comptes.

**Dépendances.** Comptes (P6). Rien d'autre : le modèle de données du
dossier existe déjà côté client, il s'agira de le faire voyager.

**Taille : petit-moyen** une fois les comptes là.

### 6. Périmètre « + habilitant » de la lentille Aviation · *sans badge*

**Où.** Menu du chip de périmètre, sur toute vue cadrée aviation
(Explorer et surfaces cadrées) : « un seul périmètre qualifié
aujourd'hui — “+ habilitant” apparaîtra quand les projets habilitants
auront passé la revue »
([sector-chip.tsx:70](../frontend/src/components/sector-chip.tsx)).

**Ce qui est promis.** Le second périmètre de la lentille (cœur +
technologies habilitantes), comme Space l'a déjà.

**État réel du code.** **Prêt mais débranché** — le seul de
l'inventaire. Toute l'infra existe et fonctionne pour Space
(migration `0025_lens_tag_enabling`, chip à deux périmètres, figures
par périmètre). Pour Aviation, la vérité V2-A adjugée porte 3 projets
habilitants — qui n'ont **pas passé la revue de publication**. Le
déblocage est une décision de revue, pas un chantier de code.

**Dépendances.** La revue des 3 projets par Charlotte. C'est tout.

**Taille : petit** (une session).

**Signalement.** Annonce **sans badge de phase** — la promesse est
conditionnelle (« quand… auront passé la revue ») et sans date. À
étiqueter si la doctrine veut que toute annonce porte sa phase, ou à
assumer comme promesse-de-revue distincte des promesses-de-phase.

### 7. Vague 1 des sources — UKRI… · *sans badge*

**Où.** **`/explore/programmes`**, sous le titre : « Une rangée par
agence de financement — ses programmes se déplient à l'intérieur. Les
prochaines sources (NIH, NSF, UKRI…) arriveront ici en rangées,
vague 1. »

**Ce qui est promis.** De nouvelles agences de financement dans le
corpus, présentées comme rangées de la page programmes.

**État réel.** **Annonce périmée aux deux tiers** : NIH RePORTER
(380 275 projets) et NSF (235 071) sont **déjà dans le corpus** — la
page à-propos les liste comme sources vivantes, la home les crédite.
Seul UKRI (et le « … ») reste à venir ; c'est le chantier « vague 1 »
en instruction. Le texte promet donc en partie ce qui est déjà livré.

**Dépendances.** Validation de licence (UKRI publie sous OGL — admise
par la règle des licences, à valider pièce en main), puis chantier
d'ingestion complet (nouvelle source, mapping, conversion, à-propos).

**Taille : moyen-gros** par source.

**Signalement.** Annonce **sans badge de phase**, et à rafraîchir :
elle date d'avant l'atterrissage NIH/NSF.

## Incohérences et faits d'étiquetage

1. **Clé orpheline `callsNote`** — « Les appels ouverts — Horizon
   Europe et au-delà, reliés à ces tendances — arrivent en » est
   définie dans l'i18n (EN + FR) et **jamais rendue** nulle part :
   trace d'un teaser retiré. À nettoyer ou rebrancher (aucune
   correction faite dans ce lot).
2. **Badge simple sous promesse double** (home cadrée, porte
   « Suivre ») : la note annonce deux échéances (« appels à l'automne
   2026, l'espace de travail en 2027 ») mais le badge affiché est
   uniquement `Phase 5 · automne 2026`. Léger : le lecteur peut
   rattacher 2027 à P5.
3. **`sourcesLead` périmée** (voir capacité 7) : promet NIH/NSF déjà
   livrés.
4. **Annonces sans badge** : le « + habilitant » aviation (capacité 6)
   et la vague 1 des sources (capacité 7) sont les deux seules
   promesses d'écran sans étiquette de phase.
5. **Cohérence constatée partout ailleurs** : `P5 · automne 2026`
   identique sur ses quatre emplacements ; `P6 · 2027` identique sur
   menu, vitrine, footer et dossier ; `P5–P6` unique aux alertes et
   fidèle à leur nature en deux temps. Aucun conflit de badge — le
   soupçon « P5 · 2027 » sur Rapports partagés, né d'une capture basse
   résolution, a été levé par lecture du DOM : c'est bien `P6 · 2027`.

## Chaînes de dépendances (vue d'ensemble)

```
comptes/équipes (P6, rien aujourd'hui)
 ├── durabilité du dossier          (petit-moyen)
 ├── rapports partagés              (moyen-gros)
 ├── recherches sauvegardées        (dans workspace)
 └── alertes personnalisées         (second temps de P5–P6)

source appels à venir (licence à vérifier)
 └── catalogue /calls ── matching ── éligibilité   (P5, gros)
        └── « qui a gagné les appels similaires » : s'appuie sur
            les 2 051 appels historiques déjà en base

événements d'ingestion (diff « quoi de neuf », rien aujourd'hui)
 └── alertes (premier temps de P5–P6)

revue des 3 projets habilitants aviation (décision)
 └── périmètre « + habilitant »     (petit, prêt mais débranché)

licence OGL validée pièce en main
 └── UKRI, vague 1                  (moyen-gros)
```

*Constats d'écran réalisés le 2026-08-20 sur la prod `:8080`
(v0.4.0) : `/calls`, `/workspace`, `/dossier` (vide puis garni),
`/about-data`, `/explore/programmes`, chip de périmètre sur
`/explore?sector=aviation`, les trois menus du header, la porte
« Suivre » de la home cadrée, le footer.*
