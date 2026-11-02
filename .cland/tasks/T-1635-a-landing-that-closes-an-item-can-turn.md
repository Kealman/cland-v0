---
id: T-1635
kind: task
title: A landing that closes an item can turn the closed-item wording lint red on dev
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-326
blocked_by: []
topic: null
branch: null
created: 2026-11-02T15:55:22.884Z
updated: 2026-11-02T15:55:22.884Z
---

## Summary

T-1588 landed at 14:00Z (b8b1a95b) and closed. Its own `docs/agents/host-agent.md:22` said "a missed exit is conservatively fenced until the host lifecycle clears it" in a paragraph naming T-1588. Once T-1588 was closed, `lint-closed-item-wording` flagged that line, so `npm run check` (T0) was red on dev for every task after it. impl-1620 found it at 15:54Z. The batch's T0 ran before the close, while the item was still open, so the landing passed.

## What to build

The merge batch evaluates the closed-item wording lint against the tracker state its landing will produce: each member counts as closed. A violation refuses the batch the same way as a T0 failure, naming the member and the line.

## Acceptance criteria

- [ ] C1. A batch member whose own docs pair its id with `until` wording is refused before landing, with the file and line named (test).
- [ ] C2. A member whose docs only name another open item is unaffected (test).
