---
id: T-576
kind: task
title: artifact.create on a large folder times out at 10 s while the hub completes it, losing the result and inviting a duplicate publish
state: open
status: backlog
size: S
labels:
  - bug
  - hub
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-16T06:13:36.210Z
updated: 2026-10-16T06:13:36.210Z
---

## Summary
Found by impl-466 on 2026-10-16. `artifact.create` for T-466's 15,554-file census evidence folder returned "the hub did not answer within 10s", but the hub completed and published it as A-3775. The caller found it only through `artifact.list`. A naive retry would publish it twice. This is the same class as T-537 (verify admission vs the CLI's 15 s reply limit): a long hub operation whose success is lost at a fixed client timeout.

## Acceptance criteria
- [ ] C1. A large artifact.create either returns within its timeout with an operation id that a follow-up call resolves to the final artifact, or the client waits a bound scaled to the folder size; a timed-out call never hides a completed publish.
- [ ] C2. A test publishes a folder large enough to exceed the old 10 s limit and shows exactly one artifact, with the caller receiving its id.
