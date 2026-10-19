---
id: T-857
kind: task
title: On an existing project the Aide imports the open GitHub issues on yes itself, and files "what next" as the first release
state: open
status: backlog
size: S
labels:
  - v0.1.4
  - ready-for-agent
assignee: null
parent: E-616
blocked_by:
  - T-856
topic: null
branch: null
created: 2026-10-19T08:10:03.027Z
updated: 2026-10-19T08:10:03.027Z
---

## Summary

The existing-project path loses its workarounds. The Aide runs `cland task import-github` itself on the human's yes: open issues only, closed ones untouched, `--repo` read from the `github` remote. It reports the count and files "what next" as the first release from the imported issues and new tasks. The brief's fallback for "existing" follows setup's rule (T-844).

## What to build

- **EXISTING.md step 3.**
  - On yes, `cland task import-github`, with no `--repo` because the import reads `github`, then `origin`.
  - The "Today the hub refuses the import" paragraph goes.
  - The report counts the imported items (`cland task list --state open --json`), and the import's own output names them.
  - Closed issues and pull requests stay on GitHub. Another tracker is only named.
- **EXISTING.md step 4** keeps the accepted flow: an imported issue joins the release with `cland task link T-<n> --parent R-<m>`, a size and status planned.
- **SKILL.md "The brief".** `existing` when a file beside cland's own paths is tracked, or is untracked and not ignored; else `empty`. This is the same rule as setup's T-844.
- **T2 case.** An Aide in an in-process hub whose project has a `github` remote and a fake `gh` with two open issues and one closed runs `task import-github`. Two items appear, and `task link --parent R-1`, `task edit --size S --status planned` are accepted on one of them.

## Acceptance criteria

- [ ] C1. EXISTING.md step 3 runs `cland task import-github` on the human's yes with no refusal workaround, and says that closed issues and pull requests stay on GitHub (source review).
- [ ] C2. SKILL.md "The brief" classifies a folder as `existing` when a file beside cland's paths is tracked or untracked and not ignored, as T-844 does (source review against T-844's rule).
- [ ] C3. Run as an Aide against an in-process hub with a fake `gh`, the import brings the two open issues and not the closed one, and the step's link, size and status lines are accepted on an imported item (T2).
