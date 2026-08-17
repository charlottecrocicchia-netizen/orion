# Conception — dire la couverture au moment où l'on compare

*2026-08-17 — instruction fondatrice : « quelqu'un peut croire que
l'Asie ne finance rien ». Sujet d'honnêteté centrale. Conception
seulement, rien n'est commencé.*

## 1. Le problème, précisément

Nos chiffres mélangent trois régimes de couverture que rien ne
distingue à l'écran au moment décisif :

- **Bailleurs domestiques chargés, partiellement** : États-Unis — NIH
  et NSF, deux agences parmi d'autres (ni DoD, ni DoE, ni NASA) ;
- **Programmes-cadres seulement** : l'Europe via CORDIS — les
  financements de l'UE, PAS les agences nationales (ni DFG, ni UKRI
  encore, et l'ANR est sortie) — « Europe complète » est donc
  lui-même un raccourci à ne plus jamais écrire ;
- **Participations seulement** : le Japon, le Brésil, l'Australie…
  n'existent chez nous QUE lorsqu'ils participent à un consortium
  européen. Leur budget domestique est invisible — pas nul.

Le danger n'est pas le mensonge (chaque chiffre est vrai) : c'est la
**lecture d'absence comme zéro**. Les notes de couverture existent
(globe, pied de page, fiches) mais vivent LOIN des comparaisons.

## 2. Le socle : un registre de couverture, dérivé, jamais rédigé

Une vérité unique, calculée — pas une prose à maintenir :

```
classe(pays) =
  "funders"        si ≥1 bailleur chargé finance en propre ce pays
                   (US → nih+nsf ; membres/associés → ec)
  "participations" sinon, si le pays porte ≥1 participation
  "none"           sinon
```

La table `funders` sait déjà qui est chargé ; l'appariement
bailleur→pays couverts est la seule donnée à poser (petite, versionnée
dans le référentiel comme les régions : `ec → membres + associés`,
`nih/nsf → US`). Le registre s'expose partout où le pays passe :
`/api/countries` gagne `coverage`, les réponses d'agrégats gagnent
`meta.coverage_mix` (les classes présentes dans la vue) — UNE source,
toutes les surfaces.

## 3. Les surfaces — trois gestes, pas un de plus

**G1 · La phrase automatique aux comparaisons** (le cœur). Dès qu'une
vue comparative mélange des classes — Explorateur `by=country` ou
`by=region`, benchmark, carte monde en légende — une ligne sobre se
compose depuis le registre, dans la grammaire des légendes existantes :

> Couvertures inégales — États-Unis : NIH + NSF seulement · Europe :
> programmes-cadres de l'UE · Asie-Pacifique : participations aux
> consortiums européens seulement.

Générée, jamais rédigée à la main ; absente quand la vue est homogène
(une comparaison intra-européenne n'a rien à confesser). C'est la
généralisation de la proposition P-D de
[parcours-mondial.md](parcours-mondial.md), étendue des natures de
montants aux périmètres de couverture.

**G2 · La classe au point de contact du pays.** Tooltip des cartes,
panneau du globe, fiche pays : une ligne de classe, toujours présente —
« Couverture : participations aux programmes européens seulement »
sur le Japon ; « NIH + NSF — deux agences fédérales » sur les
États-Unis. Coût d'écran quasi nul (une ligne dans des surfaces qui
existent), et c'est là que « l'Asie ne finance rien » meurt : le
panneau du Japon dit pourquoi son chiffre est petit.

**G3 · Les totaux globaux disent leur assiette.** Le hero et les
compteurs de preuve gagnent leur complément : « sur 4 sources
officielles » (lié à /about-data), et le libellé des grands totaux
passe de « financements publics cartographiés » à « financements
publics cartographiés — sources chargées » là où l'espace le permet.
Micro-changement, grande différence de contrat de lecture.

## 4. Ce que je propose d'ÉCARTER, et pourquoi

- **Les hachures ou teintes cartographiques « non couvert »** : une
  troisième variable visuelle sur des cartes qui en portent déjà deux
  (teinte de région × intensité LOG) — bruit, risque CVD, et le grief
  réel n'est pas cartographique : un pays à participations A des
  données vraies, sa teinte est légitime ; c'est sa LECTURE qui doit
  être cadrée (G2). Le gris reste réservé à `none`, la légende le dit
  déjà.
- **Un badge par série sur chaque graphique** : à quatre séries ça
  devient une rangée de pastilles à décoder — la phrase composée (G1)
  dit mieux, en une ligne, sans glyphe à apprendre.
- **Pondérer ou « corriger » les chiffres** : jamais. On dit
  l'assiette, on ne fabrique pas d'estimation.

## 5. Lots et coût (~1 semaine)

| Lot | Contenu | Coût |
|---|---|---|
| C1 | Registre dérivé (référentiel bailleur→pays, classe par pays, API countries + meta des agrégats), tests | ~1 j |
| C2 | G2 : tooltip cartes, panneau globe, fiche pays | ~1 j |
| C3 | G1 : la phrase automatique — Explorateur, benchmark, légende carte monde ; e2e « le Japon dit sa classe, la comparaison mixte confesse » | ~1,5-2 j |
| C4 | G3 : hero + compteurs, passe des libellés « complet/entier » restants | ~0,5 j |

**Recette transverse** (la seule qui compte) : trois écrans — le globe
sur le Japon, un Explorateur Europe-vs-US-vs-Asie, le hero — montrés à
quelqu'un qui ne connaît pas Orion, avec la question « d'après cet
écran, l'Asie finance-t-elle la R&D ? ». La bonne réponse doit être
« on ne sait pas, Orion ne la couvre pas encore » — pas « non ».

## 6. Lien avec le reste

Le registre C1 sert aussi : la règle de dignité du sélecteur de scope
(parcours-mondial P-B — « une région s'ouvre quand un bailleur
domestique est chargé »), la FAQ du chantier hygiène (lot D — la
réponse « d'où viennent les données » cite les mêmes classes), et
chaque future source chargée (UKRI demain) met à jour TOUTES les
surfaces en changeant une ligne du référentiel.
