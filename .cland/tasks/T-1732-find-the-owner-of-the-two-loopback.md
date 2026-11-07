---
id: T-1732
kind: task
title: Find the owner of the two loopback listeners in transport-forwards' census at its next attributed occurrence
state: open
status: backlog
size: S
labels:
  - needs-triage
  - flaky
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-06T23:20:40.928Z
updated: 2026-11-06T23:20:40.928Z
---

## Summary

`transport-forwards.test.ts` C1 failed twice on Linux droplets, each time in a single-member merge batch: A-16451 (T-1604) and A-17279/A-17280 (T-1727). Both times the census found two `MainThrea` listeners on 127.0.0.1 ephemeral ports. In both logs the only test file overlapping C1's window in the other T3 worker was `hub/test/tracker-ready-native.test.ts`, during its failed-adoption restart cases (A-17284).

T-1670 added census diagnostics: each offending PID's command, start identity, parent, and why it was censused. It could not reproduce the failure in a Linux `--init` container: 20/20 green next to that neighbour at load 9.8–11.3. So the cause is still open, and the next real occurrence will be attributed.

## What to build

At the next failure of this C1 case, read the T-1670 attribution from the failure output, name the listener's owner, and fix the cause with a regression test that is red before the fix. Possible owners: a hub from `tracker-ready-native` holding the control-socket path, or a worker-shared listener.

## Acceptance criteria

- [ ] C1. The listener owner from the next attributed occurrence is named with its failure output, and the cause is fixed with a regression test that is red before the fix (test).
