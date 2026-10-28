---
id: T-1377
kind: task
title: Two tracker-watcher tests time out together in a loaded macOS stage cover
state: open
status: backlog
size: S
labels:
  - qa-found
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-27T19:31:23.217Z
updated: 2026-10-28T01:57:42.783Z
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
