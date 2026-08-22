-- Orion.app (Bureau) : un double-clic → Orion LOCAL de recette démarre
-- (base de dev au corpus complet, auth en mode dev) → Firefox s'ouvre
-- sur /login. Le détail vit dans ~/Library/Logs/Orion/launcher.log.
try
	do shell script "/Users/charlottecrocicchia/dev/orion/scripts/orion-local.sh"
on error errMsg
	display dialog "Orion local n'a pas pu démarrer." & return & return & errMsg buttons {"OK"} default button 1 with icon stop with title "Orion local"
end try
