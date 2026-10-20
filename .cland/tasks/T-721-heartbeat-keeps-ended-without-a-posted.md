---
id: T-721
kind: task
title: Heartbeat keeps 'ended without a posted result' rows for runs whose items have closed
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - bug
  - hub
  - v0.1.4
assignee: null
parent: C-325
blocked_by: []
topic: topic-678
branch: t/T-721-heartbeat-keeps-ended-without-a-posted
created: 2026-10-16T20:27:15.756Z
updated: 2026-10-20T02:16:55.172Z
closed: 2026-10-20T02:16:55.172Z
---

## Summary

The Coordinator's heartbeat lists six "ended without a posted result" runs, 8 to 19 hours old: 97a70087, de3df9c9, 3df8e38c, 4cff14eb, 85b2c03a and f2baa6f7. Every one belongs to an item that has since closed (T-550, T-556, T-505, T-559, T-517, T-604), and the rows survived the 20:12Z hub restart. A stale row the Coordinator can't act on hides the ones it can.

## What to build

A run without a posted result leaves the heartbeat's Stale section when its item closes, or when a later run of the same item posts a result. It stays in the run history. A stale row for an open item keeps showing as today.

## Acceptance criteria

- [x] C1. A run that ended without a posted result drops from the heartbeat's Stale section once its item closes or a later run of that item posts a result, and stays listed for an open item with no later result, proved by a heartbeat test on a fake clock.
  - verified: rev-31 [reviewer] · run rev-20261020-721-final · 2026-10-20T01:51:54.054Z · commit 98021cb8ca3e41642b2b139ae1db64c3b0e3607d
  - done: impl-721 · 2026-10-20T01:52:04.454Z
- [x] C2. The run's own record and its history entry are unchanged, proved by the same test.
  - verified: rev-31 [reviewer] · run rev-20261020-721-final · 2026-10-20T01:51:54.054Z · commit 98021cb8ca3e41642b2b139ae1db64c3b0e3607d
  - done: impl-721 · 2026-10-20T01:52:05.257Z

## Comments

### impl-721 · 2026-10-20T01:42:34.317Z

Prepared a T1 fake-clock regression at heartbeatDigest with a real in-memory Store. Covers closure, later/earlier result ordering (including cached timestamps), open and unbound run retention, and byte-for-byte active/history preservation. Typecheck passed. Holding local test execution for the Coordinator's cover-quiet lift.

### impl-721 · 2026-10-20T01:43:29.555Z

Implemented on 98021cb8: completed unreported runs are suppressed only in the heartbeat when their item closes or a later admission of that item has a posted outcome. Uses durable run sequence (history position fallback), so old cached execution times cannot mask later results. Added T1 FakeClock/Store regression retaining active/history bytes. npm run typecheck and git diff --check passed; fetched/merged origin/dev (already current), committed/pushed to origin. Local runtime tests intentionally unrun under the Coordinator's cover-quiet hold; source review then droplet verification will supply runtime evidence.

### rev-31 · 2026-10-20T01:44:41.809Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-721-source
commit: 98021cb8ca3e41642b2b139ae1db64c3b0e3607d
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6935: source clear, no Standards/Spec findings. Ended/unreported stale rows are filtered on item closure or a strictly later posted same-item admission with outcome; earlier results, later unposted runs and open/unbound unresolved runs remain. Durable sequence/history-position fallback avoids cached timestamp ordering. Digest copies/parses suite records without writing them; existing live/timeout/lease behavior remains. New T1 FakeClock/Store regression covers closure/supersession and byte-preserved history/active records. No local tests ran under Coordinator cover-quiet; source-reviewed runtime is still pending. C1/C2 both require actual same-test receipts and remain unverified until the unchanged-head configured mode-free green, including new identity5/5. A-6932 exact-head dry-run admitted. QA none; no Reviewer tests/edits.

### impl-721 · 2026-10-20T01:51:35.824Z

Same-head mode-free verification 84ba7ddc passed on Linux droplet at 98021cb8: 1918/1918 tests, zero failures/skips; T0/T1/T2 green. New heartbeat-digest T1 regression ordinary receipt 0.0136s; five load repetitions passed 5/5 (0.0138–0.0162s). Log A-6943 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6943-suite-84ba7ddc-e3b0-4e38-9a17-c8cfaeef93ab-auto-at-98021cb.log. Droplet lifetime 354s, cost $0.0246. Head/tree unchanged after source review; awaiting Reviewer final evidence verdict. No local tests run during cover-quiet.

### rev-31 · 2026-10-20T01:51:54.054Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-721-final
commit: 98021cb8ca3e41642b2b139ae1db64c3b0e3607d
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6945: final clear. Whole A-6943 at unchanged reviewed/pushed98021cb8 has1918ordinary+5load passes,zero nonpasses/no duration-budget or resource violation. Heartbeat regression ordinary.013634535s at40542,5distinctrepsmax.016190481s and explicit5/5at40688. Both C1actionability and C2byte-preserved records/history assertions execute successfully; C1/C2verified. Hostcheck/allT1/fallbackallT2bothpackagesgreen. Expected new-file missing-baseline projection notice retained, not an enforcement failure; no allowance/estimate edit. SourceA-6935remainscurrent. QA none;T3deferred;no Reviewer tests/edits.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-20T02:16:55.172Z

Merged be77e15707b8d16ff107d4666a0e3de50316df09 onto dev.
