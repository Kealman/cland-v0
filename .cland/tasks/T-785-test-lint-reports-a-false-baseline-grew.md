---
id: T-785
kind: task
title: test:lint reports a false "baseline grew" when the local origin/dev ref is stale or missing
state: open
status: review
size: XS
criterion_seq: 1
labels:
  - v0.1.4
  - verification
  - hub
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-529
branch: t/T-785-test-lint-reports-a-false-baseline-grew
created: 2026-10-18T07:09:21.826Z
updated: 2026-10-18T18:37:57.909Z
---

## Summary

Right after T-684 merged (2026-10-18 07:08Z), `npm run test:lint` in the root exited 1 with "baseline grew: hub/test/tracker.test.ts [wall-clock-assertion]". The root's `origin/dev` ref was missing, because `cland push` doesn't update it, so testLintPolicy took its merge base from an older commit without the frozen baseline and derived lower counts. After `git fetch origin` it passed. Task worktrees with a stale origin/dev hit the same false refusal locally. A verify dry-run on dev was admitted.

## What to build

testLintPolicy resolves its base without depending on a fresh local `origin/dev`. Either use the hub's known dev tip or fall back to the newest commit that contains the baseline. A missing or stale ref then can't turn an unchanged frozen count into "grew". Genuine growth must still be refused.

## Acceptance criteria

- [x] C1. A T2 test with the baseline committed on dev and a stale or missing origin/dev ref gets no "baseline grew" for unchanged counts, still refuses a real increase, and fails before the fix.
  - done: impl-785 · 2026-10-18T18:36:55.069Z

## Comments

### impl-785 · 2026-10-18T18:36:37.553Z

TDD C1: isolated in-process Git-object T2 fixture failed before the fix with the exact false baseline grew on unchanged stale-ref counts (0.167 s file). After preferring shared refs/heads/dev, stale/missing remote refs preserve unchanged disk and committed counts and reject baseline increases; remote-only clone fallback also passes. New T2 file passed in 0.264 s; existing T1 lint file passed 30 tests in 0.957 s; existing first-freeze history regression passed in 2.019 s (filtered file). Host typecheck passed. Host lint result pending.

### impl-785 · 2026-10-18T18:36:55.528Z

Host npm run test:lint also passed (exit 0). C1 implemented with red/green evidence; source review is next, then the exact-head mode-free droplet run.

### rev-30 · 2026-10-18T18:37:57.909Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-785-source
commit: 9deac1c3b7ecfe854663aa36be2e055f53b3b1b0
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at 9deac1c3. Default discovery uses shared refs/heads/dev before remote fallback, retaining explicit-base behavior and unchanged first-freeze/growth checks. T2 isolated regression covers stale/missing refs, disk/committed unchanged counts, exact growth refusals and remote-only fallback. A-5514 records both axes and reported host red/green/static checks. C1 awaits accepted exact-head runtime; no per-item QA.
