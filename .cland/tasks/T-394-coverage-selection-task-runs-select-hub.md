---
id: T-394
kind: task
title: "Coverage selection: task runs select hub tests by a function-level V8 coverage map from integrated dev runs, with full fallback on shared or unknown paths"
state: open
status: in progress
size: L
criterion_seq: 8
labels:
  - v0.1.3
  - hub
  - ready-for-agent
assignee: null
parent: E-387
blocked_by:
  - T-388
  - T-390
  - T-393
topic: topic-306
branch: t/T-394-coverage-selection-task-runs-select-hub
created: 2026-10-14T12:28:19.272Z
updated: 2026-10-15T17:19:05.031Z
---

## Summary

Even with wider package rules, a hub change runs the whole hub phase, because the CLI, the daemon and the harness each reach most of `hub/src`. An import graph therefore selects everything. Each integrated `dev` full run already happens under D29. This ticket makes those runs record function-level V8 coverage and publish a map from function ranges to test files. A task run then selects its changed tests, the tests covering the functions its diff touches, and the smoke baselines. The research estimates that a task's hub phase drops from about 13 minutes to 2–5.

## Parent

"Test speed: structural" (R-294), tracer bullet 2; research #7 (`docs/research/test-speed.md` §3.3(c), §3.3(b); §4 "Per-task verify under 5 min"). Waits for the in-process hub (01), which puts most hub code in the test file's own process and makes attribution per file straightforward.

**Open question for the human (research question 2), to be answered on this item before work starts:** is it acceptable for a task's selected run to pass and the next integrated batch run to catch the regression? And what replay bar must this ticket meet? **Proposal:** yes, since D29 already makes the batch run the backstop. The bar: no misses on the last 40 merges' own test changes, and every miss in a wider replay is listed with its cause.

## What to build

**Recording, on integrated `dev` full runs only.**

- The runner sets `NODE_V8_COVERAGE` to a per-test-file directory for each test file's process and for everything it spawns: daemons, the CLI, fakes, and spokes, whose environment `spawnSpoke` builds itself, so the variable is added there.
- With the in-process hub, most hub code runs in the file's own process. Lifecycle tests' daemons write under the same file's directory.
- At the end, a reducer turns the raw coverage into `{ file: { functionRange: [testFiles…] } }` for `hub/src/**`, at function granularity. File granularity selects everything, because top-level code runs on import.
- The map is posted as an artifact of the run and recorded with the run's head and tree.

**Selection, in `hub/src/suite-selection.ts`.** For a task diff that the package rules call `hub-only`, or `full` only because it touches hub files, `selectPackageSuite` reads the newest map whose head is an ancestor of the task's merge base. The selection is:

- the changed test files;
- the test files whose covered functions intersect the diff's hunks, mapped across the diff since the map's head;
- `HUB_SMOKE` and `NVIM_SMOKE`.

It falls back to today's rules, naming the reason, for protocol, contract, package, harness, fixture and runner changes, for a `hub/src` file absent from the map, for a map older than `[verification] coverage_max_age` (default 2 days), and for a missing map. The selection mode is `hub-selected`, with its deciding functions in the report. The Neovim side keeps the package rules.

**The replay.** `hub/test/selection-replay.ts` (from quick-01) gains a coverage mode. Over the last 40 merges, it computes each merge's selection against the map of its time, or the nearest one, and checks whether the merge's own changed or added test files, and the tests that failed in its history, are inside the selection. It prints the selected share of hub test-time per merge.

## Acceptance criteria

- [x] C1. The human's answer to the miss-tolerance and replay-bar question is recorded on this item before the first commit.
  - done: impl-394 · 2026-10-15T16:23:12.810Z
  - verified: rev-30 [reviewer] · run rev-20261015-394-source · 2026-10-15T16:54:02.463Z · commit f0394340be84dc60bff576602d0585a7d35b2946
- [x] C2. An integrated `dev` full run posts a function-level coverage map artifact naming its head and tree, and spokes, daemons, the CLI and fakes all contribute to it, proven on a fixture project.
  - done: impl-394 · 2026-10-15T16:48:01.117Z
- [ ] C3. A task diff touching one function in `hub/src/hub/` selects its changed tests, the covering test files and the smoke baselines, and the report names the deciding functions.
  - failed: rev-30 [reviewer] · 2026-10-15T17:19:05.031Z · note selectPackageSuite omits its supplied env at parseConfig, so valid instance config silently widens to full; executor-run mode regression in A-3204.
- [x] C4. Protocol, contract, package, harness, fixture and runner changes, unknown files, stale maps and a missing map fall back to the package rules with their reason, each proven by a test.
  - done: impl-394 · 2026-10-15T16:48:04.300Z
- [x] C5. Replay (Coordinator amendment 2026-10-15 16:44Z): pre-merge, the replay tool runs on fixture histories and reports per-merge selection, misses and selected share, falling back explicitly where a historical map is missing; the real last-40 replay against the C1 bar is judged after merge at E-387's stage-2 close, from the first integrated dev map, and its table is posted on the item.
  - done: impl-394 · 2026-10-15T16:48:05.818Z
- [x] C6. Measured (Coordinator amendment 2026-10-15 16:44Z): pre-merge, a fixture proves a one-function hub/src/hub/ diff selects a subset and reports its duration line; the real under-5-minute default-executor run is judged after merge at E-387's stage-2 close, once a dev coverage map exists, with the duration line posted.
  - done: impl-394 · 2026-10-15T16:48:07.429Z
- [x] C7. Measured (Coordinator amendment 2026-10-15 16:44Z): pre-merge, a fixture proves coverage recording runs and publishes within an integrated run; the at-most-15% wall-time overhead is judged after merge at E-387's stage-2 close against the integrated run before at a nearby head.
  - done: impl-394 · 2026-10-15T16:48:08.924Z
- [x] C8. `hub/README.md` (Tests), `docs/agents/tests.md` and the Implementer clause describe `hub-selected`, the map, its age limit and the fallbacks.
  - done: impl-394 · 2026-10-15T16:48:10.469Z
  - verified: rev-30 [reviewer] · run rev-20261015-394-source · 2026-10-15T16:54:02.463Z · commit f0394340be84dc60bff576602d0585a7d35b2946

## Comments

### coord · 2026-10-15T15:36:22.142Z

Human decision on research question 2, 2026-10-15 at 15:36Z (ask 82732199, answer b855ccca): the proposal is accepted as written.
(1) A regression that a task's selected run misses and the next integrated batch run catches is acceptable; D29 makes the batch the backstop.
(2) Replay bar: zero misses on the last 40 merges' own changed or added test files, and every miss in a wider replay listed with its cause.
C1 and C5 use this bar.

### coord · 2026-10-15T15:36:57.654Z

Coordinator decision on evidence sequencing (2026-10-15 15:37Z). C5, C6 and C7 need a real dev coverage map and an integrated run, which only exist after this merges and the hub restarts. So the pre-merge gate is fixtures (capture, publication, hunk mapping, fallbacks, conservative replay) plus C1–C4. C5–C7 are judged at the E-387 stage-2 close: the Coordinator runs the dev coverage capture, the last-40 replay against the recorded bar, the one-function under-5-min probe and the at-most-15% comparison, and posts each result here. A miss is fixed forward inside E-387. This follows the T-393 C5 and T-395 C6/C7 precedent.

### impl-394 · 2026-10-15T15:50:10.683Z

Implementation draft prepared after C1 human decision was recorded. Source typecheck passes; no local tests have run because Coordinator's restart-cover hold is still active. Draft covers per-file V8 attribution and function reduction, integrated local/droplet/sharded transport and artifact publication, ancestor/age/hunk-based hub-selected admission, selected cache identity, coverage replay and docs/clauses. Confirmed public seams have fixture tests drafted, including actual copied CLI/daemon/spoke/fake process entries and a selected run catching a changed return value. Evidence/design artifact A-3135. C5–C7 remain judged at E-387 stage-2 close per Coordinator decision; no measured criterion claimed. Pending restart notice to run fixtures, correct findings and request source review.

### rev-30 · 2026-10-15T16:54:02.463Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-394-source
commit: f0394340be84dc60bff576602d0585a7d35b2946
scope: full

Source review T-394 at f0394340be84dc60bff576602d0585a7d35b2946; fixed point 02dcd993ad8b36fea4f3fa8005beb451a206eb42.
Standards: no high/medium/low findings. Reviewed directly under the Reviewer no-delegation clause. Capture/selection responsibilities are in suite-coverage.ts; existing executor, artifact, queue and package-shard paths carry the feature. No Reviewer tests, edits or provider calls.
Spec: no high/medium/low findings. Per-file bootstrap attribution retains descendant NODE_V8_COVERAGE, including explicit spoke environments. The reducer excludes module import ranges, retains untested function ranges, and attributes CLI/daemon/spoke/fake receipts. Only clean integrated full dev runs enable recording; local/remote/sharded output is checked against head/tree and published durably before pointer installation. Task runs cannot refresh the map.
Selection checks ancestor, age, source/function coverage, intervening hunk mapping and missing tests; shared infrastructure and unsupported/top-level/unknown changes fall back with reasons. Changed tests and hub/Neovim smoke remain; a hub import requiring full Neovim preserves that phase. Selected test list and Neovim phase participate in cache identity.
Replay fixtures and conservative last-40 evidence A-3179 were read. Zero own-test misses; three wider explorer-card misses are explicitly listed, classified T-516 and accepted by Coordinator dab69ebf. Missing historical maps fall back explicitly, retrospective maps are labelled, shares use duration-manifest estimates rather than invented historical wall time. Source fixture coverage includes capture/publication, actual selected execution, hunk mapping, fallback and cache changes.
Criteria: C1 verified from recorded human answer 15:36:22Z before first implementation commit 382c9c92 at 16:23Z. C8 verified in hub/README.md, docs/agents/tests.md and both live/default Implementer clauses. C2–C7 remain unverified pending exact-head post-source suite evidence. Coordinator 7010a2e1 amends C5–C7 to pre-merge fixture obligations; real last-40 map replay, under-five-minute measurement and <=15% overhead remain required at E-387 stage-2 close. A-3179's 100 targeted cases and 1.53s selected fixture do not establish those production measurements.
Source clear permits the requested exact-head no-mode verification. No final gate claim.

Criteria: C1 verified, C8 verified.

### rev-30 · 2026-10-15T17:19:05.031Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261015-394-linux-first
commit: f0394340be84dc60bff576602d0585a7d35b2946
scope: evidence

T-394 post-source evidence review not clear at f0394340be84dc60bff576602d0585a7d35b2946. A-3204 / 8970a57f: Linux c-8, exit 1, 1804 pass / 2 functional failures / 3 skips, plus two hard duration-budget failures; Neovim not reached.
Standards — medium: hub/src/suite-selection.ts:139 omits the supplied owning env when calling parseConfig. selectPackageSuite(cwd, requested, env) uses that env for Git but parseConfig defaults back to process.env. An instance config valid under CLAND_TEST_EXECUTOR_MARGIN_MS is rejected and silently widened to full; A-3204:4077–4118 shows executor-run.test.ts:40 expected hub-only but gets full with lifetime-validation error. Preserve the existing instance-env seam, and cover this call through selectPackageSuite. C3 fails for this selection regression.
Spec/runtime — medium: hub/test/durations.json (allow entries for hub/test/suite-coverage.test.ts:14): the new real CLI/daemon/spoke/fake coverage fixture passes functionally but takes 6.611s and is absent from allow (A-3204:5867), so the task's own added fixture makes full verification fail. Record its measured lifecycle allowance using the existing policy, preserving assertions and bounds.
Aside for lead, Bugs / S: hub/test/suite-close.test.ts:82 sees one active lease (watchdogAlive=true) after successful two-shard result, settled ledger and empty provider listing; expected [] (A-3204:4122–4149). No exact existing signature found. This assertion is untouched; root cause not established. Please classify/file separately, rather than treating it as an accepted known flake without evidence.
Known shared budget: rule-sessions stopped-process/live-delivery case takes 5.592s; Coordinator-posted 051db745 is the approved shared allowance to take at the next head change. Source clear previously missed the config env handoff; this runtime result supersedes it. C1/C8 prior source facts stand; C2–C7 not finally verified. Requester agrees to fix own env regression, add selector coverage and measured allowance, then request fresh source review. No unchanged retry. Coordinator bdda2243's restart/submission hold remains in force. No Reviewer tests, edits or provider calls.

Criteria: C3 failed (selectPackageSuite omits its supplied env at parseConfig, so valid instance config silently widens to full; executor-run mode regression in A-3204.).
