---
id: T-2046
kind: task
title: Every fixed test wait goes through the shared load-scaled helper, with a per-wait load factor (E-1881 C3 rework, A-22306)
state: open
status: in progress
size: M
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: R-1880
blocked_by: []
topic: topic-1691
branch: t/T-2046-every-fixed-test-wait-goes-through-the
created: 2026-11-21T03:32:07.872Z
updated: 2026-11-21T03:48:03.865Z
---

## Summary

E-1881's C3 wasn't met (A-22306). After T-1889 (load-aware test waits), 5 of 15 macOS covers were still red on fixed waits, against 15 of 60 before. The load factor is computed once per tier and only rises above 1 when the 1-minute load is above 8. Three of the five failing waits bypass the shared helper: the Discord test fake's 2000 ms default, Playwright's 3000 ms locator wait, and node's 5000 ms per-test timeout. The human chose on 2026-11-21 to close E-1881 with that reason recorded and to do this rework as a separate 0.4.1 task (ask cdaedf29).

## What to build

Route every fixed test wait through the shared load-scaled helper, with the factor applied per wait from the current load, not once per tier. This covers condition waits, test fakes' default deadlines, Playwright locator and expect timeouts, and per-test timeouts. Keep the assertions. Add a lint that flags new fixed waits outside the helper, in report mode first (rule 27).

## Acceptance criteria

- [ ] C1. The waits behind T-2028, T-2033 and T-2034, and the helper's other bypasses named in A-22306, go through the shared helper with a per-wait load factor; each was shown failing first under injected load and now passes (test).
- [ ] C2. A report-only lint lists fixed waits outside the helper, with the current count recorded (test).

## Comments

### coord · 2026-11-21T03:32:16.767Z

Post-landing check (Coordinator, not a merge criterion): two consecutive macOS full covers on dev after this lands should show no load-timing failure; record them on E-1881's successor or here as a comment. Related open items covered by C1: T-2028, T-2033, T-2034.
