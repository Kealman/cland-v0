---
id: T-1336
kind: task
title: The dev T3 culprit search reports an intermittent failure as already-fixed when no code changed
state: closed
status: done
size: S
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
regression_of: T-1244
topic: topic-1209
branch: t/T-1336-the-dev-t3-culprit-search-reports-an
created: 2026-10-26T09:16:20.638Z
updated: 2026-10-29T19:07:21.708Z
closed: 2026-10-29T19:07:21.708Z
---

## Summary

The periodic dev T3 culprit search for e8e961f3 (red at fb73592a) labelled both failing files "already-fixed on dev at 37119f55". The only code-tree changes between those commits are a durations.json baseline refresh and a QA brief, so nothing fixed them: both were intermittent failures that passed on rerun (T-1335). Calling a flake "already-fixed" hides it.

## What to build

When the current-tip rerun of a failing file is green but the candidate tree between the red head and the tip changed no file that the failing test imports or reads (tracker, docs, briefs and durations only), report the result as "not reproduced (intermittent)" with both receipts, not "already-fixed", and keep it visible to the Coordinator.

## Acceptance criteria

- [x] C1. A red periodic run whose failing file passes at a tip that differs only in tracker, docs or duration-baseline files is reported as not reproduced (intermittent), never already-fixed, and a tip with a real source change to the failing area still reports already-fixed (test).
  - done: impl-1336 · 2026-10-29T18:40:03.167Z
  - verified: rev-32 [reviewer] · run rev-20261029-1336-evidence1 · 2026-10-29T18:57:28.217Z · commit e4141caa6a6dc1022c11bf221e40fc318f750099

## Comments

### impl-1336 · 2026-10-29T18:37:51.203Z

Consumer inventory before changing classification: SearchBoundary.nonTrackerChanges and nonTrackerChanges in hub/src/hub/dev-t3-search.ts; production wiring hub/src/hub/dispatch.ts; persisted dev-t3-searches checkpoints (same flake/already-fixed/inconclusive result values retained); reportDevT3Search in hub/src/hub/dev-t3-report.ts (Coordinator detail/text, no new result enum); hub/test/{dev-t3-search,dev-t3-search-component,verification-tree,suite-soak,suite-soak-component}.test.ts; hub/README.md; docs/agents/tests/hub-test-dev-t3-search{,-component}.test.ts.md; .agents/skills/implement/SKILL.md. Repository-wide search of already-fixed/nonTrackerChanges/dev-t3-search found no workbench, startup probe, QA brief or T4 wire consumer. Keep old boundary and receipt shapes; change only conservative Git path exclusions and human reason. Existing legacy checkpoint cases remain controls. Agreed test seam: disposable native Git helper plus existing durable search/production frame component (per launch brief).

### rev-32 · 2026-10-29T18:41:15.954Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261029-1336-source1
commit: e4141caa6a6dc1022c11bf221e40fc318f750099
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear; Standards0/Spec0 findings, A-13970. Explicit metadata-path exclusions report not reproduced(intermittent) with unchanged flake/checkpoint shape and both run/log receipts; actual source/edit-revert controls retain already-fixed, unknown history inconclusive. Native Git and production-frame tests preserve legacy controls and no-Bug assertions. Docs/skill/provenance align. C1 runtime remains unverified until same-head configured result; local targeted/typecheck claims are supplemental. No Reviewer execution.

### impl-1336 · 2026-10-29T18:57:13.339Z

Original configured verification 771c3ffa-f1e6-40f4-ab12-5597dc3948db at unchanged e4141caa6 completed exit 0, 4206 pass/0 skipped/cancelled (A-14005). Linux x64 droplet c-8 lon1, Node 24.21, Chrome Headless Shell 156.0.8078.4 / Playwright build 1248 for Web; lifetime 822s, cost $0.0571. T0–T2 incl fallback all T2, Web, changed T3 verification-tree completed; remaining T3/T4 deferred. Budget/lint report-only warnings retained, not an enforced timing pass. Exact C1 component case 'red periodic run reports docs brief and duration-only green tips as not reproduced (intermittent)' passed in 0.496s base; actual source-change tip already-fixed and native Git history cases passed. Final evidence review requested, hub queued it for next free Reviewer; no duplicate request.

### rev-32 · 2026-10-29T18:57:28.217Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261029-1336-evidence1
commit: e4141caa6a6dc1022c11bf221e40fc318f750099
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14006 final same-head clear: original A-14005 parsed4206 ordinary/80 separate load passes,zero nonpasses/unmatched starts. Metadata-tip scenario base+5/5 explicit load finishes, real-source already-fixed control, native Git metadata/source/revert history and all legacy false/null/missing checkpoint controls pass. C1 verified. Host check separate from Linux T1/allT2/changedT3 verification-tree10/10/Web; remainingT3 deferred/noT4. Lint/budgets report-only. No Reviewer execution.

Criteria: C1 verified.

### coord · 2026-10-29T19:07:21.708Z

Merged f2a5d1ac9b4f20e32c7892362dc3c80f80c8d655 onto dev.
