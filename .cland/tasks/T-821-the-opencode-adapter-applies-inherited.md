---
id: T-821
kind: task
title: The OpenCode adapter applies inherited approval and sandbox, but OpenCode roles should keep OpenCode's own settings
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: C-326
blocked_by: []
topic: null
branch: null
created: 2026-10-18T22:17:53.909Z
updated: 2026-10-18T22:17:53.909Z
---

## Summary

Spec v0.1.4 §3.5 says OpenCode roles keep OpenCode's own permission settings. Since T-637, the generated roles.toml leaves `permissions`, `approval` and `sandbox` off OpenCode roles. But parseRoles still fills missing policy keys from the shipped role defaults, and the OpenCode adapter consumes them. So an OpenCode Implementer resolves `approval = never` with the inherited sandbox instead of OpenCode's own settings.

## Acceptance criteria

- [ ] C1. A role launched on opencode passes no approval or sandbox setting to OpenCode, whether the key is inherited or written explicitly; OpenCode's own configuration governs. A launch-frame test shows the OpenCode argv and env carry none.
- [ ] C2. Roles on claude-code and codex resolve their inherited policy exactly as before (regression test), and `cland role list` shows "OpenCode's own" for an OpenCode role's guard.
