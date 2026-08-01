# Phase 6 — décisions déjà actées (à intégrer au plan quand il sera proposé)

Ce fichier accumule ce qui est décidé pour la phase 6 (comptes, monétisation,
vitrine) longtemps avant son plan, pour que rien ne se perde.

## Le globe interactif — joyau de la homepage vitrine

**Décision de la fondatrice, 1ᵉʳ août 2026** (suite à l'étude du
[plan de phase 3](phase-3-plan.md), §1) : la carte *outil* de la phase 3 est la
choroplèthe 2D ; le **globe WebGL interactif** est réservé à la homepage
vitrine de la phase 6, où il joue le rôle qu'il tient chez GitHub et Stripe —
faire désirer le produit.

Cahier des charges esquissé par l'étude :
- Rotation libre, clic pays → zoom cinématique → entrée dans l'outil
  (fiche pays), arcs de collaborations entre pays (les flux calculés en P3).
- Base technique pressentie : react-globe.gl (three.js) — polygones GeoJSON
  cliquables, `pointOfView()` pour la caméra ; ~250 Ko gzip **lazy-loadés sur
  la vitrine seule**, jamais dans le bundle de l'outil.
- Discipline perf à la GitHub : plafond de FPS, dégradation par paliers,
  pause hors viewport, placeholder SVG au chargement.
- Style Lumière, pas le look « démo three.js » : océan lumineux, continents
  en pastilles, choroplèthe ultramarine, arcs de la palette validée.
- Accessibilité : le globe est un *enhancement* — le chemin clavier/lecteur
  d'écran et le fallback sans WebGL restent la liste et la carte 2D de P3.

## Rappels hérités de la vision (§9 du doc d'architecture)

- Tableau de bord configurable à la connexion (vues de l'Explorateur épinglées).
- Homepage vitrine distincte de l'outil ; l'accueil recherche-first devient
  l'accueil des connectés.
- Prérequis juridique toujours bloquant avant toute mise en ligne publique :
  la revue ODbL (ANR) par un juriste.
