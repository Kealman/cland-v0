---
id: E-387
kind: epic
title: "Test speed: structural"
state: open
labels:
  - epic
  - v0.1.3
  - ready-for-agent
assignee: null
parent: R-294
blocked_by: []
topic: null
branch: null
created: 2026-10-14T12:28:09.615Z
updated: 2026-10-15T07:36:38.634Z
---

## Goal

A typical hub task verifies in about 3–5 minutes end to end, and a stage, epic or release full run finishes in about 8–10 minutes on two droplet shards (about 6 on four) instead of 15. "Test speed: quick wins" (v0.1.2) cuts the cost per test and makes selection select by package. Even after it, a typical hub change still runs the whole hub phase, about 7–9 minutes. The full suite stays above 8 minutes on the local Mac because 911 tests start a separate hub process each. This epic does the structural half of the research's recommendation:

- tests run against an in-process hub unless they test the hub's lifecycle;
- task runs select hub tests by function-level coverage;
- the close-of-stage, close-of-epic and release runs shard across droplets;
- the worker count is re-measured once the CPU per test has dropped (Q-384, `docs/research/test-speed.md` §3.1, §3.3(c), §3.4, §3.6, §3.8, §4).

## Contents

- **The in-process hub by default (§3.1 variant b, §3.8).** Tests run against a hub served inside the test process, through `serveProject`, over its real socket and WebSocket. Real spokes, the real `cland` CLI and the real fakes still connect to it. A spawned hub process (`startDaemon`, `cland hub start`) is kept only for lifecycle tests: start, stop, signals, crash, restart and watchdog. The research's heuristic counts 619 non-lifecycle spawned-daemon tests worth 1,580 s. Validation duplicates fall to the in-process hub with them. Adapter parsing edge cases move below the frame, keeping one frame test per tool and per refusal family.
- **Coverage-based selection for task runs (§3.3(c)).**
  - Each integrated `dev` full run records function-level V8 coverage and publishes a map from function ranges to test files as an artifact.
  - A task run selects its changed test files, the tests whose covered functions intersect the diff's hunks, and the smoke baselines.
  - It falls back to full on protocol, package, harness and fixture changes, and on paths the map does not know.
- **Sharded close runs (§3.6).** Integrated full runs at stage close, epic close and release shard the hub phase across droplets, balanced by `hub/test/durations.json`, and post one merged report. `suite.test.ts` (242 s) and `merge.test.ts` (182 s) split so that no file is a shard's floor.
- **The worker re-measurement (§3.4).** 4, 5 and 6 workers locally on a quiet machine, and 6 and 8 on a c-16, after the inspection diet and the in-process hub. Then the defaults are set.

Not in this epic: fixture snapshots of seeded `.cland` state (§3.2), running the Neovim phase alongside the hub phase locally (the research's question 7), a static import-graph selection (§3.3(b), measured gain zero), and the MicroVM backend (E-271's follow-up).

**Decisions of the human (2026-10-14 12:20Z), settled:**

- **(a) The in-process hub by default.** Tests use an in-process hub by default. A real hub process is kept only for lifecycle tests (start, stop, signals, crash, restart, watchdog). The shared-hub-per-file option (§3.1's shared daemon) is rejected.
- **(b) Sharding only close runs.** Droplet sharding of full runs applies only to stage, epic and release runs, within the $3/day cap. Ordinary integrated batch runs stay on one slot.

**Still open, asked of the human with a proposal (research question 2):** coverage selection's miss tolerance and replay bar. The proposal is that a regression a task's selected run misses and the next integrated batch run catches is acceptable, which D29 already implies, and that the replay bar is no misses on the last 40 merges' own test changes. The coverage ticket states this proposal and does not start until the answer is recorded on it.

Choices where the research is silent:

- **What counts as lifecycle.** A test is lifecycle when its assertion is about the hub process itself: its start, its stop, a signal to it, its crash or restart, its lock, discovery file, pid, orphan sweep or watchdog, or a CLI command's behaviour when the hub is down or unreachable. Everything else moves. The research's name-and-body heuristic (292 lifecycle tests, 1,199 s) is the starting list. The Implementer posts the final list per file, and the Reviewer checks it.
- **The in-process fixture.** A new `projectHub(t, root, env)` in `hub/test/harness.ts` calls `serveProject` and writes the discovery file as the daemon does, so `cland` subprocesses and spokes find it unchanged. It stops the hub in the test's cleanup and fails the test if the hub leaves handles, timers or child processes behind. `serveProject` takes the environment the daemon would read (today `process.env`) as an option. That is a parameter on an existing entry point, not a new seam; the Reviewer confirms it under the standing rule.
- **Which runs shard.** The Coordinator's integrated request names its occasion with `cland verify all --occasion stage|epic|release`, and only such a request shards. A batch run, a task run or QA's run on a task head never shards. The shard count is the free remote slots up to `[verification] shards` (default 2, this project's `remote_budget`). When the day's remaining cap cannot cover every shard's reservation, the run goes to one slot with a warn-level notice naming the cap. It is never silent and never partial.
- **Where Neovim runs in a sharded run.** On the shard with the least hub time, as part of its balance, with no extra droplet and no extra local load.

## Tracer-bullet order

1. **The in-process hub.** `projectHub`, the lifecycle line and the top 20 files moved, with validation duplicates and adapter edge cases below the frame. Demo: `suite.test.ts`, `merge.test.ts` and `codex-adapter.test.ts` run with no `cland hub start` outside their lifecycle tests. Their whole-file times are posted before and after.
2. **Coverage-based selection.** The map from integrated runs, selection by hunks, the fallbacks, and the replay of the last 40 merges. Demo: `cland verify` on a branch that changes one function in `hub/src/hub/` selects a subset, names the deciding functions, and finishes in under 5 minutes.
3. **Sharded close runs.** `--occasion`, balancing by `durations.json`, the two file splits, Neovim on the lightest shard, one merged report, and the cap check. Demo: a stage-close integrated run on `dev` posts one green report from two droplets, with each shard's time and cost. A batch run stays on one slot.
4. **The workers.** The re-measurement and the defaults. Demo: the measurement table on the item and the new defaults in `hub/README.md`.

## Definition of done

QA runs the demo below on `dev`, playing the human's part through the `cland` CLI, and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes. The human does not run this demo (D16 and D19 of v0.1 §4).

On an empty verify queue, QA runs one ordinary integrated full run on `dev` on one slot and reads its hub test-time and wall against the quick-wins epic's after run. QA then runs a sharded `--occasion epic` run on `dev` and reads the merged report, each shard's time and cost, and the day's spend under the cap. On a scratch branch QA changes one function in `hub/src/hub/` and one in `hub/src/tracker/`, and reads each selection and its run time. QA reads the coverage replay table on the coverage ticket, and checks that the epic's QA brief names any miss.

- [ ] In the top 20 files by test-time, non-lifecycle tests run against an in-process hub and a spawned hub process remains only in lifecycle tests; the rest is filed as a follow-up with its list; and the daemon starts per full run fall from about 944 to under 600.
- [ ] Hub test-time on one slot falls by at least 15% against the quick-wins epic's after run on common tests (the research estimates 250–620 s from the in-process hub alone).
- [ ] A stage, epic or release integrated run shards across droplets within the $3/day cap and posts one merged report; a batch run, a task run and QA's task-head run never shard; a short cap gives one slot with a warn notice.
- [ ] A sharded close run's wall time is at most 10 minutes with 2 c-8 shards (model: about 8–9.5 after both epics; 6–6.5 needs 3–4 shards and a raised `remote_budget`), with each shard's time and cost in the report.
- [ ] A typical hub task's `cland verify` selects by coverage and finishes in under 5 minutes, and the replay of the last 40 merges meets the bar the human set.
- [ ] The worker defaults are set from a recorded measurement, locally and on c-16.
- [ ] Every moved test keeps its assertions' meaning, and frame proofs still go over a real socket and WebSocket to a real hub.
- [ ] `hub/README.md` (Tests), `docs/agents/tests.md`, the Coordinator, Implementer and QA clauses and the `merge` and `qa` skills describe the in-process default, the lifecycle line, coverage selection, `--occasion` and the shard cost.

## Constraints

- **Standing rules.** Every artifact, item, commit and doc is in English. Sub-agents never use the hub: the cland tools belong to the session that started them. Only `cland release` pushes to GitHub. Commit on the task branch `t/<id>-<slug>` in its worktree, push it to `origin`, the local territory, and reach `dev` only through `cland merge` and its verdict gate. Suites run through `cland verify`. The DigitalOcean token is never stored.
- **Frame-protocol-first tests stay meaningful.** The in-process hub serves the same frames over the same socket and WebSocket to real spokes, the real CLI and real fakes. Only the process boundary between the test and the hub goes, and lifecycle tests keep it. No test is deleted to save time. A test moved below the frame keeps a frame test for its tool and refusal family. The Reviewer checks every changed assertion.
- **D25 review-first.** A source review comes first, then `cland verify` at the exact reviewed head. A fix needs a new review.
- **D29.** Task runs verify only what the diff selects. Full suites run as integrated `dev` runs per batch of about three merges, at every stage and epic close, and before release. Coverage selection narrows task runs only. The integrated runs stay full and are the backstop.
- **D27/D28 limits.** Droplet runs stay within `remote_budget`, the lifetime, the run timeout and the $3/day cap. Sharding raises none of them. Real droplet checks post create, destroy and cost on the item.
- **The load rule.** Stress loops, repeated whole-file proofs, census runs and worker measurements start only when the verify queue has no holder and no waiter (T-204, 2026-10-12 19:05Z).
- **ADRs.** 0003 (The hub is a per-project daemon): the daemon stays the production shape and lifecycle tests prove it as one. The in-process hub is a test fixture over the same `serveProject`. 0002 (Tracker files are the source of truth): the coverage map and the duration manifest are artifacts and repository files, not hub state.
- **Risks.**
  - In-process hubs share one Node process per test file, so process-global state can leak: signal handlers, `process.exitCode`, timers, env. The fixture's leak check is the guard.
  - Start-up defects that appear only in a fresh process stay covered by the lifecycle tests alone.
  - Coverage misses file reads (skills, docs, Lua), timing paths and stale maps.
  - N shards are N points of provisioning failure.
  - The cap is shared with D28's ordinary droplet verification, so a busy day can push close runs to one slot.
- **Order.** After "Test speed: quick wins" (v0.1.2). The sharding ticket needs E-271's executor and the remote budget (T-347).

## Links

- Research: `docs/research/test-speed.md` on `research/test-speed` (55d4c5a8), artifact A-2346; question Q-384.
- Decisions: the human's (a) and (b) of 2026-10-14 12:20Z; D25, D27, D28 and D29 in `docs/spec/v0.1.md` §4.
- Prior epic: "Test speed: quick wins" (R-228). E-271 (Remote executors), T-347 (the remote budget).
- Code: `hub/src/hub/daemon.ts` (`serveProject`), `hub/test/harness.ts` (`startHub`, `startDaemon`, `spawnSpoke`), `hub/src/suite-selection.ts`, `hub/src/suite-shards.ts`, `hub/test/run-suite.ts`, `hub/src/hub/suites.ts`, `hub/src/executor/`.
- ADRs: `docs/adr/0003-hub-is-a-per-project-daemon-from-the-bcas-core.md`, `docs/adr/0002-tracker-files-are-the-source-of-truth.md`.

## Plan

```yaml
stages:
  - name: the in-process hub and sharded close runs
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-393
      - - T-395
  - name: coverage selection and the workers
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-394
      - - T-396
```

## Comments

### coord · 2026-10-15T07:36:38.634Z

Owed at stage-1 close (Coordinator, 2026-10-15 07:37Z): the real two-shard c-8 `--occasion stage` run of dev, from T-395's procedure A-2727, after T-393 and T-395 merge. Post create, destroy, each shard's time, the cost and the empty tag listing; the wall is judged against T-395's 10 minutes.
