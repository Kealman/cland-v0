---
id: T-1525
kind: task
title: cover-quiet fixture children inherit the crew session's identity and reach the live hub
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: R-1523
blocked_by: []
topic: null
branch: null
created: 2026-10-31T14:50:34.890Z
updated: 2026-10-31T14:50:34.890Z
---

## Summary

When `hub/test/cover-quiet.test.ts` runs from a crew session's shell, its nested fixture children inherit the session identity: `CLAND_LAUNCH_TOKEN`, `CLAND_ROLE`, `CLAND_SESSION_ID` and `CLAND_SESSION_NAME`. Carrying it, they reach the live hub. The live hub refuses them ("session … credential is missing or invalid"), and the test fails. That breaks rule 15. Droplet runs carry no session variables, so the defect stays hidden in verify.

## Evidence

impl-1500, 2026-10-31 14:47–14:50Z (topic-1272):
- From the session shell, the file failed in nested test-admission and remote fixture children.
- With exactly those four names removed, all 17 cases passed on darwin arm64, Node 24.21.0.
- No hub state changed: the live hub refused the nested admission.
- The spawn that keeps the identity is `target()` at cover-quiet.test.ts:46: `runnerFixtureEnvironment(cwd, childEnv)`, where `childEnv` starts from `process.env` (line 40). `runnerFixtureEnvironment` deliberately preserves the session and admission controls.

## Acceptance criteria

- [ ] C1. cover-quiet's children are built through the shared fixture environment builder with the inherited `CLAND_*` session identity removed. The file passes from a shell that carries session variables, and the test never contacts the live hub. A positive control first proves that the old environment reached a sentinel hub.
- [ ] C2. Every other test spawn that uses `runnerFixtureEnvironment` starting from `process.env` is listed in the item. Each one is fixed, or recorded as needing the session controls, with the reason.
