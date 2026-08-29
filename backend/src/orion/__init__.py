"""Version unique : celle du paquet installé, donc de pyproject.toml.

Le 0.1.0 codé en dur ici avait survécu au bump v0.4.0 (87f39eb) — la
page à-propos affichait deux versions contradictoires pendant 26 jours
(audit Hygiène, G1). Une release = bumper pyproject.toml (et le
package.json du frontend) ; rien d'autre.
"""

from importlib.metadata import PackageNotFoundError, version

try:
    __version__ = version("orion-backend")
except PackageNotFoundError:  # arbre non installé (outil isolé, doc build)
    __version__ = "0.0.0"
