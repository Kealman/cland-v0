---
id: T-1377
kind: task
title: Two tracker-watcher tests time out together in a loaded macOS stage cover
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: R-1278
blocked_by: []
topic: topic-1136
branch: t/T-1377-two-tracker-watcher-tests-time-out
created: 2026-10-27T19:31:23.217Z
updated: 2026-10-28T06:23:31.467Z
closed: 2026-10-28T06:23:31.467Z
---

## Summary

In the macOS stage cover 5fcc5c84 at dev 605a65a0 (local, 2 workers, peak 1m load 8.45; log A-12870) two tracker-watcher tests timed out in the same 20 s window (19:29:26–19:29:46Z): `hub/test/task-plan.test.ts::invalid hand edits keep the accepted plan across restart, and valid hand edits replace it` (`watcher refuses plan: not within 15000 ms`) and `hub/test/task-prefixes.test.ts::removing an unclaimed child sends its terminal event to the surviving parent Lead` (`removed child is reported: not within 15000 ms`). Alone each passed 5/5 on the same tree; both passed in every other run this session.

## What to build

Find why a hand write or removal under `.cland/tasks/` went unnoticed by two separate fixture hubs for 15 s at the same moment (macOS file-event delivery delayed or coalesced under load, or a hub-side watcher gap). If the watcher can miss an event, that is a product defect: the hub must re-index the file eventually (rescan or equivalent) and the fix lands with a regression. If events only arrive late, move both tests to the exact re-index receipt helper T-1374 added (`reindexedAfter`) with a bound sized for a loaded macOS cover, and record the measured delivery delay.

## Acceptance criteria

- [x] C1. The failure is attributed with evidence (missed event versus late event) quoted from a reproduction under load.
  - done: impl-1377 · 2026-10-28T05:18:02.453Z
  - verified: rev-31 [reviewer] · run rev-20261028-1377-final1 · 2026-10-28T05:42:24.010Z · commit 7add65644913da6d037e2d225c9a81629da2a58c
- [x] C2. Both identities pass 10/10 under two workers plus owned CPU load on macOS.
  - done: impl-1377 · 2026-10-28T05:18:02.544Z
  - verified: rev-31 [reviewer] · run rev-20261028-1377-final1 · 2026-10-28T05:42:24.010Z · commit 7add65644913da6d037e2d225c9a81629da2a58c

## Comments

### coord · 2026-10-28T01:50:42.596Z

Recurred (coord, 2026-10-28 01:50Z): macOS stage cover befe7b28 at dev efbbe58c (A-13026, local, 2 workers, peak 1m load 4.65) failed `hub/test/task-prefixes.test.ts::removing an unclaimed child sends its terminal event to the surviving parent Lead` with the same `removed child is reported: not within 15000 ms` (15.24 s). Second macOS stage cover lost to this item's identities (first: 5fcc5c84 at 605a65a0). It now blocks the E-1311 stage 1 close; one resubmit taken, fix requested into R-1278.

### coord · 2026-10-28T01:57:42.783Z

Third red (coord, 2026-10-28 01:56Z): macOS stage cover rerun c28400a7 at efbbe58c (A-13029, peak 1m load 6.29) failed the same task-prefixes identity again (15.68 s), so it is now 2/2 at efbbe58c after passing the macOS cover at c675faa3. Alone on dev efbbe58c it passes 5/5 in ~0.6 s. In both failing covers it overlapped only Telegram fixture-hub tests (telegram-cards, telegram-approvals, telegram-catchup, telegram-api), each starting and stopping its own hub and tracker watcher; three local runs beside a concurrent telegram-cards.test.ts file passed (0.66 s, 0.75 s, 4.69 s), so the overlap slows it but did not reproduce the miss. Landed between c675faa3 and efbbe58c: T-1397 (mirror/gap/replies prefactor), T-1381, T-1382 (artifact.upload, dispatch/core/daemon), T-1383, T-1384, T-1392, T-1393, T-1396. The item's first job stays the missed-versus-late attribution, now also checking whether a change in that range (T-1382's daemon/dispatch edits first) made the miss consistent.

### coord · 2026-10-28T03:36:45.690Z

Fourth macOS cover red (coord, 2026-10-28 03:36Z): 77611a81 at dev 1df5782e (A-13054, local 2 workers, peak 1m load 7.66) failed three tracker-watcher identities together: `hub/test/task-plan.test.ts::invalid hand edits keep the accepted plan across restart, and valid hand edits replace it` (15.96 s), `hub/test/task-prefixes.test.ts::removing an unclaimed child sends its terminal event to the surviving parent Lead` (15.08 s) and, new, `hub/test/nvim-items-rules.test.ts::the tracker indexes hand-written files and saved titles within one second`. Every macOS stage cover since c675faa3 has now failed on this class (4 of 4: 5fcc5c84, befe7b28, c28400a7, 77611a81), so treat it as systematic, possibly a product regression in hand-edit indexing on macOS under load, not a timing flake. It blocks E-1311 stage 1 and E-1312 stage 1. Awaiting the human's answer to ask d58c9b54 (relayed as urgent via cland-impl at 02:4xZ).

### coord · 2026-10-28T03:55:24.987Z

Diagnosis lead (coord, 2026-10-28 04:0xZ, read-only): the tracker watches `.cland/tasks` through `watchFolder` (hub/src/watch.ts, from T-48), which uses Node `fs.watch` (FSEvents on macOS) and falls back to the 500 ms poll only when the watch throws or emits `error`. While the watch is healthy there is no periodic safety rescan, so a coalesced or dropped FSEvents notification under load means the hub never sees that hand edit until some later event in the folder — consistent with: macOS-only (Linux inotify covers 5/5 including the soak's repetitions, A-13055, A-13057, A-13059), only under load, and every watcher identity at once (task-plan, task-prefixes, nvim-items-rules). If confirmed, this is a product defect (a hand edit can stay unindexed indefinitely on macOS), and the fix is a bounded safety rescan beside the healthy watch (reuse the existing poll stamp `#polled`), with a test that drops the watch event and proves the rescan indexes the edit; the watcher tests then assert the re-index receipt (T-1374's helper). Linux stage cover 9cc1f562 at 1df5782e is green; macOS 77611a81 red only on this class.

### impl-1377 · 2026-10-28T05:05:38.536Z

Consumer audit before changing watcher delivery policy: watchFolder has one production consumer, Tracker.start (hub/src/tracker/tracker.ts); its poll callback already compares #polled listing/mtime/size and serializes async rescan. Tracker injection consumers found throughout hub/test via watch option; existing injected watchers unaffected. No wire/reply/schema changes. Native consumers: tracker.test.ts fallback, task-plan.test.ts, task-prefixes.test.ts, nvim-items-rules.test.ts; tracker-summary.test.ts deterministic watch controls. Docs: hub/README.md tracker section, docs/agents/issue-tracker.md and per-test guidance. All-tier search for watchFolder and watch refusal completed. Existing older-hub clients unaffected (no protocol change).

### impl-1377 · 2026-10-28T05:15:50.907Z

Steady-state cost on disposable copy of 1,415 tracker files, macOS Node v24.21.0 local (no browser): 10 checks, wall ms 10.13,11.59,20.26,10.42,11.78,12.27,12.92,37.06,10.50,11.12; median ~11.7 ms; event-loop monitor resolution 1 ms: mean delay 2.25 ms, max 33.26 ms. Zero item reads/parses after startup/warmup; copy/startup excluded, 10 ms between samples excluded from check timing. First draft probes were incomplete (startup rescan had not drained), not performance evidence. Coordinator accepted 5 s interval instead of 2 s because metadata work exceeds a few ms/check; recovery remains below 15 s. Timers unref and close with watcher/tracker. Initial stamp order aligned with async lexical order to avoid spurious first full scan.

### rev-31 · 2026-10-28T05:22:20.765Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261028-1377-source1
commit: 146f3a720a859d8dc17aad4e10efe4823f5c6b4a
scope: full
findings: [{"severity":"medium","text":"M1 Standards: all three new per-test guides use a short filename H1. The unchanged test-docs guard derives the document slug and existing test path from that H1, so these fail its exact-path contract. Use # hub/test/task-plan.test.ts, # hub/test/task-prefixes.test.ts and # hub/test/nvim-items-rules.test.ts; retain the original guard red/green receipts.","file":"docs/agents/tests/hub-test-task-plan.test.ts.md","line":1},{"severity":"medium","text":"M2 Standards: the renamed generated identity leaves both its baseline and allowance at the old 'within one second' title in hub/test/durations.json (4030/8893). Immutable identity lint rejects stale names. Migrate both keys to the current title while preserving their values and allowance metadata, and audit other owned references.","file":"hub/test/nvim-items-rules.test.ts","line":110},{"severity":"medium","text":"M3 Spec: the new shared receipt wait is 30 seconds, while Coordinator decision 6d19f491 explicitly retains 15-second test bounds with the accepted 5-second safety interval. Restore the 15-second receipt bound and matching guide/skill wording, or obtain an explicit revised decision before extending it; retain the exact completion receipts and final assertions.","file":"hub/test/tracker-reindex.ts","line":32}]
finding_counts: {"high":0,"medium":3,"low":0}

Full source review 1, A-13070: Standards 2 medium (exact per-file guide headings; stale renamed baseline/allowance identity), Spec 1 medium (30-second receipt wait contradicts Coordinator's retained 15-second bounds). Healthy timer/fallback/close, serialized stamp comparison and lexical startup alignment inspected. A-13064 independently has 3 identities x10 passing native exits and two-worker/CPU summary; A-13065 cost and Coordinator's accepted 5-second rationale retained. Deterministic dropped-event diagnosis does not identify the historical kernel loss. C1/C2 remain without final runtime verification; no configured/Linux/full-suite evidence yet. Consolidate corrections and request fresh exact-head source review before mode-free verify; retain current dev base unless Coordinator directs.

### rev-31 · 2026-10-28T05:25:18.738Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261028-1377-source2
commit: 7add65644913da6d037e2d225c9a81629da2a58c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source2 clear, A-13073. M1 exact guide headings fixed; M2 both renamed baseline/allowance keys migrated with every value/metadata field independently confirmed unchanged; M3 exact receipt bound and docs restored to 15 seconds. No dev merge; watcher/stamp and semantic assertions unchanged. A-13072 independently has 30/30 passing native child outcomes across 3 identities x10, 2 workers/140 CPU ticks, darwin Node24.21, with all 6 recorded source SHA256 values matching committed blobs. Local proof is distinct from pending configured/Linux evidence; accepted diagnostic/cost limits carried. Keep this head stable, submit one ordinary mode-free configured verify, then request original-record final evidence review. C1/C2 final settlement pending; no per-item QA.

### rev-31 · 2026-10-28T05:42:24.010Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261028-1377-final1
commit: 7add65644913da6d037e2d225c9a81629da2a58c
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final original-record audit clear, A-13077. Same-head e7ace0af/A-13076 exit0: 3834 ordinary passes plus 35 separate load passes (10 from the 2 new tracker identities, each5/5; 25 inherited site cases), no fail/cancel/skip/TODO. All required generated watcher/plan/removal/hand-save outcomes explicitly pass; owning files18/10/8/5 and docs3. C1 verified within Coordinator-accepted deterministic missed-event seam, without attributing exact historical kernel loss; C2 verified from same-head macOS A-13072 three identities10/10, two workers/CPU140ticks, native exits and matching committed hashes. HostT0/allT1/fallback allT2/Web completed on Linux droplet with pinned Headless Shell; T3/T4 absent. Host gate TREE reuse, phase/body/projection/lifetime distinctions and report-only timing/lint/ratchet warnings retained. No new>=3s case allowance required; source2 unchanged. No per-item QA. Coordinator separately owns required full verify all before enqueue.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-28T06:23:31.467Z

Merged 5017e40dd601f702dc09e07cc8da87ee47545fb6 onto dev.
