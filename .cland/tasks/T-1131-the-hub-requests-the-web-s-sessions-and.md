---
id: T-1131
kind: task
title: The hub requests the web's sessions and profile need
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-418
blocked_by: []
topic: null
branch: t/T-1131-the-hub-requests-the-web-s-sessions-and
created: 2026-10-22T15:16:14.965Z
updated: 2026-10-22T15:17:09.750Z
---

## Summary

Three hub changes the web slices consume: a session's recent messages for a human client, this browser's own sign-in record, and a refusal of a launch directory from the web edge.

## Parent

E-418 (hub work for tracer steps 3 to 5; v0.2 §3.7 serving and security; v0.1.2 §3.13).

## What to build

- **A session's recent messages.** A human client reads one session's recent messages, the ones it sent and the ones it received across topics, newest last, bounded and paged back by message number, as a session reads its own traffic with `history` today. The web edge allows it. The session's drawer (after E-417) shows it.
- **This browser's sign-in.** The web edge answers the asking browser about its own cookie session only: when it was made, when it was last used and when it expires (fixed at 30 days from the sign-in). Listing and revoking other browsers stays in the CLI, as `web.sessions` and `web.revoke` refuse the web today.
- **No directory from a page.** `session.launch` from the web edge carrying a directory is refused as CLI and Neovim only, so a page launches in the project root, or with an item in that item's task worktree. The CLI and Neovim keep their directory field.

The wire types go in the shared module with their conformance entries, and the web authority table classifies both new requests. New tests are T1 or T2.

## Acceptance criteria

- [ ] C1. A human client reads a session's recent messages in both directions across topics, bounded and paged by message number, and a session's own `history` is unchanged (T2 test).
- [ ] C2. Over the web edge a browser reads its own sign-in's creation, last use and expiry, and the reply names no other browser's session (T2 test).
- [ ] C3. `session.launch` with a directory from the web edge is refused with `cli-neovim-only`, and the same launch without a directory starts in the project root (T2 test).
- [ ] C4. The web authority table classifies both new requests, and its unit test refuses a web launch directory before dispatch (T1 test).
- [ ] C5. `hub/README.md` documents the two requests and the launch-directory refusal (docs).
