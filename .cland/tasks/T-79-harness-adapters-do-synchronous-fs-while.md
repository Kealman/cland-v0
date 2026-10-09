---
id: T-79
kind: task
title: "Harness adapters do synchronous fs while spawning a session: Codex mkdirSync, rmSync, openSync and closeSync on launch"
state: open
labels:
  - hub
  - ready-for-agent
assignee: null
parent: T-19
blocked_by: []
topic: topic-40
branch: t/T-79-harness-adapters-do-synchronous-fs-while
created: 2026-10-09T18:47:17.580Z
updated: 2026-10-09T21:54:18.161Z
---

## Parent

Part of T-19. Found by impl-77 on 2026-10-09 at 18:46Z while extending the launch guard for T-77. T-77 guards the shared launch layer with a fake adapter. The adapters' own spawn paths were left out by the Coordinator's decision.

## What happened

Launching a session runs synchronous fs inside the harness adapters. In the Codex adapter, hub/src/adapters/codex.ts lines 353–379 call `mkdirSync`, `rmSync`, `openSync` and `closeSync`, and its workspace and policy helpers do more. The other adapters, OpenCode and Claude Code, are likely similar. session.launch and relaunch are request paths, so these calls block every connected session for their duration (A-96, class A).

## What to build

- Audit every adapter's launch, relaunch, resume and stop paths for synchronous fs and process calls, and convert them to async, keeping their ordering and rollback on failure.
- Extend the native-boundary guard from T-70, T-75 and T-77 to each real adapter's spawn path, not only the fake adapter.

## Acceptance criteria

- [ ] No synchronous fs call is reachable from session.launch, relaunch or resume through any real adapter, which the guard proves.
- [ ] A launch that fails part-way leaves no half-made workspace or log file, which a test proves for each adapter.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size M. Start after T-77 merges. Can run beside T-78.

## Comments

### coord · 2026-10-09T20:23:19.252Z

Added scope, from rev-6-104-2 on T-104 (A-185), a low: the start of the launch's cwd stat, and the error timing of role assignment, are not yet timed consistently with the surrounding resumed scopes. They are bounded, so there is no stall risk. Fold this into T-79's launch-path timing pass.

### impl-79 · 2026-10-09T21:40:01.962Z

Auditing Codex, OpenCode and Claude Code launch/resume/stop dependencies. Will preserve ordered role admission and termination helper, add real-adapter native guards and staged failure cleanup evidence, then run typecheck and one full npm test.

### impl-79 · 2026-10-09T21:52:44.294Z

Implementation and targeted checks are complete: async Codex policy/socket/log helpers, async OpenCode config/password/log preparation and resume reads, launch rollback for created directories/files and identity-checked owned children. Real adapter native guards pass spawn/watch/live-resume/stop/relaunch and detect planted sync calls in all three. Failure injections cover directories, config/password partial writes, permissions, log snapshot/open/close/read, native spawn, readiness/exit/timeout, thread/session creation and logging; failed relaunch restores prior bytes/modes. Cwd-stat initiation and role-assignment error conversion timing regressions pass while T-104 admission ordering remains unchanged. Running the one required full npm test next.

### impl-79 · 2026-10-09T21:54:18.161Z

Committed implementation head 110943870a2b1236bd5291d504b39e5f284a3ef1 and pushed to local territory origin. Evidence A-217: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-217-t-79-native-guards-timing-and-failure-stage-table.md. Typecheck and targeted checks pass; one full npm test is queued behind the machine-wide suite lock.
