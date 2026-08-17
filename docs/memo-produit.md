# Mémo de référence produit — Orion

*2026-08-17 · document de fond, exhaustif et factuel. Il décrit ce qu'un
utilisateur peut faire **aujourd'hui** sur le site — pas la roadmap, pas
les intentions. Chaque chiffre a été relevé en base de production le
jour de rédaction ; chaque libellé, seuil et règle a été vérifié dans le
code. Les limites sont dites en §8, y compris celles que ce relevé a
découvertes.*

---

## 1. Le produit en une page

**Orion est un produit d'intelligence des financements et des
écosystèmes industriels, focalisé sur le secteur spatial, construit sur
un corpus complet de R&D publique.** Il reconstruit, depuis des sources
publiques à licence limpide, qui finance quoi, qui travaille avec qui,
et comment les trajectoires bougent — de l'échelle du monde jusqu'à
l'État américain ou la région française, du groupe industriel jusqu'à
l'entité légale et au projet.

**À qui il sert.** Aux équipes stratégie, business development et veille
de l'industrie spatiale (prime, équipementier, startup), aux analystes
et investisseurs du secteur, aux organismes qui se positionnent sur les
financements publics. Le cas d'usage type : préparer un rendez-vous ou
un dossier — « que fait ce groupe, avec qui, où, et depuis quand ? » —
en minutes, avec des chiffres traçables jusqu'à leur source.

**Ce qui le distingue, tel que c'est réellement construit :**

- **La consolidation par groupes.** 1 413 groupes industriels
  reconstruits (GLEIF + Wikidata + curation manuelle sourcée), avec la
  règle du projet co-signé compté **une fois**, les coentreprises
  marquées avec leur pacte (Thales Alenia Space 67/33, ArianeGroup
  50/50), et les opérations **annoncées** listées mais jamais
  consolidées (0 €) — l'opération spatiale Airbus·Leonardo·Thales est
  dans le produit, à sa juste place.
- **L'honnêteté de couverture, structurelle.** Le produit ne laisse
  jamais une absence de données se faire passer pour un zéro : pays
  hachurés sur le globe et les cartes, badges « partiel » au benchmark,
  phrases d'assiette sous les chiffres, résidus « non rattaché »
  affichés. C'est une mécanique dérivée des données chargées, pas une
  prose à maintenir.
- **Tout est une URL.** Chaque vue de l'Explorateur, chaque angle
  d'analyse, chaque benchmark composé est un état d'URL partageable —
  c'est aussi le socle du dossier (on collectionne des vues *vivantes*,
  pas des captures).
- **La lentille spatiale versionnée.** Le secteur spatial est identifié
  projet par projet par un fichier de règles auditables (23 règles,
  chacune avec sa preuve), jamais par un mot-clé naïf — « rien de
  gonflé, rien de supprimé ».
- **La géographie symétrique.** Un même geste à chaque niveau — premier
  clic, un panneau ; second clic, on descend — du globe aux pages
  régions, aux fiches pays, jusqu'aux États américains et aux régions
  européennes (nommées via la nomenclature officielle ; sans carte
  européenne, par choix de licence assumé).
- **Des licences limpides uniquement.** Domaine public, CC0, CC BY —
  jamais de share-alike, jamais de zone grise (l'ANR est sortie du
  produit pour ODbL ; la géométrie GISCO a été exclue sur pièces).

Le site est bilingue FR/EN (défaut anglais), clair/sombre, et vit en
v0.4.0.

---

## 2. Les données

### 2.1 Les sources chargées

| Source | Flux | Périmètre | Années (dates de début) | Projets | Financements | Licence |
|---|---|---|---|---|---|---|
| **CORDIS** (Commission européenne) | `cordis-fp7`, `cordis-h2020`, `cordis-horizon` | FP7, Horizon 2020, Horizon Europe — UE + pays associés, consortiums mondiaux | 2007 → 2027 | **84 452** | **176,4 Md€** | CC BY 4.0 |
| **NIH RePORTER** (États-Unis) | `nih` | Santé/biomédical fédéral US, tranches chargées depuis l'année fiscale 2005 | 1965 → 2026 (des cœurs anciens portent des tranches récentes) | **380 275** | **439,3 Md€** (convertis) | Domaine public |
| **NSF** (États-Unis) | `nsf` | Science/ingénierie fédérale US | 1995 → 2027 | **235 071** | **118,8 Md€** (convertis) | Domaine public (« Courtesy: U.S. National Science Foundation ») |

**Référentiels associés** : GLEIF (identité des entités légales, CC0),
Wikidata (rattachements de groupes, CC0), BCE (taux de change annuels),
Eurostat (nomenclature NUTS — codes et noms des régions, CC BY 4.0,
**aucune géométrie** : la carte GISCO est exclue au registre pour clause
non commerciale).

### 2.2 Les totaux du corpus (relevés en production le 2026-08-17)

- **699 798 projets** · **734,5 Md€** de financements publics
- **1 102 270 participations** · **110 116 organisations**
- **208 pays** vus dans le corpus · **325 programmes** · **41 disciplines**
  euroSciVoc de niveau 2 (1 062 nœuds au total)
- Couche identité : **1 413 groupes**, 2 891 adhésions (dont **15
  annoncées**, jamais consolidées), 57 refus documentés au registre des
  refus (55 lignes au fichier de curation, 2 antérieurs à la fournée)
- Maille sous le pays : **56 États et territoires US** (362 219
  participations rattachées) + **491 régions européennes** dans 27 pays
  (385 485 participations rattachées) + nomenclature de 3 348 codes NUTS
- Lentille spatiale : **10 278 projets cœur (14,9 Md€)** + 5 814
  adjacents

*Note d'exactitude : le hero de l'accueil affiche « sur 4 sources
officielles » (chiffre en dur) ; le compte réel est 3 bailleurs / 5 flux
de projets, plus les référentiels.*

### 2.3 Les conventions (décisions gravées, appliquées à toute source)

1. **Une tranche annuelle n'est pas un projet.** Les sources qui versent
   par année fiscale (NIH) donnent un seul projet Orion par « numéro de
   cœur » ; les tranches sont sommées, jamais listées.
2. **Le montant d'un projet = la somme de ses tranches** ; les
   sous-projets sont repliés sur leur cœur.
3. **L'axe du temps est la date calendaire de début** (jamais l'année
   fiscale) ; le détail fiscal est conservé en brut pour l'audit.
4. **La devise d'origine est conservée, la conversion est datée** : euro
   au taux moyen annuel BCE de l'année de début, et le produit le dit
   (la fiche projet affiche « converti de {montant} · taux BCE {année} »).
5. **Le périmètre annoncé est le périmètre chargé.**
6. **Les fratries NSF sont repliées** : un projet collaboratif NSF
   arrive en N financements (un par établissement) ; ils deviennent un
   seul projet à N participations si et seulement si le préfixe
   « Collaborative Research/Proposal: » est publié par la source, l'année
   fiscale est la même, le titre normalisé est identique et les
   établissements sont tous distincts et nommés.
7. **Les parapluies sont mesurés** : 1 867 projets NIH (0,5 %) dépassent
   50 tranches et concentrent 59,5 Md$ (8 %) — des centres et contrats
   agrégateurs, ni faux ni comparables à un projet CORDIS ; vérifié
   qu'aucun ne pollue les vues de tête.

### 2.4 La mise à jour

La chaîne d'ingestion est rejouable à la commande et journalisée (chaque
run est daté ; la page « À propos des données » affiche la fraîcheur par
source). Un rafraîchissement hebdomadaire (lundi 03:00 UTC) est câblé
mais **désactivé à dessein** sur l'hébergement actuel : aujourd'hui, la
mise à jour est un geste manuel de l'exploitante.

### 2.5 Ce qui n'est PAS couvert — et comment le produit le dit

- **Classes de couverture dérivées** de ce qui est chargé : **49 pays**
  sont couverts par un bailleur domestique chargé (UE + associés via la
  Commission ; États-Unis via NIH/NSF) ; **~160 pays** ne sont vus que
  par leurs participations aux consortiums — leur budget domestique est
  *invisible, pas nul*, et chaque écran concerné le dit (hachures,
  badges, phrases).
- **Les budgets domestiques absents notables** : Royaume-Uni (UKRI),
  Suisse (SNSF), Pays-Bas (NWO), Suède (Vinnova) — annoncés « à venir »
  sur la légende du globe ; toute l'Asie (le Japon, la Chine, la Corée
  n'existent que par leurs consortiums européens) ; côté US, **ni NASA,
  ni DoD, ni DOE** — point majeur pour un produit spatial, dit en §8.
- **La France domestique** : l'ANR a été retirée définitivement
  (licence ODbL, share-alike) — le corpus français est celui des
  programmes-cadres.
- **Sources prévues** (ordre validé, en attente d'un serveur adapté) :
  UKRI, SNSF, NWO, Vinnova, puis SBIR ; USAspending et OpenAIRE
  ensuite.

---

## 3. La navigation complète

La barre porte le logo (→ accueil), quatre intentions à menus
déroulants, puis la recherche (« ⌕ Rechercher… ⌘K »), le compteur
« Dossier · n » (visible dès qu'une vue est collectée), la bascule de
langue (EN/FR) et la bascule de thème.

### « Découvrir »

| Entrée | Description affichée | Mène à |
|---|---|---|
| Projets | « tous les projets financés, recherche bilingue » | `/projects` |
| Organisations | « fiches consolidées, poste de veille inclus » | `/organisations` |
| Pays & monde | « le globe, la carte, une fiche par pays » | `/explore/countries` |
| Programmes | « les programmes-cadres et les instituts financeurs » | `/explore/programmes` |
| Thèmes ✧ | « 41 disciplines — qui monte, qui descend » | `/explore/themes` |
| Appels *(badge « P5 · automne 2026 »)* | « catalogue et correspondance » | `/calls` (page placeholder datée, avec ponts vers l'existant) |
| À propos des données | « sources, licences, fraîcheur » | `/about-data` |

### « Analyser »

| Entrée | Description | Mène à |
|---|---|---|
| Analyses prêtes ✧ | « une question, plusieurs angles — cliquez, puis modifiez » | `/analyses` |
| Explorateur | « composez : métrique × dimension × comparaison » | `/explore` |
| Comparer | « jusqu'à quatre organisations côte à côte » | `/compare` |
| Tendances par thème | « la course des disciplines dans le temps » | `/explore?by=theme&split=1` |

### « Construire »

| Entrée | Description | Mène à |
|---|---|---|
| Le dossier | « collectionnez des vues, assemblez, emportez » | `/dossier` |
| Rapports partagés *(« P6 · 2027 », grisé)* | « vues d'équipe, digests » | — (non cliquable) |

### « Espace »

*(le libellé de l'intention est « Espace » ; « Espace de travail » est sa
première entrée)*

| Entrée | Description | Mène à |
|---|---|---|
| Espace de travail *(badge « P6 · 2027 »)* | « suivis, recherches sauvegardées, alertes » | `/workspace` (placeholder daté) |
| Alertes *(« P5–P6 », grisé)* | « un concurrent gagne un projet sur votre thème » | — |
| Aujourd'hui déjà *(pied de menu)* | « chaque vue est une URL — partagez-la » | — |

**Le pied de page** : l'identité (« Intelligence des financements et
écosystèmes industriels du spatial » · « Europe · États-Unis ·
2005–2027 »), une colonne « Produit » (Projets, Organisations,
L'Explorateur, Comparer, Le dossier), une colonne « Explorer » (Pays,
Programmes, Thèmes, Analyses prêtes, Appels, Espace de travail, À
propos des données), et « Le corpus » — les trois compteurs vivants
(projets, organisations, financements) servis par l'API. En bas :
« © 2026 Orion · v0.4.0 ».

---

## 4. Chaque page en détail

### 4.1 L'accueil — trois actes

**Acte 1 — le hero épinglé.** « Orion Space Intelligence » en eyebrow,
puis le grand chiffre (734 Md€) qui **se compte au défilement** : sur
grand écran, la section est épinglée et le scroll pilote à la fois le
compteur, les trois KPI (projets financés, organisations, pays
participants) et la courbe-constellation qui se dessine. Sous le
chiffre, la phrase d'assiette : « sur 4 sources officielles — Europe
(programmes-cadres de l'UE), États-Unis (NIH, NSF) ».

**Acte 2 — la tuile encre.** « Que cherchez-vous ? » et la barre de
demande libre, dont le placeholder **se tape tout seul** sur trois
exemples réels. Dès deux caractères, des destinations s'ouvrent (mêmes
cibles que la palette ⌘K) ; Entrée lance la recherche plein texte.
Trois exemples cliquables (« qui coordonne les satellites ? », « CNRS vs
Fraunhofer », « le solaire par thème depuis 2021 »). Puis **la bande
spatiale** (voir §6) et **trois portes éditoriales** : Découvrir (la
fiche de la première organisation du corpus), Analyser (« 8 analyses
prêtes » → le deck hydrogène), Construire (le dossier, avec son compteur
si entamé) ; une quatrième ligne « Suivre » annonce les phases à venir,
non cliquable.

**Acte 3 — le globe.** « Le monde des financements » : le globe en
rotation permanente (4,2°/s, pause au survol, glisser pour tourner),
chaque pays financé teinté par sa région, l'intensité par le montant.
**Au survol : la constellation de collaborations** — les 5 plus gros
flux réels du pays partent en arcs vers leurs partenaires, épaisseur
proportionnelle au montant. Premier clic : le globe glisse à gauche et
le **panneau pays** s'ouvre (photo curée en duotone, chiffres, thèmes,
CTA) ; second clic sur le même pays : sa fiche. Les pays aux
financements domestiques non couverts portent la **hachure d'honnêteté**
et la légende la nomme. La légende annonce aussi la couverture
(« Europe — CORDIS · États-Unis — NIH, NSF ») et les sources à venir.

Sous le globe, **le fil « Actualités »** : des histoires **calculées
depuis le corpus** (le duel — deux organisations à moins de 20 %
d'écart ; la percée — une entrée au top 10 ; le gros contrat — le plus
gros projet de l'année mûre ; le mouvement — un thème à +20 %) mêlées
une à une aux actualités officielles (flux RSS Commission européenne
R&I et ANR, 3 max). Chaque histoire a sa porte (départager au
benchmark, ouvrir le poste de veille, la fiche projet, la course des
thèmes). Défilement automatique (3,8 s) qui **se fige** au survol réel,
au focus clavier et au glisser ; flèches, pastilles et swipe au choix.
Seuil d'honnêteté : aucune histoire sous 500 k€ de fenêtre.

### 4.2 La géographie — quatre niveaux, un geste

**La règle fondatrice, partout : le premier clic explore (sélection,
panneau), jamais de téléportation ; le second clic descend.**

| Niveau | Page | Ce qu'on y voit / fait |
|---|---|---|
| **Monde** | `/explore/countries` | bascule Globe/Carte (mémorisée), classement complet des pays, pilules de régions qui **naviguent** |
| **Région** | `/explore/regions/europe` (·north-america ·asia-pacific ·latin-america ·middle-east-africa) | une vraie page : hero chiffré + sparkline, phrase d'assiette, carte cadrée cliquable, « Les pays, classés » avec badges « partiel », organisations de tête, années — **jumelle structurelle de la fiche pays**, pour se comparer côte à côte |
| **Pays** | `/explore/countries/FR` | fil d'Ariane « Monde › Europe › France », hero total + classe de couverture, **la maille** (ci-dessous), années, top organisations, top projets, repères, portes |
| **Maille** | `/explore?…&subdivision=US-CA` | l'Explorateur cadré sur l'État/la région, toute la grammaire disponible |

**La maille sous le pays** — deux formes, une seule règle :
- **États-Unis** : choroplèthe des 56 États et territoires (géométrie
  us-atlas, domaine public ; Alaska/Hawaï encartés, 5 territoires en
  pastilles). Exemples réels : Californie 60,6 Md€, New York 40,3,
  Massachusetts 39,2, Maryland 29,8.
- **Europe (27 pays)** : barres classées **nommées, jamais dessinées**
  (nomenclature Eurostat ; pas de carte, par licence). Le libellé est
  natif : « Par région » (FR), « Par Land » (DE), « Par comunidad »
  (ES), « Par voïvodie » (PL)… Le niveau est curé par pays — la France
  en régions de 2016 (Île-de-France 12,37 Md€, Auvergne-Rhône-Alpes,
  Occitanie), l'Allemagne en Länder (Bayern 7,46 Md€), la Suède en län.
- Dans les deux cas : premier clic sélectionne (ligne de synthèse),
  second ouvre la vue filtrée ; et le **résidu est avoué** — « Non
  rattaché à une région : 1,8 Md€ » sur la fiche France.

L'ancien paramètre `?scope=` des pages géographiques **redirige** vers
les pages régions (les liens épinglés survivent).

### 4.3 La fiche projet (`/projects/:id`)

Identité (acronyme, statut, **lien vers la source** ↗), titre bilingue,
quatre KPI — dont le financement avec sa note de conversion (« converti
de {montant} · taux BCE {année} ») —, le résumé avec bascule EN/FR, la
table des **participants** (rôle Coordinateur/Participant, pays,
financement ; chaque nom → sa fiche), les thématiques, l'attribution de
licence, et « Explorer à partir d'ici » (coordinateur, programme racine,
pays, recherche par acronyme).

### 4.4 La fiche organisation (`/organisations/:id`) — et son poste de veille

Type · ville · pays, bouton **« + Ajouter au dossier »** (collecte la
trajectoire vivante), hero (total + sparkline). Puis en actes :

- **01 · trajectoire** — « Les années, rôle par rôle » : barres
  empilées coordination/participation par année, parts en tête.
- **02 · collaborateurs** — « Où vivent ses partenaires » : carte
  mondiale séquentielle (paliers par quantiles du nombre de projets
  partagés) + liste des partenaires récurrents (drapeau, projets
  communs, montant).
- **« Profil thématique »** — top 5 euroSciVoc niveau 2, en barres et en
  parts, avec la note « Un projet portant plusieurs thèmes compte dans
  chacun. »
- **« Signaux »** — exactement deux types, à seuils stricts (« aucun
  signal vaut mieux qu'un signal factice ») :
  - **Le thème qui accélère** : fenêtres fixes 2019-21 vs 2022-24,
    ≥ 500 k€ dans *chaque* fenêtre, ≥ 5 projets sur la période,
    croissance ≥ +25 %. Rendu : « ↑ {n} % — {thème} accélère dans ce
    portefeuille » → la tendance du thème dans l'Explorateur.
  - **Les nouveaux partenaires** : premier projet partagé dans les
    **24 derniers mois** (730 jours) ; 3 noms cités, compteur plafonné
    « 50+ » côté serveur.
- **Portefeuille** (10 projets/page), **programmes principaux**, colonne
  de repères (dynamique 2022-24 vs 2019-21, identifiants, « Fiche
  consolidée — {n} noms sources regroupés » quand la dédoublonneuse a
  fusionné), bouton **« Comparer → »**.

### 4.5 La fiche groupe (`/groups/:id`) — l'écran de démo n° 1

Badge « Groupe », « Groupe de {n} entités légales », LEI. Hero
consolidé, et **la note d'honnêteté de périmètre** : « Rattachements
fondés sur les registres publics (GLEIF, Wikidata) et la curation
manuelle. {n} organisations du corpus portant le nom du groupe ne sont
pas encore rattachées ({montant} de financements) — les totaux disent le
périmètre rattaché, jamais le groupe entier. »

Quatre actes : **« Le groupe d'un seul tenant »** (projets distincts —
un co-signé compte UNE fois —, entités, pays ; la trajectoire éclatée
top 5 + « autres entités » ; les thèmes du groupe entier),
**« Où vit le groupe »** (carte cliquable + liste des entités, chacune
avec sa part du total consolidé, sa méthode de rattachement et sa
confiance ; badge **« Coentreprise »** ; pastille **« annoncé »** avec
part « non consolidé » à 0), **« Avec qui le groupe travaille »**
(partenaires externes — les co-signatures internes ne comptent jamais),
**« Le poste de veille consolidé »** (mêmes seuils que l'organisation,
sur le périmètre actif). Les parts peuvent dépasser 100 % en cumul
(co-signatures) — et la page le dit. Porte « ⇄ Comparer ce groupe ».

### 4.6 Programmes et thèmes

**`/explore/programmes`** : une rangée par agence (programmes, projets,
montant) ; entrer dans l'agence déplie ses programmes, filtrables au
clavier. **La fiche programme** : KPI, années, principaux bénéficiaires,
plus gros projets, portes. Le **drill descendant** dans les
sous-programmes vit dans l'Explorateur (donut par programme → clic sur
une tranche → ses enfants ; la part directe est nommée « directement sur
le programme »).

**`/explore/themes`** : l'index des 41 disciplines — rang, sparkline sur
vingt ans, delta sur fenêtres mûres (ou « nouveau »), total, part du
corpus ; tri par montant ou par progression ; chaque ligne ouvre la
course du thème dans l'Explorateur. *(Il n'existe pas de fiche par
thème — c'est un choix de phase.)*

### 4.7 L'Explorateur (`/explore`) — le composeur

La phrase se compose à l'écran : **« Montrer ‹métrique› par ‹dimension›,
‹top N›, ‹dans le temps› »** + fenêtre d'années + « + filtre ».

**Les 5 métriques** : les financements · les projets · les organisations
actives · le financement moyen par projet · la part en coordination.

**Les 8 dimensions au menu** : pays · région · programme · thème ·
organisation · bailleur · type d'organisation · année. *(La dimension
État/région existe côté serveur et par URL — `subdivision=` — c'est la
porte qu'empruntent les fiches pays.)*

**Les combinaisons refusées** (le produit répond proprement plutôt que
de mentir) : « organisations actives » par programme ou par
organisation ; « part en coordination » par programme, bailleur, thème
ou État — les comptes distincts et les ratios ne s'additionnent pas sur
des enfants repliés. La coordination sans comparaison exige ≥ 100
participations (« un pays à trois participations n'est pas un pays qui
coordonne »).

**La base de calcul est affichée** sous le titre : « part des
participants » (dimensions côté participation) ou « budget des projets »
(année, programme, bailleur, thème) — la règle anti-double-comptage.

**Contrôles** : top 5/10/25 ; « dans le temps » ; années 2005 → 2027 ;
« + filtre » (texte bilingue, pays). **Comparer** : depuis le menu du
top N (pays, programmes, types, thèmes — jusqu'à 6, séparés par `~`
dans l'URL) ; en comparaison, le top est ignoré et toutes les séries
comparées s'affichent.

**Les formes** (choisies par la grammaire, ordre = pertinence) :
Courbes · **Rangs** (bump) · **Avant/après** (dumbbell, garde
anti-censure : la fenêtre récente s'arrête à l'année mûre) · Barres ·
Donut (≤ 7 tranches + « autres » honnête ; **drill** au clic sur les
programmes) · **Carte** (euros seulement) · Table (jumelle accessible,
toujours là). Le donut n'est proposé qu'aux métriques additives ; la
carte « ne parle que l'euro ».

**Sous chaque vue** : la note « Couvertures inégales » quand la vue
mélange des assiettes (avec les pays non couverts nommés), la ligne de
sources, et trois boutons — **« + Ajouter au dossier »**, **« CSV »**
(avec la ligne de sources et l'URL de la vue en pied de fichier),
**« Partager »** (copie le lien).

**Le mode Angles** (`?angles=`) : le composeur s'efface, le deck se
présente seul — flèches, pastilles, `?angle=n` dans l'URL, « Ouvrir
dans le composeur → » pour se l'approprier, ajout au dossier par angle.

### 4.8 Les analyses prêtes (`/analyses`) — 8 analyses

**Trois decks** :

1. **« Où va l'argent de l'hydrogène ? »** — 5 angles : la trajectoire ;
   par programme (donut interactif, drill) ; par pays sur la carte ; qui
   est financé (courbes) ; la course des pays en rangs.
2. **« Le Brexit vu des financements »** — 3 angles : Royaume-Uni vs
   France ; la course en rangs ; le Royaume-Uni par programme.
3. **« Cinq thèmes, vingt ans »** — 3 angles : la course en courbes ; en
   rangs ; avant/après (qui a gagné du terrain).

**Cinq vues simples** : « L'Europe face aux États-Unis » (US~FR~DE) ·
« Où va l'argent depuis 2021 » (thèmes) · « Vingt ans de
programmes-cadres » · « L'essor du quantique » · « Qui coordonne
l'Europe ? » (part en coordination par pays).

Chaque analyse **est** un état de l'Explorateur, donc une URL — on
clique, on regarde, puis on modifie.

### 4.9 Le benchmark (`/compare`)

Jusqu'à **4 entités** côte à côte — organisations **et groupes** (badge
« Groupe » dans le picker, groupes proposés en premier ; un groupe se
**replie en une série** consolidée sur ses entités actives). Entrées :
depuis une fiche (« Comparer → », « ⇄ Comparer ce groupe »), le duel du
fil d'actus, ou l'URL (`?orgs=…`, et un parseur « X vs Y »).

La page, dans l'ordre :

1. **« Les totaux, comparés »** — barres par entité, couleur de série
   stable. Une entité d'un pays non couvert porte le badge **« partiel »**
   (bordure tirets) : « on compare alors des assiettes inégales ».
2. **Le tableau KPI** — financement total, projets, en coordination,
   période d'activité.
3. **« Composer la comparaison »** — le composeur du benchmark :
   **vues préparées** « Trajectoires · Par programme · Par thème · Par
   pays » (`cby`), métrique financements/projets (`cmetric`), forme
   Donuts/Barres (`cview`) — le tout dans l'URL, valeurs par défaut
   effacées pour des liens propres. En trajectoires : la courbe
   commune + **l'écart par année** (à deux entités : barres autour de
   l'axe zéro, « {a} moins {b} »). En vues par entité : les donuts ou
   barres côte à côte, et **« ＋ Ajouter les {n} vues au dossier »**
   (TwinCollect — un bloc par entité, en un clic).
4. **« Partenaires communs »** — ceux qui co-signent avec *chaque*
   entité comparée (« le raccourci du veilleur ») ; vide honnête sinon.
5. **« Géographie face à face »** — pour les groupes : une carte par
   entité, ses pays d'implantation.

### 4.10 Le dossier (`/dossier`)

**Le parcours** : partout où vit une vue (Explorateur, angle d'analyse,
fiche organisation, fiche pays, page région, benchmark), le bouton
**« + Ajouter au dossier »** — un *toggle* : « ✓ Au dossier · retirer ».
Le compteur apparaît dans l'en-tête du site.

**Ce qu'une vue garde** : son URL (la vue **reste vivante** — elle
rejoue les données à chaque ouverture), un titre honnête renommable, une
note en marge, sa date de collecte (« données au {date} »). Jamais deux
fois la même vue.

**Sur la page** : un titre de dossier libre (placeholder proposé depuis
la première question collectée), les blocs numérotés 01, 02… chacun avec
sa phrase de requête reconstruite, sa vue rendue, sa table jumelle
repliée, et ses gestes épelés : **↑ Monter · ↓ Descendre · ✎ Renommer ·
＋ Annoter · − Retirer**. « Ouvrir la vue vivante ↗ » ramène à
l'Explorateur.

**« Emporter »** : la mise en page d'impression du navigateur — une
section par page, chrome masqué — donc un PDF propre en un geste.

**Persistance** : le navigateur (localStorage), synchronisé entre
onglets ; la page le dit — « conservé dans ce navigateur — les comptes
(P6) le rendront durable ».

### 4.11 La recherche — trois visages

- **La palette ⌘K** (partout) : navigation pure. Dès 2 caractères :
  « Chercher « q » dans tous les projets » toujours en tête, puis
  **Groupes** (badge), **Projets**, **Organisations**, **Thèmes**,
  **Pays** — Entrée file vers l'option active ; le vieux réflexe
  taper-Entrée mène à la recherche plein texte. Vide : cinq amorces.
- **La recherche composable** (`/projects`, `/organisations`) : une
  barre à **tags typés** (pays · bailleur · programme · années · texte —
  « Allemagne » pose *le pays*, pas un mot). Sans question, pas
  d'annuaire : « La question d'abord ». Facettes « Affiner »
  (bailleurs, programmes, pays), tri Pertinence/Financement/Date,
  regroupement des résultats par cadre de financement, extraits
  surlignés bilingues. Sur `/organisations` : les **groupes en tête**
  (badge, entités, pastille « {n} entités annoncées », consolidé), la
  « meilleure correspondance » en grande carte, la grille façon tableur
  avec trajectoires.
- **La barre de demande libre** (accueil, Explorateur) : elle interprète
  l'intention (« CNRS vs Fraunhofer » → le benchmark ; sinon la
  recherche ou une vue composée).

---

## 5. La bibliothèque de visualisations

| Visualisation | À quoi elle ressemble | La question qu'elle sert | Où |
|---|---|---|---|
| **Globe** | orthographique, rotation continue, teinte de région × intensité log, arcs de collaborations au survol, hachures d'honnêteté | « le monde d'un coup d'œil, qui travaille avec qui » | accueil, page monde |
| **Carte plate** | choroplèthe pré-projetée par périmètre (7 : monde, 5 régions, États-Unis), pastilles pour les micro-territoires (Malte…), flux au survol, hachures + légende | « où est l'argent, où sont les trous » | monde, régions, fiches pays/US, Explorateur, benchmark, fiche groupe |
| **Carte des collaborateurs** | séquentielle une teinte, paliers par quantiles (des *comptes*, pas des euros — la palette de régions ne s'applique pas) | « où vivent ses partenaires » | fiche organisation |
| **Courbes** | multi-séries, palette fixe de 6 teintes — la couleur suit l'entité, jamais son rang | « comment ça évolue » | Explorateur, benchmark, dossier, fiche groupe |
| **Rangs (bump)** | polylignes de classement, étiquettes directes aux deux bouts, brisées sur les absences | « qui monte, qui décroche » | Explorateur (vue « Rangs »), decks |
| **Avant/après (dumbbell)** | deux points reliés par entité, fenêtre récente vs précédente, delta %, tri par mouvement, années mûres seulement | « qui a gagné du terrain » | Explorateur (« Avant / après »), deck thèmes |
| **Barres** | horizontales, dégradé d'accent, largeur = valeur | « qui domine » | partout |
| **Donut** | ≤ 7 arcs dont « autres » honnête, centre vivant (total ou tranche), **drill** au clic sur les programmes | « la part du tout » | Explorateur, benchmark, deck hydrogène |
| **Table** | la jumelle accessible de chaque graphique | « la lecture exacte » | sous chaque vue |
| **Barres d'années** | verticales, seule l'année de pic porte l'accent | « le profil temporel d'un lieu » | fiches pays, région, programme |
| **Sparkline de trajectoire** | une polyligne qui se dessine à l'entrée, pic pointé | « la forme d'une histoire » | heros des fiches |
| **Micro-sparkline** | 72×22, la forme avant la précision | « la trajectoire en liste » | résultats organisations |
| **Delta de tendance** | ↑/↓ + pourcentage, fenêtres 2022-24 vs 2019-21 | « ça accélère ou ça freine ? » | fiches, listes |
| **Barres empilées de rôle** | coordination sur participation, par année | « mène-t-elle ou suit-elle ? » | fiche organisation |
| **Constellation du hero** | la courbe des vingt ans, étoiles allumées au passage | « l'ampleur, en ouverture » | accueil |
| **Écart par année** | barres autour d'un axe zéro | « qui devance, année par année » | benchmark (2 entités) |
| **Art génératif du fil** | dessins semés depuis les données (duel, étincelle, constellation) | habiller les actus calculées | fil d'actualités |

**Encodages transverses** : la teinte dit la *région* (palette validée
daltonisme), l'intensité dit le *montant* en **5 paliers log nommés**
(« <10 M€ · 10-100 M€ · 0,1-1 Md€ · 1-10 Md€ · >10 Md€ » — des rangs
mentiraient à l'échelle du monde) ; les hachures disent « financements
domestiques non couverts » ; la palette de séries (6 teintes) est
attachée aux entités. *Le treemap a quitté le produit* (remplacé par le
donut à drill).

---

## 6. Le mode spatial

**Ce que change la lentille.** Chaque projet du corpus est tagué
`cœur` / `adjacent` / rien par **23 règles versionnées et auditables**
(fichier de curation, une preuve par règle) : 4 règles de *programme*
(FP7-SPACE, le volet spatial d'H2020, l'astronomie NSF en cœur ; le
géospatial-atmosphérique NSF en adjacent), 5 règles de *thème* (par
**code** euroSciVoc, jamais par libellé — « astro » attrapait la
gastro), 14 motifs *texte* validés à la main et **cadrés par source**
(jamais sur NIH, où « satellite cell » est un muscle) : earth
observation, in-orbit, space debris, cubesat, space weather, exoplanet…
Le cœur bat l'adjacent structurellement ; chaque run retague tout ;
**rien n'est jamais supprimé du corpus** (invariant fondateur).

**Le périmètre en production** : **10 278 projets cœur — 14,9 Md€** —
et 5 814 adjacents. Le cadrage `?sector=space` (Explorateur et
recherche projets) prend **cœur + adjacent confondus** ; la distinction
ne vit aujourd'hui que dans les compteurs de l'accueil.

**Sur le site** : l'identité « Orion Space Intelligence » (hero,
tagline), et **la bande spatiale de l'accueil** — « Le secteur spatial,
identifié dans le corpus », sa phrase de méthode courte (« Une lentille
versionnée tague chaque projet sur pièces — le spatial au cœur, les
technologies habilitantes en adjacent. Rien de gonflé, rien de
supprimé. »), ses trois chiffres calculés, sa porte « Explorer
l'espace → » (l'Explorateur cadré espace, par pays).

**Les groupes spatiaux curés** (fichier de 399 lignes, 30 groupes,
344 rattachements, 55 lignes de refus sourcées) : Thales (43 entités), Safran
(37), Airbus (26), Leonardo (16), OHB… Les **coentreprises portent leur
pacte** : Thales Alenia Space 67/33 Thales-Leonardo, Telespazio 67/33
Leonardo-Thales, ArianeGroup 50/50 Airbus-Safran. L'opération
**« Airbus · Leonardo · Thales (espace, annoncé) »** (protocole
d'octobre 2025) est dans le produit avec ses 15 entités **annoncées :
listées, badgées, consolidées à 0 €** tant que l'opération n'est pas
close.

**Ce qui n'existe pas encore en mode spatial** — dit franchement : pas
de stories/analyses dédiées espace (les 8 analyses sont généralistes),
pas de panneau de méthode détaillé côté produit (la méthode vit dans le
fichier de règles et ses preuves ; l'utilisateur n'en voit que la phrase
de la bande), et aucun indicateur visible dans l'Explorateur quand la
vue est cadrée espace (le cadrage est dans l'URL).

---

## 7. Les mécaniques transverses

- **Tout est une URL.** L'état complet de l'Explorateur
  (métrique, dimension, top, temps, années, filtres, comparaison,
  drill, angle), du benchmark (`orgs`, `cby`, `cmetric`, `cview`) et
  des pages géographiques vit dans l'adresse — partage par copie de
  lien (« Partager » → « Lien copié ✓ »), dossiers construits dessus.
- **Le geste géographique unique** : premier clic = panneau, second =
  descendre — du globe aux barres de régions.
- **Le scope à deux vies** : sur les pages géographiques, la région est
  une *adresse* (pages régions) ; dans l'Explorateur, c'est un *filtre
  d'analyse* — les deux ne se mélangent pas.
- **FR/EN** : bascule d'un clic, persistée ; **le défaut est
  l'anglais**. Le contenu des projets est bilingue quand la source
  l'est (recherche et extraits dans les deux langues).
- **Clair/sombre** : bascule persistée, appliquée avant le premier
  rendu (pas de flash) ; toute la dataviz est en jetons de couleur, le
  sombre suit gratuitement.
- **L'ajout au dossier** : le même toggle sur six surfaces.
- **L'honnêteté de couverture** : hachures (globe, cartes), badges
  « partiel » (benchmark, classements de régions), phrases d'assiette
  (hero, fiches pays, pages régions, vues mélangées), résidus nommés
  (« non rattaché », « autres », « région non précisée ») — dérivés des
  données, jamais déclaratifs.
- **La traçabilité** : chaque projet lie sa source (↗) et affiche sa
  conversion datée ; chaque rattachement de groupe affiche sa méthode
  et sa confiance ; chaque photo de pays a sa licence au registre
  (CC0/domaine public, vérifiée par API le jour du chargement) ; la
  ligne de sources accompagne l'Explorateur, le dossier, l'export CSV
  (avec l'URL de la vue en pied de fichier) et « À propos des données »
  (fraîcheur par source, licences, état du système).

---

## 8. Les limites honnêtes

**Ce que le produit ne fait pas encore — et assume :**

- **Pas d'appels ni d'opportunités** (catalogue, matching, éligibilité,
  deadlines) : annoncés « P5 · automne 2026 », page placeholder datée.
- **Pas de comptes** : le dossier vit dans le navigateur ; « les comptes
  (P6) le rendront durable ». Pas d'alertes, pas de rapports partagés,
  pas d'espace de travail (P6 · 2027).
- **Couverture US partielle — le point le plus important pour un produit
  spatial** : NIH + NSF seulement. **Ni NASA, ni DoD, ni DOE** — les
  financements spatiaux américains directs ne sont pas dans le corpus ;
  le spatial américain visible est celui de la NSF (astronomie…) et des
  consortiums européens.
- **L'Asie est absente en domestique** : Japon, Chine, Corée n'existent
  que par leurs participations aux programmes européens — leurs écrans
  le disent (hachures, phrase « Aucun bailleur domestique de cette zone
  n'est encore chargé »).
- **Royaume-Uni, Suisse, Pays-Bas, Suède** : pas de bailleur domestique
  chargé (annoncés sur la légende du globe) ; la France domestique
  (ANR) est sortie définitivement pour cause de licence.
- **Pas de carte des régions européennes** — assumé au registre
  (géométrie GISCO non commerciale) : des barres nommées, pas de
  choroplèthe. Réexamen seulement si une licence EuroGeographics est
  achetée un jour.
- **La pondération des coentreprises n'est pas encore appliquée aux
  montants** : les parts (67/33, 50/50) sont curées, validées, stockées
  et affichées en badge, mais le consolidé d'un groupe compte
  aujourd'hui 100 % des participations de ses entités actives, JV
  comprises. La doctrine (« toute vue consolidée respecte ces
  pondérations ») attend son implémentation.
- **La mise à jour des données est manuelle** (hebdomadaire prête mais
  désactivée sur cette machine) ; la fraîcheur est affichée par source.
- **Petites aspérités connues** (relevées au présent inventaire) : la
  fiche groupe n'a pas encore de bouton dossier ; la carte de
  l'Explorateur n'affiche pas les hachures de couverture (les cartes
  géographiques, si) ; la dimension État/région ne se choisit que par
  URL ; le cadrage spatial est invisible à l'écran de l'Explorateur ;
  la 404 est encore la version nue (sa refonte est au chantier
  hygiène, lot A, non commencé) ; la navigation n'a pas de variante
  mobile dédiée ; quelques textes restent en dur en français sur « À
  propos des données » et en anglais dans les amorces de la palette.

---

*Fin du mémo. Registre des sources et décisions : [data-sources.md](data-sources.md) ·
doctrine design : [design-doctrine.md](design-doctrine.md) · conceptions
géographiques : [conception-symetrie-geo.md](conception-symetrie-geo.md),
[conception-drill-etats.md](conception-drill-etats.md),
[conception-couverture.md](conception-couverture.md).*
