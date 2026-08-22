-- Stop Orion.app : arrête proprement l'API et le frontend locaux
-- (la base de dev reste allumée — coût négligeable).
try
	set result to do shell script "/Users/charlottecrocicchia/dev/orion/scripts/orion-local-stop.sh"
	display notification result with title "Orion local"
on error errMsg
	display dialog "L'arrêt a rencontré un problème." & return & return & errMsg buttons {"OK"} default button 1 with icon caution with title "Orion local"
end try
