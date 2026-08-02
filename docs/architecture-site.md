# Refonte de l'architecture du site — la navigation par intentions

- **Statut : proposition du 2026-08-02, à itérer avec la fondatrice avant
  toute implémentation.** Rien de ce document n'est implémenté.
- **Objet** : le chantier « première visite », élargi en refonte de
  l'architecture — quels menus, quelles pages (y compris P5/P6 en
  placeholder), et où l'existant se range.
- **Sources croisées** : l'[architecture de l'information](architecture-information.md)
  (barre §3, sitemap §5, gabarits §6, personas §9), les
  [leçons de la spec externe](lecons-spec-externe.md) (navigation par
  intentions, adoptée), les [parcours personas](conception-parcours-visualisations.md),
  les [Pièges de Vega](pieges-vega.md) (U3 modularité, U8 ton), et les
  observations KAILA de l'[analyse concurrence](analyse-fonctionnelle-concurrence.md)
  (nommer les usages ; du contenu réel dès l'accueil, pas des promesses).

## 1. Le problème de la première visite — trois constats

1. **« Explorer » porte tout, donc ne dit rien.** Le composeur, les pays,
   les programmes, les Angles, la carte : tout vit derrière un seul mot.
   Les Analyses prêtes — notre meilleur argument de découverte — sont un
   rayon en bas de l'Explorateur ; un nouveau venu ne les rencontre que
   s'il descend.
2. **Ce qu'Orion sait faire reste implicite.** L'accueil montre de beaux
   chiffres, mais aucune surface ne dit les quatre verbes du produit. Le
   poste de veille (lot 2) est invisible tant qu'on n'a pas ouvert une
   fiche d'organisation ; le benchmark (/compare) n'a aucune porte dans la
   barre.
3. **Le futur est une porte cachée.** P5 (les appels) et P6 (l'espace de
   travail) n'existent nulle part — ni promesse datée, ni pont depuis
   l'existant. Or l'analyse concurrence a fait du « pas de porte cachée »
   une règle (R1) : dire ce qui arrive, daté, vaut mieux que laisser
   deviner.

Le déclencheur inverse est aussi vrai : le deck des Angles est validé, le
dossier arrive — l'existant mérite un ensemble **qui se visite**.

## 2. Le principe — quatre intentions, une seule maison

La navigation cesse d'énumérer des tables (« Projets, Organisations,
Explorer ») et nomme les intentions de l'utilisateur. Les quatre verbes
viennent de la spec externe (leçon adoptée ①), recoupés par KAILA (nommer
les usages aide les non-spécialistes à se situer) et par nos personas :

| Intention | La question qu'elle sert | Persona premier |
|---|---|---|
| **Découvrir** | « qui fait quoi, où, avec quel argent ? » | l'analyste (CNRS/CEA) — puis tous |
| **Analyser** | « quelles tendances, quels rapports de force ? » | le business developer (Total/Engie) |
| **Construire** | « comment j'emporte et je partage ce que j'ai trouvé ? » | le BD et le veilleur — le livrable |
| **Espace de travail** | « comment je retrouve et je suis ce qui m'intéresse ? » | le veilleur (Safran/Thales) — P6 |

Deux garde-fous conservés du document d'architecture :

- **Deux régimes, un seul produit** (§2.1 et spec externe) : les intentions
  organisent les *portes*, jamais deux interfaces. Le composeur expert et
  les Angles guidés mènent aux mêmes objets.
- **Aucun cul-de-sac** (§2.2) : la refonte ne touche pas aux rebonds
  « Explorer à partir d'ici » — elle ajoute des portes, elle n'en retire
  aucune.

## 3. La barre proposée

```
[Orion]   Découvrir ▾   Analyser ▾   Construire ▾   Espace ▾      ⌕ Rechercher ⌘K   [🌍 Europe + France]   FR  ◐
```

Quatre menus courts (jamais plus de six entrées), la recherche toujours
visible, le sélecteur de périmètre inchangé (§4 du doc d'architecture).
Chaque entrée de menu porte **une ligne de description** — c'est elle qui
apprend le produit — et les entrées futures portent un **badge daté**
discret (mono), jamais un « coming soon » anonyme.

### Découvrir — trouver et lire

| Entrée | Page | Description (dans le menu) | Statut |
|---|---|---|---|
| Projets | `/projects` | 119 000 projets financés, recherche bilingue | existe |
| Organisations | `/organisations` | fiches consolidées, poste de veille inclus | existe |
| Pays & monde | `/explore/countries` | le globe, la carte, 213 pays | existe |
| Programmes | `/explore/programmes` | des programmes-cadres aux appels ANR | existe |
| **Thèmes** | `/explore/themes` | **les 41 disciplines, qui monte, qui descend** | **nouvelle page** |
| Appels | `/calls` | catalogue et correspondance — `P5 · automne 2026` | **placeholder élégant** |

*(« À propos des données » reste au footer et gagne une ligne en bas de ce
menu : la confiance est une porte de découverte.)*

### Analyser — croiser et comprendre

| Entrée | Page | Description | Statut |
|---|---|---|---|
| **Analyses prêtes** | `/analyses` | **une question, plusieurs angles — cliquez, puis modifiez** | **nouvelle page** (promotion des decks) |
| Explorateur | `/explore` | composez : métrique × dimension × comparaison | existe |
| Comparer | `/compare` | jusqu'à quatre organisations côte à côte | existe |
| Tendances par thème | `/explore?by=theme&split=1` | la course des disciplines dans le temps | existe (vue nommée) |

### Construire — assembler et emporter

| Entrée | Page | Description | Statut |
|---|---|---|---|
| Le dossier | `/dossier` | collectionnez des vues, assemblez, emportez | **lot 4** (maquette v2 en validation) |
| Exports | — | CSV avec licences sur chaque vue | existe (rappel, pas une page) |
| Rapports partagés | — | `P6 · 2027` — vues d'équipe, digest | placeholder dans le menu |

### Espace de travail — retrouver et suivre

| Entrée | Page | Description | Statut |
|---|---|---|---|
| Espace de travail | `/workspace` | suivis, recherches sauvegardées, alertes — `P6 · 2027` | **placeholder élégant** |
| Alertes | — | `P5-P6` — un concurrent gagne un projet sur votre thème | ligne du placeholder |

Un menu à une seule vraie page se justifie ici par l'intention : le
veilleur doit voir dès la première visite **où** sa veille vivra — et le
placeholder lui montre, dès aujourd'hui, le pont réel (le poste de veille
des fiches d'organisation, les URL partageables).

## 4. Les pages nouvelles — cinq, dont deux placeholders

### 4.1 `/explore/themes` — l'index des thèmes (la porte manquante)

La dimension thème est notre lecture la plus demandée (veilleur ET
analyste) et n'a **aucune page** : la porte « 41 disciplines » de l'accueil
jette dans l'Explorateur brut. La page V1, gabarit G2 :

- les 41 thèmes euroSciVoc niveau 2, libellés FR/EN **entiers**, chacun
  avec : montant total, part du corpus, sparkline vingt ans, delta
  avant/après (la convention des fenêtres mûres du lot 3) ;
- tri par montant / par progression ; la règle multi-thèmes énoncée ;
- chaque ligne ouvre l'Explorateur pré-composé sur ce thème
  (trajectoire `compare=` la discipline) — **pas** de fiche thème en V1 :
  les hubs thématiques restent en P3+ (`/explore/topics`, sitemap §5),
  cette page est l'index qui manque aujourd'hui.

### 4.2 `/analyses` — la bibliothèque des Analyses prêtes

Les decks (Angles) et les vues simples quittent le bas de l'Explorateur
pour une vraie bibliothèque — la vitrine du régime guidé :

- une page éditoriale (pas une grille de cartes uniformes) : les decks
  d'abord, en rayons avec leur badge « N angles » et une ligne de
  contexte ; les vues simples ensuite, en liste dense ;
- chaque entrée reste ce qu'elle est déjà : une URL de l'Explorateur ;
- l'Explorateur garde un renvoi court (« Analyses prêtes → ») là où
  vivait le rayon — aucune habitude cassée, la porte est double.

### 4.3 `/dossier` — la maison du dossier (lot 4)

La scène D de la maquette v2 (en validation) devient une page à part
entière : le dossier de session s'y assemble et s'y relit. L'architecture
lui donne son adresse et sa place (Construire) ; son contenu est
entièrement défini par la maquette validée — rien à re-spécifier ici.

### 4.4 `/calls` — le placeholder élégant P5

Une vraie page, gabarit éditorial, qui dit **sans vendre du vent** :

- *ce qui arrive* (automne 2026) : catalogue filtrable, correspondance
  **toujours décomposée** (jamais un score unique), test d'éligibilité,
  alertes deadlines — le cahier P5 en trois phrases ;
- *ce qui existe déjà* (le pont passé/futur du §9) : « en attendant, le
  passé dit où l'argent va » → tendances par thème, poste de veille d'une
  organisation, la course des pays ;
- une ligne d'honnêteté : pas de formulaire d'email, pas de fausse
  inscription — la date suffit.

### 4.5 `/workspace` — le placeholder élégant P6

Même grammaire : *ce qui arrive* (2027 : suivis, recherches sauvegardées,
alertes, partage d'équipe) ; *ce qui existe déjà* : *chaque vue est une
URL* — partagez-la ; le dossier s'emporte en session. Le placeholder
montre au veilleur où sa maison se construira, et à l'acheteur P6 ce que
« équipe » voudra dire.

## 5. Où l'existant se range

| Aujourd'hui | Intention | Changement |
|---|---|---|
| Accueil en actes (hero piné, portes, globe acte 3, footer parchemin) | — (le hall) | les trois entrées éditoriales de la tuile encre s'alignent sur les intentions et montrent du **contenu réel** (leçon KAILA) : un signal calculé, un deck, une fiche du jour — jamais des promesses |
| `/projects`, `/projects/:id` | Découvrir | inchangé |
| `/organisations`, fiches + poste de veille (lot 2) | Découvrir | inchangé — la veille reste une **section de fiche** ; son agrégation multi-organisations attend l'Espace (P6) |
| `/explore/countries` (globe + carte morphing) | Découvrir | renommé dans le menu : « Pays & monde » |
| `/explore/programmes`, fiches | Découvrir | inchangé |
| `/explore` (composeur + vues) | Analyser | inchangé ; son rayon « Analyses prêtes » devient un renvoi vers `/analyses` |
| Les Angles (decks, lot 3) | Analyser | promus : la bibliothèque `/analyses` est leur vitrine ; les URLs `?angles=` ne bougent pas |
| `/compare` (benchmark) | Analyser | gagne enfin une porte dans la barre |
| Le dossier (lot 4, en validation) | Construire | reçoit son adresse `/dossier` |
| `/about-data` | Découvrir (bas de menu) + footer | s'enrichit en page de confiance : fraîcheur par source, licences, la méthode de consolidation dite simplement |
| Footer parchemin | — | reste le sitemap complet ; gagne les entrées nouvelles |

**Les URLs ne bougent pas** (règle §7.3 du doc d'architecture — les URLs
sont des contrats). La règle « nav additive, on ne déplace jamais »
(§7.2) vaut en régime de croisière : cette refonte-ci est l'exception
assumée, décidée par la fondatrice, et elle ne déplace que des **libellés
de menus**, jamais des adresses.

## 6. La première visite, rejouée

Le nouveau venu (mettons : une veilleuse de Safran, sans démo préalable) :

1. **L'accueil** lui donne les chiffres vrais et quatre verbes — elle
   comprend en un écran ce qu'Orion couvre et ce qu'on y fait.
2. **Découvrir** : elle cherche « Safran » (la palette suggère dès la
   frappe, lot 1), ouvre la fiche — le poste de veille lui montre les
   thèmes, les signaux, les nouveaux partenaires.
3. **Analyser** : depuis la fiche, « ouvrir dans l'Explorateur » ; ou par
   la bibliothèque, le deck hydrogène — la glisse des angles fait la
   pédagogie des vues.
4. **Construire** : « Ajouter au dossier » sur les vues qui comptent ;
   elle assemble, elle emporte (lot 4).
5. **Espace** : elle voit où ses suivis vivront (P6, daté) — et
   qu'aujourd'hui déjà, chaque vue est une URL qu'elle peut s'envoyer.

Chaque étape existe ou est datée ; aucune porte ne ment.

## 7. Ce qu'on ne fait PAS

- **Pas de mega-menu** à la Funding & Tenders (l'anti-modèle §1) : quatre
  menus courts, une ligne de description par entrée, c'est tout.
- **Pas de page par persona** (« Pour les veilleurs… ») : les personas
  guident la conception, jamais la navigation — un écran sert d'abord un
  profil, la structure les sert tous.
- **Pas de duplication guidé/expert** : `/analyses` et `/explore` mènent
  aux mêmes états, la spec externe l'a rappelé, la doctrine le tient.
- **Pas de home vitrine maintenant** : la vitrine publique reste P6
  (globe WebGL, phase-6-notes) ; l'accueil actuel en actes reste l'accueil
  produit.

## 8. Chantier proposé (après itération et validation)

1. **Lot A — la barre et les menus** : quatre intentions, descriptions,
   badges datés ; le footer parchemin enrichi. (Petit, tout est là.)
2. **Lot B — `/analyses` + `/explore/themes`** : les deux vraies pages
   nouvelles (gabarits existants G2/G5, l'avant/après du lot 3 réutilisé).
3. **Lot C — `/calls` + `/workspace`** : les deux placeholders élégants
   (une page éditoriale chacun, une après-midi).
4. **Lot D — l'accueil aligné** : les portes de la tuile encre passent aux
   intentions avec contenu réel.
5. `/dossier` suit son propre lot (4) déjà en cours.

Chaque lot passe la checklist de recette (10 pièges + « aucun texte
tronqué »).
