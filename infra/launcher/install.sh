#!/bin/bash
# Installe (ou réinstalle) le lanceur « Orion » sur le Bureau.
set -eu
HERE="$(cd "$(dirname "$0")" && pwd)"
APP="$HOME/Desktop/Orion.app"
rm -rf "$APP"
osacompile -o "$APP" "$HERE/Orion.applescript"
cp "$HERE/Orion.icns" "$APP/Contents/Resources/applet.icns"
touch "$APP"
echo "Installé : $APP"
