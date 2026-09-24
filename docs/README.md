# Orion documentation

[Back to the repository](../README.md)

Three starting points for exploring the project:

| Your goal | Guide |
|---|---|
| Install and use a local instance | [Setup, sign-in and troubleshooting](getting-started.md) |
| Understand how Orion works | [Architecture and code map](architecture.md) |
| Report a problem or suggest a change | [Contributing](../CONTRIBUTING.md) |

These guides are in English. The detailed design records and historical notes linked below are primarily in French; their English link labels describe their subject.

## Product and evolution

- [Changelog](../CHANGELOG.md) — documented change history.
- [Roadmap](roadmap.md) — project direction; dates belong to the original plans and are not delivery commitments.
- [Design principles](design-doctrine.md) — presentation and interaction principles.
- [Information architecture](architecture-information.md) — organisation of user journeys.

## Data and methods

| Topic | Reference |
|---|---|
| Sources, coverage and attribution | [Source register](data-sources.md) |
| Data model and ingestion | [ADR 0002](adr/0002-modele-donnees-ingestion.md) |
| Organisation identity and corporate groups | [Group identity layer](groupes-couche.md) |
| Versioned curation | [Curation guide](../backend/curation/README.md) |
| Amounts and context indicators | [Reference Engine](conception-reference-engine.md) |
| Funding breakdowns | [Public money trail](conception-b-chaine-argent-public.md) |
| NSF annual obligations | [NSF runbook](runbook-nsf-obligations.md) |
| Funding calls | [Calls design](conception-e1-appels.md) |
| Industry lenses | [Multi-lens design](conception-multi-lentilles.md) |

## Development and operations

- [Stack decisions — ADR 0001](adr/0001-stack-initiale.md).
- [Local tooling and workflows](outillage-local.md) — maintenance details.
- [Deployment and operations](../infra/README.md) — configuration, backups and server procedures.
- [Deployment design](conception-deploiement.md) — decisions and context.
- [Private access](conception-acces-prive.md) and [workspaces](conception-workspace.md).

## Reading design records

Files named `conception-*`, `chantier-*`, `plan-*` and the audits preserve the development process: assumptions, decisions, limitations and sometimes unimplemented steps. Check their dates and warnings before treating them as descriptions of the current service.

The [founding brief](../BRIEF.md), [initial phases](phases/) and [older product inventory](etat-des-lieux-produit.md) explain how the project evolved. The inventory is explicitly marked as outdated. For a first installation, use the [getting-started guide](getting-started.md).
