# Leçons de l'audit produit externe — le tri

*2026-08-17 — cadre fondateur : inspiration triée, jamais cahier des
charges. L'audit connaît le marché mais ignore notre contrainte machine
(rien de lourd avant le serveur) et notre discipline de lots.*

*Provenance : tri d'abord établi depuis le brief fondatrice du
2026-08-17, puis **complété sur pièce le jour même** — le document est
au dépôt : [audit-produit-externe-2026-08.pdf](audit/audit-produit-externe-2026-08.pdf)
(8 pages, 16 sections). La quatrième correction du §16 est identifiée :
le rafraîchissement manuel — classée DATÉE ci-dessous, sur instruction
fondatrice.*

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
| **§16.4 — le rafraîchissement manuel** | **Pipeline opportunités, post-serveur** | Instruction fondatrice : la distinction de l'audit est la bonne — *historical intelligence* (rafraîchie périodiquement ; le cron hebdo est déjà câblé, derrière un profil) vs *opportunity monitoring* (beaucoup plus frais, indissociable du chargement des appels F&T). Ni lot 0 ni lot 2 |
| **§4 — l'Industrial Graph étendu** (groupe → entité → business unit → site → capability → product → project → contract → mission → customer, relations typées datées) | **Post-serveur, évolution de la couche identité** | L'audit le dit lui-même : « tu as déjà fait la partie difficile » — groupes, JV, statuts temporels et confiances sont les fondations ; les nœuds contract/mission/customer attendent les sources de contrats (TechPort, USAspending) |
| **§6 — le bloc Capabilities** sur les fiches (« qu'est-ce qu'ils savent faire ? » : heritage, projets, contrats, clients, TRL, sites) | **Après la taxonomie §7** | Sans vocabulaire technologique stable, des capabilities libres seraient du texte mou ; esa-match confirme le besoin côté industriels |
| **§7 — la taxonomie spatiale** (ESA/NASA, remplacer progressivement euroSciVoc pour le spatial) | **Chantier U6, déjà consigné** ([lecons-pivot-spatial.md](lecons-pivot-spatial.md)) : taxonomie interne à six familles fonctionnelles, mappée euroSciVoc/divisions NSF d'abord — les classifications publiques ont des licences vérifiables | Post-serveur |
| **§8 — l'objet Mission** (Galileo 2G, Ariane 6 : agences → primes → charges → contrats → opportunités → timeline) | **Post-serveur, après Opportunity/Contract** — l'ordre de l'audit lui-même | Le chemin « appel → mission → prime → supply chain → PME » est la navigation cible ; il exige contrats ET appels chargés |
| **§9 — les dimensions spatiales de l'Explorateur** (Technology, TRL, Opportunity type, Award type, Industrial role, Mission, Space segment, Civil/Défense/Dual, Buyer, Product) | **Datées, données d'abord** — chaque dimension attend sa source (TRL/Technology : TechPort ; Award type/Buyer : USAspending ; Mission : §8). Deux exceptions notées : **Core/Enabling est FAIT** (lots 0-1 — « rend ta lentille explicite ») ; Industrial role existe à demi (coordinateur/participant ; prime/sous-traitant attendent les contrats). Le verdict de l'audit est un garde-fou gravé : « ne le refais pas, spécialise-le » |
| **§15 — l'éligibilité ESA (retour géographique, clauses C1-C4)** | **Phase appels avancée**, après F&T et l'éventuelle autorisation ESA (P2 de l'audit) | « Technically relevant but probably not eligible » est exactement notre culture d'honnêteté appliquée au commercial ; les règles d'industrial policy sont des documents publics à licence vérifiable — l'éligibilité calculée n'exige PAS de scraper esa-star |
| **§10 — les six types de Signals** (NEW OPPORTUNITY, AWARD, MOMENTUM, NEW RELATIONSHIP, DEADLINE CHANGE, COMPETITOR MOVE) | **Cahier de l'évolution du fil**, avec la doctrine de l'audit reprise telle quelle : des signaux « calculés, sourcés et explicables, plutôt que seulement plus nombreux » | P5/P6 selon le type (les trois premiers exigent les appels) |
| **§11 — le Radar** (l'écran du matin : opportunités, watchlists, concurrents, échéances) | **P6, avec les comptes** — la landing actuelle reste la vitrine commerciale, l'audit le dit lui-même (« je garderais ton accueil presque comme landing page ») | |
| **§3 — l'ordre des sources US amendé** : TechPort → USAspending → SBIR/STTR → SAM.gov → DoD/Space Force ; « je ne retirerais pas NIH, je le reléguerais dans Enabling/All R&D » | **Proposition consignée, à trancher fondatrice** au moment du serveur — notre roadmap dit aujourd'hui UKRI→SNSF→NWO→Vinnova→SBIR puis NASA/DoD/DOE ; l'audit propose d'inverser la priorité vers le spatial US | |

## Rejeté — avec motif

| Idée | Motif |
|---|---|
| Scraper esa-star | **Déjà exclu au registre** — décision fondatrice explicite du pivot spatial (« zone grise = exclusion, ESA comprise »), consignée à [lecons-pivot-spatial.md](lecons-pivot-spatial.md). **L'audit converge sur pièce (§2)** avec ses propres sources : « son contenu est destiné à un usage non commercial et interdisent notamment sa redistribution […] sans autorisation écrite préalable de l'ESA » — et propose la même issue que notre registre : autorisation/licence ESA (son P2), ou couche de découverte redirigeant vers la source officielle, après validation juridique |
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

## L'étoile polaire de l'audit — gardée telle quelle

La démonstration cible, en une requête (§ final) : « *We are a French
SME developing optical inter-satellite terminals at TRL 5. Where should
we position ourselves in the next 12 months?* » → opportunités,
éligibilité réelle, financements accessibles, historique, concurrents,
partenaires recommandés, briefing prêt. C'est la boussole du pipeline
P5 → P2 ; chaque lot daté ci-dessus est une marche vers elle. Et son
garde-fou final est le nôtre : « ton problème n'est plus le volume » —
ni 500 000 projets de plus, ni globe plus spectaculaire, ni média
spatial.
