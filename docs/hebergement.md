# Hébergement d'Orion — dossier de décision

> **Objet** : dire exactement où en est Orion sur la machine actuelle, ce
> qu'elle peut encore encaisser, ce qu'il faut pour la fin de la vague 1,
> et ce que coûte chaque option. Écrit pour être lu par la fondatrice et,
> le cas échéant, par un partenaire.
>
> **Prix relevés le 2026-08-04** sur les pages publiques des
> fournisseurs, hors taxes sauf mention. Ils changent ; ils sont datés
> pour cette raison.

## 1. La machine d'aujourd'hui, mesurée

**MacBook Pro M1, 8 Go de RAM, 8 cœurs.** C'est la seule machine du
projet : elle sert au développement, à la recette et au chargement des
sources.

Le corpus qu'elle porte au 2026-08-04 :

| | |
| --- | --- |
| Projets | 699 798 |
| Organisations | 110 117 |
| Participations | 1 102 259 |
| Textes indexés | 676 016 |
| Base PostgreSQL | **5,7 Go** |
| dont matière chaude (textes + index de recherche) | **1,3 Go** |
| dont table des projets | 731 Mo |

### Ce qui a été découvert le 2026-08-04

La machine tournait avec **une VM Docker de 8 Go sur 8 Go de RAM
physique**. Conséquence mesurée : **11,3 Go de swap macOS utilisés sur
12,3**, 94 Mo de pages libres. Les « 4 Go de cache PostgreSQL » n'ont
jamais existé en mémoire réelle — ils étaient eux-mêmes paginés sur
disque. Une part importante des latences attribuées au corpus était de
la **double pagination**, pas de la lecture de données.

C'est le genre d'erreur qui fausse tout diagnostic tant qu'on ne la
voit pas. Elle est corrigée.

## 2. La configuration de survie, appliquée

| Réglage | Avant | Après | Pourquoi |
| --- | --- | --- | --- |
| Mémoire de la VM Docker | 8 Go | **4 Go** | macOS a besoin de ~4 Go pour lui, Firefox et l'app Claude (~1,1 Go à elle seule) |
| `shared_buffers` PostgreSQL | 4 Go | **1,5 Go** | ~40 % d'une VM dédiée à la base ; de la mémoire réelle vaut mieux qu'un cache nominal |
| `effective_cache_size` | 6 Go | **3 Go** | dire la vérité au planificateur |
| `work_mem` | 64 Mo | **16 Mo** | multiplié par les workers parallèles ; c'est lui qui avait fait déborder `/dev/shm` |
| `/dev/shm` du conteneur | 1 Go | **256 Mo** | un tmpfs d'1 Go consomme de la mémoire de VM |
| Piles simultanées | dev **et** prod | **une seule** | deux PostgreSQL sur une machine de 8 Go ; `make up` arrête la dev, `make db-up` arrête la prod |
| Ordonnanceur hebdomadaire | actif en local | **derrière un profil** | il réingérait tout le corpus un lundi à 3 h du matin sur un portable |
| Copie dev du corpus | 6,9 Go | **supprimée** | redondante avec la prod ; les tests n'utilisent que `orion_test` |
| Préchauffage du cache | aucun | **`pg_prewarm` en fin de chaîne** | supprime la falaise du premier visiteur (37 s → 6 s) |

**Ces réglages sont pilotés par `.env`** (`ORION_PG_SHARED_BUFFERS`,
`ORION_PG_EFFECTIVE_CACHE`, `ORION_PG_WORK_MEM`,
`ORION_PG_MAINTENANCE_MEM`) : le jour de l'hébergement, on change quatre
lignes, pas le code.

### Gestes qui gagnent du temps réel pendant un chargement

- **Fermer Firefox et l'app Claude** pendant une ingestion : ~2 Go
  rendus à la VM, soit la différence entre un chargement qui pagine et
  un chargement qui ne pagine pas.
- **Ne jamais lancer les tests pendant un chargement** : `make db-up`
  arrête maintenant la prod, ce qui l'interromprait.
- **`make prod-ingest SOURCES="…"`** charge dans la pile de prod sans
  démarrer une seconde base.

### Geste annuel — les indices de prix (lot A, euros constants)

`orion-ingest prices` recharge le HICP Eurostat et le CPI-U BLS dans
`price_indices` — quelques centaines de lignes, quelques secondes,
**aucun scheduler** : c'est un geste manuel, à faire une fois par an
(début d'année, quand les moyennes annuelles de l'année écoulée sont
publiées) et avant toute bascule d'année de référence
(`ORION_CONSTANT_EURO_REFERENCE_YEAR`). Le chargeur est idempotent :
il n'écrit une **nouvelle vintage** que si les valeurs officielles ont
changé, et refuse une couverture trouée — en cas d'échec source, la
vintage courante reste en service et le mode real (valeur réelle)
continue de fonctionner sur elle.

## 3. Ce qu'on peut en attendre — honnêtement

Mesuré après recalibrage, corpus de 699 798 projets, pile chaude et
index de recherche préchauffé (trois appels consécutifs, le dernier
retenu) :

| Parcours | Temps constaté | Verdict |
| --- | --- | --- |
| Une du site / actualités | **4 ms** | excellent |
| Carte du monde / index des pays | **6 ms** | excellent |
| Partenaires d'une organisation | **7 ms** | excellent |
| Fiche organisation | **25 ms** | excellent |
| Recherche, terme rare (« hydrogen », 7 298 résultats) | **126 ms** | excellent |
| Filtre pays = France (44 123 participations) | **2,0 s** | acceptable |
| Recherche, terme courant (« cancer », 77 378 résultats) | **3,5 s** | limite |
| Filtre pays = États-Unis (626 086 participations) | **4,0 s** | limite |
| **Le même, à froid** (premier appel après démarrage) | **15 à 31 s** | inacceptable |

**Le préchauffage compte, et sa taille aussi.** Précharger l'index de
recherche (418 Mo) accélère nettement ; précharger en plus les textes et
les projets (3 Go au total) **dégrade**, parce que la fin évince le
début dans 1,5 Go de cache. Le chargeur ne préchauffe donc que l'index.

**Traduction produit.** Tout ce qui repose sur les **agrégats
matérialisés** — la carte, les pays, les fiches — est rapide et le
restera : ce sont des tables pré-calculées, elles encaissent la
croissance sans broncher (mesuré : +51 % de corpus, la carte passe de
4,6 à 19 ms). Tout ce qui doit **lire le texte intégral** est lent, et
aucun réglage ne le corrige sur 8 Go de RAM.

Tu disais préférer « un site à 2-3 s assumées qu'un mensonge ». Voici la
vérité : **une fois la pile chaude, on y est** — 126 ms sur une
recherche ordinaire, 2 s sur un filtre pays européen, 3,5 à 4 s sur les
deux cas les plus lourds du corpus. La carte, les actualités, les fiches
d'organisation et les groupes sont **instantanés**.

**Le vrai défaut n'est pas la vitesse, c'est le démarrage.** Le premier
appel après un `make up` coûte 15 à 31 s le temps que le cache se
remplisse. En démonstration, ouvre le site cinq minutes avant et fais
une recherche : ensuite tout tient.

## 4. Ce qu'il reste raisonnable de charger sur cette machine

**Le chargement n'est pas le problème : la lecture l'est.** Les
chargeurs travaillent en flux, mémoire plate — NSF a chargé 260 000
financements en 25 minutes sur cette machine. Ce qui se dégrade à chaque
source ajoutée, c'est le temps de recherche.

| Source | Projets attendus | Charge-t-elle encore ? | Effet sur la lecture |
| --- | --- | --- | --- |
| **UKRI** (GtR) | ~150 000 | **oui** | +20 % de corpus ; recherches lourdes ~7 s |
| **SNSF** | ~90 000 | oui | marginal |
| **NWO** | ~40 000 | oui | marginal |
| **Vinnova** | ~90 000 | oui | marginal |
| **SBIR/STTR** | ~100 000 net | oui | marginal |
| **USAspending** | 200 000+ | **disque limite** (11 Go libres sur la VM) | significatif |
| **OpenAIRE** | 200 000 à 500 000 | **non sans hébergement** | rédhibitoire |

**La vraie limite est double :**

1. **Le disque de la VM (30 Go)** — 18 Go déjà utilisés. Il reste de la
   place pour l'Europe élargie, pas pour USAspending ni OpenAIRE.
2. **La RAM (8 Go)** — déjà dépassée. Chaque source aggrave la lecture
   sans que rien ne puisse la compenser.

**Recommandation de séquencement.** Charger **UKRI, SNSF, NWO et
Vinnova** sur cette machine : c'est ta priorité client (l'Europe
élargie), le disque tient, et la dégradation reste dans le supportable.
**Arrêter là.** SBIR, USAspending, Grants.gov et OpenAIRE attendent
l'hébergement — non par prudence excessive, mais parce qu'ils
transformeraient un site pénible en site inutilisable.

## 5. Le dimensionnement requis

Extrapolé des mesures réelles (699 798 projets → 5,7 Go de base, dont
1,3 Go de matière chaude ; la base croît à peu près linéairement avec le
nombre de projets porteurs de texte).

| Palier | Corpus | Base | RAM nécessaire | Disque |
| --- | --- | --- | --- | --- |
| **Aujourd'hui** | 700 k projets | 5,7 Go | **12-16 Go** | 60 Go |
| **Europe élargie** (UKRI, SNSF, NWO, Vinnova) | ~1,0 M | 8-9 Go | **16-24 Go** | 100 Go |
| **Fin de vague 1** (+ SBIR, USAspending, OpenAIRE) | 1,5-1,8 M | 13-15 Go | **24-32 Go** | 160 Go |
| **Phase 5 + comptes clients** | 2 M+ | 18-20 Go | **32-64 Go** | 320 Go |

**La règle, dite simplement** : il faut que **la base entière tienne en
mémoire**, cache PostgreSQL et cache système confondus. En dessous, les
recherches sur termes courants retombent au disque et le produit
redevient pénible. C'est la même conclusion que la preuve d'échelle du
chantier performance, confirmée deux fois depuis.

**Le CPU n'est pas la contrainte.** 4 à 8 cœurs suffisent : PostgreSQL
parallélise, mais le goulot est la mémoire. Inutile de payer pour des
vCPU dédiés.

## 6. Les options, avec leurs prix publics

### OVH Cloud — VPS gamme 2027 (France, prix HT/mois, relevés le 2026-08-04)

| Offre | vCores | RAM | Disque NVMe | Prix HT | Prix TTC |
| --- | --- | --- | --- | --- | --- |
| VPS-1 | 2 | 4 Go | 40 Go | 3,81 € | 4,57 € |
| VPS-2 | 4 | 8 Go | 75 Go | 7,21 € | 8,65 € |
| VPS-3 | 6 | 12 Go | 100 Go | 10,40 € | 12,48 € |
| **VPS-4** | **8** | **24 Go** | **200 Go** | **19,96 €** | **23,95 €** |

Sauvegarde quotidienne automatique **incluse**, trafic illimité,
anti-DDoS, hébergement en France.

### Hetzner Cloud (Allemagne/Finlande, prix €/mois après la hausse du 15 juin 2026, hors IPv4 à 0,50 €)

**Cost-Optimized (CX / CAX)** — le meilleur rapport qualité-prix du
marché, mais **affiché « indisponible » à la commande le 2026-08-04** :

| Offre | vCPU | RAM | Disque | Prix |
| --- | --- | --- | --- | --- |
| CX43 | 8 Intel/AMD | 16 Go | 160 Go | 15,99 € |
| CAX31 | 8 Ampere ARM | 16 Go | 160 Go | 20,99 € |
| CX53 | 16 Intel/AMD | 32 Go | 320 Go | 29,49 € |
| CAX41 | 16 Ampere ARM | 32 Go | 320 Go | 40,99 € |

**Regular Performance (CPX)** — disponible :

| Offre | vCPU | RAM | Disque | Prix |
| --- | --- | --- | --- | --- |
| CPX32 | 4 AMD | 8 Go | 160 Go | 35,49 € |
| CPX42 | 8 AMD | 16 Go | 320 Go | 69,49 € |
| CPX52 | 12 AMD | 24 Go | 480 Go | 100,49 € |
| CPX62 | 16 AMD | 32 Go | 640 Go | 129,99 € |

**Dedicated vCPU (CCX)** — à écarter : après la hausse de juin 2026,
CCX23 (16 Go) coûte 85,99 € et CCX33 (32 Go) 138,49 €, soit plus cher
qu'un serveur dédié à 64 Go.

### Hetzner — serveurs dédiés (prix indicatifs relevés le 2026-08-04)

| Modèle | CPU | RAM | Disques | Prix |
| --- | --- | --- | --- | --- |
| **AX42** | Ryzen 7 PRO 8700GE, 8c/16t | **64 Go DDR5 ECC** | 2× 512 Go NVMe | **~57 €** |
| AX102 | Ryzen 9 7950X3D, 16c/32t | 128 Go DDR5 ECC | 2× 1,92 To NVMe | ~122 € |

Frais d'installation ponctuels selon le modèle ; la tarification des
dédiés a été restructurée le 15 juin 2026 (mensuel plus élevé, frais
d'installation plus bas) — **à revérifier au moment de commander**.

## 6 bis. Upgrade VPS-4 — REPORTÉ le 2026-08-22 (indisponibilité SBG6)

**Décision fondatrice** : l'upgrade VPS-2 (8 Go) → VPS-4 (24 Go) était
validé, snapshot S7 pris, porte de paiement ouverte — **le VPS-4 est
indisponible en région SBG6 au moment de valider**. Décision : rester
sur VPS-2, **ne pas prendre VPS-3, ne pas migrer de datacenter**. La
porte sera rouverte dès disponibilité, avec pour seul préalable les
contrôles de l'état de référence ci-dessous.

**État de référence « avant upgrade » (audit du 2026-08-22, 15h UTC+2,
à re-vérifier avant la prochaine ouverture de porte)** :

- Système : RAM 7 746 Mio (utilisé 3 383, dispo 4 362), swap 2 Go
  (51 Mio utilisés), load 0,24, 4 vCPU Haswell, disque ext4 72 Go
  (19 utilisés / 54 libres), IPv4 `92.222.91.139`.
- Docker : 5 conteneurs sains — postgres 2,20 Gio, api 428 Mio (chaud),
  scheduler 30 Mio, web 19, caddy 13 ; volumes 7,8 Go.
- PostgreSQL 16.15 : base 6 429 Mo (project_texts 3 326 Mo, projects
  1 751 Mo, lei_records 816 Mo) ; shared_buffers 2 Go,
  effective_cache_size 5 Go, work_mem 32 Mo, maintenance 512 Mo ;
  11 connexions ; 3 matviews peuplées.
- Invariants : 699 798 projets / 110 116 organisations / 1 102 270
  participations / 1 653 appels ; Space 10 278/4 537, Aviation 1 752/2 ;
  migration `0031 (head)` ; scheduler `jobs 'calls'` (cron 05:00 UTC),
  dernier run calls : succès 11:14 UTC ; domaine/TLS/auth vérifiés.
- Estimation pgvector consignée (700 k vecteurs) : 384d ≈ 1,3 Go table
  + ~2 Go index HNSW ; 768d ≈ 2,6 + 3-4 Go ; 1024d ≈ 3,4 + 4-5 Go —
  **VPS-4 confirmé comme base raisonnable du socle S** (384d en V1).

**Conséquence roadmap** : E3 → A → B → F → D avancent sur VPS-2 ; le
socle S (pgvector/embeddings) et les chantiers dépendants de la RAM
(vague K) restent GELÉS jusqu'à l'upgrade 24 Go effectif.

## 7. Recommandation

**Pour partir maintenant et couvrir toute la vague 1 européenne :
OVH VPS-4, 19,96 € HT par mois** (24 Go de RAM, 200 Go NVMe, sauvegarde
incluse, hébergement français). Il couvre confortablement le corpus
actuel, absorbe UKRI/SNSF/NWO/Vinnova sans discussion, et tient encore
la fin de vague 1 — sans marge, mais il tient. C'est **240 € par an**
pour transformer un site pénible en site rapide.

**Pour ne plus se poser la question avant longtemps : Hetzner AX42
dédié, ~57 € par mois**, 64 Go de RAM et 1 To de NVMe. C'est le meilleur
rapport mémoire/prix du marché : **deux fois plus de RAM que la plus
grosse instance cloud de Hetzner, pour moins de la moitié du prix.** À
684 € par an, il couvre la fin de vague 1, la phase 5 et les premiers
clients sans nouvelle décision.

**Ce qu'on n'achète pas** : des vCPU dédiés. La contrainte est la
mémoire ; payer 138 € pour 32 Go « dédiés » quand 57 € achètent 64 Go
n'a pas de sens ici.

**Ce que l'hébergement règle** : les recherches sur termes courants
(5-6 s → attendu sous 300 ms une fois la base entièrement en cache), la
falaise du premier visiteur, les chargements qui monopolisent ta
machine, et la reprise de l'ordonnanceur hebdomadaire — qui redevient un
travail de serveur, pas de portable.

**Ce que l'hébergement ne règle pas** : rien du produit. Le code est le
même. Ce qui change, c'est qu'il cesse de tourner sur une machine qui
n'a pas la mémoire de son corpus.

## 8. Ce qui reste à décider

1. **Le palier** : 24 Go à 20 € (suffit à la vague 1) ou 64 Go à 57 €
   (suffit à tout ce qui est prévu) ?
2. **La juridiction** : OVH est français, Hetzner allemand — les deux
   sont dans l'UE et conformes au RGPD. Si un argument commercial exige
   un hébergement français, OVH tranche.
3. **La sauvegarde** : incluse chez OVH sur la gamme 2027 ; à ajouter
   chez Hetzner (snapshots facturés). À chiffrer avant de comparer les
   prix nus.
4. **Le nom de domaine et le TLS** : la pile embarque déjà Caddy, qui
   obtient et renouvelle les certificats seul. Rien à faire d'autre que
   pointer un domaine.
