---
id: T-1926
kind: task
title: A Codex session receives an already-answered review request again and again, with the same stale progress notes
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
created: 2026-11-16T22:29:11.865Z
updated: 2026-11-16T22:29:11.865Z
---

## Summary

A Codex Reviewer session (rev-38, launched 2026-11-16 22:25Z, no reconnect since) received one accepted review request, msg 5b257321-d065-4e3f-8377-49fb8b3e3933 for T-1677, at least four more times after it had recorded its source verdict rev-38-1677-source-2 and its reply e0356476-922d-411c-b047-1bb502979405. Each redelivery repeated the same five stale progress notes. No duplicate verdict was written, but each repeat costs the session a turn and risks a second review.

## Evidence

- Reviewer report 42efa3c5-236b-47a5-ac97-b82db8a8748a in topic-1570; relayed by impl-1677 (msg 0a2a00ca-c2aa-4bf9-bea3-21fdbd9f94e4).
- Related but distinct: T-1651 (replays after the Coordinator's Claude harness reconnects) and T-1924 (Claude turn receipts that time out). This case is a Codex session without a reconnect.

## Acceptance criteria

- [ ] C1. A delivery the recipient has answered (reply_to or a recorded verdict naming it) is not delivered again to that session; a regression with a Codex fixture session reproduces the repeat before the fix (test).
- [ ] C2. Progress notes already digested into a turn are not re-sent with a later redelivery (test).
