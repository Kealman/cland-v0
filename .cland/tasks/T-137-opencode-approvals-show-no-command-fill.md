---
id: T-137
kind: task
title: "OpenCode approvals show no command: fill approvalCommand from OpenCode's permission data"
state: open
status: backlog
labels:
  - tech-debt
  - needs-triage
assignee: null
parent: T-216
blocked_by: []
topic: null
branch: null
created: 2026-10-10T01:26:12.435Z
updated: 2026-10-11T06:35:53.565Z
---

## Parent

T-109 (Workbench basics). Found during T-127; evidence A-331.

## What to build

T-127 shows the command a session's pending approval waits on. Claude Code and Codex deliver it in their approval events. OpenCode's current permission event carries no command, so an OpenCode session that waits for approval shows only its state. Find what OpenCode exposes for a pending permission (its event stream or API), and fill `approvalCommand` from it. Apply the same rules as T-127: only the command line for a shell approval, and only the tool name for any other approval; nothing else from the tool input reaches events; the command clears when the waiting episode ends.

## Acceptance criteria

- [ ] An OpenCode session waiting for a shell approval shows its command in the sessions panel; any other approval shows the tool name.
- [ ] No other tool-input field reaches session events; a test checks it.
- [ ] The fake OpenCode in `hub/test/fakes/` covers the path.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size S. Not a v0.1 prerequisite. If OpenCode exposes no command at all, record that finding and close as wontfix.
