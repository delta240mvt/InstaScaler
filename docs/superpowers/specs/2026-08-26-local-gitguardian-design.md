# Local GitGuardian secret scanning

## Goal

Prevent accidental commits containing secrets before the repository is made open source, without adding a hosted CI workflow.

## Scope

- Install the GitGuardian CLI (`ggshield`) locally.
- Configure a repository-local pre-commit hook that runs `ggshield secret scan pre-commit`.
- Before pushing, scan only the latest commit with `ggshield secret scan commit-range "HEAD^!"`.
- Do not add GitHub Actions, application dependencies, or credentials to the repository.

## Behavior

The hook scans staged changes before a commit is created and rejects it if GitGuardian detects a secret. Before pushing, scan only `HEAD` with `ggshield secret scan commit-range "HEAD^!"`. Scan the full Git history only when the user explicitly requests it. This policy was updated on 2026-09-08 and supersedes the original plan's full-history scan requirement.

## Verification

1. Confirm that the `ggshield` CLI is available.
2. Run the hook command against a known-safe staged change and confirm it succeeds.
3. Scan only the latest commit with `ggshield secret scan commit-range "HEAD^!"`; review and remediate any findings before pushing.
