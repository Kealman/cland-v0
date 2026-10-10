---
id: T-202
kind: task
title: A spoke with no session name does not connect, instead of retrying into a refusal
state: open
status: backlog
labels:
  - tech-debt
  - low
  - ready-for-agent
assignee: null
parent: T-19
blocked_by: []
topic: null
branch: null
created: 2026-10-10T17:49:31.970Z
updated: 2026-10-10T17:49:31.970Z
---

## What to build

A `session-1` with no role connects to the hub about every 15–17 minutes and is refused each time (hub.log refused-role at 16:51, 17:09, 17:26, 17:40Z on 2026-10-10, a new anon id each time). The likely source is Claude Code's background spare pool: spare `claude` processes load the cland plugin before any cland launch binds them, so their spoke has no CLAND_SESSION_NAME. Not proven.

A spoke started without CLAND_SESSION_NAME and without a `cland role` mapping for its name skips connecting. It writes one journal line saying why, and does not retry into a refusal.

## Acceptance criteria

- [ ] A spoke with neither a session name nor a role mapping makes no hub connection and writes one journal line.
- [ ] A spoke with a role mapping, or launched by the hub, connects as today.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size XS. Low priority, not for v0.1 (stand-in, 2026-10-10); the human may promote it.
