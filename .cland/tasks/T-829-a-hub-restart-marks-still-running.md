---
id: T-829
kind: task
title: A hub restart marks still-running harness sessions exited, and hub stop then leaves them alive
state: open
status: backlog
size: S
labels:
  - ready-for-agent
  - qa-found
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-19T06:07:06.059Z
updated: 2026-10-19T06:07:06.059Z
---

## Summary

Found by QA in the E-611 demo (qa-2026-10-19-1 at e7de5ca7, check X). After F2's clean hub restart in a scratch project, the hub marked three live sessions exited: aide-1, worker-1 and impl-1, all fake Claude Code `__session` processes. Those processes kept running, reparented to pid 1. The later `hub stop` cleaned up only sessions it still considered running, so three harness processes outlived the hub. Evidence: X.txt, X-diagnostic.txt and X-classification.txt in the run's evidence.

## Acceptance criteria

- [ ] C1. A hub start that finds a recorded session whose process is still alive either re-adopts it (it reconnects) or stops it through its owned-process identity. It never marks a live process exited and leaves it running; a component test with a fake harness that survives a hub restart proves which.
- [ ] C2. After `hub stop` in a scratch project that went through a restart, no harness, spoke or child process of that project remains; a T3 scenario asserts this by pid.
