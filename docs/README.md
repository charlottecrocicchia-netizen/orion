# Documentation Orion

[Retour au dépôt](../README.md)

Trois portes d’entrée pour découvrir le projet :

| Votre objectif | Guide |
|---|---|
| Installer et utiliser une instance locale | [Démarrage, connexion et dépannage](getting-started.md) |
| Comprendre comment Orion fonctionne | [Architecture et carte du code](architecture.md) |
| Signaler un problème ou proposer un changement | [Contribuer](../CONTRIBUTING.md) |

## Produit et évolution

- [Changelog](../CHANGELOG.md) — historique des changements documentés.
- [Feuille de route](roadmap.md) — orientation du projet ; les échéances sont celles des documents, pas des engagements de livraison.
- [Doctrine de design](design-doctrine.md) — principes de présentation et d’interaction.
- [Architecture de l’information](architecture-information.md) — organisation des parcours.

## Données et méthodes

| Sujet | Référence |
|---|---|
| Sources, couverture et attributions | [Registre des sources](data-sources.md) |
| Modèle de données et ingestion | [ADR 0002](adr/0002-modele-donnees-ingestion.md) |
| Identités et groupes d’entreprises | [Couche groupes](groupes-couche.md) |
| Curation versionnée | [Guide de curation](../backend/curation/README.md) |
| Montants et indicateurs de contexte | [Reference Engine](conception-reference-engine.md) |
| Décomposition des financements | [Chaîne de l’argent public](conception-b-chaine-argent-public.md) |
| Obligations annuelles NSF | [Runbook NSF](runbook-nsf-obligations.md) |
| Appels à projets | [Conception des appels](conception-e1-appels.md) |
| Lentilles sectorielles | [Conception multi-lentilles](conception-multi-lentilles.md) |

## Développement et exploitation

- [Choix de stack — ADR 0001](adr/0001-stack-initiale.md).
- [Outils et fonctionnement local](outillage-local.md) — détails destinés à la maintenance.
- [Déploiement et exploitation](../infra/README.md) — configuration, sauvegardes et procédures serveur.
- [Conception du déploiement](conception-deploiement.md) — décisions et contexte.
- [Accès privé](conception-acces-prive.md) et [espaces de travail](conception-workspace.md).

## Lire les documents de conception

Les fichiers `conception-*`, `chantier-*`, `plan-*` et les audits gardent la trace du travail : hypothèses, arbitrages, limites et étapes parfois non implémentées. Lisez leur date et leurs avertissements avant de les utiliser comme description du service actuel.

Le [brief fondateur](../BRIEF.md), les [phases initiales](phases/) et l’[ancien état des lieux du produit](etat-des-lieux-produit.md) sont utiles pour comprendre l’évolution. Ce dernier est explicitement signalé comme périmé. Pour une première installation, utilisez le [guide de démarrage](getting-started.md).
