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

---

## La scène optique — exécution (feu vert du 2026-08-20)

Les cinq arbitrages exécutés dans l'ordre ② → ④ → ⑤ → ① → ③.

**② S2 + halo.** La signature cinétique est L'ÉVÉNEMENT d'entrée : le
glyphe du monde joue une fois (~2 s) dans le header au changement de
monde, puis se fige — jamais une boucle. Le halo — deux pixels de
teinte lentille sous ORION / <LENTILLE> — est la seule trace
permanente ; aucune page n'est teintée. Teintes : Espace indigo,
Aéronautique cyan d'horizon, clair/sombre par thème
(`lib/world-tints.ts`). L'alphabet vit dans `components/lens-glyphs.tsx`
— un dessin par monde, partagé par la salle, le header et l'overlay.

**④ Le chip explique.** La ligne d'aide vit sous l'entrée unique, au
registre des aides existantes : un seul périmètre qualifié, la
définition par symétrie, la promesse que la seconde entrée viendra
d'elle-même. Jamais d'entrée fantôme.

**⑤ Un seul langage.** `lib/world-reveal.ts` — l'anneau teinté qui
s'ouvre sur le monde réel (un trou à box-shadow géant, un seul
transform : le chemin 60 fps). 900 ms depuis le verre de la salle,
380 ms au changement de monde (déclenché par le Layout au passage
monde → autre monde). Interruptible au clic ; reduced-motion : rien.

**① La porte.** La racine nue passe par la salle ; la mémoire
(`lib/lens-memory.ts`, locale, effaçable) pré-cadre ou saute — racine
nue SEULEMENT, jamais une URL qui porte son contexte. « Toute la
R&D » est un choix mémorisé de plein droit. Une mémoire devenue
fausse (lentille dépubliée) : le refus M1.2 s'affiche une fois, la
mémoire se purge, la prochaine racine nue repasse par la salle.

**③ La scène.** Trois verres montés — Espace, Aéronautique, et le
corpus entier avec SON objet (la constellation), chiffres servis. Un
clic ENTRE : mémoire écrite, navigation immédiate, révélation
par-dessus la vraie home — jamais une copie. Le `?focus=` du premier
jet disparaît : l'arbitrage a tranché, un clic = entrer.

### Trois décisions de stabilité, prises en exécution

1. **La parallaxe ne touche jamais une cible cliquable** — le champ
   respire, les verres non : une cible qui fuit sous le curseur est un
   geste raté (et Playwright le confirme : il refuse de cliquer une
   boîte instable).
2. **Les verres ne dérivent pas en boucle** : des instruments
   d'optique montés, pas des bulles. L'entrée en scène se joue une
   fois (fondu + montée, décalée par profondeur), puis l'immobilité.
3. **Le survol éveille** : glyphes animés, halo teinté — le mouvement
   appartient à l'intention de l'utilisateur, pas au décor.

### Révisions de comportement déclarées

- La racine nue redirige (porte) : tous les specs e2e qui visitent `/`
  simulent désormais un visiteur au choix fait (`orion.lens.entry=all`).
- `?focus=` supprimé de la salle, ses tests réécrits (un clic entre).
- Le titre composé voyage déjà (lot navigation) — inchangé ici.

## Recette du 2026-08-20 — corrections

**⓪** Le verre « Tout le corpus » livrait la bonne URL (`/`, mémoire
`all`, le choix explicite battait bien la mémoire) mais le CONTENU
mentait : la home nue vitrinait la lentille de rang 1. Corrigé au bon
niveau : depuis que le corpus est un CHOIX de la salle, **la home nue
raconte le corpus** — grand chiffre des totaux, CTA « Tout le
corpus », porte vers la salle ; la vitrine de lentille n'existe que
sous `?sector=` valide. **⓪bis** « Toute la R&D » → **« Tout le
corpus » / “The whole corpus”** partout (salle, chip, CTA).

**①** La signature d'entrée était invisible : les glyphes, dessinés au
trait de disque (3.2/320), faisaient un quart de pixel à la taille du
header. Prop `stroke` — 13 au header — et la signature joue à
l'arrivée, une fois, ~2 s.

**②** La salle était figée pour trois raisons distinctes : l'orbite
en SMIL ignorait `animation-play-state` (convertie en CSS
`offset-path`, dormante par défaut) ; la dérive avait été supprimée
pour la stabilité du clic (réconciliée : **le bouton est stable, le
VISUEL intérieur dérive** — l'œil voit la respiration, la souris vise
un point fixe) ; et les glyphes étaient montés `awake` (ils dorment,
l'éveil est au survol).

**③** Le header : le mot du monde s'écrit dans SA teinte avec un halo
lumineux (`text-shadow`), le glyphe est agrandi et épaissi — et la
barre soulignée disparaît : l'affordance vient du symbole et de la
couleur.

## Recette du 2026-08-20, second tour — la salle vit, le clic décolle

**③ — l'aveu d'abord.** Le rapport précédent déclarait le vol
« intact » sur la foi du DOM. Le diagnostic sur pièce a montré la
vérité : l'animation JOUAIT (l'anneau et le voile apparaissaient bien
au clic) mais elle était **imperceptible** — un anneau hairline de
1,5 px, et un voile de la même couleur que les deux écrans qu'il
sépare : sombre sur sombre, il ne séparait rien à l'œil. « Intact au
DOM » n'est pas « visible à l'écran ».

Le geste attendu existe désormais (`lib/world-launch.ts`) : au clic,
**l'objet du monde part** — l'avion wireframe en montée diagonale pour
l'aéronautique, la fusée à flamme pointillée droit vers le haut pour le
spatial — ~950 ms, teinté au monde, puis la navigation s'accomplit.
Le corpus n'a pas d'objet volant : la révélation sobre (380 ms). Un
clic pendant le vol saute à la fin ; reduced-motion navigue
immédiatement, sans rien jouer — testé e2e dans les deux états.

**① Le repos est vivant.** L'inversion demandée : le satellite tourne,
les flux défilent, la constellation scintille EN CONTINU ; le survol
ACCENTUE (opacité des motifs, lueur du glyphe, halo du verre) sans
jamais toucher une durée — changer une durée fait sauter l'animation.
Seule exception : reduced-motion, tout statique.

**② C'est la lentille entière qui dérive.** `lens-breathe` faisait
respirer le contenu dans un verre immobile — l'objet paraissait collé.
Remplacé : la CIBLE est un conteneur invisible, fixe, plus grand que
l'amplitude (`.lens-hit`, padding 16 px) ; le VERRE ENTIER — bord,
glyphe, libellé — flotte à l'intérieur (`lens-float`, ±6 px), chaque
verre avec sa phase propre (délais −1,25/−2/−4,5 s). L'objet bouge à
l'œil, la souris vise un point qui ne bouge jamais.

**④ Vérifié à l'écran, pas supposé** : les trois destinations (avion →
`/?sector=aviation`, fusée → `/?sector=space`, sobre → `/` nue), le
hero corpus en comptage, la signature du header, la mémoire (`space`
puis `all` selon le choix), le halo absent du monde nu.
