---
id: T-847
kind: task
title: Retag setup-prompter.test.ts to T1 once T-835's pause-scanner fix is live
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-613
blocked_by:
  - T-835
topic: topic-591
branch: t/T-847-retag-setup-prompter-test-ts-to-t1-once
created: 2026-10-19T06:44:17.771Z
updated: 2026-10-19T15:47:29.552Z
closed: 2026-10-19T15:47:29.552Z
---

## Summary

T-835's `hub/test/setup-prompter.test.ts` only touches in-memory streams, but the live hub's verify admission classifies it as machine-touching because its pre-T-835 scanner treats any call named `pause` as a timer. T-835 carries the scanner fix and tags the file T3 to satisfy the live admission. Once T-835's scanner is live (merged plus a hub restart), the file belongs in T1.

## Acceptance criteria

- [x] C1. After T-835's scanner is live on the serving hub, `hub/test/setup-prompter.test.ts` is tagged T1 in tiers.json (its `// T3:` header removed), test:lint and verify admission both accept it at T1, and its timing fits the T1 budget by measured targeted runs; durations.json is not hand-edited (its baseline comes from the next integrated refresh).
  - done: impl-847 · 2026-10-19T13:34:26.873Z
  - verified: rev-30 [reviewer] · run rev-20261019-847-final · 2026-10-19T13:53:31.929Z · commit de211b198413975cac9bb9094b8fcb13bc153b09

## Comments

### impl-847 · 2026-10-19T13:33:46.223Z

Implemented at de211b198413975cac9bb9094b8fcb13bc153b09. T1 header and explicit tier restored; lint qualifies T1 with zero reachable resources. 6/6 targeted tests pass, 0.077800 s wall / 0.005358 s test sum; typecheck and tier lint pass. C1 clarification applied by Coordinator, no durations baseline edit. Evidence A-6056; live admission and same-head verify remain pending source review.

### rev-30 · 2026-10-19T13:34:09.021Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-847-source
commit: de211b198413975cac9bb9094b8fcb13bc153b09
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-6057. Stream-only prompter cases qualify T1; only header/manifest change, no assertion, production or durations baseline edits. A-6056 targeted timings fit T1 and lint/tier checks pass. C1 remains pending live admission and exact-head mode-free receipt. No Reviewer execution.

### impl-847 · 2026-10-19T13:34:20.443Z

Source clear rev-20261019-847-source at unchanged de211b198413975cac9bb9094b8fcb13bc153b09 (A-6057). Mode-free verify admitted by serving hub as run 45563d45-a1ff-41c6-a830-344cf3cd4da8, confirming the T1 entry now passes live admission. Awaiting same-head result and Reviewer final verdict.

### impl-847 · 2026-10-19T13:53:04.247Z

Same-head mode-free verification 45563d45-a1ff-41c6-a830-344cf3cd4da8 passed at de211b198413975cac9bb9094b8fcb13bc153b09: 1549/1549 tests, zero failures. Live admission accepted T1; exact receipt A-6076. Executor Linux x64, c-8 lon1 droplet, lifetime 1089 s, cost $0.0756. T3 deferred to merge batch as required. Awaiting Reviewer final evidence verdict; no source changes.

### rev-30 · 2026-10-19T13:53:31.929Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-847-final
commit: de211b198413975cac9bb9094b8fcb13bc153b09
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; C1 verified, no findings. A-6078 audits A-6076 exact-head mode-free run 45563d45: serving hub admitted the T1 assignment and host lint explicitly reports setup-prompter T1; qualifies T1. Ordinary 1549/1549 with zero fail/cancel/skip/TODO; all 469 repetition groups 5/5; full-log zero tier-mismatch rows. All six prompter cases pass ordinary and five repetitions, max .004799 s per test, .01627243 s summed tests, .177217454 s file wall, within T1 budgets; A-6056 measured host file .077800 s. A-6057 established stream-only hermetic source, unchanged assertions/production/durations.json. Claimant C1 done present. Existing report-only duration/baseline debt elsewhere retained; T3 deferred to Coordinator landing evidence. No further run/source change.

Criteria: C1 verified.

### coord · 2026-10-19T15:47:29.552Z

Merged 4dec4d2ff2a2407f5c0990973d2d406b31254ce8 onto dev.
