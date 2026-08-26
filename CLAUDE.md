# Orion — instructions projet pour Claude Code

## External downloads / research artifacts

**Règle fondatrice du 2026-08-26, prioritaire sur toute instruction de
chantier (R5B inclus).**

- **Aucun téléchargement via le navigateur.** Ne jamais cliquer
  `Download`, `Crosstab`, `CSV`, `Excel`, un lien `blob:` ni aucun
  mécanisme susceptible d'ouvrir la boîte native macOS
  « Enregistrer sous » — même avec l'intention de choisir ensuite une
  autre destination.
- **Aucun fichier hors du projet.** Jamais dans `~/Downloads`, le
  Bureau, ni `/tmp` système — `~/Downloads` n'est pas un espace
  temporaire acceptable, même pour déplacer le fichier ensuite.
- **Destination unique** de tout fichier externe de recherche (CSV,
  Excel, PDF, export Tableau, archive, artefact source…) :

  ```text
  <ORION_ROOT>/.research-downloads/r5/<source>/
  ```

  (git-ignoré ; créer le sous-dossier au besoin). La promotion d'un
  fichier vers un répertoire de provenance versionné est une décision
  fondatrice explicite, jamais automatique.
- **Méthodes autorisées** : requête HTTP directe depuis le shell avec
  écriture explicite (`curl … -o <ORION_ROOT>/.research-downloads/…`
  ou équivalent déterministe) ; capture réseau/devtools ; réponse HTTP
  interceptée ; données déjà en mémoire/cache contrôlé. Pour Tableau,
  le protocole HTTP pur documenté dans
  `docs/runbook-nsf-obligations.md` (§ 2) est la voie de référence.
- **Si aucune méthode sans boîte native n'existe : S'ARRÊTER** et dire
  exactement « Téléchargement navigateur requis — intervention
  utilisateur nécessaire. » — ne cliquer sur rien.
- **Transmettre cette règle à tout sous-agent** qui touche au réseau ou
  au navigateur, dans son prompt de mission.
