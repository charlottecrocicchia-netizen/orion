# Phase 3 — Analytics & géographie

**Statut : proposé** (validation attendue avant exécution).
S'appuie sur la vision §9 du [document d'architecture](architecture-information.md) :
chaque livrable nomme le persona qu'il sert d'abord.

## Objectif

La phase 2 a rendu les données navigables ; la phase 3 les rend **parlantes** :
qui collabore avec qui, qu'est-ce qui monte, comment je me compare — et une
entrée géographique à la hauteur de l'ambition visuelle du produit.

---

## 1. La carte — l'étude demandée, honnêtement

Le besoin : *tourner un globe pour choisir un pays, zoom cinématique, la fiche
pays s'ouvre.*

### Ce que font les références

- **GitHub** (globe de la homepage) : three.js, cinq couches, ~12 000 pastilles
  posées sur les continents via une carte PNG lue en canvas, arcs en Bézier.
  Leur propre article décrit la bataille perf : surveillance du FPS en continu
  avec **quatre paliers de dégradation** (densité de pixels, géométrie,
  raycasts) pour tenir 55 FPS. C'est leur *vitrine marketing*, pas leur outil.
- **Stripe** : même rôle — un globe d'ambiance sur la home. La lib **COBE**
  (5 Ko, zéro dépendance) vient de cet univers : superbe, mais *pas de
  polygones pays cliquables* — des marqueurs et des arcs seulement.
- **globe.gl / react-globe.gl** : le wrapper three.js qui fait exactement notre
  besoin fonctionnel (choroplèthe par polygones GeoJSON, clic pays,
  `pointOfView()` pour le zoom cinématique, arcs pour les flux).

### Les trois options, chiffrées

| | **A · Globe WebGL** (react-globe.gl) | **B · Carte 2D SVG maison** | **C · COBE décoratif** |
|---|---|---|---|
| L'effet demandé | ★★★ rotation, zoom cinématique, arcs | ★★ zoom 2D animé (viewBox), propre mais plat | ★★★ visuel, mais **pas de choix de pays au clic** sans gros custom |
| Poids ajouté (gzip) | **~250 Ko** (three.js + wrapper), chargés *uniquement* sur la route carte | **~60-80 Ko** (TopoJSON Europe embarqué), zéro dépendance | ~10 Ko |
| Effort | **~1 semaine** : style DA (océan lumière, choroplèthe ultramarine — pas le look « démo three.js »), pauses hors viewport, plafond FPS, fallback | **~2-3 jours** : choroplèthe + zoom + clic, même moteur SVG que nos charts | ~1 jour, mais ne remplit pas le besoin |
| Risques | batterie/mobile (mitigeable, cf. GitHub), WebGL absent (fallback obligatoire), vigilance perf *permanente* | aucun notable | le clic pays reste à inventer |
| Accessibilité | le globe est intrinsèquement inaccessible → il ne peut être qu'un *enhancement* ; la liste pays actuelle reste le chemin clavier/lecteur d'écran | bonne (SVG + liste jumelle, même modèle que l'Explorateur) | idem A |
| Analyse (choroplèthe lisible, comparaison) | moyenne — une sphère cache toujours la moitié du monde | **bonne** — c'est l'outil de travail | nulle |

### Ma recommandation (tu décides)

**B en phase 3, A en phase 6.** La carte 2D choroplèthe livre l'usage analytique
des trois personas pour un tiers du coût, dans la DA, accessible — c'est l'outil.
Le globe est un objet de *désir* : sa place naturelle est la **homepage vitrine
de la phase 6** (le rôle exact qu'il joue chez GitHub et Stripe), où il fera
vendre le produit sans contrainte d'analyse. Si tu veux le globe dès la P3
malgré tout, l'option A est réaliste (~1 semaine, lazy-loadé, fallback liste) —
je la ferai bien ; c'est un arbitrage temps-vs-signature, pas une impossibilité.

Dans les deux cas : clic pays → **zoom cinématique → la fiche pays s'ouvre**
(le hub existant, enrichi des flux de collaboration ci-dessous).

---

## 2. Partenariats — les réseaux de collaboration

*Persona : le veilleur techno (qui travaille avec qui), le business developer
(quels consortiums rejoindre).*

- **API** : `/api/organisations/{id}/partners` — co-participants classés par
  projets communs et montants partagés (SQL sur les participations jointes,
  caché par empreinte comme le reste).
- **Hub organisation** : section « Partenaires récurrents » (liste + mini-graphe
  en SVG maison — nœuds/arcs, notre esthétique constellation).
- **Flux pays × pays** : agrégat des collaborations transfrontalières — alimente
  les arcs de la carte (option A ou B : en 2D, des arcs courbes fonctionnent
  très bien).
- **Explorateur** : rien à changer — la dimension organisation existe ; on
  ajoute une story « Les couples qui construisent l'Europe ».

## 3. Tendances — les thèmes enfin normalisés

*Persona : le veilleur techno d'abord.*

- Normalisation **euroSciVoc** (CORDIS) + rattachement des axes ANR : la
  taxonomie thèmes promise en V2 de l'Explorateur (dimension `theme` réelle,
  au-delà du filtre plein-texte).
- Vue tendances : croissance par thème sur 5 ans, thèmes émergents
  (accélération), déclinants — en vues préparées de l'Explorateur, pas une
  page à part.

## 4. Benchmark — se comparer

*Persona : l'analyste académique, le business developer.*

- `/compare?orgs=a~b~c` (2 à 4 organisations) : KPIs côte à côte, séries
  superposées (la palette validée est prête), top thèmes et partenaires de
  chacune. URL partageable, export — les mécaniques de l'Explorateur réutilisées.
- Entrée depuis chaque hub organisation (« Comparer avec… »).

## 5. Dette réglée en tête de phase

1. **Référentiel programmes ANR** (tâche connue) : fusion des doublons de casse
   (Blanc/BLANC, SATT×2) à l'ingestion + migration corrective.
2. **Recherche organisations floue** : ~440 ms sur le stack (cible 300) —
   index trigram dédié sur le nom normalisé court ou candidats bornés plus tôt.
3. **Treemap** : drill-down au clic (racine → sous-programmes), reporté de la V1.

## 6. Jalons proposés

| Jalon | Contenu | Recette |
|---|---|---|
| M1 | dette (référentiel, perf orgs) + thèmes normalisés | tests + bench |
| M2 | partenariats (API, hub, flux pays) | e2e partenaires |
| M3 | la carte (selon ta décision A/B) | vérif visuelle + a11y |
| M4 | benchmark `/compare` | e2e comparaison |
| M5 | tendances + nouvelles stories + polish | parcours démo P3 |

**Parcours de démo P3** (la définition de « fini », dans la lignée de la P2) :
le veilleur de Safran ouvre la carte → France → hub → partenaires du CEA →
tendance « hydrogène » sur 5 ans → benchmark CEA vs Fraunhofer → export.

**Décisions attendues** : ① carte A (globe P3) ou B (2D P3, globe P6) ;
② le périmètre M2-M4 te convient-il ; ③ l'ordre des jalons.
