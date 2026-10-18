---
id: T-747
kind: task
title: Importing hub/test/harness.ts registers ps and socket work at module load
state: open
status: in progress
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
topic: topic-478
branch: t/T-747-importing-hub-test-harness-ts-registers
created: 2026-10-17T17:24:17.537Z
updated: 2026-10-18T04:49:52.092Z
---

## Summary

T-744's import-graph lint (2026-10-17) found that a test importing only a pure helper from `hub/test/harness.ts` still runs resource work at module load. harness.ts side-effect-imports `account-fixture-env.ts`, which calls `ownDirectory(undefined, root)` and registers a teardown that can spawn `ps`. `cover-quiet.ts` calls `assertTestAdmission`, which depends on the socket admission environment. Every importer is therefore charged with process or socket use, and pure tests can't qualify for T1.

## What to build

Make harness.ts import side-effect free: account-fixture setup, the ownDirectory teardown and the cover-quiet admission check run only when a fixture that needs them is created, not at import. Every existing protection (fixture isolation, cover-quiet refusal) keeps working for the fixtures that use it.

## Acceptance criteria

- [ ] C1. Importing only a pure helper from harness.ts runs no ps, socket or child-process work, proved by a T1 census, and T-744's lint no longer charges those importers. The review request lists the files whose qualification changes.
- [ ] C2. The cover-quiet and fixture-isolation tests pass unchanged, 5/5 on the Mac and in the task's droplet verify.

## Comments

### impl-747 · 2026-10-18T04:47:52.613Z

Implemented explicit cached account-fixture admission/setup instead of global harness-import hooks. C2 Coordinator decision a205716f: child target now requests tempProject before its body, while every refusal/no-directory assertion is unchanged; account-fixture-isolation.test.ts unchanged. T1 census proves pure helper import preserves account settings and starts no fixtures; enforced resource tripwire records zero native resources. Before/after lint for the same new census: reachable T3 (6 resources) → T1 (0). Existing manifest files retain their conservative reachable qualification, since they also select resource-using helpers. Local repetitions so far: cover-quiet, account-fixture-isolation, project-hub and test-admission each 5/5, load below 6; final census 5/5 enforcement receipt being captured. Source review precedes task droplet verify; restart hold is lifted.

### impl-747 · 2026-10-18T04:49:52.092Z

Caught and fixed a Node hook-scope issue before review: an after() registered lazily inside the first fixture caller is test-scoped, so cached account directories disappeared before later tests. Added a T2 successive-subtest regression (red before fix, green after). The worker now registers only a no-op cleanup callback at module load; directory ownership/admission and actual teardown remain conditional on explicit fixture creation. The T1 census and import-graph lint still show zero import-time resources. Repeating all focused files on the final source.
