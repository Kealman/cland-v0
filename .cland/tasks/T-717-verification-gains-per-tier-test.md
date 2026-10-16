---
id: T-717
kind: task
title: "[verification] gains per-tier test commands, so any project's task runs, merge batches and soaks follow the tier model"
state: open
status: backlog
size: M
labels:
  - v0.1.4
  - verification
  - hub
assignee: null
parent: E-678
blocked_by:
  - T-713
  - T-715
  - T-664
  - T-665
  - T-666
topic: null
branch: null
created: 2026-10-16T19:59:44.369Z
updated: 2026-10-16T20:00:25.797Z
---

## Summary

The tier model is cland's product rule, not this repository's file lists (memo §5.6). E-614 gives `[verification]` the `prepare`, `check` and `test` commands (T-664, T-666). This ticket adds the per-tier commands, so a Python or web project gets the same rhythm: unit and component tests per task, integration in merge batches, soak at occasions and nightly. That is how the v0.2 web workbench adds Playwright scenarios without adding a minute to the task gate.

## What to build

- **The keys.** `[verification]` gains `test_unit`, `test_component`, `test_integration` and `test_soak` (command strings, empty means unset), plus `[merge] batch` and `batch_wait`, written by the template with one comment line each and settable through `cland config set`.
- **The plan.** Task runs execute `check`, `test_unit` and `test_component`; merge batches execute `test_unit` and `test_integration`; occasions and the nightly soak execute all four. Each tier's exit, duration and output tail are reported as a tier line.
- **Fallback.** A project with only `test` set keeps E-614's behaviour (the whole `test` per task, no batch tier split), and `[merge] queue` defaults to `false` for it.
- **This repository** sets the four commands to its own runner's tiers (`node hub/test/run-suite.ts --tier T1` and so on), so cland verifies itself through the same keys.
- **Docs.** `docs/agents/tests.md` and `hub/README.md` describe the keys; the onboarding's stack rule (spec v0.1.4 §3.4) records them when the stack has tiers.

## Acceptance criteria

- [ ] C1. A fixture project with a Python `test_unit` and `test_integration` runs only `check` and `test_unit` in a task verify and `test_unit` plus `test_integration` in its merge batch, proved by a suite test with the command stubs from T-665.
- [ ] C2. A project with only `test` set runs it whole per task with `[merge] queue` off, proved by a suite test.
- [ ] C3. `cland init` writes the four keys empty with their comment lines, and `cland config set verification.test_unit '<cmd>'` stores the command verbatim, proved by init and config tests.
- [ ] C4. This repository's config names its four tier commands, and a task verify at the merge head plans the same files as before the change, proved by a planning test.
- [ ] C5. `docs/agents/tests.md` and `hub/README.md` describe the per-tier commands and the batch settings.

## Blocked by

T-664 and T-666 (E-614's `[verification]` commands), T-665 (fixture command stubs).
