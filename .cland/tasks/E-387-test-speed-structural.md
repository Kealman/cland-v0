---
id: E-387
kind: epic
title: "Test speed: structural"
state: closed
criterion_seq: 5
labels:
  - epic
  - v0.1.3
  - ready-for-agent
assignee: null
parent: R-294
blocked_by: []
topic: topic-368
branch: null
created: 2026-10-14T12:28:09.615Z
updated: 2026-10-16T11:35:24.867Z
closed: 2026-10-16T11:35:24.867Z
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
(Human decision of 2026-10-16, ask 6a7185b6, answer 3ab87e56: E-387 closes on the delivered infrastructure. The targets for hub test-time down 15%, a coverage-selected verify under 5 minutes with the 40-merge replay, measured worker defaults, and T-393 C5's 20% check moved to E-578 in v0.1.4.)


QA runs the demo below on `dev`, playing the human's part through the `cland` CLI, and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes. The human does not run this demo (D16 and D19 of v0.1 §4).

On an empty verify queue, QA runs one ordinary integrated full run on `dev` on one slot and reads its hub test-time and wall against the quick-wins epic's after run. QA then runs a sharded `--occasion epic` run on `dev` and reads the merged report, each shard's time and cost, and the day's spend under the cap. On a scratch branch QA changes one function in `hub/src/hub/` and one in `hub/src/tracker/`, and reads each selection and its run time. QA reads the coverage replay table on the coverage ticket, and checks that the epic's QA brief names any miss.

- [ ] C1. In the top 20 files by test-time, non-lifecycle tests run against an in-process hub and a spawned hub process remains only in lifecycle tests; the rest is filed as a follow-up with its list; and the daemon starts per full run fall from about 944 to a measured 743 (census A-3775); under 600 moved to v0.1.4, E-578 (T-575), by the human's decision of 2026-10-16 (ask 396ec11a).
  - verified: qa-27 [qa] · run qa-2026-10-16-27-23 · 2026-10-16T11:35:05.698Z · commit 62a434cd9f180274e08596a1fd12c8a5f01b23c2
- [ ] C2. A stage, epic or release integrated run shards across droplets within the $3/day cap and posts one merged report; a batch run, a task run and QA's task-head run never shard; a short cap gives one slot with a warn notice.
  - verified: qa-27 [qa] · run qa-2026-10-16-27-23 · 2026-10-16T11:35:05.698Z · commit 62a434cd9f180274e08596a1fd12c8a5f01b23c2
- [ ] C3. Each sharded close run reports every shard's time and cost in its merged report. The 10-minute wall-time target moved to v0.1.4, E-578 (T-520), by the human's decision of 2026-10-16 (ask 396ec11a).
  - verified: qa-27 [qa] · run qa-2026-10-16-27-23 · 2026-10-16T11:35:05.698Z · commit 62a434cd9f180274e08596a1fd12c8a5f01b23c2
- [ ] C4. Every moved test keeps its assertions' meaning, and frame proofs still go over a real socket and WebSocket to a real hub.
  - verified: qa-27 [qa] · run qa-2026-10-16-27-23 · 2026-10-16T11:35:05.698Z · commit 62a434cd9f180274e08596a1fd12c8a5f01b23c2
- [ ] C5. `hub/README.md` (Tests), `docs/agents/tests.md`, the Coordinator, Implementer and QA clauses and the `merge` and `qa` skills describe the in-process default, the lifecycle line, coverage selection, `--occasion` and the shard cost.
  - verified: qa-27 [qa] · run qa-2026-10-16-27-23 · 2026-10-16T11:35:05.698Z · commit 62a434cd9f180274e08596a1fd12c8a5f01b23c2

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
  - name: retrospective gates and in-process part 2
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-469
      - - T-470
      - - T-471
      - - T-472
        - T-466
      - - T-557
```

## Comments

### coord · 2026-10-15T07:36:38.634Z

Owed at stage-1 close (Coordinator, 2026-10-15 07:37Z): the real two-shard c-8 `--occasion stage` run of dev, from T-395's procedure A-2727, after T-393 and T-395 merge. Post create, destroy, each shard's time, the cost and the empty tag listing; the wall is judged against T-395's 10 minutes.

### coord · 2026-10-15T09:03:17.377Z

Owed at stage-1 close, besides T-395's real two-droplet run: T-393's C5. The 20 migrated files' summed whole-file time from the stage-1 close integrated cover on the Mac, compared with release cover A-2714 per file, must fall by at least 20%. Its C6 under-600 target moved to T-466.

### coord · 2026-10-15T15:36:22.536Z

Research question 2 is answered (2026-10-15 15:36Z, ask 82732199): the proposal is accepted. The batch is the backstop, the bar is zero misses on the last 40 merges' own tests, and wider misses are listed with their cause. Recorded on T-394.

### coord · 2026-10-15T18:12:08.813Z

Stage-1 close run, 2026-10-15 17:54–18:10Z: `cland verify all --fresh --occasion stage` from the root at dev 9bc15ce8. The hub runs T-496, so bundling worked.
- Run: 1bebcda2. Logs: parent A-3230, shard-1 A-3231, shard-2 A-3232. Executor status before A-3216, during A-3223, after A-3236.
- shard-1: cland-v0-2ba27234, c-8 lon1, 892.95 s, $0.0620, green (894 pass).
- shard-2: cland-v0-b5d7d2f2, c-8 lon1, 687.73 s, $0.0467, exit 1, two failures, both T-519 (CLAND_SUITE_SELECTION leaks into suite-runner.test.ts nested runners).
- Total cost $0.1088. Overall wall from admission through collection: 907.85 s.
- Spend $6.86 before, $6.97 after, against the $10 cap. Neither shard droplet appears in the lease or tag listing afterwards, which shows only four other crew runs.
Result for T-395: C3/C4 behaviour is confirmed (two shards, one merged report, per-shard machine, time and cost). C6, the 600 s wall target, is NOT met (908 s). The stage close is not green until T-519 merges and a repeat sharded run passes. The wall-time gap goes to a follow-up.

### coord · 2026-10-15T19:07:10.207Z

Stage 3 sequencing (2026-10-15 19:07Z), applying rule 6's hot-file serialization after today's five conflict rounds on run.ts and suites.ts:
- Lane A: T-469 → T-470 → T-472, all in hub/src/hub/suites.ts and verify reporting; blocked_by set.
- Lane B: T-471, the runner load gate and the durations manifest.
- T-466, which migrates many test files to the in-process hub, starts after E-482's open flake fixes land, to avoid colliding with them.

### coord · 2026-10-15T19:23:54.228Z

Budget sequencing (2026-10-15 19:24Z): today's droplet spend is $7.89 + $1.00 reserved of the $10 cap. The stage-close two-shard run (after the T-519/T-512 restart) goes tonight. The T-396 c-16 worker measurements and the T-394 C5–C7 probes move to after 00:00Z (the new UTC day budget).

### coord · 2026-10-15T20:54:43.974Z

Stage-close run 7d5ac27f at dev 66545745 is red. Shard 2 passed (cland-v0-a9bc7b1c, 851 s, $0.0558). Shard 1 failed (cland-v0-2df7755a, 906 s, $0.0584) on two new load flakes, now filed as T-530 (heartbeat run-digest, launching vs running) and T-531 (suite-close coverage-map scp count 24 vs 2). Wall time was 906 s from admission to collection, against the 600 s target (T-520). The total cost was $0.1142. Logs: A-3340, A-3341, A-3342. I'll rerun the stage close on dev after the T-469 and T-471 merges, so one integrated run covers them too.

### coord · 2026-10-15T21:43:57.469Z

Stage-close rerun, 2026-10-15:
- 21:40Z, run 02c7cfc7: failed in 9 s with "host typecheck failed; no droplet created". The root lacked `typescript7` after the T-427 merge; filed as T-542. Fixed by `npm install` in the root, with the lockfile unchanged.
- 21:41:54Z, run 7a9d39f3 at dev 7dbd2e2c: resubmitted, `verify all --fresh --occasion stage --report general`. The dev tip includes T-471 and T-427, not T-469. Shards: cland-v0-3149ccb0 and cland-v0-29d60bb3 (c-8 lon1), both bundled and running tests at 21:43:43Z. Results will follow here.

### coord · 2026-10-15T21:55:23.710Z

Stage-close run 7a9d39f3 at dev 7dbd2e2c (21:41:54–21:55:00Z): red on one known flake.
- shard-1, cland-v0-3149ccb0 c-8 lon1: 764.78 s, $0.0522. 924 pass, 1 fail: suite-close.test.ts:12 "integrated remote close collects each map before release…", the T-531 coverage-map count. Its test-only fix at a85c9135 is in verify now.
- shard-2, cland-v0-29d60bb3 c-8 lon1: 770.20 s, $0.0536, green (875 pass, Neovim phase included).
- Total $0.1058. Wall 785.69 s from admission through collection, down from 906–908 s but still over the 600 s target (T-520).
- Logs: A-3393 (all), A-3394, A-3395.
Next: merge T-531 and T-530, then one more stage-close run on dev, which will also cover T-469 if it has landed. The stage closes on that green.

### coord · 2026-10-15T22:42:26.366Z

Stage-close cover 725bd529 at dev 21ae664d (22:27:19–22:40:51Z) is red on one test, the new T-480 ordering case in session-model.test.ts. The usage.subagents rows arrive in hook order; filed as T-544 (XS, regression of T-480) and launched.
- shard-1, cland-v0-7f8dcbd7 c-8 lon1: 762.02 s, $0.0512, 1 fail.
- shard-2, cland-v0-319cd8dc c-8 lon1: 811.93 s, $0.0544, green.
- Total $0.1056. Wall 811.96 s.
- Log: A-3413.
The T-531 suite-close failure is gone. This cover covers T-471, T-427, T-531, T-530, T-480, T-478, T-311 and T-513. Next: T-544 merges, then one more stage-close cover. The hub restart is armed on a green cover.

### coord · 2026-10-16T00:19:13.450Z

Integrated cover c0c04df1 at dev a06020a3 (23:47–00:17:47Z) is GREEN.
- Run: `verify all --fresh --occasion stage`. All four remote slots were busy at admission, so it ran whole on one droplet, cland-v0-9c30f4ea c-8 lon1. That's the designed slot-shortage fallback, not sharding.
- Suite duration 1578.67 s, peak load 13.54. The Neovim phase ran: 390 pass, 3 skips, 0 fail.
- Log A-3493; coverage map A-3494.
- Covers 15 merges since dev 7dbd2e2c: T-471, T-427, T-531, T-530, T-480, T-478, T-311, T-513, T-529, T-525, T-499, T-493, T-544, plus remote_budget 6 and rule 13.
It was the restart cover; the hub restarted at about 00:19Z. Stage 3 of this epic is still open: T-469 (in delta review after its conflict merge and the T-544 pick), then T-470, T-472 and T-466. The sharded wall measurement (T-395 C6, T-520) still comes from a two-shard run.

### qa-27 · 2026-10-16T10:52:03.961Z

verdict: qa
result: not clear
by: qa-27 [qa]
run: qa-2026-10-16-27-21
commit: f6045f838f55902c0224473512e82c1ff0121e72

| Check | Executor | Result | Evidence |
| --- | --- | --- | --- |
| G0 | local macOS | PASS | [G0.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3878-e-387-run-21-at-f6045f83-qa-evidence-r1-fails-and-t8-live-readback-inconclusive/G0.txt) |
| G1 | local macOS | PASS | [G1-epic.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3878-e-387-run-21-at-f6045f83-qa-evidence-r1-fails-and-t8-live-readback-inconclusive/G1-epic.json), [G1-children.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3878-e-387-run-21-at-f6045f83-qa-evidence-r1-fails-and-t8-live-readback-inconclusive/G1-children.json), [G1-plan.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3878-e-387-run-21-at-f6045f83-qa-evidence-r1-fails-and-t8-live-readback-inconclusive/G1-plan.json) (full list in runs.jsonl) |
| G2 | local macOS | PASS | [G1-epic.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3878-e-387-run-21-at-f6045f83-qa-evidence-r1-fails-and-t8-live-readback-inconclusive/G1-epic.json) |
| E1 | local macOS | PASS | [E1-census.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3878-e-387-run-21-at-f6045f83-qa-evidence-r1-fails-and-t8-live-readback-inconclusive/E1-census.txt) |
| E2 | local macOS | PASS | [E2-judgment.md](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3878-e-387-run-21-at-f6045f83-qa-evidence-r1-fails-and-t8-live-readback-inconclusive/E2-judgment.md), [E2-call-context.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3878-e-387-run-21-at-f6045f83-qa-evidence-r1-fails-and-t8-live-readback-inconclusive/E2-call-context.txt), [E2-planned-stage-context.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3878-e-387-run-21-at-f6045f83-qa-evidence-r1-fails-and-t8-live-readback-inconclusive/E2-planned-stage-context.txt) (full list in runs.jsonl) |
| E3 | local macOS | PASS | [E2-E3-marks.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3878-e-387-run-21-at-f6045f83-qa-evidence-r1-fails-and-t8-live-readback-inconclusive/E2-E3-marks.txt), [E3-T466.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3878-e-387-run-21-at-f6045f83-qa-evidence-r1-fails-and-t8-live-readback-inconclusive/E3-T466.json), [E3-T575.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3878-e-387-run-21-at-f6045f83-qa-evidence-r1-fails-and-t8-live-readback-inconclusive/E3-T575.json) |
| E4 | local macOS | PASS | [E4-shards.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3878-e-387-run-21-at-f6045f83-qa-evidence-r1-fails-and-t8-live-readback-inconclusive/E4-shards.txt) |
| E5 | local macOS | PASS | [E5-fallback.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3878-e-387-run-21-at-f6045f83-qa-evidence-r1-fails-and-t8-live-readback-inconclusive/E5-fallback.txt) |
| E6 | local macOS | PASS | [E4-shards.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3878-e-387-run-21-at-f6045f83-qa-evidence-r1-fails-and-t8-live-readback-inconclusive/E4-shards.txt) |
| E7 | local macOS | PASS | [E7-cover.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3878-e-387-run-21-at-f6045f83-qa-evidence-r1-fails-and-t8-live-readback-inconclusive/E7-cover.txt), [G1-plan.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3878-e-387-run-21-at-f6045f83-qa-evidence-r1-fails-and-t8-live-readback-inconclusive/G1-plan.json) |
| T1 | local macOS | PASS | [T1.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3878-e-387-run-21-at-f6045f83-qa-evidence-r1-fails-and-t8-live-readback-inconclusive/T1.log), [T1-queue.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3878-e-387-run-21-at-f6045f83-qa-evidence-r1-fails-and-t8-live-readback-inconclusive/T1-queue.json), [T1-start.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3878-e-387-run-21-at-f6045f83-qa-evidence-r1-fails-and-t8-live-readback-inconclusive/T1-start.txt) |
| T2 | local macOS | PASS | [T2.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3878-e-387-run-21-at-f6045f83-qa-evidence-r1-fails-and-t8-live-readback-inconclusive/T2.log), [T2-queue.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3878-e-387-run-21-at-f6045f83-qa-evidence-r1-fails-and-t8-live-readback-inconclusive/T2-queue.json), [T2-start.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3878-e-387-run-21-at-f6045f83-qa-evidence-r1-fails-and-t8-live-readback-inconclusive/T2-start.txt) |
| T3 | local macOS | PASS | [T3.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3878-e-387-run-21-at-f6045f83-qa-evidence-r1-fails-and-t8-live-readback-inconclusive/T3.log), [T3-queue.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3878-e-387-run-21-at-f6045f83-qa-evidence-r1-fails-and-t8-live-readback-inconclusive/T3-queue.json), [T3-start.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3878-e-387-run-21-at-f6045f83-qa-evidence-r1-fails-and-t8-live-readback-inconclusive/T3-start.txt) |
| T4 | local macOS | PASS | [T4.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3878-e-387-run-21-at-f6045f83-qa-evidence-r1-fails-and-t8-live-readback-inconclusive/T4.log), [T4-queue.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3878-e-387-run-21-at-f6045f83-qa-evidence-r1-fails-and-t8-live-readback-inconclusive/T4-queue.json), [T4-start.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3878-e-387-run-21-at-f6045f83-qa-evidence-r1-fails-and-t8-live-readback-inconclusive/T4-start.txt) |
| T5 | local macOS | PASS | [T5.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3878-e-387-run-21-at-f6045f83-qa-evidence-r1-fails-and-t8-live-readback-inconclusive/T5.log), [T5-queue.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3878-e-387-run-21-at-f6045f83-qa-evidence-r1-fails-and-t8-live-readback-inconclusive/T5-queue.json), [T5-start.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3878-e-387-run-21-at-f6045f83-qa-evidence-r1-fails-and-t8-live-readback-inconclusive/T5-start.txt) |
| T7 | local macOS | PASS | [T7.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3878-e-387-run-21-at-f6045f83-qa-evidence-r1-fails-and-t8-live-readback-inconclusive/T7.log), [T7-queue.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3878-e-387-run-21-at-f6045f83-qa-evidence-r1-fails-and-t8-live-readback-inconclusive/T7-queue.json), [T7-start.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3878-e-387-run-21-at-f6045f83-qa-evidence-r1-fails-and-t8-live-readback-inconclusive/T7-start.txt) |
| T6 | local macOS | PASS | [T6-a.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3878-e-387-run-21-at-f6045f83-qa-evidence-r1-fails-and-t8-live-readback-inconclusive/T6-a.log), [T6-b.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3878-e-387-run-21-at-f6045f83-qa-evidence-r1-fails-and-t8-live-readback-inconclusive/T6-b.log), [T6-a-queue.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3878-e-387-run-21-at-f6045f83-qa-evidence-r1-fails-and-t8-live-readback-inconclusive/T6-a-queue.json) (full list in runs.jsonl) |
| R1 | local macOS | FAIL | [R1-matrix.md](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3878-e-387-run-21-at-f6045f83-qa-evidence-r1-fails-and-t8-live-readback-inconclusive/R1-matrix.md), [R1-cells.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3878-e-387-run-21-at-f6045f83-qa-evidence-r1-fails-and-t8-live-readback-inconclusive/R1-cells.json), [R1-default-implementer.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3878-e-387-run-21-at-f6045f83-qa-evidence-r1-fails-and-t8-live-readback-inconclusive/R1-default-implementer.txt) (full list in runs.jsonl) |
| F1 | local macOS | PASS | [F1-status.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3878-e-387-run-21-at-f6045f83-qa-evidence-r1-fails-and-t8-live-readback-inconclusive/F1-status.json), [F1-dev.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3878-e-387-run-21-at-f6045f83-qa-evidence-r1-fails-and-t8-live-readback-inconclusive/F1-dev.txt), [F1-worktree.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3878-e-387-run-21-at-f6045f83-qa-evidence-r1-fails-and-t8-live-readback-inconclusive/F1-worktree.txt) |
| T8 | local macOS | INCONCLUSIVE | [T8-a.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3878-e-387-run-21-at-f6045f83-qa-evidence-r1-fails-and-t8-live-readback-inconclusive/T8-a.log), [T8-b.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3878-e-387-run-21-at-f6045f83-qa-evidence-r1-fails-and-t8-live-readback-inconclusive/T8-b.log), [T8-a-queue.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3878-e-387-run-21-at-f6045f83-qa-evidence-r1-fails-and-t8-live-readback-inconclusive/T8-a-queue.json) (full list in runs.jsonl) |

Findings, ranked:

- High: none.
- Medium — R1 / C5: `docs.py` extracts the Implementer clauses at S and matches the five documentation topics. Both `hub/src/roles/default-roles.ts [implementer]` and `.cland/roles.toml [implementer]` omit `projectHub`/the in-process default and the `startDaemon` lifecycle-only boundary (four required cells). Coverage selection is present at lines 152 and 104 respectively. Exact clauses and the 50-cell matrix are retained. C5 fails.
- Low — E4/R1: seven cap references still say $3 in the DoD/docs/clauses/skills while `.cland/config.toml:21` sets $14. `R1-cap-wording.txt` gives exact source lines; the epic DoD also says $3/day. As the brief directs, this does not fail C2 or add another criterion failure.

T8 live readback disposition: INCONCLUSIVE for the live readback at the requested build. Both targeted files passed (10 tests), including a real CLI-frame proof of metrics.queueWait, but the live verify queue and hub status expose only legacy window:20 metrics. The live hub started at 10:13:46.880Z; T-470 landed at 10:14:24Z (71b4bd33868fc3fd22b82f3289cadd27493677ee), 38 seconds later. This is runtime version skew, not demonstrated failure of the requested S. No restart or extra run was attempted. T8 has no DoD criterion mark. Exact readbacks and timestamps retained; Coordinator notified.

Result: not clear. R1 fails; no product code was changed. C1–C4 checks pass and are established in this text; only C5 is submitted in `failed`, with no `verified` argument on a not-clear verdict.

Run qa-2026-10-16-27-21; full tested SHA f6045f838f55902c0224473512e82c1ff0121e72. Clean detached worktree on macOS; Node v24.21.0. All 100 targeted tests across ten files passed, zero skips/failures/cancellations/retries. Each file ran alone after its saved queue check; no Coordinator local holder. No full suite, lease, provider call or verification submission. Cost for this local QA run: not applicable.

Evidence reads:

- E1: A-3775 at reviewed clean head 88a3630e8d0a8dc012d43935e04befa23cbd1120, completed darwin exit 0; 742 canonical-helper starts, 743 including the copied coverage fixture. This is the recorded task workload (including load-gate repeats), not a controlled paired integrated-run comparison. Under-600 and speed targets are deferred to E-578.
- E2: all twelve added startDaemon calls have lifecycle proofs, each listed with file, test and context. Existing assertion-meaning audits A-2744/A-2751 and lifecycle inventory A-2745 retained; T-393 marks checked. E3: T-466 C1/C2 verified; open T-575 is under E-578 and names A-3775 plus remaining-ranking.json.
- E4/E6: A-3413, run 725bd529 at 21ae664d, one merged log: cland-v0-7f8dcbd7 c-8 lon1 762.02 s / $0.0512; cland-v0-319cd8dc c-8 lon1 811.93 s / $0.0544; total $0.1056; overall wall 811.96 s. Shard-1 failure is identified once. Report completeness is judged; the wall and known historical red test are not new failures.
- Separate historical cap evidence as the brief requests: run 1bebcda2, A-3230/A-3231/A-3232, spend $6.86→$6.97 under its historical $10 cap, own droplets absent afterwards. Those spend figures are not attributed to A-3413; see E4-provenance-note.txt.
- E5: A-3493 run c0c04df1 is the documented one-slot stage fallback with occupied slots; source/docs and T1/T2 establish the admission rules.
- E7: all three plan stages are open, with null cover tree and Linux droplet/macOS listed missing. Per Coordinator amendment, cite A-3877: Linux d132b59b at S, exit 0, 2333 passing including Neovim. No macOS stage receipt is claimed.

Criteria mapping: C1=D1 (E1–E3), C2=D2 (E4,E5,T1,T2), C3=D3 (E4,E6), C4=D4 (E2,T3), C5=D5 (R1). T4–T8 serve no DoD criterion but remain in scope.

Amendments: Coordinator 26911a4c assigned stable C1–C5 during the run; all five texts were compared and are unchanged. Coordinator request allowed E7 to cite A-3877 without waiting for plan-stage closure. Both request deliveries were treated as one request. The historical spend and current cap remain distinct.

Final freshness: `demo status E-387 --commit S --json` reports current=true without a lease. Worktree remains clean; see F1-status.json and F1-worktree.txt.

Full evidence A-3878: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3878-e-387-run-21-at-f6045f83-qa-evidence-r1-fails-and-t8-live-readback-inconclusive.

Verdict note A-3879: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3879-e-387-qa-run-21-not-clear-c5-documentation-gap-t8-runtime-skew.md
Freshness rechecked immediately before verdict: current=true. Coordinator names the documentation fix T-588.

Criteria: C5 failed (R1: both Implementer clauses omit the projectHub in-process default and startDaemon lifecycle-only boundary.).

### qa-27 · 2026-10-16T11:35:05.698Z

verdict: qa
result: clear
by: qa-27 [qa]
run: qa-2026-10-16-27-23
commit: 62a434cd9f180274e08596a1fd12c8a5f01b23c2

| Check | Result | Basis | Evidence |
|---|---|---|---|
| P0 | PASS | Fresh run: Exactly the two authorized paths outside exclusions; partial rerun permitted. | `P0-all-paths.txt`, `P0-paths.txt` |
| G0 | PASS | Fresh run: Clean detached requested S, committed brief, Node v24.21.0. | `G0.txt` |
| G1 | PASS | Fresh run: 12 children closed and landing commits ancestors of S, including T-588; C1–C5 read. Three stages open, currently missing Linux/macOS cover at the new tree; recorded as expected stage evidence state. | `G1-epic.json`, `G1-children.json`, `G1-plan.json`, `G1-ancestry.txt` |
| G2 | PASS | Fresh run: QA hold taken. | `G1-epic.json` |
| R1 | PASS | Fresh run: All required cells of the 50-cell matrix filled; both Implementer clauses now name projectHub and lifecycle-only startDaemon. Live Coordinator clause equals S. | `R1-matrix.md`, `R1-cells.json`, `R1-key-lines.txt`, `R1-live-diff.txt` |
| T8 | PASS | Fresh run: suite-queue 5/5 and suite-wait-metrics 5/5; zero fail/skip/retry. Both live commands expose matching queueWait; pid 73959, started 10:53:01.144Z. | `T8-files.txt`, `T8-a.log`, `T8-b.log`, `T8-a-queue.json`, `T8-b-queue.json`, `T8-final-queue.json`, `T8-status.json`, `T8-readback.txt` |
| F1 | PASS | Fresh run: freshness.current=true; no lease. | `F1-status.json`, `F1-dev.txt` |
| E1 | PASS, carried | Run qa-2026-10-16-27-21 at f6045f838f55902c0224473512e82c1ff0121e72; not rerun | A-3878/runs.jsonl line 4; project runs.jsonl line 1041 |
| E2 | PASS, carried | Run qa-2026-10-16-27-21 at f6045f838f55902c0224473512e82c1ff0121e72; not rerun | A-3878/runs.jsonl line 5; project runs.jsonl line 1042 |
| E3 | PASS, carried | Run qa-2026-10-16-27-21 at f6045f838f55902c0224473512e82c1ff0121e72; not rerun | A-3878/runs.jsonl line 6; project runs.jsonl line 1043 |
| E4 | PASS, carried | Run qa-2026-10-16-27-21 at f6045f838f55902c0224473512e82c1ff0121e72; not rerun | A-3878/runs.jsonl line 7; project runs.jsonl line 1044 |
| E5 | PASS, carried | Run qa-2026-10-16-27-21 at f6045f838f55902c0224473512e82c1ff0121e72; not rerun | A-3878/runs.jsonl line 8; project runs.jsonl line 1045 |
| E6 | PASS, carried | Run qa-2026-10-16-27-21 at f6045f838f55902c0224473512e82c1ff0121e72; not rerun | A-3878/runs.jsonl line 9; project runs.jsonl line 1046 |
| E7 | PASS, carried | Run qa-2026-10-16-27-21 at f6045f838f55902c0224473512e82c1ff0121e72; not rerun | A-3878/runs.jsonl line 10; project runs.jsonl line 1047 |
| T1 | PASS, carried | Run qa-2026-10-16-27-21 at f6045f838f55902c0224473512e82c1ff0121e72; not rerun | A-3878/runs.jsonl line 11; project runs.jsonl line 1048 |
| T2 | PASS, carried | Run qa-2026-10-16-27-21 at f6045f838f55902c0224473512e82c1ff0121e72; not rerun | A-3878/runs.jsonl line 12; project runs.jsonl line 1049 |
| T3 | PASS, carried | Run qa-2026-10-16-27-21 at f6045f838f55902c0224473512e82c1ff0121e72; not rerun | A-3878/runs.jsonl line 13; project runs.jsonl line 1050 |
| T4 | PASS, carried | Run qa-2026-10-16-27-21 at f6045f838f55902c0224473512e82c1ff0121e72; not rerun | A-3878/runs.jsonl line 14; project runs.jsonl line 1051 |
| T5 | PASS, carried | Run qa-2026-10-16-27-21 at f6045f838f55902c0224473512e82c1ff0121e72; not rerun | A-3878/runs.jsonl line 15; project runs.jsonl line 1052 |
| T7 | PASS, carried | Run qa-2026-10-16-27-21 at f6045f838f55902c0224473512e82c1ff0121e72; not rerun | A-3878/runs.jsonl line 16; project runs.jsonl line 1053 |
| T6 | PASS, carried | Run qa-2026-10-16-27-21 at f6045f838f55902c0224473512e82c1ff0121e72; not rerun | A-3878/runs.jsonl line 17; project runs.jsonl line 1054 |

Findings, ranked by severity:

- High/medium: none unresolved in this pass. Run 21 R1/C5 is fixed by T-588; run 21 T8 runtime skew is resolved on the restarted hub. Original FAIL/INCONCLUSIVE evidence remains in A-3878/A-3879.
- Low, carried E4/R1 documentation wording: the DoD, docs, clauses and skills retain $3 cap references although the live configured cap is $14. The brief explicitly treats this as non-blocking. R1-key-lines.txt includes the clauses/skills; run 21 R1-cap-wording.txt retains the full inventory.

Clear at `62a434cd9f180274e08596a1fd12c8a5f01b23c2`, run `qa-2026-10-16-27-23`. Seven fresh checks (P0,G0,G1,G2,R1,T8,F1) and fourteen authorized carried checks (E1–E7,T1–T7) all pass. Fresh execution is local macOS: 10 tests in two serial files, no failures/skips/cancellations/retries. No full suite, verification submission, demo lease or provider call. New droplet cost: not applicable.

**Verified: C1,C2,C3,C4,C5.** C1=E1–E3; C2=E4,E5,T1,T2; C3=E4,E6; C4=E2,T3; C5=R1. T8 has no separate criterion but remains required and passed.

Carry authorization: Coordinator request 6116c542-5991-44d3-aed8-ca22470718cb, topic-368, 11:31:55Z, before START. P0 compares f6045f83 to S excluding .cland/, qa/, docs/spec/: exactly hub/src/roles/default-roles.ts (T-588 line, merge 32b4c62f) and hub/test/durations.json (60517392 manifest refresh from A-3877). The exact list is retained. The old R1 and T8 outcomes are not carried. `carried-runs-21.jsonl` preserves original lines/builds; `carry-provenance.json` gives both original file line numbers. New recorder rows explicitly say carried, not newly executed. Recorder surface hub-api is used; all new checks are local macOS.

Carried evidence and limits:

- E1: A-3775 clean reviewed head 88a3630e8d0a8dc012d43935e04befa23cbd1120, macOS census exit 0: 742 canonical starts, 743 with copied coverage fixture. Under-600 and speed targets moved to E-578.
- E2/E3: run 21 inventoried all twelve new startDaemon calls and their lifecycle assertions, read A-2744/A-2751 assertion audits and A-2745 lifecycle inventory, and verified T-466 closed plus T-575 follow-up under E-578.
- E4/E6: A-3413 run 725bd529 at 21ae664d: cland-v0-7f8dcbd7 c-8 lon1 762.02 s/$0.0512; cland-v0-319cd8dc c-8 lon1 811.93 s/$0.0544; total $0.1056, overall wall 811.96 s, shard-1 failure named once. Report completeness is judged, not the deferred wall target or historical failure.
- Separate historical cap receipt: run 1bebcda2, A-3230/A-3231/A-3232, $6.86→$6.97 under its then-$10 cap and own droplets absent afterward. These figures are not attributed to A-3413.
- E5: A-3493 one-slot fallback, with admission/source/docs and T1/T2 proof. E7: run 21 recorded open stages and cited green Linux A-3877 (d132b59b at f6045f83; 2333 passing), with no macOS stage receipt claimed. G1 freshly records current stage state; no new platform receipt is claimed.

T8 observed queueWait values are retained in T8-metrics-summary.json. Both windows (24h and last 50 runs), both executors, p50/p90 and targetP90Ms=1200000 are present. A measured p90 above the target is a reported measurement; T8 requires exposing the target and metrics, not meeting a latency bound.

Durable carried evidence: [A-3878](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3878-e-387-run-21-at-f6045f83-qa-evidence-r1-fails-and-t8-live-readback-inconclusive/README.md), original recorder lines [runs.jsonl](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3878-e-387-run-21-at-f6045f83-qa-evidence-r1-fails-and-t8-live-readback-inconclusive/runs.jsonl); prior verdict A-3879. Freshness F1 is current; the detached worktree is clean.

Fresh evidence: A-3891, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3891-e-387-qa-run-23-at-62a434cd-partial-rerun-and-carried-evidence.

Verdict note A-3892: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3892-e-387-qa-run-23-clear-c1-c5-after-t-588-and-live-metrics-rerun.md

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.
