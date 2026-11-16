---
id: T-1913
kind: task
title: skills-tracker-support.ts uses a copied CLAND_* filter instead of the shared fixture environment builder
state: open
status: backlog
size: S
labels: []
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-11-16T14:43:54.752Z
updated: 2026-11-16T14:43:54.752Z
---

## Summary

`hub/test/skills-tracker-support.ts:17` filters `CLAND_*` names with its own copied filter, not `fixtureEnvironment`. It stops the session-identity leak that T-1904 fixed elsewhere, but its in-process task fixture still inherits HOME, `GIT_*` and provider variables from the caller, which rule 15 forbids. Found by impl-1904 during T-1904, 2026-11-16 (topic-1556).

## What to build

Replace the copied filter with the shared builder (`fixtureEnvironment`, plus `scratchGitEnvironment` where a scratch Git config is needed), applied after the final overlay. Do the rule 20 sweep for any other copied `CLAND_*` or credential filter in hub/test and nvim/test.

## Acceptance criteria

- [ ] C1. The skills tracker fixture runs with no inherited HOME, `GIT_*` or provider credential name when its caller has them set, shown with a synthetic outer environment (test, red before the fix).
- [ ] C2. No test helper keeps its own copy of the credential or `CLAND_*` filter; each one is migrated to the shared builder or named as unaffected (test).
