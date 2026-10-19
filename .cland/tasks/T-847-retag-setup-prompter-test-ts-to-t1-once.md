---
id: T-847
kind: task
title: Retag setup-prompter.test.ts to T1 once T-835's pause-scanner fix is live
state: open
status: backlog
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-613
blocked_by:
  - T-835
topic: null
branch: null
created: 2026-10-19T06:44:17.771Z
updated: 2026-10-19T06:44:17.771Z
---

## Summary

T-835's `hub/test/setup-prompter.test.ts` only touches in-memory streams, but the live hub's verify admission classifies it as machine-touching because its pre-T-835 scanner treats any call named `pause` as a timer. T-835 carries the scanner fix and tags the file T3 to satisfy the live admission. Once T-835's scanner is live (merged plus a hub restart), the file belongs in T1.

## Acceptance criteria

- [ ] C1. After T-835's scanner is live on the serving hub, `hub/test/setup-prompter.test.ts` is tagged T1 in tiers.json, test:lint and verify admission both accept it at T1, and its durations entry moves accordingly.
