---
id: T-1953
kind: task
title: "The T1 import-graph scanner throws \"incomplete import graph: indirect require\" on suite-remote-budget.test.ts's require-shaped fixture text, forcing conservative fallback"
state: open
status: ready
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2074
blocked_by: []
topic: topic-1724
branch: t/T-1953-the-t1-import-graph-scanner-throws
created: 2026-11-17T21:19:05.454Z
updated: 2026-11-24T10:09:02.319Z
---

## Summary

Scanning T1 reachability over the current checkout, `importingTests` throws "Error: incomplete import graph: indirect require [hub/test/suite-remote-budget.test.ts]" at hub/test/suite-import-parser.ts:144, before any test runs. The file embeds a require-shaped fixture string that the scanner takes for a real indirect require. Selection then falls back to conservative inclusion. Found by impl-1950 during T-1950 (topic-1605, 2026-11-17). Every batch's interaction report lists the same fallback class for six other files: mod-bridge, plan-approval, sqlite-contention, suite-accounting, task-worktrees and nvim plan-component. So each batch selects about 470 files instead of its real importers.

## What to build

The scanner tells module-loading syntax apart from string and template content, or a test declares its fixture text explicitly, so require-shaped data no longer marks a file's import graph incomplete. Genuinely indirect loaders still fall back.

## Acceptance criteria

- [x] C1. suite-remote-budget.test.ts scans as complete, while a real indirect require in a fixture test file still reports "incomplete import graph" (test).
  - done: impl-1953 · 2026-11-24T09:07:11.254Z
  - verified: rev-40 [reviewer] · run rev-40-20261124-1953-final · 2026-11-24T10:09:00.613Z · commit a27abab82494ca5bb0822ab47cc233ebadf1ec5f
- [x] C2. The six other fallback files are each classified as either a real indirect loader that stays a fallback or a false positive that is fixed, and the change in batch selection count is reported (test or artifact).
  - done: impl-1953 · 2026-11-24T09:07:32.627Z
  - verified: rev-40 [reviewer] · run rev-40-20261124-1953-source · 2026-11-24T09:32:48.808Z · commit a27abab82494ca5bb0822ab47cc233ebadf1ec5f
  - verified: rev-40 [reviewer] · run rev-40-20261124-1953-final · 2026-11-24T10:09:00.613Z · commit a27abab82494ca5bb0822ab47cc233ebadf1ec5f

## Comments

### impl-1953 · 2026-11-24T09:06:21.632Z

Red regression reproduced indirect require at suite-import-parser.ts:144. Renamed two boolean helper parameters; no parser contract change. C2 classification and source census: A-22775. Correction to artifact base label: actual worktree source base was 8d3968920, not triage dev 5c9533cc9; fetched/merged origin/dev 8a5ac9686 (tracker-only changes) before review. Local macOS Node 24.21.0: suite-task-selection 12/12, suite-remote-budget 19/19, suite-accounting 26/26. Static unrelated-path T2/Web fallback count 9 to 8; total graph unknown roots 21 to 19. No suite receipt yet.

### rev-40 · 2026-11-24T09:32:48.808Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261124-1953-source
commit: a27abab82494ca5bb0822ab47cc233ebadf1ec5f
scope: full
findings: [{"severity":"low","text":"Archived census import ../hub/src resolves relative to artifact directory; README26 names absent t1953-census.ts without placement. Document intended checkout-subdirectory placement or root-aware invocation so the static projection can be replayed.","file":".cland/artifacts/A-22775-t-1953-regression-and-six-fallback-classifications/census.ts","line":2}]
finding_counts: {"high":0,"medium":0,"low":1}

Source clear; one low evidence-replay finding atA-22775/census.ts:2 (relative ../hub import needs checkout placement; README26 names absent script). No high/medium. Two positional boolean renames preserve fixture behavior; parser/policy unchanged, actual-source regression checks known import and genuine indirect-require rejection. C2 classifications verified against six sources and external-resolution rule; yaml belongs tohub, not Neovim ancestors. Current manifest1034/500T2-Web denominator matches; reported static unknown21→19/additions9→8 is not a suite count/speedup or confirmation of original470estimate. Source base correction8d3968920 retained. C1 remains run-dependent/unverified pending exact-head configured receipt; reported local12/19/26checks/static exits do not substitute. No reviewer runs/edits.

Criteria: C2 verified.

### rev-40 · 2026-11-24T10:09:00.613Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261124-1953-final
commit: a27abab82494ca5bb0822ab47cc233ebadf1ec5f
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear. Exact-head e8294b83/A-22817/canonicaltree250972ec finishedpassed. C1 named real-source/indirect-require regression11913pass +5/5gate12253; all12task-selection/19remote-budget/26accounting bases pass. C2 source classifications/static9→8projection retained with source-base correction; not actual batch/suite speedup. A-22791 resolves historicalL1 replay placement without head change. T0/T1/fallbackT2/selectedT3/Web exit0;7selectedT3/T4files100identities once/no repetitions, restT3batch/T4unexecuted. Noncached Linuxx64/c-8nyc1/Node24.21/Nvim0.12.5/workers2/HeadlessShell1248-CfT156. Supplied7462pass1Macskip0fail; advisory budgets retained. No current findings, no reviewer runs/edits.

Criteria: C1 verified, C2 verified.
