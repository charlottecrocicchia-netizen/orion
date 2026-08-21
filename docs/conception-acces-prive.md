# Conception — L'accès privé : Orion derrière une landing publique

> **Décision fondatrice du 2026-08-22.** Elle RENVERSE la décision D4
> du chantier workspace (2026-08-20, « le produit public ne recule
> pas ») : au lendemain de la mise en ligne, la fondatrice constate que
> tout visiteur accède à toutes les données et tranche autrement —
> **Orion est une application privée**. Les données ne sont pas un site
> vitrine : elles sont le produit, et le produit se donne sur
> invitation. Ce document est la spécification de la frontière ;
> l'authentification elle-même (lien magique, sessions, allowlist) reste
> celle du lot 1 workspace, inchangée et réutilisée telle quelle.

## La frontière, en une phrase

**Tout ce qui montre des données exige une session ; la landing raconte
le produit sans le donner.** Deux mécanismes, un par couche — jamais de
protections dispersées :

- **Serveur (la vraie sécurité)** : UN middleware, fermé par défaut —
  toute route `/api/*` répond `401 {NOT_AUTHENTICATED}` sans session
  valide, sauf la liste publique nommée. Une route ajoutée demain naît
  privée sans qu'on y pense. La 401 est identique pour une route
  inexistante : un anonyme n'apprend même pas ce qui existe (la doc
  OpenAPI comprise).
- **Front (le confort, pas la sécurité)** : UN garde de route
  (`RequireAuth`), parent de TOUTES les vues applicatives — motif
  inconnu `*` inclus. Il conserve l'URL demandée : après connexion, on
  revient exactement là où on allait (le stockage traverse les onglets
  — le lien magique s'ouvre souvent ailleurs).

## La liste publique — chaque entrée a sa raison

| Surface | Pourquoi public |
| --- | --- |
| `/` | la landing : identité, promesse, lentilles présentées, chiffres généraux, « Se connecter ». L'accès est sur invitation et la page le dit. |
| `/login`, `/login/verify` | on ne peut pas exiger une session pour en créer une |
| `/api/health` | la supervision n'a pas de compte |
| `/api/auth/*` | le mécanisme d'entrée (déjà anti-énumération par conception) |
| `/api/public/overview` | LE seul endpoint public de données : totaux du corpus + carte de visite des lentilles (slug, version, cœur/habilitant). Rien qui se fouille, rien qui se liste, rien qui se suit. |

Tout le reste — recherche, explore, fiches, comparateur, news, sources,
stats, dossiers, Lens Room — est derrière la porte. **Lens Room :
option B** (privée) : la frontière reste bête et lisible, la landing
présente les lentilles elle-même. Vérifié à l'inventaire : aucun export
CSV, aucune URL de téléchargement, pas de GraphQL, pas de données
préchargées dans le HTML, pas de route de debug.

## Le header à deux états

- **Anonyme** : la marque, les réglages (langue, thème), « Se
  connecter ». Ni intentions, ni recherche ⌘K, ni compteur de dossier —
  le header ne promet pas une application qu'on n'a pas. Pied de page
  réduit à la marque.
- **Connecté** : le header applicatif intégral, inchangé — initiale,
  menu (mon espace, se déconnecter).

## Ce que le pivot emporte, dit honnêtement

- La doctrine URL se REFORMULE : « deux personnes sur la même URL
  voient la même chose » devient « deux personnes CONNECTÉES … ». Le
  reste de la doctrine (l'URL est l'état, aucune vue ne dépend de qui
  regarde parmi les connectés) est inchangé.
- Le référencement public du produit et la démo sans compte
  disparaissent — assumé : une démo se fait connectée.
- La recette « l'anonyme voit tout pareil » du lot 1 workspace devient
  « l'anonyme ne voit RIEN que la landing » — les specs e2e ont pivoté
  avec (suite entière connectée via une session de harnais ;
  `accounts.spec` reste anonyme pour tester la frontière elle-même).

## La landing (refonte DA du 2026-08-22, retour fondatrice)

La première landing était « propre mais générique » — refusée : **ne
pas redessiner Orion, réutiliser Orion**. La v2 est une composition de
primitives existantes, zéro nouveau langage visuel :

| Acte | Primitive réutilisée |
| --- | --- |
| Hero | `StatHero` (grand chiffre dégradé, compteurs, constellation des années, reduced-motion natif), CTA au traitement de la home |
| Rupture encre | la tuile `dark bg-surface` de la home + `EditorialEntry` (exporté de la home, pas copié) — Discover / Analyse / Build → login |
| Lentilles | les verres de la Lens Room, EXTRAITS en composant partagé (`lens-shelf.tsx` : tokens de la salle, dérive, glyphes, fond constellé) — la salle et la landing rendent le même objet |
| Globe | `WorldGlobe` en mode `preview` (nouveau prop) : couverture sans AUCUN montant |
| Sources | filets fins, typo sobre |

Données : le payload public `overview` s'est étendu de deux champs
délibérés — `funding_by_year` (série annuelle agrégée, la courbe du
hero) et `coverage` (code, nom, région des pays couverts, la teinte du
globe). Toujours aucun montant par pays, par organisation ou par
projet. La section lentilles reste sombre dans les deux thèmes — la
rupture fait partie de l'identité (critère : textes masqués, la page
reste reconnaissable comme Orion).

## Ce qu'on ne construit pas

- **Pas d'inscription publique** : la porte par emails approuvés du
  lot 1 reste la seule entrée ; « Demander un accès » est une phrase
  sobre, pas un formulaire (une redirection `contact@lensorion.com` →
  Gmail, gratuite chez OVH, pourra la compléter — geste fondatrice).
- **Pas de rôles de lecture** partiels, pas de « mode aperçu » des
  données : dedans ou dehors.
- **Pas de pages légales** au lot (aucun cookie tiers, aucun tracking ;
  le seul cookie est la session — à revisiter avec les premiers comptes
  tiers).

## Recette (exécutée le 2026-08-22, consignée au commit)

Anonyme : `/` sert la landing ; chaque vue applicative redirige vers
`/login?from=…` ; l'API répond 401 partout (fiches, recherche, stats,
sources, route inconnue) ; santé et overview répondent. Connecté :
tout Orion fonctionne, tests 196 backend / 60 front / e2e complets.
Deep link : URL profonde → login → retour exact. Déconnexion : Back et
URL directe ne rouvrent rien, l'API refuse à nouveau.
