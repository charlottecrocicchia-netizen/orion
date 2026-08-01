# Orientation & identité — conception d'ensemble

**Statut : proposé** — à itérer avec la fondatrice avant toute implémentation.
S'appuie sur l'[étude UX](etude-orientation-ux.md) (recommandations R1-R7).
Maquettes : [orientation-accueil.html](design/orientation-accueil.html) ·
[orientation-globe.html](design/orientation-globe.html).

## Le principe directeur

> Orion montrait des données ; il doit montrer des chemins.

Chaque écran répond désormais à trois questions dans l'ordre : *que puis-je
faire ici ? par quoi commencer ? et ensuite ?* Le vocabulaire visuel reste la
DA Lumière validée — le chantier porte sur la **structure d'orientation** et
la **signature des composants**, pas sur la marque.

## 1. L'accueil : un hall d'orientation (mission 2)

La maquette remplace l'accueil actuel ainsi :

- **Le hero se compresse** : « €211B · 119 172 projets · 213 pays » devient une
  ligne de contexte sobre ; la constellation reste mais en bandeau signature
  discret. Les chiffres cessent d'être la thèse.
- **La thèse est la question** : *« Que cherchez-vous ? »* — un champ texte
  libre central (R4) avec trois **requêtes-exemples réelles et cliquables**
  (R3) qui enseignent le produit.
- **Quatre portes d'intention** (R1), et c'est la **signature** du nouvel
  accueil : chaque porte est une *miniature vivante de sa destination* — un
  mini-treemap réel pour « Explorer un thème », une mini-constellation de
  partenaires pour « Analyser une organisation », un mini-globe pour
  « Comparer des pays », et la porte « Voir les appels ouverts » présente dès
  maintenant, honnêtement datée (« phase 5 — automne 2026 »), grisée mais
  annoncée. Pas d'icônes génériques : notre propre langage graphique sert
  d'iconographie. C'est l'anti-« rendu IA » par construction.
- **La rangée « En ce moment »** (R2) : trois signaux calculés (thème qui
  accélère, pays qui monte, programme le plus actif), datés, chaque signal
  ouvrant l'Explorateur pré-rempli. C'est l'amorce du flux *constat → action*
  qui débouchera en P5 sur « le solaire monte → voir les appels solaires ».
- Les cartes « By country / By programme » et les chips nues disparaissent
  (absorbées par les portes et les exemples).

**L'entrée texte libre V1** (avant la couche langage naturel de P4) : un
parseur à règles côté client — lexique métrique/dimension/pays/thème + reste
en `q` plein-texte — qui compose un état d'Explorateur. Le composeur-phrase
existant EST le retour lisible du parseur : l'utilisateur voit sa demande
reformulée en segments modifiables. P4 remplacera le parseur, pas l'interface.

## 2. Le globe mondial (mission 3 — décision fondatrice actée)

Le globe quitte la phase 6 et devient l'entrée géographique de l'outil.

- **Technique** : orthographique **SVG maison** (pas three.js) — la maquette
  en montre un rendu réel généré depuis les mêmes géométries Natural Earth que
  la carte plate. Rotation par glisser (reprojection rAF, ~15-20 k points au
  1:110m, fluide en JS moderne), molette/pincement pour l'inclinaison. Un seul
  jeu de données monde en lon/lat embarqué (~90 Ko), partagé globe + carte.
- **Le geste signature** : clic sur un pays ou un continent → **morphing de
  projection** orthographique → équirectangulaire (~700 ms) : le globe
  *devient* la carte plate, centrée sur la cible — puis le zoom existant ouvre
  la fiche pays. Reduced-motion : bascule directe. C'est faisable précisément
  parce que les deux vues partagent les mêmes géométries et notre pipeline de
  projection maison.
- **Couverture honnête** : les pays sans données (US, UK-post-données, Japon…
  avant leurs sources) sont **grisés élégamment**, non cliquables, avec la
  mention « Couverture actuelle : UE + France — États-Unis, Royaume-Uni,
  Japon à venir ». Le globe devient ainsi l'affiche de la feuille de route
  multi-pays du modèle de données (prévu depuis la phase 1).
- La carte plate actuelle reste l'outil d'analyse (choroplèthe, arcs, liste) ;
  le globe est l'entrée et le geste.
- Coût assumé (décision fondatrice) : ~1 semaine — rotation, morphing,
  fallback (le globe est un enhancement : carte plate + liste restent le
  chemin clavier/lecteur d'écran et sans-JS).

## 3. L'Explorateur clarifié (mission 4)

- « Prepared views » → **« Analyses prêtes »** / **« Ready-made analyses »**
  (R6) — dit ce que c'est et pour qui.
- **« Map · V2 » disparaît** : une promesse non cliquable est une frustration.
  La carte a sa page ; l'onglet reviendra quand la vue carte sera réellement
  branchée dans l'Explorateur.
- **Entrée texte libre** au-dessus du composeur (même parseur que l'accueil) :
  « Dites ce qui vous intéresse » → la phrase se remplit — et reste modifiable
  segment par segment.

## 4. Chasse au rendu générique (mission 5)

Inventaire des écrans à repasser au crible (frontend-design +
web-design-guidelines chargés, vérification chrome-devtools écran par écran) :

| Écran | Symptôme | Traitement proposé |
|---|---|---|
| Accueil | cartes By country/programme, chips nues | remplacés par portes-miniatures + exemples (maquette) |
| Recherche | toggle Projects/Organisations brut | segmented control redessiné, compteur intégré |
| Liste pays | « belle matière, présentation brute » | **classement assumé** : rang fort, barres alignées, écarts lisibles (maquette, bas de page globe) |
| Explorateur | onglets + « Prepared views » | renommage, texte libre, onglet mort retiré |
| Hubs | tables correctes mais uniformes | hiérarchie par densité (KPIs → graphe → détail), à traiter écran par écran |

## 5. Ce qui est proposé à la validation

| # | Décision | Défaut proposé |
|---|---|---|
| ① | L'accueil hall d'orientation (maquette) | portes-miniatures + « En ce moment » + texte libre |
| ② | Globe SVG maison avec morphing vers la carte (vs three.js) | SVG maison |
| ③ | Vocabulaire « Analyses prêtes » | oui, et Map·V2 retiré |
| ④ | Parseur texte libre V1 à règles (P4 le remplacera) | oui |
| ⑤ | L'ordre d'implémentation : accueil → Explorateur clarifié → globe → chasse écran par écran | cet ordre |
