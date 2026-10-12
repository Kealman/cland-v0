---
id: T-137
kind: task
title: "OpenCode approvals show no command: fill approvalCommand from OpenCode's permission data"
state: open
status: review
criterion_seq: 4
labels:
  - tech-debt
  - ready-for-agent
assignee: impl-137
parent: T-229
blocked_by: []
topic: topic-164
branch: t/T-137-opencode-approvals-show-no-command-fill
created: 2026-10-10T01:26:12.435Z
updated: 2026-10-12T01:42:35.915Z
---

## Parent

T-109 (Workbench basics). Found during T-127; evidence A-331.

## What to build

T-127 shows the command a session's pending approval waits on. Claude Code and Codex deliver it in their approval events. OpenCode's current permission event carries no command, so an OpenCode session that waits for approval shows only its state. Find what OpenCode exposes for a pending permission (its event stream or API), and fill `approvalCommand` from it. Apply the same rules as T-127: only the command line for a shell approval, and only the tool name for any other approval; nothing else from the tool input reaches events; the command clears when the waiting episode ends.

## Acceptance criteria

- [x] C1. An OpenCode session waiting for a shell approval shows its command in the sessions panel; any other approval shows the tool name.
  - done: impl-137 · 2026-10-12T01:42:28.732Z
- [x] C2. No other tool-input field reaches session events; a test checks it.
  - done: impl-137 · 2026-10-12T01:42:28.860Z
- [x] C3. The fake OpenCode in `hub/test/fakes/` covers the path.
  - done: impl-137 · 2026-10-12T01:42:29.025Z
- [ ] C4. `npm run typecheck && npm test` pass.

## Notes

Size S. Not a v0.1 prerequisite. If OpenCode exposes no command at all, record that finding and close as wontfix.

## Comments

### impl-137 · 2026-10-12T01:34:39.431Z

Investigating OpenCode permission event/API data and the existing adapter integration seam. Will preserve T-127's command-only/tool-name-only session events and verify clearing after waiting ends.

### impl-137 · 2026-10-12T01:41:56.725Z

Confirmed v2.0.24 upstream schema and shell implementation: permission.asked contains action/resources and source {type: tool, messageID, id}; shell resources are parsed fragments. OpenCode's own TUI reads input.command from the referenced assistant tool part. Adapter now follows that source through GET /api/session/{sessionID}/message/{messageID}, projects only shell input.command or the part name, and falls back to the permission action when source data is missing/unavailable. Reconnect snapshots retain the same source and late lookups cannot describe answered requests. No renderer or other harness changes. Command/privacy test failed against old production and passed after the fix; typecheck passed. Added fake HTTP/SSE coverage for shell, edit, missing source, reconnect, and a held lookup crossing waiting episodes.
