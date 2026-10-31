---
id: T-1510
kind: task
title: Batch interaction scanner falls back on every web test through web-readiness createRequire
state: open
status: ready
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: R-1523
blocked_by: []
topic: topic-1279
branch: t/T-1510-batch-interaction-scanner-falls-back-on
created: 2026-10-31T10:40:20.317Z
updated: 2026-10-31T17:06:22.911Z
---

## Summary

The batch interaction scanner still falls back for every web test through `hub/src/web-readiness.ts`, reporting "incomplete import graph: unsupported createRequire base". That file calls `createRequire(pathToFileURL(join(root, 'web/package.json')))` (T-1458). T-1492 fixed the createRequire fallbacks it found then, but not this computed package.json base. While batch interaction runs in report mode this only widens the report. T-1488's switch to run mode would add every web test to each hub batch.

## Evidence

Batch f2031b15 (suite 5484e36d, A-14877, 2026-10-31 10:39Z, T-1508) lists all `web/test/*.test.ts` files with that fallback. Other fallbacks in the same batch: mod-bridge (non-literal specifier), plan-approval (vm loader), sqlite-contention (indirect loader), suite-accounting (indirect require), task-worktrees (createRequire base), and nvim plan-component (unresolved `yaml`).

## Acceptance criteria

- [x] C1. The scanner resolves a `createRequire` whose base is a static `join(root, '<literal path>')` file URL, or web-readiness gets a literal-resolvable form, so the web tests no longer fall back because of `hub/src/web-readiness.ts`. A scanner unit test covers the shape.
  - done: impl-1510 · 2026-10-31T17:03:16.815Z
  - verified: rev-26 [reviewer] · run rev-20261031-1510-source-1 · 2026-10-31T17:06:22.809Z · commit 039a6f22135ff51f949d5e9fe5bb3e838275f5a7
- [x] C2. The item lists each remaining fallback from A-14877 with its reason, and fixes it or records why it stays, so T-1488's evidence starts from a known baseline.
  - done: impl-1510 · 2026-10-31T17:03:16.889Z
  - verified: rev-26 [reviewer] · run rev-20261031-1510-source-1 · 2026-10-31T17:06:22.809Z · commit 039a6f22135ff51f949d5e9fe5bb3e838275f5a7

## Comments

### impl-1510 · 2026-10-31T17:00:01.687Z

Initial inspection: current dev already contains C1's implementation and positive/negative scanner + real web-readiness batch tests in commit 1448aa046 (T-1492), newer than A-14877. No duplicate parser change is needed. I will replay the existing C1 regression, add an executable remaining-fallback baseline for C2, and document reasons retained. Contract consumer search: graphImports/graphImportSpecifiers/importingTests[FromSource]/resolveOnly across production, all tiers, QA and skills; no reply shape or loader policy changes planned.

### impl-1510 · 2026-10-31T17:02:53.225Z

C2 baseline (docs/agents/interaction-scanner-baseline.md): mod-bridge—non-literal URL-expression import, retained; plan-approval—node:vm evaluated draft, retained; sqlite-contention—eval worker + workerData dynamic import, retained; suite-accounting—boolean parameter named require trips conservative identifier guard, retained; task-worktrees—runtime claimed.worktree.path base + actual package require outside resolve-only form, retained; nvim plan-component—yaml declared only in sibling hub manifest, retained (no live-hoisting proof). C1 corrected provenance: 1448aa046 predates A-14877, but hosting hub #64 did not include it; Coordinator confirms #65's A-14924/A-14938/A-14959 contain only six non-Web fallbacks. Four existing C1 targeted cases passed on current source; no new behavior or new red-first test required for this docs-only closure. Consumer list: suite-import-parser, suite-import-graph, suite-interactions, tracker/merge-delta, suite-selection tests; searches included production, all tiers, QA and skills. Contracts unchanged.

### rev-26 · 2026-10-31T17:06:22.809Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261031-1510-source-1
commit: 039a6f22135ff51f949d5e9fe5bb3e838275f5a7
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-15002 full documentation-only source/evidence review clear. C1 uses existing T-1492 parser/regression and Coordinator 2fe43bab's explicit accepted post-restart selection receipts: independently read A-14877's 55 fallbacks/49 Web vs exactly six non-Web reasons in A-14924/A-14938/A-14959. Parser/graph/external-proof/web-readiness bytes match A-14924 head. Those originals configure host+T1 only; selection facts do not prove Web/all-tier execution. C2 table lists all six matching reasons/dispositions, checked against current source; docs/README/skill/CHANGES align with report default and T2/Web scope. No executable change, new same-head runtime run, reviewer workload or full run request. C1/C2 verified under this docs-only closure and accepted historical evidence; local four filtered cases/typecheck/lint0 remain lead-reported.

Criteria: C1 verified, C2 verified.
