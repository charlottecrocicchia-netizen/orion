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

---

## Livré (ne plus y toucher, y référer)

- **2026-08-21 — Déploiement lot 1** : Orion en production publique
  sur `https://lensorion.com`, base migrée et vérifiée au chiffre
  près, sauvegardes prouvées par restauration d'essai, runbook de
  redéploiement. → `docs/conception-deploiement.md`
