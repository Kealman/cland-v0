---
id: T-1814
kind: task
title: login add treats a dispatcher-synthesized sign-in completion as a close receipt and unmounts before the CLI's SSH has closed
state: open
status: planned
size: S
criterion_seq: 4
labels:
  - needs-triage
assignee: null
parent: E-1535
blocked_by:
  - T-1791
topic: null
branch: null
created: 2026-11-11T16:36:28.908Z
updated: 2026-11-11T18:39:48.295Z
---

## Summary

`cland login add` hands the harness sign-in to the human CLI over `ssh -t`; the hub records no SSH process or close receipt of its own. On a peer close (dispatch.ts near line 1467) or at hub shutdown (`#loginClosers`, near line 2259) the dispatcher synthesizes `complete(null)` for the pending add, and `prepareLoginSignIn` then unmounts and detaches the disk while the CLI's SSH child may still be running and writing the login file. The existing injected disconnect test asserts metadata cleanup only, not native ownership. impl-1790 found it while fixing the same gap for in-place sign-in in T-1790 (topic-1479, 2026-11-11 16:36Z), where owner loss now routes through `LoginSignIn.interrupt()` and keeps an exact-machine fence.

## What to build

Distinguish the CLI's own completion (sent on its pinned connection only after its child closed) from dispatcher-generated owner loss for login add, as T-1790 does for sign-in: owner loss neither unmounts nor detaches until a positive receipt (the owner's close report or the exact machine's deletion receipt) settles the disk, and the login's state says the add was interrupted.

## Acceptance criteria

- [ ] C1. A peer close mid-add on a fake host leaves the disk mounted and attached, and records the interrupted add with its host (test).
- [ ] C2. A graceful hub stop mid-add does the same (test).
- [ ] C3. The CLI's own post-close completion keeps today's success and failure paths, and an exact-machine deletion receipt settles an interrupted add (test).
- [ ] C4. A "Create one" card sign-in whose run ends without the agent's close receipt is recovered by the same owner as the CLI add: interrupted with its exact machine captured, disk retained until that machine's deletion receipt or the owner's own close (test).
