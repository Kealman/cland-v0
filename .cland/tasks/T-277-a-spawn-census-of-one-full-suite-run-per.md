---
id: T-277
kind: task
title: A spawn census of one full suite run, per test file and helper
state: closed
status: done
criterion_seq: 6
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: T-268
blocked_by: []
topic: topic-170
branch: t/T-277-a-spawn-census-of-one-full-suite-run-per
created: 2026-10-12T11:54:20.551Z
updated: 2026-10-12T15:48:15.485Z
---

## Summary

Measure where the suite's 77 thousand short-lived processes come from before cutting anything. A census tool, kept in the repository, records every `child_process` spawn of one full run with its command, its test file and the helper that made it, and the first census is published as the baseline for the epic.

## Parent

T-268: Suite spend and Linux portability. Realises T-267 (the suite's spend) under epic T-268, slice 1 of 6. Spec: docs/spec/v0.1.2.md §3.14 ("Before the executor").

## What to build

A census of the suite's spawns, made from inside the suite's own Node processes, and the first measurement with it.

- **The recorder.** A module preloaded into every Node process of the run through `NODE_OPTIONS` (`--import`) wraps the `child_process` spawn family (`spawn`, `spawnSync`, `exec`, `execSync`, `execFile`, `execFileSync`, `fork`) and records one line per spawn: the command's basename (`git`, `ps`, `lsof`, `node`, `sh`, …), its first argument (the git subcommand, for example), the test file it belongs to, the helper or source module that called it, and a timestamp. A test file is the file the `node --test` child runs; a Node process started below it (a daemon, a CLI, a fake harness) inherits its test file's attribution through its environment. The helper is the nearest caller frame in `hub/src`, `hub/test` or `nvim/test` outside the recorder (for example `hub/test/process-cleanup.ts processes`, `hub/src/system-processes.ts systemProcesses`, a test file's own `project()` fixture). Records go to files in the run's temporary root, append-only, so a crashed process loses at most its own last line. The recorder never records environments or full argument lists beyond the first argument (environments may hold secrets, as `hub/test/process-cleanup.ts` already warns).
- **The command.** One documented command runs the full suite (`npm test -- --all`, through the package runner, so it takes the machine-wide suite lock like any hand run and waits its turn behind the hub's admitted runs) with the preload set, then aggregates the records into a report: totals per command; per command the sources ranked by count, by test file and by helper; the runner's own wall time line (`suite duration`); and the list of test files whose subtree overrides or strips `NODE_OPTIONS` (today at least `hub/test/cli-imports.test.ts`, `hub/test/session-async-processes.test.ts`, `hub/test/claude-code-sessions.test.ts`), whose spawns are uncounted and so named as a known gap. It writes the report as Markdown plus the raw aggregate as JSON, for later comparisons.
- **The comparison.** The command can compare two aggregates (before and after) and print the change per command and for the top sources; the later slices use it.
- **The baseline.** Run the census once on the branch (which is `dev` plus the tool) and publish the report through `artifact.create` in this item's topic, with the run's wall time and the head it measured. That artifact is the "before the first cut" census of the epic's Definition of done.
- **Doc.** `hub/README.md`, in its Tests section, gains a short paragraph: what the census counts, how to run it, how to compare two runs, what it cannot see (spawns made by non-Node processes, such as git's own hooks and `git-receive-pack`, and subtrees that replace `NODE_OPTIONS`).

Demo, as the epic words it: the artifact names the ten largest sources of `git`, `ps` and Node spawns with their counts.

Out of scope: any cut (slices 2 and 3); the Linux process-accounting cross-check (made on the droplet in slice 6, where `acct` runs anyway); routing the census through `cland verify` (the hub's worker runs with the hub's environment, so it cannot carry the preload; the census is a package-runner run that queues on the suite lock, by the Coordinator's decision of 2026-10-12).

Constraints:
- Tests go through the hub's frame protocol first and the fake harnesses second; no new seams inside the hub. The recorder lives in test tooling, not in `hub/src`, and production code does not learn about it.
- The recorder adds no assertion-visible behaviour: with the preload set, the full suite passes exactly as without it.
- A census run is a full suite run and takes its place in the queue like one; never run two at once and never bypass the lock.
- Suites for review run through `cland verify`. Commit on the task branch, push to `origin` (the local territory); `dev` only through `cland merge`. English everywhere.
- A new test file is classified in the hub's shard manifest.

## Acceptance criteria

- [x] C1. One documented command runs the full suite with the recorder preloaded and writes a Markdown report and a JSON aggregate: totals per command, and per command the sources ranked by test file and by helper, with the run's wall time and head.
  - done: impl-277 · 2026-10-12T12:06:36.023Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-277-1 · 2026-10-12T14:30:08.334Z · commit 0f153a74e7f9f717f01c194030ea5ea3ad64c651
  - verified: rev-23 [reviewer] · run rev-2026-10-12-277-3 · 2026-10-12T15:19:54.173Z · commit 96981e46973a72e7fd18f1e5a429b5d760412d83
  - verified: rev-23 [reviewer] · run rev-2026-10-12-277-4 · 2026-10-12T15:47:18.354Z · commit 96981e46973a72e7fd18f1e5a429b5d760412d83
- [x] C2. The census artifact is published in this item's topic and names the ten largest sources of `git`, of `ps` and of Node spawns, with counts; its totals for `git` and `ps` are of the order the T-256 prototype measured (tens of thousands), or the report explains the difference. The completed census at 7cb55c6 serves as the baseline, with the two sandbox-exec cases of qa.test.ts named as uncounted (the recorder's denied log, fixed afterwards on this branch); a later recorder-only change does not require a new baseline run (the Coordinator's decision of 2026-10-12).
  - done: impl-277 · 2026-10-12T14:22:27.994Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-277-1 · 2026-10-12T14:30:08.334Z · commit 0f153a74e7f9f717f01c194030ea5ea3ad64c651
  - verified: rev-23 [reviewer] · run rev-2026-10-12-277-3 · 2026-10-12T15:19:54.174Z · commit 96981e46973a72e7fd18f1e5a429b5d760412d83
  - verified: rev-23 [reviewer] · run rev-2026-10-12-277-4 · 2026-10-12T15:47:18.354Z · commit 96981e46973a72e7fd18f1e5a429b5d760412d83
- [x] C3. The report names the test files whose subtrees replace or strip `NODE_OPTIONS` as uncounted, and records no environment values or arguments beyond the first.
  - done: impl-277 · 2026-10-12T12:06:36.294Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-277-1 · 2026-10-12T14:30:08.334Z · commit 0f153a74e7f9f717f01c194030ea5ea3ad64c651
  - verified: rev-23 [reviewer] · run rev-2026-10-12-277-3 · 2026-10-12T15:19:54.174Z · commit 96981e46973a72e7fd18f1e5a429b5d760412d83
  - verified: rev-23 [reviewer] · run rev-2026-10-12-277-4 · 2026-10-12T15:47:18.354Z · commit 96981e46973a72e7fd18f1e5a429b5d760412d83
- [x] C4. A test covers the recorder and the aggregation on a small fixture (a spawn from a test file, from a helper and from a Node grandchild, each attributed correctly) and the comparison of two aggregates.
  - done: impl-277 · 2026-10-12T12:06:36.500Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-277-1 · 2026-10-12T14:30:08.334Z · commit 0f153a74e7f9f717f01c194030ea5ea3ad64c651
  - verified: rev-23 [reviewer] · run rev-2026-10-12-277-3 · 2026-10-12T15:19:54.174Z · commit 96981e46973a72e7fd18f1e5a429b5d760412d83
  - verified: rev-23 [reviewer] · run rev-2026-10-12-277-4 · 2026-10-12T15:47:18.355Z · commit 96981e46973a72e7fd18f1e5a429b5d760412d83
- [x] C5. `hub/README.md` describes the census, how to run and compare it, and its blind spots.
  - done: impl-277 · 2026-10-12T12:06:36.695Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-277-1 · 2026-10-12T14:30:08.334Z · commit 0f153a74e7f9f717f01c194030ea5ea3ad64c651
  - verified: rev-23 [reviewer] · run rev-2026-10-12-277-3 · 2026-10-12T15:19:54.174Z · commit 96981e46973a72e7fd18f1e5a429b5d760412d83
  - verified: rev-23 [reviewer] · run rev-2026-10-12-277-4 · 2026-10-12T15:47:18.355Z · commit 96981e46973a72e7fd18f1e5a429b5d760412d83
- [x] C6. The suite is green on macOS through `cland verify`, and no test is weakened, skipped or retried.
  - done: impl-277 · 2026-10-12T15:46:43.783Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-277-4 · 2026-10-12T15:47:18.355Z · commit 96981e46973a72e7fd18f1e5a429b5d760412d83

## Comments

### impl-277 · 2026-10-12T12:00:49.449Z

Read T-277, T-268 and §3.14. Implementation: test-only --import recorder, per-process append-only logs, package-runner command plus report/compare, and a small subprocess fixture test classified machine. No production seam.

### impl-277 · 2026-10-12T12:06:36.880Z

Tooling is committed at 487550c. The fixture covers all spawn APIs, helper and grandchild attribution, privacy, incomplete final lines, comparison, exec/execFile promisify results/errors/child, and filesystem guards. Fixture and shard lint pass; all 64 adapter-native-boundary tests pass with the preload. The clean full baseline census is running.

### impl-277 · 2026-10-12T12:23:45.929Z

The first completed instrumented run was green (1,624 tests, 844.04s) but its census was incomplete: the harness strips CLAND_* from CLI/daemon environments. The recorder now uses TEST_* and aggregates observed NODE_OPTIONS/configuration gaps without environment values. Added a filtered-environment grandchild regression; fixture, shard lint and hub typecheck pass. Merged current origin/dev and pushed 1f5e1fd; the corrected full census is running.

### impl-277 · 2026-10-12T12:33:06.758Z

The corrected recorder restores descendant coverage, but the full census is blocked by the T-289 role configuration changes just merged from origin/dev: roles.test.ts:237 has an exact-object assertion missing permissions:null. A targeted run without any preload reproduces it. Reported to lead T-277; stopping the census since its failing hub phase cannot produce the required full baseline.

### coord · 2026-10-12T12:52:47.999Z

Two shared test-only commits made on this branch on the Coordinator's authority, each cherry-pickable unchanged: 811f0d2 (T-289's launch-policy assertions in roles.test.ts; already in T-283 and T-286) and 37062d3 (artifact-delete.test.ts waits for the old daemon's verified exit after hub.stop before restart; 30/30 with and without the preload, A-1514; `cland hub stop` from the CLI already waits for exit, so no hub-side gap). 37062d3 goes to another branch only if its run hits that race.

### impl-277 · 2026-10-12T13:21:16.156Z

The census passed both authorized test repairs, then failed codex-adapter.test.ts:396 because exit state was visible while 0 harness-exited lines were yet readable. The exact trace was retained through graceful interruption. Under the Coordinator's classification rule, clean dev e8a8b19 passed 20/20 isolated and 20/20 four-worker cases in each preload mode (80 total); neither mode reproduced. Hook-only median 44.27µs/call; real ps cost noisy. A-1522 contains all evidence. Requested direction from lead T-277 because classification is inconclusive and async logging conflicts with the required crash-loss bound.

### impl-277 · 2026-10-12T14:22:28.482Z

Published baseline A-1535 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1535-t-277-full-suite-spawn-census-baseline-at-7cb55c6. Full package run completed all phases (exit 1, two recorder-denied sandbox cases explicitly named); accepted by revised C2. Totals 86,457; git 32,341; ps 28,888; node 6,017; duration 905.46s, lock wait 778.15s. Fixed recorder denied-open fallback and named sandbox gaps at 0f153a7; fixture 2/2 and unchanged sandbox cases 2/2 pass with active preload. Fetched origin/dev and merge is already current; pushed final review head.

### rev-23 · 2026-10-12T14:30:08.334Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-12-277-1
commit: 0f153a74e7f9f717f01c194030ea5ea3ad64c651

No source/baseline findings. C1–C5 checked: seven spawn wrappers with inherited attribution/privacy and synchronous append durability; package-runner command/report/compare; fixture coverage; shard classification and README; separately authorized test repairs retain exact assertions. A-1535 satisfies revised C2: accepted complete 7cb55c6 census with explicitly qualified two sandbox gaps, 86,457 calls (git 32,341; ps 28,888; node 6,017), top-ten sources, wall/lock times and prototype comparison. Durable aggregate sums match all test/helper/source rankings; read-only Node 24 identical-aggregate comparison has zero deltas. C6 remains unverified pending macOS full cland verify 2c67624e at this exact head; no full-suite green claimed. Evidence A-1536: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1536-t-277-source-and-baseline-review-clear-at-0f153a7.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### impl-277 · 2026-10-12T15:13:40.445Z

C6 ordinary full verification 2c67624e at 0f153a74 failed 1/1630: unchanged nvim/test/plan.test.ts:191 timed out at :218 waiting for qa-schema-2. Case passes 20/20 native and 20/20 active-preload isolated runs. A-1540 preserves all targeted logs/results plus full failure trace; branch unchanged. Requested Lead classification/next action after hub outage.

### rev-23 · 2026-10-12T15:14:13.434Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-12-277-2
commit: 0f153a74e7f9f717f01c194030ea5ea3ad64c651

Medium: nvim/test/plan.test.ts:218 timed out after 5000 ms waiting for qa-schema-2 in full verify 2c67624e, so C6's green-suite requirement is unmet. The predicate also checks current plan view/id, valid buffer and completed visit acknowledgement; the captured failure does not identify which was missing. Plan test and renderer are unchanged from the fixed dev base; no recorder causality or new production defect established. Preserve assertions and diagnose the missing state/receipt. No test rerun by Reviewer.
Full run exit 1: 1629/1630 passed (hub free 30/30, hub machine 1307/1307, Neovim 292/293), zero skips/cancellations/todos. C1–C5 source/baseline review and revised C2 acceptance remain applicable. Evidence A-1543: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1543-t-277-c6-failed-at-0f153a7.md; full log A-1539. Publication was delayed by hub disconnection; reconnect confirmed same head and no superseding verdict.

Criteria: C6 failed (Ordinary macOS full cland verify failed nvim/test/plan.test.ts:218: five-second readiness wait for qa-schema-2 timed out.).

### rev-23 · 2026-10-12T15:19:54.174Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-12-277-3
commit: 96981e46973a72e7fd18f1e5a429b5d760412d83

No merge-delta finding. Census command, recorder, aggregator, fixture and qualified baseline remain unchanged; README and exact-one settle assertions retained. Additional codex-adapter flushLogs barrier is the already reviewed T-283 fix with assertions preserved. C1–C5 verified at this head; C6 remains unverified pending fresh full verify 409cd84b. Evidence A-1546: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1546-t-277-merge-delta-review-at-96981e4.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### impl-277 · 2026-10-12T15:46:44.504Z

C6 complete: fresh full cland verify 409cd84b at final merged/pushed head 96981e46973a72e7fd18f1e5a429b5d760412d83 passed 1640/1640 with no failures, skips or cancellations; suite duration 964.61s. Durable log A-1553. All implementation criteria done; source/merge delta review clear C1-C5, awaiting reviewer C6 verification/readiness gate. Baseline A-1535 remains the accepted before-cut measurement.

### rev-23 · 2026-10-12T15:47:18.355Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-12-277-4
commit: 96981e46973a72e7fd18f1e5a429b5d760412d83

No remaining high/medium findings. C1–C5 source/merge/qualified-baseline review retained (A-1536/A-1546/A-1535). C6 established by durable full cland verify 409cd84b at this exact head: typechecks pass; hub free 30/30, hub machine 1316/1316, Neovim 294/294; 1640/1640 total, exit 0, zero failures/skips/cancellations/todos. No tests weakened, skipped or retried by reviewed changes. Evidence A-1554: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1554-t-277-final-review-full-green-at-96981e4.md; suite A-1553.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### coord · 2026-10-12T15:47:44.570Z

Merged 8e5ec1e30217a0d45ecfb5cbdbce52c227c0e01a onto dev.
