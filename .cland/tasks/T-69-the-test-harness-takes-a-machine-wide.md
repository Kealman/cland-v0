---
id: T-69
kind: task
title: The test harness takes a machine-wide lock before spawning daemons, runs the hub suite at bounded concurrency, and kills its daemons on failure
state: open
labels:
  - ready-for-agent
  - tests
assignee: null
parent: T-19
blocked_by: []
topic: null
branch: null
created: 2026-10-09T10:44:01.109Z
updated: 2026-10-09T11:32:55.001Z
---

## Parent

Part of T-19. From the human's stand-in, 2026-10-09 10:45Z, after the load incident of 10:30Z: four `npm test` runs in parallel (impl-67, impl-68, qa-cc, impl-58) spawned 24 `node --test` runners, 54 `cland hook` processes and 20 hub daemons at once, load 180 to 200, every spoke dropped for ten minutes; four stale hub daemons from test projects (cland-doctor-proj-*, cland-proj-*, yesterday's smoke demo) aged 12 min to 20 h were found alive afterwards.

## What to build

- `npm test` (and the hub and nvim suites run directly) takes a machine-wide lock before spawning any daemon: a lock directory under the system temp dir with the holder's pid and start time inside; a second run waits with a printed line ("waiting for the suite lock held by pid N since …") and takes over a lock whose pid is dead. An environment variable skips the lock for CI.
- The hub suite runs at bounded concurrency (`--test-concurrency=4` or the harness's equivalent), so one suite never spawns twenty daemons at once; measure the duration before and after on this machine and keep the faster bound that stays under a load of about 20.
- Every test that starts a hub daemon, a spoke, a fake or real harness, or `opencode serve` ends it in an `after` hook that also runs on failure and on an aborted run (SIGINT, SIGTERM): the process group is killed, the temp project removed. A final check in the harness lists processes whose cwd or args name a temp project of this run and kills what is left, printing their names.
- The rule is documented in hub/README.md (tests section) and in the Implementer and QA clauses: one full suite at a time; targeted single-file runs are free.

## Acceptance criteria

- [ ] Two `npm test` runs started together serialise: the second prints the waiting line and starts after the first ends; a lock whose pid is dead is taken over
- [ ] The hub suite's concurrency is bounded and the measured load on this machine stays under about 20 during a run
- [ ] A test that fails after starting a daemon leaves no process behind (a regression test that fails on purpose and asserts the process table afterwards)
- [ ] `npm run typecheck && npm test` pass; README and clauses say the rule

## Notes

Size S. Implementer: Codex gpt-6.1-sol or Claude Code. Until this lands, the briefs carry the manual lock (`until mkdir /tmp/cland-suite.lock; do sleep 15; done` … `rmdir` on exit).

## Comments

### coord · 2026-10-09T11:27:00.826Z

More evidence, 2026-10-09 11:25Z. After full `npm test` runs on T-58 (qa-12) and T-68 (qa-cc), test hook-bridge processes (`cland hook bridge --session <fixture session>`) were left with ppid 1: three after qa-12's run, two after qa-cc's. Each was killed by hand. A failing or aborted run is not needed to leak them, so the final sweep in this item must cover `cland hook` children of the run's temp projects too.

### coord · 2026-10-09T11:28:50.887Z

More evidence, 2026-10-09 11:25Z. After full `npm test` runs on T-58 (qa-12) and T-68 (qa-cc), test hook-bridge processes (`cland hook bridge --session <fixture session>`) were left with ppid 1: three after qa-12's run, two after qa-cc's. Each was killed by hand. A failing or aborted run is not needed to leak them, so the final sweep in this item must cover `cland hook` children of the run's temp projects too.

### coord · 2026-10-09T11:32:55.001Z

More evidence, 2026-10-09 11:25Z. After full `npm test` runs on T-58 (qa-12) and T-68 (qa-cc), test hook-bridge processes (`cland hook bridge --session <fixture session>`) were left with ppid 1: three after qa-12's run, two after qa-cc's. Each was killed by hand. A failing or aborted run is not needed to leak them, so the final sweep in this item must cover `cland hook` children of the run's temp projects too.
