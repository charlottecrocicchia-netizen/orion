# La couche groupes — cahier des charges

> Chantier données de la vague 1 (décisions fondatrice des 2026-08-02 et
> 2026-08-03, conclusions de la grande recherche sources intégrées).
> Leçon U5 de Vega et différenciateur frontal confirmé sur pièces :
> KAILA fait regrouper 21 entités à la main (Merge/Cross) à chaque
> session ; notre couche automatique + curée rend ce geste caduc.

## Le principe : canonical layering, jamais de fusion

Les entités légales restent **vraies et intactes** — le garde-fou
anti-fusion existant continue de s'appliquer à l'identité des
organisations. La couche groupe se **superpose** :

- table `groups` : nom canonique, pays du QG, LEI ultime, source de la
  canonicité ;
- table `entity_group_map` : entité → groupe, avec **méthode** (gleif,
  wikidata, pont-id, règle, curation), **score de confiance**,
  **source**, **valid_from / valid_to** (l'appartenance à un groupe est
  datée : cessions, acquisitions, renommages).

Les coentreprises ne trichent jamais : Thales Alenia Space, c'est
**67 % Thales / 33 % Leonardo** — un rattachement **pondéré, marqué
JV**, jamais un 100 % arbitraire. Toute vue consolidée qui agrège des
montants respecte ces pondérations et dit qu'elle le fait.

## Les sources retenues (ouvertes, usage commercial vérifié)

**Vague A — les fondations :**

- **GLEIF / LEI Golden Copy** : Niveau 1 (identité), **relations
  Niveau 2** (parent direct / ultime) et **Reporting Exceptions**.
  Lucidité actée : **~4 % seulement des LEI portent un lien parent
  exploitable** — c'est une fondation fiable, pas une solution
  complète ;
- **Wikidata** : P749 (parent), P355 (filiale), P1278 (LEI) — riche sur
  les grands groupes, à corroborer ;
- **Ponts d'identifiants** : SIREN ↔ LEI ↔ PIC par chaînage — le PIC
  (CORDIS) rejoint le SIREN (ANR/RNSR) via le LEI quand il existe ;
  chaque pont posé sert ensuite à toutes les sources.

**Vague B — l'élargissement (après l'arrivée des sources US/UK) :**

- **SEC EDGAR Exhibit 21** : filiales déclarées des cotés US — pour
  NIH/NSF ;
- **Companies House PSC** (UK) : personnes/entités de contrôle — pour
  UKRI ;
- **Splink** : rapprochement probabiliste des variantes de noms (le
  moteur, pas une source), pour proposer — jamais décider seul.

## Les sources interdites — registre noir sur blanc

N'entrent **jamais** dans Orion (licences incompatibles avec un usage
commercial) :

- **OpenCorporates** — payant en usage commercial ;
- **D&B, Orbis (BvD), Capital IQ** — licences fermées ;
- **PermID, volet hiérarchies** — CC-NC (le volet identifiants ouverts
  reste consultable, les hiérarchies non) ;
- **Crunchbase** — non commercial.

Toute proposition d'enrichissement cite sa source et sa licence avant
d'entrer ; ce registre est opposable à chaque revue de données.

## La stratégie clé : curation des 100-200 plus gros groupes

Les recherches clients se concentrent sur les grands industriels —
Safran, Thales, Airbus, TotalEnergies, Siemens, Sanofi…
(aérospatial/défense, énergie, automobile, pharma). C'est exactement là
que KAILA fait regrouper à la main. Décision : **curation manuelle
assumée des 100-200 plus gros groupes**, outillée :

- **suggestions automatiques** : règles de préfixe de marque (« SAFRAN
  * », « THALES * ») avec **corroboration obligatoire** (un deuxième
  signal — LEI, Wikidata, pays cohérent — avant de proposer) ;
- **validation humaine systématique** : rien n'entre en curation sans un
  œil ; chaque validation nourrit `entity_group_map` avec
  méthode=curation et sa trace.

## Les trois vagues

| Vague | Contenu | Quand |
| --- | --- | --- |
| **A** | Schéma `groups` + `entity_group_map` ; chargeur GLEIF (L1, L2, exceptions) ; Wikidata ; ponts SIREN↔LEI↔PIC ; démarrage curation top groupes | **Avec la vague 1 des sources** — le socle identité se pose AVANT les nouveaux chargeurs |
| **B** | Règles de préfixe corroborées ; Splink ; EDGAR Exhibit 21 ; Companies House PSC | Après l'arrivée des sources US/UK de la vague 1 |
| **C** | Curation assistée continue ; fraîcheur : **delta GLEIF quotidien**, **re-sync Wikidata mensuel** ; revalidation des mappings datés | En régime de croisière |

## La fiche groupe (vision fondatrice, 2026-08-03)

Ouvrir « Safran » en globalité montre :

- la **vue consolidée** (montants agrégés aux pondérations JV près,
  disant toujours son périmètre et sa méthode) ;
- une **carte monde de toutes les entités légales** du groupe ; cliquer
  une entité **ou un continent entier** filtre les chiffres sur cette
  sélection — la règle des cartes s'applique (le premier clic explore,
  jamais il ne téléporte) ;
- une **mini-map monde en vignette à droite, qui tourne** — l'esprit du
  globe de l'accueil réduit en instrument de bord, navigation permanente
  dans la fiche.

La fiche groupe arrive en **fin de vague A**, quand les premiers groupes
sont peuplés ; le détail par entité reste à un clic (les entités sont
vraies, la couche est une lecture).

## Ce que ça change au séquencement de la vague 1

1. **La vague 1 s'ouvre par un socle identité** (= vague A hors
   curation) : les tables groupes et les ponts d'identifiants se posent
   **avant** les chargeurs US/UK — chaque nouvelle source vient se
   brancher sur les ponts au moment de sa normalisation, plutôt que de
   rétrofitter après coup. La dédup inter-sources déjà au programme
   s'adosse aux LEI.
2. **EDGAR et PSC attendent leurs sources** : Exhibit 21 n'a de sens
   qu'avec NIH/NSF ingérés, PSC qu'avec UKRI — la vague B des groupes
   s'intercale après les premiers chargeurs US/UK, pas avant.
3. **La curation top groupes démarre tôt et court en continu** : dès le
   socle posé (process manuel d'abord, l'outillage assisté de la vague C
   vient ensuite) — c'est le chemin le plus court vers la valeur client
   visible (la fiche groupe Safran/Thales en démo).
4. **La fiche groupe (front) jalonne la fin de vague A** — première
   preuve produit de la couche, avec sa carte monde des entités.
