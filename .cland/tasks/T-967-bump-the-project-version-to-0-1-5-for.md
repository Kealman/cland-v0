---
id: T-967
kind: task
title: Bump the project version to 0.1.5 for the v0.1.5 release
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-952
blocked_by: []
topic: topic-743
branch: t/T-967-bump-the-project-version-to-0-1-5-for
created: 2026-10-20T12:19:42.885Z
updated: 2026-10-20T12:35:37.482Z
closed: 2026-10-20T12:35:37.482Z
---

## Summary

D78 (2026-10-20) ships the E-952 sweep as v0.1.5. `cland release` publishes `main..dev` as committed, so the version bump is an ordinary item merged before the release, the same way T-940 did it for 0.1.4.

## What to build

Set the version to 0.1.5 everywhere it is recorded: root package.json, package-lock.json, and any `--version` source or docs that print it, matching T-940's change set. No behaviour changes.

## Acceptance criteria

- [x] C1. `node hub/bin/cland.ts --version` prints 0.1.5 and every file T-940 touched for 0.1.4 now says 0.1.5; `npm run check` is green.
  - done: impl-967 · 2026-10-20T12:21:32.340Z
  - verified: rev-23 [reviewer] · run rev-20261020-967-final · 2026-10-20T12:31:04.923Z · commit de830d2bb7097134b469e698cf55e89c2c491344

## Comments

### impl-967 · 2026-10-20T12:20:18.043Z

T-940 scope confirmed at 19533afa: package.json version and package-lock.json top-level/root-package version. Implementing 0.1.5 in those three fields; no release-note/tag changes.

### rev-23 · 2026-10-20T12:22:28.597Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-967-source
commit: de830d2bb7097134b469e698cf55e89c2c491344
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no findings. Exactly T-940's three version fields now0.1.5 in package.json/package-lock.json; CLI VERSION reads root package.json. Scripts/dependencies/behavior/notes/tags unchanged. A-7626 records source review; A-7625 precommit-identical-tree T0 and sealed CLI probe are supplemental, not a task suite receipt. C1 final verification pending normal mode-free verify at this exact head. No QA scope. Reviewer ran no tests.

### impl-967 · 2026-10-20T12:29:31.402Z

Same-head verification run 5dfdba36-0e17-4b59-90c9-3ba957ef5db4 exit 0 at de830d2bb7097134b469e698cf55e89c2c491344. T1 + fallback all T2: 2061 passed, zero failed/cancelled/skipped/todo. Remote Linux x64, c-8 lon1, Node v24.21.0, Neovim v0.12.5; droplet lifetime 352 s, cost $0.0245. A-7634 holds the receipt. Test lint and budget/ratchet diagnostics report-only; no T3/T4 receipt (deferred to periodic dev/integrated occasions). Responsible Reviewer notified to settle final verdict/C1; source head unchanged.

### rev-23 · 2026-10-20T12:31:04.923Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-967-final
commit: de830d2bb7097134b469e698cf55e89c2c491344
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no findings. A-7636 audits exact-head A-7634/run 5dfdba36: 2061 ordinary tests and 327 files pass, Linux droplet T1 + all-T2 fallback including Neovim. A-7626 source and A-7625 identical-tree local T0/sealed CLI output establish C1: 0.1.5 in T-940's fields and CLI. Host check c8d0d36d not repeated remotely; local candidate check is separate. T3/T4 deferred; lint/budgets/ratchet report-only, 12 missing baselines and duration diagnostic not timing passes. No behavior/dependency changes, no item QA. Reviewer ran no tests.

Criteria: C1 verified.

### coord · 2026-10-20T12:35:37.482Z

Merged 1ec9ccdc5143ad8e9d3c4166d773914f6d244dd5 onto dev.
