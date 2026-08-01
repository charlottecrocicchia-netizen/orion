# Étude — comment les meilleurs produits data orientent l'utilisateur

**Statut : livré** (mission 1 du chantier « Orientation & identité », 1ᵉʳ août 2026).
Étude menée sur les pages produit publiques ; captures en annexe de session.
PitchBook refuse l'accès automatisé (403) — couvert de connaissance établie,
signalé comme tel.

## Le constat de départ (celui de la fondatrice)

Orion montre des **données** ; les meilleurs montrent des **chemins**. Un
arrivant voit €211B et une constellation — impressionnant — puis doit deviner
où aller. Les huit références étudiées répondent toutes à trois questions dès
le premier écran : *que puis-je faire ici ? par quoi commencer ? et ensuite ?*

## Ce que chacun montre en premier — et ce qu'on en retient

**Spinbase** (concurrent direct, financements UE) — l'entrée est **une seule
zone de texte libre** : « décrivez votre idée, votre résumé de recherche » ;
l'IA renvoie des résultats classés par % de correspondance vers trois intentions
fixes : trouver un financement, trouver des partenaires, se comparer aux
projets financés. → *L'intention en langage naturel n'attend pas la phase 4 :
même une version simple change l'entrée.*

**KAILA** (Zabala, écosystèmes d'innovation) — recherche unifiée multi-sources
avec filtres par thème/région/bénéficiaire et recommandations ; l'information
est « présentée graphiquement pour faciliter la décision », rapports
exportables. → *Le pivot thème/région/bénéficiaire est exactement notre matrice
Explorateur ; eux la mettent à l'entrée.*

**Dimensions** — pas de barre de recherche en avant : des **parcours nommés
par problème métier** (horizon scanning, trouver des reviewers, risque de
sécurité de la recherche) et par secteur. → *Nommer les portes par le problème
du persona, pas par le type de données.*

**Crunchbase** — des **requêtes-exemples au-dessus de la recherche**
(« Healthcare companies that recently raised », « Chart the funding journey of
xAI ») + un flux « Trending » d'insights datés + le pipeline explicite
Explore → Understand → Act. → *Les requêtes-exemples enseignent le produit
mieux qu'un tutoriel ; le « trending » donne une raison de revenir.*

**Dealroom** — l'accueil est un **tableau de momentum** : secteurs chauds avec
croissance %, startups de la semaine, hubs géographiques chiffrés (« NYC :
25.6K startups, $28B VC »). → *Le constat (« le solaire monte ») est l'accroche ;
chaque ligne de momentum est cliquable vers l'analyse — c'est exactement le flux
tendance → action voulu pour les calls en P5.*

**CB Insights** — la promesse d'action d'abord (« Find the deal that will
transform your company »), trois intentions d'enquête (entreprise, marché,
technologie), un assistant IA intégré à l'analyse (ChatCBI), et un pipeline en
cinq étapes qui finit en watchlist. → *L'insight n'est fini que s'il propose
l'étape suivante.*

**PitchBook** *(non vérifié en direct)* — recherche universelle d'entités,
screeners sauvegardés, alertes : le pattern « je décris une cible une fois, le
produit me prévient ensuite ». → *À garder pour P5-P6 (alertes sur calls).*

**Bloomberg Terminal** — la référence historique : **l'intention se tape**
(`AAPL <GO>`, une fonction par besoin), et **Launchpad** compose l'écran
personnel de l'analyste. Densité maîtrisée, zéro décoration, monochromie
fonctionnelle. → *Notre ⌘K est l'embryon de cette ligne de commande ; le
tableau de bord P6 est notre Launchpad.*

## Les cinq patterns transverses

1. **Des portes nommées par intention** (verbe + objet du persona), trois à
   cinq, jamais plus — pas des types de données.
2. **La recherche enseignée par l'exemple** : des requêtes réelles cliquables
   sous le champ, pas un placeholder muet.
3. **Le momentum comme accueil** : ce qui monte, ce qui vient de se passer —
   daté, chiffré, cliquable vers l'analyse.
4. **Constat → action, toujours** : chaque vue se termine par « et ensuite »
   (comparer, suivre, exporter, demain candidater).
5. **Le texte libre est déjà un standard** chez les concurrents directs
   (Spinbase) — pas un luxe de phase 4.

## Recommandations pour Orion (numérotées pour l'itération)

R1. **L'accueil devient un hall d'orientation** : le hero se compresse (les
chiffres restent mais plus petits, la constellation devient un bandeau), et
quatre **portes d'intention** prennent le centre : *Explorer un thème* ·
*Analyser une organisation* · *Comparer des pays* · *Voir les appels ouverts*
(P5, présente dès maintenant à l'état « bientôt » daté — le vide honnête à la
Dealroom vaut mieux qu'une porte cachée).

R2. **Une rangée « en ce moment »** sous les portes : 3 signaux calculés
(le thème qui accélère, le pays qui monte, le programme le plus actif du
mois) — nos données savent déjà les produire (dimension thème × temps) ;
chaque signal ouvre l'Explorateur pré-rempli. C'est l'amorce du flux
« le solaire monte → les appels solaires » de P5.

R3. **La recherche s'enseigne** : sous le champ, trois requêtes-exemples
réelles et datées (« hydrogène par pays depuis 2020 », « qui coordonne le
quantique ? », « CNRS vs Fraunhofer ») qui ouvrent directement les vues.

R4. **Entrée texte libre V1** (« Dites ce qui vous intéresse ») : un parseur
à règles côté client — vocabulaire métrique/dimension/pays/thème + reste =
`q` plein-texte — qui compose un état d'Explorateur et l'affiche en phrase
(notre composeur EST le retour lisible du parseur). La phase 4 remplacera le
parseur, pas l'interface.

R5. **Le globe en entrée géographique** (décision fondatrice) : mondial,
couverture honnête (pays sans données grisés + mention « couverture
actuelle : UE + France »), rotation, clic → transition cinématique vers la
carte à plat existante.

R6. **Vocabulaire** : « Prepared views » → **« Analyses prêtes »** (FR) /
**« Ready-made analyses »** (EN) — dit ce que c'est et pour qui ; « Stories »
fait média, pas outil. Retirer « Map · V2 » (une promesse non cliquable est
une frustration, pas une roadmap).

R7. **Chasse au rendu générique** : remplacer les trois éléments les plus
« IA » de l'accueil (cartes By country/By programme, chips nues, toggle brut)
par les portes d'intention (R1) ; requalifier la liste pays sous la carte en
« classement » assumé (rangs, barres, medal-style sobre) ; passer chaque écran
au crible frontend-design + web-design-guidelines à l'implémentation.
