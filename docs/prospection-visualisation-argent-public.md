# Panorama comparatif des interfaces de visualisation de l'argent public — recommandations pour la « chaîne de l'argent » d'Orion

> Rapport de prospection fourni par Charlotte (2026-08-28), versé au
> dossier par décision fondatrice du chantier B2.8. Il arbitre la
> direction « colonnes proportionnelles verticales » (icicle pivoté)
> retenue pour la représentation de la chaîne.

## TL;DR
- **Adoptez l'hypothèse « USAspending × icicle » mais dans une variante « colonnes proportionnelles verticales » (icicle pivoté à barres verticales)** : la recherche académique (Woodburn, Yang & Marriott, IEEE VIS 2019) place l'icicle plot devant le treemap et le sunburst pour la navigation et la compréhension hiérarchique.
- **Bannissez le treemap comme représentation principale** : Nielsen Norman Group (« area is not one of these preattentive attributes… ») et l'étude Woodburn confirment que le treemap est le moins performant pour comparer des valeurs.
- **La référence esthétique décisive est America's Finance Guide du Trésor américain** (pédagogie éditoriale, blanc, petits labels, « chaque chiffre a sa source »).

## Key Findings
1. Le drill-down par colonnes de USAspending Spending Explorer est le modèle d'interaction le plus proche du besoin d'Orion (breadcrumb persistant, descente par niveaux).
2. L'icicle plot est le gagnant académique (Woodburn, Yang & Marriott, arXiv:1908.01277 : « Treemap was the least preferred… The icicle plot and sundown chart had similar performance with slight user preference for the icicle plot. » Q3 : icicle 97,2 % vs treemap 91,4 %).
3. Le poids visuel des montants doit encoder la longueur (préattentive), non l'aire ni une courbe décorative.
4. La réconciliation (Σ parts + non ventilé = total) trouve un précédent naturel dans l'icicle/partition — le « non ventilé » visible comme segment résiduel.
5. Les Sankey (Monarch, ProjectionLab, USAFacts) sont excellents à 2-3 étapes mais s'effondrent sur 6 niveaux et ratio d'échelle extrême — vue « résumé » éditoriale seulement.

## Interfaces analysées (verdicts)
- **USAspending Spending Explorer** — drill-down colonnes/blocs proportionnels, breadcrumb latéral, 5 niveaux : ⭐ meilleur modèle de navigation.
- **America's Finance Guide (Trésor US)** — circle-pack + pédagogie éditoriale, chaque chiffre sourcé (MTS ; FY2024 : 6,746 T$, Social Security 1 460,91 Md$ / 21,7 %, Net Interest 881,65 Md$ / 13,1 %) : ⭐ référence esthétique absolue (sans copier la bulle, non préattentive).
- **EU FTS / Kohesio** — tables + cartes ; vocabulaire de données, faible UX.
- **OpenSpending / WDMMG** — bubble tree radial + treemap ; à éviter (radial, bulles, échelle non constante).
- **budget.gouv.fr** — barres par mission/programme ; pédagogie « pour 100 € » réutilisable pour la réconciliation.
- **OpenCoesione** — fiches + filtres ; peu de drill-down proportionnel.
- **NIH RePORTER** — listes + filtres (IC, activity code) ; pas de hiérarchie visuelle.
- **NSF Award Search** — hiérarchie Directorate→Division→Program non exploitée = opportunité de différenciation.
- **CORDIS** — dashboard + fiches ; ~49 % des projets ne rapportent que la contribution CE ; « no cross-project analytics » — le vide qu'Orion comble.
- **NYT budgets Obama** — treemap zoomable puis bulles D3 : la fluidité des transitions à objets constants est l'enseignement clé.
- **USAFacts / SankeyMATIC** — Sankey revenus→dépenses FY2024 (4,9 T$ → 6,8 T$, déficit 1,8 T$ en segment strié) : vue résumé macro, 2-3 étapes max.
- **Monarch / ProjectionLab** — Sankey cash-flow ; vocabulaire d'interaction moderne (URL sauvegardable, clic→détail, masquer montants).

## Synthèse académique
- **Woodburn, Yang & Marriott, IEEE VIS 2019** (arXiv:1908.01277, DOI 10.1109/VISUAL.2019.8933545) : étude contrôlée (12 participants + pilote 6) ; icicle > treemap en navigation et compréhension hiérarchique ; cadre Overview + Detail, zoom-in-place, breadcrumbs empilés, « label what you can », échelle affichée ; WebGL+D3, 50 000+ nœuds à 50-60 fps.
- **Springer 2021** : Sunburst/Circular Treemap meilleurs pour les très grandes hiérarchies ; Treemap/Icicle pour les petites.
- **Kong, Heer & Agrawala (2010)** : les bar charts battent les treemaps pour comparer des feuilles à faible densité.
- **Bamberg (« Effective Visualization of Hierarchies »)** : icicle plot comme défaut.
- **Nielsen Norman Group (2019)** : « area is not one of these preattentive attributes… not suited for tasks involving precise comparisons » ; « simpler visualizations such as bar charts are preferable ».

## Motifs de design récurrents chez les meilleurs
1. Longueur > aire pour le poids des montants — préattentif.
2. Overview + Detail + breadcrumb persistant.
3. Zoom-in-place plutôt que zoom-and-replace.
4. Transitions animées fluides à objets constants.
5. « Label what you can » + tooltips.
6. Pédagogie éditoriale + source par chiffre.
7. URL = vue partageable/rejouable + option masquer montants.

## Recommandations
- **Direction 1 (RECOMMANDÉE) — « Colonnes proportionnelles »** : un niveau visible à la fois en barres verticales proportionnelles triées décroissant, fil d'Ariane textuel sobre des ancêtres, segment résiduel « non ventilé » fermant la réconciliation, labels techniques tronqués + tooltip, parts en petit label.
- **Direction 2 — « Icicle vertical à 3 strates »** (Overview+Detail) : à tester en A/B si la perte de contexte inter-niveaux génère de la désorientation (>1 aller-retour breadcrumb par tâche).
- **Direction 3 — « Vue résumé Sankey éditoriale »** (complémentaire) : 2-3 étapes max ; à abandonner dès qu'une vue dépasse 3 étapes ou qu'un ratio > 100:1 rend les segments invisibles.
- **Treemap** : réintroduction limitée uniquement au-delà de ~1 000 enfants à comparer par densité (rare dans le corpus).

## Caveats
- Woodburn : 12 participants — robuste mais à ne pas surinterpréter ; préférence icicle « légère ».
- Chiffres FY2024 d'America's Finance Guide injectés en JavaScript, repris du Monthly Treasury Statement final FY2024.
- Data Lab USAspending en redirection vers fiscaldata.treasury.gov depuis fin 2022.
- Sankey fintech : vocabulaire transposable, structure non.
- Aucune interface existante ne combine drill-down 6 niveaux + proportionnalité verticale + réconciliation explicite + DA éditoriale : Orion serait sans équivalent direct — opportunité et risque (pas de patron à copier).
