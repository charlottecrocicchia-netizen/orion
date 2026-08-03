# Registre des sources de données

Registre vivant : chaque source publique ingérée par Orion, avec sa juridiction, sa devise, sa licence vérifiée et sa volumétrie constatée. Conçu multi-pays et multi-devises (amendement du 2026-07-31) — les sources hors Europe s'ajouteront ici sans changement de schéma.

| Source (code) | Juridiction | Devise | Licence (vérifiée) | Cadence de publication | Volumétrie constatée |
|---|---|---|---|---|---|
| CORDIS Horizon Europe (`cordis-horizon`) | UE | EUR | CC BY 4.0 — décision 2011/833/EU, réutilisation commerciale autorisée avec attribution (vérifiée le 2026-07-31 sur la politique de réutilisation de la Commission) | ~mensuelle (dernier rafraîchissement source : 2026-07-21) | 23 278 projets, 144 117 participations (2026-07-31) |
| CORDIS H2020 (`cordis-h2020`) | UE | EUR | idem CC BY 4.0 | figée (programme clos) + corrections | 35 389 projets, 178 967 participations (2026-07-31) |
| CORDIS FP7 (`cordis-fp7`) | UE | EUR | idem CC BY 4.0 | figée (programme clos) | 25 785 projets, 140 063 participations (2026-07-31) |
| ANR (`anr`) | FR | EUR | **ODbL 1.0** (Open Database License) — vérifiée le 2026-07-31 sur data.gouv.fr, champ `license: odc-odbl`. ⚠️ **Pas** la Licence Ouverte : clause de partage à l'identique, voir l'alerte ci-dessous | ~mensuelle (dernière publication : 2026-07-02) | 34 720 projets, 117 859 participations (2026-07-31) |
| ADEME (`ademe`) | FR | EUR | Licence Ouverte 2.0 (vérifiée le 2026-07-31) | — | **Décision fondatrice du 2026-07-31 : non ingérée** (source hors sujet, voir ci-dessous) ; **France 2030** sera visé plus tard comme source française de R&D industrielle |
| LIFE (`life`) | UE | EUR | à confirmer sur l'export retenu | — | **Décision fondatrice du 2026-07-31 : reporté**, ne bloque pas la v0.1.0 ; piste de récupération future via **OpenAIRE** |
| NIH RePORTER (`nih`) | US | USD → EUR (taux BCE datés) | **Domaine public** (données fédérales US) — vérifiée le 2026-08-03 sur reporter.nih.gov | annuelle par exercice (bulk par FY ; **FY2026 pas encore publié** — fenêtre réelle FY2005-2025) | **380 275 projets**, 379 346 participations, 358 911 résumés indexés, 77 instituts en programmes, 1 722 398 tranches annuelles repliées (2026-08-03) — voir les deux réserves ci-dessous |
| Taux de change BCE (`ecb`) | — | — | Réutilisation libre avec attribution — vérifiée le 2026-08-03 | annuelle | 198 taux moyens annuels, 9 devises (USD/GBP/CHF/SEK/NOK/DKK/CAD/JPY/AUD) |
| GLEIF Golden Copy (`gleif`) | Monde | — (identité) | **CC0** — vérifiée le 2026-08-03 sur gleif.org (« even for commercial purposes ») | quotidienne (publishes/latest, rejouée par le scheduler hebdo) | 3 391 838 LEI en miroir, 258 260 liens de consolidation ACTIVE (fonds exclus), exceptions filtrées aux LEI pontés : 17 208 (2026-08-03) |
| Wikidata parents (`wikidata`) | Monde | — (identité) | **CC0** — vérifiée le 2026-08-03 | mensuelle visée (rejouée par le scheduler hebdo) | 3 098 paires parent P749 entre porteurs de LEI bien formés (garde ISO 17442 : quelques P1278 sales rejetés) |

## ⚠️ PRÉREQUIS BLOQUANT DE LA MISE EN LIGNE — ANR sous ODbL

**Décision fondatrice du 2026-07-31 : l'ingestion ANR continue telle quelle en local ; la question ODbL sera tranchée avec un juriste avant toute mise en ligne publique.** Ce point est un **prérequis bloquant du go-live** : il doit figurer dans la checklist de la phase 6 (produit vendable) et ne peut pas être découvert au dernier moment.

### Contexte de l'alerte

Les données ANR sont publiées sous **ODbL 1.0**, et non sous la Licence Ouverte attendue. L'ODbL impose, en plus de l'attribution, une clause de **partage à l'identique** : quiconque publie une « base dérivée » doit la mettre à disposition sous ODbL. Ce que le produit affiche (résultats de recherche, analyses) relève des « œuvres produites » et reste libre de licence, mais la question de savoir si la base d'Orion constitue une base dérivée publiquement diffusée se pose dès que le service est en ligne.

- **Aujourd'hui : aucun problème.** L'ingestion et l'usage sont locaux, non publics — l'ODbL n'encadre pas l'usage privé. Rien n'est bloqué côté développement.
- **Avant la mise en ligne : arbitrage nécessaire** (options possibles : cloisonner les données ANR de la base diffusée, publier l'extrait dérivé sous ODbL, se limiter à des « œuvres produites » avec attribution, ou faire valider la lecture par un juriste). À trancher par la fondatrice, si besoin avec un avis juridique.
- Les mêmes vérifications sont à faire pour l'ADEME et LIFE avant leur ingestion.

## ⚠️ ADEME : la source ouverte ne correspond pas au produit (décision requise)

La licence est excellente (Licence Ouverte 2.0, aucune contrainte), mais **le contenu ne correspond pas à ce qu'Orion promet**. Le jeu de données publié par l'ADEME est celui des « données essentielles des conventions de subvention » (décret n° 2017-779) : *toutes* les aides versées, pas les projets de R&D.

Analyse du fichier réel (2026-07-31, 39 282 lignes, 11,2 Md€) :

- **2,3 % des lignes seulement** évoquent la recherche ou l'innovation (902 lignes, 274 M€) — et encore s'agit-il surtout d'expérimentations opérationnelles (collecte séparée de biodéchets, sites démonstrateurs de réemploi), pas de R&D industrielle.
- Les principaux dispositifs sont « Fonds Tourisme Durable – Restaurateurs », « Tremplin pour la transition écologique des PME », « Renouvellement Forestier ».
- Le champ `dispositifAide` est vide sur 30 % des lignes : **aucun filtre fiable** ne permet d'isoler la R&D ; un filtrage par mots-clés sur le texte libre serait fragile.
- Point positif isolé : le SIRET du bénéficiaire est présent sur 99 % des lignes (bonne matière d'identité), mais pour des bénéficiaires qui sont majoritairement des hôtels, communes et exploitants forestiers.

**Conséquence** : ingérer ce fichier ajouterait ~39 000 enregistrements hors sujet qui diluent précisément les analyses censées différencier Orion (veille concurrentielle R&D, cartographie de partenaires, tendances thématiques). À noter : la cible de volumétrie du brief (~106 000 projets) est **déjà atteinte** avec CORDIS + ANR, sans l'ADEME.

Options soumises à la fondatrice : (a) ne pas ingérer l'ADEME et viser plutôt **France 2030** comme source française de R&D industrielle ; (b) n'ingérer que le sous-ensemble filtré par mots-clés (~900 lignes, qualité incertaine) ; (c) tout ingérer en marquant les aides hors R&D. Recommandation : (a).

## LIFE : reporté (décision fondatrice du 2026-07-31)

La base publique des projets LIFE existe (`https://webgate.ec.europa.eu/life/publicWebsite/search`) mais est un moteur de recherche web : aucun export CSV/Excel ni API documentée n'a été trouvé le 2026-07-31. **Décision : reporté, ne bloque pas la v0.1.0 ; piste privilégiée pour plus tard : récupération via OpenAIRE** (qui agrège les projets LIFE), sinon l'API interne du moteur de recherche si ses conditions l'autorisent.

## ⚙️ CONVENTION TRANSVERSE — montants pluriannuels et devises

**Décision fondatrice du 2026-08-03, applicable à TOUTE source qui
publie l'argent par tranche annuelle** (NIH d'abord, puis NSF, UKRI,
SNSF, NWO, Vinnova… — la règle s'écrit une fois et ne se rediscute
plus à chaque chargeur).

**① Une tranche annuelle n'est pas un projet.** Une source qui verse
l'argent par année fiscale (un même financement reconduit chaque année)
donne **un seul projet Orion**, identifié par son **numéro de cœur**
(NIH : `CORE_PROJECT_NUM` ; les autres sources déclareront leur clé
équivalente au moment de leur instruction). Les tranches sont agrégées,
jamais listées comme des projets distincts.

**② Le montant du projet est la somme de ses tranches.**
`funding_amount = Σ (montants annuels du cœur)`. Les **sous-projets sont
repliés sur leur cœur** — jamais comptés deux fois.

**③ L'axe du temps reste la date calendaire.** Le produit range les
projets par leur **date de début réelle** (`start_date`), jamais par
année fiscale : une année fiscale US (oct→sept) ou britannique
(avr→mars) ne se compare pas à une année civile européenne. Le détail
par année fiscale est conservé dans `raw` (JSONB) pour l'audit et les
vues futures.

**④ La devise d'origine est conservée, la conversion est datée.**
`funding_amount`/`funding_currency` gardent la valeur native ;
`funding_amount_eur` est calculé au **taux moyen annuel BCE de l'année
de début du projet** (table `exchange_rates`, source `ecb`, chargeur
`orion-ingest rates`). Le produit dit toujours qu'il s'agit d'une
conversion et à quel taux — jamais un euro muet.

**⑤ Le périmètre annoncé est le périmètre chargé.** Chaque source dit
sa fenêtre (NIH : FY2005+) et la volumétrie constatée ci-dessous.

## ⚠️ NIH — deux réserves d'honnêteté (constatées au run du 2026-08-03)

Ce ne sont pas des défauts du chargeur mais des **propriétés de la
source**, à dire au lecteur plutôt qu'à masquer. **Deux décisions
attendent la fondatrice.**

**① Les véhicules contractuels et subventions de centre gonflent.** La
convention replie les tranches sur le numéro de cœur — c'est juste pour
un projet de recherche reconduit, mais certains numéros de cœur sont des
**parapluies** : le « Cancer Center Support Grant » P30CA008748 agrège
575 tranches, le contrat 261200800001E en agrège 619 pour 3,3 Md$.
**1 867 projets (0,5 %) dépassent 50 tranches et concentrent 59,5 Md$
sur 735,9 Md$ (8 %).** Ils ne sont ni faux ni comparables à un projet
CORDIS. *Vérifié : aucun ne pollue la une aujourd'hui* (leurs dates de
début sont anciennes, le plus gros projet 2024 reste européen).
**Décision à prendre** : les marquer « parapluie » (seuil de tranches,
visible sur la fiche et exclu des « plus gros projets »), ou les laisser
tels quels avec la mention au registre. *Recommandation : les marquer —
un parapluie et un projet ne se comparent pas.*

**② 25 215 projets sans date de début (6,6 %)**, essentiellement la
recherche **intra-muros** du NIH (préfixes ZIA/Z01) : RePORTER ne publie
pas de `PROJECT_START` pour ces lignes. Conséquence assumée : ils
n'apparaissent sur aucun axe temporel et **ne reçoivent aucune
conversion en euros** (la convention ④ convertit au taux de l'année de
début — sans année, pas de taux inventé). Avec les lignes sans montant,
71 149 projets NIH n'ont pas de montant en euros.
**Décision à prendre** : les dater par défaut à leur première année
fiscale (visible, mais approximatif), ou les garder hors axe temporel.
*Recommandation : les garder hors axe — une date inventée contaminerait
toutes les analyses de tendance.*

**Effet sur le corpus** : le total passe de **211 Md€ à ~650 Md€**
(NIH 439 Md€, soit 67 % — les États-Unis financent réellement à cette
échelle). Les libellés « UE + FR » ont été corrigés en conséquence.

## ⚠️ NIH — ce que le quadruplement du corpus a révélé (2026-08-03)

**① La collaboration américaine est invisible par construction.**
RePORTER publie **une seule organisation par financement** (le
bénéficiaire). Une organisation purement américaine n'a donc **aucun
partenaire** dans Orion : l'acte « Où vivent ses partenaires » de la
fiche ne s'affiche pas pour elle, et les cartes de collaboration
restent européennes. Ce n'est pas un défaut du chargeur — c'est la
donnée. À dire au lecteur le jour où une fiche américaine paraît vide
de ce côté (piste : les co-publications OpenAIRE, vague 1 étape 10).

**② La performance de recherche a décroché, et le réglage
d'infrastructure était la cause.** Le corpus passe de ~119 k à ~500 k
projets (2,5 Go de textes indexés) ; PostgreSQL tournait avec ses
**réglages par défaut** (128 Mo de cache pour 4 Go de données).
Mesures avant → après réglage (`shared_buffers=1GB`,
`effective_cache_size=3GB`, `work_mem=64MB`, à chaud) :

| Requête | Avant | Après |
| --- | --- | --- |
| « cancer » (75 k correspondances) | 9,4 s | 1,9 s |
| « quantum » | 1,7 s | 0,22 s |
| pays = FR (sans texte) | 4,7 s | 3,2 s |

**Piège découvert dans la foulée** : Docker plafonne `/dev/shm` à 64 Mo,
et les workers parallèles de PostgreSQL, avec le `work_mem` élargi, le
débordaient — les partenaires d'une grosse organisation renvoyaient une
**erreur 500** (« No space left on device »). `shm_size: 1gb` ajouté aux
deux compose. Corrigé et vérifié.

**Reste ouvert (chantier à proposer)** : « cancer » à 1,9 s et le filtre
pays seul à 3,2 s dépassent encore le budget de 300 ms. Le goulot n'est
plus l'infrastructure mais le **calcul des facettes sur des ensembles de
correspondances énormes**. À instruire comme un chantier propre — pas à
bricoler en fin de chargement.

## Couche identité — métriques du premier run réel (2026-08-03)

Socle de la vague 1 ([instruction](vague-1-instruction.md), cahier des
charges [groupes-couche.md](groupes-couche.md)) :

- **11 030 organisations pontées à un LEI** (~10,7 % des 103 457
  canoniques) par le pont nom+pays conservateur — unicité exigée des
  deux côtés, un pont qui hésite n'est pas un pont ;
- **1 457 groupes** constitués, **2 638 appartenances** (méthodes gleif
  0,75-0,90 / wikidata 0,60) ; têtes d'affiche immédiates : Siemens AG
  56 entités, **Thales 27**, Airbus SE 17, Engie 16, RTX 16, Vinci 14,
  BASF 13, ABB 13 — et **Safran** avec Goodrich Actuation et Crompton
  Technology, des acquisitions que le nom seul n'aurait jamais
  rattachées ;
- découverte d'instruction : **l'ANR ne publie pas de SIREN** (seulement
  RNSR) — le pont SIREN↔LEI est capté côté GLEIF (`ra_id` verbatim),
  prêt à s'allumer avec une source française qui en portera ;
- à traiter en curation (vague A, comme au cahier des charges) : les
  **JV** (Thales Alenia Space consolidée sous Thales à 100 % par GLEIF —
  à repondérer 67/33 avec marqueur JV) et les **têtes étatiques**
  (GLEIF consolide des organismes publics français sous « République
  française », 28 membres — vérité comptable, bruit produit) ; « Safran
  SA » elle-même reste non pontée (plusieurs candidates au même nom
  normalisé — file de curation, pas d'automatisme).

## Dédoublonnage des organisations — métriques (run du 2026-07-31, v0.1.0)

111 791 organisations brutes → **103 457 canoniques** (~27 min, journalisé dans `ingestion_runs`, source `dedup`) :

- **7 293 fusions exactes** (pays + nom normalisé identiques : casse, accents, ponctuation, formes juridiques et abréviations repliées)
- **849 fusions floues** (similarité trigramme ≥ 0,92, noms ≥ 12 caractères, même pays ; 9 442 paires candidates examinées)
- **3 234 fusions refusées par le garde-fou des identifiants** : noms identiques ou quasi identiques mais identifiants forts différents (PIC, SIREN, RNSR…) — deux entités juridiques distinctes, jamais fusionnées
- **192 organisations orphelines supprimées** (aucune participation : résidus de runs interrompus et de lignes doublons ignorées — une organisation sans projet ne décrit rien)
- 615 groupes résiduels partagent une clé normalisée sans être fusionnés (majoritairement séparés par leurs identifiants) ; 4 451 projets comptent une même organisation sur plusieurs participations après fusion — les analytics devront compter en DISTINCT

**Idempotence vérifiée** : une seconde passe sur la base déjà dédoublonnée n'a produit **aucune fusion** (103 649 → 103 649). Le pipeline converge.

**Normalisation multi-alphabets** : la clé de comparaison accepte tous les alphabets (grec, cyrillique, CJK). Une première version ne gardait que l'ASCII, ce qui vidait entièrement les noms non latins et les excluait silencieusement du dédoublonnage — défaut sans gravité aujourd'hui (20 organisations) mais bloquant dès l'ajout de sources japonaises ou coréennes. Seuls restent sans clé les noms purement typographiques (`_`, `-`, `.`), ce qui est voulu : ils ne portent aucune identité et ne doivent jamais se rapprocher entre eux.

**Écart assumé vs le brief** (~61 000 organisations attendues) : les garde-fous privilégient la précision — aucune fusion inter-pays, aucune fusion contre des identifiants contradictoires, seuil flou élevé. Beaucoup de « doublons » apparents sont des entités juridiquement distinctes (filiales nationales, laboratoires rattachés). Resserrer viendra en phase 3 (ROR, embeddings), avec métriques avant/après à chaque ajustement.

**Coût** : ~25 min, dont l'essentiel dans la passe floue (auto-jointure trigramme sur toute la table). Acceptable pour un job hebdomadaire nocturne ; à rendre incrémental en phase 3 si le volume croît.

## Protection des données personnelles

Les fichiers « partenaires » de l'ANR contiennent des **données personnelles** : nom, prénom et ORCID du responsable scientifique de chaque partenaire. Ces colonnes sont **écartées à la lecture du fichier** (`PERSONAL_DATA_COLUMNS` dans `orion/ingest/anr/parse.py`, garanti par un test) : elles n'entrent jamais en base, pas même dans le payload brut. Orion n'a pas besoin d'identifier des personnes pour analyser des financements — minimisation par conception.

## URLs officielles

- CORDIS bulk : `https://cordis.europa.eu/data/cordis-HORIZONprojects-csv.zip` · `…/cordis-h2020projects-csv.zip` · `…/cordis-fp7projects-csv.zip`
- Politique de réutilisation Commission : `https://commission.europa.eu/legal-notice_en`
- ANR sur data.gouv.fr : `anr-01-projets-anr-dos-et-dgds-detail-des-projets-et-des-partenaires` (DGDS) · `anr-02-projets-anr-dgpie-detail-des-projets-et-des-partenaires` (DGPIE)

## Attribution à afficher dans le produit

> Contains European Union public data: CORDIS — EU research projects (Horizon Europe, H2020, FP7), © European Union, reused under CC BY 4.0.

(Les mentions ANR/ADEME/LIFE seront ajoutées avec leur ingestion.)

## Notes de qualité constatées (2026-07-31)

- CSV CORDIS : séparateur `;`, décimales à virgule, lignes occasionnellement décalées (~166 sur ~84 k projets, rejetées et comptées `invalid_*`/`suspect_*` dans `ingestion_runs.detail`), 28 participations en doublon dans H2020 (dédupliquées).
- Identité des organisations : le PIC fusionne naturellement les organisations entre les trois cadres (80 225 organisations brutes avant l'étape de dédoublonnage flou du plan).
- Total CORDIS constaté : **84 452 projets**, cohérent avec la cible du brief (~106 k avec ANR + ADEME + LIFE).
