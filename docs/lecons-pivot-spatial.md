# Leçons du rapport externe « Orion Space Intelligence » — note de tri

*2026-08-04 — pivot spatial acté par la fondatrice. Cadre appliqué : le
rapport est un matériau d'inspiration, PAS un cahier des charges ; il
décrit deux ans de produit pour une équipe entière ; il ignore notre
règle de licence ; rien n'y prime sur l'existant. Invariants tenus :
aucune donnée supprimée, le globe reste (écran du paysage industriel),
la doctrine design tient jusqu'à décision contraire, toute source passe
le registre des licences — zone grise = exclusion, ESA comprise.*

Le rapport a une thèse juste et une pente dangereuse. La thèse : dans le
spatial, l'argent public passe majoritairement par des MARCHÉS et
contrats industriels, pas par des subventions de recherche — et la
question du client est « où candidater, comment se positionner, avec
qui » ; c'est exactement la verticale qui donne un acheteur à Orion. La
pente : trente objets nouveaux, quinze sources non vérifiées, une
navigation refaite et une DA neuve — un produit de deux ans pour une
équipe, décrit comme un point de départ. Le tri ci-dessous garde la
thèse et date ou refuse la pente.

---

## ① Ce qu'on adopte — et où ça atterrit

| Idée du rapport | Où elle atterrit chez nous |
|---|---|
| **La verticale spatiale comme LENTILLE sur le corpus** (pas un sous-produit, pas une suppression) | Plan « lentille spatiale V1 » (§ plan, ci-dessous) : le secteur spatial identifiable dans CORDIS/NSF, tag versionné comme la curation, `?sector=space` sur les surfaces existantes |
| **Le registre curé des acteurs spatiaux** (« la base ne doit pas contenir seulement les entreprises trouvées dans les projets ») | Déjà commencé AUJOURD'HUI : fournée 1 chargée + JV spatiales sourcées (ArianeGroup, TAS ×8, Telespazio ×7, ATR, MaiaSpace, Sodern, OHB, Beyond Gravity) ; les listes §5 du rapport (intégrateurs, New Space, opérateurs) deviennent la **fournée 3** — croisées avec le corpus, jamais des coquilles vides |
| **Les JV pondérées et l'opération annoncée jamais fusionnée** | FAIT : `status` (active/announced/historical) au modèle et au fichier de curation ; l'opération Airbus·Leonardo·Thales existe en groupe « annoncé » — listée, JAMAIS consolidée (35/32,5/32,5 au protocole d'octobre 2025, entité envisagée 2027) |
| **Les objets Opportunity / Contract-Award / Mission** — et la distinction budget ≠ plafond ≠ engagé ≠ versé | **Redéfinition du cahier P5** (les « calls » deviennent « opportunités » : subvention, appel d'offres, marché, SBIR ; le contrat attribué devient un objet de première classe à côté du projet). Conception AVANT toute implémentation, sur sources licites seulement |
| **La taxonomie techno (arbre ESA, taxonomie NASA 17 domaines) reliée à une taxonomie Orion** | **Chantier U6** au registre : taxonomie interne à six familles fonctionnelles (accès à l'espace, systèmes, charges utiles, sol, services en orbite, applications), mappée euroSciVoc/divisions NSF d'abord — les classifications elles-mêmes sont des documents publics à licence vérifiable |
| **Les parcours utilisateurs spatiaux** (trouver une opportunité, comprendre un programme, trouver un partenaire, surveiller un concurrent, préparer un comité) | Remplacent les personas génériques dans [parcours-mondial.md](parcours-mondial.md) — ils orientent la recette de la lentille V1 et le cahier P5 ; les cinq exemples du rapport deviennent les scénarios de test utilisateurs |
| **« Le rôle industriel détermine la valeur de la participation »** (prime, équipementier, sous-traitant) | Principe adopté, implémentation datée (voir ②) — nos sources actuelles ne portent que coordinator/participant : on ne fabrique pas des rôles qu'on n'a pas |
| **NSF/NIH relus comme technologies adjacentes ou habilitantes** | Cadrage éditorial de la lentille (le corpus mondial RESTE entier — invariant) : la lentille dit « cœur spatial » et « adjacent », elle ne supprime rien |
| **La reformulation du texte de présentation** (« plateforme d'intelligence des financements publics et des écosystèmes industriels du secteur spatial ») | Base du nouveau texte de marque — à passer par la passe d'écriture habituelle, EN/FR, sans odeur d'IA |
| **« Aucune fusion à faible confiance appliquée automatiquement »** | Déjà notre loi (pont conservateur + curation tout-ou-rien + refus) — le rapport confirme la barrière, Dana-Farber en reste la preuve |

## ② Les bonnes idées prématurées — datées

| Idée | Pourquoi pas maintenant | Quand |
|---|---|---|
| **Le score de pertinence explicable** (Opportunity Fit) | Il n'existe pas d'opportunités dans le corpus — un score sans objet noté est un mensonge d'interface. La décomposition explicable (jamais un chiffre opaque) est déjà notre règle de cahier P5 | Avec P5, quand les premières sources d'opportunités licites sont chargées |
| **Les rôles industriels fins** (17 rôles) | Nos sources disent coordinator/participant ; les rôles fins exigent l'extraction depuis contrats/communiqués — source et méthode à instruire | Vague contrats (post-P5), avec niveau de confiance par rôle |
| **L'assistant IA d'analyse avec citations** | Dépend d'un socle d'objets (opportunités, contrats, missions) qui n'existe pas encore ; un assistant sur le corpus actuel répondrait à côté de la promesse spatiale | Après P5 ; les principes (citations obligatoires, ouvrir les données utilisées) sont retenus dès maintenant |
| **La recommandation de partenaires** | C'est le parcours 3 — il exige compétences + historique contrats + retour géographique, trois choses non chargées | Post-P5 ; le poste de veille consolidé d'aujourd'hui en est l'embryon |
| **Les pages Mission** (Ariane 6, Galileo G2, IRIS²…) | L'objet Mission n'a pas de source licite chargée ; une page mission sans contrats serait une coquille éditoriale | Conception dans le cahier P5 redéfini ; 2-3 « stories » spatiales V1 en préfigurent la lecture (sur nos données réelles) |
| **La home « Radar » opérationnelle** (deadlines, contrats récents, mouvements concurrents) | Un radar sans opportunités ni contrats n'a rien à montrer — le poste de veille actuel couvre déjà les signaux calculables honnêtement | Post-P5, quand les deadlines existent en base |
| **Produits / plateformes / sites industriels (objet F)** | Modèle riche, zéro source chargée ; à instruire avec la vague contrats | Vague 2 spatiale |
| **L'export Word quatre pages** (parcours 5) | Le dossier exportable existe ; le rapport généré est une extension P6 (comptes) plus qu'un chantier spatial | P6 |
| **Le retour géographique ESA comme dimension** | Concept clé, données ESA — bloqué par la licence tant que l'ESA est en zone grise | Si une source licite l'expose un jour |

## ③ Ce qu'on rejette — avec motif

**Les sources à licence non limpide — vérifiées une à une.** Règle du
registre appliquée : licence limpide ou exclusion, zone grise = exclusion.

| Source proposée | Verdict | Motif |
|---|---|---|
| **ESA** (esa-star, ITT, esa-match, TDE/GSTP/ARTES…) | **EXCLUSION** (décision fondatrice explicite : « ESA comprise ») | Pas de licence de réutilisation limpide publiée pour ces données ; conditions « Business with ESA » ≠ licence ouverte. Réexamen seulement si l'ESA publie une licence claire |
| **CNES** (marchés, appels à idées), **France 2030 spatial**, **DGA** | **EXCLUSION** (zone grise) | Aucune licence ouverte publiée sur ces flux ; les marchés défense ajoutent des restrictions propres |
| **TED** (marchés publics UE) | **CANDIDAT à instruire** | Politique de réutilisation TED publiée (réutilisation autorisée avec attribution) — à vérifier AU JOUR du chargement, comme la règle l'exige |
| **Funding & Tenders Portal / Horizon Europe calls** | **CANDIDAT à instruire** | La décision 2011/833/UE et la politique CC BY 4.0 de la Commission couvrent une large part — vérification dataset par dataset au chargement |
| **NASA NSPIRES, TechPort, SBIR/STTR, Acquisition Forecast** | **CANDIDATS à instruire** | Œuvres du gouvernement fédéral US = domaine public par défaut ; vérifier les CGU d'API une à une |
| **SAM.gov** | **CANDIDAT avec réserve** | Opportunités publiques OK (domaine public) ; certaines données d'entités y sont explicitement restreintes — périmètre à découper au chargement |
| **USAspending** | **DÉJÀ AU REGISTRE** (validé, attend le serveur) | Domaine public — inchangé |
| **SpaceWERX / DARPA / DIU / NOAA / NRO** | Candidats vague 2, mêmes règles | Fédéral US, à vérifier flux par flux ; NRO seulement si publication publique explicite |
| **UK Contracts Finder / UKSA** | Candidats vague 2 | OGL attendu — vérification au chargement (UKRI déjà validé au registre) |
| **DLR / ASI / AEE-CDTI / LSA…** | Candidats vague 2+ | Licences nationales à vérifier une à une ; défaut = exclusion |
| **EUSPA / Copernicus / Galileo / IRIS² (pages programmes)** | Matière éditoriale, pas des sources de données | Rien à charger ; peuvent nourrir les stories, citées comme lectures |

**La refonte de navigation immédiate** (Radar / Opportunities / Missions
/ Industrial Landscape / Technologies / Workspace). Rejetée MAINTENANT :
la navigation par intentions vient d'être validée en recette, les
sections proposées pointent vers des objets qui n'existent pas (une
entrée « Opportunities » vide est un mensonge d'interface), et
l'invariant fondatrice dit que rien ne prime sur l'existant. La
proposition est conservée comme cible possible post-P5 — décision à
part, sur maquette.

**Le changement de direction artistique** (bleu nuit, cyan ionique,
ambre, trajectoires orbitales, deux environnements graphiques). Hors
périmètre par invariant : la doctrine actuelle tient jusqu'à décision
contraire de la fondatrice — ce sera une décision séparée, sur maquette,
si elle la demande. Notés au passage : les interdits du rapport (étoiles
animées, cockpit, néon, 3D gratuite) convergent avec notre passe
anti-« IA » ; le jour venu, la maquette partira de là.

**Le globe relégué** (« la grande carte mondiale ne doit plus constituer
la proposition principale »). Rejeté par invariant : le globe RESTE et
devient l'écran du paysage industriel — c'est précisément le rôle que le
rapport assigne à sa vue « Industrial Landscape », notre globe le tient
déjà avec les régions manager et les groupes curés.

**Le lancement simultané aéro + spatial.** Le rapport le déconseille
lui-même ; nous aussi. ATR et CFM restent des faits capitalistiques au
registre (l'un chargé, l'autre absent du corpus), pas une extension
produit.

---

## Le plan « lentille spatiale V1 » — proposition à trancher ensemble

*Le plus petit ensemble qui rend Orion crédiblement « spatial » avec les
données actuelles. Réalisable en semaines. RIEN n'est commencé — on
tranche ensemble avant d'implémenter.*

**Lot 1 — la lentille elle-même (le secteur identifiable)** · ~1 semaine
Un fichier versionné `backend/curation/space-lens.csv` (même grammaire
tout-ou-rien que la curation) qui définit le périmètre spatial du corpus
en trois familles de règles, chacune sourcée : les programmes (FP7-SPACE,
les topics Espace de H2020 et Horizon Europe Cluster 4, les divisions
NSF pertinentes — AST astronomie, géospace), les thèmes euroSciVoc
spatiaux, et une liste FERMÉE de motifs texte validés à la main (pas de
classification magique). Le chargeur pose un tag `space` sur les projets
(cœur | adjacent — la relecture NSF/NIH du rapport) ; `?sector=space`
entre dans l'URL de l'Explorateur et de la recherche, comme `scope=`.
Chiffrage immédiat en sortie : « X projets, Y Md€, Z organisations »
— les compteurs de la preuve de profondeur.

**Lot 2 — le registre spatial visible** · ~3-4 jours
Les groupes curés portent un marqueur « acteur spatial » (dérivé de la
lentille + fournée) ; la fiche groupe affiche la part spatiale du
consolidé (droite dans la grammaire actuelle : une ligne de stats, pas
une refonte) ; fournée 3 de curation sur les listes §5 du rapport
croisées au corpus (OHB déjà fait ; GMV, Sener, Terma, Kongsberg, D-Orbit,
Exotrail, EnduroSat, GomSpace, AAC Clyde, NanoAvionics… à mesurer au
radar d'homonymes avant de proposer).

**Lot 3 — deux ou trois stories spatiales** · ~1 semaine
Dans la bibliothèque d'Analyses existante, composées sur nos données
réelles et dites comme telles (des subventions R&D, pas des contrats) :
« La chaîne industrielle derrière l'accès à l'espace européen »
(ArianeGroup/Avio/TAS et leurs trajectoires), « Europe vs États-Unis :
qui finance les technologies spatiales », « Les services en orbite,
qui s'y prépare » (lentille + mots-clés validés). Chaque story ouvre
l'Explorateur pré-composé — la grammaire actuelle suffit.

**Lot 4 — la home orientée (contenu, pas DA)** · ~2-3 jours
L'accroche devient « Orion Space Intelligence » avec le sous-texte
reformulé du rapport (passé par notre passe d'écriture) ; les exemples
de recherche deviennent spatiaux (« optical communications », « Ariane 6 »,
« qui finance la propulsion électrique ? ») ; une porte « Espace »
visible mène à `/explore?sector=space` ; le globe RESTE, légendé
paysage industriel ; les compteurs de preuve ajoutent « entreprises
spatiales curées » et « relations capitalistiques » (déjà réels : 399
lignes de curation, 15 adhésions annoncées, 36 JV pondérées).

**Ce que la V1 ne fait PAS** : pas d'objet Opportunity/Contract/Mission
(cahier P5 redéfini d'abord), pas de score, pas de rôles industriels,
pas de refonte nav, pas de DA — voir ② et ③.

**Total estimé : 2 à 3 semaines**, recette à chaque lot, dans la
doctrine actuelle. Point d'attention honnête : tant qu'aucune source
d'OPPORTUNITÉS licite n'est chargée, Orion spatial est un produit
d'intelligence RÉTROSPECTIVE (qui a été financé, par qui, avec qui) —
c'est déjà vendable en veille concurrentielle et cartographie
industrielle, pas encore en « où candidater » ; le dire ainsi aux
premiers utilisateurs fait partie de la vérité du site.
