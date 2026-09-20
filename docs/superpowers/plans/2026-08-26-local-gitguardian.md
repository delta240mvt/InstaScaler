# Local GitGuardian Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Block locally committed secrets with GitGuardian and establish a clean secret-scan baseline before the repository is public.

**Architecture:** Install `ggshield` in an isolated local Python environment through `pipx`, authenticate it with a personal GitGuardian token stored outside the repository, then create the repository's Git pre-commit hook with `ggshield install --mode local`. The hook scans staged changes; separate one-time scans cover committed history and the full working tree.

**Tech Stack:** Git, GitGuardian `ggshield`, pipx, Python 3.10, PowerShell.

## Global Constraints

- No GitHub Actions, remote CI, application dependency, or token committed to the repository.
- Authentication is a GitGuardian personal access token with the `scan` scope, stored only in GitGuardian's user configuration or `GITGUARDIAN_API_KEY` outside the repository.
- The local pre-commit hook must fail closed when it detects a secret or cannot reach GitGuardian.
- A detected secret is never printed in plaintext in terminal output or committed to Git.

---

### Task 1: Install and authenticate GitGuardian CLI

**Files:**
- Modify: user-local Python tool environment only (managed by `pipx`)
- Modify: user-local GitGuardian configuration only

**Interfaces:**
- Consumes: Python 3.10 and internet access.
- Produces: `ggshield` on `PATH`, authenticated with a personal token that has the `scan` scope.

- [ ] **Step 1: Install pipx in the user-local Python environment**

Run:

```powershell
python -m pip install --user pipx
python -m pipx ensurepath
```

Expected: `pipx` is installed without modifying the repository.

- [ ] **Step 2: Install ggshield in an isolated pipx environment**

Run:

```powershell
python -m pipx install ggshield
ggshield --version
```

Expected: the second command prints a ggshield version.

- [ ] **Step 3: Authenticate without writing a token into the repository**

Run:

```powershell
ggshield auth login
```

Expected: the browser login completes and ggshield stores the personal access token in its user configuration. Do not set or commit `GITGUARDIAN_API_KEY` in any project file.

- [ ] **Step 4: Verify authentication**

Run:

```powershell
ggshield api-status
```

Expected: success response from GitGuardian; no token value appears in the terminal.

### Task 2: Install and test the local pre-commit hook

**Files:**
- Modify: `.git/hooks/pre-commit` (local Git metadata; intentionally not versioned)

**Interfaces:**
- Consumes: authenticated `ggshield` executable from Task 1.
- Produces: Git pre-commit hook that calls `ggshield secret scan pre-commit` on staged content.

- [ ] **Step 1: Install the hook for this repository**

Run:

```powershell
ggshield install --mode local --hook-type pre-commit
```

Expected: `.git/hooks/pre-commit` is created and the command confirms that it is ready to scan.

- [ ] **Step 2: Confirm the generated hook calls the pre-commit scanner**

Run:

```powershell
Get-Content -Raw .git/hooks/pre-commit
```

Expected: it invokes `ggshield secret scan pre-commit`; it contains no credentials.

- [ ] **Step 3: Test a safe staged change without creating a commit**

Run:

```powershell
$testPath = '.gitguardian-hook-smoke-test.txt'
Set-Content -NoNewline -Path $testPath -Value 'GitGuardian hook smoke test: no secret here.'
git add -- $testPath
& .git/hooks/pre-commit
$hookExit = $LASTEXITCODE
git restore --staged -- $testPath
Remove-Item -LiteralPath $testPath
exit $hookExit
```

Expected: exit code `0`; the temporary file is removed and no commit is created.

### Task 3: Audit the public repository surface

**Files:**
- Read: complete Git history and current working tree
- Create: no scan reports inside the repository

**Interfaces:**
- Consumes: authenticated ggshield CLI and working pre-commit hook.
- Produces: pass/fail determination for open-source publication.

- [ ] **Step 1: Scan every committed revision**

Run:

```powershell
ggshield secret scan repo .
```

Expected: exit code `0` and no incidents. If it fails, record only detector name, file path, and commit identifier; revoke and replace any real credential before rewriting affected public history.

- [ ] **Step 2: Scan the current working tree**

Run:

```powershell
ggshield secret scan path -r .
```

Expected: exit code `0` and no incidents. If it fails, remove the finding from any files that could be added or published; do not echo the secret value.

- [ ] **Step 3: Confirm main is clean and protected locally**

Run:

```powershell
git status --short --branch
Get-Content -Raw .git/hooks/pre-commit
```

Expected: `main` remains aligned with `origin/main`, the hook is present, and any pre-existing untracked files remain unmodified.
