---
id: T-509
kind: task
title: "role-integrity test: the relaunched spoke's refusal after a rename isn't seen within 15 s (Linux, under load)"
state: open
status: planned
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: null
branch: null
created: 2026-10-15T15:39:05.347Z
updated: 2026-10-17T21:48:42.499Z
---

## Problem

`hub/test/role-integrity.test.ts:152`, the renamed-session revocation case, failed on Linux in T-498's droplet verify 65bb9a73 (A-3130). The `eventually` at :174, "the relaunched spoke refused", didn't hold within 15000 ms. The head carries T-486, so this isn't the Codex first-turn idle race; it's the relaunch/refusal path after a rename under 4-worker load.

## Acceptance criteria

- [ ] C1. The case observes the relaunched spoke's connection and refusal through a definite event, rather than polling a 15 s window that a loaded relaunch can outlast, or the window is aligned with the product's own relaunch deadline, citing its line. Every assertion stays, and the root cause is recorded in the commit.
- [ ] C2. role-integrity.test.ts passes 5/5 serially, whole file and alone on the Mac, plus once on a droplet in the task's verify.
