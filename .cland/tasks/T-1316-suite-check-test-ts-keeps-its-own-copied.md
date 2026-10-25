---
id: T-1316
kind: task
title: suite-check.test.ts keeps its own copied fixture environment instead of the shared builder
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-10-25T20:54:33.494Z
updated: 2026-10-25T20:54:33.494Z
---

## Summary

`hub/test/suite-check.test.ts` builds its own fixture environment: a copied PATH/HOME/XDG/Git/npm allowlist plus `withoutExecutorCredentials`, instead of the shared `fixtureEnvironment` builder rule 15 names. It is sealed today, but a second copy of the launcher policy drifts when the shared builder changes. Found aside by impl-543 during T-543 (2026-10-25); out of scope for that item.

## Acceptance criteria

- [ ] C1. suite-check.test.ts launches its fixtures through the shared `fixtureEnvironment` (plus `scratchGitEnvironment` where Git runs), with no local allowlist copy; the file passes unchanged in assertions on Linux and macOS, and the T0 child-environment guard covers it.
