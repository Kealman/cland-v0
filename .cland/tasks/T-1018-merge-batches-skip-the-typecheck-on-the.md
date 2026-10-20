---
id: T-1018
kind: task
title: Merge batches skip the typecheck on the combined tree, so two green tasks broke dev
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
created: 2026-10-20T17:30:31.804Z
updated: 2026-10-20T17:30:31.804Z
---

## Summary

Merge batches run `[merge] batch_tiers = ["T1"]` (D67) and no typecheck on the combined candidate tree. On 2026-10-20 T-979 (wire module with type-level conformance) and T-978 (adds `HubStatus.web`) each passed review and their own T0 at their own heads and landed in separate green T1 batches; the combination broke `npm run typecheck` on dev (TS2344, fixed by T-1017). Every task branch that merged dev then failed its T0.

## What to build

Every merge batch runs the T0 checks (at least `npm run typecheck` and the static lints) on the candidate tree before its tiers, and a red T0 bisects like a red tier. It is cheap (about 30 s) and catches cross-task type and lint breaks that per-branch T0 cannot.

## Acceptance criteria

- [ ] C1. A batch whose candidate tree fails `npm run typecheck` is red and its members are bisected, even when its T1 tests pass (test with two members that typecheck alone but not together).
- [ ] C2. The batch result names the T0 step with its duration, and `docs/agents/tests.md` documents it.
