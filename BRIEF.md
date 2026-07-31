# ORION ; Prompt fondateur

Tu es Claude Code. Tu vas construire Orion de zéro, en partant d'un dossier vide. Ce document est le cahier des charges fondateur : lis-le en entier avant d'écrire la moindre ligne de code, puis conserve-le à la racine du repo comme référence permanente.

## 1. Contexte et vision

Orion est une plateforme SaaS d'intelligence des financements R&D en Europe, destinée aux entreprises et centres de R&D industriels. Elle répond à deux questions complémentaires :

1. Le passé : qui a été financé, sur quels sujets, avec quels partenaires, pour combien, et quelles tendances s'en dégagent ?
2. Le futur : quels appels à projets (calls) sont ouverts ou à venir, lesquels sont pertinents pour moi, et comment être alerté à temps ?

La fondatrice a déjà construit un prototype interne appelé Vega (anciennement Atlas) dans un cadre professionnel. Orion est un produit entièrement nouveau et indépendant : aucune ligne de code de Vega ne doit être reprise, copiée ou adaptée. Seules les leçons (section 3) et les données publiques sont réutilisées. Orion est développé sur le temps et le matériel personnels de la fondatrice, avec une vocation commerciale : il doit être vendable à plusieurs entreprises clientes.

Ambition finale : un vrai site de production, pas un prototype. Beau, rapide, fiable, sécurisé, multi-comptes, avec mises à jour de données automatisées.

## 2. Positionnement marché

Une analyse de 8 concurrents (Funding Institutional/Elsevier, Pivot-RP/Clarivate, KAILA/Zabala, Spinbase/Spinverse, FundFit/Streamlyne, Espace Subventions Entreprises/BNP-KPMG, GrantForward, Granter.ai) donne le positionnement suivant :

* Les concurrents directs sont KAILA et Spinbase : européens, orientés entreprises, pertinence R&D industrielle élevée.
* Le trou de marché : presque tous les outils cherchent des opportunités à venir ; presque aucun n'offre une intelligence profonde sur les projets déjà financés (veille concurrentielle, cartographie d'acteurs, partenariats, tendances). Orion combine les deux faces.
* Trois différenciateurs : (a) profondeur analytique sur les projets financés ; (b) recherche en langage naturel de bout en bout ; (c) couverture des programmes nationaux français (ANR, ADEME, France 2030) en plus des programmes européens, là où les acteurs européens ne couvrent que l'UE.
* Standards minimum du marché à égaler : système d'alertes, découverte de partenaires, suivi de candidatures, modèle d'abonnement.

Cible : responsables innovation, business developers R&D, cellules Europe/financements publics des entreprises et RTO. Pas les universités américaines.

## 3. Leçons de Vega ; les erreurs à ne jamais reproduire

Ces problèmes ont été vécus sur le prototype. Chacun est une contrainte de conception pour Orion.

1. Monolithe : Vega avait un unique `server.py` de ~26 500 lignes. Orion doit être modulaire dès le premier commit : séparation nette ingestion / API / recherche / analytics / frontend, fichiers courts, responsabilités claires.
2. Base de données non reproductible : la base SQLite de 2,3 Go vivait hors du repo et se transmettait à la main, avec risque de corruption WAL. Pour Orion, la base doit être entièrement reconstructible par scripts depuis les sources publiques : `make ingest` (ou équivalent) part de zéro et reconstruit tout. La base elle-même n'est jamais un artefact précieux.
3. Déploiement pénible : dossier `dist/` commité, bundles statiques de 913 Mo, hébergement jamais réglé. Orion est déployable dès le jour 1 : Dockerfile propre, artefacts de build hors du repo, CI qui build et teste, déploiement documenté et répétable sur un hébergeur choisi tôt (proposer une option simple et peu coûteuse au démarrage, avec un chemin de montée en charge).
4. Aucune authentification : Orion intègre l'auth et la notion de compte/organisation dès la conception du schéma de données, même si l'activation multi-clients arrive en phase tardive.
5. Mises à jour manuelles : l'ingestion et le rafraîchissement des données sont automatisés et planifiés (jobs schedulés), avec logs et métriques de fraîcheur visibles.

## 4. Données

### 4.1 Passé (projets financés)

Sources publiques, environ 106 000 projets et 61 000 organisations attendus au total :

* CORDIS / Horizon Europe / H2020 (datasets publics et API du portail européen)
* ANR (données ouvertes)
* ADEME (données ouvertes / data.gouv.fr)
* LIFE
* Extension possible : France 2030, scanR, autres programmes nationaux européens

Modèle de données cible : projets, organisations, participations (rôle, pays, montant), programmes, appels, thématiques. Normalisation des noms d'organisations (dédoublonnage) traitée comme un vrai sujet, pas un détail.

### 4.2 Futur (appels à projets)

* Portail européen Funding & Tenders (calls ouverts et forthcoming)
* ANR (AAPG et appels spécifiques), ADEME (AAP), France 2030
* Chaque call : dates clés, budget, TRL/périmètre, lien officiel, programme parent

### 4.3 Pipeline

* Scripts d'ingestion idempotents par source, testés, avec validation de schéma
* Reconstruction complète possible en une commande ; mises à jour incrémentales schedulées
* Traçabilité : chaque enregistrement garde sa source et sa date d'import

## 5. Fonctionnalités par module

### M1 ; Recherche

* Recherche full-text rapide sur l'ensemble des projets et organisations (facettes : programme, années, pays, montant, type d'acteur)
* Recherche en langage naturel : l'utilisateur pose une question libre (« qui a gagné le plus de projets hydrogène en France depuis 2021 ? ») ; une couche LLM (API Claude) traduit la question en requête structurée, exécute, puis peut résumer les résultats en langage naturel avec citations des projets sources. La couche LLM ne remplace pas la recherche classique, elle s'y superpose.

### M2 ; Intelligence sur le financé (le différenciateur)

* Fiche organisation : portefeuille de projets, montants, partenaires récurrents, évolution temporelle
* Analyse thématique : tendances de financement par sujet, par programme, par pays
* Cartographie des partenariats : qui collabore avec qui, top players d'un domaine
* Vue géographique Europe
* Benchmark : comparer plusieurs organisations

### M3 ; Opportunités et alertes

* Catalogue des calls ouverts et à venir, filtrable
* Matching : suggestion de calls pertinents à partir du profil ou d'une description de projet (sémantique)
* Alertes email paramétrables (nouveaux calls, deadlines approchantes, nouveaux projets d'un concurrent suivi)
* Découverte de partenaires potentiels à partir des données de projets financés

### M4 ; Comptes et commercialisation

* Auth solide (email + mot de passe, magic link ou OAuth), organisations multi-utilisateurs
* Rôles simples (admin / membre), isolation stricte des données privées de chaque client (listes suivies, alertes, notes)
* Les données publiques sont communes ; seul l'espace de travail est par client
* Prévoir dès le schéma : plans d'abonnement, limites d'usage, page pricing

### M5 ; Administration

* Tableau de bord interne : état des pipelines, fraîcheur des données, volumétrie, erreurs d'ingestion, usage par client

## 6. Exigences techniques

* Stack : tu proposes. Choisis une stack moderne, éprouvée et économe que tu maîtrises parfaitement, en la justifiant brièvement dans un ADR (Architecture Decision Record) avant de commencer. Contraintes de résultat, pas de moyens :
  * Frontend soigné, rapide, responsive ; le design compte autant que la technique (voir §7)
  * Base de données adaptée au volume (~110 k projets, croissance modérée) avec vraie recherche full-text et migrations versionnées
  * API propre et documentée (OpenAPI ou équivalent) ; c'est elle qui permettra plus tard d'offrir des accès API aux clients
  * Tests automatisés sur l'ingestion et les endpoints critiques ; CI dès le début
  * Secrets hors du repo ; configuration par variables d'environnement
  * Coût d'hébergement initial faible (< 30 €/mois), avec chemin de scaling documenté
* Un `README` qui permet à un développeur tiers de lancer le projet en local en moins de 15 minutes
* Documentation vivante : ADR pour chaque décision structurante, CHANGELOG

## 7. Design et expérience

* Orion doit être nettement plus beau que les outils du marché : références visuelles type CB Insights / Linear / produits data premium ; sobre, dense en information mais lisible, mode sombre bienvenu
* Identité propre (nom : Orion ; logo et palette à proposer)
* Vitesse perçue : squelettes de chargement, pagination/virtualisation, pas d'écran figé
* Interface en anglais par défaut (marché européen), français en option

## 8. Plan par phases

Travaille par phases livrables ; chaque phase se termine par une démo fonctionnelle, des tests qui passent et un déploiement à jour.

* Phase 0 ; Fondations : repo, stack choisie et justifiée (ADR), squelette modulaire, CI, déploiement hello-world en ligne
* Phase 1 ; Données passées : pipeline d'ingestion CORDIS/H2020/Horizon Europe puis ANR/ADEME/LIFE, modèle de données, reconstruction en une commande
* Phase 2 ; Recherche et navigation : full-text + facettes, fiches projet et organisation, premier design abouti
* Phase 3 ; Intelligence : analytics acteurs, partenariats, tendances, géographie, benchmark
* Phase 4 ; Langage naturel : couche LLM de requêtage et de synthèse avec citations
* Phase 5 ; Futur et alertes : ingestion des calls, matching, alertes email
* Phase 6 ; Produit vendable : auth, organisations, espaces de travail, pricing, pages publiques (landing, tarifs), monitoring, sauvegardes
* Phase 7 ; Durcissement production : sécurité, performances, RGPD (données de compte uniquement ; les données métier sont publiques), documentation client

## 9. Règles de travail

1. Ne jamais réutiliser de code du projet Vega/Atlas ; en cas de doute, réécrire
2. Avant chaque phase : proposer un plan court et le faire valider par la fondatrice
3. Commits atomiques et messages clairs ; jamais d'artefact de build ni de secret dans le repo
4. En cas d'arbitrage (coût, complexité, délai) : présenter 2-3 options avec un pour/contre factuel et recommander
5. La fondatrice est ingénieure et à l'aise techniquement, mais veut rester concentrée sur le produit : explique tes choix simplement, sans jargon inutile

## 10. Définition du succès

Orion est réussi quand : une entreprise cliente peut créer un compte, chercher en langage naturel dans plus de 100 000 projets financés européens et français, analyser ses concurrents et partenaires, recevoir des alertes sur les calls pertinents, le tout sur un site en ligne, rapide, beau, dont les données se mettent à jour toutes seules ; et quand la fondatrice peut le démontrer à un prospect sans rien avoir à lancer en local.

---

Première action attendue : lis ce document, pose tes questions de clarification s'il y en a, puis propose ton choix de stack (ADR n°1) et le plan détaillé de la Phase 0.
