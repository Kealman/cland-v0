---
id: T-1837
kind: task
title: The launching user on session rows and Agents start lines
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1537
blocked_by:
  - T-1821
  - T-1822
topic: null
branch: null
created: 2026-11-12T10:07:23.052Z
updated: 2026-11-12T10:07:30.236Z
---

## Summary

In users mode the hub records which user launched a session, on its process row and its `session-launched` record. The Agents topic's start line and both workbenches' session rows name that user. Approval rows already name the answering user (T-1562).

## What to build

- **Recording.** A human launch carries the acting user, as other human actions do: an authenticated web user, or the CLI's first user or `--as` user where the launch takes it. The process row and the `session-launched` journal record gain an optional user id, kept across a hub restart.
- **Where it shows.** The process view and session row project the user's display name. The Agents start line reads "<session> started (<harness>) by <display name>" in users mode. The web's session row and Neovim's selected meta line name the user.
- **What stays unchanged.** A launch by the Coordinator or another agent records no user. Single mode is unchanged everywhere. Rows recorded before this change read without a user.

The site's sessions page gains one sentence on the launching user in users mode.

## Acceptance criteria

- [ ] C1. In users mode a session launched by a second user from the web, and one launched from the CLI, record that user on the process row and the `session-launched` record (test).
- [ ] C2. The Agents start line names the launching user in users mode and is unchanged in single mode (test).
- [ ] C3. The web's session row and Neovim's selected meta line name the launching user in users mode, and nothing in single mode (test).
- [ ] C4. A session launched by an agent records no user, and process rows recorded before the change read without one after a hub restart (test).
- [ ] C5. The site's sessions page names the launching user in users mode, and its commands pass the docs command check (test).

## Blocked by

- E-1536 (closed)
- T-1821 (Neovim's session row)
- T-1822 (the web's session row)

## Notes

- Hot files: `hub/src/adapters/sessions.ts` (the launch record), `hub/src/hub/agents-topic.ts`, `web/src/sessions/SessionRow.tsx`, `nvim/lua/cland/panels.lua`, `site/src/content/docs/docs/sessions.mdx`. Registration points: `hub/src/protocol.ts`, `shared/wire/index.ts`, `nvim/test/fixtures/protocol-frames.json`.
- Tests: new `hub/test/launch-user.test.ts` (T2, `projectHub` in users mode with two users); `web/test/sessions.test.ts` and `nvim/test/sessions.test.ts` cases.
- Serves the Contents' users stage (the user on session-launch rows; the approval rows are T-1562's); no checkbox names it.
