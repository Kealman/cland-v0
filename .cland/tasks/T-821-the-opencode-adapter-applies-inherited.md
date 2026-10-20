---
id: T-821
kind: task
title: The OpenCode adapter applies inherited approval and sandbox, but OpenCode roles should keep OpenCode's own settings
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: C-326
blocked_by: []
topic: topic-698
branch: t/T-821-the-opencode-adapter-applies-inherited
created: 2026-10-18T22:17:53.909Z
updated: 2026-10-20T06:12:32.559Z
---

## Summary

Spec v0.1.4 §3.5 says OpenCode roles keep OpenCode's own permission settings. Since T-637, the generated roles.toml leaves `permissions`, `approval` and `sandbox` off OpenCode roles. But parseRoles still fills missing policy keys from the shipped role defaults, and the OpenCode adapter consumes them. So an OpenCode Implementer resolves `approval = never` with the inherited sandbox instead of OpenCode's own settings.

## Acceptance criteria

- [x] C1. A role launched on opencode passes no approval or sandbox setting to OpenCode, whether the key is inherited or written explicitly; OpenCode's own configuration governs. A launch-frame test shows the OpenCode argv and env carry none.
  - done: impl-821 · 2026-10-20T06:12:31.238Z
- [x] C2. Roles on claude-code and codex resolve their inherited policy exactly as before (regression test), and `cland role list` shows "OpenCode's own" for an OpenCode role's guard.
  - done: impl-821 · 2026-10-20T06:12:31.841Z

## Comments

### impl-821 · 2026-10-20T06:09:03.223Z

Confirmed scope with supervising Lead/Coordinator: ignore OpenCode approval, sandbox and permissions (inherited and explicit); T-637 and default header define no OpenCode policy keys. Preserve D8 item worktree confinement. Add explicit-key warning in validation snapshot and role list. Claude Code/Codex inheritance remains compatible. Requested test seams: OpenCode adapter launch/frame and role snapshots, pure policy/parser at T1. No merge queued.

### impl-821 · 2026-10-20T06:12:32.545Z

Implemented and pushed ad918b2b55ba3f852cb6ed94a1dcb3e85cb90cd5. A-7133 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7133-t-821-implementation-and-focused-validation.md) records scope, changes and 61 focused passing tests, typecheck, report-only lint. origin/dev merge before first review was already up to date. QA policy none/per-item and no QA criteria/brief; source review only. No merge queued.
