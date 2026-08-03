# Annexe — rapport de recherche : sources de hiérarchies d'entreprises pour la couche groupes

> **Statut : document de référence du chantier couche groupes**
> (fondatrice, 2026-08-03). Les conclusions opérationnelles sont
> reprises dans le cahier des charges [groupes-couche.md](groupes-couche.md) ;
> ce rapport garde le détail (fichiers GLEIF exacts, API, tableau des
> licences) pour la construction de la vague A. Les licences citées se
> re-vérifient à l'intégration — règle du registre
> [data-sources.md](data-sources.md).

## TL;DR
- **La meilleure fondation gratuite et commercialement exploitable est GLEIF/LEI (licence CC0), mais avec une réserve majeure : au T4 2025, seuls ~4 % des LEI portent un lien parent-direct-avec-LEI exploitable par machine** (88 % « pas de parent » selon la définition de consolidation, 4 % parent sans LEI, 4 % non-public). Il faut donc combiner GLEIF avec Wikidata (CC0), des règles de noms, les registres nationaux (SIRENE) et surtout une curation manuelle des 100-200 plus gros groupes que vos clients chercheront.
- **Le pattern « couche groupe au-dessus, entités légales préservées en dessous » (canonical layering) est le bon design** : ne fusionnez jamais les entités canoniques ; ajoutez une table `groupe` et une table de rattachement `entité→groupe` avec source, score de confiance et horodatage, permettant vue consolidée ET détail par entité.
- **Évitez les impasses juridiques** : D&B, Orbis/BvD, Capital IQ interdisent la réintégration dans un SaaS tiers sans licence coûteuse ; OpenCorporates exige un abonnement commercial (à partir de 2 250 £/an) ; le volet CC-NC de PermID et la plupart des jeux Crunchbase récents sont non-commerciaux. Les seules sources véritablement réutilisables gratuitement en commercial sont GLEIF (CC0), Wikidata (CC0), ROR (CC0), CORDIS (CC BY 4.0), SIRENE (Licence Ouverte) et SEC EDGAR (domaine public).

## Key Findings

1. **GLEIF est la clé de voûte open source, mais sa couverture relationnelle réelle est faible.** Selon le GLEIF Global LEI System Business Report du T4 2025 (publié le 26 janvier 2026), « the total active LEI population reached over 2.93 million » (précisément 2 934 798 LEI actifs). « Over 3.03 million LEI registrants… representing 99% of the total LEI population, reported information on direct and ultimate parents » — mais l'issue de cette déclaration est révélatrice : « the percentage of legal entities reporting a direct parent with an LEI was 4%. The percentage of legal entities reporting a direct parent that does not have an LEI was also 4%. 88% of legal entities reported no direct parent according to the definition used. 4% of legal entities' relationship information is non-public ». Autrement dit, **seuls ~4 % des enregistrements offrent un lien LEI-à-LEI directement exploitable**. Le fichier de relations (RR-CDF) contenait ~658 000 enregistrements en juillet 2026. La qualité des relations qui existent est elle-même moyenne : pour le parent direct, 51,3 % « Fully Corroborated », 42,6 % « Entity Supplied Only », 6,1 % « Partially Corroborated ». **Conclusion : GLEIF donne des liens fiables pour les groupes financiers/cotés, mais laisse de côté la majorité des filiales industrielles.**

2. **GLEIF ne sait pas représenter les coentreprises.** Le modèle Niveau 2 repose strictement sur la consolidation comptable (« based on percentage share of accounting consolidation as per LEI Regulatory Oversight Committee prescription ») : seul le parent qui consolide (participation majoritaire) est déclaré. Une JV 67/33 comme Thales Alenia Space (67 % Thales, 33 % Leonardo) sera au mieux rattachée au propriétaire à 67 % ; la participation minoritaire de Leonardo n'apparaît pas. C'est une limite structurelle à gérer par des règles métier. (À noter : un protocole d'accord Airbus/Leonardo/Thales d'octobre 2025 prévoit de fusionner les actifs spatiaux dans une nouvelle JV 35/32,5/32,5 — opération *annoncée mais non finalisée*.)

3. **Un même groupe est éclaté sur des dizaines de LEI.** Safran S.A. (LEI 969500UIC89GT3UL7L24) et Thales S.A. (LEI 529900FNDVTQJOVVPZ19) ont chacune de nombreuses filiales dotées de LEI propres (Safran Aircraft Engines, Safran Electronics & Defense, Safran Helicopter Engines, Safran Martin-Baker France 9695009SWRDI8V543M27, Thales LAS France 529900CPOLHT58A0WA93, Thales Services SAS 529900B6F5I11XJVEW47, etc.). Or les enregistrements Niveau 2 ne pointent pas de façon fiable vers le parent ultime : plusieurs filiales françaises n'exposent que des données Niveau 1. C'est l'illustration concrète du trou de couverture — les liens narratifs « Parent : Safran » existent dans Wikipédia/Wikidata mais pas toujours dans le RR-CDF machine.

4. **CORDIS/PIC n'offre AUCUN lien de groupe.** Le schéma ouvert des organisations CORDIS (H2020/FP7/Horizon Europe) ne contient que : PIC (`organisation_id`), nom légal, nom court, type d'activité, pays, URL, rôle, contribution CE, VAT. Il n'existe ni `parentPIC`, ni `groupID`, ni champ d'affiliation. Le PIC est un identifiant plat par entité légale ; le seul lien modélisé est organisation→projet (participation). La base enrichie e-CORDA existe mais est non-publique (« access… provided to members of the Strategic Configuration of the Programme Committee »). Le regroupement doit donc être inféré à l'extérieur du corpus. CORDIS est sous licence CC BY 4.0 (métadonnées CC0).

5. **Wikidata est le meilleur complément gratuit pour les grands groupes.** Les propriétés P749 (parent organization/unit) et P355 (child organization/unit) modélisent explicitement les hiérarchies (l'exemple officiel de P749 est Airbus Commercial Aircraft → Airbus), avec P127 (owned by) et P1278 (LEI). Licence CC0. Fiabilité inégale (données importées de Wikipédia, références souvent absentes — « 0 references » sur de nombreuses valeurs), mais excellente couverture des groupes cotés notables — précisément ceux que les clients industriels d'Orion chercheront.

6. **ROR couvre les hiérarchies mais pour la recherche académique, pas l'industrie.** Selon le billet ROR « Parents, Children, and Other Relationships », le registre comptait 104 594 organisations et « there are more than 22,000 total relationships between organizations (22,057), which means that approximately 21% of ROR records have at least one relationship… Parent-child hierarchies are the most common relationship type, with more than 17,000 instances » (le registre dépasse aujourd'hui 120 000 organisations). Licence CC0. Utile pour universités, laboratoires et agences (ex. le DOE et ses laboratoires nationaux), peu pertinent pour Safran ou Bayer.

7. **Les sources commerciales sont les plus complètes mais juridiquement fermées pour un SaaS solo.** D&B (arbres de familles corporate + UBO, base de 272-500 M d'entités, DUNS), Orbis/Bureau van Dijk (Moody's, 600 M+ entités), S&P Capital IQ, LSEG/Refinitiv : toutes vendent des hiérarchies de haute qualité, mais à des tarifs entreprise (milliers à dizaines de milliers €/an, prix non publié pour D&B) et surtout avec des licences interdisant la redistribution dans un produit tiers sans accord spécifique. Impraticable pour une fondatrice solo à budget réduit.

## Details

### 1. Panorama des sources de données de hiérarchies

**GLEIF / LEI (Niveau 2 « who owns whom »)** — Couverture : mondiale, 2,93 M d'entités actives (T4 2025), biais vers les entités du secteur financier et les entités cotées soumises à obligation de LEI. Contenu : parent direct et parent ultime « de consolidation comptable », identifiés par LEI ; fichiers RR-CDF (relations) + Reporting Exceptions (catégories NON_CONSOLIDATING, NON_PUBLIC, NO_LEI). Accès : API GLEIF (`api.gleif.org`, endpoints `/direct-parent` et `/ultimate-parent`), Golden Copy et Concatenated Files en téléchargement bulk, 3× par jour. Licence : **CC0 (domaine public), réutilisation commerciale libre** — c'est le point décisif (« you may download, copy, modify, distribute… even for commercial purposes »). Coût : gratuit. Fraîcheur : quotidienne. Limites : ~4 % de liens LEI-à-LEI seulement ; 88 % « pas de parent » (consolidation) ; ~4 % non-public ; incapacité à modéliser les JV et participations minoritaires.

**Wikidata** — Couverture : mondiale, biais vers entités notables (cotées, grandes). Contenu : P749/P355 (parent/enfant), P127 (owned by), P1278 (LEI), identifiants croisés (ISIN, etc.). Accès : SPARQL, dumps, API REST. Licence : **CC0**. Coût : gratuit. Limites : fiabilité hétérogène, références manquantes, granularité variable.

**ROR** — Couverture : ~120 000 organisations de recherche, ~21 % avec au moins une relation. Contenu : relations parent/child/related/successor/predecessor. Accès : API REST, dumps. Licence : **CC0**. Limites : hors périmètre industriel.

**SIRENE (INSEE, France)** — Couverture : ~25 M d'unités légales, ~36 M d'établissements depuis 1973. Contenu : SIREN (unité légale) / SIRET (établissement), forme juridique, NAF, liens de succession. **Point crucial : SIRENE ne publie pas de lien capitalistique tête-de-groupe → filiales dans l'open data standard** ; le lien SIREN→SIRET est un lien entité-établissement (même personne morale), pas un lien de groupe. Les « contours de groupe » (fichier LIFI) relèvent de bases INSEE plus restreintes. Accès : API Sirene, dumps sur data.gouv.fr. Licence : **Licence Ouverte** (réutilisation commerciale permise), avec obligations CNIL sur les personnes physiques.

**Companies House (UK) — PSC** — Couverture : sociétés britanniques. Contenu : personnes/entités ayant un contrôle significatif (≥25 %), y compris entités mères ; snapshot PSC en bulk JSON, gratuit, quotidien (« This snapshot is provided free of charge »). Licence : données ouvertes. Utile pour les filiales UK, mais qualité déclarative variable (« Companies House may not enforce the correct filing of PSC reports »).

**Open Ownership** — Couverture : >20 M d'enregistrements, UK + Danemark, Lettonie, Slovaquie + mapping GLEIF. Contenu : ownership/control selon le standard BODS. Accès : dump bulk gratuit. Licence : Open Data Commons Attribution / CC0 selon les jeux. Pertinence : bénéficiaires effectifs plutôt que hiérarchie de consolidation, mais complémentaire.

**SEC EDGAR — Exhibit 21** — Couverture : émetteurs cotés US (10-K). Contenu : liste des filiales significatives + juridiction (texte semi-structuré ; ex. ADM omet 59 filiales domestiques et 60 internationales jugées non significatives). Accès : EDGAR (domaine public), parsing requis (les Exhibit 21 sont des documents séparés). Licence : **domaine public**. Limites : uniquement filiales « significatives », pas de % de détention systématique, format hétérogène.

**OpenCorporates** — Couverture : 200 M+ d'entités, registres officiels mondiaux. Contenu : relations parent-filiale limitées (quand déclarées au registre), pas d'UBO. Accès : API. Licence : **usage commercial payant** — « API access requires a monthly/yearly subscription for commercial uses, starting from GBP 2,250 per year for the Essentials package, GBP 6,600/year for the Starter package, GBP 12,000/year for the Basic package » ; usage gratuit réservé aux projets open data / journalistes / ONG / recherche d'intérêt public. Réserve : environ la moitié des sources seraient « offline »/non mises à jour.

**Dun & Bradstreet (DUNS + corporate family trees)** — Couverture : 255+ pays, base de 272-500 M d'entités. Contenu : arbre de famille corporate (parent domestique, parent global ultime), UBO, DUNS. Licence/prix : abonnement entreprise, non publié, typiquement plusieurs milliers €/an ; redistribution dans un SaaS tiers nécessite une licence dédiée. Impraticable en solo.

**Bureau van Dijk / Orbis (Moody's), S&P Capital IQ, FactSet** — Les références du marché pour les hiérarchies mondiales (Orbis : 600 M+ entités), mais licences entreprise fermées et coûteuses.

**LSEG/Refinitiv PermID** — PermID « open » sous **CC-BY 4.0** pour un sous-ensemble (utilisable en commercial avec attribution) ; un ensemble étendu (dont potentiellement subsidiaries↔parent) sous **CC-NC (non-commercial)**, donc inutilisable dans Orion sans licence LSEG (confirmé par un échange sur le forum développeur LSEG : « I don't think this is allowed »). La donnée « Corporate Hierarchy » riche est un produit LSEG payant.

**Crunchbase** — Contient parent/subsidiaries et acquisitions (définies comme prises de contrôle majoritaires), mais les jeux récents sont sous CC BY-NC (non-commercial, historique du litige AOL/Pro Populi) ; l'API commerciale est payante. À écarter pour la couche de base.

### Tableau comparatif des sources

| Source | Couverture groupes industriels | Contenu hiérarchie | Accès | Réutilisation commerciale | Coût |
|---|---|---|---|---|---|
| **GLEIF / LEI Niveau 2** | Moyenne (biais financier/coté) ; ~4 % liens exploitables | Parent direct + ultime (consolidation), par LEI | API + bulk (Golden Copy) | **Oui (CC0)** | Gratuit |
| **Wikidata** | Bonne pour grands groupes notables | P749/P355 parent/enfant + LEI/ISIN | SPARQL, dumps, API | **Oui (CC0)** | Gratuit |
| **ROR** | Faible (recherche académique) | parent/child/related | API, dumps | **Oui (CC0)** | Gratuit |
| **SIRENE (FR)** | Entités FR, pas de lien de groupe standard | SIREN/SIRET (entité-établissement) | API, dumps | **Oui (Licence Ouverte)** | Gratuit |
| **Companies House PSC (UK)** | Entités UK | Contrôle ≥25 %, entités mères | Bulk JSON, API | **Oui (données ouvertes)** | Gratuit |
| **Open Ownership** | UK + qq pays + mapping GLEIF | Bénéficiaires effectifs (BODS) | Dump bulk | **Oui (ODC-BY/CC0)** | Gratuit |
| **SEC EDGAR Exhibit 21** | Groupes cotés US | Liste filiales significatives | Parsing EDGAR | **Oui (domaine public)** | Gratuit |
| **OpenCorporates** | Large (registres) | Parent-filiale limité | API | Payant (gratuit = open data/ONG) | ≥2 250 £/an |
| **Dun & Bradstreet** | Excellente | Family tree + UBO | API/bulk | Licence dédiée requise | Milliers €/an+ |
| **Orbis/BvD, Capital IQ, FactSet** | Excellente | Hiérarchies mondiales | API/bulk | Licence entreprise fermée | Élevé |
| **PermID (LSEG)** | Bonne (cotés) | Subsidiaries↔parent (jeu étendu) | API | Partiel CC-BY ; hiérarchie = CC-NC | Gratuit (open) / payant |
| **Crunchbase** | Startups/tech | Parent/subsidiaries, M&A | API | Non-commercial (jeux récents) | Payant |

### 2. Méthodes de résolution/regroupement praticables en solo

**Principe directeur : le chaînage par identifiants d'abord, la résolution par nom ensuite, la curation manuelle pour la longue traîne à forte valeur.**

- **a) Chaînage par identifiants (le plus fiable).** Puisque les entités Orion sont déjà canoniques avec PIC et SIREN, construisez des ponts d'identifiants : SIREN→LEI (beaucoup de LEI français exposent le SIREN dans leur registration authority), LEI→parent LEI (Niveau 2), LEI→Wikidata (P1278). Chaque pont franchi augmente la confiance. C'est déterministe et auditable.
- **b) Résolution par nom avec règles.** Normalisation (casse, accents, suppression des formes juridiques « SA », « GmbH », « SAS », « Ltd »), puis règles de préfixe de marque (« Safran * » → groupe Safran). Attention aux pièges : « Thales » vs « Thales Alenia Space » (JV à ne pas rattacher à 100 %), homonymies, marques partagées. Toujours exiger une corroboration (pays, co-participation à des projets, identifiant partiel) avant de rattacher automatiquement.
- **c) Approche probabiliste / ML légère.** Splink (Ministry of Justice UK, open source, modèle Fellegi-Sunter, backend DuckDB — « capable of linking a million records on a modern laptop in under two minutes ») est l'outil de référence gratuit ; il fonctionne mieux avec plusieurs attributs (nom + pays + adresse + fragments d'ID) qu'avec un nom seul (« not designed for a single bag-of-words column »). Alternatives : dedupe (active learning), Zingg. À réserver au dédoublonnage/rapprochement, pas à l'invention de liens de groupe.
- **d) Gestion des coentreprises.** Modélisez une relation many-to-many pondérée (entité → {groupe, part}) plutôt qu'un rattachement unique ; marquez les JV explicitement pour éviter de gonfler les totaux consolidés d'un groupe.
- **e) Gestion du temps (M&A, renommages).** Datez chaque rattachement (valid_from/valid_to) ; conservez les prédécesseurs/successeurs (SIRENE liens de succession, ROR successor/predecessor). Une filiale acquise en 2015 ne doit pas rétro-attribuer au groupe actuel les projets antérieurs sans marqueur temporel.
- **f) Canonical layering.** Table `group` (id, nom canonique, pays QG, LEI ultime, source), table `entity_group_map` (entity_id, group_id, méthode, score, source, valid_from/to). Les entités canoniques restent intactes ; la vue consolidée est une agrégation, réversible et corrigeable. Ce design respecte votre garde-fou anti-fusion tout en offrant la vue globale demandée.

### 3. Comment les produits comparables s'y prennent

- **Dimensions (Digital Science)** modélise des « super institutes » : « a formal parent organization that at the top of the grouping / The individual members or sub-organizations act as independent entities / a hierarchy (parent - child - sub-child) ». Il s'appuie sur GRID (ancêtre CC0 de ROR) puis ROR. Leçon : garder les membres comme entités indépendantes reliées au parent — exactement le canonical layering.
- **Crunchbase / PitchBook / CB Insights / Dealroom** reconstruisent les réseaux parent-filiale via l'historique des acquisitions (Crunchbase les définit comme prises de contrôle majoritaires). Leçon : les événements M&A sont une source de liens, mais sous licence propriétaire.
- **KAILA (Zabala), Spinbase, Pivot-RP** (outils de financements R&D) : KAILA laisse l'utilisateur regrouper manuellement via des boutons Merge/Cross — un aveu que l'automatisation complète est difficile et que la curation humaine reste nécessaire. Leçon pour Orion : offrir une curation assistée (suggestions automatiques + validation) plutôt qu'un tout-automatique.
- **Acteurs KYC/compliance (OpenSanctions, etc.)** vivent de la résolution d'entités et publient des outils/schémas (FollowTheMoney) ; OpenSanctions est gratuit en non-commercial mais impose une licence aux entreprises. Leçon : investir dans un modèle de données d'entités propre et des scores de confiance explicites, et prévoir un mécanisme de « challenge » (comme le facility GLEIF) pour corriger les erreurs.

## Recommendations

**Vague 1 — Fondation gratuite CC0 + curation ciblée (effort : ~2-4 semaines).**
1. Ingérer le GLEIF Golden Copy (Niveau 1 + Niveau 2 RR-CDF + Reporting Exceptions), CC0. Construire les ponts SIREN↔LEI et PIC↔LEI par nom+pays+SIREN.
2. Ingérer Wikidata (P749/P355/P1278) via SPARQL pour les groupes notables.
3. Établir la table `group` + `entity_group_map` (canonical layering) avec source et score.
4. **Curer manuellement les 100-200 plus gros groupes** que les clients chercheront (aérospatial/défense : Safran, Thales, Airbus, Leonardo, Dassault, BAE, Rheinmetall ; énergie : TotalEnergies, EDF, Engie, Siemens Energy ; auto : Stellantis, Renault, VW, Bosch ; pharma : Sanofi, Bayer, Roche, Novartis ; industrie : Siemens, ABB). Ces groupes concentrent l'essentiel des recherches et du financement — c'est là que se joue la valeur perçue. **Couverture espérée après Vague 1 : très élevée sur les projets/financements des grands groupes (là où est la valeur), même si en pourcentage d'entités le taux global reste modeste (cohérent avec les ~4 % de liens GLEIF exploitables).**

**Vague 2 — Élargissement automatisé + règles (effort : ~3-5 semaines).**
5. Règles de préfixe de marque + normalisation des formes juridiques, avec corroboration obligatoire (pays, co-participation, ID partiel) et mise en file d'attente de validation humaine pour les scores intermédiaires.
6. Splink pour rapprocher les variantes de noms au sein d'un même groupe candidat.
7. Intégrer SEC EDGAR Exhibit 21 pour les groupes US cotés (extension NIH/NSF/SBIR) et Companies House PSC pour les filiales UK (extension UKRI).
8. Modéliser explicitement les JV (relation pondérée, marqueur JV) et le temps (valid_from/to, successions SIRENE).

**Vague 3 — Qualité, gouvernance, éventuel commercial (effort : continu).**
9. Interface de curation assistée (à la KAILA Merge/Cross) : suggestions automatiques + validation utilisateur, avec « challenge » possible.
10. Boucle de fraîcheur : delta GLEIF quotidien, re-sync Wikidata mensuel.
11. **Seuils de décision** : si un client stratégique exige une couverture exhaustive des filiales mondiales d'un groupe (au-delà des grands noms curés), envisager alors seulement un devis OpenCorporates ou, en dernier recours et si le modèle économique le justifie, une licence D&B/Orbis. Ne franchissez ce cap que si le revenu attendu couvre plusieurs fois le coût de licence.

**Bornes qui changeraient la reco :** si GLEIF Niveau 2 franchissait nettement les ~4 % de liens exploitables, la part d'automatisation augmenterait ; si un client paie pour une couverture mondiale fine, la bascule vers une source commerciale devient justifiée ; si le corpus s'étend massivement hors UE/US, réévaluer les registres nationaux pertinents.

## Caveats
- Le chiffre de ~4 % de liens LEI-à-LEI exploitables est l'issue de la déclaration Niveau 2 au T4 2025 ; il reflète la définition de consolidation comptable, non une absence de groupe. Beaucoup de « vrais » groupes existent sans lien LEI machine — d'où l'importance de la curation et de Wikidata.
- Les données Wikidata et PSC sont déclaratives et de fiabilité inégale : à utiliser comme signaux, pas comme vérité absolue ; toujours conserver la source et un score.
- Les licences évoluent : vérifier les CGU à jour d'OpenCorporates, PermID (CC-NC), Crunchbase avant toute intégration ; ne jamais réintégrer de données D&B/Orbis/Capital IQ dans Orion sans licence écrite.
- SIRENE contient des données personnelles (obligations CNIL) ; respecter le statut de diffusion. Certains mirrors open data de SIRENE (Opendatasoft) ont connu des interruptions de mise à jour — préférer l'API/les dumps officiels INSEE.
- La JV Thales Alenia Space illustre un cas non résoluble par GLEIF seul ; ces cas nécessitent une règle métier explicite (relation pondérée, marqueur JV).
- Les vagues et estimations d'effort sont indicatives pour une fondatrice solo et dépendent de l'infrastructure existante d'Orion.

*Note d'articulation : les « vagues 1/2/3 » de ce rapport correspondent aux vagues A/B/C du [cahier des charges](groupes-couche.md) — la « vague 1 » d'Orion désigne, elle, l'extension des sources de financement.*
