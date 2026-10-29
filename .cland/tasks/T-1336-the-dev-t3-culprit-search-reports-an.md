---
id: T-1336
kind: task
title: The dev T3 culprit search reports an intermittent failure as already-fixed when no code changed
state: open
status: review
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
updated: 2026-10-29T18:40:26.167Z
---

## Summary

The periodic dev T3 culprit search for e8e961f3 (red at fb73592a) labelled both failing files "already-fixed on dev at 37119f55". The only code-tree changes between those commits are a durations.json baseline refresh and a QA brief, so nothing fixed them: both were intermittent failures that passed on rerun (T-1335). Calling a flake "already-fixed" hides it.

## What to build

When the current-tip rerun of a failing file is green but the candidate tree between the red head and the tip changed no file that the failing test imports or reads (tracker, docs, briefs and durations only), report the result as "not reproduced (intermittent)" with both receipts, not "already-fixed", and keep it visible to the Coordinator.

## Acceptance criteria

- [x] C1. A red periodic run whose failing file passes at a tip that differs only in tracker, docs or duration-baseline files is reported as not reproduced (intermittent), never already-fixed, and a tip with a real source change to the failing area still reports already-fixed (test).
  - done: impl-1336 · 2026-10-29T18:40:03.167Z

## Comments

### impl-1336 · 2026-10-29T18:37:51.203Z

Consumer inventory before changing classification: SearchBoundary.nonTrackerChanges and nonTrackerChanges in hub/src/hub/dev-t3-search.ts; production wiring hub/src/hub/dispatch.ts; persisted dev-t3-searches checkpoints (same flake/already-fixed/inconclusive result values retained); reportDevT3Search in hub/src/hub/dev-t3-report.ts (Coordinator detail/text, no new result enum); hub/test/{dev-t3-search,dev-t3-search-component,verification-tree,suite-soak,suite-soak-component}.test.ts; hub/README.md; docs/agents/tests/hub-test-dev-t3-search{,-component}.test.ts.md; .agents/skills/implement/SKILL.md. Repository-wide search of already-fixed/nonTrackerChanges/dev-t3-search found no workbench, startup probe, QA brief or T4 wire consumer. Keep old boundary and receipt shapes; change only conservative Git path exclusions and human reason. Existing legacy checkpoint cases remain controls. Agreed test seam: disposable native Git helper plus existing durable search/production frame component (per launch brief).
