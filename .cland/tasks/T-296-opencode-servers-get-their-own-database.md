---
id: T-296
kind: task
title: "OpenCode servers get their own database: the shared database lets OpenCode's background service resume cland's sessions (#51213)"
state: open
status: backlog
labels:
  - ready-for-human
  - hub
  - bug
assignee: null
parent: T-294
blocked_by: []
topic: null
branch: null
created: 2026-10-12T16:20:56.477Z
updated: 2026-10-12T16:20:56.477Z
---

## What happened

Found by the T-295 research (docs/research/opencode-v2.md on research/opencode-v2): cland's per-session OpenCode servers share the user's default OpenCode database with OpenCode's own background service (v2's one-service-per-user model). When that service starts, for example because an agent runs an `opencode` CLI command inside a cland session, it resumes every session that is mid-turn, cland's included, and two processes then drive one session; the resumed copy runs with the user's global config and without cland's spoke. Reproduced twice in isolation; upstream issue #51213 is open and the code is unchanged through 2.0.27.

## What to build

cland's OpenCode servers get a database of their own: per user, or per account once the accounts registry (T-272, spec v0.1.2 §3.13) exists. The cost is one `opencode auth login` in that database for any saved login; doctor says so. Until then, the clauses tell agents never to run the `opencode` CLI inside a session.

## Acceptance criteria

- [ ] A cland-launched OpenCode session is never resumed by OpenCode's background service, shown by the research's reproduction turned into a test.
- [ ] The database location is set per account where accounts exist, per user otherwise; doctor names it and the login it needs.
