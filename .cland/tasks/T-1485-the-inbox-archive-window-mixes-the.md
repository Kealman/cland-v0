---
id: T-1485
kind: task
title: The Inbox archive window mixes the fixture clock with the real clock, so phone-asks went red after 7 days
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by: []
topic: null
branch: null
created: 2026-10-30T12:19:45.148Z
updated: 2026-10-30T12:19:45.148Z
---

## Summary

`web/test/phone-asks.test.ts` "a second phone context answers, closing the first sheet and retaining its outcome until Inbox departure" turned red everywhere at about 2026-10-30 12:00Z: on dev, on every branch, on Linux droplets and on macOS, with no code change. Its fixture pins a FakeClock at 2026-10-23T12:00:00Z, and the Inbox archive shows departures from the last seven days (`hub/src/hub/inbox.ts`, the `archive` query, 7 × 86400 s). Part of that path reads the real clock rather than the fixture's, so once real time passed 2026-10-30 12:00Z the departure fell out of the window. The same head, ee8383f99, was green at 10:45Z and red at 12:18Z (A-14280 versus A-14352). Runs: A-14344, A-14347, A-14350, A-14352.

## What to build

The Inbox archive window is computed from one clock: the hub's injected clock, both for the cutoff and for the departure timestamps it compares against. Fixture tests are then independent of the wall clock. Audit the other web and hub tests that pin a FakeClock date and assert time windows (inbox, notifications, events, accounts, phone-*), and fix each that mixes clocks the same way. Keep production behaviour unchanged: seven days on the real clock.

## Acceptance criteria

- [ ] C1. The phone-asks case passes with the machine clock set more than seven days after its fixture date, shown by a regression that runs the fixture with an injected real-clock offset of at least 8 days and fails before the fix.
- [ ] C2. Every test that pins a FakeClock date and asserts a time window is listed with "uses the injected clock" or "fixed", and the list is in the review request (rule 20).
