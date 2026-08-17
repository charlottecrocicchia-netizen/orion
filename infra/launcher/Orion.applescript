-- Le lanceur Orion : un double-clic, tout démarre, Firefox s'ouvre.
-- Les échecs remontent en dialogue court ; le détail vit dans
-- ~/Library/Logs/orion-launcher.log.
try
	do shell script "/Users/charlottecrocicchia/dev/orion/infra/launcher/orion-launcher.sh"
on error errMsg
	display dialog "Orion n'a pas pu démarrer." & return & return & errMsg buttons {"OK"} default button 1 with icon stop with title "Orion"
end try
