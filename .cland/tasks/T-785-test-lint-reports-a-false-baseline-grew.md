---
id: T-785
kind: task
title: test:lint reports a false "baseline grew" when the local origin/dev ref is stale or missing
state: open
status: backlog
size: XS
labels:
  - v0.1.4
  - verification
  - hub
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: null
branch: null
created: 2026-10-18T07:09:21.826Z
updated: 2026-10-18T07:09:21.826Z
---

## Summary

Right after T-684 merged (2026-10-18 07:08Z), `npm run test:lint` in the root exited 1 with "baseline grew: hub/test/tracker.test.ts [wall-clock-assertion]". The root's `origin/dev` ref was missing, because `cland push` doesn't update it, so testLintPolicy took its merge base from an older commit without the frozen baseline and derived lower counts. After `git fetch origin` it passed. Task worktrees with a stale origin/dev hit the same false refusal locally. A verify dry-run on dev was admitted.

## What to build

testLintPolicy resolves its base without depending on a fresh local `origin/dev`. Either use the hub's known dev tip or fall back to the newest commit that contains the baseline. A missing or stale ref then can't turn an unchanged frozen count into "grew". Genuine growth must still be refused.

## Acceptance criteria

- [ ] C1. A T2 test with the baseline committed on dev and a stale or missing origin/dev ref gets no "baseline grew" for unchanged counts, still refuses a real increase, and fails before the fix.
