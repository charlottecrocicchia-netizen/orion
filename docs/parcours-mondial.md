# Parcours utilisateur à l'échelle mondiale — diagnostic et propositions

*2026-08-04 — réflexion ouverte à la demande de la fondatrice, pendant la pause
chargements. Diagnostic + propositions, aucune implémentation : chaque
proposition sera croisée avec les retours des tests utilisateurs réels avant
d'être tranchée.*

Le fait nouveau : ~700 k projets, des bailleurs sur deux continents (bientôt
davantage), 193 pays participants, cinq régions manager dans l'URL, et la
couche groupes qui vient de gagner sa fiche. Le site a été conçu quand le
corpus était européen ; ses parcours supposaient tacitement un lecteur
européen cherchant dans un corpus européen. La passe de langage a corrigé les
mots ; ce document regarde les chemins.

---

## 1. Diagnostic — où les parcours craquent quand le monde entre

### 1.1 L'entrée unique par la question suppose qu'on sait déjà quoi demander

La home demande « Que cherchez-vous ? » — c'est la bonne porte pour qui
arrive avec un nom (Safran, quantique, CNRS). À 700 k projets, cette porte
récompense la connaissance préalable : acronymes, noms d'organisations,
vocabulaire des programmes. Le lecteur à intention vague (« où va l'argent de
l'hydrogène ? ») a l'Explorer — mais il faut savoir qu'il existe. Les quatre
intentions de la barre (Découvrir, Analyser, Construire, Espace) rangent bien
le site ; aucune ne répond à « par où commencer selon d'où je regarde ».

**Le manque n'est pas une page, c'est un geste d'orientation géographique
au premier écran.**

### 1.2 La géographie est une dimension première, pas encore un axe de parcours

Le chantier régions a livré la mécanique complète : cinq scopes dans l'URL,
cartes pré-projetées par région, agrégats `/api/regions`. Mais le sélecteur
reste masqué (règle du 2026-08-02 : un sélecteur à une option ne dit rien —
règle posée quand il n'y avait qu'une zone), et aucun chemin visible ne mène
de « je m'intéresse à l'Asie-Pacifique » vers la carte cadrée Asie-Pacifique.
Le scope est une mécanique livrée, pas encore un parcours offert.

### 1.3 L'asymétrie des sources piège les comparaisons au moment précis où elles deviennent possibles

C'est LA conséquence de la mondialisation du corpus. Les montants américains
(NIH par année budgétaire, NSF en obligé) et les participations européennes
(parts par organisation dans des consortiums) ne sont pas de même nature.
Comparer « France vs États-Unis » est désormais à deux clics — et le site dit
ses sources dans les fiches et le pied de page, mais **au moment où le
lecteur compose la comparaison, rien ne lui dit la nature de chaque
montant**. Le risque n'est pas le mensonge (les chiffres sont vrais), c'est
la lecture naïve d'une comparaison hétérogène.

### 1.4 Les groupes ouvrent un parcours « entreprise d'abord » qui n'a pas de porte

Taper « Safran » fait désormais ressortir le groupe en tête, badge au revers
— pour qui connaît Safran. Le parcours inverse (« quels groupes pèsent le
plus ? qui sont les cinquante premiers ? ») n'a aucune page : la couche
identité se voit dans la recherche, pas dans un index. Les autres entités du
site (pays, programmes, thèmes, organisations) ont toutes leur index.

### 1.5 Le poids inégal des régions menace la dignité des pages

Aujourd'hui trois régions sur cinq sont quasi vides (participations CORDIS
éparses ; aucun bailleur domestique avant la suite des chargements). Tout
parcours « par région » offert trop tôt mène à des pages indigentes pour
l'Amérique latine ou MEA — exactement le genre de creux que la doctrine
interdit. Le globe gère déjà cette honnêteté (teinte région + « pas encore
de donnée ») ; les parcours doivent hériter de la même règle.

### 1.6 La langue des résultats, à nommer sans le résoudre

L'interface est bilingue FR/EN ; les titres du corpus arrivent dans toutes
les langues d'Europe (et en anglais pour les États-Unis). Un lecteur non
européen en interface EN lit des listes mêlées. Ce n'est ni un bug ni un
chantier d'aujourd'hui (la traduction automatique des titres est exclue —
elle fabriquerait du texte que la source n'a pas signé) ; c'est une réalité
à connaître quand on lira les tests utilisateurs : une partie du « bruit »
perçu viendra de là.

---

## 2. Propositions — à trancher après les tests utilisateurs

Aucune n'est commencée. Coût relatif indiqué (S/M/L). L'ordre ci-dessous est
un ordre de conviction, pas un séquencement.

### P-A · La home offre le geste régional sous le globe — coût S

Le globe colore déjà le monde par région. Proposition : la légende des cinq
régions devient cliquable et mène à la carte cadrée correspondante
(`/explore/countries?scope=…` — mécanique déjà livrée, il ne manque que le
geste). Le premier écran répondrait alors aux deux postures : « je cherche un
nom » (la question) et « je regarde d'où je viens » (le globe qui s'ouvre).
S'appuie sur l'existant, n'ajoute aucune page.

### P-B · Le sélecteur de scope sort de sa cachette, sous condition de dignité — coût S

La règle historique (« un sélecteur à une option ne dit rien ») était vraie à
une zone ; elle mérite sa mise à jour : **un sélecteur s'ouvre quand au moins
deux de ses choix portent une lecture digne**. Reste à définir le seuil de
dignité (en première intention : une région est « digne » quand elle porte un
bailleur domestique chargé, pas seulement des participations). Aujourd'hui
cela ouvrirait Europe + Amérique du Nord ; les trois autres suivraient leurs
chargements. Le sélecteur dirait l'attente honnêtement (« Asie-Pacifique —
en construction »).

### P-C · L'index des groupes — la porte « entreprise d'abord » — coût M

`/groups` : les groupes classés par financement consolidé, même grammaire que
les autres index (compte d'entités, pays du siège, part des co-signatures).
Complète le parcours 1.4 : la palette sait y aller, l'index donnerait le
panorama. Dépend d'une décision produit : l'index expose-t-il TOUS les
groupes GLEIF présents ou seulement ceux au-dessus d'un seuil de
financement ? (Recommandation : seuil, pour que la première page dise
quelque chose.)

### P-D · La note de méthode au point de comparaison — coût S/M

Quand une vue croise des montants de natures différentes (per-award US vs
participations EU — détectable : les sources des séries comparées), une
ligne discrète sous la vue dit la nature de chaque montant, comme la légende
dit déjà les buckets. Extension directe de la passe « le site dit vrai » :
la vérité au moment du geste, pas dans une page méthodologie que personne ne
lit. À dessiner sobrement (une ligne, pas un avertissement anxiogène).

### P-E · L'atterrissage régional comme composition, pas comme page — coût M, gated données

À terme, `/regions/:slug` comme lecture pré-assemblée de l'existant (carte
cadrée + premiers pays + premiers thèmes + bailleurs de la région), dans la
grammaire des fiches en actes. À ne construire QUE région par région, quand
la règle de dignité de P-B s'allume. Pas de page continent creuse « pour
faire complet ».

### P-F · Le zéro-résultat digne à l'échelle du monde — coût S

À 700 k projets et cinq régions, le zéro-résultat devient un carrefour : la
recherche qui échoue devrait proposer les gestes d'élargissement (enlever le
filtre pays ? passer au scope monde ? chercher dans l'autre langue ?) plutôt
qu'un vide poli. Petit, mais c'est le moment où un utilisateur perdu décide
de rester ou de partir.

---

## 3. Ce qu'on ne fait pas

- **Pas de portail par persona** (« décideur », « chercheur », « analyste ») :
  les intentions de la barre suffisent, les personas fabriquent des couloirs.
- **Pas de traduction automatique des titres du corpus** : on ne signe pas à
  la place des sources.
- **Pas de sélecteur de pays à 249 entrées** dans l'en-tête : la géographie
  se navigue par la carte et les régions, pas par une liste déroulante.
- **Pas de « mode région » persistant** qui filtrerait tout le site à l'insu
  du lecteur : le scope vit dans l'URL, visible et partageable, jamais dans
  un cookie silencieux.

---

## 4. Méthode de tranchage

Chaque proposition sera confrontée aux retours des tests utilisateurs en
cours : si les testeurs butent sur l'orientation initiale → P-A/P-B montent ;
s'ils comparent naïvement US/Europe → P-D devient prioritaire ; s'ils
demandent « qui sont les gros ? » → P-C. Les propositions ne sont pas un
plan : ce sont les réponses préparées aux frictions les plus probables, pour
décider vite quand les frictions réelles parleront.
