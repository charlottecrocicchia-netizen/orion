#!/bin/bash
# Installe (ou réinstalle) le lanceur de la PILE PROD LOCALE (:8080).
# Depuis le chantier confort local (2026-08-22), « Orion.app » du
# Bureau est le lanceur de RECETTE (install-local.sh) ; celui-ci
# s'installe donc sous un autre nom pour ne pas l'écraser.
set -eu
HERE="$(cd "$(dirname "$0")" && pwd)"
APP="$HOME/Desktop/Orion prod locale.app"
rm -rf "$APP"
osacompile -o "$APP" "$HERE/Orion.applescript"
cp "$HERE/Orion.icns" "$APP/Contents/Resources/applet.icns"
touch "$APP"
echo "Installé : $APP"
