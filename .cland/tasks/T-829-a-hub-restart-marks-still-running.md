---
id: T-829
kind: task
title: A hub restart marks still-running harness sessions exited, and hub stop then leaves them alive
state: open
status: in progress
size: S
criterion_seq: 2
labels:
  - ready-for-agent
  - qa-found
assignee: null
parent: C-325
blocked_by: []
topic: topic-701
branch: t/T-829-a-hub-restart-marks-still-running
created: 2026-10-19T06:07:06.059Z
updated: 2026-10-20T06:09:55.348Z
---

## Summary

Found by QA in the E-611 demo (qa-2026-10-19-1 at e7de5ca7, check X). After F2's clean hub restart in a scratch project, the hub marked three live sessions exited: aide-1, worker-1 and impl-1, all fake Claude Code `__session` processes. Those processes kept running, reparented to pid 1. The later `hub stop` cleaned up only sessions it still considered running, so three harness processes outlived the hub. Evidence: X.txt, X-diagnostic.txt and X-classification.txt in the run's evidence.

## Acceptance criteria

- [ ] C1. A hub start that finds a recorded session whose process is still alive either re-adopts it (it reconnects) or stops it through its owned-process identity. It never marks a live process exited and leaves it running; a component test with a fake harness that survives a hub restart proves which.
- [ ] C2. After a hub restart in a scratch project, every harness, spoke and child process the project started is either reattached or tracked as running with its pid, so none is left untracked; `cland hub stop` keeps its documented restart semantics (sessions outlive it), and `cland session stop` on each tracked session leaves no process of the project behind; a T3 scenario asserts both by pid.

## Comments

### impl-829 · 2026-10-20T06:09:41.261Z

Recovery diagnosis: failed native discovery is treated as process exit in shared Sessions.#resume; Codex missing socket and OpenCode missing password have the same path as Claude agents miss. Separately, hub.stop currently preserves harnesses by design (existing restart contract test). Asked supervising lead to resolve C2 shutdown semantics before changing that behavior.
