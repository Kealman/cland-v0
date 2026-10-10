---
id: T-145
kind: task
title: tracker-levels close/reopen race test depends on a 300 ms pause and fails under load
state: open
status: backlog
labels:
  - tech-debt
  - ready-for-agent
assignee: null
parent: T-19
blocked_by: []
topic: null
branch: null
created: 2026-10-10T02:55:04.878Z
updated: 2026-10-10T03:22:55.199Z
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
