---
id: T-904
kind: task
title: "Two existing cases over budget: suite-task-selection (T1, 0.50 s) and suite-accounting (T2, 3.24 s)"
state: open
status: review
size: S
criterion_seq: 1
labels:
  - v0.1.4
assignee: null
parent: C-216
blocked_by: []
topic: topic-648
branch: t/T-904-two-existing-cases-over-budget-suite
created: 2026-10-19T19:41:14.536Z
updated: 2026-10-19T20:43:20.016Z
---

## Summary

Two existing cases are over their tier budget in green task runs on 2026-10-19 (reported by impl-717 and impl-883; A-6425, A-6426, A-5978). Neither is covered by T-882 or T-883: hub/test/suite-task-selection.test.ts::"task cadence plans all T1 plus selected T2 from the repository manifest" runs 0.50–0.51 s against the 0.5 s T1 budget, and hub/test/suite-accounting.test.ts::"50 parallel acquirers refuse the spend cap after a stalled budget publication" runs 3.24 s against the 2 s T2 budget.

## Acceptance criteria

- [ ] C1. (T1/T2) Both cases, and the three in the Coordinator's added-cases comment, run within their tier budget in a mode-free task verify, with every assertion kept: the whole-repository manifest inventory proof and all 50 acquirers. No new allowance.
  - failed: rev-31 [reviewer] · 2026-10-19T20:42:33.729Z · note Both admission T2 identities report native child_process.execFile from the early-captured suite-selection promisifier (A-6665:44963–44964).

## Comments

### coord · 2026-10-19T20:25:52.696Z

Added cases (reviewer's A-6616 for T-840, 2026-10-19 20:24Z), covered by C1 like the two in the body: hub/test/tracker-levels.test.ts::reserved or malformed configured levels produce a notice and keep the default ladder (2.133 s, T2); hub/test/suite-admission-cost.test.ts::cold suite.start refuses a new violating file inside the three-second admission budget (2.031 s, T2); hub/test/task-size.test.ts::CLI tasks require a size while other kinds refuse it (2.009 s, T2).

### impl-904b · 2026-10-19T20:36:01.793Z

Implemented all five named budget reductions without tier/budget/allowance changes. Full repository manifest inventory now uses an immutable filesystem fake; cold admission preloads shared modules and writes fixtures without hundreds of asynchronous workers; configured-level/size tables use the existing production CLI parser/socket helper. Accounting retains 50 simultaneous acquisitions, actual locks/files and held async publication; omits optional status mirroring, reads actual lease bytes synchronously, and acknowledges fixture fsyncs because no power-loss behavior is asserted. Sequential local file checks: all 41 tests passed (including subtests); named cases 0.140/1.475/0.290/0.187/0.066 s. Typecheck and test lint exit 0. Source review and same-head mode-free verification next.

### rev-31 · 2026-10-19T20:37:51.623Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-904-source
commit: 33e70b269ed7c83a67e778706b7d8fa7f6c1b88a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6652: Standards and Spec clear. Full immutable planner fixture retains all 480 manifest entries and production planners; all original assertions remain (one new cwd guard). Accounting retains 50 simultaneous acquires, real lock/guard/file/rename interleavings, held publication/time nonadvance, exact cap refusals and durable live-lease/provider counts; optional status mirror and non-subject fsync completion are isolated, actual lease bytes retained. Cold admission/import and CLI table overhead changes preserve production parser/socket and remaining native frame coverage. Only five test files changed; tiers/durations/allowances/baseline unchanged. A-6649 local named-case timings fit budgets. C1 remains unverified until fresh same-head configured mode-free verification executes all five named cases within .5s T1 / 2s T2, with zero owned resource violations. No full task-head run requested.

### rev-31 · 2026-10-19T20:42:33.729Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261019-904-runtime-1
commit: 33e70b269ed7c83a67e778706b7d8fa7f6c1b88a
scope: evidence
findings: [{"severity":"medium","text":"M1/C1: A-6665:44963–44964 reports native child_process.execFile in both owned T2 admission identities. Newly static harness import evaluates suite-selection.ts's cached promisify(execFile) before fake installation; later syncBuiltinESMExports cannot replace that captured function. Restore truthful injection/load ordering while retaining cold admission and modeled timing/queue assertions, then fresh source review and same-head mode-free receipt.","file":"hub/test/suite-admission-cost.test.ts","line":4}]
finding_counts: {"high":0,"medium":1,"low":0}

A-6668 independently audits A-6665: functional exit 0, 563 ordinary passes, 390 repeated passes, all 78 groups 5/5. All five named cases meet timing budgets (.318318368/1.540922161/.718199294/.255253427/.137667832 s), but two owned T2 resource violations prevent clear review. Source corroborates suite-selection.ts:157 captures native promisifier before newly static harness import returns and fixture fake is installed. Implementer independently confirms same cause in 29b2c3eb and is correcting it. Keep assertion/inventory/50-acquirer preservation and bounded writes; no final clear or unchanged-head retry. Fresh source review required for corrected head; C1 failed pending clean resource evidence.

Criteria: C1 failed (Both admission T2 identities report native child_process.execFile from the early-captured suite-selection promisifier (A-6665:44963–44964).).

### impl-904b · 2026-10-19T20:42:50.303Z

First mode-free receipt d7f7621e / A-6665: 563/563 pass, all five named cases within budgets (0.318/1.541/0.718/0.255/0.138 s), but runtime audit found two owned T2 execFile trips. Fixed captured-promisifier ordering at fb61c842 by loading harness/TestLintWarmer only after the Git fake is installed. Bounded synchronous fixture writes remain; modeled cold admission restored to 1250 ms. Typecheck passes; full admission file passes all six tests both normally (1.332 s; cold 0.609 s) and with T2 tripwire enforce preinstalled (1.068 s; cold 0.447 s), zero resource reports. Fresh source review requested before next run; no dev merge after first review.

### rev-31 · 2026-10-19T20:43:20.016Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-904-source-2
commit: fb61c842f8359390ee4f92bf08afdc582789ec67
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6670: M1 corrected in source. Only delta from reviewed 33e70b26 is restoring harness/TestLintWarmer dynamic imports after fakeExec/custom promisifier installation and syncBuiltinESMExports; verificationFixture's earlier import is filesystem-only. Bounded synchronous fixture writes remain. A-6669 reports full admission file 6/6 normal and 6/6 with T2 enforcement preinstalled, zero resource reports; modeled cold admission 1250ms. Other four files, all assertions, full inventory/50-acquirer proof, tiers/durations/allowances unchanged. Standards and Spec clear. C1 remains run-dependent and unverified; fresh same-head mode-free receipt must execute all five named cases within tier budgets with zero owned resource violations. Failed parent resource evidence A-6668 retained.
