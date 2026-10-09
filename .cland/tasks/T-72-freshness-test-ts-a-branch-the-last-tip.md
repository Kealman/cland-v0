---
id: T-72
kind: task
title: freshness.test.ts "a branch the last tip read did not hold" races the 2 s tip timer and fails under load
state: open
labels:
  - ready-for-agent
  - tests
assignee: impl-72
parent: T-20
blocked_by: []
topic: topic-22
branch: t/T-72-freshness-test-seam
created: 2026-10-09T11:55:08.930Z
updated: 2026-10-09T12:14:54.436Z
---

## Parent

Part of T-20; a test added by T-67 (main 8bf458c).

## What happened

hub/test/freshness.test.ts:164 ("a branch the last tip read did not hold …") expects `verdict.current` to be `undefined` right after a branch is created, and the run got `true`. It failed twice on 2026-10-09 under load:
- impl-69's default-concurrency baseline for T-69 at about 11:50Z: 332/333, the one failure this assertion.
- qa-12's full run on T-58 cbce35e at 11:54Z: 340/341, same test.
The test passes alone. The likely cause is that the test reads `current` on a wall-clock window, while the tip read, the 2 s timer or the 50 ms poke after a tracker change, can complete in between under load. It then legitimately reports `true`.

## What to build

- Make the test deterministic. Either stop the tip timer and the change poke in the test, through an injected scheduler or clock, and drive the reads by hand; or assert the sequence instead of a moment: unknown, or already settled, then true once a read that started after the question has finished.
- Look for other tests in freshness.test.ts and verdict-commit.test.ts that depend on the 2 s timer or fixed sleeps, and give them the same seam. rev-cc2 and rev-65 noted the 500 ms sleep in verdict-commit.test.ts:129.

## Acceptance criteria

- [ ] The test passes 50 times in a row under an artificial load: run it in a loop while a CPU hog runs, and record the command on the item
- [ ] No fixed sleeps remain in the freshness tests where a seam can drive the reads
- [ ] `npm run typecheck && npm test` pass

## Notes

Size XS. Implementer: Codex gpt-6.1-sol.

## Comments

### coord · 2026-10-09T12:01:44.705Z

A second test with the same cause, from impl-52's locked full run on T-52 at 12:01Z. hub/test/worktree-cli.test.ts:16 expected `verdictBase` to be `main` across CLI reads and got `null`. T-67 caches `verdictBase` from the async tip read, so a read before the first tip read lands reports null. The run had 2 failures out of 330: this one and freshness.test.ts:152, a sibling of :164 with the same pattern. Include worktree-cli.test.ts here: wait for the cache with the same seam rather than reading on a wall-clock window. Also check whether a null `verdictBase` right after a hub start matters to users; if it does, read the tips once synchronously at startup only, before the socket opens.

### impl-72 · 2026-10-09T12:08:18.403Z

Claimed. Inspecting the freshness cache scheduler, unit-test callbacks, and daemon/CLI polling seams. Will keep request paths cached and validate all three affected files 50 times under CPU load before one locked full suite.

### impl-72 · 2026-10-09T12:11:37.258Z

Added an injectable tip schedule (default keeps the same initial read, 2 s interval and 50 ms poke). Unit tests now drive reads and wait on tracker changes; selected CLI tests use real socket/CLI calls against an in-process daemon with the same manual schedule. Removed the 100/200/300 ms unit waits and both 500 ms verdict waits. Startup null verdictBase is shown as `verdict base -` by hub/src/cli/task.ts:149; no user action or control path depends on it, so retaining the existing unknown-until-read contract. Typecheck passed; targeted run in progress.

### impl-72 · 2026-10-09T12:14:54.436Z

Committed implementation 4d07511. Initial targeted validation: 16/16 passed; typecheck passed; code review: Standards 0 / Spec 0 (artifact A-24). Coordinator clarified CPU hogs require /tmp/cland-suite.lock too; stopped the unlocked loop and discarded its 3 iterations. Restarting 50 iterations plus the single full suite under one lock hold using `zsh /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-25-t-72-locked-validation-script.txt`. A-25 contains the exact command, four hogs, test-name filter, cleanup traps, and full-suite command.
