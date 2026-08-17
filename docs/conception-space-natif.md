# Conception — le chantier « Space natif »

*2026-08-17 — les P0 de l'audit produit externe, triés par la commande
fondatrice : tout est frontend / données existantes, rien de lourd ne se
charge. Conception courte, lots courts, validation avant les surfaces —
comme toujours. Rien de ce qui suit n'est codé, sauf ce que le lot 0
qualifie d'honnêteté pure.*

## 1. Les trois périmètres explicites

Aujourd'hui `?sector=space` prend cœur ET adjacent **sans le dire** —
c'est le reproche juste de l'audit. Proposition :

| Périmètre | Libellé FR | URL | Définition (lentille versionnée) |
|---|---|---|---|
| **Spatial direct** | « Spatial direct » | `sector=space-direct` | `space_tag = 'core'` seul |
| **Spatial + habilitant** | « Spatial + habilitant » | `sector=space` *(inchangé)* | `space_tag IS NOT NULL` — cœur + adjacent |
| **Toute la R&D** | « Toute la R&D » | *(pas de paramètre)* | le corpus entier |

`sector=space` garde son sens actuel **par compatibilité** (liens
partagés, dossiers épinglés, la porte de la home) — il gagne seulement
son NOM honnête à l'écran. Le backend accepte les deux valeurs ; la
recherche projets aussi.

**Le chip persistant.** Partout où une vue est cadrée (`sector` présent
dans l'URL), un chip s'affiche dans la phrase du composeur et sur les
pages de recherche : `◆ Spatial + habilitant ▾ ×`. Le `▾` ouvre les
trois périmètres (bascule d'un clic, l'URL change), le `×` revient à
« Toute la R&D ». Le chip est PAR VUE — le périmètre vit dans l'URL,
jamais dans une session : deux onglets peuvent lire deux périmètres.
Correction rattachée : `patch()` de l'Explorateur ne perdra plus
`sector` (ni `subdivision`, ni `organisation`) à la première
interaction — aujourd'hui, toute retouche du composeur efface le
cadrage en silence.

## 2. Le hero raconte le spatial

La home d'« Orion Space Intelligence » ouvre aujourd'hui sur 734 Md€ de
R&D générale — l'audit a raison : le produit doit se présenter par son
sujet. Proposition :

- **Le grand chiffre devient le spatial** : les financements
  cœur + habilitant (« X Md€ de financements spatiaux publics,
  cartographiés »), la courbe-constellation sur les années SPATIALES.
- **Les trois KPI deviennent spatiaux** : projets tagués, organisations
  actives dans le spatial, groupes spatiaux consolidés. Coût backend :
  deux compteurs de plus dans `/api/stats` (organisations distinctes et
  groupes touchés sur les projets tagués) — une requête, cache existant.
- **Le corpus général en une ligne discrète** sous le hero, à la place
  de l'actuelle bande spatiale (les rôles s'inversent) : « Adossé à un
  corpus de 699 798 projets R&D — 734,5 Md€, 3 bailleurs publics » avec
  sa porte vers « Toute la R&D ».
- La phrase d'assiette du hero reste, corrigée (lot 0).

## 3. Les analyses 100 % spatiales

Trois decks nouveaux, cadrés `sector=space` (ou `space-direct` où dit),
qui prennent la TÊTE de `/analyses` dans une section « Espace » — les
généralistes restent en dessous, jamais supprimées (invariant : rien ne
se retire du corpus, rien ne se cache) :

1. **« Où va l'argent spatial ? »** — la trajectoire cœur+habilitant ;
   par programme (donut, drill) ; par pays sur la carte ; qui est
   financé (courbes, groupes repliés).
2. **« Direct ou habilitant ? »** — le même monde en deux périmètres :
   les courbes `space-direct` vs `space`, par pays, par thème — c'est le
   deck qui APPREND la distinction aux utilisateurs.
3. **« Qui monte dans le spatial ? »** — organisations en rangs (bump)
   sur fenêtres mûres ; avant/après (dumbbell) ; la course des pays.

La porte « Analyser » de la home pointe vers le deck 1 en mode spatial.

## 4. Lot 0 — les corrections d'honnêteté (sans arbitrage)

1. **« sur 4 sources officielles » est faux** (3 bailleurs / 5 flux).
   Correction : retirer le nombre — « sur des sources officielles —
   Europe (programmes-cadres de l'UE), États-Unis (NIH, NSF) » ; aucun
   compte à maintenir, la page À propos fait foi.
2. **Le cadrage spatial invisible** → réglé par le chip du §1 (lot 1) ;
   en attendant, le lot 0 pose le chip MINIMAL non interactif
   (« lentille spatiale ») sur l'Explorateur cadré.
3. **La dimension État/région accessible seulement par URL** → elle
   entre au menu « par » (libellé « État / région ») ; sans filtre pays
   elle classe toutes les mailles du monde confondues — honnête et
   intéressant (la Californie face à l'Île-de-France).
4. **Quatrième correction (identifiée sur pièce, §16) : le
   rafraîchissement manuel.** Classée DATÉE sur instruction fondatrice —
   elle appartient au pipeline opportunités (post-serveur), avec la
   distinction de l'audit : *historical intelligence* (rafraîchie
   périodiquement — le cron hebdo est câblé) vs *opportunity
   monitoring* (beaucoup plus frais). Ni lot 0, ni lot 2 :
   [lecons-audit-produit.md](lecons-audit-produit.md).

## 5. Lots d'exécution

- **Lot 0 — honnêteté** : phrase du hero, chip minimal, dimension au
  menu, `patch()` réparé. Une demi-journée, aucun arbitrage.
- **Lot 1 — les trois périmètres** : `sector=space-direct` au backend,
  le chip complet à trois états, e2e du geste.
- **Lot 2 — le hero spatial** : compteurs `/api/stats`, inversion
  hero/bande, ligne corpus discrète. **Exigence fondatrice ① (validée
  2026-08-17)** : le grand chiffre dit son périmètre dans la phrase
  même — « X Md€ de financements spatiaux publics (direct + habilitant),
  cartographiés ».
- **Lot 3 — les analyses spatiales** : les trois decks + la section
  « Espace » en tête de la bibliothèque + la porte de la home.

## 6. Décisions demandées — VALIDÉES le 2026-08-17

*Les cinq, telles quelles. Deux exigences fondatrice s'ajoutent :
① le grand chiffre du hero spatial dit son périmètre DANS la phrase
même (« direct + habilitant ») — intégrée au cahier du lot 2 ;
② la définition des deux lentilles figure en clair sur la page À
propos — FAITE avec les lots 0-1. Lots 0 et 1 lancés ensemble le jour
même ; recette du chip avant d'ouvrir les lots 2-3. La quatrième
correction (§16 : le rafraîchissement manuel) est identifiée sur pièce
et classée datée — pipeline opportunités, post-serveur.*

## 6 bis. Décisions (référence)

1. `sector=space` conserve « cœur + habilitant » (compatibilité), le
   Direct s'écrit `space-direct` — ok ?
2. Le chip est PAR VUE (URL), jamais un état de session — ok ?
3. Le hero bascule spatial et la bande générale prend la ligne discrète
   (inversion des rôles) — ok ?
4. Les decks spatiaux prennent la TÊTE de /analyses, les généralistes
   restent — ok ? (l'alternative « remplacer » cache de l'existant)
5. Les libellés : « Spatial direct » / « Spatial + habilitant » /
   « Toute la R&D » — à amender si tu veux d'autres mots.
