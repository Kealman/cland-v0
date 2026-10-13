---
id: T-145
kind: task
title: tracker-levels close/reopen race test depends on a 300 ms pause and fails
  under load
state: closed
status: done
labels:
  - ready-for-agent
assignee: null
parent: E-19
blocked_by: []
topic: topic-64
branch: t/T-145-tracker-levels-close-reopen-race-test
created: 2026-10-10T02:55:04.878Z
updated: 2026-10-10T07:03:42.972Z
---

## Parent

T-19 (follow-ups). Found during T-123's second root run (peak load 10.1).

## What to build

`hub/test/tracker-levels.test.ts`, "close rechecks a child reopened during the parent temporary write before rename", depends on wall-clock timing. It pauses the parent's temporary write for 300 ms (`CLAND_TEST_TASK_WRITE_PAUSE_MS`), polls for the temp file, then reopens the child by hand. Under load the poll can see the temp file late, so the reopen lands after the final check. That is the accepted check-to-rename window, so the close succeeds and the test fails (line 78: expected false, got true). It passed in targeted runs and in other full runs.

Make it deterministic: replace the timed pause with a test hook that holds the write until the test releases it, after the child has been reopened. Sweep the other tests that use `CLAND_TEST_TASK_WRITE_PAUSE_MS` for the same pattern.

## Acceptance criteria

- [ ] The test holds the parent write on a release signal, not a timer, and passes 20 consecutive runs under `stress` or parallel load.
- [ ] Other users of the timed pause are converted or shown to be timing-independent.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size S. Test-only; tech-debt.

## Comments

### coord · 2026-10-10T03:22:55.199Z

Second instance of the same class, under load (peak 13.8, T-133 baseline run on 952b8d9): hub/test/tracker-ready.test.ts:363, 'hold answered before rename pause', failed with 'verifier changed while taking its hold; retry'. It passed in T-121's runs. Include it in the conversion from timed pauses to release-signal hooks.

### impl-145 · 2026-10-10T06:29:42.944Z

Sweep found timed pauses in tracker-levels (queue, reopen, reparent), tracker (same-item conflict), subscriptions (subscribe/unsubscribe), and tracker-ready (crash before queued cleanup). Converting all to a one-shot file release gate after the temporary write. The separate tracker-ready rename test also needs to wait for the fake launched reviewer's first role-clause response before taking its hold, so identity adoption cannot race it.

### impl-145 · 2026-10-10T06:33:50.174Z

Implementation committed as d35e6a3acbf6f3c4574bf09dc673c19a1f7450e2. All CLAND_TEST_TASK_WRITE_PAUSE_MS users removed; new one-shot gate acknowledges the temporary write and holds until release. Queued close uses a following hub.status response to confirm dispatch before release. Verifier tests wait for spoke presence/identity adoption (the fake Reviewer's role-clause pong is refused by existing send permissions, so the presence event is the correct seam). Typecheck and initial targeted tests pass; parallel repeat validation and two-axis code review are running.

### impl-145 · 2026-10-10T06:45:15.661Z

Final head a6327068e097cfd3b7acd6dc03c75722bf42dc33 passed 20/20 complete tracker-levels file invocations (14 tests each, 280 passes) with four parallel workers and no suite lock; peak sampled 1-minute load 18.27. The verifier rename/crash race sequence also passed 20/20 invocations. Root typecheck passed. Starting required root npm test through its machine-wide suite-lock script.

### impl-145 · 2026-10-10T07:00:03.909Z

Completed and pushed a6327068e097cfd3b7acd6dc03c75722bf42dc33 to origin/t/T-145-tracker-levels-close-reopen-race-test; clean worktree. Root npm run typecheck passed. Full root npm test passed 871 hub + 201 Neovim tests, zero failures/skips; duration 799.49s, suite-lock wait 52.53s, peak 1m load 11.88 (full log A-485). Final-head tracker-levels parallel sequence passed 20/20 complete files, 280 tests, four workers without suite lock; peak sampled 1m load 18.27 (A-481). Verifier rename/crash race sequence passed 20/20 invocations under parallel load. Two-axis code review, including watcher follow-up, found 0 Standards and 0 Spec findings (A-479). All timed-write users converted; only production change is the test-hook replacement. Ready for Coordinator review.

### rev-8 · 2026-10-10T07:03:32.690Z

verdict: review
result: clear
by: rev-8 [reviewer]
run: rev-8-20261010-145-1
commit: a6327068e097cfd3b7acd6dc03c75722bf42dc33

No high, medium, or low findings. Standards and Spec reviews are both clear. The explicit one-shot gate is inert when unset; converted races await the competing state before release, and verifier/watcher waits retain their exact assertions. Read-only review; no suites run. Final-head stress and full-suite evidence checked in A-481 and A-485. Review artifact A-486: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-486-t-145-review-explicit-tracker-write-gates-clear.md.

### coord · 2026-10-10T07:03:42.972Z

Merged 34bd453057db3c4ab5d13c57685ba1fca0d0d2aa onto dev.
