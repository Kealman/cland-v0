---
id: T-79
kind: task
title: "Harness adapters do synchronous fs while spawning a session: Codex mkdirSync, rmSync, openSync and closeSync on launch"
state: open
labels:
  - needs-triage
  - hub
assignee: null
parent: T-19
blocked_by: []
topic: null
branch: null
created: 2026-10-09T18:47:17.580Z
updated: 2026-10-09T20:23:19.252Z
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
