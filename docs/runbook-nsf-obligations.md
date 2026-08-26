# Runbook — obligations annuelles d'awards NSF (R5B)

> **Objet** : acquérir, valider et ingérer le snapshot officiel
> « NSF by the Numbers » qui porte la métrique *Share of NSF award
> obligations*. Contrat méthodologique gelé :
> `docs/conception-r5-budget-denominators.md` § 19 et § 20.1 (C1-C5).
> Cadence : **annuelle** — le dashboard est mis à jour « annually when
> the fiscal year is complete » ; chaque mise à jour est un nouveau
> millésime, jamais une réécriture (la série officielle est restatée
> sans archives : les millésimes d'Orion en deviennent l'archive).

## 1. Ce qu'on acquiert

| Artefact | Feuille Tableau | Contenu |
|---|---|---|
| `award-details-fy<YYYY>.tsv` × 15 (FY2011 → dernier FY clos) | `@Award Details Sheet` (métrique **Award Obligation** sélectionnée) | Les lignes officielles (agrégat Tableau : un award se scinde par funding division, institution, État d'exécution, managing division…) — **numérateur ET dénominateur** (§ 20.1 C1) |
| `trend-awards-obligated-amount-blue.tsv` / `-gold.tsv` | `Trend-Awards Obligated Amount (Blue/Gold)` | La série agrégée de contrôle (FY2016+ seulement : fenêtre décennale de la vue) |

Chaque artefact est accompagné d'un sidecar `<nom>.tsv.meta.json` :
URL source, feuille, filtres, horodatage UTC, version du codebook,
octets, SHA256, méthode. **Un artefact sans sidecar, ou dont le SHA
diverge, est refusé à l'ingestion.** Aucun chiffre n'est jamais retapé.

**Deux espaces, deux rôles** (consigne fondatrice du 2026-08-26) :

```text
<ORION_ROOT>/.research-downloads/r5/nsf/     # acquisition — temporaire, git-ignoré
<ORION_ROOT>/backend/data/r5-nsf/<vintage>/  # magasin DURABLE — la provenance
```

L'acquisition écrit dans le premier ; la **promotion** vers le second
est le geste de validation (copie + vérification SHA256 de chaque
artefact contre son sidecar + MANIFEST). Le magasin durable suit le
régime `data/` d'Orion (sources brutes hors git) avec une différence
capitale : **ces artefacts ne sont pas re-téléchargeables à
l'identique** (la série officielle est restatée sans archives) — le
dossier de millésime est la seule archive brute. La garantie hors du
poste d'acquisition tient à deux choses : la base versionnée porte
lignes + SHA256 + provenance (dumpée et sauvegardée comme le reste), et
**le dossier `backend/data/r5-nsf/` doit être copié sur le VPS (rsync)
au déploiement R5** — geste à inscrire au runbook de déploiement le
jour du GO, comme le transfert du dump.

## 2. Acquisition

### Voie normale — script HTTP (stratégie A, ~1 h)

Les scripts sont VERSIONNÉS dans `backend/scripts/nsfacquire/`
(`tableau_client.py`, `acquire.py`, `make_manifest.py`,
`validate_final.py`) — Python 3 système, zéro dépendance. Ils écrivent
dans `.research-downloads/r5/nsf/` (copier les scripts dans son
sous-dossier `tools/` ou les lancer avec le répertoire de travail
adapté), la campagne complète prend **~45-55 min** :

```bash
cd <ORION_ROOT>/.research-downloads/r5/nsf/tools   # y copier les scripts au besoin
python3 acquire.py awards        # 15 FY, ~3,2 min/FY (génération serveur ~2,5-3 min)
python3 acquire.py trends        # ~30 s
python3 make_manifest.py
python3 validate_final.py
```

Puis la **promotion** (le geste de validation) :

```bash
mkdir -p <ORION_ROOT>/backend/data/r5-nsf/<AAAA-MM-JJ>
cp -p <ORION_ROOT>/.research-downloads/r5/nsf/{award-details-fy*.tsv*,trend-*.tsv*,MANIFEST.json} \
      <ORION_ROOT>/backend/data/r5-nsf/<AAAA-MM-JJ>/
# vérifier chaque SHA256 contre son sidecar avant d'ingérer
```

Reprise automatique : un FY dont le fichier ET le meta existent est
sauté ; 3 tentatives par FY avec réouverture de session.

Protocole sous-jacent (documenté au run du 2026-08-26) :
`GET /views/NSFbyNumbers/<vue>` → `POST /vizql/.../startSession/viewing`
(session dans `X-Session-Id`) → `bootstrapSession` →
`commands/tabdoc/dashboard-categorical-filter` →
`commands/tabsrv/export-crosstab-to-csvserver` → `GET .../tempfile/...
?key=<resultKey>&attachment=yes`, octets écrits tels quels.

**Les deux pièges connus, résolus mais à connaître :**

1. `@Award Details Sheet` est **vide** tant que la métrique n'est pas
   posée : filtre « Select Award Metrics 1 » avec la valeur de domaine
   exacte **« Award Obligation ($M) »** — le libellé de la carte
   (« Award Obligation ») est accepté sans erreur mais laisse la
   feuille vide (export 400 « The crosstab has no data »).
2. La feuille « Filters Used » est **structurellement vide en session
   invitée** (export 400 systématique) : les filtres sont consignés
   dans les sidecars, aucun `filters-used-*.tsv` n'existe.

### Voie de secours — intervention fondatrice

**Règle de téléchargement (CLAUDE.md, 2026-08-26, prioritaire)** :
Claude ne déclenche JAMAIS un téléchargement navigateur (aucun clic
Download/Crosstab/CSV, aucun `blob:`) — la boîte native macOS est
interdite. Si le protocole A casse (Tableau mis à jour) et qu'aucune
méthode HTTP/capture réseau ne fonctionne, Claude s'arrête et dit :
« Téléchargement navigateur requis — intervention utilisateur
nécessaire. » La fondatrice fait alors l'export UI elle-même
(dashboard → carte KPI « Award Obligation » → Filters → un FY →
Details → Télécharger → Tableau croisé → `@Award Details Sheet` →
CSV) et dépose le fichier dans `.research-downloads/r5/nsf/` — un
téléchargement manuel de l'artefact officiel est accepté, **une
transcription manuelle de valeurs ne l'est jamais** (§ 20.1 C2). Le
sidecar meta est ensuite écrit par script (mêmes champs, `method`
distinct).

## 3. Format des artefacts (constaté sur pièces, 2026-08-26)

- « CSV » Tableau = **tabulé UTF-16LE avec BOM FF FE**, fins de ligne
  **LF** ; champs contenant tab/retour/guillemet **quotés façon CSV**
  (guillemets doublés).
- **32 colonnes** dont une vide finale ; certains noms portent des
  espaces traînants (« Award Obligation Amount␣␣ ») — le parseur
  d'Orion strippe les noms et lit le dialecte en mode strict.
- Montants au format de la locale de session (`$1,234,567.00` ou
  `$1 234 567,00`) ; la vue Trends abrège en millions (`$8,601.82M`).
- ~21-24 k lignes et 26-30 Mo par FY.

## 4. Ingestion et validation de millésime

```bash
cd backend && uv run orion-ingest nsf-obligations
# défaut : le DERNIER millésime de backend/data/r5-nsf/ ;
# répertoire non standard : ORION_NSF_OBLIGATIONS_DIR=…
```

**Reconstruction d'une base R5 sans le poste d'acquisition** : il
suffit du dossier de millésime `data/r5-nsf/<vintage>/` (copié du VPS
ou d'une sauvegarde) et de cette commande — aucun accès au dashboard
n'est nécessaire, aucun chiffre retapé.

Le chargeur (`orion/ingest/nsfobligations/`) : vérifie sidecar + SHA256,
parse en refus bruyant (dialecte strict ; une ligne rigoureusement
identique dupliquée = artefact corrompu, refusé), calcule par
FY le total officiel, la part joignable (`award_id` ↔
`participations.source_uid`, source `nsf`), la couverture, et le
contrôle Σ détails ↔ série Trends (tolérance : **5 000 $**, l'arrondi
d'affichage du centime de million). Vintage du jour, append-only —
rejouer le même jour remplace la vintage du jour, jamais une
antérieure. Un FY dont la couverture passe sous **0,95** ou dont le
contrôle Trends casse est marqué **indisponible** : la surface le
refuse, jamais de zéro, jamais de repli (§ 19.6).

Contrôle de non-régression du millésime : les gold tests
(`backend/tests/test_nsf_obligations_gold.py`) ingèrent les artefacts
réels et verrouillent les totaux, la série Trends et les quatre Award
IDs de preuve R5A (`1902627`, `2221247`, `2102180` absent, `1823600`).
Ils tournent sur tout poste où les artefacts sont présents.

## 5. Après ingestion

- La surface `/nsf-obligations` lit **la dernière vintage** ; l'API :
  `GET /api/nsf-obligations/meta` et `/aggregate?fy=…&by=…`.
- Toute divergence entre deux millésimes (restatement officiel) est
  visible en base (`nsf_obligation_totals` par vintage) — jamais
  écrasée, jamais lissée.
