# Le lanceur Orion du Bureau

`~/Desktop/Orion.app` — un double-clic : Colima démarre s'il dort, la
base dev s'efface (règle une-pile), la pile prod se lève **sans
rebuild**, et http://localhost:8080 s'ouvre dans Firefox. Un échec parle
en boîte de dialogue courte ; le détail vit dans
`~/Library/Logs/orion-launcher.log`.

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

Il ne reconstruit jamais les images (c'est `make up`, geste de
développement) ; il ne charge aucune donnée ; il ne touche pas à la
base. S'il dit « les images manquent », lancer `make up` une fois dans
le dépôt.
