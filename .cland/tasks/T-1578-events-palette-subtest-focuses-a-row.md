---
id: T-1578
kind: task
title: Events palette subtest focuses a row that a late event re-renders (detached on macOS stage cover)
state: open
status: in progress
size: XS
criterion_seq: 3
labels:
  - ready-for-agent
  - bug
  - flaky
assignee: null
parent: C-325
blocked_by: []
regression_of: T-1127
topic: topic-1293
branch: t/T-1578-events-palette-subtest-focuses-a-row
created: 2026-11-01T06:25:26.372Z
updated: 2026-11-01T06:28:35.717Z
---

## Summary

`web/test/events.test.ts` › "physical s selects an Events subject in the palette and Enter opens topic, session and artifact subjects" failed on the macOS stage cover 6d153f45 at dev 6700d6a7 (A-15202, local darwin arm64, 2 workers, peak load 5.43) with `locator.focus: Timeout 3000ms exceeded`. The call log shows the `[data-event-id]` row filtered by `data-event-subject="events-worker"` resolved and was then detached from the DOM while being retried (events.test.ts:230). The Linux stage cover bdab5e3a at the same head passed. The file passed 5/5 alone on the same Mac (`node --test web/test/events.test.ts`). The test focuses a row that a later event re-renders. Same family as T-1577: a Web read races an asynchronous re-render under macOS full-run load.

## Acceptance criteria

- [ ] C1. The step waits for the Events list to settle (a receipt for the last expected event, or a stable row identity) before it focuses the row, with the test's assertions unchanged.
- [ ] C2. A regression holds or replays the late event that re-renders the row, and shows the focus step still succeeds.
- [ ] C3. The file passes five sequential targeted runs on macOS with normal admission (`node --test web/test/events.test.ts` after `npm run build`, or the mode-free verify's file selection), each receipt kept; the deterministic control in C2 carries the race proof, not machine load.

## Comments

### impl-1578 · 2026-11-01T06:27:02.216Z

Pre-change failure quoted in topic-1293 from A-15202: locator.focus Timeout 3000ms exceeded; events-worker launched row resolved then detached, events.test.ts:230. Deterministic events.list response-holding control prepared. First targeted run was refused at admission by cover-quiet f7d23abd before setup; awaiting test-slot-available, no runtime pass/fail claimed. Source points to reactivation's fresh first page replacing retained older-page rows before focus. No production contract changes.
