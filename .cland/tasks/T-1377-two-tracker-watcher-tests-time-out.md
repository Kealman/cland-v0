---
id: T-1377
kind: task
title: Two tracker-watcher tests time out together in a loaded macOS stage cover
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: R-1278
blocked_by: []
topic: topic-1136
branch: t/T-1377-two-tracker-watcher-tests-time-out
created: 2026-10-27T19:31:23.217Z
updated: 2026-10-28T05:05:38.536Z
---

## Summary

In the macOS stage cover 5fcc5c84 at dev 605a65a0 (local, 2 workers, peak 1m load 8.45; log A-12870) two tracker-watcher tests timed out in the same 20 s window (19:29:26–19:29:46Z): `hub/test/task-plan.test.ts::invalid hand edits keep the accepted plan across restart, and valid hand edits replace it` (`watcher refuses plan: not within 15000 ms`) and `hub/test/task-prefixes.test.ts::removing an unclaimed child sends its terminal event to the surviving parent Lead` (`removed child is reported: not within 15000 ms`). Alone each passed 5/5 on the same tree; both passed in every other run this session.

## What to build

Find why a hand write or removal under `.cland/tasks/` went unnoticed by two separate fixture hubs for 15 s at the same moment (macOS file-event delivery delayed or coalesced under load, or a hub-side watcher gap). If the watcher can miss an event, that is a product defect: the hub must re-index the file eventually (rescan or equivalent) and the fix lands with a regression. If events only arrive late, move both tests to the exact re-index receipt helper T-1374 added (`reindexedAfter`) with a bound sized for a loaded macOS cover, and record the measured delivery delay.

## Acceptance criteria

- [ ] C1. The failure is attributed with evidence (missed event versus late event) quoted from a reproduction under load.
- [ ] C2. Both identities pass 10/10 under two workers plus owned CPU load on macOS.

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
