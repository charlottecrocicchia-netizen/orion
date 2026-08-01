# Doctrine de design pour Orion — Étude approfondie et cahier des charges

> **Statut : référence design canonique du projet** (reçue le 2026-08-02, étude de la fondatrice).
> En cas de conflit, ce document prime sur toute directive design antérieure. Chaque écran livré
> doit passer la checklist des 10 pièges « IA » (critère de recette). Application par étapes
> (1 → 5), chaque étape validée par la fondatrice avant la suivante, captures à l'appui.

## TL;DR

* Le problème d'Orion n'est pas fonctionnel, il est typographique, rythmique et éditorial. Les sites que la fondatrice admire (Apple, Stripe, Linear, Vercel) partagent quatre gestes précis et copiables : une échelle typographique à fort contraste (chiffres héros en très grand, poids fin, tracking négatif), un rythme vertical généreux et alterné en « actes », des chiffres traités comme des personnages (tabular figures, count-up déclenché au scroll), et une seule couleur d'accent utilisée avec parcimonie.
* La beauté premium et la densité data ne s'opposent pas : Linear, Attio, Stripe Dashboard et Bloomberg prouvent qu'on peut avoir des listes riches et scannables sans « cartes qui cliquent ». La clé est l'intention (grilles réelles, tabular figures, hiérarchie par la taille/l'espace et non par le poids) — exactement ce qui distingue un design voulu d'un template « IA ».
* La stack React/Vite/TypeScript/Tailwind + SVG maison est le bon choix. Recommandation ferme : police Inter (ou Geist) en substitut de SF Pro/Söhne, Framer Motion (Motion) pour l'UI + GSAP ScrollTrigger pour la mise en scène du hero, animations de courbe SVG par `stroke-dashoffset` et count-up déclenché par IntersectionObserver. La doctrine complète, page par page, est livrable telle quelle à Claude Code.

## Key Findings

1. **Le geste signature commun aux sites premium : le chiffre traité comme un titre.** Stripe compose ses displays en Söhne poids 300 avec tracking négatif (−1,4px à −0,64px selon la taille) ; Linear utilise Inter à 72px poids 510 avec letter-spacing −0,022em ; Vercel pousse le tracking négatif jusqu'à −0,04em sur les titres. Le €211B d'Orion doit être traité exactement ainsi : très grand, poids fin à medium, fortement resserré, avec des tabular figures.
2. **La correction importante du mythe SpaceX/Tesla.** Contrairement à l'intuition, les homepages actuelles de SpaceX et Tesla ne posent PAS un chiffre géant animé par-dessus une vidéo. Leur pattern est « media-first minimalisme » : vidéo plein cadre, header minuscule, 1-2 CTA. Les statistiques vivent sur les pages intérieures ou dans des calculateurs interactifs (calculateur Powerwall chez Tesla). La leçon pour Orion : le « chiffre héros géant » est plutôt un pattern de SaaS data et de microsites de rapport annuel (Spotify Wrapped) — c'est ce registre qu'Orion doit viser, pas le registre automobile.
3. **Apple séquence ses pages en « actes » à pulsation de couleur.** La structure documentée : hero clair → tuile produit sombre → tuile utilitaire claire → tuile sombre → footer parchemin dense. Chaque tuile fait environ un viewport, les sections sont edge-to-edge, et « le changement de couleur agit lui-même comme séparateur » (0px de gap, pas de bordures). Le scroll piné avec séquence d'images canvas est la signature technique.
4. **Éviter le rendu « IA » est une affaire de détails concrets et nommables.** Les tells du template : Inter par défaut non retouché, même border-radius et même padding partout, hover states qui ne font rien, quatre cartes en grille avec gradient violet, illustrations 3D génériques flottantes. Le remède : variation intentionnelle de la hiérarchie, tabular figures, un ton éditorial propre, des micro-interactions qui easent, et des visuels data faits maison.
5. **La densité data se conçoit, elle ne se subit pas.** Le Bloomberg Terminal (325 000 abonnés dans le monde, chiffre 2022) prouve que la densité extrême est un atout quand elle est maîtrisée ; Linear et Attio prouvent qu'une liste peut être riche sans être brute (grille type tableur 1px, pills de statut, labels petits en capitales, tabular figures). Our World in Data et Polaris fournissent les principes de dataviz et de tables.

## Volet 1 — Décoder les sites premium de référence

### Apple.com — le storytelling par le scroll en actes

Apple construit ses pages produit comme un scénario. L'analyse UX classique décrit une structure en « écrans » : le hero introduit le héros (le produit) avec une animation subtile révélant ses contours par une touche de lumière, puis chaque écran suivant dévoile une facette, « exactement comme une affiche de film promet une intrigue captivante ». Sur la page iPhone SE analysée, cinq écrans étaient dédiés à la seule présentation du produit.

**Structure section-par-section (les « actes »).** La pulsation Apple documentée est : hero clair → tuile produit sombre → tuile utilitaire claire → tuile sombre → footer parchemin. Chaque tuile occupe environ un viewport, les sections sont edge-to-edge, et le changement de couleur clair/sombre sert lui-même de séparateur — 0px de gap, pas de bordures. Le padding vertical intérieur des tuiles est d'environ 80px, sur une unité de base de 8px.

**Typographie (SF Pro, valeurs reconstruites par rétro-ingénierie).** Apple applique une règle stricte : SF Pro Display au-dessus de 20px, SF Pro Text en-dessous. L'échelle : hero-display 56px poids 600 line-height 1.07 tracking −0.28px ; display 40px/600 ; body 17px/400 line-height 1.47 (« pas 16px — le pixel supplémentaire donne un rythme de lecture, pas de scan »). L'échelle de poids est 300/400/600/700 — le poids 500 est délibérément absent, et les titres sont en 600, pas 700. Un seul accent : Action Blue #0066cc ; encre near-black #1d1d1f (jamais noir pur) ; canvas parchemin #f5f5f7. Une seule ombre portée dans tout le système, réservée aux rendus produit.

**Technique d'animation signature.** Le scroll piné avec séquence d'images (canvas `requestAnimationFrame`, frames pré-rendues indexées sur la progression du scroll) — le MacBook qui se déplie, l'iPhone qui pivote. Réalisable en GSAP ScrollTrigger avec `pin:true` + `scrub`.

### Stripe.com — la data mise en scène avec retenue

Stripe est « le gold standard du design SaaS enterprise ». Sa signature : le mesh-gradient WebGL (crème, orange sorbet, lavande, indigo, rose rubis, lavé sur le tiers supérieur), « sans cesse copié, jamais égalé ». Typographie Söhne poids 300 avec tracking négatif (displays 32-56px de −1,4px à −0,64px) ; les cellules contenant de l'argent ou des chiffres activent l'OpenType `tnum` (tabular figures) — « le signal financier discret de la marque ». Un seul voltage de marque : indigo #533afd, en pill CTA, jamais deux boutons pleins en compétition dans un même hero. Encre navy #0d253d, jamais noir pur.

**Le globe interactif.** Pour le nouveau stripe.com, l'équipe d'ingénierie (Nick Jones) a construit, verbatim, « a 1:40 million-scale, interactive 3D model of the earth… to convey the interconnected nature of the internet economy and the global scale of our service ». Fait de points, en Three.js/WebGL. Technique de dessin de trait : `stroke-dasharray` et `stroke-dashoffset` mis à la longueur du path, animés vers zéro. Benjamin De Cock (UI Designer chez Stripe) a créé sa propre lib Animate Plus pour ces animations — « I needed something lightweight and performant with built-in spring physics, CSS, and full SVG support. I couldn't find a library fulfilling my requirements so I built my own ».

### Linear.app — la précision dark-mode

Linear est « une masterclass de design produit dark-mode-first » : canvas near-black #08090a « où le contenu émerge de l'obscurité comme des étoiles ». Typographie entièrement Inter Variable avec features OpenType `cv01`/`ss03`, du poids 300 au 590 (le 510 est le poids signature — « entre regular et medium, une emphase qui ne crie pas »). Aux tailles display (72/64/48px), tracking agressif de −1,584px à −1,056px « créant des titres compressés qui semblent ingéniérés plutôt que dessinés ». Achromatique, ponctué d'un seul accent indigo-violet (#5e6ad2 fond, #7170ff interactif) utilisé avec parcimonie. Bordures ultra-fines semi-transparentes (rgba(255,255,255,0.05)) au lieu d'ombres. Échelle d'espacement 8px. Pas de poids 700+ ; pas de gradients décoratifs sur boutons/cartes.

### Vercel / Geist — le monochrome extrême

Vercel : « pur noir #171717, pur blanc, Geist, et presque rien d'autre ». Pas d'accent bleu marketing — « l'encre EST la marque ». Geist Sans + Geist Mono (le mono pour labels techniques et code). Aucun poids 700 dans le système — « l'emphase se communique par la taille et l'espacement, pas le poids ». Tracking négatif extrême sur titres (h1 48px : −2,28px). Radius 6px sur les contrôles, pill 100px sur les CTA marketing. Padding de section 64-96px desktop. La règle d'or citée : « le texte est dense ; l'espace autour est vaste ». Les erreurs qui trahissent une imitation ratée : radius trop grand (12px au lieu de 0-4px), tracking trop lâche, pas assez de blanc (24px au lieu de 96px), bordures trop visibles.

### SpaceX / Tesla — la correction media-first

Point critique confirmé par la recherche : les homepages actuelles de SpaceX et Tesla ne posent pas un chiffre géant animé sur vidéo. SpaceX (page Mission) est éditorial et qualitatif, verbatim : « SpaceX's family of Falcon launch vehicles are the first and only orbital class rockets capable of reflight ». Tesla est du media-first minimalisme — vidéo plein écran en autoplay, header minuscule, deux CTA (Order Now / View Inventory), ce qui « force le focus sur le hero et coupe la paralysie du choix (loi de Hick) ». Les seuls chiffres animés chez Tesla sont dans le calculateur Powerwall/solaire. Leçon pour Orion : le registre « chiffre héros géant » vient du SaaS data et des microsites type Spotify Wrapped, pas de l'automobile. Emprunter à SpaceX/Tesla la retenue et le plein-cadre, mais à Stripe/Spotify la mise en scène du chiffre.

### Principes actionnables du Volet 1

1. **Le chiffre est un titre.** Très grand (72-120px), poids fin à medium, tracking négatif (−0,02 à −0,04em), tabular figures obligatoires.
2. **Un seul accent.** Comme l'outremer d'Orion — en CTA et états actifs uniquement, jamais décoratif (Stripe indigo, Linear violet).
3. **Encre, pas noir pur.** #1d1d1f (Apple) ou #0d253d (Stripe).
4. **Rythme par actes à pulsation.** Sections edge-to-edge d'un viewport, alternance de fond servant de séparateur.
5. **Blanc généreux.** Padding de section 80-120px ; « l'espace communique qu'on n'a rien à cacher ».
6. **Une seule ombre, des bordures fines.** Élévation par hairlines (Linear) plutôt que drop-shadows multiples.

## Volet 2 — La traduction en produit data utilisable

### Concilier beauté et densité

**Bloomberg Terminal** : 325 000 abonnés dans le monde (chiffre 2022), 30 000+ fonctions, densité extrême assumée. Leçon : la densité est un atout de professionnel quand elle est structurée (Launchpad customisable, moniteurs multi-actifs, rafraîchissement temps réel). Le contre-exemple cité par un ancien d'une firme concurrente : « application anti-thèse — design moderne, tonnes de blanc, web app » ; la densité Bloomberg gagne pour les pros. Orion doit trouver le milieu : la respiration d'Apple sur le marketing, la densité maîtrisée de Bloomberg dans l'explorateur.

**Linear / Attio : la liste riche sans être brute.** Attio « CRM moderne » : grille type tableur haute densité, bordures 1px, en-têtes haut contraste, sidebar record en overlay vertical avec édition de champ intégrée, status pills à fond pastel et texte bold, labels métadonnées en petites capitales bold « scannables », Inter pour la légibilité en tables denses (14px/1.5, headings 600 tracking −0.01em). Vues Grid/Kanban/List customisables au pixel. « Sophistication tranquille : typographie de qualité et effets de matière subtils plutôt qu'éléments de marque tapageurs. »

**Stripe Dashboard / Our World in Data : la dataviz éditoriale.** OWID a repensé la lisibilité et la configurabilité de ses graphiques interactifs. Principes de dataviz retenus : privilégier position et longueur (barres > camemberts) car « l'œil humain juge mieux la position et la longueur que les angles ou surfaces » ; décombrer (retirer bordures, gridlines dominantes, décimales inutiles, effets 3D) ; emphase visuelle du message principal ; « en cas de doute, on retire ».

### Patterns par type de page

* **Accueil d'outil : hero + orientation.** Combiner le chiffre héros (à la Stripe/Wrapped) avec des points d'entrée clairs vers l'explorateur.
* **Navigation** : Linear/Vercel — barre horizontale sobre, labels opérationnels, mono pour les labels techniques.
* **Listes de résultats riches** : grille type Attio/Linear — tabular figures, pills de statut, sparklines SVG maison en ligne, labels en capitales, jamais de liste brute ni de « cartes qui cliquent » génériques.
* **Fiches détaillées** : layout Attio — corps principal + sidebar de métadonnées + feed d'activité.
* **Dashboards** : densité Bloomberg maîtrisée — panneaux, moniteurs, hairlines.

### Éviter le rendu « généré par IA » — concrètement

Les tells du template documentés : Inter par défaut non retouché, imagerie stock (groupe diversifié devant un laptop, blobs 3D flottants), padding/radius/hauteurs de carte identiques partout (« quand tout élément reçoit le même radius 16px et padding 24px, la page semble plate »), hover states inertes, boutons qui « snappent » au lieu d'easer, « gradient violet + font Inter + quatre cartes en grille ». « Les défauts sont compétents mais génériques — tout converge vers le même look. »

Ce qui distingue l'intention : choix typographiques (un display resserré à poids voulu, pas Inter 400 brut) ; grilles réelles (Linear n'a pas de grille traditionnelle mais des composants modulaires — la variation crée l'intérêt visuel) ; détails de finition (une seule ombre, hairlines, radius cohérent 4-6px) ; illustrations/visuels custom (SVG data maison, pas de stock) ; ton éditorial propre (Apple : « intelligent, décontracté, humain »). La méthode de travail pro : partir de quelque chose de bon puis se l'approprier ; itérer sur des différences spécifiques (« le heading est trop petit, l'espace label-contenu trop serré, la bordure trop lourde »).

## Volet 3 — Ressources et systèmes

### Design systems publics à étudier

* **Apple HIG** — principes de storytelling produit et échelle typographique.
* **Stripe** (via DESIGN.md publics) — tokens couleur/type, hiérarchie CTA unique.
* **Linear / Orbiter** (non public, mais reconstruit) — bâti sur Radix UI ; kits Figma disponibles.
* **Vercel Geist** — open source, le stack de facto des dev tools.
* **Shopify Polaris** — open source, référence pour les tables de données, formulaires complexes, empty states et error states (« industry-leading content guidelines »), lancé 2017 pour l'admin marchand. Attention : conçu pour l'admin, pas le marketing.

### Polices premium open source (substituts SF Pro / Söhne)

* **Inter** (gratuit, Google Fonts) — conçue par Rasmus Andersson chez Figma (sortie le 22 août 2017), « the most used font on Google Fonts », désormais police système de Figma et défaut de nombreux design systems ; tabular figures par défaut, optical sizing, features `cv01`/`ss03`. Le choix par défaut pour l'UI dense et les tables (x-height haut, distinction 1/l/I).
* **Geist / Geist Mono** (gratuit, open source, Vercel) — moderne, technique, mono assorti pour labels.
* **Hanken Grotesk** (gratuit) — « le meilleur workhorse bouba grotesk gratuit », l'alternative libre à Söhne.
* **IBM Plex Sans** — plus corporate, « pour éviter l'esthétique SaaS générique ».
* **Söhne** (payant, Klim) — l'upgrade défendable si budget. Note légale : SF Pro est interdit d'usage web (EULA Apple restreint aux plateformes Apple).

### Ressources d'animation (stack React)

* **Framer Motion / Motion** (renommé 2025, package `motion`, import `motion/react`) — déclaratif, React-first, idéal pour transitions UI, layout, `AnimatePresence`, gestes. ~30KB.
* **GSAP + ScrollTrigger** — « the best scroll animation tool, bar none » : pin, scrub, snap, parallax. Indispensable pour un hero signature / scroll piné. Core ~25KB + ScrollTrigger ~7KB, tree-shakeable.
* **Verdict** : Motion pour l'app (dashboard, listes, drag), GSAP pour la mise en scène du hero €211B + courbe. Les deux cohabitent sans conflit.
* **Techniques** : dessin de courbe SVG par `stroke-dasharray`/`stroke-dashoffset` → 0 (technique Jake Archibald) ; count-up déclenché par IntersectionObserver (`threshold: 0.1`, unobserve après déclenchement) ; toujours prévoir `@media (prefers-reduced-motion: reduce)`.

### Galeries de référence

* **Craft visuel** : Awwwards, Godly, CSS Design Awards, The FWA.
* **Patterns UI réels** : Mobbin (screens de prod, « le meilleur abonnement pour une SaaS UI »), Refero (web-oriented, dashboards/pricing), SaaSFrame, Land-book, Lapa Ninja.
* **SaaS spécifique** : SaaSUI (par type d'écran).

### Kits UI React + Tailwind

* **shadcn/ui** — base incontournable (Radix, copy-paste, accessible, backé Vercel). Risque : look générique si non customisé.
* **Aceternity UI / Magic UI** — spectacle animé (Framer Motion) pour héros et moments marketing. À utiliser comme base à s'approprier, pas tel quel.
* **Untitled UI React / Tailwind Plus** — kits pros complets.
* **Verdict pour Orion** : shadcn/ui comme fondation + composants data SVG maison + micro-animations Motion. Éviter de livrer un template Aceternity brut (retour « IA »).

## Volet 4 — Doctrine de design Orion (livrable Claude Code)

### Principes transverses (fondations)

**Typographie.** Display : Inter (ou Geist) poids 500-600, fortement resserré (letter-spacing −0.022em à −0.04em selon la taille), features `ss03`/`cv01` activées. Corps : Inter 17px poids 400 line-height ~1.5. Mono (labels techniques, IDs, codes pays) : Geist Mono ou JetBrains Mono. Tabular figures obligatoires partout où il y a un chiffre : `font-variant-numeric: lining-nums tabular-nums`. Échelle : hero-chiffre 96-120px / display 56-72px / h2 32-40px / lead 21-24px / body 17px / caption 13-14px / label 12px capitales. Poids : bannir 700+ ; emphase par taille et espace.

**Palette.** Blanc/parchemin canvas (#ffffff / #f7f8f8), encre near-black (#1d1d1f, jamais noir pur), un seul accent outremer (CTA et états actifs uniquement). Bordures hairline (rgba(0,0,0,0.08-0.1)). Une seule ombre portée réservée aux éléments élevés clés.

**Rythme vertical.** Sections edge-to-edge d'environ un viewport, padding vertical 80-120px, alternance clair/sombre servant de séparateur (pulsation Apple). Espacement base 8px.

**Animations.** Count-up déclenché à l'entrée en viewport (IntersectionObserver, once) ; courbes SVG qui se dessinent au scroll (`stroke-dashoffset`) ; scroll piné GSAP pour le hero ; micro-interactions qui easent (hover states réels, jamais inertes) ; `prefers-reduced-motion` respecté.

**Ton.** Éditorial, précis, humain — « intelligent mais accessible » (Apple). Labels opérationnels, pas génériques.

### Page d'accueil de l'outil

Combiner le hero €211B + courbe (que la fondatrice adore) avec l'orientation, façon Apple :

* **Acte 1 — Hero.** €211B en très grand (Inter 96-120px, poids 500, tracking −0.03em, tabular figures), sous-titre d'une ligne, et la grande courbe des financements 2005-2027 en SVG maison qui se dessine au scroll (`stroke-dashoffset`→0) pendant que le chiffre compte jusqu'à 211 — les deux synchronisés sur la même progression de scroll (GSAP pin + scrub), comme Stripe synchronise ses animations de métriques (Animate Plus / `stroke-dashoffset`). Fond clair, accent outremer sur la courbe.
* **Acte 2 — Orientation.** Trois points d'entrée éditoriaux (pas des « cartes qui cliquent ») vers l'explorateur, le benchmark, les fiches — labels opérationnels, chiffres clés en tabular figures (119 000+ projets, 103 000 organisations), fond alterné sombre.
* **Acte 3 — Preuve.** Une seconde dataviz maison (ex. carte/globe des financements type Stripe globe Three.js si budget, sinon carte SVG choroplèthe) mise en scène plein cadre.
* **Footer** dense et assumé (façon Apple parchemin) exposant toute l'IA.

### Explorateur de données

Densité Bloomberg maîtrisée + clarté Linear/Attio :

* Layout à panneaux : filtres à gauche (chips, façon Polaris), résultats au centre en grille type tableur (bordures 1px, en-têtes haut contraste, tabular figures alignées), aperçu/détail à droite.
* Filtres persistants, états actifs en outremer.
* Courbes temporelles et sparklines en SVG maison inline dans les lignes.
* Empty states et loading states soignés (référence Polaris).

### Listes de résultats

Jamais de liste brute ni de « cartes qui cliquent » :

* Grille type Attio : chaque ligne = nom + métadonnées en capitales + montant (tabular figures, aligné à droite) + sparkline SVG + pill de statut à fond pastel.
* Hover state réel (surbrillance de ligne, révélation d'actions), pas de snap.
* Tri par colonne, densité de ligne réglable (Bloomberg/Polaris).

### Fiches organisation / pays

Layout Attio record :

* En-tête : nom + chiffre héros (financement total, très grand, tabular figures) + courbe temporelle SVG qui se dessine à l'entrée.
* Corps : sections éditoriales edge-to-edge (projets, partenaires, évolution) alternant fond.
* Sidebar de métadonnées + feed d'activité/historique.

### Benchmark d'organisations

* Tableau comparatif haute densité (tabular figures, hairlines) façon Attio/Bloomberg, PAS un camembert (règle OWID : position/longueur > angle/surface).
* Barres horizontales SVG maison pour comparer les montants (encodage par longueur).
* Un seul accent outremer pour l'entité focus, gris pour les comparées.

### Pièges à éviter (les patterns « IA »)

1. Inter 400 brut non retouché en display → utiliser poids 500-600 resserré avec features OpenType.
2. Gradient violet + quatre cartes en grille → bannir.
3. Border-radius et padding identiques partout → variation intentionnelle.
4. Hover states inertes, boutons qui snappent → micro-interactions qui easent.
5. Illustrations 3D stock flottantes → dataviz SVG maison uniquement.
6. Camemberts et donuts → barres et lignes (encodage perceptif).
7. Chiffres en proportional figures → tabular figures partout.
8. Deux boutons pleins en compétition dans un hero → un seul CTA plein (Stripe).
9. Noir pur #000 → encre near-black.
10. Ombres portées multiples → hairlines + une seule ombre clé.

## Recommendations

**Étape 1 — Fondations (semaine 1-2).** Poser les tokens : Inter/Geist + Geist Mono, échelle typographique ci-dessus, palette (blanc/encre/outremer), espacement 8px, tabular figures globales. Installer shadcn/ui + Motion + GSAP. Livrable : un fichier de design tokens et un composant `<StatHero>` (count-up + courbe SVG synchronisés). Seuil de décision : si le €211B ne « claque » pas encore, c'est un problème de taille/tracking/poids, pas de couleur — augmenter la taille et resserrer avant tout.

**Étape 2 — Le hero signature (semaine 2-3).** Construire la page d'accueil en actes Apple avec le hero €211B + courbe en scroll piné GSAP. C'est le morceau de bravoure qui vend le reste. Seuil : tester sur mobile (pause des animations pendant le scroll, façon Stripe globe) ; si <60fps, simplifier vers un reveal IntersectionObserver.

**Étape 3 — L'explorateur et les listes (semaine 3-5).** Grille type Attio/Linear, filtres Polaris, sparklines SVG maison. Seuil : si une liste ressemble à une « liste brute », ajouter tabular figures + pills + sparkline + hover state avant d'ajouter des cartes.

**Étape 4 — Fiches et benchmark (semaine 5-6).** Layout record Attio, barres horizontales pour le benchmark. Seuil : si on hésite entre camembert et barres, toujours barres.

**Étape 5 — Passe de finition anti-« IA » (continue).** Audit contre la checklist des 10 pièges ; itérer sur les détails (bordures, easing, tracking) comme un designer, pas comme un générateur. Comparer aux références sur Mobbin/Godly à chaque page.

**Benchmarks qui changeraient la recommandation** : si le budget le permet, licencier Söhne (upgrade défendable sur Inter) et construire un globe Three.js (à la Stripe) pour la carte. Si les performances mobiles souffrent, dégrader gracieusement le scroll piné vers des reveals simples.

## Caveats

* **Valeurs Apple/Stripe/Linear reconstruites.** Les pixels et tokens précis cités (56px, −0.28px, poids 510, etc.) proviennent de fichiers de rétro-ingénierie publics (VoltAgent, shadcn.io, DesignMD), pas de spec officielles — ce sont des estimations de haute qualité à traiter comme des repères, pas des vérités absolues.
* **Le mythe SpaceX/Tesla corrigé.** Leurs homepages ne posent pas de chiffre géant animé sur vidéo ; emprunter leur retenue media-first, mais le registre « chiffre héros » vient de Stripe/Spotify Wrapped.
* **Le count-up et le motion sont à doser.** Une seule mise en scène forte (le hero) ; ailleurs, la sobriété. Trop d'animation = retour « site généré ».
* **SF Pro interdit sur le web** (EULA Apple) — d'où Inter/Geist.
* **Bloomberg** : 325 000 abonnés (chiffre 2022, source Wikipedia/Bloomberg officiel) ; d'autres sources citent 350 000-375 000 selon l'année et la définition — sans objet pour la doctrine mais à noter sur la méthode.
