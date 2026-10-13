---
id: T-137
kind: task
title: "OpenCode approvals show no command: fill approvalCommand from OpenCode's
  permission data"
state: closed
status: done
criterion_seq: 4
labels:
  - ready-for-agent
assignee: impl-137
parent: E-229
blocked_by: []
topic: topic-164
branch: t/T-137-opencode-approvals-show-no-command-fill
created: 2026-10-10T01:26:12.435Z
updated: 2026-10-12T02:01:10.715Z
---

## Parent

T-109 (Workbench basics). Found during T-127; evidence A-331.

## What to build

T-127 shows the command a session's pending approval waits on. Claude Code and Codex deliver it in their approval events. OpenCode's current permission event carries no command, so an OpenCode session that waits for approval shows only its state. Find what OpenCode exposes for a pending permission (its event stream or API), and fill `approvalCommand` from it. Apply the same rules as T-127: only the command line for a shell approval, and only the tool name for any other approval; nothing else from the tool input reaches events; the command clears when the waiting episode ends.

## Acceptance criteria

- [x] C1. An OpenCode session waiting for a shell approval shows its command in the sessions panel; any other approval shows the tool name.
  - done: impl-137 · 2026-10-12T01:42:28.732Z
  - verified: rev-20 [reviewer] · run rev-20261012-137-d6a042a · 2026-10-12T02:00:50.006Z · commit d6a042a54e1f5d174f063ec9e5f744c20ec51553
- [x] C2. No other tool-input field reaches session events; a test checks it.
  - done: impl-137 · 2026-10-12T01:42:28.860Z
  - verified: rev-20 [reviewer] · run rev-20261012-137-d6a042a · 2026-10-12T02:00:50.006Z · commit d6a042a54e1f5d174f063ec9e5f744c20ec51553
- [x] C3. The fake OpenCode in `hub/test/fakes/` covers the path.
  - done: impl-137 · 2026-10-12T01:42:29.025Z
  - verified: rev-20 [reviewer] · run rev-20261012-137-d6a042a · 2026-10-12T02:00:50.006Z · commit d6a042a54e1f5d174f063ec9e5f744c20ec51553
- [x] C4. `npm run typecheck && npm test` pass.
  - done: impl-137 · 2026-10-12T02:00:40.774Z
  - verified: rev-20 [reviewer] · run rev-20261012-137-d6a042a · 2026-10-12T02:00:50.006Z · commit d6a042a54e1f5d174f063ec9e5f744c20ec51553

## Notes

Size S. Not a v0.1 prerequisite. If OpenCode exposes no command at all, record that finding and close as wontfix.

## Comments

### impl-137 · 2026-10-12T01:34:39.431Z

Investigating OpenCode permission event/API data and the existing adapter integration seam. Will preserve T-127's command-only/tool-name-only session events and verify clearing after waiting ends.

### impl-137 · 2026-10-12T01:41:56.725Z

Confirmed v2.0.24 upstream schema and shell implementation: permission.asked contains action/resources and source {type: tool, messageID, id}; shell resources are parsed fragments. OpenCode's own TUI reads input.command from the referenced assistant tool part. Adapter now follows that source through GET /api/session/{sessionID}/message/{messageID}, projects only shell input.command or the part name, and falls back to the permission action when source data is missing/unavailable. Reconnect snapshots retain the same source and late lookups cannot describe answered requests. No renderer or other harness changes. Command/privacy test failed against old production and passed after the fix; typecheck passed. Added fake HTTP/SSE coverage for shell, edit, missing source, reconnect, and a held lookup crossing waiting episodes.

### impl-137 · 2026-10-12T02:00:41.031Z

Final exact-head cland verify all run 623e4b9a-d00a-42d2-9aa7-16691f95054d passed at d6a042a54e1f5d174f063ec9e5f744c20ec51553: typecheck and full hub/Neovim suites, 1618/1618 passing, zero failures/cancellations/skips. Log artifact A-1490: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1490-suite-623e4b9a-d00a-42d2-9aa7-16691f95054d-all-at-d6a042a.log. C4 done. Review inspection A-1487 reports Standards 0 / Spec 0; awaiting final verdict. No commits added after the reviewed head.

### rev-20 · 2026-10-12T02:00:50.006Z

verdict: review
result: clear
by: rev-20 [reviewer]
run: rev-20261012-137-d6a042a
commit: d6a042a54e1f5d174f063ec9e5f744c20ec51553

No high, medium, or low findings.

Standards: 0 findings; existing OpenCode client/tracker/adapter boundaries and fake HTTP/SSE integration seam preserved.
Spec: 0 findings. C1-C3 checked for shell command/tool name display, narrow projection/privacy, clearing, missing-source fallback, reconnect snapshots, and late-request identity guards. Existing panel propagation inspected.
C4: exact-head full suite 623e4b9a-d00a-42d2-9aa7-16691f95054d passed npm run typecheck and npm test; 1618/1618 tests pass, exit 0 (A-1490 durable log).
Review inspection: A-1487. Final review artifact posted in topic-164. All C1-C4 verified.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-10-12T02:01:10.715Z

Merged df9cf3267a04ce1f7b221804d86061de1bf07997 onto dev.
