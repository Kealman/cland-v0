---
id: T-667
kind: task
title: Another stack's verify runs its test in full and reports the test's output
state: open
status: planned
size: M
labels:
  - v0.1.4
  - verification
assignee: null
parent: E-614
blocked_by:
  - T-666
topic: null
branch: null
created: 2026-10-16T16:35:24.761Z
updated: 2026-10-16T16:36:04.053Z
---

## Summary

Coverage selection, the hub and Neovim modes, and the load gate are cland's own and apply only when the candidate carries cland's package runner. Any other project runs its `test` in full, and when it fails, its result shows the failing command and the end of its output (E-614 C3 and C4). Demo: a scratch project with a shell-script test verifies green locally, and red with the test's output after a planted failure.

## What to build

- **cland's own suite.** The candidate carries cland's package runner when `hub/test/run-suite.ts` exists in its worktree. The code already probes that file for runner capabilities (`inheritedLease`, `reduceCoverage`). Put the one predicate in the resolver module and use it everywhere below. Apply it in the hub's submission (`#start`), not inside `selectPackageSuite`, so the selection unit tests keep their temporary repositories.
- **Fixtures.** The fixtures carry the runner stub since ticket T-665. The tests below use its other-stack option.
- **Selection** (`hub/src/suite-selection.ts`, `hub/src/hub/suites.ts`). Without cland's runner, `selectPackageSuite` is not called. The selection is `{ mode: 'full', reason: 'project test runs in full', files }`, with no coverage lookup, no `loadGate`, and no hub shard or duration lint at admission. The cache still keys on the tree, so a green tree is reused as today.
- **Modes.** In such a project, `cland verify hub` and `cland verify nvim` are refused with `hub and nvim are cland's own suite phases; this project's test runs in full: cland verify`. `cland verify` and `cland verify all` are accepted.
- **The result** (`suiteSummary`). Today a run without node test counts reports `counts unavailable (suite did not finish)` and lists failures only as node-test lines. For a run without node test counts, the summary instead names the command that failed and its exit code (`test exited 1: <line>`). It lists the last 20 lines of that command's output under `Failures:`, so a unittest, pytest, cargo or shell failure shows in the result message and not only in the log artifact.

**Keeping cland's own suite intact.** This repository and every task branch of it carry `hub/test/run-suite.ts`, so its selection, coverage, load gate, lint and summary go through exactly today's code. C5 pins that.

## Acceptance criteria

- [ ] C1. In a temporary project without `hub/test/run-suite.ts`, a submitted verify records mode `full` with reason `project test runs in full`, no `loadGate` and no coverage lookup (suite CLI test with the other-stack fixture).
- [ ] C2. In that project `cland verify hub` and `cland verify nvim` are refused with the reason, while `cland verify` and `cland verify all` are accepted (suite CLI test).
- [ ] C3. A scratch project with `check = "sh -n test.sh"` and `test = "sh test.sh"` verifies green locally. After a planted failing assertion it turns red, and its result message holds the failing line of the test's output (new CLI test against a temporary project's hub).
- [ ] C4. The summary of a failed run without node test counts reads `test exited <n>: <line>` and lists the last 20 output lines, while a node-test log keeps today's summary (unit test on `suiteSummary`).
- [ ] C5. A cland-shaped candidate keeps today's coverage selection, modes and load gate, and the existing `suite-selection.test.ts`, `suite-coverage.test.ts` and `suite-selection-report.test.ts` pass unchanged.
