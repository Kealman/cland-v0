---
id: T-392
kind: task
title: "Inspection diet: fixture hubs skip the start-up orphan sweep unless the test opts in, teardown signals recorded identities without machine-wide scans, and processStarted calls coalesce"
state: open
status: planned
size: M
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: E-386
blocked_by:
  - T-389
topic: null
branch: null
created: 2026-10-14T12:28:11.104Z
updated: 2026-10-14T23:53:18.278Z
---

## Summary

Each spawned fixture hub drags about 31 process-inspection spawns with it: the daemon's start-up orphan sweep, the teardown probes and the pid-identity probes. That makes 17,631 `ps`, 9,560 `lsof` and 2,012 `pgrep` spawns per run (A-2021), about 38% of file time in the research's regression. This ticket stops fixture hubs sweeping unless asked, makes test teardown signal only recorded identities verified by a targeted `ps -p`, and coalesces `processStarted` calls. The target is under 12,000 inspection spawns per run, saving about 500 s of test-time, about 2 minutes of a full run.

## Parent

"Test speed: quick wins" (R-228), tracer bullet 4; research #5 (`docs/research/test-speed.md` §3.5; §2 point 2; §1 "Fixed setup cost per spawned hub").

## What to build

**No sweep in fixture hubs by default.**

- In `hub/src/hub/daemon.ts` (the `sweep = … sweepOrphans(root, log, 'harness', …)` block after `serving`, about line 300), the daemon skips the start-up sweep when `CLAND_TEST_SKIP_ORPHAN_SWEEP=1` is in its environment. It logs `orphan-sweep-skipped` instead of `orphan-sweep-started`, so tests that read the journal see the difference.
- This is an env knob in the existing `CLAND_TEST_*` pattern (`CLAND_TEST_SKIP_LOCK`, `CLAND_TEST_ORPHAN_ROOT`), not a new seam.
- The periodic and on-demand sweeps (`doctor --fix`, `cland hub sweep` if present) are unaffected.
- `startDaemon` in `hub/test/harness.ts` (line 318) sets the variable unless the caller passes `{ sweep: true }`, or passes its own `CLAND_TEST_SKIP_ORPHAN_SWEEP`.
- Opt in: `orphan-servers.test.ts`, `orphan-sweep-lock.test.ts`, `daemon.test.ts`, the `doctor*.test.ts` files, `system-processes.test.ts`, `termination-ownership.test.ts`, and every test that asserts an `orphan-sweep-*` event or a swept process (grep `orphan-sweep`, `sweepOrphans`, `orphan` in `hub/test` and `nvim/test`). Post the list.

**Teardown from the ownership table** (`hub/test/process-cleanup.ts`).

- When a test's context has recorded seed identities (`ownProcess`, `rememberProcess`, `recordedProcess`: pid with start time and group), `cleanupProcesses` verifies them and their recorded descendants with one targeted `ps -p` and a `pgrep -g` per owned group. It signals only verified identities. It does not run the machine-wide `ps eww -ax` or `lsof -d cwd` scans.
- The machine-wide path stays for root-directory cleanup with no seeds, for the runner's phase sweep and for any seed whose identity no longer verifies, which falls back to today's full proof.
- The ownership rules of `termination-owner.ts` and T-279 hold unchanged: nothing is signalled without a start-time match.

**Coalesced `processStarted`** (`hub/src/hub/lock.ts` `processStartedAsync`, used by `adapters/processes.ts`, `adapters/sessions.ts`, `adapters/claude-code.ts`, `system-processes.ts`, `suite-lock.ts`, `executor/local.ts`).

- Concurrent calls for the same pid within one tick share one in-flight `ps`, and concurrent calls for several pids share one `ps -p a,b,c`.
- No result outlives its in-flight call, so a later call always reads the process table again and pid reuse stays detected. `pid-identity.test.ts` stays as it is.

**The census.** Run `node hub/test/spawn-census.mjs run` before and after at nearby heads, only when the verify queue has no holder or waiter (the load rule), and post `compare` output on the item. The census misses the `executor-*` files, which replace `NODE_OPTIONS`. Say so in the posted comparison.

## Acceptance criteria

- [ ] C1. A fixture hub started by `startDaemon` without `{ sweep: true }` logs `orphan-sweep-skipped` and spawns no sweep `ps`/`lsof`, and a production `cland hub start` without the variable still sweeps, both proven by tests.
- [ ] C2. Every test that asserts sweep behaviour opts in, the list is posted on the item, and those tests pass with their assertions unchanged.
- [ ] C3. Teardown with recorded seeds runs no machine-wide `ps eww -ax` or `lsof -d cwd`, signals only start-time-verified identities, and falls back to the full proof when a seed does not verify, proven by tests in `termination-ownership.test.ts` or a new file.
- [ ] C4. Concurrent `processStartedAsync` calls coalesce into one `ps` per tick, no result is reused after its call resolves, and `pid-identity.test.ts` passes unchanged.
- [ ] C5. Measured: a census compare at nearby heads shows `ps` + `lsof` + `pgrep` under 12,000 per run (29,203 in A-2021) and at most 13 per daemon start, posted on the item with the census caveat for `executor-*` files.
- [ ] C6. Measured: on an idle machine, the whole-file times of `default-subscriptions.test.ts` (22.3 s idle in the research) and `session-resume.test.ts` fall by at least 15% each (median of three), posted with the one-minute load.
- [ ] C7. The runner's phase sweep and the dedicated orphan tests still detect a process leaked by a test, proven by an existing or new test that leaks one on purpose.
- [ ] C8. `hub/README.md` (Tests and the orphan sweep) describes the fixture default, the opt-in and the teardown path.
