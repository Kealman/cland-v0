---
id: T-71
kind: task
title: "Workbench: presence, process exits and token totals as hub events, so the sessions panel stops polling session.list"
state: open
labels:
  - ready-for-agent
  - slice-2
  - hub
  - nvim
assignee: null
parent: T-20
blocked_by:
  - T-67
topic: null
branch: null
created: 2026-10-09T10:46:33.920Z
updated: 2026-10-09T11:23:58.673Z
---

## Parent

Part of T-20. Proposed by impl-67 from T-67 (artifact A-2, 2026-10-09 10:45Z); filed by the Coordinator. T-67 removed the items poll (`task` events carry every item change) and made the sessions refresh single-flight; this item removes the last timer.

## What was measured (nvim/lua/cland/init.lua before T-67)

- The items timer asked `task.list` every second while items were on screen; the 5 s timer asked it too. Removed in T-67 (c55de88).
- The 5 s timer runs `refresh_sessions`: `session.list`, `hub.status`, `role.list`, `inbox.list`, four requests. Still runs, single-flight since T-67. It also ran on `role.vacant`, `role.filled`, `session.role` and on every `session.state` of an unlisted session: a burst of N events asked 4N requests; since T-67 once, plus once after the first answer.
- On connect the workbench reads everything once.
- The journal of the 10:15Z incident shows about two `session.list` and two `task.list` per second from nvim, from more than one workbench.

## What still needs the poll, and why

- Presence: a spoke connecting or leaving emits no event; the panel learns it from `hub.status`.
- A launched process that ended: `session.state` goes `unknown`, but the row's status (exited, died, attach cleared) arrives only with `session.list`.
- Token and cost totals (`usage` on the process rows): no event.

## What to build

- Hub events for the three: presence changes, process-table changes (the row), and usage updates throttled per session.
- The workbench applies them and drops the sessions timer; it keeps the one read on connect.

## Acceptance criteria

- [ ] The workbench asks `session.list` and `hub.status` only on connect and after a launch or stop it made itself; a headless test counts the requests through the stub hub over several seconds
- [ ] Presence, a process exit and a usage change show without a poll (tests through the stub hub's `emit`)
- [ ] `npm run typecheck && npm test` pass; hub/README.md documents the new events in "The UI's frames"

## Notes

Size S. Blocked by T-67. Implementer: Codex gpt-6.1-sol or Claude Code.

## Comments

### coord · 2026-10-09T11:23:58.673Z

Three low findings from qa-cc2's QA of T-67 (qa-cc2-67-1). They are out of T-67's scope and belong here:
1. nvim/README.md:52 still describes the `task.list` polling that T-67 removed.
2. The workbench sends `inbox.list` twice per connect (init.lua:113 and topic_view.lua:62), so every connect logs a `too-fast` line.
3. The request budget times only the synchronous part of a handler (dispatch.ts:706), so a request stuck waiting on async git never shows as `slow-request`. Time each handler until its answer is sent, and record async waits as well.
