---
id: T-1492
kind: task
title: Batch interaction scanner falls back on every web test through web-readiness's createRequire base
state: open
status: in progress
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by: []
regression_of: T-1454
found_by: droplet
topic: topic-1251
branch: t/T-1492-batch-interaction-scanner-falls-back-on
created: 2026-10-30T19:14:07.614Z
updated: 2026-10-30T19:14:39.643Z
---

## Summary

Since restart #64 put T-1454 live, every merge batch's report-only interaction assessment lists the Web test files as fallbacks. The cause is `incomplete import graph: unsupported createRequire base [hub/src/web-readiness.ts]`. `hub/src/web-readiness.ts:14` builds its require with `createRequire(pathToFileURL(join(root, 'web/package.json')))`, and the scanner rejects that base, so every web test that reaches it falls back to the conservative path. Fallback is fail-closed (a wider selection), so nothing is mis-selected. But the report is mostly noise, and T-1488's later switch to run mode would select all Web tests for every batch.

## Evidence

Batch 5ca50cde / A-14627 (T-1471, 19:13Z) has about 28 web/test files falling back on this one cause; the log prints the list three times, 83 lines. There are also a handful of distinct causes, each listed in the item comments when picked up:
- `vm loader` (plan-approval);
- `non-literal module specifier` (mod-bridge);
- `indirect require` (suite-accounting);
- `eval or indirect module loader` (sqlite-contention);
- `unsupported createRequire base` (task-worktrees);
- `unresolved module specifier yaml` (nvim plan-component).

## What to build

Teach the T-1454 scanner the `createRequire(pathToFileURL(join(<root>, '<dir>/package.json')))` base form (a project-relative package base), so web-readiness's dependency reads resolve within the declared external-package proof. Keep the fail-closed fallback for every other dynamic form. Resolve `yaml` as a declared external package if it is one. Leave the other single-file causes as fallbacks unless the fix is mechanical, and list them in the item.

## Acceptance criteria

- [ ] C1. The batch interaction assessment for a candidate that touches `web/`, run on the reference executor, shows no `unsupported createRequire base [hub/src/web-readiness.ts]` fallbacks, and web tests are selected or excluded by their real import graph.
- [ ] C2. An unknown createRequire base (a non-literal or out-of-project path) still falls back with its current message, proven by a negative control.
- [ ] C3. The batch result notice summarises the interaction assessment (mode, phases, selected-file count, fallback counts by cause, at most 10 example paths) and points to the log for the full list, instead of inlining every path; the full list stays in the batch log and artifact.
