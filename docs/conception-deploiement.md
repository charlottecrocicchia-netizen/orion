# Conception — Déploiement lot 1 : Orion en production publique sur lensorion.com

> **Objet** : le plan complet, ordonné et validable du passage en
> production. Aucun geste sur le serveur avant validation de ce document
> par la fondatrice. Chaque étape dit **qui agit** — `[Claude]` pour ce
> qui passe par le terminal, `[Charlotte]` pour ce qui lui revient — et
> **comment on vérifie** qu'elle est faite.
>
> **Validé par la fondatrice le 2026-08-21** (GO), avec trois
> arbitrages intégrés : les invariants font foi au relevé du dump ;
> « les trois lentilles » désignait les trois verres de la Lens Room
> (deux lentilles publiées + la vue corpus) ; et le VPS est un
> **VPS-2 (8 Go de RAM)**, pas un VPS-4 — voir la condition de
> validité ci-dessous.
>
> **Condition de validité du plan** : le VPS a 8 Go de RAM, la base
> pèse 9,4 Go — elle ne tiendra pas entièrement en mémoire, et ce
> n'est pas exigé : le produit public est en lecture quasi pure, servi
> par des agrégats précalculés et des index. La règle de
> `docs/hebergement.md` est remplacée ici par une **recette de
> performance sur pièce** (R11, étape 8) : les pages clés doivent
> répondre en temps acceptable à l'écran depuis `lensorion.com`. Si
> cette recette échoue vraiment, l'upgrade VPS-3 (12 Go) est un clic
> chez OVH, pas une refonte — on en reparle à ce moment-là, pas avant.

## 0. Les faits, relevés le 2026-08-21

### Le serveur et le domaine

| | |
| --- | --- |
| VPS OVH | `vps-c5ac954e.vps.ovh.net` — VPS-2 gamme 2027 : 4 vCore, **8 Go RAM**, 75 Go NVMe |
| IPv4 | `92.222.91.139` |
| IPv6 | `2001:41d0:404:200::8a6a` |
| OS | Ubuntu 26.04, utilisateur initial `ubuntu` |
| Sauvegarde | backup OVH quotidien actif + option snapshot |
| Domaine | `lensorion.com`, zone DNS chez OVH, DNSSEC actif |

### La base locale à migrer (mesurée sur la pile prod locale, requêtes en § 5)

| Invariant | Valeur | Source |
| --- | --- | --- |
| Projets | 699 798 | `SELECT count(*) FROM projects` |
| Organisations | 110 116 | `SELECT count(*) FROM organisations` |
| Participations | 1 102 270 | `SELECT count(*) FROM participations` |
| Lentilles publiées | `space` v2, `aviation` v2 | `SELECT slug, status, version FROM lenses` |
| Aviation : core / habilitant | 1 752 / 2 | `SELECT tag, count(*) FROM project_lens_tags WHERE lens='aviation' GROUP BY tag` |
| Space : core / habilitant | 10 278 / 4 537 | idem, `lens='space'` |
| Règles Aviation / Space | 179 / 22 (somme 201) | `SELECT slug, rules_total FROM lenses` |
| Entrées de changelog | 3 | `SELECT count(*) FROM lens_changelog` |
| Taille de la base | 9,4 Go | `SELECT pg_size_pretty(pg_database_size('orion'))` |

**Règle** : ce tableau est la photographie d'aujourd'hui, pas le
contrat de la migration. Le contrat, c'est la procédure du § 5 — les
invariants sont **re-relevés au moment du dump** et vérifiés au chiffre
près après restauration. Si une lentille est publiée entre ce document
et le dump, c'est le relevé du jour du dump qui fait foi.

### La stack

`infra/compose.prod.yml` : Caddy (reverse proxy + TLS) → `web`
(front statique) et `api` (FastAPI) → PostgreSQL 16 + pgvector. Le
scheduler d'ingestion existe derrière un profil, **éteint**. La même
pile tourne en local sur `:8080` et continuera d'y tourner (recette
locale). L'API applique les migrations Alembic au démarrage.

## 1. Les décisions d'architecture (à valider)

**D1 — On construit les images sur le serveur, pas depuis GHCR.**
Le runbook historique (`infra/README.md`) prévoyait des images tirées
de GHCR, poussées par la CI. La CI est muette jusqu'au 1er septembre
(quota) : les images du registre ne sont pas garanties à jour, et on
ne les rendra pas à jour sans toucher la CI — interdit du lot.
`compose.prod.yml` porte déjà les contextes de build ; le serveur (8
cœurs attendus) construit en quelques minutes. *Condition de validité :
tant que la CI ne publie pas d'images fraîches. Le jour où elle
revient, on pourra re-basculer sur GHCR — décision séparée.*

**D2 — Le serveur clone le repo via une deploy key GitHub en lecture
seule.** Une paire de clés dédiée est générée **sur le serveur**, sans
passphrase (clé cantonnée à un seul repo, en lecture seule — si le
serveur est compromis, elle ne donne que ce que le site publie déjà de
toute façon). Charlotte ajoute la clé publique dans GitHub → Settings →
Deploy keys, **sans** cocher « Allow write access ».

**D3 — On garde l'utilisateur `ubuntu`.** Pas de compte applicatif
séparé au lot 1 : un seul humain, un seul service, la séparation de
privilèges viendrait complexifier sans menace qui la justifie. Le repo
vit dans `/home/ubuntu/orion`. *Ce qu'on ne construit pas : utilisateur
`orion` dédié, sudo restreint — à revoir si un jour quelqu'un d'autre
que Charlotte a un accès.*

**D4 — La redirection `www` → apex se fait dans Caddy, paramétrée par
variable d'environnement.** Le Caddyfile reste générique (aucun domaine
en dur dans le repo) : `SITE_ADDRESS` liste les deux hôtes pour que le
certificat couvre `www`, et un nouveau `CANONICAL_HOST` porte la
redirection. En local (`SITE_ADDRESS=:80`, `CANONICAL_HOST` absent), le
comportement est inchangé. Modification testée en local **avant** tout
geste serveur (étape 0).

**D5 — Le scheduler d'ingestion reste éteint au lot 1.** Un replay
hebdomadaire qui modifierait le corpus pendant la recette rendrait les
invariants invérifiables. Son activation sur le serveur est un lot
ultérieur, avec sa propre recette. *Conséquence assumée : les données
de prod sont figées au dump jusqu'à ce lot.*

**D6 — Aucun secret ne transite par la conversation ni par le repo.**
Le mot de passe PostgreSQL de prod est généré **sur le serveur** par le
mécanisme existant du Makefile (`make up` crée `.env` avec un mot de
passe aléatoire, sans jamais l'afficher). Le mot de passe SSH initial
et la passphrase de la clé SSH sont tapés par Charlotte directement aux
invites du terminal. La clé privée de déploiement ne quitte jamais le
serveur ; la clé privée SSH ne quitte jamais le Mac.

**D7 — Rien d'irréversible sans snapshot OVH pris avant.** Deux points
de snapshot nommés : **S1** avant le durcissement SSH (le seul geste
qui peut nous enfermer dehors), **S2** avant la première mise en route
complète de la pile avec données. Le snapshot est pris par Charlotte
dans l'espace client OVH ; Claude demande explicitement « snapshot
pris ? » avant de continuer.

## 2. Ce qui tourne où, et les ports

```
Internet ──443/80──▶ Caddy (conteneur, publie 80 et 443)
                      ├── /api/* ──▶ api:8000   (réseau compose interne)
                      └── /*     ──▶ web:80    (réseau compose interne)
                    PostgreSQL:5432 — interne uniquement, jamais publié
SSH ──22──▶ sshd (hôte)
```

- **UFW** : `22/tcp`, `80/tcp`, `443/tcp` entrants, tout le reste
  refusé. Honnêteté technique : Docker publie ses ports au niveau
  iptables, **au-dessus d'UFW** — la protection réelle de la base vient
  de ce qu'elle n'est pas publiée du tout. Règle vérifiable en recette :
  `docker ps` ne montre que Caddy en `0.0.0.0:80/443`, et un scan
  externe (`nc -zv` depuis le Mac) ne voit que 22, 80, 443.
- Le Mac garde sa prod locale sur `:8080` — rien ne change.

## 3. Variables d'environnement de prod (`/home/ubuntu/orion/.env`)

| Variable | Valeur prod | Pourquoi |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | générée sur le serveur, jamais affichée | D6 |
| `SITE_ADDRESS` | `lensorion.com, www.lensorion.com` | Caddy obtient un certificat Let's Encrypt pour les deux hôtes |
| `CANONICAL_HOST` | `lensorion.com` | redirection `www` → apex (D4) |
| `HTTP_PORT` | `80` | port public HTTP (redirigé vers HTTPS par Caddy) |
| `HTTPS_PORT` | `443` | port public HTTPS |
| `ORION_ENV` | `production` | |
| `ORION_PG_SHARED_BUFFERS` | `2GB` | ~25 % des 8 Go ; le reste sert de cache système, qui profite aussi à Postgres |
| `ORION_PG_EFFECTIVE_CACHE` | `5GB` | dire la vérité au planificateur : shared_buffers + cache système réaliste sur un serveur qui ne fait que ça |
| `ORION_PG_WORK_MEM` | `32MB` | doublé par rapport au Mac (16 Mo) ; multiplié par les workers, reste sûr avec 8 Go |
| `ORION_PG_MAINTENANCE_MEM` | `512MB` | restaurations et créations d'index plus rapides |

*Tuning arbitré le 2026-08-21 pour 8 Go de RAM : la base (9,4 Go) ne
tient pas en mémoire et ce n'est pas exigé — la matière chaude (index
de recherche + agrégats, ~1,3 Go mesurés en août) tient, elle. Le
verdict est la recette R11 ; l'échappatoire nommée est l'upgrade VPS-3
(12 Go) en un clic OVH.*

`HTTP_PORT`/`HTTPS_PORT` : 80 et 443 sont des ports privilégiés, mais
c'est le démon Docker (root) qui les publie — rien à configurer.

## 4. Le plan, dans l'ordre chronologique

### Étape 0 — Sur le Mac, avant tout geste serveur

1. `[Claude]` Modifier `infra/Caddyfile` pour la redirection `www` :

   ```caddyfile
   {$SITE_ADDRESS} {
   	@www host www.{$CANONICAL_HOST:invalid.localhost}
   	redir @www https://{$CANONICAL_HOST}{uri} permanent

   	encode zstd gzip
   	handle /api/* { reverse_proxy api:8000 }
   	handle { reverse_proxy web:80 }
   }
   ```

   Recette locale : `make up`, `http://localhost:8080` répond comme
   avant (le matcher `@www` ne matche rien en local), commit.
2. Clé SSH dédiée. Le terminal de Claude n'a pas d'entrée interactive :
   **toute commande qui demande un mot de passe ou une passphrase est
   tapée par `[Charlotte]` dans son propre terminal**, dictée
   exactement. Donc : `[Charlotte]` exécute
   `ssh-keygen -t ed25519 -f ~/.ssh/orion-vps -C "orion-vps"` et tape
   la passphrase aux deux invites, puis
   `ssh-add --apple-use-keychain ~/.ssh/orion-vps` (passphrase une
   dernière fois — le trousseau macOS la retient, les connexions
   suivantes de Claude passent par l'agent sans invite).
   `[Claude]` ajoute le bloc `Host orion-vps` dans `~/.ssh/config`
   (HostName `92.222.91.139`, User `ubuntu`, IdentityFile
   `~/.ssh/orion-vps`, `AddKeysToAgent yes`, `UseKeychain yes`).

### Étape 1 — Premier accès et état des lieux `[Claude + Charlotte]`

1. `[Charlotte]` dans son terminal :
   `ssh-copy-id -i ~/.ssh/orion-vps.pub ubuntu@92.222.91.139` —
   première connexion : elle accepte l'empreinte de l'hôte (TOFU) et
   tape le mot de passe OVH à l'invite. C'est la seule fois où le mot
   de passe sert.
2. `[Claude]` vérifie que `ssh orion-vps` entre **par clé, sans
   invite** (agent + trousseau), puis relève et consigne : `nproc`,
   `free -h`, `df -h`, `ip -6 addr` + `curl -6 https://ifconfig.me`
   (l'IPv6 d'OVH n'est pas toujours configurée d'office — si elle ne
   répond pas, le AAAA attendra qu'elle le soit ; le site fonctionne
   en IPv4 seule).

### Étape 2 — Snapshot S1 puis durcissement `[Claude]`, trace exigée

`[Charlotte]` prend le **snapshot S1** dans l'espace client OVH.
Puis, en gardant une session SSH ouverte en permanence pendant toute
l'étape (garde-fou anti-enfermement) :

| Geste | Comment | Preuve consignée |
| --- | --- | --- |
| Mises à jour | `apt update && apt upgrade` | versions notées |
| Mot de passe SSH désactivé | `PasswordAuthentication no` dans un drop-in `/etc/ssh/sshd_config.d/` | `sshd -T \| grep passwordauth` ; une connexion `-o PubkeyAuthentication=no` échoue |
| Root SSH désactivé | `PermitRootLogin no` idem | `sshd -T \| grep permitroot` |
| UFW | `allow 22,80,443/tcp` puis `enable` | `ufw status verbose` ; la session SSH ouverte survit |
| fail2ban | `apt install fail2ban`, jail `sshd` par défaut | `fail2ban-client status sshd` |
| MAJ de sécurité auto | `unattended-upgrades` activé | `systemctl status unattended-upgrades` + config affichée |

Chaque preuve est recopiée dans ce document (annexe A, remplie à
l'exécution).

### Étape 3 — DNS `[Charlotte crée, Claude vérifie]`

Dans l'espace client OVH → zone `lensorion.com` :

| Type | Sous-domaine | Cible | TTL |
| --- | --- | --- | --- |
| A | *(vide — apex)* | `92.222.91.139` | défaut |
| AAAA | *(vide — apex)* | `2001:41d0:404:200::8a6a` | défaut *(seulement si l'IPv6 du serveur répond, cf. étape 1)* |
| CNAME | `www` | `lensorion.com.` | défaut |

Supprimer les enregistrements par défaut de la zone OVH qui entrent en
conflit sur l'apex ou `www` (redirection web OVH, A par défaut) s'il y
en a. DNSSEC : rien à faire, OVH signe la zone automatiquement.

`[Claude]` vérifie la propagation depuis le Mac (`dig +short
lensorion.com A` et `AAAA`, `dig +short www.lensorion.com CNAME`, puis
contre un résolveur public `@1.1.1.1`). **On ne passe à l'étape 5
(HTTPS) qu'une fois les bonnes valeurs servies** — sinon Let's Encrypt
brûle des tentatives de validation.

### Étape 4 — La stack sur le serveur `[Claude]`

1. Docker : script officiel `get.docker.com`, puis `usermod -aG docker
   ubuntu` (reconnexion). Preuve : `docker version`.
2. Deploy key : `ssh-keygen -t ed25519 -f ~/.ssh/github-deploy -N ""`
   **sur le serveur** ; la clé **publique** est affichée et
   `[Charlotte]` l'ajoute dans GitHub → repo `orion` → Settings →
   Deploy keys → *lecture seule* (D2).
3. `git clone git@github.com:charlottecrocicchia-netizen/orion.git
   /home/ubuntu/orion` (bloc `Host github.com` avec la deploy key dans
   `~/.ssh/config` du serveur).
4. `.env` de prod : `make .env` (mot de passe généré sans affichage,
   D6), puis édition des lignes non secrètes selon le tableau du § 3 —
   **mais** `SITE_ADDRESS=:80` provisoirement : pas de demande de
   certificat avant que la base soit là et le DNS vérifié.
5. Construire : `make build`. Preuve : les deux images construites avec
   le bon `GIT_REV` (tampon de `scripts/source-rev.sh`).

### Étape 5 — La base : dump local → restore serveur `[Claude]`

Stratégie : format custom `pg_dump -Fc` (compressé), transfert
reprenable, restauration dans une base vierge **avant** le premier
démarrage de l'API (sinon Alembic crée le schéma et la restauration
entre en collision).

1. **Sur le Mac** — relever les invariants (les neuf requêtes du § 0,
   résultats consignés en annexe B), puis :
   `docker exec orion-postgres-1 pg_dump -U orion -Fc orion > orion-YYYYMMDD.dump`
   (~2-4 Go attendus pour 9,4 Go de base).
2. Transfert : `rsync --partial --progress` vers le serveur via
   `orion-vps`.
3. **Sur le serveur** — démarrer PostgreSQL seul :
   `docker compose ... up -d --wait postgres` ; restaurer :
   `pg_restore -U orion -d orion --no-owner` (via `docker exec -i`).
4. **Vérification au chiffre près** : les neuf requêtes d'invariants,
   comparées ligne à ligne au relevé du dump. Un seul écart = on
   s'arrête, on comprend, on recommence. « Chaque chiffre a sa source »
   vaut aussi pour une migration.
5. `[Charlotte]` prend le **snapshot S2** (base restaurée et vérifiée,
   pile pas encore publique).

### Étape 6 — Mise en route HTTPS `[Claude]`

1. DNS vérifié (étape 3) + invariants vérifiés (étape 5) → basculer
   `SITE_ADDRESS=lensorion.com, www.lensorion.com` et
   `CANONICAL_HOST=lensorion.com` dans `.env`, puis `make up`.
2. Caddy obtient les certificats Let's Encrypt seul (HTTP-01 sur le
   port 80 déjà ouvert). Preuve : `docker compose logs caddy` montre
   l'obtention ; `curl -sI https://lensorion.com` répond 200 avec le
   bon certificat.
3. Réchauffage : une recherche sur un terme courant pour remplir le
   cache. Avec 8 Go, la falaise du premier visiteur ne disparaîtra pas
   d'elle-même — mesurer à froid et à chaud, consigner, et compter sur
   le préchauffage d'index déjà en fin de chaîne de chargement.

### Étape 7 — Sauvegardes, vérifiées sur pièce `[Claude]`

Le backup OVH couvre le disque. S'y ajoute un dump logique quotidien :

- Script `pg_dump -Fc` vers `/home/ubuntu/backups/`, nommé par date,
  **rotation 7 jours**, lancé par cron à 04h00 (après l'heure du futur
  scheduler pour ne jamais dumper pendant une ingestion).
- **La recette exige une restauration d'essai, pas l'existence du
  fichier** : restaurer le dump du jour dans une base jetable
  `orion_restore_test` sur le serveur, y compter projets et lentilles,
  comparer, supprimer la base. Procédure de restauration réelle
  documentée en annexe C (remplie à l'exécution).

### Étape 8 — Recette finale, sur pièce `[Claude mesure, Charlotte constate]`

| # | Vérification | Comment |
| --- | --- | --- |
| R1 | `https://lensorion.com` ouvre Orion, certificat valide | navigateur (cadenas) + `curl -sIv` |
| R2 | `http://` → `https://` (301/308) | `curl -sI http://lensorion.com` |
| R3 | `www` (http et https) → apex | `curl -sI https://www.lensorion.com` |
| R4 | La Lens Room joue | recette visuelle Firefox `[Charlotte]` |
| R5 | Chaque lentille publiée répond avec les chiffres de l'annexe B | appels API + affichage |
| R6 | L'à-propos affiche le changelog v2 | visuel |
| R7 | La recherche fonctionne, temps consignés | terme rare + terme courant, chaud/froid |
| R8 | FR/EN | visuel |
| R9 | La prod locale `:8080` tourne toujours sur le Mac | `curl localhost:8080/api/health` |
| R10 | Seuls 22/80/443 répondent de l'extérieur | `nc -zv` depuis le Mac |
| R11 | **Recette de performance sur pièce** (condition de validité du plan) : home, Explorer, fiche organisation dense (type Fraunhofer), bascule de lentille — chacune répond en temps acceptable à l'écran depuis `lensorion.com`, pile chaude | chronométrage consigné, `[Charlotte]` juge l'« acceptable » à l'écran ; en échec → discussion upgrade VPS-3 |

### Étape 9 — La procédure de mise à jour future (le runbook des fins de chantier)

```
# Sur le Mac : merger/pousser main comme d'habitude, puis :
ssh orion-vps
cd ~/orion && git pull --ff-only
make up        # reconstruit ce qui a changé, redémarre, attend le healthy
curl -fsS https://lensorion.com/api/health
```

- `make up` porte déjà le tampon `GIT_REV` : la pile affiche la
  révision qu'elle sert.
- **Piège vérifié en recette locale (2026-08-21)** : le Caddyfile est
  monté en volume — `docker compose up -d` ne recrée pas le conteneur
  quand seul ce fichier change, et Caddy continue de servir l'ancienne
  config. Après toute modification du Caddyfile :
  `docker compose ... restart caddy`.
- Migration de schéma : appliquée automatiquement au démarrage de
  l'API (`MIGRATE_ON_START`). Avant un déploiement qui migre le
  schéma : dump manuel d'abord (le cron de la nuit ne suffit pas si le
  commit du matin casse).
- Rollback applicatif : `git checkout <rev précédente> && make up`.
  Rollback de données : restauration du dump du jour (annexe C).
  Rollback machine : snapshot OVH.

## 5. Ce qu'on ne construit pas au lot 1

- **Pas de CI/CD** : déploiement manuel documenté (quota Actions muet ;
  et un déploiement qu'on comprend avant un déploiement qu'on
  automatise).
- **Pas de scheduler d'ingestion serveur** (D5) — lot dédié.
- **Pas de monitoring externe** (uptime, alerting) — le backup OVH et
  le healthcheck suffisent au lot 1 ; à décider quand il y aura des
  utilisateurs à prévenir.
- **Pas de compte applicatif séparé** (D3).
- **Pas de service payant ajouté** : Let's Encrypt, UFW, fail2ban,
  cron — tout est déjà payé ou gratuit.

## Annexe A — Accès et durcissement (rempli à l'exécution)

### Relevé de l'étape 1 (2026-08-21)

- Empreinte SSH de l'hôte, acceptée à la première connexion (TOFU) :
  `ED25519 SHA256:ExDszzSOswofzQBzEOU25z+vebrGNomrhYNeefkN4Wk`
- Clé d'accès : `~/.ssh/orion-vps` (ed25519, passphrase au trousseau
  macOS), posée via `ssh-copy-id` ; entrée par clé vérifiée sans
  invite. Le mot de passe initial OVH a dû être changé à la première
  connexion (politique OVH) — le nouveau est dans le gestionnaire de
  mots de passe de Charlotte, il ne sert plus qu'en secours console.
- Specs confirmées : 4 vCPU · 7,6 Gio RAM · disque 72 Go (70 libres) ·
  Ubuntu 26.04 LTS (noyau 7.0.0-28-generic).
- **Aucun swap configuré** (0 B) — vu au relevé ; un swapfile de 2 Go
  est ajouté au durcissement comme garde-fou OOM (une base de 9,4 Go
  sur 8 Go de RAM sans aucun swap, c'est l'OOM-killer comme seul
  recours).
- IPv6 : configurée et **sortante vérifiée** (`curl -6` répond
  `2001:41d0:404:200::8a6a`) → le AAAA de l'étape 3 est confirmé.

### Preuves du durcissement (à remplir à l'exécution)

- **Snapshot S1 pris** : « S1 — avant durcissement SSH », effectué le
  2026-08-21 à 21:58 (confirmé dans l'espace client OVH).

Exécuté le 2026-08-21, chaque geste avec sa preuve :

| Geste | Preuve relevée |
| --- | --- |
| Mises à jour | `full-upgrade` appliqué, noyau de sécurité **7.0.0-30-generic** actif après redémarrage ; 7 paquets restants en déploiement progressif Ubuntu (les MAJ auto les prendront) |
| Mot de passe SSH désactivé | `sshd -T` → `passwordauthentication no` ; tentative `-o PubkeyAuthentication=no` refusée avec `Permission denied (publickey)` — le serveur n'offre plus que la clé |
| Root SSH désactivé | `sshd -T` → `permitrootlogin no` (+ `kbdinteractiveauthentication no`) |
| UFW | `deny (incoming)` par défaut ; seuls 22, 80, 443/tcp en v4 **et** v6 ; la session SSH survit à l'activation |
| fail2ban | jail `sshd` active (`fail2ban-client status sshd` : 0 banni, filtre branché sur le journal systemd) |
| MAJ de sécurité auto | `unattended-upgrades` `enabled`/`active` ; `20auto-upgrades` : `Update-Package-Lists "1"`, `Unattended-Upgrade "1"` |
| Swapfile (ajout validé) | 2 Go actifs (`free -h`), persistant via `/etc/fstab`, `vm.swappiness=10` |

**Piège rencontré et corrigé** : dans sshd, la première valeur lue
gagne, et les drop-ins de `sshd_config.d/` sont lus en ordre
alphabétique — `50-cloud-init.conf` (posé par OVH, `PasswordAuthentication
yes`) passait avant notre `50-orion-…`. Le drop-in de durcissement est
nommé `00-orion-durcissement.conf` pour passer premier. La preuve
`sshd -T` (config effective, pas fichier) est ce qui l'a attrapé.

## Annexe B — Invariants relevés au dump (rempli le 2026-08-21)

Dump `pg_dump -Fc` de la pile prod locale : **1,3 Go** (base de
9,4 Go), transféré par rsync, **sommes MD5 identiques** des deux côtés
(`1cfda324…`). Restauré dans une base vierge (0 table au départ,
vérifié), **avant** le premier démarrage de l'API. Relevé au dump et
relevé après restauration comparés par `diff` : **identiques ligne à
ligne**.

| Invariant | Valeur (dump = restore) |
| --- | --- |
| Projets | 699 798 |
| Organisations | 110 116 |
| Participations | 1 102 270 |
| Lentille aviation | published, v2, 179 règles — core 1 752, habilitant 2 |
| Lentille space | published, v2, 22 règles — core 10 278, habilitant 4 537 |
| Entrées de changelog | 3 |

**Snapshot S2 pris** : « S2 — base restaurée et vérifiée, avant mise en
route HTTPS », effectué le 2026-08-21 à 22:38 (S1, devenu inutile
après le durcissement réussi, supprimé pour libérer l'emplacement —
OVH n'en garde qu'un).

## Annexe C — Procédure de restauration réelle (à remplir à l'exécution)
