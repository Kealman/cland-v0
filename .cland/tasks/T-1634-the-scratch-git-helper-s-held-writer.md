---
id: T-1634
kind: task
title: The scratch Git helper's held-writer cancellation test fails on a slow droplet disk
state: open
status: in progress
size: XS
labels:
  - flaky
assignee: null
parent: E-1881
blocked_by:
  - T-1889
topic: topic-1623
branch: t/T-1634-the-scratch-git-helper-s-held-writer
created: 2026-11-02T14:37:15.028Z
updated: 2026-11-18T11:27:58.494Z
---

## Summary

`hub/test/git-maintenance.test.ts:38` ("scratch Git helper drains a held descendant writer before rejecting cancellation") failed in merge batch 60682c23 (run 93d2bcfe, log A-15873) with `writer 54403 is gone before the command rejects: true !== false`. The only member, T-1619, does not touch git maintenance: its diff is the droplet reaper, its test and docs. The droplet's disk was very slow (SQLite 1463 ms, fsync 67.7 ms; the usual is 11–35 ms and 3–8 ms). The test passed in periodic dev T3 at 4e8aa7ee, and 5/5 alone on macOS at 14:37Z.

Likely cause: the helper's rejection resolves before the descendant writer has been reaped. On a slow machine the writer stays visible to `pidAlive` (a live process or an unreaped zombie) for a moment after `rejected` settles.

## What to build

Make the drain contract deterministic. Either the helper awaits the writer's confirmed exit before it rejects, or the test waits on that exit signal, not on wall time. Don't retry and don't sleep.

## Acceptance criteria

- [ ] C1. The test passes 20/20 under an injected slow-reap seam that delays the writer's exit after SIGTERM by more than the current window.
- [ ] C2. The helper never rejects a cancellation while a held writer it started is still alive (test).

## Comments

### impl-1634 · 2026-11-18T11:21:11.345Z

Consumer inventory (rule 41): fixtureCommand calls are git-maintenance.test.ts cancellation/recovery/repository operations and git-maintenance-cli.test.ts setup Git calls; fixtureCommandOutput is used by git-maintenance.test.ts stale gc.log checks; FixtureCommandError nativeFailure/code/stderr is read by its cat-file absence classifier. One guide: docs/agents/tests/hub-test-git-maintenance.test.ts.md. Searches covered helper filename, exports and raw names across hub, nvim, docs, qa and shipped skills; no other callers. Preserve existing string/error fields and add writer receipts. Both consumer test files remain T3; no T1 proof is claimed.

### impl-1634 · 2026-11-18T11:27:58.494Z

Checkpoint: 900 ms injected slow-SIGTERM case passed 20/20 on local macOS arm64 Node v24.21.0 (A-21185); initial absent-receipt red is A-21184. Full git-maintenance.test.ts 11/11 and CLI caller 1/1 passed before the added 5100 ms case. Coordinator requires 5100 ms too and queued a new native slot after the macOS stage cover. That case is written but unexecuted; no C1/C2 done marks or review requested. Native slot released. Current full npm run test:lint exits 0 with 0 refusals (130 report-only findings; known install-baseline T-1484 and build-tier notices); full npm run typecheck exits 0 after correcting test narrowing. First origin/dev fetch/merge was already up to date. A-21187 records the next red-to-green step: preserve cleanup failure as secondary diagnostic but join writer exit before rejecting. No verify submitted; no browser/cloud calls.
