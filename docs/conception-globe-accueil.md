# Conception — le globe en acte 3 de l'accueil

> **ÉTAT : LIVRÉ — document historique.** Le globe est l'acte 3 de
> l'accueil en production (`4a859cd`, `89b9405`, `9d7c086`). Le statut
> « proposé, maquettes à valider » ci-dessous est dépassé.
> *(Bandeau posé le 2026-08-29, Hygiène G2.)*

**Statut : proposé** (maquettes à valider avant implémentation).
Demande fondatrice (2026-08-02) : l'acte 3 passe de la carte au globe —
rotation lente pleine largeur, flux au survol, panneau pays au clic avec
« présentation simple et accessible », bouton vers la fiche complète.
Deux versions de panneau à arbitrer : avec photo / sans photo.

## 1. Le geste d'ensemble

1. **Repos** — le globe (notre SVG orthographique maison, zéro dépendance)
   tourne lentement en pleine largeur sous le titre de l'acte. Pays
   couverts en outremer gradué (l'échelle de la choroplèthe), reste du
   monde en gris élégant — la note d'honnêteté de couverture reste.
   La rotation s'arrête au premier survol et sous `prefers-reduced-motion`.
2. **Survol d'un pays** — ses collaborations s'éclairent (représentation
   § 2), un cartouche nomme le pays et son total.
3. **Clic** — le globe **glisse vers la gauche** (60 % → 45 % de la
   largeur, 450 ms, ease doctrine) et le **panneau pays** s'ouvre à
   droite : le pays dit simplement (§ 3), bouton « Ouvrir la fiche
   complète » vers `/explore/countries/XX`. Échap ou clic-dehors referme.
   Au clavier : les pays sont focusables (déjà le cas sur la carte),
   Entrée ouvre le panneau, le focus s'y déplace.
4. **Mobile** — pas de pin ni de split : le globe plein cadre, le panneau
   en feuille plein écran par-dessus (le glissement latéral n'a pas de
   sens à 390 px).

La carte 2D ne disparaît pas : elle reste la vue géographique de travail
(`/explore/countries`, Explorateur). L'accueil prend le globe — le
registre vitrine, la carte garde le registre outil.

## 2. Les flux au survol — alternatives aux arcs

| Option | Principe | Lecture | Coût | Risque |
| --- | --- | --- | --- | --- |
| A. Arcs géodésiques | Courbes 3D pays→partenaires (Stripe) | Bonne | Moyen | Déjà-vu ; double emploi avec la carte 2D qui garde ses arcs ochre |
| **B. Constellation de partenaires** ⭐ | Les partenaires **s'allument comme des étoiles** (rayon ∝ flux), reliés au pays par des lignes fines projetées ; les 5 premiers étiquetés | Très bonne (litéralement notre logo) | Faible (SVG lignes + cercles) | Aucun identifié |
| C. Halo gradué | Partenaires en lueur d'intensité ∝ flux, zéro trait | Moyenne (le lien visuel manque) | Très faible | Illisible sur petits pays |
| D. Particules orbitales | Points animés voyageant sur les routes | Spectaculaire | Élevé (rAF continu) | « Démo tech », contre la retenue doctrine (« le motion se dose ») |

**Recommandation : B — la constellation de partenaires**, avec la lueur
de C en renfort (étoile + halo doux). C'est la métaphore fondatrice
d'Orion appliquée à la géographie : le pays survolé devient le centre
d'une constellation réelle de collaborations. Sobre, léger, distinct de
la carte 2D — et le thème spatial demandé, sans gadget.

## 3. Le panneau pays — « dit simplement »

Contenu identique dans les deux versions (données déjà en API) :

- Drapeau + nom + une phrase d'accroche calculée : « 3ᵉ pays financé
  d'Europe — €32,4 Md sur 55 973 projets. »
- Trois chiffres clés en tabular figures : financement, projets,
  organisations.
- « Ce qu'il finance » : les 3 premiers thèmes en barres horizontales
  (encodage par longueur, règle OWID) avec libellés français simples.
- Ses trois premiers partenaires (drapeaux + parts).
- **Bouton plein « Ouvrir la fiche France »** — le seul CTA plein de
  l'acte (règle du CTA unique).

### V1 — avec photo ([maquette](design/globe-panneau-photo.html))

La photo du pays en fond de panneau, **traitée en duotone
encre/outremer** (voile + blend), texte parchemin par-dessus.

Évaluation honnête de la faisabilité :

- **Licences.** Pour un SaaS commercial il faut des droits pérennes et
  documentés par image. Unsplash/Pexels : usage commercial permis mais
  licences propriétaires révocables, pas d'attribution garantie dans le
  temps — fragile pour un produit payant. La voie sérieuse : Wikimedia
  Commons en **CC0/CC-BY vérifiée image par image** (38 vérifications,
  attribution à afficher pour les CC-BY, vigilance liberté de panorama
  sur les monuments récents). Réaliste mais c'est **1-2 jours de
  curation** + un registre des licences à maintenir au repo.
- **Cohérence DA.** 38 photos = 38 lumières. Sans traitement uniforme,
  le panneau jure avec le produit tout-SVG et flirte avec le piège n°5
  de la doctrine (imagerie stock). Le duotone imposé dans la maquette
  est la condition de survie de cette piste — l'origine photographique
  devient texture, pas sujet.
- **Poids.** 38 × ~200 kB WebP ≈ 7,5 Mo d'assets, chargés
  paresseusement par pays (~200 kB à l'ouverture d'un panneau) :
  acceptable techniquement.

### V2 — sans photo, la matière Lumière ([maquette](design/globe-panneau-lumiere.html))

Le fond du panneau est la **matière du produit lui-même** : la grande
trajectoire de financement du pays (2005 → 2027) dessinée en filigrane
outremer sur parchemin, les étoiles de la constellation aux années
notables. Aucune licence, aucun poids, cohérence DA par construction —
et chaque panneau est **déjà différent** puisque la courbe est celle du
pays.

## 4. Recommandation

**V2.** Elle est plus Orion (la donnée comme matière), plus légère, sans
risque juridique ni dette de curation, et le panneau reste magnifique en
dark. La V1 est faisable si la photo compte pour l'émotion — à la
condition non négociable du duotone + curation Wikimedia documentée ;
dans ce cas, prévoir la curation comme un chantier à part entière.

## 5. Implémentation prévue (après validation)

- `world-globe.tsx` réutilisé en mode hero (plus grand, décor mondial
  conservé, données `countries` + `flows` déjà chargées par l'accueil).
- Constellation de partenaires : projection des centroïdes (déjà dans la
  géométrie du globe), lignes + étoiles SVG, top 5 étiqueté.
- Panneau : Motion (`motion/react`) pour le glissement globe/panneau,
  focus management, Échap, mobile en feuille.
- e2e : survol → constellation visible ; clic FR → panneau, chiffres,
  bouton fiche ; Échap referme ; dataset-agnostique (structure, pas
  valeurs).
