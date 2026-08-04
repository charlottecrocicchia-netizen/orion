# Curation des groupes — mécanisme, diagnostic, fournée 1

*2026-08-04 — réponse à la recette fondatrice : « Safran affiche 4 entités
et 27,4 M€ ; un utilisateur qui connaît Safran conclura que le site est
faux. » La curation prévue « en continu » devient prioritaire.*

## 1. Le mécanisme retenu : un fichier versionné, pas d'interface

**`backend/curation/groups.csv`** — une ligne = un fait humain
(rattachement ou refus), toujours avec son évidence et sa source. Le
chargeur (`orion.ingest.groups.curation`, testé) est TOUT OU RIEN : une
ligne fausse et rien ne se charge. Les adhésions portent
`method='curation'` ; le rebuild automatique gleif/wikidata ne les touche
jamais. Les REFUS alimentent une table dédiée qui fait taire le radar des
homonymes : un faux positif arbitré (Dana-Farber) cesse d'être compté
comme un trou.

Pourquoi pas d'interface : le volume est celui d'une revue humaine
(quelques centaines de lignes par fournée), le git diff EST le journal
d'audit, la revue de PR EST l'interface de validation, et le fichier se
recharge à l'identique sur toute machine (`make identity` en dev,
`make prod-ingest SOURCES="groups"` en prod). Une interface se justifiera
quand la curation deviendra quotidienne — pas avant.

Format et règles : [backend/curation/README.md](../backend/curation/README.md).
Coentreprises pondérées (`is_jv` + `share` — un 67/33 reste un 67/33) et
fenêtres de validité (`valid_from`/`valid_to` — une filiale cédée garde
son histoire sans mentir sur le présent) sont dans le format.

## 2. Le diagnostic chiffré — le trou se mesure

Script versionné : `backend/scripts/diagnose_group_gaps.py` (le radar se
relance après chaque rebuild identité). Snapshot complet du jour :
[curation-diagnostic-2026-08-04.md](curation-diagnostic-2026-08-04.md).

**Corpus : 1 412 groupes · 18,82 Md€ rattachés · trou homonyme total
4,77 Md€ (20 % du périmètre potentiel).** Les cas de tête :

| Groupe | Rattaché | Homonymes hors périmètre | Leur poids | Trou |
|---|---:|---:|---:|---:|
| SAFRAN | 27,4 M€ | 33 | 495,8 M€ | **95 %** |
| AIRBUS SE | 486,7 M€ | 22 | 469,5 M€ | 49 % |
| THALES | 436,3 M€ | 34 | 166,4 M€ | 28 % |
| RISE (SE) | 0 | 2 | 184,4 M€ | 100 % |
| GENERAL ELECTRIC | 16,3 M€ | 6 | 112,7 M€ | 87 % |
| TELEFONICA | 4,9 M€ | 7 | 112,6 M€ | 96 % |
| NORTHROP GRUMMAN | 20,1 M€ | 2 | 80,3 M€ | 80 % |
| Nokia Oyj | 57,0 M€ | 19 | 63,9 M€ | 53 % |

Deux enseignements de la mesure elle-même :

- **La clé du radar devait replier les formes légales de tête** («
  AIRBUS SE », « Siemens Aktiengesellschaft ») que le pont ne replie
  pas : sans cela, Airbus affichait ZÉRO homonyme pendant qu'AIRBUS
  OPERATIONS GMBH attendait dehors. Corrigé dans le radar SEULEMENT — 
  élargir la clé du PONT changerait les adhésions automatiques, c'est
  une décision d'identité à part (§4).
- **Le faux positif est réel et pèse lourd** : Dana-Farber Cancer
  Institute (1,73 Md€ de NIH) porte le nom du philanthrope Charles A.
  Dana, pas celui de l'équipementier Dana Inc. C'est LA démonstration
  que le rattachement automatique par nom serait une faute — la
  validation humaine n'est pas un luxe, c'est la barrière.

> **2026-08-04, soir — fournée 1 VALIDÉE et chargée** (décision
> fondatrice, pivot spatial) avec les verdicts des six décisions du §4,
> les JV spatiales sourcées du rapport externe (ArianeGroup, Thales
> Alenia Space ×8, Telespazio ×7, ATR, MaiaSpace, Sodern, OHB, Beyond
> Gravity) et l'opération Airbus·Leonardo·Thales en statut « announced »
> — listée, jamais consolidée. Le format a gagné la colonne `status`
> (active/announced/historical). Le fichier vivant :
> [backend/curation/groups.csv](../backend/curation/groups.csv) — 399
> lignes. Hors modèle, documentés : e-GEOS (80 % Telespazio / 20 % ASI —
> parents non têtes), Europropulsion, Regulus, Spaceopal, CFM, ULA
> (absents du corpus), OHB Austria (à vérifier).

## 3. La fournée 1 — historique de la proposition

**[curation-fournee-1.csv](curation-fournee-1.csv) : 318 propositions —
290 rattachements, 28 refus — sur 26 groupes.** Le fichier est au format
exact du chargeur : validé, il se déplace tel quel (en tout ou par
lignes) vers `backend/curation/groups.csv`.

Règles d'évidence appliquées :

- **0.95** : la dénomination porte le nom du groupe + division, et la
  structure est publiquement documentée (Safran ×33, Airbus ×22,
  Telefónica, Acciona, Carl Zeiss, ArcelorMittal, Enel, Valeo…) ;
- **0.9 / 0.85** : dénomination claire mais entité moins documentée, ou
  dénomination historique (ABB of Asea Brown Boveri, ex-NSN Israël) ;
- **JV pondérées** : les 4 entités Thales Alenia Space proposées en
  DOUBLE appartenance — Thales 67 % ET Leonardo 33 % — comme le cahier
  des charges l'exige ;
- **refus documentés** : Dana-Farber ×2, la Thales-Akademie (philosophie,
  pas défense), la galaxie « Orange County » (comté californien, pas
  télécoms français), Siemens Stiftung (fondation non consolidée), les
  ICON sans lien avec le CRO irlandais.

Ce que la fournée NE contient PAS (délibérément) : tout ce qui exige un
arbitrage ou une fenêtre de validité — listé au §4.

## 4. Les décisions qui t'appartiennent

1. **Gemalto → Thales.** THALES COMMUNICATION & SECURITE (5,6 M€) et
   THALES DIS FINLAND sont rattachées au groupe « Gemalto Holding
   B.V. » ; or Gemalto appartient à Thales depuis 2019. Options : les
   rattacher AUSSI à THALES (double appartenance), ou re-têter le groupe
   Gemalto sous Thales. Ma recommandation : double appartenance en
   curation (simple, honnête), re-têtage en vague 2.
2. **Siemens Gamesa & Siemens Energy.** Siemens Energy AG est cotée à
   part depuis 2020 ; Gamesa lui appartient (100 % depuis 2023, 67 %
   avant). Proposition : Gamesa ×3 → Siemens Energy AG avec fenêtres,
   jamais vers Siemens AG. À trancher avec les fenêtres.
3. **Les cessions à fenêtres.** Alstom Power/Grid/Hydro/Renewable
   (cédées à GE en 2015), Siemens Audiologische (cédée en 2015), GE
   Healthcare España (scindée en 2023) : rattachements exacts pour les
   projets d'AVANT la cession — `valid_from`/`valid_to` sont prêts, mais
   chaque fenêtre demande sa date vérifiée. Fournée 2 dédiée ?
4. **« United Nations »** (29 homonymes, 158 M€) : UNESCO, UNU, UNHCR…
   sont un SYSTÈME, pas un groupe consolidé. Rattacher donnerait un
   « groupe ONU » massif — utile ou trompeur ? Ma recommandation :
   refuser le groupe (le supprimer du référentiel) et laisser les
   agences vivre comme organisations.
5. **La clé du pont.** Ajouter `se`/`aktiengesellschaft` aux formes
   repliées par `normalize_name` rendrait des ponts automatiques
   aujourd'hui refusés (et donc des adhésions GLEIF non curées). Gain
   réel, risque réel (nouvelles ambiguïtés) : à décider hors curation.
6. **Les « à vérifier » restants** : DANA SRL (IT), Leonardo
   Innovations Inc. (US) et Leonardo Engineering and Research SRL (IT),
   Nokia Bell Labs (US, 0 €). Peu de poids, aucune urgence.

## 5. Après ta validation

```
# les lignes validées rejoignent backend/curation/groups.csv puis :
make identity                          # dev
make prod-ingest SOURCES="groups"      # prod
```

Le radar (`diagnose_group_gaps.py`) se relance après chargement : le
trou restant se mesure, fournée après fournée. La note d'honnêteté des
fiches groupe (« N organisations homonymes pas encore rattachées »)
suit automatiquement — même définition, même module.
