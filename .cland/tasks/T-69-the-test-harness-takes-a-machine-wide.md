---
id: T-69
kind: task
title: The test harness takes a machine-wide lock before spawning daemons, runs the hub suite at bounded concurrency, and kills its daemons on failure
state: open
labels:
  - ready-for-agent
  - tests
assignee: impl-69
parent: T-19
blocked_by: []
topic: topic-20
branch: t/T-69-suite-lock-and-daemon-cleanup
created: 2026-10-09T10:44:01.109Z
updated: 2026-10-09T12:15:26.914Z
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

### impl-69 · 2026-10-09T11:40:02.613Z

Claimed. I am using the implementation/TDD workflow at the spec's runner CLI/process-table seam: concurrent runners, stale lock takeover, and an intentionally failing child test with a real hub and hook bridge. The shared temp-project helper will also clean processes before removing each project; the suite runner will isolate all temporary files and sweep remaining descendants on exit/signals.

### impl-69 · 2026-10-09T11:48:41.434Z

Milestone: package suites now share /tmp/cland-suite.lock, holder pid/start metadata, dead-holder recovery, concurrency 4, and a short isolated /tmp run root. Shared fixture ownership cleans cwd/argument matches plus descendants/process groups before deleting projects; SIGINT/SIGTERM get separate cleanup because Node after hooks do not run on abort. Typecheck passes. The initial long-TMPDIR baseline was invalid (Unix socket discovery failed); the corrected baseline is queued behind QA's manual lock. Targeted serialization and stale-holder tests pass.

### impl-69 · 2026-10-09T11:52:38.147Z

Corrected default-concurrency baseline completed: 333 tests, 332 passed; one pre-existing timing-sensitive freshness assertion failed (`current` true versus undefined). Node test duration 169.46s; wrapper total 354.75s included waiting behind QA, and sampled machine peak load was 30.69. The new runner now reports lock wait separately and resets duration/load sampling when it acquires the lock. Concurrency-4 full validation is starting. Targeted runner checks pass for serialization, stale takeover, real daemon/fake harness failure, SIGINT and SIGTERM; two additional checks cover deliberate passing-test orphans and interruption while waiting.

### impl-69 · 2026-10-09T12:00:00.916Z

Concurrency-4 full validation passed: hub 335/335 (196.87s), Neovim 90/90 (38.77s), total suite 236.00s plus separate 86.93s lock wait, sampled peak machine load 15.22. Default concurrency was faster (169.46s hub) but exceeded the ~20 load budget (30.69), so retaining bound 4. Internal review found an anonymous reaper guard could survive its owner; now using the existing atomic PID/start-time hub lock for the reaper and retrying transient breaker contention. Lock tests now establish holders through real runners; specialized fake PID teardown runs before directory ownership removes their metadata. Final focused checks and review follow.

### impl-69 · 2026-10-09T12:08:37.526Z

Implementation ready for external review/QA at commits 74d0d9c and 4583f99. Final typecheck passes; full suite passes 336 hub + 90 Neovim tests (426 total), hub210.91s, total249.08s excluding4.54s lock wait, peakload16.82. Prior bound4 peak15.22; default hub169.46s/invocation peak30.69 with one timing-sensitive freshness failure, so retaining4. Eight focused runner regressions pass, and two actual concurrent npm test entry-point probes serialized and exited0. Final process/run-directory check clean; working tree clean. README and both default/project Implementer/QA clauses carry the rule. Internal Standards/Spec reviews clear. Full evidence and caveats: A-22 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22-t-69-final-implementation-and-validation.md; full log A-20, baseline A-16. No push/merge/closure.

### impl-69 · 2026-10-09T12:15:02.832Z

QA reproduced an omitted crash-recovery path on 4583f99: SIGKILL of the lock holder lets the successor start while the original runner/workers/root survive. I am adding a red-capable public runner regression that checks worker/root disappearance before successor startup, and will persist run ownership so takeover reaps those leftovers while still holding the stale lock.

### rev-65 · 2026-10-09T12:15:26.914Z

verdict: review
result: not clear
by: rev-65 [reviewer]
run: rev-65-69-1
commit: 4583f994e36fe0d55c4fa3d3f4a10bd6a898a528

Reviewed 42f0d31…4583f99 read-only, including task criteria, evidence A-22, docs and regressions.

High — hub/test/run-suite.ts:85; hub/test/process-cleanup.ts:53: cleanup receives the child PID after exit without its original start identity, so a reused PID passes the two cleanup-time snapshots and its unrelated group receives SIGKILL.

Medium — hub/test/process-cleanup.ts:54: substring matching selects an unrelated sibling path such as /tmp/cland-suite-ABC123-other/config for owned root /tmp/cland-suite-ABC123.

Medium — hub/test/process-cleanup.ts:69: selecting one owned PID permits killing every process in its group, without verifying other members are owned; unrelated peers receive SIGKILL.

Medium — hub/test/run-suite.ts:12: a dead suite holder whose PID is reused remains “alive” indefinitely, because the main lock never checks original process-start identity.

Medium — hub/test/run-suite.ts:25: death after mkdir but before holder.json leaves an automatic empty lock treated as a permanent manual lock, preventing crash recovery.

Standards: 1 medium interface finding (bare PID ownership), overlapping the first Spec finding; no documented hard standard breach. Spec: 5 distinct findings, worst high. Safe in-memory probes against the actual cleanup module confirmed all three unsafe signal selections with ps/lsof/process.kill stubbed; no real signals or files were changed and no suite was run. Recorded A-22 suite/load evidence supports normal execution but does not cover these cases.

Full review: A-27, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-27-t-69-review-cleanup-ownership-and-lock-recovery-gaps.md
