# Pièges de Vega — ce qu'on ne reproduira pas

**Statut : v1** (2026-08-02). Sources : leçons du prompt fondateur (BRIEF.md §1-§3),
vision & personas (architecture-information.md §9). **La section 4 est réservée
au document de leçons UX de la fondatrice** — sa grille de lecture est prête,
le doc sera intégré dès réception.

Règle d'or inchangée : les leçons de Vega se lisent, son code jamais.

## 1. Ce qui n'allait pas (documenté) — et la règle Orion

| # | Le piège vécu sur Vega | La règle pour Orion | Où elle vit déjà |
|---|---|---|---|
| V1 | **Monolithe** : un `server.py` de ~26 500 lignes | Modulaire dès le premier commit ; fichiers courts, responsabilités nettes | ingestion / api / search / frontend séparés depuis la phase 0 |
| V2 | **Base non reproductible** : SQLite 2,3 Go hors repo, transmise à la main, corruption WAL | La base n'est jamais précieuse : `make ingest` reconstruit tout depuis les sources publiques | pipelines idempotents, journal d'ingestion, seed e2e |
| V3 | **Déploiement pénible** : `dist/` commité, bundles de 913 Mo, jamais hébergé | Déployable dès le jour 1, artefacts hors repo, CI qui build/teste | Docker + Caddy + GHCR + CI verte exigée |
| V4 | **Aucune authentification** | Comptes/organisations pensés dans le schéma dès le début, activés en P6 | à honorer au schéma dès la vague 1 des sources |
| V5 | **Mises à jour manuelles** | Ingestion planifiée, logs, fraîcheur visible | scheduler hebdomadaire + à-propos des données |

## 2. Les pièges implicites — lus entre les lignes du brief

Ceux-là ne sont pas numérotés dans le brief, mais tout le cahier des charges
est écrit contre eux :

- **Le prototype qui n'engage à rien.** Vega est resté un outil interne : pas
  de client, pas de compte, pas de prix. → Orion se juge à la « définition du
  succès » du brief : démontrable à un prospect *sans rien lancer en local*.
  Chaque phase se termine démo-prête, déployée, testée.
- **La donnée brute jetée à l'écran.** Le différenciateur d'Orion est
  *l'intelligence* du financé — pas l'accès aux données (elles sont publiques).
  → Une page qui liste sans hiérarchiser, compter, comparer ou tendre n'a pas
  sa place ; c'est la doctrine des listes (rangs, tendances, tabular) et des
  « Analyses prêtes ».
- **Le design en dernier.** Le brief exige un produit « nettement plus beau
  que les outils du marché » — la leçon en creux d'un prototype où le design
  n'était pas le sujet. → La doctrine de design est une référence canonique,
  pas un vernis final ; la checklist des 10 pièges est un critère de recette.
- **L'écran pour personne.** Vega servait sa créatrice ; un produit sert des
  personas. → Règle §9 : chaque écran nomme le persona qu'il sert d'abord —
  « un écran qui ne sert clairement aucun des trois n'est pas construit ».

## 3. La synthèse en une phrase

Vega prouvait que la donnée existait ; Orion doit prouver qu'elle **répond à
des questions** — celles de trois personnes précises, vite, avec des sources
citées, sur un produit qu'on peut vendre.

## 4. Leçons UX de Vega — section réservée au document de la fondatrice

À intégrer dès réception. Grille de lecture préparée — les questions que le
document permettra de trancher :

1. **Navigation** : combien d'onglets/vues Vega avait-il, lesquels étaient
   réellement utilisés, lesquels étaient morts ? (→ calibrer le nombre de
   sections d'Orion et le courage de supprimer.)
2. **Visualisations** : lesquelles servaient une décision, lesquelles étaient
   du décor ? Y avait-il des formes illisibles (camemberts, dual-axis,
   rainbow) qu'on a gardées par habitude ?
3. **Parcours** : où les utilisateurs (la fondatrice incluse) se perdaient-ils ?
   Quelles questions revenaient sans écran pour y répondre ?
4. **Recherche** : qu'est-ce qui était introuvable ? La recherche couvrait-elle
   les textes, les organisations, les deux ?
5. **Confiance** : les chiffres étaient-ils sourcés ? A-t-on déjà douté d'un
   total devant un tiers ? (→ nos pills CORDIS/ANR et attributions viennent
   de là.)
6. **Rythme** : qu'est-ce qui était lent au point de casser l'usage ?
   (→ nos budgets p95 viennent de là.)

Chaque réponse deviendra une ligne du tableau §1 : piège → règle → où elle vit.
