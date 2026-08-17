# Chantier « hygiène de site » — proposition par lots

*2026-08-17 — commande fondatrice avant mise en ligne. Cadre : la
doctrine ([design-doctrine.md](design-doctrine.md)), rien de générique,
recette à chaque lot. Quatre lots : dire où l'on est, parler aux
machines et aux partages, les gestes et l'accessibilité, parler aux
humains. RIEN n'est commencé — validation lot par lot.*

---

## Lot A — dire où l'on est (① 404 · ⑤ fil d'Ariane · ⑦ liens internes) · ~3-4 jours

**① La 404 dans notre grammaire.** Pas un panneau d'excuse : une page
qui REND SERVICE. L'accroche sobre (« Cette page n'existe pas — le
corpus, si. »), la barre de recherche avec l'intelligence des
destinations (celle de ⌘K : groupes badgés, organisations, thèmes,
pays), et trois portes vivantes : l'Explorateur cadré espace, la
dernière analyse, les pays. Cas particulier honnête : une fiche
disparue après rebuild (`/groups/…` d'un id mort) propose la RECHERCHE
du nom plutôt qu'un « introuvable » sec. FR/EN.

**⑤ Le fil d'Ariane des pages profondes.** Fiches (projet,
organisation, groupe, pays, programme), benchmark, decks d'analyses :
une ligne mono discrète au-dessus du kicker — `Organisations ›
Safran` — chaque segment cliquable, le dernier en encre pleine. Les
fiches groupe/organisation ont déjà des embryons disparates : on unifie
en UN composant, même hauteur, même casse partout. Mobile : le fil se
replie au parent seul (`‹ Organisations`).

**⑦ L'audit des liens internes — un test, pas un rapport.** Un crawl
e2e versionné (Playwright) qui part de la home, suit tous les liens
internes, et ÉCHOUE si : une page rend un 404, une page n'est atteinte
par aucun chemin (orpheline — la liste des routes de App.tsx est la
référence), ou une page ne propose aucun lien sortant hors navigation
(cul-de-sac — la passe ⑥ du lot C s'en nourrit). Le crawl entre en CI :
l'hygiène se garde toute seule, comme la géométrie des cartes.

**Recette A :** casser trois URL (fiche morte, route inconnue, id
farfelu) ; parcourir fiche → fil d'Ariane → remonter ; le crawl vert en
CI avec sa liste de pages couvertes affichée.

---

## Lot B — parler aux machines et aux partages (② titres/méta · ③ og:image) · ~3 jours

**② Titres uniques et méta-descriptions, FR/EN.** Un petit hook
`usePageMeta(title, description)` posé sur chaque page : `document.title`
en « Safran — Orion Space Intelligence », méta-description par page
(les fiches disent leurs chiffres réels : « 41 entités, 579 M€ de
financements publics — trajectoire, partenaires, coentreprises »), le
tout suivant la langue. Vérité d'abord : les descriptions se composent
depuis les données de la page, jamais un gabarit vide.

**③ L'image de partage — une carte Orion.** Une carte 1200×630 dans la
doctrine : fond bleu nuit du lanceur, la constellation d'Orion en
pastilles (la même grammaire que l'icône du Bureau), « Orion Space
Intelligence » en display, la ligne « Financements et écosystèmes
industriels du spatial », et TROIS chiffres vrais du corpus (gravés au
build — datés dans le coin, comme nos exports). Générée par le pipeline
Chromium déjà en place pour l'icône, versionnée dans le dépôt, servie
en statique.

**La limite dite d'avance** (pas de mauvaise surprise en recette) :
Orion est une SPA — les robots de partage ne lisent que le HTML servi.
Ce lot livre donc UNE carte et une méta GLOBALES (dans index.html),
parfaites pour les partages de la home et honnêtes partout ; les cartes
PAR PAGE (partager la fiche Safran avec sa carte à elle) exigent du
prérendu — c'est au registre go-live, pas ici.

**Recette B :** dix pages, dix titres uniques dans l'onglet, FR puis
EN ; la carte de partage validée à l'œil (simulateurs Slack/LinkedIn)
et `curl` sur le HTML servi.

---

## Lot C — les gestes et l'accessibilité (④ alt · ⑥ CTA) · ~3 jours

**④ L'audit des textes alternatifs.** Passe systématique sur toutes
les images et SVG : les photos pays disent le pays (« Le port de
Rotterdam, Pays-Bas »), les graphiques gardent leur `aria-label` de
lecture (déjà largement en place — on VÉRIFIE et on comble), les
dessins purement décoratifs prennent `aria-hidden` assumé. Le crawl du
lot A gagne une assertion : aucune `<img>` sans `alt` explicite ne
passe la CI.

**⑥ La passe CTA — chaque page a son geste suivant.** Inventaire page
par page (le crawl donne la liste) : quelle est L'ACTION évidente
d'ici ? La fiche projet → « voir l'organisation », « ce thème dans
l'Explorateur » ; le dossier vide → la porte de l'Explorateur (déjà) ;
une recherche vide → élargir (le zéro-résultat digne de
parcours-mondial P-F entre ici) ; les placeholders P5/P6 → une porte
vivante chacun. Mobile compris : chaque CTA vérifié au viewport 375
(pas de bouton noyé sous le pli, pas de fil d'Ariane qui pousse le
titre hors écran).

**Recette C :** navigation au lecteur d'écran sur trois parcours
(recherche → fiche → dossier) ; la passe mobile en 375×812 sur les dix
pages ; la CI verte avec l'assertion alt.

---

## Lot D — parler aux humains (⑧ FAQ · ⑨ À propos) · ~2-3 jours

**⑧ La FAQ — de vraies questions, nos vraies réponses.** Six à huit,
puisées dans ce qu'on répond déjà : d'où viennent les données (CORDIS
CC BY 4.0, NIH et NSF domaine public — et pourquoi l'ANR n'y est
plus) ; à quelle fréquence (le rythme réel par source) ; comment les
montants se comparent (per-award américain vs participations
européennes — la note de méthode du registre) ; ce qu'est un groupe
chez Orion (la couche identité, les coentreprises pondérées, l'opération
annoncée jamais consolidée) ; ce que « spatial » veut dire ici (la
lentille versionnée, cœur vs adjacent) ; ce qu'Orion NE fait PAS encore
(appels d'offres et opportunités — le cahier P5 —, comptes durables,
export automatisé) ; les licences et la réutilisation. Chaque réponse
courte, datée quand il le faut, liée à la page qui fait foi.

**⑨ « À propos » — sobre.** Trois actes courts : le projet (une
fondatrice-ingénieure, la conviction : l'argent public spatial mérite
une lecture honnête) ; la méthode (sources officielles à licence
limpide, conversions datées, curation versionnée, le pont conservateur
— « un pont qui hésite n'est pas un pont ») ; l'honnêteté des données
(les notes de périmètre, ce que le site avoue ne pas savoir). Ta photo
si tu la fournis — la page tient sans. FR/EN, passe anti-« IA » comme
toujours.

**Recette D :** ta relecture des textes (c'est ta voix) ; FAQ et À
propos accessibles depuis le pied de page ; liens vérifiés par le
crawl du lot A.

---

## Ordre proposé et dépendances

**A → B → C → D.** Le crawl du lot A outille C (inventaire des pages)
et D (liens) ; les méta du lot B profitent des pages D quand elles
naissent. Total : **~2 semaines**, recette à chaque lot. Les tests
utilisateurs peuvent croiser chaque lot sans attendre le suivant.

## Au registre go-live (noté, pas maintenant)

robots.txt et sitemap ; politique de confidentialité RGPD ; analytics
PROPRE — Plausible ou Matomo, jamais Google Analytics (cohérent avec la
maison) ; les cartes de partage PAR PAGE via prérendu. Écartés ou en
attente de vrais clients : schéma « commerce local » et itinéraires ;
avis et études de cas (la preuve sociale attendra d'être vraie).
