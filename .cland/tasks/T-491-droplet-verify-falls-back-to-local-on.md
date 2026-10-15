---
id: T-491
kind: task
title: Droplet verify falls back to local on 'lock acquisition deadline reached' under load
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-15T12:05:32.122Z
updated: 2026-10-15T12:05:32.122Z
---

## Summary

Under load, a verify that should go to a droplet falls back to the local slot with "lock acquisition deadline reached". This happened to 7453981f for T-453 at 12:04Z on 2026-10-15, with 1-min load around 34–44 and a droplet slot and budget free. The fallback lands in the serial Mac queue, the one place that's already overloaded, so load feeds more load.

## Acceptance criteria

- [ ] C1. A spend-ledger or executor lock that misses its deadline retries with backoff, within a bounded wait, before falling back to local. The fallback notice names the lock and how long it waited.
- [ ] C2. A test holds the lock past the old deadline while a remote slot and budget are free, and shows the run still goes remote once the lock frees within the bounded wait.
