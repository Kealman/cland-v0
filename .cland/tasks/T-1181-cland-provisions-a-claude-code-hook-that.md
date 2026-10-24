---
id: T-1181
kind: task
title: cland provisions a Claude Code hook that refuses rm with a computed target instead of stalling on approval
state: open
status: review
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1197
blocked_by: []
topic: topic-1001
branch: t/T-1181-cland-provisions-a-claude-code-hook-that
created: 2026-10-23T12:27:44.393Z
updated: 2026-10-24T20:57:16.157Z
---

## Summary

Claude Code stops an rm whose target is computed in the command (`$(…)`, a variable, xargs) for human approval even under bypass permissions ("Dangerous rm operation on statically-unresolvable target"), and the prompt stalls the session. In this project it repeatedly stalled the Coordinator through sub-agent cleanups (2026-10-19, 2026-10-23). Commit 16c563e0 added a project-own PreToolUse hook (`.claude/hooks/literal-rm.mjs`) that refuses such a command with the reason, so the agent retries with a literal path. cland should provision this guard for every project it sets up, and inject it into the sessions it launches.

## What to build

Ship the literal-rm guard as one of cland's managed Claude Code hooks: provisioned by `cland init`/`update` into `.claude/settings.json` with the managed mark, and injected with `--settings` into launched Claude Code sessions, as the existing hooks are. Retire the project-own copy once the managed one lands.

## Acceptance criteria

- [x] C1. `cland init` and `cland update` add a managed PreToolUse Bash hook that refuses rm/rmdir with a command-substitution, variable or xargs target and allows literal paths, `git rm` and here-document bodies (test).
  - done: impl-1181 · 2026-10-24T20:56:47.126Z
- [x] C2. A hub-launched Claude Code session's injected settings carry the same hook (test).
  - done: impl-1181 · 2026-10-24T20:56:47.237Z
- [x] C3. This project's own `.claude/hooks/literal-rm.mjs` entry is removed in favour of the managed one, with no duplicate hook (code).
  - done: impl-1181 · 2026-10-24T20:56:47.352Z

## Comments

### impl-1181 · 2026-10-24T20:52:17.900Z

Consumer audit before adding the refusal policy (rule 20): managed settings are produced by init/claude-settings.ts (mergeHooks/hookCommand, shared init/update provision path), injected by adapters/claude-code.ts, and checked by doctor/project.ts. HOOK_EVENTS consumers are those producers/doctor plus init-settings.test.ts, init.test.ts and init-process.test.ts. CLI hook.ts dispatch currently treats all other events as signals; literal-rm will be local-only before signal dispatch, without changing existing wire shapes/records. Launch settings consumers include claude-code-environment, claude-code-adapter/schedule, fake-claude-cleanup and fakes/claude-code (unknown PreToolUse stays unused until a Bash tool event). Existing hand-authored project hooks remain preserved; this repo's prototype entry/file is retired explicitly. Searched hub production/tests all tiers, docs, QA briefs/fixtures and shipped skills for PreToolUse/HOOK_EVENTS/mergeHooks/hookCommand/literal-rm: no further protocol/client/startup/persisted-reader consumers. Docs/help and implement skill will describe local synchronous refusal; existing signal hooks remain async. Pre-agreed seams: T1 shared settings provision + pure payload policy, T2 recorded adapter launch settings, existing real init/update file tests for compatibility. No hub API shape changes, so older hub/client wire remains unchanged.
