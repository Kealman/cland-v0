---
id: T-1055
kind: task
title: The events filter on the subscription
state: open
status: review
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
updated: 2026-10-21T15:07:18.038Z
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
- [x] C2. Changing the filter on a live connection changes the next page and the live rows without a reconnect (test).
  - done: impl-1055 · 2026-10-21T15:04:33.625Z
- [x] C3. A connection without a filter receives every row, unchanged from before (test).
  - done: impl-1055 · 2026-10-21T15:04:33.641Z
- [x] C4. `hub/README.md` documents the filter fields.
  - done: impl-1055 · 2026-10-21T15:04:33.658Z
  - verified: rev-23 [reviewer] · run rev-20261021-1055-source · 2026-10-21T15:06:37.311Z · commit 13e2c8b5c0e495a29dea31109b62746a8d834857
  - verified: rev-23 [reviewer] · run rev-20261021-1055-source-2 · 2026-10-21T15:07:18.038Z · commit 0b6a012e40eea61c850b4d7fca1e560b5839b45d

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
