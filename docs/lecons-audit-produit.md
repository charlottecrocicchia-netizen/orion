# Leçons de l'audit produit externe — le tri

*2026-08-17 — cadre fondateur : inspiration triée, jamais cahier des
charges. L'audit connaît le marché mais ignore notre contrainte machine
(rien de lourd avant le serveur) et notre discipline de lots.*

*⚠️ Provenance : ce tri est établi depuis le brief fondatrice du
2026-08-17 — le PDF source (~/Downloads) n'a pas pu être lu depuis cet
environnement (permission macOS). À compléter sur pièce quand le
document entrera au dépôt (`docs/audit/`) — notamment la quatrième
correction d'honnêteté du chantier Space natif.*

## Adopté — avec destination

| Idée de l'audit | Destination |
|---|---|
| Les trois périmètres explicites (Space Direct / + Enabling / All R&D), chip persistant | **Chantier « Space natif », lot 1** — [conception](conception-space-natif.md) à valider |
| Le hero raconte le spatial, corpus général en ligne discrète | **Chantier « Space natif », lot 2** |
| Analyses prêtes 100 % spatiales | **Chantier « Space natif », lot 3** (en tête de bibliothèque, jamais en remplacement) |
| Les corrections d'honnêteté (« 4 sources », scope invisible, dimension sous-régionale) | **Chantier « Space natif », lot 0** — sans arbitrage |
| **La double mesure JV** : « attribué aux entités légales » à côté de « exposition par participation » | **FAIT le jour même** — fiche groupe (« X attribués aux entités légales · Y d'exposition par participation »), benchmark (attribué au revers du KPI), payloads complets. L'exposition reste LE consolidé ; le fait juridique se dit à côté |
| L'API EU Funding & Tenders comme source d'appels | **Vérifiée au registre ce jour : elle passe** (v. ci-dessous) — première source P5 licite, à instruire post-serveur |

## Daté — retenu, pas maintenant

| Idée | Échéance | Pourquoi pas maintenant |
|---|---|---|
| TechPort (NASA), USAspending, SBIR en sources | **Post-serveur** | La contrainte machine est réelle ; TechPort rejoint la ligne NASA/DoD/DOE déjà consignée au roadmap |
| Comptes, watchlists, « Radar », export Word | **P6 (2027)** | Le dossier localStorage le dit lui-même : « les comptes (P6) le rendront durable » |
| Fit Score, Consortium Builder, « Ask Orion » | **P2 de l'audit — après P5/P6** | Le Fit Score recoupe le matching % déjà au cahier de la phase appels (P5) ; les deux autres attendent des fondations (comptes, calls chargés) |

## Rejeté — avec motif

| Idée | Motif |
|---|---|
| Scraper esa-star | **Déjà exclu au registre** — décision fondatrice explicite du pivot spatial (« zone grise = exclusion, ESA comprise »), consignée à [lecons-pivot-spatial.md](lecons-pivot-spatial.md) : les conditions « Business with ESA » ne sont pas une licence de réutilisation. Confirmé ce jour, rien ne change |
| Abandonner le fil d'actualités officiel | **On garde les news Commission** : le fil mêle déjà histoires calculées et actualités officielles, et c'est une force (la source parle). Le concept « Signals » de l'audit est noté comme ÉVOLUTION du fil — plus d'histoires calculées, mieux seuillées — pas comme remplacement |

## La vérification de licence — API EU Funding & Tenders

Affirmation de l'audit : « CC-BY 4.0 par défaut ». **Vérifié à la source
ce jour** : la mention légale de la Commission européenne pose que tout
contenu détenu par l'UE est réutilisable sous **CC BY 4.0** (décision
2011/833/UE), **réutilisation commerciale explicitement autorisée** avec
attribution et indication des modifications ; exceptions classiques
(contenus de tiers, personnes identifiables, marques). Le portail
Funding & Tenders est un site de la Commission ; ses données d'appels
(rédigées par la Commission) relèvent de ce défaut.

**Verdict : PASSE notre filtre** — même base juridique que la
nomenclature NUTS. Réserve de procédure, consignée : la page de
mentions légales PROPRE au portail est une application monopage
illisible en fetch — la revérification du jour de chargement (règle
sans exception) devra la lire en navigateur et confirmer qu'aucune
condition particulière ne s'y ajoute. C'est **la première source licite
de la phase 5 (appels)** : à instruire post-serveur, avant l'automne
2026.
