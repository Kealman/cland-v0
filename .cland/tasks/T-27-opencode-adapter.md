---
id: T-27
kind: task
title: OpenCode adapter
state: open
labels:
  - ready-for-agent
  - slice-1
assignee: null
parent: T-19
blocked_by:
  - T-24
topic: null
branch: null
created: 2026-10-08T11:54:07Z
updated: 2026-10-08T13:17:15.602Z
github:
  repo: Kealman/cland-v0
  number: 27
  url: https://github.com/Kealman/cland-v0/issues/27
---

## Parent

Part of #19. Spec section 4.3; decision https://github.com/Kealman/cland-v0/issues/12; research `docs/research/harness-surfaces.md` (OpenCode 2.x service, SSE events, `permission.asked`, `form.created`, prompt API with `delivery: steer|queue`).

## What to build

The OpenCode adapter: a session is created on the local OpenCode server (the shared per-user service, or a standalone server per session when isolation is needed), with the spoke's MCP configuration injected through OpenCode's own configuration at spawn; attach runs the OpenCode TUI client against that server on that session; inject uses the prompt API with `steer` during a turn and `queue` otherwise, confirming `injected` from the API reply; state is derived from the SSE event stream, with `waiting for human` and `waiting for approval` derived from `form.created` and `permission.asked` and declared `heuristic` in the capability table, since the server reports only `running`; usage per message from the API. The role's default for the Implementer is OpenCode with a free model, so the model choice is a launch parameter.

## Acceptance criteria

- [ ] An OpenCode session spawned from the hub receives a General message as `injected` and replies into the thread
- [ ] The capability table marks `waiting for human` as heuristic and the UI shows that qualifier
- [ ] `attach_command` opens the OpenCode TUI on the hub's session; the session survives a Neovim restart
- [ ] A pending permission in OpenCode shows as `waiting for approval` in the hub within one event
- [ ] Tests run against a fake OpenCode server (HTTP plus SSE); one manual smoke run against the real harness with a free model is recorded
