---
id: T-909
kind: task
title: nvim items.test.ts 'recorded item frames render…' fails one load-gate repetition in five (T-775 run b572f618)
state: open
status: review
size: S
criterion_seq: 2
labels:
  - v0.1.4
assignee: null
parent: C-325
blocked_by: []
regression_of: T-902
found_by: droplet
topic: topic-651
branch: t/T-909-nvim-items-test-ts-recorded-item-frames
created: 2026-10-19T21:01:12.135Z
updated: 2026-10-19T21:10:34.504Z
---

## Summary

`nvim/test/items.test.ts` "recorded item frames render trees, map groups, details, board and edited files" failed one of its five load-gate repetitions (4/5) in T-775's exact-head run b572f618 (A-6697, droplet, 2 workers). The anchored assertion at line 76 for the `◐ T-2 E-1 › Items panel +impl-1` row did not match. T-902 migrated the test and landed it (c388c844). Its own receipts showed 125/125 repetitions, so the failure is load-dependent.

## What to build

Find out why the recorded update can be asserted before the Items panel re-renders under load, and make the test wait on the rendered state, or make the frame replay deterministic, rather than on timing. Don't loosen the assertion's content.

## Acceptance criteria

- [ ] C1. The cause is named in the task report with the failing repetition's screen from A-6697 or a local reproduction under load.
  - verified: rev-30 [reviewer] · run rev-20261019-909-source · 2026-10-19T21:04:37.255Z · commit 4232f30f8c505882ba3b1a253563c9d6e5428273
  - verified: rev-30 [reviewer] · run rev-20261019-909-final · 2026-10-19T21:10:34.504Z · commit 4232f30f8c505882ba3b1a253563c9d6e5428273
- [ ] C2. The fixed test passes the load gate's five repetitions in one mode-free droplet verify at the reviewed head, plus 20 serial local runs of the single file, with both receipts in the task report.
  - verified: rev-30 [reviewer] · run rev-20261019-909-final · 2026-10-19T21:10:34.504Z · commit 4232f30f8c505882ba3b1a253563c9d6e5428273

## Comments

### impl-909 · 2026-10-19T21:02:43.615Z

Diagnosis (C1): A-6697, load-gate repetition 4 around line 59099, contains ` ◐ T-[redacted] E-[redacted] › Items panel     impl-[redacted]                                   ` before the separator. The badge is still at its old 35-column position inside the newly widened 70-column window. `WinResized` calls layout.resized → state.changed, which defers panel rendering with vim.schedule. The original unanchored precondition accepts this intermediate screen; the unchanged anchored assertion rejects the trailing blank area. A targeted local RPC probe reproduced the exact transient row by resizing and redrawing in one Lua call, confirmed the old predicate passes and the original anchor fails, then observed the anchor become true on deferred render. Fix waits on the exact anchored left-panel row; no whitespace normalization or assertion content change.

### impl-909 · 2026-10-19T21:03:31.079Z

Committed/pushed 4232f30f8c505882ba3b1a253563c9d6e5428273 on t/T-909-nvim-items-test-ts-recorded-item-frames after fetch/merge origin/dev (already up to date). Typecheck passes. 20/20 serial local runs of the full nvim/test/items.test.ts file: 100 passed tests, no skips/failures, receipt A-6701 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6701-t-909-20-serial-local-items-file-runs.log). Diagnosis/fix report A-6702 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6702-t-909-resize-race-diagnosis-and-fix.md). C2 remaining: same-head mode-free droplet verify and five load repetitions. Queue enabled; task T0–T2, T3 deferred to periodic dev/integrated occasions (merge batches T1 only).

### rev-30 · 2026-10-19T21:04:37.255Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-909-source
commit: 4232f30f8c505882ba3b1a253563c9d6e5428273
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear, A-6704. One-file precondition change requires the exact anchored row already asserted on leftOf(screen); every assertion and timeout remains. C1 supported by A-6697 repetition4 screen, task/A-6702 diagnosis and actual WinResized→layout.resized→state.changed scheduled render code. Independent A-6701 audit: 20 whole-file runs, 100/100, zero fail/cancel/skip/TODO; affected max .524251959 s. C2 local portion established, but final C2 requires exact-head mode-free droplet overall green and actual five passing repetitions of the affected identity, with no owned resource/budget trip. No Reviewer tests; QA none.

Criteria: C1 verified.

### impl-909 · 2026-10-19T21:10:19.825Z

C2 exact-reviewed-head droplet receipt: run 538630db-577e-4d50-83e1-b22498eccfbf, head 4232f30f8c505882ba3b1a253563c9d6e5428273, exit 0. 810/810 tests passed, no failures/cancellations/skips. Linux x64 droplet c-8 lon1, 2 workers; lifetime 291s; cost $0.0202. A-6706 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6706-suite-538630db-577e-4d50-83e1-b22498eccfbf-auto-at-4232f30.log) supplies the overall result and affected-identity 5/5 load-gate proof. Combined with A-6701's 20/20 serial local full-file runs (100/100 tests), this completes C2 evidence. T0 host gate passed; T1/T2 receipt green; T3 deferred to periodic dev and integrated occasions because configured merge batches run T1 only. Awaiting Reviewer final evidence verdict.

### rev-30 · 2026-10-19T21:10:34.504Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-909-final
commit: 4232f30f8c505882ba3b1a253563c9d6e5428273
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final exact-head evidence clear, A-6707. Independent A-6706/538630db audit:810/810, zero fail/cancel/skip/TODO, all125 load groups5/5, no tier/resource mismatch or owned overrun. Affected identity ordinary .868055751 s plus five distinct pass finishes, max repeat .823071246 s; explicit5/5 at:47755. A-6701 independently supplies20 whole-file local runs100/100, affected max .524251959 s. Source/diagnosis A-6704 unchanged. C1/C2 verified; covered report-only events case follows Coordinator directive. QA none; no Reviewer execution.

Criteria: C1 verified, C2 verified.
