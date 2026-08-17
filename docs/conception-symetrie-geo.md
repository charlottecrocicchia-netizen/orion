# Conception — la symétrie géographique

*2026-08-17 — commande fondatrice, intégrée au lot F : « une hiérarchie
prévisible où chaque niveau est une vraie page et le geste est identique
partout : premier clic = panneau, second clic = on descend ». Des
arbitrages se présentent : conception AVANT surfaces, décisions
numérotées en fin de document. Rien de ce qui suit n'est codé.*

## 1. Ce que la demande change — et ce qu'elle ne change pas

Aujourd'hui la géographie d'Orion a **trois niveaux réels et un
fantôme** : le monde (`/explore/countries`), le pays
(`/explore/countries/US`), la maille (section « par État » de la fiche
pays, qui descend vers l'Explorateur cadré). Le fantôme, c'est la
région : `?scope=europe` REcadre la carte du monde mais ne crée pas de
lieu — pas d'URL propre qui se partage, pas de chiffres de région, pas
de page à mettre face à une autre. La demande comble exactement ce
trou.

Ce qui ne change PAS : la règle carte fondatrice (premier clic explore,
jamais de téléportation), le globe de la home, le drill US validé en
recette, la grammaire de l'Explorateur, et l'interdit de géométrie NUTS
(registre du 2026-08-17 : les régions européennes seront **nommées,
jamais dessinées** — pas de carte, la nomenclature CC BY 4.0 porte les
noms).

## 2. La hiérarchie — quatre niveaux, un geste

| Niveau | URL | La page | 1er clic | 2e clic |
|---|---|---|---|---|
| **Monde** | `/explore/countries` | globe/carte + classement pays (existant) | sélectionne le pays (panneau photo) | ouvre la fiche pays |
| **Région du monde** | `/explore/regions/europe` (× 5) | carte cadrée cliquable, KPIs, classement des pays, orgs de tête, années | sélectionne le pays | ouvre la fiche pays |
| **Pays** | `/explore/countries/FR` | fiche pays (existant) + section maille quand la donnée existe | sélectionne la maille (ligne de synthèse) | descend vers l'Explorateur cadré `subdivision=` |
| **Maille** | `/explore?subdivision=FR10` | l'Explorateur, toute sa grammaire | — | — |

Le geste est LE MÊME à chaque étage : première activation, un panneau ou
une sélection ; seconde, on descend d'un niveau. La maille n'a pas de
page propre — 56 États + ~600 NUTS2 fabriqueraient des centaines de
pages squelettiques ; l'Explorateur cadré est déjà la « page » de la
maille, avec la grammaire entière en plus. C'est le drill US validé en
recette, généralisé tel quel.

Le globe de la home continue d'ouvrir la fiche PAYS au second clic —
on clique la France, pas l'Europe ; interposer la page région ralentirait
le geste le plus fréquent du site. Les pages régions s'atteignent par
les pilules de scope (qui deviennent des liens), le fil d'Ariane, et la
recherche ⌘K (destinations « Europe », « Amérique du Nord »…).

## 3. Le sort de `?scope=`

- **`/explore/countries?scope=europe` → redirection client vers
  `/explore/regions/europe`.** Les vieux liens et les dossiers épinglés
  survivent ; il n'existe plus DEUX écritures du même lieu.
- **`scope=` de l'Explorateur : inchangé.** C'est un FILTRE d'analyse
  (`/explore?by=country&scope=europe` cadre l'agrégat), pas une adresse.
  Les deux mondes ne se mélangent pas : les pages géographiques disent
  « où l'on est », l'Explorateur dit « ce que l'on compte ».
- **`us-states` : interne** au composant carte de la fiche pays, comme
  aujourd'hui — jamais une page.

## 4. La page région — jumelle de la fiche pays, comparable comme elle

Blocs, dans l'ordre de la fiche pays pour que « la page Europe face à la
page États-Unis » se lise côte à côte :

1. **Hero** : nom, financement total, sparkline — et la **phrase
   d'assiette** (lot E) : une région mélange presque toujours des
   couvertures ; l'Europe contient la Russie vue par consortiums —
   la page le confesse, comme partout.
2. **Carte cadrée** (géométrie déjà dans flat-maps.json, aucun sujet de
   licence) : pays cliquables, geste standard, hachures de couverture.
3. **Classement des pays** avec badges de couverture — c'est ici qu'on
   « choisit son pays ».
4. **Organisations de tête** de la région ; **années** ; **portes** vers
   l'Explorateur cadré.

La comparabilité V1 est la **gémellité structurelle** — même decks,
mêmes blocs, deux onglets côte à côte — exactement comme deux fiches
groupe. L'entrée des entités géographiques dans `/compare` (un `cby`
géographique au benchmark composable) est possible sur la grammaire
existante mais c'est un lot à part entière : proposé en **option F3**,
pas dans cette passe.

## 5. La maille européenne — nommée, jamais dessinée

Sur la fiche d'un pays européen, la section « Par région » est un
**classement en barres** (pas de carte : registre) : nom officiel,
financement, projets, part du pays. Le geste reste le geste : premier
clic, la ligne se sélectionne et la ligne de synthèse s'affiche (comme
la maille US) ; second clic, l'Explorateur cadré `subdivision=`.
L'uniformité du geste sur une LISTE se paie d'un clic de plus qu'un
lien direct — c'est le prix de « identique partout », et il est bon.

**Résidus honnêtes, affichés** : les participations au NUTS national
sec (« FR », 2 118 cas) sortent en « région non précisée » en fin de
classement — jamais fondues, jamais omises. Les codes d'anciens
millésimes absents de la nomenclature ressortent en code brut.

## 6. Le niveau de maille par pays — un fichier de curation

Le « bon » niveau NUTS n'est pas le même partout : les Länder allemands
sont NUTS1, les comunidades espagnoles NUTS2, les län suédois NUTS3.
Choisir silencieusement un niveau unique fabriquerait des mailles que
personne ne reconnaît (les « régions » françaises en NUTS2 sont les
ANCIENNES régions). Proposition : `backend/curation/nuts-levels.csv`
(pays, niveau, justification), versionné et recetté comme toute
curation. Table proposée :

| Niveau | Pays | La maille que les gens connaissent |
|---|---|---|
| **NUTS1** | FR, DE, BE | régions actuelles (FR1+FRB…FRM), Länder, Régions belges |
| **NUTS2** | ES, IT, NL, AT, PL, PT, RO, CZ, EL, HU, BG, HR, SK, IE, LT | comunidades, regioni, provinces, Bundesländer AT, voïvodies… |
| **NUTS3** | SE, FI, DK, EE, LV, SI | län, maakunnat, landsdele — leurs NUTS2 sont des constructions statistiques |
| n/a | LU, MT, CY | pays-maille : pas de section régions |

La France en NUTS1 assume un choix : Île-de-France (FR1) y côtoie
Occitanie (FRJ) — c'est la carte administrative de 2016, celle que tout
le monde connaît. Le NUTS brut étant conservé sur chaque participation,
changer un niveau plus tard est un changement de VUE, pas de données.

## 7. Fils d'Ariane

`Monde › Europe › France` sur la fiche pays (la région vient du
référentiel existant), `Monde › Europe` sur la page région — chaque
segment cliquable, le dernier en encre pleine. C'est la préfiguration du
composant unifié du chantier hygiène (lot A ⑤) appliquée aux pages
géographiques seulement ; l'unification site entière reste au lot A.

## 8. Vocabulaire

« Régions du monde » (Europe, Asie-Pacifique…) vs maille sous le pays :
l'ambiguïté du mot « région » se règle par le libellé NATIF de la
maille — « Par État » (US), « Par région » (FR), « Par Land » (DE),
« Par comunidad » (ES)… porté par le référentiel de niveaux (colonne
libellé FR/EN), jamais un « subdivisions » générique à l'écran.

## 9. Lots d'exécution

- **F1 — la donnée : FAIT ce jour.** Backfill NUTS en prod (431 798,
  93,2 %, 125 s), nomenclature chargée (3 348 codes), attribution au
  registre.
- **F2 — les surfaces (après validation de CE document)** : les 5 pages
  régions + redirection `?scope=` + sections maille des pays européens
  (barres, geste standard, résidus affichés) + fils d'Ariane géo +
  libellés natifs + crédit Eurostat en pied de page + e2e (gémellité,
  geste, redirection, honnêteté des résidus).
- **F3 — option, lot séparé** : les entités géographiques dans le
  benchmark composable (`/compare` : l'Europe face aux États-Unis en
  deck, dossier compris).

## 10. Décisions demandées

1. **URLs** : `/explore/regions/europe` pour les 5 régions du monde — ok ?
2. **`?scope=` géographique** : redirection vers les pages régions — ok ?
3. **Globe home** : second clic reste fiche PAYS (pas d'interposition
   région) — ok ?
4. **Geste sur les barres** : deux temps aussi sur les listes de mailles
   (sélection puis descente), prix de l'uniformité — ok ?
5. **Niveaux NUTS par pays** : la table du §6 (FR en NUTS1 notamment) —
   à valider ligne à ligne ou amender.
6. **Comparabilité** : V1 = gémellité structurelle ; le benchmark géo
   part en option F3 — ok ?
