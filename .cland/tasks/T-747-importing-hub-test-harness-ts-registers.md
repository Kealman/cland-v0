---
id: T-747
kind: task
title: Importing hub/test/harness.ts registers ps and socket work at module load
state: open
status: planned
size: S
labels:
  - v0.1.4
  - verification
  - hub
  - ready-for-agent
assignee: null
parent: E-676
blocked_by:
  - T-744
topic: null
branch: null
created: 2026-10-17T17:24:17.537Z
updated: 2026-10-17T21:48:42.926Z
---

## Summary

T-744's import-graph lint (2026-10-17) found that a test importing only a pure helper from `hub/test/harness.ts` still runs resource work at module load. harness.ts side-effect-imports `account-fixture-env.ts`, which calls `ownDirectory(undefined, root)` and registers a teardown that can spawn `ps`. `cover-quiet.ts` calls `assertTestAdmission`, which depends on the socket admission environment. Every importer is therefore charged with process or socket use, and pure tests can't qualify for T1.

## What to build

Make harness.ts import side-effect free: account-fixture setup, the ownDirectory teardown and the cover-quiet admission check run only when a fixture that needs them is created, not at import. Every existing protection (fixture isolation, cover-quiet refusal) keeps working for the fixtures that use it.

## Acceptance criteria

- [ ] C1. Importing only a pure helper from harness.ts runs no ps, socket or child-process work, proved by a T1 census, and T-744's lint no longer charges those importers. The review request lists the files whose qualification changes.
- [ ] C2. The cover-quiet and fixture-isolation tests pass unchanged, 5/5 on the Mac and in the task's droplet verify.
