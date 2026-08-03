# Vague 1 — rapport d'instruction (extension des sources)

> **Statut : VALIDÉ le 2026-08-03, avec un amendement d'ordre
> fondatrice** — les premiers clients sont européens : après NSF,
> l'Europe élargie passe d'abord (UKRI, SNSF, NWO, Vinnova), puis SBIR
> et USAspending. **Règle de glissement : si USAspending s'avère plus
> lourd que prévu, il glisse en fin de vague plutôt que de bloquer.**
> L'exécution démarre par le socle identité (étape 0).
> Ce rapport reprend le registre [data-sources.md](data-sources.md), les
> principes actés dans la [roadmap](roadmap.md) et les pointeurs de la
> [spec externe triée](lecons-spec-externe.md). Le rapport de
> cartographie détaillé des sources US/UK n'ayant pas été versé au repo,
> les pièges ci-dessous viennent de ces pointeurs et de la connaissance
> générale des APIs — **chaque licence et chaque volumétrie se
> re-vérifient à l'instruction de la source, à l'API, avant chargement**
> (la règle du registre). Les estimations sont indicatives, calibrées
> sur nos chargeurs existants (CORDIS ≈ ANR ≈ 1 semaine chacun,
> tests et dédup compris).

## Étape 0 — le socle identité (acté le 2026-08-03)

Avant tout chargeur : la **vague A de la
[couche groupes](groupes-couche.md)**, hors curation.

**Plan.**
1. Migration : tables `groups` (nom canonique, pays QG, LEI ultime,
   source) et `entity_group_map` (entité → groupe, méthode, confiance,
   source, valid_from/valid_to, part + marqueur JV).
2. Chargeur **GLEIF Golden Copy** : Niveau 1 (identité), **RR-CDF**
   (relations parent direct/ultime), **Reporting Exceptions** — bulk
   quotidien, CC0. Détails opérationnels dans
   [l'annexe recherche](groupes-recherche-sources.md).
3. Chargeur **Wikidata** (SPARQL) : P749/P355 (parent/enfant), P1278
   (LEI) sur les groupes notables.
4. **Ponts d'identifiants** : SIREN↔LEI (registration authority des LEI
   français), PIC↔LEI (nom+pays+SIREN), versés en table de
   correspondances réutilisable par tous les chargeurs suivants.
5. Démarrage du **process de curation** des top groupes (manuel,
   traçé dans `entity_group_map` méthode=curation).

**Pièges connus.** ~4 % seulement de liens LEI-à-LEI exploitables (une
fondation, pas une solution) ; JV non modélisées par GLEIF (règle métier
pondérée chez nous) ; Wikidata déclaratif (signal, pas vérité — score de
confiance obligatoire).

**Estimation : ~2 semaines** (migration + 2 chargeurs + ponts + tests).

## L'ordre des chargeurs — validé (amendement fondatrice)

Ordre exécutoire : **NIH → NSF → UKRI → SNSF → NWO → Vinnova → SBIR →
USAspending → Grants.gov → OpenAIRE.** Les principes restent (API
propres d'abord, recouvrantes quand la dédup a des références,
agrégateurs en dernier) avec la priorité client : **l'Europe élargie
visible au plus tôt** — UKRI et les voisins passent avant les
recouvrantes US. USAspending glisse en fin de vague s'il pèse plus que
prévu. Les numéros des sections ci-dessous gardent l'ordre de
l'instruction initiale ; le tableau récapitulatif porte l'ordre validé.

### 1. NIH (RePORTER) — États-Unis, santé

- **Plan** : API RePORTER v2 (JSON, pagination) ; projets + montants par
  année fiscale + organisations ; mapping `funders` USD.
- **Pièges** : années **fiscales US** (oct→sept — la normalisation
  transverse s'écrit ici) ; sub-projects à replier sur le projet cœur
  (sinon doubles comptes) ; identité org par UEI/IPF à croiser avec nos
  ponts ; licence : données fédérales US, domaine public — à confirmer
  sur les conditions de l'API.
- **Estimation : ~1 semaine.** Volumétrie attendue : centaines de
  milliers de projets (à constater).

### 2. NSF — États-Unis, science

- **Plan** : téléchargements XML par année + API awards ; montants
  « intended total » ; USD.
- **Pièges** : XML par année (chargeur par lots) ; montants intentions
  vs versés (choisir et DIRE lequel) ; identité org moins outillée
  (noms + UEI récents seulement).
- **Estimation : ~1 semaine.**

### 3. SBIR/STTR — États-Unis, petites entreprises innovantes

- **Plan** : API SBIR.gov (JSON) ; la cible client d'Orion (PME
  innovantes) — forte valeur produit.
- **Pièges** : **recouvrement massif** avec NIH/NSF/DoD (un award SBIR
  vit aussi dans la base de son agence) → dédup inter-sources par
  numéro d'award AVANT exposition ; firmes petites, peu d'identifiants
  forts → les ponts et Splink (vague B groupes) serviront.
- **Estimation : ~0,5-1 semaine** (l'essentiel est la dédup).

### 4. USAspending — États-Unis, le filet exhaustif

- **Plan** : API + dumps bulk ; filtrer les assistance grants R&D
  (codes CFDA/assistance listings) pour couvrir DoE, DoD, NASA hors
  SBIR ; USD.
- **Pièges** : **volumétrie énorme** (dumps de dizaines de Go,
  granularité transaction → agréger par award) ; le filtre R&D est la
  vraie difficulté (choisir les listings, assumer le périmètre dit) ;
  recouvre NIH/NSF/SBIR → n'ingérer QUE le complément.
- **Estimation : ~2 semaines.** C'est le plus lourd ; il vient après
  les API propres pour que la dédup ait des références.

### 5. UKRI (Gateway to Research) — Royaume-Uni

- **Plan** : API GtR-2 (JSON) ; tous les conseils UKRI ; GBP.
- **Pièges** : **devise GBP** et année fiscale UK (avr→mars) — la
  normalisation transverse s'étend ici ; organisations sans identifiant
  société systématique (nom+adresse → ponts Companies House en vague B
  groupes) ; licence OGL (Open Government Licence, commerciale OK) à
  re-vérifier à l'API.
- **Estimation : ~1 semaine.**

### 6. SNSF — Suisse

- **Plan** : portail data SNSF (exports CSV/JSON documentés) ; CHF.
- **Pièges** : CHF (normalisation) ; volumétrie moyenne ; licence
  ouverte à confirmer sur le portail.
- **Estimation : ~0,5 semaine.**

### 7. NWO — Pays-Bas

- **Plan** : open data NWO (API/exports selon l'état constaté) ; EUR.
- **Pièges** : l'API est la moins documentée du lot — l'instruction
  commencera par constater ce qui existe vraiment ; identités org à
  croiser ROR (académique fort aux Pays-Bas).
- **Estimation : ~0,5-1 semaine** (l'incertitude est sur l'accès).

### 8. Vinnova — Suède

- **Plan** : API ouverte data.vinnova.se ; SEK.
- **Pièges** : SEK (normalisation) ; anglais/suédois mêlés dans les
  textes (le bilingue FR/EN d'Orion reste la règle d'interface, les
  textes source restent tels quels).
- **Estimation : ~0,5 semaine.**

### 9. Grants.gov — États-Unis, opportunités (pont vers P5)

- **Plan** : extract XML quotidien des OPPORTUNITÉS (pas des awards) —
  c'est la matière de la **phase 5 (calls)**, pas du corpus passé.
  Proposition : l'instruire en vague 1 (le chargeur est simple) mais ne
  l'exposer qu'avec P5.
- **Pièges** : fichier volumineux quotidien ; cycle de vie des
  opportunités (fermetures, amendements) → modèle de fraîcheur propre.
- **Estimation : ~1 semaine** (chargeur + modèle opportunités minimal).

### 10. OpenAIRE — l'agrégateur, en dernier

- **Plan** : API graphe (CC BY 4.0) ; sert à **combler** (LIFE déjà
  repéré au registre, projets nationaux absents ailleurs) et à
  **corroborer** (DOI, liens projets-publications).
- **Pièges** : recouvrement massif avec CORDIS et les agences → dédup
  par identifiant de grant AVANT toute exposition ; qualité hétérogène ;
  volumétrie énorme → ingestion CIBLÉE (le complément, jamais le tout).
- **Estimation : ~2 semaines** (dont l'essentiel en dédup et périmètre).

## Les transverses (s'écrivent avec les premiers chargeurs)

- **Devises et années fiscales** : table de conversion datée
  (USD/GBP/CHF/SEK→EUR aux taux annuels BCE, la méthode DITE dans le
  produit), années fiscales US/UK mappées sur nos années civiles avec
  marqueur. S'écrit avec NIH (fiscal US) et s'étend avec UKRI (GBP).
  ~0,5 semaine en sus.
- **Provenance par champ et conflits exposés** (principe adopté) : le
  schéma de provenance se pose au premier chargeur US, jamais après.
- **Dédup inter-sources** : adossée aux ponts du socle (LEI/UEI/numéros
  d'award) ; chaque chargeur livre ses métriques avant/après comme au
  registre.
- **Attributions produit** : chaque source ajoute sa mention (le bloc
  existe déjà pour CORDIS).

## Récapitulatif

| Étape | Contenu | Estimation |
| --- | --- | --- |
| 0 | Socle identité (groupes + GLEIF + Wikidata + ponts) — **en cours** | ~2 sem |
| 1-2 | NIH puis NSF (+ transverse devises/fiscal) | ~2,5 sem |
| 3 | UKRI | ~1 sem |
| 4-6 | SNSF, NWO, Vinnova | ~1,5-2 sem |
| 7 | SBIR | ~0,5-1 sem |
| 8 | USAspending (**glisse en fin de vague si plus lourd que prévu**) | ~2 sem |
| 9 | Grants.gov (opportunités, exposé en P5) | ~1 sem |
| 10 | OpenAIRE (complément ciblé) | ~2 sem |
| | **Total indicatif** | **~12-14 semaines** |

Chaque source suit le rituel du registre : licence vérifiée à l'API le
jour J, volumétrie constatée, métriques de dédup, entrée au
[data-sources.md](data-sources.md), CI verte, recette fondatrice sur
site avant la source suivante. Les jalons produit visibles : après
l'étape 2 (les États-Unis apparaissent — le globe et les régions
« manager » commencent à compter), après l'étape 6 (**l'Europe élargie
— la priorité client**), après l'étape 10 (couverture annoncée de la
vague 1).
