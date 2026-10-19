---
id: T-913
kind: task
title: Stream the hub's remaining whole-suite-log reads (T-912 audit A-6744)
state: closed
status: done
size: M
criterion_seq: 3
labels:
  - v0.1.4
assignee: null
parent: C-216
blocked_by:
  - T-912
regression_of: T-885
topic: topic-656
branch: t/T-913-stream-the-hub-s-remaining-whole-suite
created: 2026-10-19T21:51:09.495Z
updated: 2026-10-19T22:45:53.930Z
closed: 2026-10-19T22:45:53.930Z
---

## Summary

T-912's audit (A-6744) lists the hub's remaining whole-suite-log reads, all without a byte bound. The per-admission ones can repeat the T-912 heap blow-up: cached admission (suites.ts ~522) and `#stageIdentities` (~637). The rest run once per completion but load whole logs, and shard aggregation loads every shard log at once. T-667's command excerpt slices the whole command output before taking its 20-line tail.

## What to build

- Stream or reduce incrementally every reader in A-6744's table: cached admission, stage identities, shard aggregation, machine health, progress, tier and duration reports, new-task proof capture, the integrated cover, `receipt()` and dispatch result publication. Per-admission readers share one in-flight computation and cache their derived result.
- T-667's command excerpt keeps a bounded ring of the last 20 lines instead of materializing the whole output.
- Shard aggregation stops holding every shard log in memory at once.

## Acceptance criteria

- [x] C1. A T2 test with several 20 MB fake logs and concurrent admissions (cached and stage) shows each log read at most once per derived result, with heap growth bounded.
  - verified: rev-30 [reviewer] · run rev-20261019-913-final · 2026-10-19T22:23:06.071Z · commit 1d44247df24e63faaf69995ca633352ae1532dec
  - done: impl-913 · 2026-10-19T22:24:39.005Z
- [x] C2. The command excerpt and shard aggregation keep memory bounded on a 50 MB fake output, proved by a T2 test.
  - verified: rev-30 [reviewer] · run rev-20261019-913-final · 2026-10-19T22:23:06.071Z · commit 1d44247df24e63faaf69995ca633352ae1532dec
  - done: impl-913 · 2026-10-19T22:24:39.991Z
- [x] C3. A grep for `readFile(` on suite logs in hub/src lists only streaming or bounded-tail readers, and the report names each one.
  - verified: rev-30 [reviewer] · run rev-20261019-913-source · 2026-10-19T22:15:36.787Z · commit 1d44247df24e63faaf69995ca633352ae1532dec
  - verified: rev-30 [reviewer] · run rev-20261019-913-final · 2026-10-19T22:23:06.071Z · commit 1d44247df24e63faaf69995ca633352ae1532dec
  - done: impl-913 · 2026-10-19T22:24:42.400Z

## Comments

### impl-913 · 2026-10-19T22:13:43.551Z

Implemented all A-6744 automatic readers and T-667 excerpt ring; pushed 1d44247d after merging origin/dev. C1/C2 targeted 20 MB admission and 50 MB output/shard regressions passed; full reader inventory and limitations are in the implementation artifact in topic-656. Existing targeted reporting/cover/cache/stage/batch checks passed. Cover-quiet now prohibits further local tests; exact-head source review then mode-free droplet verification remain. qaPolicy scope none, qaCriteria empty.

### rev-30 · 2026-10-19T22:15:36.787Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-913-source
commit: 1d44247df24e63faaf69995ca633352ae1532dec
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear, A-6760. All A-6744 automatic readers replaced by sequential streaming/reduced evidence or disk copy; stage identities are durable and shared, reporting/receipt scans share in-flight work with 20-run LRU, shard output uses backpressure/atomic replacement. Downstream failure/quarantine/progress/bisection/summary prefixes reviewed; permission and eligibility checks retained. C3 grep/inventory verified. Bound applies to ordinary output; semantic evidence remains proportional to test receipts, not an absolute heap cap. T2 20/50 MiB regressions cover scan counts, reuse/reopen, heap sampling, command ring and shard hash. C1/C2 await exact-head mode-free green and both new identities 5/5 with no owned budget/resource trips; final cleanup was not locally rerun under cover-quiet. QA none; no Reviewer tests.

Criteria: C3 verified.

### impl-913 · 2026-10-19T22:22:55.013Z

Same-head mode-free verify 2841a1bc-16e6-46bf-917c-22989cf085d5 is green at 1d44247d: 1,911/1,911 passed, zero fail/skip. Durable log A-6761. Both new identities have actual 5/5 load-gate receipts (lines 47976 and 47982). Ordinary C1/C2 timings 1.330 s / 1.349 s; C2 sampled heap +16,326,160 bytes and one source stream (line 47741), with hash/counter assertions green. Linux droplet c-8 lon1, 361 s lifetime, $0.0251 cost. C3 was verified in source review rev-20261019-913-source; awaiting Reviewer final evidence verdict. No source changes since review.

### rev-30 · 2026-10-19T22:23:06.071Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-913-final
commit: 1d44247df24e63faaf69995ca633352ae1532dec
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final exact-head evidence clear, A-6762. Independently audited A-6761/2841a1bc: 1911/1911, zero fail/cancel/skip/TODO, both new regression identities ordinary plus five distinct positive repetitions; zero tier/resource mismatch or budget-overrun rows. C1 three 20 MiB cached/stage sources pass scan/reuse/reopen/heap assertions (repetition max 1.642243160 s). C2 50 MiB command/shards pass tail/hash/sequential/heap assertions (max 1.751286524 s); ordinary diagnostic reports 16,326,160 bytes sampled heap growth and one source stream. Inherited T-912 counters remain positive. Source A-6760 plus receipt settle C1/C2; C3 retained. Ordinary-output bound and semantic-evidence limitation remain qualified; no absolute/live-hub heap claim. QA none; no Reviewer tests.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-19T22:45:53.930Z

Merged b5f3137542766278e09cb2011ef9214e4631b82e onto dev.
