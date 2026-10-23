---
id: T-1181
kind: task
title: cland provisions a Claude Code hook that refuses rm with a computed target instead of stalling on approval
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-326
blocked_by: []
topic: null
branch: null
created: 2026-10-23T12:27:44.393Z
updated: 2026-10-23T12:27:44.393Z
---

## Summary

Claude Code stops an rm whose target is computed in the command (`$(…)`, a variable, xargs) for human approval even under bypass permissions ("Dangerous rm operation on statically-unresolvable target"), and the prompt stalls the session. In this project it repeatedly stalled the Coordinator through sub-agent cleanups (2026-10-19, 2026-10-23). Commit 16c563e0 added a project-own PreToolUse hook (`.claude/hooks/literal-rm.mjs`) that refuses such a command with the reason, so the agent retries with a literal path. cland should provision this guard for every project it sets up, and inject it into the sessions it launches.

## What to build

Ship the literal-rm guard as one of cland's managed Claude Code hooks: provisioned by `cland init`/`update` into `.claude/settings.json` with the managed mark, and injected with `--settings` into launched Claude Code sessions, as the existing hooks are. Retire the project-own copy once the managed one lands.

## Acceptance criteria

- [ ] C1. `cland init` and `cland update` add a managed PreToolUse Bash hook that refuses rm/rmdir with a command-substitution, variable or xargs target and allows literal paths, `git rm` and here-document bodies (test).
- [ ] C2. A hub-launched Claude Code session's injected settings carry the same hook (test).
- [ ] C3. This project's own `.claude/hooks/literal-rm.mjs` entry is removed in favour of the managed one, with no duplicate hook (code).
