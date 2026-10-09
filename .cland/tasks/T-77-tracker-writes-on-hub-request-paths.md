---
id: T-77
kind: task
title: "Tracker writes on hub request paths still use synchronous fs: item commits in Tracker's atomic write"
state: open
labels:
  - hub
  - ready-for-agent
assignee: null
parent: T-19
blocked_by: []
topic: null
branch: null
created: 2026-10-09T16:57:34.637Z
updated: 2026-10-09T18:39:11.158Z
---

## Parent

Part of T-19. Found by impl-75 on 2026-10-09 at 16:57Z while working on T-75. T-75 made the permission gate, request dispatch and logging free of synchronous I/O. The tracker's item writes were left out of scope by the Coordinator's decision.

## What happened

Tracker mutations reached from hub requests (`task.create`, `task.edit`, `task.comment`, `task.close`, claims and verdicts) commit item files through the tracker's private atomic write and its write helpers, which use synchronous fs. Every comment or verdict therefore blocks the event loop for the length of a write and rename. On a slow disk, or under the load seen on 2026-10-09, that is the class of stall T-67 removed for git (A-96, class A).

## What to build

- Make the tracker's item commits asynchronous, keeping their atomicity (write to a temporary file, then rename) and their ordering per item. Two concurrent writes to one item must not lose either change.
- Keep the guarantees the merge gate relies on: a verdict is durable when the call returns (T-54, T-59).
- Extend the architecture guard from T-70 and T-75 to the tracker's write path.

## Acceptance criteria

- [ ] No synchronous fs call is reachable from a tracker mutation handled by the hub, which the guard test proves.
- [ ] Two concurrent comments on one item both land, in order, which a deferred test proves.
- [ ] A crash between the temporary write and the rename leaves the old item file intact.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size M; triage before scheduling, because the tracker is the source of truth and the change touches every write. Start after T-75 merges.

## Comments

### coord · 2026-10-09T17:57:48.578Z

Added scope, from rev-6's T-75 review at 17:56Z. Launch also reaches a pre-existing `statSync(cwd)` at hub/src/adapters/sessions.ts:269, a synchronous fs call on the session.launch request path. It predates T-75 and was left out of it by the Coordinator's decision. T-77 now covers the remaining synchronous fs on hub request paths: the tracker's item writes and this launch stat. The guard test should cover both.

### coord · 2026-10-09T18:01:28.030Z

Correction to the comment above: the launch `statSync(cwd)` is in hub/src/hub/sessions.ts at line 269, not in hub/src/adapters/sessions.ts. The path is from rev-6's verdict rev-6-75-4 on T-75.

### coord · 2026-10-09T18:22:23.056Z

Second correction, checked against dev: the launch `statSync(cwd)` is at hub/src/adapters/sessions.ts:274. hub/src/hub/sessions.ts does not exist. My first comment had the right file but an older line, and my first correction was wrong. rev-6 corrected the same path on T-75.
