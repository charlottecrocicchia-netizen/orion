# Le lanceur Orion du Bureau

`~/Desktop/Orion.app` — un double-clic : Colima démarre s'il dort, la
base dev s'efface (règle une-pile), la pile prod se lève **à la version
des sources**, et http://localhost:8080 s'ouvre dans Firefox. Un échec
parle en boîte de dialogue courte ; le détail vit dans
`~/Library/Logs/orion-launcher.log`.

## La garantie de fraîcheur

> Règle cardinale : ce lanceur n'ouvre jamais une version périmée.

La première version se contentait de tester si l'URL répondait. Une pile
déjà debout sur une vieille image passait donc le test et s'ouvrait **en
silence** : recette du 2026-08-17 menée sur le site d'avant, sans le
moindre signe. Correction en trois pièces :

1. **Les images portent un tampon.** `ARG GIT_REV` + `LABEL
   org.opencontainers.image.revision` en fin de chaque Dockerfile —
   en dernier, pour n'invalider que ce calque et pas les `uv sync` /
   `pnpm build` qui coûtent des minutes.
2. **Une seule empreinte**, [scripts/source-rev.sh](../../scripts/source-rev.sh) :
   le SHA court de `HEAD`, suffixé du hachage du CONTENU des
   modifications non commitées de `backend/`, `frontend/` et `infra/`
   (une image bâtie sur un arbre sale ne correspond à aucun commit).
   `make up` l'exporte à la construction, le lanceur la recalcule au
   lancement — même calcul, donc pas de divergence possible.
3. **Le lanceur compare, puis tranche.** Tampon identique → il ouvre.
   Différent, absent, ou pile éteinte → notification « Mise à jour en
   cours (ancienne → nouvelle) », `make up`, et re-vérification APRÈS
   coup. Si le tampon ne correspond toujours pas, il **refuse
   d'ouvrir** : une erreur franche vaut mieux qu'un écran menteur.

Coût : un double-clic sur des sources inchangées ne reconstruit rien
(comparaison de deux chaînes). Après un commit qui touche `backend/` ou
`frontend/`, comptez la durée d'un `make up`.

## Le manifeste statique (assumé)

Le script est volontairement NON portable — c'est le lanceur de CETTE
machine, et ses constantes sont écrites en dur, en tête de
[orion-launcher.sh](orion-launcher.sh) :

| Constante | Valeur | Pourquoi en dur |
|---|---|---|
| `PATH` | `/opt/homebrew/bin:…` | une app du Finder n'hérite pas du shell — colima/docker doivent se trouver |
| `REPO` | `/Users/charlottecrocicchia/dev/orion` | le dépôt de cette machine |
| `URL` | `http://localhost:8080` | la prod locale (Caddy) |
| Firefox | `/Applications/Firefox.app` | navigateur de recette ; repli navigateur par défaut s'il manque |

Si le dépôt déménage : corriger `REPO` ici **et** le chemin dans
[Orion.applescript](Orion.applescript), puis réinstaller.

## Reconstruire / réinstaller

```
infra/launcher/install.sh
```

(osacompile + icône ; écrase l'app existante.) L'icône vient de
[icon.html](icon.html) — la constellation d'Orion sur bleu nuit — rendue
en PNG par Chromium puis convertie en `.icns` ; `icon-1024.png` et
`Orion.icns` sont versionnés pour que l'installation ne dépende de rien.

## Ce que le lanceur ne fait PAS

Il ne charge aucune donnée et ne touche pas au contenu de la base : un
`make prod-ingest` reste un geste délibéré. Il reconstruit les images
uniquement quand leur tampon ne correspond plus aux sources — jamais
« pour voir ».
