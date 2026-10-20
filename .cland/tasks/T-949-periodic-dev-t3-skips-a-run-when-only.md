---
id: T-949
kind: task
title: Periodic dev T3 skips a run when only tracker files moved since the last one (compare the verification tree, not the head)
state: open
status: planned
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-952
blocked_by: []
topic: null
branch: null
created: 2026-10-20T08:36:43.941Z
updated: 2026-10-20T09:41:43.819Z
---

## Summary

The human, 2026-10-20 08:36Z in General, approved this for the post-release debt sweep (D76). The periodic dev T3 occasion (`[verification] dev_t3_every`) starts a run when dev's head differs from the last started run's head (hub/src/hub/suites.ts, around the dev-t3 scheduler). A tracker-only commit (`.cland/tasks`, `.cland/RULES.md`) moves the head without changing what is tested, so it can trigger a run of about 23 minutes and $0.10 that proves nothing new. The nightly soak already compares the tree.

## Acceptance criteria

- [ ] C1. The periodic dev T3 compares the verification candidate tree (the shared exclusion definition of verification-tree.ts) with the last started run's tree, and skips when they are equal; a T2 test with a fake clock shows a tracker-only commit after the interval starts no run and a code commit does.
- [ ] C2. docs/agents/tests.md and hub/README.md say the periodic run starts only when the tested tree changed.
- [ ] C3. A mode-free `cland verify` at the reviewed head is green.
