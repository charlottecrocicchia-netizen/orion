# Plan F1 — Dépendance et exposition : l'implémentation

> **Statut : soumis à arbitrage — aucun code, aucun écran dans cette
> passe.** Le contrat est `docs/conception-f-dependance.md`, **validé le
> 2026-08-29** (F-D1 à F-D9). Ce plan exécute le contrat, rien d'autre :
> toute question méthodologique nouvelle rencontrée en route remonte à
> l'arbitrage, elle ne se tranche pas en implémentant. Séquence imposée
> par l'arbitrage : **F1.0 → F1.1 → F1.2 → F1.3 → F1.4**, dans cet
> ordre strict — F1.0 est le prérequis de l'audit (lot 4) maintenu, et
> la dette Explorateur (F-D7) se résorbe avant toute surface nouvelle.

## Règles de la marche (tous lots)

- **Suite locale complète verte entre chaque lot** (`make test` +
  `./scripts/e2e-local.sh`), exit code lu hors pipe, journal complet —
  jamais de tail tronqué.
- **Chaque mesure naît avec son gold** (F-R3) : le gold s'écrit AVANT le
  code qu'il verrouille, depuis le § 8 du contrat.
- **Rituel snapshot avant tout déploiement** — dump manuel dans
  `~/backups/jalons/` si le lot migre le schéma (aucun lot de F1 ne
  migre : zéro migration prévue au plan ; si cela change, c'est un
  écart à déclarer).
- **Zéro dette nouvelle** : toute route F naît avec son
  `response_model` (le stock G21 ne grossit pas), toute clé i18n naît
  dans les deux langues sous le filet de parité, tout libellé vient
  d'un registre (F-R2).
- **Pas d'UKRI, pas de source nouvelle** pendant F1 — F1.0 rend l'ajout
  possible, il ne l'exécute pas.
- CHANGELOG tenu **au fil des lots** (leçon B3 de l'audit : jamais trois
  semaines de silence).

---

## F1.0 — Le registre `FUNDER_PROFILE` (lot 4 de l'audit : B7 + B8 + B14)

Le moteur de chaîne porte trois financeurs en dur dans dix registres
épars, dont un défaut silencieux `.get(funder.code, "cordis")` et un
`continue` qui rend un financeur chargé invisible. F s'apprête à LIRE
ces registres partout : ils deviennent UN registre d'abord.

**Touché.**
- `backend/src/orion/search/chain.py` : un registre unique
  `FUNDER_PROFILE` par code financeur — famille, mapping
  source→famille et famille→financeur, `PROJECT_MEASURE`,
  `PARTICIPATION_MEASURE`, `ROLLUP_LABEL`, `NAVIGATION_DOWN`, clés et
  libellés des blocs `by_funder`. Les dix lectures éparses
  (`:59-126, 150-199, 266, 588-591, 606, 1123, 1161, 1185, 1236-1246`)
  pointent vers lui. **Le défaut `cordis` disparaît partout** : un
  financeur absent du registre est un refus nommé
  (`funder_not_registered`), jamais un déguisement. Les sources hors
  registre restent ignorées à l'agrégation (le harnais e2e en sème une,
  `chain.py:1213`) — ignorées ET comptées au journal, jamais un bloc
  inventé.
- `backend/src/orion/search/service.py:34` : `CORPUS_SOURCES` dérivé du
  registre (B14 — le cache d'agrégats ne peut plus ignorer une source).
- `backend/src/orion/api/projects.py:12-22` : `ATTRIBUTIONS` devient
  une entrée du registre (licence et mention par financeur — la règle
  n° 1 de data-sources ne peut plus être oubliée par un ajout).
- Frontend (B8, les repli-mensonges deviennent des refus visibles) :
  `lib/format.ts` — `moneySymbol` perd son `?? "€"` (devise inconnue →
  jeton explicite, jamais un symbole faux), `sourceLabel` perd son
  `return "CORDIS"` (source inconnue → libellé brut de la source,
  jamais un badge menteur) ; `pages/money-trail.tsx:86` — le mapping
  devise cesse d'être binaire USD/EUR.

**Non touché.** Aucun schéma, aucune migration, aucune surface, aucun
calcul : pour les trois financeurs existants le comportement est
**strictement identique**. Le § G6 de l'audit (la vue B2 recalcule de
la sémantique) n'est PAS dans ce lot.

**Tests.** Témoins avant/après **identiques à l'octet** sur les nœuds
réels (le précédent M1.4 : la différence est exactement rien) ; les 372
tests backend verts inchangés ; nouveaux tests : financeur non déclaré
→ refus nommé sur chaque chemin qui portait un `KeyError` ou un défaut
(`:266, :606, :1123, :1185`) ; `CORPUS_SOURCES` contient exactement les
sources du registre ; un financeur sans attribution de licence ne peut
pas entrer au registre (le test refuse le registre incomplet).

**Recette visuelle.** Aucune — rien ne change à l'écran ; les témoins
octet-à-octet sont la recette.

**Porte snapshot.** Déploiement avec le train suivant, rituel standard
(pas de migration, pas de dump manuel exigé).

---

## F1.1 — La dette Explorateur : `by=funder` s'aligne sur M1 (F-D7)

La branche est unique et arbitrée : `by=funder` garde ses comptes et
ses montants natifs par financeur, il **perd la somme EUR
inter-natures**.

**Premier geste : l'inventaire.** Avant d'écrire, lister TOUS les
chemins qui consomment le couple (`funding`, `funder`) : la vue
Explorateur, les croisements (`split`, `compare`), les decks de
`stories.ts`, les dossiers durables dont les `params` portent
`by=funder`. Chaque consommateur a un sort écrit avant le premier diff.

**Touché.**
- `backend/src/orion/search/explore.py` : le couple (`funding`,
  `funder`) sert un panorama — par financeur : compte de projets,
  montant natif avec son enveloppe de mesure (clé, nature, devise,
  couverture), plus de `sum(amount_eur)` inter-natures. Les autres
  métriques de `by=funder` (`count`) sont inchangées — compter des
  projets par financeur reste licite.
- Frontend Explorateur : la vue `by=funder` se rend en blocs par
  financeur (la grammaire M1), plus en barres comparées — **des barres
  en deux devises et trois natures côte à côte sont interdites**, il
  n'y a pas de graphique comparatif pour cette dimension.
- e2e : les specs Explorateur touchant `by=funder` mis à jour ; les
  clés i18n nouvelles en parité.

**Compatibilité des liens.** Une URL ou un dossier durable portant
`by=funder` reste VALIDE : la vue change de forme, jamais d'adresse.
Rejeu d'un dossier `by=funder` en recette, explicitement.

**Non touché.** Toutes les autres dimensions de l'Explorateur, le
moteur de chaîne, le Reference Engine (les modes `value=` ne
s'appliquent pas à un panorama multi-devises : `by=funder` sort des
modes réels/PPP avec le refus D13 existant — à vérifier à l'inventaire,
c'est le seul point du lot qui puisse remonter à l'arbitrage).

**Tests.** Gold nouveau : organisation synthétique tri-financeurs
(fixtures façon chain gold) — le panorama sert trois blocs natifs,
aucune somme ; les 169 + specs e2e verts.

**Recette visuelle.** Explorateur `by=funder` sous **Firefox**, clair
et sombre, checklist des 10 pièges ; rejeu d'un dossier sauvegardé.

**Porte snapshot.** Oui — changement visible du produit ; rituel
complet.

---

## F1.2 — Le moteur : M1 à M4 en extensions du moteur (F-R1)

**Touché.**
- Nouveau module `backend/src/orion/search/dependency.py` : il **lit**
  les blocs de `chain` (délégation, jamais une re-somme) et calcule
  M2-M4 au grain participation, dans les enveloppes du registre F1.0 :
  - par financeur : `shares[]` (programme → part sur montants connus,
    montant, couverture), `top3 {share, count_total}`, `hhi {value,
    formula: "10000 × Σ(part²)", scale: "0-10000", source}` — le
    nombre, la formule, l'échelle : aucun qualificatif (F-D3 corrigé) ;
  - les refus servis comme OBJETS : `unknown_majority` (F-D4, calculé
    moteur — jamais côté vue), `transversal_call` hérité de
    `_node_share` ;
  - le nœud porte ses identifiants stables et un drapeau
    `no_stable_identifier` (F-D6) — la surface refusera la persistance
    sur ce drapeau, elle ne le déduira pas.
- `backend/src/orion/api/dependency.py` : routes
  `GET /dependency/organisation/{id}` et `GET /dependency/country/{code}`,
  **typées** (`response_model` — zéro dette G21 nouvelle), refus 404/400
  nommés comme `api/chain.py`.
- `backend/tests/test_dependency_gold.py` : les golds du § 8 du contrat
  transposés en fixtures synthétiques (style chain gold) :
  - F-1 : tri-financeurs → trois blocs natifs, AUCUN ratio
    inter-financeurs nulle part dans la réponse (`assert "share" not in`
    l'étage financeur), part EC refusée `unknown_majority` ;
  - F-2 : parts programmes + top 3 + HHI **vérifié à la main sur la
    fixture** (la formule, pas une approximation) ; l'homonyme non
    consolidé listé, jamais fusionné ;
  - F-4b : majorité inconnue → M2-M4 fermées, le fait brut servi
    (montant connu, comptes) ;
  - F-D6 : entité sans identifiant fort → `no_stable_identifier: true`.
- Budget de latence : les deux routes entrent dans
  `scripts/bench_api.py --budgets` (le garde CI existant), budget posé
  à la mesure sur corpus complet avant gel.

**Non touché.** Aucune surface, aucune clé i18n, l'Explorateur, les
tables (zéro migration — tout se calcule des tables existantes).

**Tests.** Suite complète + les golds ci-dessus ; témoin : les réponses
`chain.*` sont octet-identiques avant/après (dependency ne modifie pas
chain, il le lit).

**Recette visuelle.** Aucune (API seule) ; revue du contrat de réponse
sur pièce (un appel réel sur JHU, CNRS, Harvard — les trois lectures du
§ 8 reproduites).

**Porte snapshot.** Déployable en silence (routes non consommées) ;
rituel standard.

---

## F1.3 — Le moteur : M5 (cohortes) et M6 (exposition pays→programme)

**Touché.**
- `dependency.py` : M5 — M2/M3/M4 paramétrées par une **fenêtre de
  cohortes déclarée** (`from`/`to` sur l'année de début, la convention
  de l'Explorateur, bornes 2000-2035) ; la comparaison est deux
  fenêtres servies côte à côte, chacune avec sa couverture ; refus
  `unknown_majority` par fenêtre ; la règle des fenêtres mûres
  (années ≤ now−2) pour les fenêtres par défaut. Les libellés servis
  disent « cohortes {{from}}–{{to}} » — le mot « flux » n'existe pas
  dans le registre.
- M6 — sur le nœud pays : classement des organisations du pays par
  montant observé sous un programme donné (mesure du financeur du
  programme), chaque ligne avec sa part M2 et sa couverture ;
  pagination comme les niveaux de chaîne.
- Golds : fenêtre à majorité inconnue → refus ; une fenêtre vide n'est
  pas une fenêtre à zéro (I4) ; M6 sur fixture pays → l'ordre est un
  tri déclaré, le compte total accompagne le top.

**Non touché.** Surfaces, i18n, Explorateur, chain.

**Tests / recette / porte.** Comme F1.2 (API seule, budgets de latence
étendus, rituel standard).

---

## F1.4 — Les surfaces : fiche organisation, fiche pays, vue comparative

**Touché.**
- **Fiche organisation** : section « Concentration des financements
  observés » — M1 (blocs par financeur, la grammaire de la chaîne),
  puis par financeur M2/M3/M4, M5 en deux fenêtres. **Décision nommée à
  la recette** : le KPI existant `total_funding_eur` (somme EUR
  inter-natures, dette héritée « hero » de conception-b NO-GO 3) ne
  peut pas cohabiter tel quel avec M1 sur la même page — son sort
  (déclinaison par financeur, ou étiquette I3 exacte) se tranche sur
  maquette avec Charlotte, pas en catimini dans un diff.
- **Fiche pays** : M1 pays + M6 (« quels acteurs de ce pays sont les
  plus exposés au programme X »), M2-M4 par financeur au grain pays.
- **Vue comparative** : M2/M3 côte à côte, même financeur, même
  fenêtre — le sélecteur interdit structurellement la comparaison
  inter-financeurs.
- **Le bloc méthode réutilisable** (l'occasion à saisir de
  l'audit-intelligence) : un composant « d'où vient ce chiffre » —
  source, date des données, formule, périmètre, limites — construit
  ici, réutilisable par les surfaces futures. Les cinq lignes du patron
  E2 (§ 3.3 du contrat) en sont le contenu.
- i18n : les formulations EXACTES du § 3.2 du contrat, EN/FR, parité
  testée ; la phrase de refus F-D6 incluse.
- e2e : au moins quatre specs — le refus `unknown_majority` rendu, le
  refus de persistance F-D6, la parité des formulations par financeur,
  le rejeu d'URL avec fenêtres de cohortes.

**L'exigence de conception centrale — le refus digne (portée dès la
maquette, pas rattrapée en recette).** F-D4 ferme la part UE de la
plupart des grandes universités américaines (Harvard 93 % d'inconnu,
Stanford 92 %, UC 80 %, JHU 63 %). Sur ces fiches, la colonne EC
n'affiche que des faits bruts — et cette lecture doit être **digne et
informative, pas un trou**. Principes gravés pour la maquette :

1. **Le refus est une information de premier rang** — même grammaire
   visuelle que la couverture R5B : un bloc PLEIN (montant connu,
   comptes connus/inconnus, la phrase du § 3.2), jamais un état vide,
   jamais un gris d'erreur, jamais une icône d'avertissement ni un
   rouge — rien n'est cassé, quelque chose est SU.
2. **Dire ce qu'on sait avant ce qu'on refuse** : « 57 participations
   UE observées, 21 avec montant (13,6 M€) » précède « la part n'est
   pas calculable ».
3. **La hiérarchie visuelle ne punit pas le refus** : le bloc EC fermé
   de Harvard pèse à l'écran comme le bloc NIH ouvert — c'est le même
   type d'objet, avec un contenu différent.
4. **La recette dédiée se fait sur les cas réels** : Harvard et Johns
   Hopkins, nommément, sous Firefox, clair et sombre, checklist des 10
   pièges — c'est le point où l'honnêteté du contrat se gagne ou se
   perd à l'écran, il a sa séance de recette à lui.

**Non touché.** Groupes (F-D8 : chantier séparé, hors F1), le moteur
(gelé aux lots F1.2-F1.3), l'Explorateur (gelé à F1.1).

**Tests.** Suite complète + e2e nouveaux ; parité i18n ; palettes
validées au script (`scripts/validate_palette.js`) si une couleur
entre.

**Recette visuelle.** Étapes validées une à une (design-doctrine fait
loi), Firefox, clair/sombre, la séance dédiée « refus digne » sur
Harvard/JHU.

**Porte snapshot.** Oui — rituel complet.

---

## Ce que F1 ne fait pas

Les groupes (F-D8 — chantier séparé, avec sa propre conception de
surface) ; la curation des familles de programmes (F-D5 — lot futur,
jamais un préfixe silencieux en attendant) ; le contrefactuel (F-D9 —
NO-GO, question fermée) ; le rapatriement général de la sémantique de
vue B2 (G6 de l'audit — lot 4 au sens large, seul le périmètre
B7/B8/B14 entre ici) ; toute source nouvelle (UKRI attend que F1.0 ait
vécu ET une décision propre).

## Récapitulatif

| Lot | Livrable | Migration | Recette visuelle | Porte snapshot |
|---|---|---|---|---|
| F1.0 | Registre `FUNDER_PROFILE`, refus nommés, attributions au registre | non | non (témoins octet) | train suivant |
| F1.1 | `by=funder` aligné sur M1, inventaire des consommateurs | non | Explorateur, Firefox | oui |
| F1.2 | `dependency.py` M1-M4 + golds + budgets latence | non | non (API) | silencieuse |
| F1.3 | M5 cohortes, M6 pays→programme + golds | non | non (API) | silencieuse |
| F1.4 | Surfaces + i18n + bloc méthode + « refus digne » | non | dédiée (Harvard/JHU) | oui |
