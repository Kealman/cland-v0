---
id: T-45
kind: task
title: "spoke session.launch: accept cwd, so the Coordinator can launch a session in a worktree"
state: open
labels:
  - ready-for-agent
  - slice-1
assignee: null
parent: T-19
blocked_by: []
topic: null
branch: null
created: 2026-10-08T19:01:49.042Z
updated: 2026-10-08T19:14:43.512Z
---

## Parent

Part of T-19. Found while preparing T-42 (dogfooding): the Implementer for T-43 must run in `.cland/worktrees/T-43`, but the Coordinator's `session.launch` spoke tool (`hub/src/spoke/spoke.ts:93`) takes `name`, `role`, `model`, `harness` and `effort` only. The hub frame (`hub/src/adapters/requests.ts:21`) and the CLI (`cland session launch … --cwd dir`) already take `cwd`, so the Coordinator has to fall back to the CLI, which the audit records as `human`.

## What to build

- `session.launch` on the spoke takes `cwd` (optional: an absolute path, or one relative to the project root) and passes it in the frame. A directory that does not exist is refused with the hub's typed error.
- `hub/README.md` documents the parameter where the spoke tools and the launch defaults are described.

## Acceptance criteria

- [ ] A Coordinator spoke calling `session.launch {name, role, cwd}` gets a process whose `cwd` is that directory (against the fake harness, as the existing launch tests do)
- [ ] A relative `cwd` resolves against the project root; a missing directory is refused with a typed error
- [ ] `hub/README.md` documents the parameter
- [ ] `npm run typecheck && npm test` pass

## Comments

### human · 2026-10-08T19:14:43.512Z

GitHub mirror: https://github.com/Kealman/cland-v0/issues/44 (filed during the T-42 run; the numbers differ, the item is the source of truth).
