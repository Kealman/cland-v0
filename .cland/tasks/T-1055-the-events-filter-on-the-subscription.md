---
id: T-1055
kind: task
title: The events filter on the subscription
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-413
blocked_by: []
topic: null
branch: null
created: 2026-10-21T14:04:14.927Z
updated: 2026-10-21T14:04:26.173Z
---

## Summary

Let a subscription carry the events filter, so its first page and its live rows arrive already filtered.

## Parent

E-413 (§3.3 "The events filter"; tracer step 3).

## What to build

`subscribe` accepts an events filter by kind, warnings and subject, and a client can change it on its connection. The first page of events and every live row honour it. A connection without a filter gets every row, as Neovim does today.

## Acceptance criteria

- [ ] C1. A subscription filtered to warnings receives only warning rows, in its first page and live (test).
- [ ] C2. Changing the filter on a live connection changes the next page and the live rows without a reconnect (test).
- [ ] C3. A connection without a filter receives every row, unchanged from before (test).
- [ ] C4. `hub/README.md` documents the filter fields.
