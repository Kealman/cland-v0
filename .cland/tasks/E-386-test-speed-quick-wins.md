---
id: E-386
kind: epic
title: "Test speed: quick wins"
state: closed
criterion_seq: 9
labels:
  - epic
  - v0.1.2
  - ready-for-agent
assignee: null
parent: R-228
blocked_by: []
topic: topic-272
branch: null
created: 2026-10-14T12:28:09.133Z
updated: 2026-10-15T07:45:20.712Z
closed: 2026-10-15T07:45:20.712Z
---

## Goal

A task's verification stops costing a full suite, and the full suite costs less machine time per test, without any test losing what it proves. Today a task waits about 39 minutes for its verification: 24 minutes of queue and 15 minutes of run. 37 of the last 40 task merges ran the full suite. 81% of test-time sits in tests that spawn a real hub, driven by about 63,000 process spawns per run, of which 29,203 are `ps`, `lsof` and `pgrep` calls. These five changes are the cheap half of the research's recommended epic: no fixture redesign, no assertion changed in meaning. They cut about 4–5 minutes from a local full run, take Neovim-only tasks from about 15 minutes to about 2, and stop the suite growing by about 2.4 minutes a day without anyone noticing (Q-384, `docs/research/test-speed.md`).

## Contents

- **Selection hygiene (§3.3(a), §3.10 "D29 hygiene").** The docs, the clauses and the QA skill stop prescribing `cland verify all` for task runs, as D29 says. `chooseSuiteMode` widens from positive allowlists to package rules. Replayed on the last 40 merges, those rules turn full 37 / hub-only 2 / Neovim-only 1 into about full 22 / hub-only 13 / Neovim-only 5.
- **The timing diet (§3.9).** Fast fake-harness defaults, with an explicit opt-in for tests that need a slow turn to stage a race. Env control over the production schedules that tests wait out in real time: the 30-second Claude agents schedule, the executor lifetime, run timeout and sweep, and accounts polling. Event waits replace fixed sleeps of 0.5 s or more where the sleep waits for something to happen.
- **The duration manifest and the slow-test budget (§3.7).** `hub/test/durations.json` is generated from a green integrated log. A budget check fails a test over 5 s or a file over 60 s unless the manifest lists it with a reason. The suite report names the top regressions.
- **Lazy CLI subcommand imports (§3.10).** `hub/bin/cland.ts` loads only the subcommand it runs, with a module-count guard test. This applies to about 3,700 CLI processes per run and to every agent's own `cland` call.
- **The process-inspection diet (§3.5).** Fixture hubs skip the start-up orphan sweep unless the test opts in. Teardown kills from the recorded ownership table instead of scanning the machine. `processStarted` calls are coalesced. The census target is under 12,000 `ps` + `lsof` + `pgrep` spawns per run.

Not in this epic: the in-process hub fixture, coverage-based selection, droplet sharding and the worker re-measurement. Those are "Test speed: structural" in v0.1.3 (R-294), the research's #6 to #9. Also out: fixture snapshots of seeded `.cland` state (§3.2), running the Neovim phase alongside the hub phase (§3.10, the research's open question 7), and splitting `suite.test.ts` and `merge.test.ts`, which goes with the sharding ticket.

Choices where the research is silent:

- **Package rules.** `nvim-only` is any diff wholly under `nvim/**` except the protocol-side `nvim/lua/cland/hub.lua` and `state.lua`. `full` is a diff that touches both packages, or touches one of these: the protocol, the adapter contract, the crew and role CLI, the package, lockfile and tsconfig files, the suite runner and selection modules, or any hub file that `nvim/test/**` imports directly (today `hub/test/harness.ts`, `hub/test/process-cleanup.ts`, `hub/src/protocol.ts`, five tracker modules, `init/config.ts`, `hub/store.ts` and the two visibility modules). The import list is read from the source at selection time, not hard-coded. `hub-only` is everything else, docs, skills, `.agents/` and `.cland/tasks/` included. Integrated `dev`, empty diffs and fetch failures still run full.
- **Fast defaults.** Fake turns take 30 ms, adapter polls run every 50 ms and push trust is 100 ms. The Codex refuse window is 150 ms. A test that needs a slow turn passes `turnMs` (or the fake's existing "take your time" text) and says why in a comment. Tests that prove a default value (the 30-second schedule) prove it from the resolved setting the hub reports, and prove the behaviour at a short override. All timing control uses the existing `CLAND_*_MS` and `CLAND_TEST_*` environment pattern. Nothing adds an injected clock or any other new seam inside the hub.
- **Negative waits** ("nothing happens for N ms") are not event waits. Each one becomes a multiple of the interval it waits out, so it shrinks with the new defaults and still spans the same number of polls.
- **The budget** is 5 s per test and 60 s per file, judged on raw time in the run that executed the file. A test absent from the manifest and over budget fails the run with a `duration budget` line naming it. Allowlist entries carry a reason and the recorded median. The Coordinator refreshes the manifest from a green integrated log at each stage close. Times only fall during this epic, so a stale manifest never produces a false failure.
- **Fixture sweeps.** `startDaemon` sets `CLAND_TEST_SKIP_ORPHAN_SWEEP=1` by default, and the daemon skips the start-up sweep only when that variable is set. These tests opt back in by fixture option: `orphan-servers`, `orphan-sweep-lock`, `daemon`, `doctor*`, `system-processes`, `termination-ownership` and every test that asserts an `orphan-sweep-*` journal event. Production hubs never see the variable.
- **Teardown ownership.** A test's teardown signals only identities it recorded (pid with start time), verified by a targeted `ps -p`. The machine-wide `ps eww -ax` and `lsof -d cwd` scan stays in the runner's phase sweep and in the root-directory cleanup path. The coalescing of `processStarted` lives no longer than one operation, so pid reuse is still detected.

## Tracer-bullet order

1. **Selection that selects.** Widened package rules, plus docs, clauses and the QA skill aligned with D29. Demo: `cland verify` with no mode on a branch that changes only `nvim/lua/cland/explorer.lua` selects `nvim-only` and finishes in under 3 minutes. The 40-merge replay table shows the new split.
2. **The timing diet.** Fast fake defaults with explicit slow opt-ins, env control over the timer-bound tests, and event waits. Demo: the three slowest timer-bound tests (`executor-safety` "prepare, run, fallback, cancel…", `claude-code-adapter` "…default 30-second schedule…", `executor-safety` "…timed-out run…") each take under 5 s alone.
3. **Lazy CLI imports.** `cland --help` loads a handful of modules, and each subcommand loads only its own closure. Demo: the guard test prints the module counts per command, and `cland --help` takes under 50 ms on an idle machine.
4. **The inspection diet.** No sweep in fixture hubs unless asked, teardown from the ownership table, coalesced `processStarted`. Demo: a census compare against A-2021 shows `ps` + `lsof` + `pgrep` under 12,000.
5. **The budget.** `hub/test/durations.json` from the latest green integrated log, the budget check in the runner and the regressions in the suite report. Demo: a planted 6-second test in a scratch branch fails its run with a `duration budget` line, and the report lists the top regressions.

## Definition of done

QA runs the demo below on `dev`, playing the human's part through the `cland` CLI, and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes. The human does not run this demo (D16 and D19 of v0.1 §4).

**The before run** is the last green integrated full run on `dev` before this epic's first merge. The Coordinator names its artifact on this epic when that merge lands, and A-2299 and census A-2021 from the research are the reference. **The after run** is an integrated full run on `dev` after the last merge, on the same executor and size as the before run (the local Mac if possible, since the research's numbers are local), started only when the verify queue is empty. Beside it QA runs `node hub/test/spawn-census.mjs run` at the same head, also on an empty queue. QA compares the two runs over the tests present in both. The research predicts the following:

| Measure | Before | Predicted after |
| --- | --- | --- |
| Hub test-time, common tests | about 3,100 s | 980–1,270 s lower |
| Full-run wall | about 15 min | 4–5.5 min shorter |
| `ps` + `lsof` + `pgrep` per run | 29,203 | under 12,000 |
| Inspection spawns per daemon start | about 31 | about 13 or fewer |
| `cland --help` modules loaded | 139 | a handful |
| The three timer-bound tests | 33.0, 32.3 and 15.1 s | under 5 s each |

QA posts a before/after table on this epic. QA also replays `chooseSuiteMode` over the 40 merges from `83b74c6` back to `f174d9c`, runs one Neovim-only branch through `cland verify`, and plants an over-budget test on a scratch branch to read the budget failure.

- [ ] C1. Hub test-time over the tests common to both runs is at least 800 s lower after the epic than before (predicted 980–1,270 s), and the full-run wall is at least 3 minutes shorter (predicted 4–5.5).
  - verified: qa-27 [qa] · run qa-2026-10-15-27-12 · 2026-10-15T07:44:58.141Z · commit 9ec1da30130fef1eda898f9d5e5031dcdf412457
- [ ] C2. The after census is posted with its `ps` + `lsof` + `pgrep` total and per-daemon-start figure against A-2021 (29,203; about 31 per start), with the daemon-start count unchanged within the suite's growth; the <12,000 and ≤13-per-start targets moved to T-448 (Coordinator amendment 2026-10-15, after T-392's census, A-2630/A-2631).
  - verified: qa-27 [qa] · run qa-2026-10-15-27-12 · 2026-10-15T07:44:58.141Z · commit 9ec1da30130fef1eda898f9d5e5031dcdf412457
- [ ] C3. Replayed on the 40 merges `83b74c6`..`f174d9c`, the selection runs full on at most 28 (37 before), with each remaining full row naming its deciding file (the bound T-388's C3 accepted, Coordinator 2026-10-14 12:33Z), and a Neovim-only branch's `cland verify` finishes in under 3 minutes, queue wait excluded (about 15 before).
  - verified: qa-27 [qa] · run qa-2026-10-15-27-12 · 2026-10-15T07:44:58.141Z · commit 9ec1da30130fef1eda898f9d5e5031dcdf412457
- [ ] C4. No doc, clause or skill tells a task session to run `cland verify all`; task runs use `cland verify` with no mode, and full suites are the Coordinator's integrated `dev` runs (D29).
  - verified: qa-27 [qa] · run qa-2026-10-15-27-12 · 2026-10-15T07:44:58.141Z · commit 9ec1da30130fef1eda898f9d5e5031dcdf412457
- [ ] C5. The three timer-bound tests are measured alone at the after head with the one-minute load against A-2450 (36.66, 21.26 and 33.90 s) and each falls by at least 50%, the timer no longer being their cost (human decision b622dab9, 2026-10-15 07:24Z; the < 5 s target for the 30-second schedule test moves to T-443); fake-harness tests run on the fast defaults, and every slow opt-in names its reason.
  - verified: qa-27 [qa] · run qa-2026-10-15-27-12 · 2026-10-15T07:44:58.141Z · commit 9ec1da30130fef1eda898f9d5e5031dcdf412457
- [ ] C6. `cland --help` loads at most 10 `hub/src` modules (139 today), each subcommand loads only its own closure, and a guard test fails when either grows.
  - verified: qa-27 [qa] · run qa-2026-10-15-27-12 · 2026-10-15T07:44:58.141Z · commit 9ec1da30130fef1eda898f9d5e5031dcdf412457
- [ ] C7. `hub/test/durations.json` exists; a test or file new to the manifest over 5 s or 60 s fails its run with a `duration budget` line, a known one that slows down or runs over budget is reported as a `duration regression` line without failing, and the suite report names the top regressions (human decision 225afa4b, 2026-10-15).
  - verified: qa-27 [qa] · run qa-2026-10-15-27-12 · 2026-10-15T07:44:58.141Z · commit 9ec1da30130fef1eda898f9d5e5031dcdf412457
- [ ] C8. Every assertion changed by this epic keeps its meaning: the orphan sweep, teardown ownership and pid-reuse detection stay proven in their own tests, and frame tests still run against a real hub over its socket.
  - verified: qa-27 [qa] · run qa-2026-10-15-27-12 · 2026-10-15T07:44:58.141Z · commit 9ec1da30130fef1eda898f9d5e5031dcdf412457
- [ ] C9. `hub/README.md` (Tests), `docs/agents/tests.md`, the Implementer and QA clauses and the `qa` skill describe the selection rules, the fast defaults and opt-ins, the budget and the manifest refresh.
  - verified: qa-27 [qa] · run qa-2026-10-15-27-12 · 2026-10-15T07:44:58.141Z · commit 9ec1da30130fef1eda898f9d5e5031dcdf412457

## Dogfooding

From the first merge on, the crew's task runs select by the wider rules, so most hub tasks skip the Neovim phase and Neovim tasks skip the hub phase. Every later stage of v0.1.2 waits less in the queue. The Coordinator relaunches the role sessions after the selection ticket merges, because clauses are fixed at launch. From the budget ticket on, the Coordinator refreshes `hub/test/durations.json` at each stage close of the release, and over-budget tests reach review with their reason.

## Constraints

- **Standing rules.** Every artifact, item, commit and doc is in English. Sub-agents never use the hub: the cland tools belong to the session that started them. Only `cland release` pushes to GitHub. Commit on the task branch `t/<id>-<slug>` in its worktree, push it to `origin`, the local territory, and reach `dev` only through `cland merge` and its verdict gate. Suites run through `cland verify`.
- **Frame-protocol-first tests stay meaningful.** Tests go through the hub's frame protocol first (a real hub, a real spoke, the CLI against a temporary project; `hub/test/harness.ts`) and the fake harnesses in `hub/test/fakes/` second, with the Neovim UI headless from the protocol's other side. Nothing here adds a seam inside the hub. Timing control uses the existing environment knobs. No test is deleted or weakened to save time. A change to an assertion keeps what it proves, and the reviewer checks this per changed assertion.
- **D25 review-first.** Request source review first. After a clear source verdict, `cland verify` runs at the exact reviewed head. A fix needs a new review before a new run.
- **D29.** Task runs verify only what the diff selects, never `cland verify all` unless the selection or the Coordinator asks. Full suites run as integrated `dev` runs per batch of about three merges, at every stage and epic close, and before release. D28 sends verification to droplets. Before/after measurements compare runs on the same executor and size.
- **The load rule.** Stress loops, repeated whole-file proofs and census runs are suite-weight. They start only when the verify queue has no holder and no waiter (T-204, incident of 2026-10-12 19:05Z). Single-file timings for criteria are taken on an idle machine and posted with the one-minute load.
- **Races exposed by faster fakes.** If a fast default exposes a race, it is a product defect: the Implementer reports it to `lead T-<n>` as a Bug with its size. Until the fix lands, the affected test may opt into the old timing with a comment naming the bug. A test never opts in silently.
- **ADRs.** 0003 (The hub is a per-project daemon): lifecycle proofs keep a real spawned daemon in this epic. 0002 (Tracker files are the source of truth): the duration manifest is a repository file, not hub state.
- **Risks.** Faster fakes can turn latent races into flakes, as load did in T-369 to T-383. Skipping fixture sweeps can hide a leak between tests, which the runner's phase sweep and the dedicated orphan tests still catch. A hub-only selection can miss a Neovim regression caused by an event-shape change, so D29's integrated batch run is the backstop. A budget judged on raw time can flap under load spikes, which an allowlist entry with a reason absorbs.
- **Order.** Inside v0.1.2 now, by the human's decision of 2026-10-14 12:15Z. It runs beside the release's other lanes. Its merges follow the batch-merge rule.

## Links

- Research: `docs/research/test-speed.md` on `research/test-speed` (55d4c5a8), artifact A-2346; question Q-384.
- Decisions: D25, D28 and D29 in `docs/spec/v0.1.md` §4.
- Runs: A-2299, A-2287, A-2249 and A-2198 (integrated logs); A-2021 (spawn census); A-1610 (T-279's before/after census).
- Code: `hub/src/suite-selection.ts`, `hub/test/harness.ts`, `hub/test/fakes/`, `hub/bin/cland.ts`, `hub/src/hub/daemon.ts` (start-up sweep), `hub/src/orphans.ts`, `hub/test/process-cleanup.ts`, `hub/src/hub/lock.ts` (`processStartedAsync`), `hub/test/run-suite.ts`, `hub/src/suite-shards.ts` (the manifest precedent), `hub/test/spawn-census.mjs`.
- Follow-on epic: "Test speed: structural" (R-294).
- ADRs: `docs/adr/0003-hub-is-a-per-project-daemon-from-the-bcas-core.md`, `docs/adr/0002-tracker-files-are-the-source-of-truth.md`.

## Plan

```yaml
stages:
  - name: selection, timing and lazy imports
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-388
      - - T-389
      - - T-391
  - name: the inspection diet and the duration budget
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-392
      - - T-390
```

## Comments

### coord · 2026-10-15T03:45:58.530Z

Coordinator, 2026-10-15 03:50Z.
- **The before run** is A-2450: integrated cover 27503044 at be45cda8, macOS local, 2040/2040, the last green integrated run before the epic's first merge (T-388 at 18:50Z on 2026-10-14).
- **The after run** will be the release cover on the dev tip after T-390, with the crew holding so that the machine is quiet, on the same Mac executor.
- **Amendments.** C2 is amended to the measured census, with the targets moved to T-448 after T-392's census (A-2630/A-2631). C7 follows the human's decision 225afa4b: only tests and files new to the manifest fail the budget.
- **Timing claims from the night.** These were taken as loaded A/B pairs, because the queue never idled: T-389 −26.27% over the harness files (A-2558), T-392 −63% inspection spawns in default-subscriptions.

### qa-27 · 2026-10-15T07:44:58.141Z

verdict: qa
result: clear
by: qa-27 [qa]
run: qa-2026-10-15-27-12
commit: 9ec1da30130fef1eda898f9d5e5031dcdf412457

Evidence: [A-2737 full captures](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2737-e-386-qa-full-evidence-qa-2026-10-15-27-12/README.md), [A-2738 report](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2738-e-386-qa-clear-measurements-cases-amendments-and-findings.md).

# E-386 QA evidence — qa-2026-10-15-27-12

**Clear under the amended brief.** Tested source S: `afe4d58a8c020d3a0b0eb8552082287914bda745`. Verdict dev tip: `9ec1da30130fef1eda898f9d5e5031dcdf412457`. Local macOS arm64, Node 24.21.0, Neovim 0.12.5. Brief `qa/briefs/T-386.md`, with decisions 1–12 and recorded amendments. Original failed assessments and the red census are retained, not erased.

## Before / after

| Measure | Before | Research prediction | After | Source |
| --- | --- | --- | --- | --- |
| Common hub test-time (1577 tests) | 4038.45 s | 980–1270 s lower | 2867.06 s; **1171.39 s saved** | M3 |
| Full-run wall | 1149.33 s; loaded, peak 24.85 | 4–5.5 min shorter | 918.72 s; quiet cover, peak 13.32; **230.61 s saved** | M2/M3, A-2450/A-2714 |
| ps + lsof + pgrep | 29,203 (A-2021) | <12,000, moved to T-448 | **23,684 lower bound**: 18,763 + 2,988 + 1,933 | M15 |
| Inspection spawns / daemon start | 30.94 (A-2021) | ≤13, moved to T-448 | 22.62 lower bound; 1047 starts | M15 |
| Daemon starts / executed test | 0.5136 historical A-2021; **0.6120 nearby A-2630** | unchanged within growth | **0.6094**, −0.42% against amended nearby baseline; 1718 tests | M15-amended |
| CLI help modules | 139 research; 56 at T-391 base | handful | 2 (version also 2; task list 13; hub status 16) | M8 |
| CLI help median, 20 calls | about 90 ms | ≤50 ms idle | **55.67623 ms**; load 3.05, queue empty; T-460 low follow-up | M8 |
| Three timer tests, alone | 36.6617 / 21.2620 / 33.8989 s | <5 s originally; amended ≥50% improvement | **12.5067 / 9.9453 / 5.2943 s**; schedule rerun 5.2654 s | M6; loads 2.16 / 2.33 / 2.52, rerun 3.41; all queues empty |
| Three timer tests, after cover | same A-2450 before values | record alongside alone values | 14.2876 / 12.2977 / 5.8424 s | M6-cover, A-2714 |
| 40-merge replay full/hub/nvim | 37 / 2 / 1 | about 22 / 13 / 5 | **26 / 9 / 5**; below amended 28 full limit | M4 |
| Neovim-only verification | about 15 min full | about 2 min | **95.416 s** including typecheck/publication, excluding 0.15 s queue wait; suite 88.56 s | M14, A-2718 |
| Full-cover budget overhead | none | <2 s | **23.22 ms**; M14 posted result 9.59 ms | M9/M14 |

## Case table

| Check | Result | Observation | Evidence |
| --- | --- | --- | --- |
| M0 | PASS | All five children closed/done and merged; both stages closed; nine criteria | [M0-ancestors.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2737-e-386-qa-full-evidence-qa-2026-10-15-27-12/M0-ancestors.txt) |
| M1 | PASS | Node 24.21.0; queue empty; worktree/lock/load baseline | [M1-baseline.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2737-e-386-qa-full-evidence-qa-2026-10-15-27-12/M1-baseline.txt) |
| M2 | PASS | A-2450 and A-2714 green local full covers; after code equals S | [M2-logs.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2737-e-386-qa-full-evidence-qa-2026-10-15-27-12/M2-logs.txt) |
| M3 | PASS | 1577 common tests; 1171.39 s test-time and 230.61 s wall saved | [M3-common.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2737-e-386-qa-full-evidence-qa-2026-10-15-27-12/M3-common.json) |
| M4 | PASS | 40 rows: 26 full / 9 hub-only / 5 nvim-only, versus 37/2/1 | [M4-after.md](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2737-e-386-qa-full-evidence-qa-2026-10-15-27-12/M4-after.md) |
| M5 | PASS | All five full-mode text hits classified; no task prescription | [M5-classification.md](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2737-e-386-qa-full-evidence-qa-2026-10-15-27-12/M5-classification.md) |
| M6 original | FAIL (preserved) | Schedule 5.294 s and 5.265 s exceed original 5 s bound | [M6-c-rerun.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2737-e-386-qa-full-evidence-qa-2026-10-15-27-12/M6-c-rerun.txt) |
| M6 amended | PASS | Human b622dab9: each improves ≥50%; observed 65.89%, 53.23%, 84.38% | [M6-amended-assessment.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2737-e-386-qa-full-evidence-qa-2026-10-15-27-12/M6-amended-assessment.json) |
| M7 | PASS | Fast defaults; all 30 slow opt-ins explain their reason | [M7-assessment.md](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2737-e-386-qa-full-evidence-qa-2026-10-15-27-12/M7-assessment.md) |
| M8 | PASS | Help/version 2 modules; task list 13; hub status 16; eager account import rejected | [M8-root.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2737-e-386-qa-full-evidence-qa-2026-10-15-27-12/M8-root.txt) |
| M9 | PASS | 191/191 files; 2028 timings; 173 reasoned allowances; 23.22 ms cover overhead | [M9-manifest.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2737-e-386-qa-full-evidence-qa-2026-10-15-27-12/M9-manifest.txt) |
| M10 | PASS | New 6 s test fails; same known test reports regression and exits 0 | [M10-known.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2737-e-386-qa-full-evidence-qa-2026-10-15-27-12/M10-known.txt) |
| M11 | PASS | 1+4+5+3+3+2 top-level proof tests pass; generated leak covered inside outer test | [M11-cover-crosscheck.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2737-e-386-qa-full-evidence-qa-2026-10-15-27-12/M11-cover-crosscheck.json) |
| M12 | PASS | All 18 absent names mapped; no new skip; inventories retain assertion meaning | [M12-mapping.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2737-e-386-qa-full-evidence-qa-2026-10-15-27-12/M12-mapping.json) |
| M13 | PASS | 5×4 documentation matrix including explicit pointers | [M13-matrix.md](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2737-e-386-qa-full-evidence-qa-2026-10-15-27-12/M13-matrix.md) |
| M14 | PASS | 403/403; nvim-only; 95.416 s excluding queue wait; posted budget lines match | [M14-assessment.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2737-e-386-qa-full-evidence-qa-2026-10-15-27-12/M14-assessment.json) |
| M15 original | FAIL (preserved) | 0.6094 starts/test versus original 0.56496 bound | [M15-assessment.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2737-e-386-qa-full-evidence-qa-2026-10-15-27-12/M15-assessment.json) |
| M15 amended | PASS (lower bound) | A-2630 nearby baseline: 0.6120→0.6094 (−0.42%); known T-447 caused red census | [M15-amended-assessment.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2737-e-386-qa-full-evidence-qa-2026-10-15-27-12/M15-amended-assessment.json) |
| M16 | PASS | Three own worktrees/two local branches removed; no QA process/lease; queue empty | [M16-cleanup.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2737-e-386-qa-full-evidence-qa-2026-10-15-27-12/M16-cleanup.txt) |
| M17 | PASS | Frozen-code diff empty; current dev recorded | [M17-build.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2737-e-386-qa-full-evidence-qa-2026-10-15-27-12/M17-build.txt) |

## Findings, by severity

**High:** none.

**Medium — known T-447, M15, hub/test/claude-code-sessions.test.ts:119 (helper :44, call :128).** `hq node hub/test/spawn-census.mjs run …` at S returned exit 1. The late-hook test timed out waiting for `coord: the clause turn's busy, then idle: not within 15000 ms`; test duration 17.159 s. The Coordinator identified this as the existing T-447 family, added at 06:07Z. No retry was made. The brief expressly accepts the census as a labelled lower bound; this does not assert that the census suite was green. See [failure detail](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2737-e-386-qa-full-evidence-qa-2026-10-15-27-12/M15-failures.txt) and [full census log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2737-e-386-qa-full-evidence-qa-2026-10-15-27-12/M15-suite.log).

**Low — T-460, M8 (deferred T-391 C3).** Twenty sequential `node hub/bin/cland.ts --help` calls measured 55.67623 ms median against the deferred 50 ms target, load 3.05 with the queue empty. C6's module-count/closure criteria pass. Filed by Coordinator as T-460. See [all timings](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2737-e-386-qa-full-evidence-qa-2026-10-15-27-12/M8-help.json) and [load](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2737-e-386-qa-full-evidence-qa-2026-10-15-27-12/M8-help-load.txt).

The original M6 five-second failure and original M15 historical-baseline failure remain in runs.jsonl. Their amended assessments use the same measurements, with no new test run.

## Census limits and the posted summary

The census was one human-queue attempt on clean detached S, admitted with no holder or waiters. It recorded 65,187 spawns, with zero incomplete final lines. Hub free: 37/37; hub machine: 1680/1681; total 1717 pass, one fail, 1718 executed. Neovim did not run after the red hub phase. Suite wall 1036.80 s, peak load 20.24, budget overhead 22.98 ms. No real droplet was created by this QA run; executor fixtures use fakes, and local cost is not applicable.

The totals are lower bounds: executor-* and other descendants replacing/stripping NODE_OPTIONS are not fully counted, and non-Node descendant spawns are outside the recorder. The missing Neovim phase also prevents treating this as a green full-suite baseline. A-2021 remains the inspection reference; A-2630 (1038 starts / 1696 executed tests = 0.6120283) is the authorized nearby start-count reference. This run is 1047 / 1718 = 0.6094296, below the amended 0.6732311 limit. See [aggregate](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2737-e-386-qa-full-evidence-qa-2026-10-15-27-12/M15-aggregate.json), [comparison](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2737-e-386-qa-full-evidence-qa-2026-10-15-27-12/M15-compare.md), [top helpers](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2737-e-386-qa-full-evidence-qa-2026-10-15-27-12/M15-top-helpers.json), and [nearby ratio](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2737-e-386-qa-full-evidence-qa-2026-10-15-27-12/M15-nearby.json).

Largest inspection sources: doctor/report.ts uses 7719 ps, 2832 lsof and 387 pgrep; process-cleanup.ts processes uses 6906 ps and 1527 pgrep; lock.ts processStarted uses 3503 ps. The inspection-total and per-start targets remain deferred to T-448.

T-390's owed post-restart confirmation is satisfied by A-2718: the delivered suite result contains all four regression notices and `suite budget overhead 9.59 ms`, exactly matching the log. The earlier green A-2714 was posted by the old hub and lacked those summary lines; its raw log has five regressions and 23.22 ms overhead. A-2713's new 92.983-second T-437 test failed on the budget before its allowance was added in fda3a637, corroborating new-identity enforcement.

## Criteria

C1 M2/M3; C2 M15-amended; C3 M4/M14; C4 M5; C5 M6-amended/M7; C6 M8; C7 M9/M10; C8 M11/M12; C9 M13. Every criterion passes the amended brief. Gate checks M0/M1/M16/M17 pass. Criterion marks verified by this run: **C1,C2,C3,C4,C5,C6,C7,C8,C9**.

## Deviations and amendments

- M0: Coordinator decision 8e30d9b6-e54c-47b9-8aad-411cf3bb30f1 accepts T-390's “Merged as 9eb60e82…” as an equivalent merge record, provided ancestry holds (confirmed). M14 still checks the owed posted-summary confirmation.
- Request 299dcc6a: the first posted summary after the hub restart is M14, not the supplied cover, whose old hub omitted budget summary lines. M9 checks cover log; M14 checks the posted lines.
- Criterion mapping at START: C3 bound is 28 and C5 requires only the schedule test under 5 seconds, the executor cases below their before timings; brief decisions 11–12 apply.
- Coordinator decision c0d6b5b0 (07:17:35Z): M11 judges unchanged predicates despite T-389's comment and OpenCode timing defaults; M12 uses source-diff mapping plus after-log passes for the 15 selection-rule renames, dynamic ISO-time name and T-433/T-253 splits; M9 counts all tracked *.test.ts under the three roots (191/191), fixing the literal pathspec. M6 stays FAIL pending the human's disposition; no verdict until Coordinator posts it.
- Coordinator decision 16d661dc (07:18:33Z): M11 runner count is 2 top-level tests covering all three named checks. suite-runner.test.ts:412–431 generates the deliberate-leak test; the outer test requires exit 0, cleanup output and ESRCH.
- Human decision b622dab9, relayed by Coordinator 9fc507da (07:24:20Z), amends C5 to at least 50% improvement for each of the three tests, alone with load posted. The schedule under-five-second target moves to T-443. Re-judge the recorded measurements; preserve original M6 FAIL. The separate help timing finding is filed as T-460.
- Coordinator decision 550259f3 (07:40:37Z): C2's daemon-start stability uses nearby-head A-2630 at cc44e9cb, with the same starts/executed-tests formula and 10% allowance. A-2021 still supplies inspection-total/per-start references; the older start ratio mixes growth from E-271/E-272. Preserve original M15 FAIL and re-judge these recorded counts. Census clause-turn timeout is known T-447 (Coordinator added :119 at 06:07Z), not a new finding.

M4's replay tables match A-2351/A-2352 row for row; only the baseline selector label differs (HEAD versus be45cda8). M13 follows the explicit process-fixture-notes pointer at docs/agents/tests.md:146 to the fast-default section in hub/README.md:2082–2091; the clauses and skill point to that test document.

Research and review inventories read: research/test-speed:docs/research/test-speed.md (55d4c5a8/A-2346), A-2458, A-2553, A-2560, A-2607, A-2626 and A-2662. Source-diff mapping accounts for the two later non-epic rename/split changes T-433 and T-253.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified, C8 verified, C9 verified.
