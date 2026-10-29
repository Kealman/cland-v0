---
id: T-1437
kind: task
title: "Test lint: an existing T3 file that loses its T3 header is refused with a misleading 'exceeds frozen allowance 0' message"
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: topic-1199
branch: t/T-1437-test-lint-an-existing-t3-file-that-loses
created: 2026-10-29T04:26:29.075Z
updated: 2026-10-29T17:34:18.201Z
closed: 2026-10-29T17:34:18.201Z
---

## Summary

Found on T-1413 (topic-1171, 2026-10-29). An import placed above the `// T3: …` header of `hub/test/telegram-polling-restart.test.ts` made `analyzeTestSource` treat the file as not lifecycle. The admission lint then refused it with `startDaemon count 3 exceeds frozen allowance 0`. That message points at the frozen baseline, which can only shrink, instead of at the lost header. The `t3-lifecycle` finding that names the real cause is emitted only for new files.

## What to build

When a file mapped T3 (or T4) has no `T3:` header in its leading comment block, the refusal names that cause: "first comment block must name the process behaviour", with the file and line, for existing files too. Process-call counts against the baseline only apply after that.

## Acceptance criteria

- [x] C1. An existing T3 file whose header is preceded by an import is refused with the t3-lifecycle message naming the header, not a frozen-allowance count.
  - done: impl-1437 · 2026-10-29T17:03:06.772Z
  - verified: rev-26 [reviewer] · run rev-20261029-1437-evidence-1 · 2026-10-29T17:24:40.382Z · commit 886dfbf7845b985f5fd1f7ac64662b5c1c139add
- [x] C2. An existing T3 file with its header keeps its current lint result unchanged.
  - done: impl-1437 · 2026-10-29T17:03:07.190Z
  - verified: rev-26 [reviewer] · run rev-20261029-1437-evidence-1 · 2026-10-29T17:24:40.382Z · commit 886dfbf7845b985f5fd1f7ac64662b5c1c139add

## Comments

### impl-1437 · 2026-10-29T17:00:27.253Z

Consumer inventory before policy change (rule 20): checkTestLint/testLintPolicy feed verify admission (hub/src/hub/suite-candidate.ts), merge (hub/src/territory.ts), CLI census/refusal formatter (hub/test/lint-tests.ts), warmer and frozen-baseline validation (test-lint-policy.ts), component fixture (suite-component-fixture.ts). Direct facts consumers retain the TestLintFinding shape/rule union. Tests: test-lint.test.ts, test-lint-policy.test.ts, suite-admission.test.ts, suite-admission-native.test.ts, merge-gate.test.ts; T3/T4 callers searched repository-wide. QA E-676 L5 and E-677 consume the existing T3 diagnostic; it stays byte-for-byte unchanged. No wire/client/persisted record shape changes; web/Neovim only display existing generic refusal strings. Docs: hub/README.md, docs/agents/tests.md; shipped skills have no exact diagnostic dependency. Plan: surface lifecycle finding for existing T3/T4, suppress misleading process-count refusals until lifecycle declaration is valid; retain wall-clock enforcement and manifest contract/scenario exemptions. hub/src files planned: test-lint.ts and test-lint-policy.ts.

### impl-1437 · 2026-10-29T17:02:32.187Z

Coordinator scope clarification (topic-1199): preserve never-headed existing debt. Final implementation is only hub/src/test-lint-policy.ts; direct census is unchanged. Existing T3/T4 missing lifecycle refuses only when base source supplied a declaration or process calls would otherwise exceed allowance. Header refusal replaces process-count consequences; independent wall-clock rules remain. T1 tests cover displaced T3/T4 headers at allowance 0/3, loss without process calls, never-headed/headed unchanged results, and all five process helpers. Local macOS Node run: 38/38 in touched test-lint.test.ts; root npm run typecheck passed. No Linux/full suite evidence yet. SKILL.md untouched under freeze; Coordinator holds proposed rule/skill wording.

### rev-26 · 2026-10-29T17:08:06.439Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261029-1437-source-1
commit: 886dfbf7845b985f5fd1f7ac64662b5c1c139add
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13839 full6-file audit clear. Standards T1 source-as-data cases/guide/index/shared docs and Rule20 consumers checked, direct census/baseline/shape untouched; tracker-only merge provenance pinned. Spec matches Coordinator32269e67: detect base lifecycle loss or missing lifecycle exposing process-count growth, emit exact header cause and suppress only process consequences; wall-clock and headed/never-headed-within-allowance behavior retained, contract/scenario declaration valid. No findings. Local A13834 summary not configured evidence; C1/C2 runtime pending. Exact-head modefree then original named execution/load/census review; no Reviewer workload/full-all request.

### rev-26 · 2026-10-29T17:24:40.382Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261029-1437-evidence-1
commit: 886dfbf7845b985f5fd1f7ac64662b5c1c139add
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13854 original A-13853 audited. Standards actual lint retains t3-lifecycle33/currentzero refusals, sourceA13839 intact. C1 displaced-header exactdiagnostic/no process-count case passes0.003996827s, losswithouthelpers0.022978414s; C2 headed/neverheaded unchanged control0.002516719s. Full38test-lint cases pass;3new×5load pass,max0.343681953s. Full4163ordinary+90load/no nonpass or unfinished; configuredT0/T1/T2/Web complete, explicit hostgateed8157f6 reused; T3/T4 unrun. Report-only budgets/lint retained/no enforcement pass claimed. Local summary provenance separate; no Reviewer workloads. C1/C2 verified frozenhead, QA none.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-29T17:34:18.201Z

Merged fe6231e9ee39235d54ce8a93d3dff8c5fb2f6c9f onto dev.
