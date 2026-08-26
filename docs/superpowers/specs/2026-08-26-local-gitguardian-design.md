# Local GitGuardian secret scanning

## Goal

Prevent accidental commits containing secrets before the repository is made open source, without adding a hosted CI workflow.

## Scope

- Install the GitGuardian CLI (`ggshield`) locally.
- Configure a repository-local pre-commit hook that runs `ggshield secret scan pre-commit`.
- Scan the committed Git history and the current working tree once before publication.
- Do not add GitHub Actions, application dependencies, or credentials to the repository.

## Behavior

The hook runs before a commit is created and rejects it if GitGuardian detects a secret. Developers can technically bypass local hooks with Git's `--no-verify`, so a clean full-history scan remains the release gate before publishing the repository.

## Verification

1. Confirm that the `ggshield` CLI is available.
2. Run the hook command against a known-safe staged change and confirm it succeeds.
3. Run scans for the complete Git history and working tree; review and remediate any findings before making the repository public.
