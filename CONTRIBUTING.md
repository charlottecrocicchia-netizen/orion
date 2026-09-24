# Report an issue or suggest an improvement

[Repository home](README.md) · [Local setup](docs/getting-started.md) · [Architecture](docs/architecture.md)

Please write issues and pull requests in **English** so everyone can follow the discussion. The repository is public, but the software remains proprietary, all rights reserved. This guide does not change those rights or guarantee that proposals will be accepted.

## Open a useful issue

Use the [issue templates](https://github.com/charlottecrocicchia-netizen/orion/issues/new/choose) for bugs and ideas. Before posting, check whether a similar issue already exists.

For bugs, include reproduction steps, expected behaviour, actual results and your environment. For data corrections, include the public source, project or organisation identifier, and access date. Differences in coverage or accounting basis may explain a discrepancy.

**Do not publish** personal email addresses, magic links, session cookies, approved-account lists, secrets or database dumps. Use fictitious examples and redact screenshots and logs. Security reports containing these details must not go into a public issue; use a private channel already agreed with the project maintainer.

## Propose a code change

For significant changes, start with an issue describing the need and proposed approach. Keep changes focused and explain the difference between existing and proposed behaviour.

1. Follow the [setup guide](docs/getting-started.md).
2. Work on a dedicated branch.
3. Add or adapt tests for the behaviour you change.
4. Run the relevant checks:

   ```bash
   make lint
   make test
   # For changes to user journeys:
   ./scripts/e2e-local.sh
   ```

5. Describe the result, validation and limitations in the pull request. For documentation-only changes, check links and examples; a full application test run is not required.

Migrations belong in `backend/alembic/`, interface changes must account for English/French translations, and new sources must document their origin and terms of use. Explain the effect on results whenever changing a calculation or curation rule.
