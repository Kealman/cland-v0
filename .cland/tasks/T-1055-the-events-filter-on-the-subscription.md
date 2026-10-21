---
id: T-1055
kind: task
title: The events filter on the subscription
state: closed
status: done
size: S
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-413
blocked_by: []
topic: topic-810
branch: t/T-1055-the-events-filter-on-the-subscription
created: 2026-10-21T14:04:14.927Z
updated: 2026-10-21T15:39:50.144Z
closed: 2026-10-21T15:39:50.144Z
---

## Summary

Let a subscription carry the events filter, so its first page and its live rows arrive already filtered.

## Parent

E-413 (§3.3 "The events filter"; tracer step 3).

## What to build

`subscribe` accepts an events filter by kind, warnings and subject, and a client can change it on its connection. The first page of events and every live row honour it. A connection without a filter gets every row, as Neovim does today.

## Acceptance criteria

- [x] C1. A subscription filtered to warnings receives only warning rows, in its first page and live (test).
  - done: impl-1055 · 2026-10-21T15:04:33.604Z
  - verified: rev-23 [reviewer] · run rev-20261021-1055-final · 2026-10-21T15:15:36.166Z · commit 0b6a012e40eea61c850b4d7fca1e560b5839b45d
- [x] C2. Changing the filter on a live connection changes the next page and the live rows without a reconnect (test).
  - done: impl-1055 · 2026-10-21T15:04:33.625Z
  - verified: rev-23 [reviewer] · run rev-20261021-1055-final · 2026-10-21T15:15:36.166Z · commit 0b6a012e40eea61c850b4d7fca1e560b5839b45d
- [x] C3. A connection without a filter receives every row, unchanged from before (test).
  - done: impl-1055 · 2026-10-21T15:04:33.641Z
  - verified: rev-23 [reviewer] · run rev-20261021-1055-final · 2026-10-21T15:15:36.166Z · commit 0b6a012e40eea61c850b4d7fca1e560b5839b45d
- [x] C4. `hub/README.md` documents the filter fields.
  - done: impl-1055 · 2026-10-21T15:04:33.658Z
  - verified: rev-23 [reviewer] · run rev-20261021-1055-source · 2026-10-21T15:06:37.311Z · commit 13e2c8b5c0e495a29dea31109b62746a8d834857
  - verified: rev-23 [reviewer] · run rev-20261021-1055-source-2 · 2026-10-21T15:07:18.038Z · commit 0b6a012e40eea61c850b4d7fca1e560b5839b45d
  - verified: rev-23 [reviewer] · run rev-20261021-1055-final · 2026-10-21T15:15:36.166Z · commit 0b6a012e40eea61c850b4d7fca1e560b5839b45d

## Comments

### impl-1055 · 2026-10-21T15:03:13.126Z

TDD frame seam: first red failed because subscribe returned no events page; warning-first-page/live test is now green. Second red exposed replay leaking excluded rows; filtered replay now uses row-free model.advance deltas, preserving every seq. Targeted local macOS run (working tree, before commit): events.test.ts + connection-snapshot.test.ts, all 19 tests passed in 0.904 s; not a suite receipt. Added identities each below 0.1 s locally; Linux measurement will come from verification.

### rev-23 · 2026-10-21T15:06:37.311Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1055-source
commit: 13e2c8b5c0e495a29dea31109b62746a8d834857
scope: full
findings: [{"severity":"low","text":"The EventKind list omits supported heartbeat and rule values from protocol.ts EVENT_KINDS. Include both so documented filter options match validation.","file":"hub/README.md","line":394}]
finding_counts: {"high":0,"medium":0,"low":1}

Source clear at exact origin13e2c8b5/tree08e0ae78 against fixed devfb9adfe3; full eight-file audit. Connection-local filter installation/replacement/reset, filtered first page, inherited/explicit events.list, snapshot I/O filter fence, legacy omission and numbered row-free model.advance live/replay preserve existing projection semantics and shared ring. Existing T2 frame seams assert exact observed rows/cursors/sequence, independent unfiltered client and expired-cursor snapshot; no new native process. Shared wire/validation match, other domains remain unfiltered. C4 docs verified; L1 low README:394 omits supported heartbeat/rule kinds, nonblocking. C1-C3 await unchanged-head mode-free and owned new-test load receipts. A-8509 local working-tree28/28/check summary is development support only, not final evidence. No Reviewer runtime/delegation; after-stage QA separate. If L1 is corrected before verify, request fresh source review at changed head.

Criteria: C4 verified.

### rev-23 · 2026-10-21T15:07:18.038Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1055-source-2
commit: 0b6a012e40eea61c850b4d7fca1e560b5839b45d
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear at exact origin0b6a012e/tree6e0a8fda. Sole change from full A-8511 source audit adds supported heartbeat/rule to README EventKind list; L1 resolved, no findings. Implementation/wire/tests unchanged; no dev merge. C4 reverified, C1-C3 runtime settlement awaits unchanged-head queued verification and owned new-identity load receipts. No extra targeted tests needed for this documentation-only correction. No Reviewer runtime; after-stage QA remains separate.

Criteria: C4 verified.

### impl-1055 · 2026-10-21T15:15:20.740Z

Same-head verification f246ee95-bb14-421d-b95a-0bb91ecad715 at 0b6a012e40eea61c850b4d7fca1e560b5839b45d passed on Linux x64 droplet c-8 lon1: all T1 and fallback all T2 across packages, plus Web; 2324/2324, no failures/skips/cancellations. T0 host gate recorded; lint and duration budgets report-only. Both new frame identities passed 5/5 load repetitions; maxima 0.199 s and 0.234 s, no >5 s allowance needed. T3 remains deferred to periodic dev/integrated occasions, absent configured batch tiers. Durable log A-8517. Awaiting Reviewer's final same-head evidence verdict; holding claim and head, no merge.

### rev-23 · 2026-10-21T15:15:36.166Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1055-final
commit: 0b6a012e40eea61c850b4d7fca1e560b5839b45d
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head clear. A-8517/f246ee95 auto/full exit0 at unchanged reviewed0b6a012e; origin confirmed, source A-8511/A-8512 applies, L1 resolved. Actual Linuxx64 c-8lon1 droplet Node24.21/Nvim0.12.5: T1 + all fallbackT2 both packages + Web exit0; parsed2324ordinary test/355file passes,10load test/10file passes, no failures/cancels/skips/todo. Both owned identities have five distinct passing finishes and explicit5/5 at5237 and5724; maxload0.198634s/0.233528s. C1 warning firstpage/live, C2 replacement/page/snapshot/replay, C3 default/reset compatibility established by these assertions/fullT2; C4 prior source docs verified. Hostchecka773327d reusednotremote; lint132/59,tier/duration/ratchetreportonly. Webshell8.479s andconnection5.582s nominal4s overages retained, no4s-budget pass claimed. ActualWeb5files9.49s shard9.59s phase workers4; T2workers2; lifetime410s/$0.0285estimate. NoT3/T4/integrated/stage/QA claim. All criteria verified, no findings; after-stage QA separate. No Reviewer execution.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-10-21T15:39:50.144Z

Merged 4b2b10b5f8811ddf40f0cc2cdef8cf509c0ca4ac onto dev.
