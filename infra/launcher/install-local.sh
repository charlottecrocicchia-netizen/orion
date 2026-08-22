#!/bin/bash
# Installe (ou réinstalle) sur le Bureau les deux applications du
# confort local : « Orion.app » (démarrer + ouvrir Firefox) et
# « Stop Orion.app » (arrêt propre). Même icône que le lanceur
# historique (Orion.icns, versionnée ici).
set -eu
HERE="$(cd "$(dirname "$0")" && pwd)"

APP="$HOME/Desktop/Orion.app"
rm -rf "$APP"
osacompile -o "$APP" "$HERE/OrionLocal.applescript"
cp "$HERE/Orion.icns" "$APP/Contents/Resources/applet.icns"
touch "$APP"
echo "Installé : $APP"

STOP_APP="$HOME/Desktop/Stop Orion.app"
rm -rf "$STOP_APP"
osacompile -o "$STOP_APP" "$HERE/StopOrion.applescript"
cp "$HERE/Orion.icns" "$STOP_APP/Contents/Resources/applet.icns"
touch "$STOP_APP"
echo "Installé : $STOP_APP"
