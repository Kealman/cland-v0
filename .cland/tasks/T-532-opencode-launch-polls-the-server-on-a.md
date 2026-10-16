---
id: T-532
kind: task
title: OpenCode launch polls the server on a port cland chose, and a rejected approval is reported as a rejection
state: open
status: in progress
size: S
labels:
  - v0.1.3
  - hub
assignee: null
parent: E-424
blocked_by: []
topic: topic-378
branch: t/T-532-opencode-launch-polls-the-server-on-a
created: 2026-10-15T20:59:18.648Z
updated: 2026-10-16T15:48:04.364Z
---

## Summary

E-424 slice 2 (tracer step 2). OpenCode launch stops waiting for a log line: the adapter picks the port and polls the server until it answers. A rejected approval is reported as a rejection, never as the server's shutdown (upstream #54180).

## What to build

See E-424's "Readiness" and "Rejections" bullets.

- **Readiness.** The adapter picks a free loopback port itself, passes it with `--port`, and polls an authenticated `GET /api/session/active` until it answers within the launch deadline. A port taken in between restarts the attempt on a new port. The log is read only to explain a failure.
- **Rejections.** The adapter keeps each session's last `permission.replied` with `reject`. A following `interrupted` with reason `shutdown` in the same execution is reported as the rejection, with its command, and the session stays alive. A shutdown with no rejection before it is still the server's death.

Code: `hub/src/adapters/opencode/server.ts`, `hub/src/adapters/opencode/state.ts`, `hub/src/adapters/opencode.ts`. Tests use the fake OpenCode binary in `hub/test/fakes/opencode/`.

## Acceptance criteria

- [ ] C1. A fake server that never prints its listening line launches, by polling the port cland chose, within the launch deadline.
- [ ] C2. A port taken between choice and bind restarts the attempt on a new port, and a launch that never answers fails naming the log's explanation.
- [ ] C3. A rejected approval followed by a shutdown interrupt is reported as a rejection with its command, the session stays alive, and a bare shutdown is still reported as the server's death.
