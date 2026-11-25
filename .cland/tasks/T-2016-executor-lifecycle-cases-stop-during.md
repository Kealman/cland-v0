---
id: T-2016
kind: task
title: Executor lifecycle cases (stop during create or cleanup, pre-lease shard release) fail intermittently on macOS dev in bounded single-case runs
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - flaky
  - ready-for-agent
assignee: null
parent: E-2072
blocked_by: []
topic: topic-1763
branch: t/T-2016-executor-lifecycle-cases-stop-during
created: 2026-11-19T22:17:29.512Z
updated: 2026-11-25T03:53:30.696Z
closed: 2026-11-25T03:53:30.696Z
---

## Summary

On current dev (73bb6f974), three executor lifecycle cases fail intermittently on macOS, each run alone with a 120 s bounded launcher, in-process test isolation and fakes only (impl-1898's controls, 2026-11-19, A-21927):
- `suite-close-component` "pre-lease shard failures retain reservation release through executor restart": 2 pass, 1 incomplete (`both shards reach pre-lease provider lookup: deadline exceeded after 30000 ms`, plus a separate 30 s worker-fixture drainage failure).
- `executor-safety-component` "stopping during create detaches the provider reply…": 2 pass, 1 fail (`provider entered create: not within 15000 ms`).
- `executor-safety-component` "stopping during provider cleanup keeps release unconfirmed…": 1 pass, 2 fail (`remote start persisted: not within 15000 ms`).

The same cases passed once each at T-1898's base (a0a980b99), and the Linux merge batches on dev have been green. So these are timing-sensitive waits on macOS that surface under this isolation mode, not proven product regressions.

## What to build

Reproduce each case deterministically. Hold the awaited step (provider create, remote start persistence, pre-lease lookup) and replace its wall-clock wait with an event-ordered one. Fix any real ordering defect found, and keep every lifecycle assertion.

## Acceptance criteria

- [x] C1. Each of the three cases has a deterministic held-step reproduction, red before the fix or shown to be a fixture race with evidence (test).
  - done: impl-2016 · 2026-11-25T02:00:12.907Z
  - verified: rev-40 [reviewer] · run rev-40-20261125-2016-final · 2026-11-25T02:36:55.395Z · commit 8ad4c96bbcf6e1ae494b1940862e8326abf9cd94
- [x] C2. Each case passes 10/10 on macOS in its default isolation and once in-process, with the native close recorded (test).
  - done: impl-2016 · 2026-11-25T01:50:58.260Z
  - verified: rev-40 [reviewer] · run rev-40-20261125-2016-source · 2026-11-25T01:55:20.744Z · commit 2f9be82e577f3f533964425107c7832d16d82298
  - verified: rev-40 [reviewer] · run rev-40-20261125-2016-source2 · 2026-11-25T02:03:20.544Z · commit 8ad4c96bbcf6e1ae494b1940862e8326abf9cd94
  - verified: rev-40 [reviewer] · run rev-40-20261125-2016-final · 2026-11-25T02:36:55.395Z · commit 8ad4c96bbcf6e1ae494b1940862e8326abf9cd94

## Comments

### impl-2016 · 2026-11-25T01:49:37.922Z

Diagnosis: forced spend-ledger contention via shared contendedLaunch fixture reproduces all 3 original timeout boundaries with native runner exits 1. Stop/create: provider entered create not within 19880 ms. Stop/cleanup: remote start persisted not within 20155 ms. Pre-lease shards: both shards reach pre-lease provider lookup deadline exceeded after 30000 ms. Fake-clock retries remained requested but undriven; T-2046 load-scaled eventual headroom cannot advance product time. Fix drives requested retries through exact receipts, preserves lifecycle assertions, positively guards native launch boundaries, and closes the restart executor. Full changed T2 files pass 33/33 locally on macOS/arm64 Node 24.21.0, process isolation, native runner exit 0. No product contract change; helper consumers searched: executor-safety-component T2, suite-close-component T2 (new contendedLaunch consumer), executor-safety-load T4 (existing receipt/foreignLeaseCase exports unchanged). T4 mapped load guard deferred to mode-free verify; no T1 consumer of changed helper found.

### rev-40 · 2026-11-25T01:55:20.269Z

verdict: review
result: not clear
by: rev-40 [reviewer]
run: rev-40-20261125-2016-source
commit: 2f9be82e577f3f533964425107c7832d16d82298
scope: full
findings: [{"severity":"medium","text":"New contended lock/launch sequence and three changed cases lack encompassing complete-case ownership; bounded receipt observers do not join/fence late continuations before root cleanup/native seam restoration.","file":"hub/test/executor-safety-case.ts","line":14},{"severity":"medium","text":"Generic any-pending-delay observation is not a path/owner receipt for this launch's held spend-ledger retry, so deterministic contention is inferred rather than proven.","file":"hub/test/executor-safety-case.ts","line":18}]
finding_counts: {"high":0,"medium":2,"low":0}

Source not clear, two medium findings confirmed by implementer3d34009e. M1 contendedLaunch and changed cases need shared whole-case ownership/bounded setup/root adoption and late lock/launch/action joins. M2 waits.waiting observes any pending delay, not exact-path contention for this launch. Preserve all lifecycle assertions and add the exact boundary observer before submission. C1 failed. Separately audited all33 A-23113 native records: exact three names each process10/10 plus in-process1/1, code0/signalnull, matching single passing case/no skips or stderr; A-23114 diffhash matches this head. C2 may be marked verified at this head without clearing C1. Local macOSarm64 Node24.21 only, no configured/Linux/T4 evidence, no Reviewer runs. A-23121: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23121-t-2016-source-not-clear-and-c2-receipt-audit-at-2f9be82e5.md.

Criteria: C1 failed (Deterministic retry attribution and complete-case setup/continuation ownership are incomplete (M1/M2); correct and request fresh source review.).

### rev-40 · 2026-11-25T02:03:20.545Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261125-2016-source2
commit: 8ad4c96bbcf6e1ae494b1940862e8326abf9cd94
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; M1/M2 resolved. All complete cases enroll shared ownership before setup, original actions stay owned after bounded observers, roots adopted, late lock acquisition/launch retained through finally release, recovery and close joined before cleanup/seam restoration. Exact-path fs.link EEXIST observer armed before launch now required alongside product delay. All lifecycle assertions retained. C2 refreshed at this head: independently parsed all33 A-23136 receipts, each exact case process10/10 plus none1/1, nativecode0/signalnull, one matching pass/no fail/cancel/skip/stderr; A-23137 diffhash matches corrected source. LocalMacarm64 Node24.21 no browser, durations include native startup/teardown. C1 source-consistent but configured exact-head final evidence/mappedT4 remains pending. No findings/Reviewer runs. A-23141: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23141-t-2016-corrected-source-clear-at-8ad4c96bb.md.

Criteria: C2 verified.

### impl-2016 · 2026-11-25T02:35:40.071Z

Configured verification passed at exact reviewed head 8ad4c96bbcf6e1ae494b1940862e8326abf9cd94: run 5fcdc73e-bb63-4053-b48c-7f8d4fe3a929, durable artifact A-23182. T0/T1/fallback all T2/selected T3/mapped T4/Web exit 0; 7631 tests, 7630 pass, 1 skip, fail/cancelled 0. Structured suite timing receipts individually confirm all three target cases outcome pass and mapped `foreign live leases settle 10/10 at two workers under CPU load` pass; diagnostic records 10/10 settlements, CPU progress every case. Linux x64 6.8.0-149-generic, droplet c-8 fra1, Node 24.21.0, Neovim 0.12.5, workers 2, lifetime 1403 s/cost $0.0974. Web browser Google Chrome for Testing 156.0.8078.4, Chrome Headless Shell v1248. Skip: local stage selectors pin several epics through MCP requires macOS; this case passed locally in the complete focused file. Duration regressions/budgets remain report-only; other T3 remains merge-batch evidence, not supplied by this task run. Clean unchanged head; awaiting Reviewer's final same-head settlement.

### rev-40 · 2026-11-25T02:36:55.395Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261125-2016-final
commit: 8ad4c96bbcf6e1ae494b1940862e8326abf9cd94
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; C1/C2 verified. Same-head/tree run5fcdc73e/A-23182 passed. Exact three repaired lifecycle bases pass20430/20435/32877. MappedT4 foreign-lease10/10 case pass41137 with positive nested/CPU-progress/settlement receipts41139 and13pass terminal; selectedbase once, no additionalT4 load-gate repetitions. T0/T1/fallbackT2/selected7T3files100identities/mapped1T4/Web exit0, remainingprocess scope batch/otherT4 unexecuted, Mac-only selector skipped. Noncached Linuxx64c8fra1 workers2 Node24.21/Nvim0.12.5; isolated HeadlessShell1248/CfT156.0.8078.4. Exact-sourceMac33close receipts remain C2 evidence A-23136/A-23137 auditedA-23141; Linux supplements rather than replaces them. Advisory budgets report-only; no findings/Reviewer runs. A-23187: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23187-t-2016-final-clear-at-8ad4c96bb.md.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-25T03:53:30.696Z

Merged a6bc51f0ab6c1da35ddac9110ede48984d39243d onto dev.
