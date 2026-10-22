---
id: T-1156
kind: task
title: Neovim test client launches inherit HOME, account and GIT_* variables
state: open
status: backlog
size: XS
labels:
  - needs-triage
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-22T23:11:31.064Z
updated: 2026-10-22T23:11:31.064Z
---

## Summary

`createClient` in nvim/test/client.ts copies the whole parent environment (minus CLAND_* and NVIM*) into the headless Neovim child and only strips executor credentials with `withoutExecutorCredentials`. HOME, account variables (CLAUDE_CONFIG_DIR, CODEX_HOME and the like) and GIT_* reach the child unless each caller seals them, against rule 15. Reported by impl-1114 while working on T-1114 (topic-872).

## What to build

Every headless client launcher in nvim/test builds its child environment through the shared `fixtureEnvironment` boundary (test-support/fixture-environment.ts) after the caller's overlays, so no inherited home, account or Git variable can reach a fixture, whatever the caller passes.

## Acceptance criteria

- [ ] C1. A stub-client launch from a parent with HOME, CLAUDE_CONFIG_DIR, CODEX_HOME and GIT_DIR set to sentinel paths shows none of the sentinels in the child's environment (test).
- [ ] C2. nvim/test/client.ts builds its launch environment through the shared fixtureEnvironment helper after overlays, and the existing Neovim suites pass unchanged (test).
