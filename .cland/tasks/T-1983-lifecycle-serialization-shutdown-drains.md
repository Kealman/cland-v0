---
id: T-1983
kind: task
title: lifecycle-serialization "shutdown drains a held found resume" times out at its fixed 2 s test bound on macOS dev, alone and at low load
state: open
status: backlog
size: XS
labels:
  - ready-for-agent
  - flaky
assignee: null
parent: E-1881
blocked_by: []
topic: null
branch: null
created: 2026-11-18T18:59:49.929Z
updated: 2026-11-18T18:59:49.929Z
---

## Summary

`hub/test/lifecycle-serialization.test.ts:44` "shutdown drains a held found resume without restarting supervision or publishing its result" fails with `'test timed out after 2000ms'` (2003 ms). It failed on dev d7050e7e2 run alone on macOS at a 1-minute load of 4.05 (Coordinator, 18:50Z on 2026-11-18). It failed twice on T-1646's head, including once alone at load 5.9. The `alive` and `identity` variants of the same loop pass, and the file passed T1 in the macOS stage cover cf666f3c at d7050e7e2 an hour earlier, so it's intermittent. The machine was healthy: swap 819 MB, `ps -A` 0.04 s.

## What to build

Name what the `found` path waits on beyond the 2 s per-test bound. Candidates are a native identity or process inspection for the found process's pid, or a supervision drain without a receipt. Fix the wait to observe its producing receipt, or move a real native boundary behind the injected fake (rule 38). Keep the assertions unchanged.

## Acceptance criteria

- [ ] C1. The cause is named from evidence: the step the `found` case spends its 2 s on, with a native-call census or timestamps (rule 39).
- [ ] C2. The case passes 20/20 alone on macOS at an ambient load below 8 and 20/20 under a load gate of 10 (native slot), assertions unchanged (evidence).
