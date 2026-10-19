---
id: T-871
kind: task
title: "resilience: the stopped spoke can be swept before alpha's send, so the send returns no outcomes (load flake)"
state: open
status: backlog
size: S
labels:
  - flake
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: null
branch: null
created: 2026-10-19T12:16:19.694Z
updated: 2026-10-19T12:16:19.694Z
---

## Summary

`hub/test/resilience.test.ts` "a spoke acks every deliver and hands a message re-sent under the same id to its session once" failed in merge batch 8942325b (run 22fe413f, A-6016) at line 172 with `TypeError: Cannot read properties of undefined (reading 0)`. `sent.outcomes` was undefined, so alpha's send to beta returned no outcomes. Most likely the 100 ms keepalive sweep had already dropped the SIGSTOPped beta before the send. All three leave-one-out reruns passed 11/11 (A-6017, A-6018 and the T-509 omission).

## Acceptance criteria

- [ ] C1. The case sends to beta only after observing that beta is still present with its socket open after the stop, or it asserts the send reply shape before reading outcomes. Either way the race between SIGSTOP and the keepalive sweep is closed on an observed boundary, every existing assertion stays, and a red-to-green proof delays the send past one keepalive.
- [ ] C2. The file passes 20/20 serially on the Mac and in the mode-free task verify; the Linux T3 run is landing evidence.
