---
id: T-295
kind: question
title: "OpenCode's new major version: what changed, what it adds for cland"
state: open
labels:
  - research
  - ready-for-human
assignee: null
parent: T-294
blocked_by: []
topic: null
branch: null
created: 2026-10-12T15:31:51.661Z
updated: 2026-10-12T15:31:51.661Z
---

## Question

The human asked on 2026-10-12: OpenCode has shipped a new major version (https://opencode.ai/v2/docs/migrate-v1/); study what changed and whether it gives cland more to work with. cland's OpenCode adapter (hub/src/adapters/opencode.ts, opencode/client.ts, server.ts, state.ts) was built against opencode v2.0.24, the version installed on this machine, and uses `opencode serve` with the endpoints /session, /session/{id}, /session/{id}/prompt, /session/{id}/message, /session/{id}/model, /session/active, /event, /permission and /config.

To find out, for the research branch `research/opencode-v2`: what the migration guide and the v2 docs say changed from v1 (config, permissions, agents and subagents, commands, plugins and hooks, the server API and the SDK, the event stream, sessions and their children, share, attach and the client-server split, auth and accounts, usage); which of it the adapter already relies on and which parts are deprecated or renamed; the capabilities v2 adds that cland does not use yet and what each would give (per role, per hub feature: launch, brief, role clause, deliveries, asks and approvals, verdicts, sub-agents, resume for stopped sessions per spec v0.1.2 §3.5, accounts per §3.13, limits, the quick message, artifacts); what cland would have to change to use them; and the risks (API stability, version pinning, what the Codex and Claude Code adapters cannot match). Resolved by the research note and a comment here; the human decides what enters v0.1.3.
