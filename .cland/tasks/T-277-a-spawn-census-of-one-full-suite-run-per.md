---
id: T-277
kind: task
title: A spawn census of one full suite run, per test file and helper
state: open
status: in progress
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
updated: 2026-10-12T12:52:47.999Z
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
- [ ] C2. The census artifact of the branch head is published in this item's topic and names the ten largest sources of `git`, of `ps` and of Node spawns, with counts; its totals for `git` and `ps` are of the order the T-256 prototype measured (tens of thousands), or the report explains the difference.
- [x] C3. The report names the test files whose subtrees replace or strip `NODE_OPTIONS` as uncounted, and records no environment values or arguments beyond the first.
  - done: impl-277 · 2026-10-12T12:06:36.294Z
- [x] C4. A test covers the recorder and the aggregation on a small fixture (a spawn from a test file, from a helper and from a Node grandchild, each attributed correctly) and the comparison of two aggregates.
  - done: impl-277 · 2026-10-12T12:06:36.500Z
- [x] C5. `hub/README.md` describes the census, how to run and compare it, and its blind spots.
  - done: impl-277 · 2026-10-12T12:06:36.695Z
- [ ] C6. The suite is green on macOS through `cland verify`, and no test is weakened, skipped or retried.

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
