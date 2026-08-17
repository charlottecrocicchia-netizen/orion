#!/bin/bash
# L'empreinte des sources qui entrent dans les images de prod (2026-08-17).
#
# Pourquoi : le lanceur du Bureau ne savait que tester si l'URL répond.
# Une pile déjà debout sur une image périmée passait donc le test, et
# ouvrait silencieusement une vieille version du site — de quoi rater
# une recette entière sans jamais s'en apercevoir.
#
# Les images portent cette empreinte en tampon (label OCI `revision`) ;
# le lanceur la recalcule et compare. Un seul calcul, ici, pour que le
# tampon posé à la construction et la vérification au lancement ne
# puissent jamais diverger.
#
# L'arbre SALE compte : une image bâtie sur des modifications non
# commitées ne correspond à aucun commit, et se dire « à jour » parce
# que le SHA tombe juste serait exactement le mensonge qu'on corrige.
set -u
cd "$(dirname "$0")/.." || exit 1

rev=$(git rev-parse --short HEAD 2>/dev/null) || rev="hors-git"

# Seuls les contextes réellement copiés dans les images comptent : une
# retouche de docs ne doit pas déclencher une reconstruction de 4 min.
# Le lanceur vit sous infra/ mais n'entre dans aucune image — il
# déclencherait sinon une reconstruction à chacune de ses corrections.
paths="backend frontend infra :!infra/launcher"
dirty=$(git status --porcelain -- $paths 2>/dev/null)

if [ -n "$dirty" ]; then
  # Le CONTENU des modifications, pas seulement les noms de fichiers :
  # sinon deux retouches successives du même fichier donneraient la même
  # empreinte, et la seconde n'entrerait jamais dans l'image.
  print=$(
    {
      git diff HEAD -- $paths 2>/dev/null
      printf '%s\n' "$dirty"
    } | git hash-object --stdin | cut -c1-8
  )
  echo "$rev+$print"
else
  echo "$rev"
fi
