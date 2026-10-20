---
id: T-794
kind: task
title: Retire the legacy ~/.cland spend ledger write-through once every project hub runs the new state directory
state: open
status: in progress
size: S
criterion_seq: 2
labels:
  - needs-triage
assignee: null
parent: E-952
blocked_by: []
topic: topic-733
branch: t/T-794-retire-the-legacy-cland-spend-ledger
created: 2026-10-18T09:36:59.772Z
updated: 2026-10-20T10:12:28.346Z
---

## Summary

T-609 moves the droplet spend ledger out of ~/.cland into the new user state directory. While the legacy file exists, every mutation writes through to it first, so that an old hub of another project on the same machine still respects the shared cap (coord's disposition, 2026-10-18 09:35Z). Once every hub this user runs is on the new code, the write-through and the legacy file can go.

## Acceptance criteria

- [ ] C1. A documented, checkable condition decides when the legacy ledger can be retired, for example no hub of an older version registered for this user. The retirement refuses while that condition does not hold.
- [ ] C2. Retirement removes the write-through, leaves the legacy file's bytes in place (never moved or deleted) and records a durable snapshot/receipt beside the new ledger; a T1 test shows the cap still holds afterwards.
