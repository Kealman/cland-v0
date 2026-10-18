---
id: T-714
kind: task
title: Stage, epic and release runs execute T1 to T4 on both platforms, with the load gate for tests new since the last stage
state: open
status: in progress
size: S
labels:
  - v0.1.4
  - verification
  - hub
assignee: null
parent: E-678
blocked_by:
  - T-679
  - T-681
topic: topic-490
branch: t/T-714-stage-epic-and-release-runs-execute-t1
created: 2026-10-16T19:59:43.897Z
updated: 2026-10-18T09:27:01.160Z
---

## Summary

Decision 2 keeps two-platform T3 and T4 at stage, epic and release. T4 is where perf cases, the full QA case set, the 4-seed differential oracle, harness self-tests and long lifecycle waits live after E-677 (memo §5.1 T4 row). Until this ticket, T4 files run wherever T3 runs; after it, they run at occasions and in the nightly soak (T-715) only.

## What to build

- **Occasion runs** (`--occasion stage|epic|release`, Linux sharded and the macOS local run as today) plan T1, T2, T3 and T4 and set `CLAND_TEST_SOAK=1`. `balanceCloseShards` places T4 files like the others.
- **The load gate** at occasions repeats each identity that is new since the last green stage run five times.
- **Other runs.** The Coordinator's `all` and integrated `dev` runs plan T1 to T3. Task runs follow T-713.

## Acceptance criteria

- [ ] C1. An occasion run plans every T1–T4 file with `CLAND_TEST_SOAK=1`, and an `all` run plans T1–T3 without it, proved by planning tests.
- [ ] C2. The load gate at an occasion repeats the identities new since the last green stage run five times, and none older, proved by a load-gate test.
- [ ] C3. A two-shard stage run's result shows the T4 tier line per shard, proved by a close-run test on the in-process provider.

## Blocked by

T-679 (tiers), T-681 (tier lines).

## Comments

### impl-714 · 2026-10-18T09:27:01.160Z

Implemented occasion T1–T4 planning and soak worker environment, stage-receipt identity load gating, shard tier reporting and tier-aware cache/stage-cover admission. T1 red/green tests prove planner and identity policy; T2 red/green test proves T4 lines per shard. Added a T1 large-selection round trip because the current identity list is ~297 KB, beyond an inline environment value. Typecheck and test lint pass; sequential touched-file checks in progress before dev merge/source review.
