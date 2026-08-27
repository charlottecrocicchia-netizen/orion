# Ce qui reste à faire — état au 2026-08-21, lendemain de la mise en ligne

> **Objet** : la liste courte et honnête de ce qui attend, maintenant
> qu'Orion est en production publique sur `lensorion.com` (lot 1 de
> déploiement clos, `docs/conception-deploiement.md`). Chaque entrée
> pointe vers le document qui la spécifie — ce fichier est un index,
> pas une re-spécification : quand un chantier s'ouvre, c'est son
> document de conception qui fait foi.
>
> Tenu à la main. Une entrée livrée passe en bas avec sa date, elle ne
> disparaît pas.

## 1. Le socle comptes — connexion réservée aux emails approuvés

**Où c'en est** : conception complète et validée
(`docs/conception-workspace.md` — GO du lot 1 le 2026-08-20, cinq
verrous au contrat, porte email instruite). Méthode d'authentification
arbitrée en D1 : **lien magique, sans mot de passe**.

**Nouveau, exprimé par la fondatrice le 2026-08-21** : l'accès sera
fermé par une **liste d'emails approuvés** — au démarrage, un seul :
`owner@example.com`. Un email hors liste qui demande à se
connecter reçoit strictement la même réponse qu'un email approuvé,
et rien ne part (cohérent avec la garantie anti-énumération déjà au
contrat D1). La question mot de passe vs lien magique est traitée dans
l'arbitrage D1 — si le choix doit être rouvert, c'est là, pas ici.

**Prochain geste** : exécution du lot 1 workspace, avec la liste
d'approbation ajoutée au contrat de conception avant le premier commit.

## 2. Le scheduler d'ingestion serveur — les données de prod sont figées

**Le fait** : le scheduler hebdomadaire est volontairement ÉTEINT sur
le VPS (décision D5 du déploiement) ; la prod sert la photographie du
dump du 2026-08-21 et ne bougera pas tant qu'il dort.

**Ce que le chantier doit trancher** : quand le replay tourne, les
invariants publiés changent — il faut une recette qui distingue
« la donnée a bougé parce que la source a bougé » d'une régression.
Chantier dédié, avec sa propre conception courte.

## 3. La vague 1 des sources — l'hébergement existe, la RAM non

**Où c'en est** : instruction validée (`docs/vague-1-instruction.md`),
Europe élargie (UKRI, SNSF, NWO, Vinnova) chargeable.

**Le fait nouveau** : le serveur existe (ce qui débloquait SBIR,
USAspending, OpenAIRE)… mais c'est un VPS-2 de **8 Go**, et
`docs/hebergement.md` § 5 chiffre la fin de vague 1 à 24-32 Go. La
recette de performance du déploiement (R11) est passée sur le corpus
actuel ; chaque source ajoutée la remet en jeu. **Décision à prendre
au moment du chargement** : charger l'Europe élargie et re-mesurer
R11, upgrade VPS-3/VPS-4 en un clic OVH si elle casse.

## 4. La CI — muette jusqu'au 1er septembre 2026

Quota Actions épuisé. À la reprise : remettre les guetteurs (avec
`timeout-minutes` partout — la règle), et **revoir la décision D1 du
déploiement** (build sur serveur ↔ images GHCR redevenues fiables).
Jusque-là : validation en local, déploiement par le runbook (étape 9
de `docs/conception-deploiement.md`).

## 4 bis. Les suites du pivot « accès privé » (2026-08-22)

Orion est désormais privé (`docs/conception-acces-prive.md`). Restes
assumés, à décider plus tard :

- **`/about-data`** : passée privée par défaut ; une version publique
  « méthodologie » (sources sans compteurs ni dates d'ingestion) reste
  possible sur la landing — décision fondatrice en attente.
- **`contact@lensorion.com`** : une redirection gratuite OVH vers le
  Gmail donnerait un vrai destinataire à « Demander un accès » sur la
  landing — geste fondatrice (espace client OVH → Emails →
  redirections).
- **La landing** : première version sobre livrée avec le pivot ; une
  passe design dédiée (doctrine, recette fondatrice) quand le produit
  cherchera ses premiers comptes extérieurs.

## 4 ter. ~~La recette e2e périmée~~ — RÉSOLU le 2026-08-22 : c'était le harnais

**Le diagnostic initial était FAUX, et la correction est consignée.**
Les « 23 échecs hérités » n'existaient pas : la suite e2e est conçue
pour la **base semée** (`backend/scripts/seed_e2e.py` — 16 projets, la
lentille synthétique `test-lens`, des comptes exacts), servie par
uvicorn `:8000` derrière `vite preview :4173` — la recette de la CI.
Elle avait été jouée contre la pile `:8080` au **corpus complet**, où
`test-lens` n'existe pas et où aucun compte exact ne tient. La
« baseline » qui semblait prouver l'antériorité reproduisait la même
erreur de harnais — elle ne prouvait que lui.

**Dans le bon harnais : 104/105 verts du premier coup** (3 skips
auto-déclarés du ticker, corpus semé trop petit pour faire tourner le
fil). Le seul vrai échec était un bug de harnais du pivot : le proxy
vite réécrivait `Host` (`changeOrigin` implicite du raccourci) et le
garde d'origine refusait les mutations — corrigé dans `vite.config.ts`
(le garde reste strict). Livré avec : `scripts/e2e-local.sh` (la
recette CI en local, pour que l'erreur soit irreproduisible), le
commentaire menteur de `playwright.config.ts` corrigé, l'env d'auth de
recette ajouté au FICHIER `ci.yml` (aucun run déclenché — quota muet),
et le lint `test_lenses.py:888` réglé.

## 5. Le monitoring externe — quand il y aura quelqu'un à prévenir

Décision explicite du déploiement (§ 5) : rien tant qu'il n'y a pas
d'utilisateurs. Le jour où la porte s'ouvre au-delà de la fondatrice
(point 1), un uptime check gratuit devient le minimum. À instruire
avec le chantier comptes, pas avant.

## 6. Chantiers produit déjà cadrés, en attente de leur tour

La `docs/roadmap.md` reste la source de vérité produit. En résumé au
2026-08-21 : la suite de la vague 1 (point 3), puis phase 5 (les
appels à projets) et l'horizon phase 6.

## 7. Les suites de R5A — **R5B livré, trois gestes restent**

R5B est **déployé, recetté et clos** (voir « Livré » en bas et
`docs/conception-deploiement.md` annexe E). Le mode global, EC, NIH et
GBARD restent **NO-GO** : l'étude
(`docs/conception-r5-budget-denominators.md`, § 21) n'a laissé survivre
qu'une métrique, et les conditions chiffrées d'un élargissement sont
écrites à son § 20.4 — aucune n'est remplie.

Restent trois gestes autonomes de R5A, inventoriés au § 20.3 de
l'étude, à peser séparément — **aucun n'est rouvert par la clôture de
R5B** :

- **② Vérifier que la moisson d'appels capte bien l'enveloppe** —
  *le seul qui soit urgent*. 308 des 447 sujets du portail qui
  recoupent nos projets n'ont **aucun** bloc budget. Chaque appel qui
  quitte le portail sans son enveloppe archivée referme définitivement
  la seule route côté UE qui soit comptablement propre (la cohorte d'appel).
  Vérification d'ingestion, pas source nouvelle.
- **① Conserver le profil annuel NIH** au repli — `(fy, total_cost)`
  dans `raw`, comme NSF le fait déjà. Supprime l'asymétrie entre les
  deux sources américaines ; **les 961 Mo d'archives sont déjà en cache
  local**, donc pas de re-téléchargement.
- **③ Trancher les deux réserves NIH du 2026-08-03**
  (`docs/data-sources.md`) : projets « parapluie » et projets sans
  date. R5A les a chiffrées (les parapluies pèsent de 5,9 % à 18,8 %
  des cohortes annuelles selon l'année ; 11,02 % de la valeur NIH n'a
  aucune date). Décision fondatrice en attente depuis le lot NIH.

Deux précisions de registre relevées au passage (contre-relecture du
2026-08-26, vérifiées sur pièces) : les fiches data.europa.eu des trois
datasets CORDIS ingérés déclarent « **European Commission reuse
notice** » → décision 2011/833/UE, tandis que la mention légale CORDIS
accorde le CC BY 4.0 au « editorial content » du site sans dire si les
CSV en masse en relèvent — tension non tranchée par la source, droit
commercial avec attribution garanti dans les deux régimes (§ 4.1 de
l'étude). Côté américain, le domaine public **NSF est déclaré
explicitement** (« Award data posted on the NSF website… is in the
public domain and not subject to copyright », page *Award Search
Overview*) ; c'est le **NIH seul** qui reste un constat d'absence —
RePORTER ne porte aucune déclaration de licence propre (§ 5.5 et
§ 6.4).

---

## Registre des écarts de rituel

> Les fautes de **procédure**, distinctes des bugs : un geste sauté, une
> porte franchie, un diagnostic tenu pour acquis. On les garde parce que
> la règle qui en sort vaut plus que l'incident, et parce qu'un
> déploiement réussi ne valide pas un geste fautif.

**① Le faux vert e2e (2026-08-22) — un diagnostic non vérifié.**
« 23 échecs hérités » annoncés, qui n'existaient pas : la suite avait
été jouée contre le mauvais harnais (pile `:8080` au corpus complet au
lieu de la base semée). La « baseline » qui semblait prouver
l'antériorité reproduisait la même erreur — elle ne prouvait qu'elle.
*Règle sortie* : un verdict de suite se lit au **journal complet**, dans
le **harnais officiel** (`scripts/e2e-local.sh`, écrit pour que
l'erreur soit irreproduisible) ; jamais un tail tronqué, jamais une
baseline non attribuée. Détail au § 4 ter.

**② La porte snapshot franchie au déploiement R5B (2026-08-26).**
R5B a été déployé **sans arrêt préalable** pour permettre à Charlotte de
prendre le snapshot OVH pré-déploiement. Claude a constaté qu'il n'avait
pas accès à l'espace client OVH, l'a consigné, et a poursuivi avec le
seul dump logique. **L'impossibilité d'accéder à OVH n'autorisait pas à
franchir la porte** — elle imposait de s'arrêter et de demander. Un dump
couvre les **données**, jamais la **machine** ; et consigner un écart ne
l'autorise pas. Le déploiement s'est bien passé, rien n'a été perdu :
*le résultat ne valide pas le geste*.
*Règle sortie, gravée en **D7 bis** de `docs/conception-deploiement.md`* :
**aucun déploiement de production ne franchit la porte snapshot sans
confirmation explicite de Charlotte** ; si Claude ne peut pas prendre le
snapshot lui-même, il **s'arrête et le demande** ; tant que Charlotte
n'a pas confirmé que le snapshot est pris — ou explicitement décidé
d'assumer son absence — le déploiement **attend**. Une instruction de
chantier qui semblerait permettre de poursuivre ne prime pas sur cette
règle.

---

## Livré (ne plus y toucher, y référer)

- **2026-08-26 — R5B `Share of NSF award obligations`, en production —
  CLOSED / PRODUCTION STABLE** : la seule métrique survivante de
  l'étude R5A, livrée en **métrique indépendante** hors Reference
  Engine (le sélecteur « View funding as » ne gagne aucun mode).
  Révision `8f2558e` (`GIT_REV = 8f2558eda2f4`), migration `0034`,
  millésime d'artefacts officiels `2026-08-26` (SHA256 **17/17**
  conformes), **326 313 lignes** d'obligations, **FY2012 → FY2025
  disponibles**, **FY2011 fermé** à ~94,3 % de couverture (seuil 95 %).
  Invariants sacrés inchangés. **Recette humaine PASS** (fondatrice, en
  production, sur son compte réel) ; **snapshot OVH post-R5B** pris =
  nouveau point de restauration machine ; le dump
  `orion-pre-r5b-20260826-1858.dump` reste le jalon **pré-migration**.
  Recette **mobile reportée** à la future passe responsive globale.
  Un **écart de rituel** est consigné au registre ci-dessus (② la porte
  snapshot) et la règle qui en sort est gravée en **D7 bis**.
  → `docs/conception-r5-budget-denominators.md`,
  `docs/runbook-nsf-obligations.md`, `docs/conception-deploiement.md`
  annexe E

- **2026-08-22 — Accès privé + socle comptes, en production** : Orion
  derrière une landing publique dans sa propre DA ; lien magique réel
  recetté de bout en bout par la fondatrice (Brevo → Gmail →
  connexion) ; frontière serveur fermée par défaut ; suite e2e
  102/105 dans son harnais retrouvé (`scripts/e2e-local.sh`).
  → `docs/conception-acces-prive.md`, `docs/conception-workspace.md`


- **2026-08-21 — Déploiement lot 1** : Orion en production publique
  sur `https://lensorion.com`, base migrée et vérifiée au chiffre
  près, sauvegardes prouvées par restauration d'essai, runbook de
  redéploiement. → `docs/conception-deploiement.md`
