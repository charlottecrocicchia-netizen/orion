# Registre des sources de données

Registre vivant : chaque source publique ingérée par Orion, avec sa juridiction, sa devise, sa licence vérifiée et sa volumétrie constatée. Conçu multi-pays et multi-devises (amendement du 2026-07-31) — les sources hors Europe s'ajouteront ici sans changement de schéma.

| Source (code) | Juridiction | Devise | Licence (vérifiée) | Cadence de publication | Volumétrie constatée |
|---|---|---|---|---|---|
| CORDIS Horizon Europe (`cordis-horizon`) | UE | EUR | **Décision 2011/833/UE** (« European Commission reuse notice » — licence déclarée sur la fiche data.europa.eu de la distribution CSV, revérifiée le 2026-08-26) : réutilisation commerciale autorisée avec attribution. La mention légale CORDIS accorde en plus le CC BY 4.0 au « editorial content » du site sans dire si les CSV en relèvent — même droit d'usage dans les deux régimes (R5A § 4.1) | ~mensuelle (dernier rafraîchissement source : 2026-07-21) | 23 278 projets, 144 117 participations (2026-07-31) |
| CORDIS H2020 (`cordis-h2020`) | UE | EUR | idem décision 2011/833/UE | figée (programme clos) + corrections | 35 389 projets, 178 967 participations (2026-07-31) |
| CORDIS FP7 (`cordis-fp7`) | UE | EUR | idem décision 2011/833/UE | figée (programme clos) | 25 785 projets, 140 063 participations (2026-07-31) |
| ADEME (`ademe`) | FR | EUR | Licence Ouverte 2.0 (vérifiée le 2026-07-31) | — | **Décision fondatrice du 2026-07-31 : non ingérée** (source hors sujet, voir ci-dessous) ; **France 2030** sera visé plus tard comme source française de R&D industrielle |
| LIFE (`life`) | UE | EUR | à confirmer sur l'export retenu | — | **Décision fondatrice du 2026-07-31 : reporté**, ne bloque pas la v0.1.0 ; piste de récupération future via **OpenAIRE** |
| NIH RePORTER (`nih`) | US | USD → EUR (taux BCE datés) | **Domaine public** (données fédérales US) — vérifiée le 2026-08-03 sur reporter.nih.gov ; précision R5A (2026-08-26) : RePORTER ne porte **aucune déclaration de licence propre** — le verdict s'appuie sur le régime général des œuvres du gouvernement fédéral (constat d'absence, R5A § 5.5) | annuelle par exercice (bulk par FY ; **FY2026 pas encore publié** — fenêtre réelle FY2005-2025) | **380 275 projets**, 379 346 participations, 358 911 résumés indexés, 77 instituts en programmes, 1 722 398 tranches annuelles repliées (2026-08-03) — voir les deux réserves ci-dessous |
| NSF (`nsf`) | US | USD → EUR (taux BCE datés) | **Domaine public, déclaré explicitement** — page *Award Search Overview* (nsf.gov/funding/award-search, revérifiée le 2026-08-26) : « Award data posted on the NSF website, including award abstract text, is in the public domain and not subject to copyright » (exception écrite : les publications listées comme résultats restent sous copyright éditeur — non ingérées). Le PAPPG fait du résumé, avec son titre, **un document de la NSF**. Mention affichée : « Courtesy: U.S. National Science Foundation » | annuelle par exercice (catalogue `list-files`, FY2005-2026) | **235 071 projets**, 259 788 financements lus, 259 788 participations, 232 929 résumés indexés, 72 divisions en programmes, **118,8 Md€** (2026-08-03) — dont **17 523 projets reconstitués** par l'extension fratries |
| NSF by the Numbers — Award Obligation (`nsf-obligations`) | US | USD (natif, jamais converti — R5B) | **Domaine public, déclaré explicitement** pour les award data NSF (« in the public domain and not subject to copyright », page *Award Search Overview*, revérifiée le 2026-08-26) ; le dashboard lui-même ne porte pas de déclaration propre — régime des données fédérales (R5A § 9.4.7-3) | **annuelle** (« updated annually when the fiscal year is complete ») ; la série officielle est RESTATÉE sans archives — chaque acquisition est un millésime Orion, append-only | 15 artefacts « @Award Details Sheet » FY2011-FY2025 (~21-24 k lignes/FY) + série Trends de contrôle, millésime 2026-08-26 ; acquisition et validation : `docs/runbook-nsf-obligations.md` ; c'est le numérateur ET le dénominateur de *Share of NSF award obligations* (métrique indépendante, hors Reference Engine) |
| Taux de change BCE (`ecb`) | — | — | Réutilisation libre avec attribution — vérifiée le 2026-08-03 | annuelle | 198 taux moyens annuels, 9 devises (USD/GBP/CHF/SEK/NOK/DKK/CAD/JPY/AUD) |
| EU Funding & Tenders — appels (`calls`) | UE | EUR | **CC BY 4.0** — décision 2011/833/UE ; T&C du portail (v7.0) lues intégralement le 2026-08-22 : elles régissent l'usage du système d'échange, pas la réutilisation des données ; la page « APIs » documente officiellement l'usage par systèmes externes (détail : [conception-e1-appels.md](conception-e1-appels.md) § 0) | quotidienne (scheduler VPS, job `calls`) | **Corpus VIVANT — jamais un invariant immuable** : 1 653 topics EN à la première moisson (2026-08-22), 1 654 au 2026-08-26 (+`EuropeAid/187517/DD/ACT/AL`, ouvert et capté le 25-08 — vérifié : les 1 653 d'origine tous présents, aucun perdu). Types Grant + Calls for proposals : ouverts, à venir, clos ≤ 6 mois ; pagination stabilisée par tri `identifier:ASC` (sans lui, ~200 topics d'écart entre deux moissons — constaté) |
| GLEIF Golden Copy (`gleif`) | Monde | — (identité) | **CC0** — vérifiée le 2026-08-03 sur gleif.org (« even for commercial purposes ») | quotidienne (publishes/latest, rejouée par le scheduler hebdo) | 3 391 838 LEI en miroir, 258 260 liens de consolidation ACTIVE (fonds exclus), exceptions filtrées aux LEI pontés : 17 208 (2026-08-03) |
| Wikidata parents (`wikidata`) | Monde | — (identité) | **CC0** — vérifiée le 2026-08-03 | mensuelle visée (rejouée par le scheduler hebdo) | 3 098 paires parent P749 entre porteurs de LEI bien formés (garde ISO 17442 : quelques P1278 sales rejetés) |

## 🔒 RÈGLE DE LICENCE — critère d'exclusion définitif

**Décision fondatrice du 2026-08-03, non négociable et opposable à toute
proposition de source.** Le marché cible d'Orion est international ;
aucune source ne vaut un risque juridique.

**N'entrent dans Orion QUE les licences limpides :**
domaine public · CC0 · CC-BY · Licence Ouverte (Etalab) · OGL (UK) ·
ou équivalent explicitement compatible avec un usage commercial et une
redistribution en base dérivée.

**Sont exclues définitivement :**

- **toute clause de partage à l'identique** — ODbL, CC-BY-SA, et
  assimilées : publier une base dérivée obligerait Orion à se publier
  sous la même licence ;
- **toute zone grise juridique** — licence absente, ambiguë, ou dont la
  portée commerciale demande une interprétation ;
- **toute licence non commerciale** — CC-BY-NC et assimilées ;
- **toute source propriétaire** dont la redistribution exige une licence
  négociée (voir le registre noir du chantier groupes :
  [groupes-couche.md](groupes-couche.md)).

**Procédure, à chaque source, sans exception** : la licence est
**vérifiée à la source le jour du chargement** (pas au dossier
d'instruction — les conditions changent), sa mention exacte est portée
au tableau ci-dessus, et une licence qui bascule vers l'exclusion
déclenche le retrait de la source. C'est ce qui est arrivé à l'ANR.

### Vérification formelle — GISCO / Eurostat (2026-08-17, lot F)

Instruction fondatrice : trancher noir sur blanc avant toute carte
européenne. Vérifié **à la source, aux pages officielles**, et le
verdict est DOUBLE — les deux objets ne suivent pas la même licence.

| Objet | Licence constatée | Verdict |
|---|---|---|
| **Géométrie NUTS / limites administratives** (GISCO, dérivée d'EuroGeographics) | « *the data will not be used for commercial purposes* » + « *© EuroGeographics for the administrative boundaries* » + usage commercial renvoyé à un **accord négocié** avec EuroGeographics | ❌ **EXCLUSION** |
| **Classification NUTS elle-même** (codes + noms, tables de correspondance — donnée statistique Eurostat) | CC BY 4.0, décision 2011/833/UE : « *Reuse of statistical data, metadata… for commercial or non-commercial purposes is authorised provided the source is acknowledged* » | ✅ **PASSE** |

**La géométrie échoue sur DEUX motifs de notre règle, pas un** : la
clause **non commerciale** (Orion est un SaaS commercial — exclusion
sèche) et la **redistribution négociée** (« contactez EuroGeographics
pour leurs accords de licence » — exactement la zone que la règle
refuse). Aucun arbitrage à faire : c'est la même famille que l'ODbL de
l'ANR, en pire. Réexamen possible seulement si nous ACHETONS une licence
EuroGeographics — décision commerciale, jamais technique.

**La nomenclature passe**, et avec elle le `nuts_code` que CORDIS nous
donne déjà (CC BY 4.0). Conséquence pratique : une V1 « régions
européennes » **sans carte** est parfaitement licite (classement, barres,
comparaison — codes ET noms officiels), et c'est la seule forme
livrable en l'état.

Pistes de géométrie licite, si la carte devient indispensable (non
instruites, coût réel à mesurer) : les référentiels NATIONAUX en licence
ouverte, pays par pays (la France publie ADMIN EXPRESS sous Licence
Ouverte) — long mais propre ; Natural Earth admin-1 (domaine public) est
disponible mais ses découpages ne coïncident PAS avec les NUTS, l'y
faire correspondre fabriquerait une approximation silencieuse : à
refuser par principe. OpenStreetMap est exclu d'office (ODbL,
partage à l'identique).

### Vérification — API EU Funding & Tenders (2026-08-17, phase 5)

Affirmation d'un audit externe : « CC-BY 4.0 par défaut ». Vérifié à la
source ce jour : la mention légale de la Commission pose le défaut
**CC BY 4.0 (décision 2011/833/UE), réutilisation commerciale autorisée**
avec attribution, pour tout contenu détenu par l'UE ; le portail F&T est
un site de la Commission, ses données d'appels relèvent de ce défaut.
**Verdict : PASSE** — même base que la nomenclature NUTS. Réserve de
procédure : la mention légale PROPRE au portail (SPA illisible en fetch)
sera relue au navigateur le jour du chargement, règle sans exception.
Première source licite de la phase 5 (appels), instruction post-serveur.
Détail : [lecons-audit-produit.md](lecons-audit-produit.md).

### Nomenclature NUTS — chargée le 2026-08-17, attribution consignée

**Canal d'acquisition : l'API de diffusion statistique Eurostat**
(codelist SDMX 2.1 `ESTAT/GEO`,
`ec.europa.eu/eurostat/api/dissemination/…`) — délibérément PAS le
serveur GISCO, même pour un fichier sans géométrie : zéro ambiguïté,
c'est la donnée statistique du site Eurostat, couverte par la décision
2011/833/UE (CC BY 4.0, réutilisation commerciale explicitement
autorisée, vérifiée à la source ce jour — section GISCO ci-dessus).

**Attribution requise et portée par le produit** : « Source : Eurostat —
nomenclature NUTS, © Union européenne, CC BY 4.0 ». À afficher sur les
surfaces qui montrent des noms de régions (crédit de pied de page avec
CORDIS/NIH/NSF, page « À propos des données ») — posée avec les
surfaces du lot F.

**Modifications déclarées** (la CC BY exige de les indiquer) : filtrage
aux codes NUTS des pays du système (UE-27, AELE, candidats, UK hérité,
UA/MD) — les agrégats statistiques (EU27, zone euro, ACP…) sont
écartés ; suffixes de millésime retirés des libellés (« Zuid-Holland
(NUTS 2021) » → « Zuid-Holland »). Libellés officiels conservés
VERBATIM par ailleurs (« Ile de France », sans accent : écriture
Eurostat). **3 348 codes** (254 NUTS1, 610 NUTS2, 2 484 NUTS3),
fichier versionné `backend/curation/nuts-nomenclature.tsv` — le diff
est le journal d'audit, comme la curation des groupes.

### 📉 Backfill NUTS — la ligne de perfs constatées (run prod du 2026-08-17)

Le rétro-remplissage `participations.nuts_code` depuis les caches CORDIS
(fp7, h2020, horizon), version table temporaire indexée + jointure
`split_part` — après l'abandon du motif LIKE qui rebalayait 842 k lignes
par lot de 5 000 :

- **431 798 / 463 147** participations CORDIS tamponnées (**93,2 %**),
  en **125 s** tout compris (lecture des trois zips, table temporaire,
  index, UPDATE en une passe) — sur l'image tamponnée `4de2ca8aa93d`,
  vérifiée AVANT lancement grâce au label de révision : plus jamais un
  run sur du vieux code sans le savoir ;
- résidu : **31 349 participations sans code** — l'organisation n'a pas
  de `nutsCode` dans CORDIS (pays tiers surtout) ; l'absence restera
  dite à l'écran, jamais fondue dans un zéro (règle du lot E) ;
- résidu de PROFONDEUR : une part des codes s'arrête au niveau pays
  (« FR » sec : 2 118 participations françaises) ou NUTS1 — la vue par
  régions les classera « région non précisée », pas ailleurs ;
- sanity check qui parle : FR10 (Île-de-France) 12,37 Md€, puis
  **FRJ2 (Midi-Pyrénées / Toulouse) 1,16 Md€** juste derrière FRK2
  (Rhône-Alpes) 1,25 Md€ — l'aérospatial se lit déjà dans la maille ;
- au passage, la passe idempotente a reconfirmé les 362 219 États
  américains (NIH), et signalé **1 cache NSF manquant** au volume
  (`nsf_cache_missing=1`) : à re-télécharger au prochain run NSF, sans
  effet sur l'existant.

### Précédent : l'ANR, retirée le 2026-08-03

Les données ANR étaient publiées sous **ODbL 1.0** (clause de partage à
l'identique). Un arbitrage juridique était initialement prévu avant la
mise en production ; **la fondatrice a tranché autrement : l'ANR sort du
produit, définitivement.** Le différenciateur français ne justifiait pas
le risque sur un marché cible international. **L'étude d'isolation ODbL
est sans objet et annulée.**

Retrait exécuté (migration `0010_remove_anr`, dev et prod) : 34 720
projets, 117 859 participations, 59 957 textes, 450 programmes et les
organisations devenues orphelines. Le chargeur, ses tests, ses fixtures
et son cache ont quitté le dépôt dans le même commit — garder un
chargeur pour une source bannie serait un piège.

**Corpus après retrait : 464 727 projets, 96 670 organisations,
842 493 participations, 615,7 Md€** (contre 499 447 / 119 952 /
960 352 / 650,4 Md€ avant).

**Corpus après l'arrivée de la NSF (2026-08-03) : 699 798 projets,
110 117 organisations, 1 102 259 participations, 676 016 textes,
734,5 Md€.**

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

## ⚠️ Conséquence du retrait : plus aucun texte en français dans le corpus

Constat au run du 2026-08-03, à dire plutôt qu'à laisser découvrir :
**les 32 759 textes français venaient tous de l'ANR**. Le corpus compte
désormais **443 363 textes, tous en anglais**.

- **L'interface reste bilingue** (FR/EN partout) — c'est une promesse
  distincte, et elle tient.
- **La recherche en français fonctionne toujours** par le pont des
  cognats (« hydrogène » trouve « hydrogen » : unaccent + stemming
  croisé, machinerie inchangée et testée), mais **aucun extrait ne
  s'affichera en français** puisque aucun texte source ne l'est.
- **La configuration `orion_fr` reste testée** (fixtures du seed e2e) :
  le jour où une source francophone au filtre licence entre — France
  2030 est la candidate déjà notée — la machinerie est prête.

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

### Extension nommée — « fratries NSF » (validée le 2026-08-03)

La convention ci-dessus replie **les années**. Cette extension replie
**les partenaires**, et elle ne vaut que pour les sources qui découpent
un même projet en plusieurs financements, un par établissement. Elle
s'ajoute à la convention, elle ne la modifie pas.

**Le fait.** La NSF ne finance qu'un établissement par financement. Un
projet mené par six universités donne **six financements distincts**,
tous intitulés `Collaborative Research: <même titre>`. Laissés tels
quels : six projets, aucune collaboration visible — le défaut déjà
constaté sur NIH, en pire.

**La règle.** Les financements d'une même fratrie deviennent **un seul
projet portant une participation par établissement**, si et seulement si
**les quatre gardes** tiennent :

1. le **préfixe explicite** publié par la source (`Collaborative
   Research:` ou `Collaborative Proposal:`) — sans lui, des titres
   identiques sont des parapluies de bourses, et 152 financements
   partagent le titre « NSF East Asia Summer Institutes » ;
2. la **même année fiscale** — un même titre revient d'une génération à
   l'autre (« Astronomy with CARMA » existe en 2009 et en 2012 : deux
   projets, jamais un) ;
3. le **titre normalisé identique** une fois le préfixe retiré ;
4. des **établissements tous distincts et tous nommés** — mesurés sur la
   clé exacte qui sert à rattacher la participation, sinon un même
   établissement compterait deux fois dans un seul projet.

Un cinquième filet écarte les fratries dont les dates de début
s'écartent de plus d'un an (maximum constaté : 319 jours). **Tout ce que
les gardes refusent reste un projet à part, et le nombre de refus est
journalisé** — jamais masqué.

**Ce qui n'est pas inventé.** La NSF ne publie pas quel membre pilote :
tous les membres d'une fratrie sont donc marqués **`partenaire`**, aucun
`coordinateur`. Un financement seul, lui, a un bénéficiaire unique et
reste `coordinateur`. Les identifiants de tous les membres sont
conservés dans `raw`, et le projet porte un marqueur `collaborative`.

**Résultat constaté au chargement réel (2026-08-03)** : sur 259 788
financements, **42 240 se replient en 17 523 projets** (−24 717), et
**42 fratries sont refusées** par les gardes. Les 42 240 participations
qui en résultent sont les **premières participations « partenaire »
américaines d'Orion** — jusque-là, les États-Unis n'avaient que des
bénéficiaires isolés.

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
| index des pays (la carte) | — | 4,6 s |

**Piège découvert dans la foulée** : Docker plafonne `/dev/shm` à 64 Mo,
et les workers parallèles de PostgreSQL, avec le `work_mem` élargi, le
débordaient — les partenaires d'une grosse organisation renvoyaient une
**erreur 500** (« No space left on device »). `shm_size: 1gb` ajouté aux
deux compose. Corrigé et vérifié.

**Reste ouvert (chantier à proposer)** : « cancer » à 1,9 s, le filtre
pays seul à 3,2 s et **l'index des pays qui alimente la carte à 4,6 s**
(assez lent pour faire expirer un parcours e2e) dépassent le budget de
300 ms. Le goulot n'est
plus l'infrastructure mais le **calcul des facettes sur des ensembles de
correspondances énormes**. À instruire comme un chantier propre — pas à
bricoler en fin de chargement.

## ⚠️ NSF — les réserves d'honnêteté (constatées au run du 2026-08-03)

Comme pour NIH, ce sont des **propriétés de la source**, dites plutôt
que masquées.

**① La route documentée par la NSF est morte.** Sa page de
téléchargement et son ancien point d'entrée redirigent vers la nouvelle
application de recherche, et **l'inventaire de données publiques de la
NSF pointe encore vers cette URL morte**. Orion passe par le catalogue
de l'application (`api.nsf.gov/services/v2/s3/list-files`) et **résout
les liens signés à chaque run**. Conséquence à surveiller : cette route
n'est pas contractuelle ; si elle bouge, le chargeur échoue bruyamment
(chaque année manquante est comptée, et **le nettoyage des projets
disparus est alors désactivé** — une année absente ne doit jamais
effacer sa moisson).

**② Aucun projet sans date** (0 sur 235 071 — la NSF publie toujours la
date d'effet), mais **4 412 projets sans montant en euros** (1,9 %) :
ceux qui démarrent en 2026, dont le taux BCE annuel n'existe pas encore,
et ceux dont le versé est nul. Aucun euro inventé.

**③ Une seule organisation par financement, comme NIH.** Hors fratries,
un financement NSF n'a qu'un bénéficiaire : les 42 240 participations
« partenaire » de l'extension sont donc **toute** la collaboration
américaine visible. Les 217 548 autres restent des bénéficiaires isolés.

**④ Trois UEI malformés refusés** et **un seul libellé de pays non
résolu** : « Australasia », qui est une région, pas un pays — il reste
sans code plutôt que d'être deviné. (« Germany, Berlin » l'était aussi
au premier run ; le référentiel lit désormais le nom avant la virgule.)
Une douzaine d'organisations NSF restent sans pays.

### 📉 NSF — la ligne de perfs constatées (règle du 2026-08-03)

Mesuré sur la prod locale (8 Go de VM, 4 Go de cache PostgreSQL), même
protocole des deux côtés : **chauffe avec un jeu de termes → API
redémarrée (vide le cache applicatif) → mesure avec les mêmes termes**.
Corpus 464 727 → **699 798 projets (+51 %)**, base 4,4 → **5,7 Go**.

| Parcours | Avant NSF | Après NSF | Budget |
| --- | --- | --- | --- |
| Recherche terme neuf | 400 ms | **3 412 ms** | 1 500 ❌ |
| Recherche cache chaud | 449 ms | **2 319 ms** | 300 ❌ |
| Filtre pays | 234 ms | **1 341 ms** | 300 ❌ |
| Index des pays (la carte) | 4,6 ms | **19 ms** | 300 ✅ |
| Fiche organisation | 7,9 ms | **50 ms** | 300 ✅ |
| Partenaires d'une organisation | 5,1 ms | **12,7 ms** | 300 ✅ |

**Le verdict, sans habillage : le budget de 300 ms est rompu sur la
recherche et le filtre pays.** +51 % de corpus a multiplié la recherche
par 8,5 et le filtre pays par 5,7 — une pente bien pire que
proportionnelle, exactement ce que la preuve d'échelle du chantier
performance annonçait : **c'est la mémoire qui gouverne**, pas
l'algorithmique. Le premier visiteur après un chargement paie encore plus
cher : 22 secondes en médiane, 60 au pire, cache entièrement froid.

**Ce qui tient, et ce que ça prouve** : les agrégats matérialisés
encaissent le +51 % sans broncher (carte 4,6 → 19 ms, soit 6 % de son
budget). O2 est validé une seconde fois. Ce qui décroche est exactement
ce qui doit lire la matière chaude : le texte intégral et ses index.

**La conséquence est budgétaire, pas logicielle.** La règle de
dimensionnement écrite à la clôture du chantier performance — 8 Go
aujourd'hui, 16 Go au doublement, 24-32 Go pour le corpus de fin de
vague 1 — **n'est plus une prévision : elle est atteinte**. À 700 000
projets pour 5,7 Go de base, 4 Go de cache ne suffisent plus. Aucune
réécriture de requête ne remplacera cette RAM ; le chantier performance
l'a mesuré des deux côtés, et NSF vient de le confirmer en vraie
grandeur.

### ⚠️ Correction du 2026-08-04 : ces chiffres surestiment l'effet du corpus

Le tableau ci-dessus a été mesuré alors que la VM Docker était
configurée à **8 Go sur une machine qui n'en a que 8** : macOS paginait
11,3 Go. Les « 4 Go de cache PostgreSQL » étaient eux-mêmes sur disque.
Une part des latences attribuées à la croissance du corpus était de la
**double pagination**.

Les deux colonnes ayant été mesurées dans le même état, **le rapport
avant/après reste indicatif** ; les **valeurs absolues, non**. Après
recalibrage de la machine (VM 4 Go, cache 1,5 Go, une seule pile), le
même corpus donne : recherche sur terme courant **5 à 6 s**, filtre
États-Unis **6 s**, carte **19 ms**, fiche organisation **25 ms**. Le
détail, la configuration et le dimensionnement requis sont dans
[hebergement.md](hebergement.md).

La conclusion, elle, ne bouge pas : **c'est la mémoire qui gouverne**, et
cette machine n'en a pas assez pour son corpus.

**⑤ La NSF entre directement dans « les plus gros projets ».** Sa
« Leadership Class Computing Facility » (347 M€, 2024) devient le
deuxième plus gros projet récent du corpus, derrière un pilote européen
et devant les partenariats européens. Ce ne sont **pas** des parapluies
au sens NIH : ce sont de vraies infrastructures. La une change, et c'est
juste.

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
- **pont américain ouvert par la NSF (2026-08-03)** : 7 495
  organisations reçoivent leur **UEI**, et **804 liens filiale → maison
  mère** (`uei_links`) entrent en base — une consolidation que GLEIF ne
  voit pas sur l'académique américain. Captés le jour où la donnée
  passe, **non encore câblés** aux appartenances : c'est le travail de
  la vague groupes suivante. Garde de forme comme pour les LEI : un UEI
  fait douze caractères alphanumériques, **3 valeurs malformées ont été
  refusées et comptées** plutôt qu'élargies dans la colonne ;
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

> Contains data from NIH RePORTER (U.S. Department of Health and Human Services), public domain.

> Courtesy: U.S. National Science Foundation — award data, public domain.

> Contains data from the EU Funding & Tenders Portal, © European Union, reused under CC BY 4.0.

Les montants en euros portent toujours la mention de leur conversion
(taux moyens annuels BCE de l'année de début).

## Notes de qualité constatées (2026-07-31)

- CSV CORDIS : séparateur `;`, décimales à virgule, lignes occasionnellement décalées (~166 sur ~84 k projets, rejetées et comptées `invalid_*`/`suspect_*` dans `ingestion_runs.detail`), 28 participations en doublon dans H2020 (dédupliquées).
- Identité des organisations : le PIC fusionne naturellement les organisations entre les trois cadres (80 225 organisations brutes avant l'étape de dédoublonnage flou du plan).
- Total CORDIS constaté : **84 452 projets**, cohérent avec la cible du brief (~106 k avec ANR + ADEME + LIFE).
