# Signaler un problème ou proposer une amélioration

[Accueil du dépôt](README.md) · [Démarrage local](docs/getting-started.md) · [Architecture](docs/architecture.md)

Les retours sur Orion peuvent être rédigés **en français ou en anglais**. Le dépôt est public, mais le code reste propriétaire, tous droits réservés. Ce guide ne modifie pas ces droits et ne promet pas l’intégration des propositions.

## Ouvrir un ticket utile

Utilisez les [modèles de tickets](https://github.com/charlottecrocicchia-netizen/orion/issues/new/choose) pour un bug ou une idée. Avant de publier, vérifiez si un ticket similaire existe déjà.

Pour un bug, indiquez les étapes, le comportement attendu, le résultat observé et votre environnement. Pour une correction de données, ajoutez la source publique, l’identifiant du projet ou de l’organisation et la date de consultation. Une différence de périmètre ou de nature du montant peut expliquer un écart.

**Ne publiez pas** d’adresses personnelles, de liens magiques, de cookies de session, de listes de comptes autorisés, de secrets ou de dumps. Utilisez des exemples fictifs et masquez ces informations dans les captures et les logs. Un problème de sécurité contenant ces données ne doit pas être décrit dans un ticket public ; utilisez un canal privé déjà convenu avec la responsable du projet.

## Proposer un changement de code

Pour un changement important, commencez par un ticket expliquant le besoin et l’approche. Gardez les modifications ciblées et distinguez le comportement existant de celui proposé.

1. Suivez le [guide d’installation](docs/getting-started.md).
2. Travaillez sur une branche dédiée.
3. Ajoutez ou adaptez les tests nécessaires au comportement modifié.
4. Lancez les vérifications pertinentes :

   ```bash
   make lint
   make test
   # Pour un changement de parcours utilisateur :
   ./scripts/e2e-local.sh
   ```

5. Décrivez le résultat, la validation et les limites dans la pull request. Pour une modification purement documentaire, vérifiez les liens et les exemples ; une suite applicative complète n’est pas nécessaire.

Les migrations vont dans `backend/alembic/`, les changements d’interface doivent tenir compte des traductions FR/EN, et toute nouvelle source doit être documentée avec son origine et ses conditions d’utilisation. Ne modifiez pas une règle de calcul ou de curation sans expliquer son effet sur les résultats.
