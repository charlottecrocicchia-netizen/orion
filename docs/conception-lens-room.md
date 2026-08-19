# La Lens Room — conception et exécution (2026-08-19)

Vision d'origine : `docs/vision-lens-room.md`. Les quatre décisions
fondatrice la précisent et prévalent : page dédiée (la home reste
l'entrée fonctionnelle) ; deux objets seulement, réels, abstraits ;
l'identité composée ORION / SPACE · ORION / AVIATION s'exécute (D5,
conditionnée à A1 — condition remplie) ; pas de grille, et les
lentilles vides ou futures n'existent pas à l'écran.

## Les choix d'exécution, consignés

**Route `/lenses`, focus par URL.** L'état focalisé vit dans
`?focus=<slug>` — chaque état reproductible (loi du produit). Le
paramètre s'appelle `focus`, jamais `sector` : c'est un état de SCÈNE,
pas un périmètre de données — la collision de sens aurait fini par
coûter.

**La salle est sombre dans les deux thèmes.** Un moment immersif est
une salle de projection : elle ne devient pas blanche à midi. Les
tokens du thème sombre d'`index.css` sont posés localement sur la
racine de la page — le système de thème global n'est pas touché, near
-black `#0b0d12` (jamais noir pur, doctrine).

**Hors Layout, header minimal.** La salle porte son propre en-tête —
le logo ORION, qui ramène à l'entrée fonctionnelle. Ni nav, ni footer :
le moment est distinct, l'usage quotidien vit ailleurs.

**Le geste est celui de la carte.** Premier clic : l'objet se met au
point (le focus entre dans l'URL, l'identité compose, l'autre objet
recule). Second clic : on DESCEND — `/explore?sector=<slug>`, la même
cible que le CTA du hero. Une loi existante réappliquée, jamais une
grammaire nouvelle.

**Les deux objets.** SVG maison, trait 1.1, grammaire wireframe :
- **l'orbite** — une ellipse inclinée qui se dessine (dashoffset), un
  corps central discret, un satellite-point en accent qui la parcourt
  (`animateMotion`, 9 s) ;
- **le profil d'aile** — extrados/intrados/corde en trois traits,
  trois lignes de flux qui le contournent (dash défilant).
Jamais de fusée, jamais d'avion. `prefers-reduced-motion` fige tout :
la salle reste belle immobile.

**Les chiffres sont servis, jamais écrits.** `usePublishedLenses()` —
le registre publié. Seuls les objets DESSINÉS existent : une lentille
publiée sans glyphe (la synthétique de la graine) n'apparaît pas ;
les lentilles futures non plus, par construction.

**Deux accès.** La home — un lien texte sobre sous le CTA du hero (un
seul CTA plein par hero, doctrine, piège n° 8). Le chip — une sortie
en bas du menu, un LIEN distinct des entrées radio : il quitte la vue
au lieu de la recadrer.

**i18n FR/EN** (`lensRoom.*`), identité aussi dans le titre du
document (`ORION / SPACE`).

## Couverture

- 3 tests unitaires : les deux objets réels et jamais la synthétique ;
  le focus par URL et la bascule d'identité ; la règle de la carte
  (second clic → explorateur cadré).
- 3 parcours e2e : home → salle → focus → explorateur ; l'état
  focalisé reproductible par URL + zéro barre horizontale ; la sortie
  du chip.
- Recette visuelle interne sur les trois états (sans focus, focus
  space, focus aviation) — l'aile rééquilibrée face à l'orbite après
  le premier regard.

## Ce qui n'existe pas (décisions ④ et vision)

Pas de grille utilitaire « toutes les lentilles » — « une sortie
utilitaire discrète pourra exister plus tard, pas maintenant ». Pas
d'empilement de lentilles (SPACE × QUANTUM) : le geste signature de la
vision attendra d'avoir deux lentilles qui se croisent utilement. Pas
de familles en éventail : deux lentilles réelles, deux objets.
