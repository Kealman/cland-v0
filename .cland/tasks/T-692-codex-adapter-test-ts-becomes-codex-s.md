---
id: T-692
kind: task
title: codex-adapter.test.ts becomes Codex's contract file; steer, snapshot and recovery permutations move to a scripted native transport
state: open
status: planned
size: M
labels:
  - v0.1.4
  - verification
  - hub
  - tests
assignee: null
parent: E-677
blocked_by:
  - T-691
  - T-686
topic: null
branch: null
created: 2026-10-16T19:59:35.806Z
updated: 2026-10-16T20:00:52.017Z
---

## Summary

`codex-adapter.test.ts` (80.0 s, 35 tests; 28 fake-binary sites, 8 numeric sleeps) launches a fresh fake app-server for each of 13 steer-reconciliation permutations: late steer ×5, reconnect snapshot ×2, idle snapshot ×2, recovery ×4 (report-slice1 top 10 #5). `docs/agents/tests.md` already allows a fake native transport for adapter parsing edges. `codex-delivery.test.ts` (19.1 s) boots a hub process five times with no lifecycle assertion and repeats OpenCode's artifact-envelope proof (report-slice3).

## What to build

- **The contract file.** `codex-adapter.test.ts` is tagged `{ "tier": "T3", "contract": "codex" }` and keeps one proof per T-691 checklist step: launch, attach, per-role tools, restart-resume, relaunch.
- **A scripted native transport.** The Codex adapter's app-server connection takes an in-process double that scripts the replies, and the 13 permutations run against it in a new T1 or T2 file with their assertions.
- **codex-delivery.test.ts** runs on `projectHub`. The artifact-envelope composition is the hub's, so it is proven once in-process by T-691's composition file, and the per-adapter duplicate goes.

## Acceptance criteria

- [ ] C1. `codex-adapter.test.ts` is the `codex` contract entry, with its header mapping each checklist step to one test.
- [ ] C2. The steer, snapshot and recovery permutations run in a T1 or T2 file on the scripted transport, passing the tier lint.
- [ ] C3. Manifest seconds of the touched and new files fall from 99.1 s (A-3877) to 55 s or less, and their fake-binary call sites from 33 to 15 or less.
- [ ] C4. Their `startDaemon` call sites fall from 9 to 2 or less, each in a test naming its restart behaviour.
- [ ] C5. An audit maps every moved or rewritten assertion to its new place, with no behaviour claim dropped.
- [ ] C6. Each touched file passes 5/5 serially as a whole file on the Mac and once in the task's droplet verify.

## Blocked by

T-686.
