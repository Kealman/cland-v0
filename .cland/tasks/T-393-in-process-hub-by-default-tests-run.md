---
id: T-393
kind: task
title: "In-process hub by default: tests run against a hub served in the test process over its real socket, a spawned hub stays only for lifecycle tests, and the top 20 files move first"
state: open
status: review
size: L
criterion_seq: 9
labels:
  - v0.1.3
  - hub
  - ready-for-agent
assignee: null
parent: E-387
blocked_by:
  - T-390
  - T-392
topic: topic-273
branch: t/T-393-in-process-hub-by-default-tests-run
created: 2026-10-14T12:28:19.095Z
updated: 2026-10-15T14:35:10.505Z
---

## Summary

911 tests start a separate hub process through `cland hub start`. They take 81% of test-time, at a median of 2.38 s, against 0.38 s for the same frames against an in-process hub. By the human's decision (a) of 2026-10-14 12:20Z, tests use an in-process hub by default, and a real hub process is kept only for lifecycle tests. This ticket adds the fixture, draws the lifecycle line, and moves the top 20 files by test-time, with validation duplicates and adapter edge cases below the frame. The research estimates 250–620 s of test-time for the moved set, depending on how much the inspection diet has already taken.

## Parent

"Test speed: structural" (R-294), tracer bullet 1; research #6 (`docs/research/test-speed.md` §3.1 variant 3.1b, §3.8; §2 point 1). **Decided (a), 2026-10-14 12:20Z:** in-process by default, with a real process only for start, stop, signals, crash, restart and watchdog tests. The shared-hub-per-file option is rejected and is not built.

## What to build

**The fixture, `projectHub(t, root, env?)` in `hub/test/harness.ts`.**

- It calls `serveProject(root, { … })` (`hub/src/hub/daemon.ts:56`) inside the test process and writes the discovery file as the daemon does. `cland` subprocesses, `spawnSpoke` and `connectUi` / `connectWsUi` then find the hub through the same socket and WebSocket, unchanged.
- `serveProject` gains an `env` option for what `projectSessions` and the daemon read from `process.env` today: adapter timings, the `CLAND_TEST_*` knobs, `DIGITALOCEAN_TOKEN`, `CLAND_EXECUTOR_STATE`. That lets two hubs in one file differ. It is a parameter on an existing entry point, not a new seam; the review request names it under the standing rule.
- Cleanup stops the hub through its own `stop()`, then fails the test if it left active handles, timers, listeners on `process` or child processes behind. The check uses `process.getActiveResourcesInfo()` and the ownership table.
- Process-global effects of the daemon path become per-instance or are skipped when served in-process: signal handlers, `process.exitCode`, the hub lock's own-pid identity, the start-up orphan sweep (already off for fixtures after quick-05). The Implementer lists each one found.

**The lifecycle line.** A test keeps `startDaemon` when its assertion is about the hub process: start, stop, a signal, crash or restart, the lock, the discovery file, the pid, the orphan sweep, the watchdog, or a CLI command's behaviour with the hub down or unreachable. The research's heuristic (292 tests, 1,199 s: names and bodies with restart, stop, kill, pid, lock, signal or orphan) is the starting list. The Implementer posts the final per-file list with one line per kept test. `daemon.test.ts`, `orphan-sweep-lock.test.ts`, `cli-identity.test.ts` and the restart tests stay spawned as a whole; `orphan-servers.test.ts` keeps its sweep and doctor cases spawned.

**The top 20 files**, from the research's table, move to `projectHub` except their lifecycle tests: `suite.test.ts`, `merge.test.ts`, `executor-safety.test.ts`, `orphan-servers.test.ts` (non-lifecycle cases only), `release.test.ts`, `codex-adapter.test.ts`, `executor-run.test.ts`, `opencode-adapter.test.ts`, `claude-code-adapter.test.ts`, `stage-qa.test.ts`, `executor-prepare.test.ts`, `session-usage.test.ts`, `session-stop-races.test.ts`, `session-resume.test.ts`, `subscription-hygiene.test.ts`, `territory-cli.test.ts`, `accounts.test.ts`, `default-subscriptions.test.ts` and `crew-launch.test.ts`. `suite-runner.test.ts` has no daemon. The rest of the 911 follow in a follow-up the Coordinator files at merge, with the remaining list.

**Below the frame (§3.8).**

- The 141 validation-named spawned-daemon tests (327 s: refuse, reject, invalid, malformed, must, requires) move with their files. Where a file has several cases of one refusal family, one stays a frame test and the rest become direct calls on the dispatcher or the tracker in the same file.
- The adapter files keep one frame test per verb (launch, inject, turn, stop, resume). Their parsing and edge cases move to adapter unit tests with a fake transport, in `hub/src/adapters/*.test.ts`.
- `merge.test.ts` (9), `artifacts.test.ts` (8), `tracker-levels.test.ts` (7), `release.test.ts` (5) and `codex-adapter.test.ts` (5) hold most of these cases.

**Measure.** For each moved file: whole-file time on an idle machine before and after, and daemon starts before and after (from the census or the hub-start count in the file's log). Post the table.

## Acceptance criteria

- [x] C1. `projectHub` serves a project in the test process; `cland` subprocesses, spokes and UI clients reach it over its real socket and WebSocket with no change to their code, proven by a tracer test that runs the same frames against `projectHub` and `startDaemon`.
  - done: impl-393 · 2026-10-15T08:08:37.623Z
  - verified: rev-23 [reviewer] · run rev-2026-10-15-393-9 · 2026-10-15T12:52:43.534Z · commit 36ecea1f6f97445efc149b47b8ba2a7e89b7c89b
- [x] C2. Cleanup fails a test whose in-process hub leaves handles, timers, `process` listeners or child processes, proven by a test that leaks one on purpose.
  - done: impl-393 · 2026-10-15T09:19:34.574Z
  - verified: rev-23 [reviewer] · run rev-2026-10-15-393-9 · 2026-10-15T12:52:43.534Z · commit 36ecea1f6f97445efc149b47b8ba2a7e89b7c89b
- [x] C3. `serveProject` takes its environment as an option, and two in-process hubs in one file with different adapter timings behave independently, proven by a test.
  - done: impl-393 · 2026-10-15T13:18:02.629Z
- [x] C4. The lifecycle list is posted per file; every test that still calls `startDaemon` or `cland hub start` in the 20 files is on it, and none of the others is.
  - done: impl-393 · 2026-10-15T08:08:39.537Z
  - verified: rev-23 [reviewer] · run rev-2026-10-15-393-2 · 2026-10-15T09:22:40.699Z · commit 519fc215a8f8b84572f079ba0b5a1b35ed8072fa
  - verified: rev-23 [reviewer] · run rev-2026-10-15-393-4 · 2026-10-15T10:16:09.752Z · commit c97f0056f9d161148d003314a888f1bff0d524f0
  - verified: rev-23 [reviewer] · run rev-2026-10-15-393-7 · 2026-10-15T11:24:53.220Z · commit 36ecea1f6f97445efc149b47b8ba2a7e89b7c89b
  - verified: rev-23 [reviewer] · run rev-2026-10-15-393-9 · 2026-10-15T12:52:43.534Z · commit 36ecea1f6f97445efc149b47b8ba2a7e89b7c89b
  - verified: rev-23 [reviewer] · run rev-2026-10-15-393-11 · 2026-10-15T13:17:53.106Z · commit bedfcef31450af863322d26576f6df22033edc66
- [x] C5. Measured (Coordinator amendment 2026-10-15 09:03Z): the 20 files' summed whole-file time falls by at least 20%, judged after merge from E-387's stage-1 close integrated cover on the Mac against the v0.1.2 release cover A-2714 (both quiet integrated runs), per file from the runner's records; pre-merge, the available paired samples are posted without a claim, because local fallbacks invalidated every pair while remote_budget was 2.
  - done: impl-393 · 2026-10-15T09:04:06.375Z
  - verified: rev-23 [reviewer] · run rev-2026-10-15-393-9 · 2026-10-15T12:52:43.534Z · commit 36ecea1f6f97445efc149b47b8ba2a7e89b7c89b
- [x] C6. Measured (Coordinator amendment 2026-10-15 09:03Z): the migration's daemon-start delta is posted against the fresh census A-2737 (the 20 files 421 → 145, a projected 772 per run against 1047); the under-600 target moves to T-466, the next files' migration.
  - done: impl-393 · 2026-10-15T09:04:07.098Z
  - verified: rev-23 [reviewer] · run rev-2026-10-15-393-9 · 2026-10-15T12:52:43.535Z · commit 36ecea1f6f97445efc149b47b8ba2a7e89b7c89b
- [x] C7. Each refusal family and each adapter verb keeps at least one frame test, and the moved validation cases keep their asserted error codes and messages.
  - done: impl-393 · 2026-10-15T08:08:40.735Z
  - verified: rev-23 [reviewer] · run rev-2026-10-15-393-2 · 2026-10-15T09:22:40.699Z · commit 519fc215a8f8b84572f079ba0b5a1b35ed8072fa
  - verified: rev-23 [reviewer] · run rev-2026-10-15-393-4 · 2026-10-15T10:16:09.752Z · commit c97f0056f9d161148d003314a888f1bff0d524f0
  - verified: rev-23 [reviewer] · run rev-2026-10-15-393-7 · 2026-10-15T11:24:53.220Z · commit 36ecea1f6f97445efc149b47b8ba2a7e89b7c89b
  - verified: rev-23 [reviewer] · run rev-2026-10-15-393-9 · 2026-10-15T12:52:43.535Z · commit 36ecea1f6f97445efc149b47b8ba2a7e89b7c89b
  - verified: rev-23 [reviewer] · run rev-2026-10-15-393-11 · 2026-10-15T13:17:53.106Z · commit bedfcef31450af863322d26576f6df22033edc66
- [x] C8. No assertion changes its meaning: the review request lists every changed assertion with what it still proves, and no test is deleted.
  - done: impl-393 · 2026-10-15T08:08:41.391Z
  - verified: rev-23 [reviewer] · run rev-2026-10-15-393-2 · 2026-10-15T09:22:40.700Z · commit 519fc215a8f8b84572f079ba0b5a1b35ed8072fa
  - verified: rev-23 [reviewer] · run rev-2026-10-15-393-4 · 2026-10-15T10:16:09.753Z · commit c97f0056f9d161148d003314a888f1bff0d524f0
  - verified: rev-23 [reviewer] · run rev-2026-10-15-393-7 · 2026-10-15T11:24:53.220Z · commit 36ecea1f6f97445efc149b47b8ba2a7e89b7c89b
  - verified: rev-23 [reviewer] · run rev-2026-10-15-393-9 · 2026-10-15T12:52:43.535Z · commit 36ecea1f6f97445efc149b47b8ba2a7e89b7c89b
  - verified: rev-23 [reviewer] · run rev-2026-10-15-393-11 · 2026-10-15T13:17:53.106Z · commit bedfcef31450af863322d26576f6df22033edc66
- [x] C9. `hub/README.md` (Tests) and `docs/agents/tests.md` describe `projectHub` as the default, the lifecycle line, and when a new test may use `startDaemon`.
  - done: impl-393 · 2026-10-15T08:08:41.843Z
  - verified: rev-23 [reviewer] · run rev-2026-10-15-393-2 · 2026-10-15T09:22:40.700Z · commit 519fc215a8f8b84572f079ba0b5a1b35ed8072fa
  - verified: rev-23 [reviewer] · run rev-2026-10-15-393-4 · 2026-10-15T10:16:09.753Z · commit c97f0056f9d161148d003314a888f1bff0d524f0
  - verified: rev-23 [reviewer] · run rev-2026-10-15-393-7 · 2026-10-15T11:24:53.221Z · commit 36ecea1f6f97445efc149b47b8ba2a7e89b7c89b
  - verified: rev-23 [reviewer] · run rev-2026-10-15-393-9 · 2026-10-15T12:52:43.535Z · commit 36ecea1f6f97445efc149b47b8ba2a7e89b7c89b
  - verified: rev-23 [reviewer] · run rev-2026-10-15-393-11 · 2026-10-15T13:17:53.106Z · commit bedfcef31450af863322d26576f6df22033edc66

## Comments

### impl-393 · 2026-10-15T07:23:59.103Z

Fixture/env implementation and initial migrations are in progress. The projectHub tracer now passes (4 tests): production CLI/socket/spoke parity, independent timings in simultaneous hubs, and a deliberate retained-timer cleanup failure. Audit artifact posted in topic-273. Before measurements are paused while qa-E386-census occupies the local slot; coordinating test windows and the T-395 split mapping with impl-395.

### impl-393 · 2026-10-15T08:08:20.559Z

Implementation committed through dc08042a and merged latest origin/dev. Audit A-2751 names environment/log parameters, global-effect isolation, cleanup ownership, native Undici clock exclusion and every changed assertion meaning; lifecycle A-2745; assertion identities A-2744 (no removed tests). New fixture/freshness regressions, OpenCode units, process-started, accounts, crew launch and session-stop-races pass targeted. Measurement restarted at 08:08Z with empty local slot; recorder rejects holder-overlapped samples. Fresh census cross-tab A-2756 proves selected20 have420 of1047 starts, so even deleting all selected starts leaves627; exact retained total and 21st-plus candidates will follow for Coordinator C6 decision.

### rev-23 · 2026-10-15T09:11:30.741Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-15-393-1
commit: 337aaa40e0ede1581df745ef1e8dbc875e734c5f
scope: full

Medium — hub/test/harness.ts:336/348/535-536 and hub/test/hub-resources.ts:16: only startup is wrapped in resource scope; returned direct dispatcher requests execute outside it, leaving their timers/children unattributed. Carry scope through direct calls and add request-time deliberate leak proof.
Medium — hub/src/executor/droplet/run.ts:54: parseConfig omits this.#env, so explicit short margin accepted by hub/acquire is lost at delivery.
Medium — hub/src/hub/suites.ts:215/233/312/316/473 and verification-tree.ts:14: candidateTree Git still uses process.env, unlike the owning hub's other Git operations. Thread env while preserving private index override and prove independent Git environments.
A-2811 details full Standards/Spec review. No further lifecycle/assertion blocker found; C5/C6 judged under directly read 6f89040c amendments (data-only pre-merge timing; 772 lower-bound projection, under600 T-466). T-464 isolation approved in 72d72fa1; T-395 reconciliation remains required. No full run at this head; fixes need new source review.

Criteria: C2 failed (Direct dispatcherUi requests bypass the fixture AsyncLocalStorage resource scope, so request-time leaked resources evade strict cleanup checks.), C3 failed (DropletRun config reparse and Suites candidateTree Git checks still use host environment rather than the owning hub environment.).

### impl-393 · 2026-10-15T09:21:22.191Z

A-2815 records corrections to all three A-2811 findings with red/green repros. Fix22001d4b plus latest origin/dev tracker-only merges is pushed as519fc215a8f8b84572f079ba0b5a1b35ed8072fa. C2 scopes direct dispatcher open/receive/closed; C3 threads env into delivery parsing and all candidateTree Git checks while preserving private index. Targeted executor-run18, project-hub5, provenance1, merge50, release18 pass, plus typecheck/shard lint. Assertion audit2397→2431, no removed identities; correction is additive. No full verification before renewed source review. C5/C6 rulings and T-395110-identity reconciliation remain as A-2806.

### rev-23 · 2026-10-15T09:22:40.700Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-15-393-2
commit: 519fc215a8f8b84572f079ba0b5a1b35ed8072fa
scope: delta

Corrected source clear; no high/medium finding remains. Fixture dispatcher facade scopes open/receive/closed; added direct-request retained timer now fails cleanup as required. DropletRun config reparse uses owning env; all five candidateTree calls do too, preserving private index override. Strengthened real remote fixture and native conflicting-env/index test preserve prior assertions while proving margin, generated timeout, no fallback/cache reuse, unchanged host env/index. A-2815 records all three red/green proofs and project5/executor18/native1/merge50/release18 targeted passes, typecheck/shards green. Incoming merges are tracker only. A-2816 records this delta; A-2811's full review otherwise applies.
C4/C7/C8/C9 verified from source. C1-C3 and final C5/C6 evidence await exact-head gate; performance marks must retain 6f89040c amendments (data-only pre-merge timing; post-merge20% owed; 772 lower-bound projection; under600 T-466). T-395 second-merger reconciliation/110 identities remains required. Submit no-mode cland verify without executor override at this head; changed integration needs new review.

Criteria: C4 verified, C7 verified, C8 verified, C9 verified.

### rev-23 · 2026-10-15T09:47:36.312Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-15-393-3
commit: 519fc215a8f8b84572f079ba0b5a1b35ed8072fa
scope: evidence

Medium — hub/test/claude-code-adapter.test.ts:389: signed-out latch count is 3 instead of 2, so exact-head gate ce86de7b/A-2838 is red. This is the same assertion/signature tracked by T-461. T-393 changes other tests in this file to projectHub, but leaves this spawned lifecycle test body unchanged; the receipt alone does not establish a new product cause.

At source-reviewed 519fc215a8f8b84572f079ba0b5a1b35ed8072fa, Linux c-8 lon1 gate selected full but stopped after hub: 1730 tests, 1726 pass, one fail, three macOS-only platform skips, exit 1. Neovim was not reached. Runtime 1229.33s; droplet lifetime 1321s, cost $0.0917. Branch tip remains unchanged. The source corrections for scoped resource attribution and owning-hub environment remain reviewed; successful targeted/native results do not replace the incomplete gate.

C1–C3 remain unverified pending accepted same-head verification. C4/C7/C8/C9 source marks remain current. No criterion implementation is failed solely for this shared assertion. C5/C6 final evidence remains pending under Coordinator amendments: pre-merge timing is data-only, post-merge 20% comparison owed; 772 is a lower-bound projection and under-600 is T-466. Retain T-395 second-merger reconciliation requirement.

Await lead disposition for T-461 adoption or any explicitly authorized unchanged retry; no automatic retry is established here (the file is touched and no isolated five-pass evidence was supplied). No Reviewer test or source change.
Review evidence: A-2839.

### impl-393 · 2026-10-15T09:47:50.804Z

Configured exact-head gate ce86de7b/A-2838 failed solely the unchanged spawned signed-out Claude latch (3 vs2), matching shared T-461. Source519fc215 stays unchanged. Reviewer evidence A-2839 records pending runtime/final criteria. Coordinator b711ef36 directs hold until T-461 merges, then cherry-pick only its posted commit, delta review and one verify; no unchanged rerun. Claim retained; no source edits/new run.

### impl-393 · 2026-10-15T10:15:19.815Z

Adopted only merged T-461 commit5366e92f as explicitly directed in35da79b7. Pushedc97f0056f9d161148d003314a888f1bff0d524f0; delta is10 additive lines in the retained spawned signed-out case, draining the observed pre-latch agents child and asserting no later poll admission. Claude whole file9/9 passes (A-2863). Delta review requested before one new configured verify. Other T-393 source remains519fc215/A-2816; no unrelated dev changes adopted.

### rev-23 · 2026-10-15T10:16:09.753Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-15-393-4
commit: c97f0056f9d161148d003314a888f1bff0d524f0
scope: delta

Delta source clear at c97f0056f9d161148d003314a888f1bff0d524f0; no high/medium finding remains.

Against 519fc215/A-2816, exactly ten additive lines in the retained spawned lifecycle case in claude-code-adapter.test.ts. Stable patch ID 13d6111eba70efbbfbaaec25cd09c1c9e4f18042 matches merged T-461 5366e92f. This follows directly read Coordinator b711ef36's isolated-pick instruction; there is no other incoming dev or production/fixture change.

The shared test now observes and drains an already-admitted pre-latch child before counting, retains exact no-new-call checks across restart and adds child-PID identity checks. Refusal/recovery assertions and test identities remain. A-2863 whole file passes 9/9 without failures/skips/cancellations (35.668s; latch 5.227s). Source attribution/env corrections and lifecycle/refusal/assertion audits remain as A-2816/A-2811; T-395 second-merger reconciliation remains required.

C4/C7/C8/C9 source verification refreshed at this head. C1–C3 and final amended C5/C6 await accepted exact-head verification. Retain ce86de7b/A-2838's red Linux result and its T-461 cause. C5 remains data-only before merge, with the 20% quiet Mac integrated comparison owed after merge; C6 retains the 772 lower-bound projection and under-600 follow-up T-466. No speed or measured census claim added by this test-only delta.

Submit one no-mode verify without executor override at this reviewed head; standing Coordinator cb6eaf4c applies only if known-flake and own-touched-files-green conditions are met. No Reviewer tests or edits.
Review evidence: A-2867.

Criteria: C4 verified, C7 verified, C8 verified, C9 verified.

### impl-393 · 2026-10-15T10:41:28.056Z

Second Linux gatefc85d6ae/A-2886 at source-clearc97f0056 failed solely unchanged claude-code-sessions.test.ts:251 initial clause injection wait, exact T-447 C2. All T-393 touched tests passed (1726 pass/1 fail/3 platform skips); Neovim not reached. Applying Coordinator standing rulecb6eaf4c because failed test file is untouched: submitted one same-head local gate6b2bda6d-e643-4580-826a-4c55a046e272, queue position2. No source edits/head change. Retain both Linux red receipts with T-461 adoption history; Reviewer receives the local result.

### rev-23 · 2026-10-15T10:41:32.233Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-15-393-5
commit: c97f0056f9d161148d003314a888f1bff0d524f0
scope: evidence

Medium — hub/test/claude-code-sessions.test.ts:251: clause injection is not observed within 15s (A-2886:3880–3886), exactly the known T-447 C2 fixture. This file is unchanged between T-393's base 045d24fa and c97f0056; T-393's touched test files pass in the same Linux run. The adopted T-461 case also passes.

Configured Linux gate fc85d6ae/A-2886 selected full but stopped before Neovim: 1730 hub tests, 1726 pass, one fail, three platform skips, exit 1 at unchanged source-clear c97f0056f9d161148d003314a888f1bff0d524f0. Suite 1155.79s, c-8 lon1 lifetime 1242s, cost $0.0862. Positive touched-file Linux proof is distinct from the overall red result.

Standing Coordinator cb6eaf4c directly authorizes one unchanged-head local merge gate when the only droplet failures are named known flakes and touched files pass. This receipt meets that condition via T-447; no source change or renewed source review is needed to submit that one local gate. C1–C3 and final amended C5/C6 remain unverified until its accepted result; C4/C7/C8/C9 source marks remain current.

Final evidence must cite this red fc85d6ae/A-2886/T-447 and prior red ce86de7b/A-2838/T-461, source-reviewed isolated T-461 adoption, and the authorized local receipt. Preserve C5 post-merge timing obligation, C6 772 lower-bound projection/under-600 T-466, and T-395 second-merger reconciliation. No Reviewer tests or edits.
Review evidence: A-2887.

### rev-23 · 2026-10-15T11:22:42.498Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-15-393-6
commit: c97f0056f9d161148d003314a888f1bff0d524f0
scope: evidence

Medium — nvim/test/shell.test.ts startup screen wait: A-2930 contains 83 occurrences of 'screen never showed the workbench on General within 10000 ms'. Treat this as shared-pattern evidence, not 83 independently diagnosed product bugs.
Medium — nvim/test/qa.test.ts:94 (THREAD-001/002): QA is INCONCLUSIVE at the 'first local day' wait; captured screen starts Fri 9 Oct while older fixture material is missing. Both signatures are consistent with the stale-date/archive family addressed by T-487, which this head has not adopted; confirm coverage with targeted reproduction before attributing every failure to it.

Local gate 6b2bda6d/A-2930 at c97f0056f9d161148d003314a888f1bff0d524f0 exits 1 after reaching both packages: 2117 tests, 2031 pass, 86 fail, zero skips/cancellations. Hub completed successfully; the gate is blocked by Neovim failures. Full runtime 1892.95s; Neovim 882.26s; local darwin arm64. This local run was already in progress and allowed to finish under human gate change e6264b46; it is not a second Linux receipt.

C1–C3 and final amended C5/C6 remain unverified; C4/C7/C8/C9 source marks remain current. Positive hub evidence does not justify clearing an 86-failure complete gate. No criterion implementation is failed until the untouched Neovim failure source is established. Retain Linux reds ce86de7b/A-2838 (T-461) and fc85d6ae/A-2886 (T-447). Await shared-fix/diagnostic disposition and delta review after any adoption; no automatic unchanged retry or gate pair established. Preserve performance amendments and T-395 reconciliation obligation. No Reviewer tests or edits.
Review evidence: A-2931.

### impl-393 · 2026-10-15T11:24:19.134Z

Local6b2bda6d/A-2930 passed all1730 hub tests, failed86 Neovim date-family cases. Adopted only Coordinator-posted T-4871419bc34 as36ecea1f; pushed. Targeted shell84, layers14, THREAD001/0022 all pass, full typecheck green (A-2932). Delta review requested before new default-droplet gate under human e6264b46. Source otherwise unchanged fromc97f0056; all prior Linux/local red receipts retained.

### rev-23 · 2026-10-15T11:24:53.221Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-15-393-7
commit: 36ecea1f6f97445efc149b47b8ba2a7e89b7c89b
scope: delta

Delta source clear at 36ecea1f6f97445efc149b47b8ba2a7e89b7c89b; no high/medium finding remains.

Only exact shared T-487 1419bc34 is added to c97f0056 (stable patch ID f3bd75a675bd8e4e20a6b4f0c58e126891c75ba7). Stub timestamps and visibility age share the same fixed reference; CLAND_STUB_NOW overrides remain, and archive examples retain recent/eight-day-old relationships and all existing assertions. No production, T-393 hub fixture, lifecycle or documentation changes.

Audited A-2932: layers 14/14, whole shell 84/84, THREAD-001/002 2/2, all zero failures/skips/cancellations, plus full typecheck log. The targeted shell and THREAD cases directly resolve both observed signatures in A-2930; the old local receipt still remains red overall (hub 1730/1730, Neovim 301/387, 86 failures). A fresh complete gate remains necessary.

C4/C7/C8/C9 source marks refreshed; C1–C3 and final amended C5/C6 remain pending. Retain A-2838/T-461, A-2886/T-447, and A-2930/T-487 receipts. C5 is posted data only before merge, with quiet stage-cover 20% judgment owed later; C6 is the 772 lower-bound projection, under-600 assigned T-466. T-395 second-merger 110-identity reconciliation remains required.

Submit configured-default no-mode verify at this exact head under human e6264b46. Actual executor and package coverage must be checked in the result; do not assume a default submission supplies Linux if the hub falls back. No Reviewer tests or edits.
Review evidence: A-2933.

Criteria: C4 verified, C7 verified, C8 verified, C9 verified.

### rev-23 · 2026-10-15T11:51:11.324Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-15-393-8
commit: 36ecea1f6f97445efc149b47b8ba2a7e89b7c89b
scope: evidence

Medium — hub/test/account-limited.test.ts:221: after reset becomes visible, account-polled journal count is 1 rather than expected previous-count + 1 = 2 (A-2951:3880–3895). The assertion body/file is unchanged from T-393 base. This is a new exact signature relative to the reviewed T-451 backoff-delay case; do not infer known-ticket coverage or product cause from the shared file name. Bugs/S find aside for lead classification.

Configured Linux f322ed1f/A-2951 at 36ecea1f6f97445efc149b47b8ba2a7e89b7c89b selected full but stopped before Neovim: 1730 hub tests, 1726 pass, one fail, three platform skips, exit 1. Own changed hub tests pass; targeted T-487 evidence remains positive but is not a completed Neovim phase. Suite 1230.01s, c-8 lon1 lifetime 1325s, cost $0.0920. Branch remains exact reviewed head.

C1–C3 and final amended C5/C6 remain unverified; C4/C7/C8/C9 source marks stay current. Preserve ce86de7b/A-2838, fc85d6ae/A-2886 and local 6b2bda6d/A-2930 with their already recorded shared-fix rulings. New human pair rule e6264b46 requires known-ticket failures and own-file coverage, not an unclassified assertion. Coordinator bef82ca8 also prohibits new verify submissions during queue drain until hub restart; cover-quiet local-test restrictions still apply. Await lead diagnosis/disposition before further gate work. No Reviewer tests or edits.
Review evidence: A-2953.

### impl-393 · 2026-10-15T12:51:14.222Z

Final evidence at unchanged source-clear36ecea1f: Coordinator029dbfc2 files the account-polled race as T-493 and explicitly accepts Linux A-2886(T-447) plus A-2951(T-493) as different known flakes, touched files green. Directed comparison A-2992 is five task whole files50/50 + current-dev2e8285a0 control10/10; partial interrupted attempt excluded. Exact-head explicit local Neovim-only npm run test:nvim -- nvim/test/*.test.ts exits0,387/387, no skips/cancellations,71.89s under normal lease (A-2993). Mac window handed to impl-465. No source/head change or new verify. Final evidence review requested citing029dbfc2 and C5/C6 stage1-close amendments; no premerge20% or under600 claim.

### rev-23 · 2026-10-15T12:52:43.535Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-15-393-9
commit: 36ecea1f6f97445efc149b47b8ba2a7e89b7c89b
scope: evidence

Final pre-merge evidence clear at unchanged 36ecea1f6f97445efc149b47b8ba2a7e89b7c89b under the recorded gate/performance amendments; no high/medium T-393 finding remains.

Accepted hub pair: Linux fc85d6ae/A-2886 at c97f0056 fails only untouched T-447 clause wait; Linux f322ed1f/A-2951 at 36ecea1f fails only untouched account-polled count, now T-493. Each reports 1726 pass/one fail/three platform skips and exits 1 before Neovim. Own changed hub tests pass. The only head delta is exact shared T-487, reviewed in A-2933. Direct Coordinator 029dbfc2 classifies T-493 and explicitly accepts these different-known-failure receipts under e6264b46; neither receipt is relabelled green.

Audited directed comparison A-2992: five complete task account-limited files 50/50 plus current-dev control 10/10, same test blob, one labelled loaded/four quiet task runs; interrupted attempt excluded. These passes do not prove the journal race cause; they support the Coordinator's classification. Required exact-head local Neovim supplement A-2993 uses explicit nvim/test/*.test.ts targets under the normal lease: 387/387, zero failures/skips/cancellations, 71.89s, lease wait 0.02s, peak load 4.46. 029dbfc2 and mixed-diff 90193e8c/d05c60c7 accept this supplement; Linux Neovim is stage-close coverage, not claimed executed here.

C1–C3: real socket/WS/CLI equivalence, deliberate startup/request leak rejection, explicit per-hub environment isolation and correction proofs are established by A-2815/A-2816 and the passing own hub tests. Scope facade covers direct Dispatcher open/receive/closed; delivery config and candidate-tree Git use owning env with private index preserved. C4 lifecycle list, C7 retained frame/refusal families, C8 no deleted identities/unchanged assertion meanings and C9 docs remain as reviewed A-2804/A-2806/A-2816/A-2933. Final gate evidence now closes their runtime dependency.

C5/C6 are verified ONLY for their amended pre-merge evidence obligations: A-2806 posts the available timing samples with invalid overlaps labelled, without a speed claim; A-2804/A-2737 documents selected20 starts 421→145 and lower-bound projection 1047−421+145+1=772. This is not an observed full-run census, under-600 achievement or a 20% speed result. Direct 029dbfc2 and earlier 6f89040c leave their post-merge judgment at E-387 stage-1 close against A-2714; under-600 is T-466. Those stage obligations remain owed despite this pre-merge verification mark.

Retain pre-adoption red ce86de7b/A-2838 (T-461) and local 6b2bda6d/A-2930 (86 T-487 date-family failures), plus the initial source findings and red/green corrections. T-395 second-merger reconciliation must still audit all 110 mapped identities and receive delta review; no integration performance claim is made now. All C1–C9 marked under these explicit pre-merge interpretations. No Reviewer tests or edits.
Review evidence: A-2994.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified, C8 verified, C9 verified.

### impl-393 · 2026-10-15T13:09:21.532Z

Integrated dev e2d9a940 with both sides of six source/test conflicts preserved (b92b6cb0), adopted T-486 and heartbeat allowances with identical patch IDs, and fixed the new heartbeat test's second unawaited suite worker via a terminal-report barrier. Pushed b19dd038 (final dev merge tracker-only). Typecheck green and 147 tests across 10 integration files green; source/audit logs posted in integration evidence. Requesting delta review before a fresh default verify. Prior receipt pair/Neovim run do not settle new integration; C5/C6 retain stage-close amendments.

### rev-23 · 2026-10-15T13:12:33.704Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-15-393-10
commit: b19dd0381ace053b6bda04131f052c539ad85474
scope: delta

Medium — hub/src/hub/merge.ts:61 and hub/src/tracker/epic-surfaces.ts:6/9/20: new lane-hold Git lookup omits the owning hub environment. Both territoryGitAsync calls therefore use process.env instead of TaskMerges.#env. A hub with an explicit Git PATH/config/index context can inspect a different merge surface or fail its hold lookup. Thread env through the helper and caller, preserve Git provenance/index isolation, and add a conflicting-environment lane lookup proof. C3 fails for this integration seam.

Other integration review: six conflict resolutions retain explicit env together with T-483's separate warning/fatal callbacks/options and T-454's heartbeat scheduling. New fatal/heartbeat test knobs read the hub env; daemon closes Core before dispatcher/adapters/Tracker/Store, and embedded edge keepalive naming/async close remains intact. Territory's touched-files callbacks preserve explicit env around the new T-335 lane checks, except the helper above. T-486 production state-sequence fix and heartbeat allowance picks have matching upstream stable patch IDs. Final b19dd038 vs tested d8fcf52b changes tracker records only.

The strict projectHub cleanup caught a queued second heartbeat worker. The additive both-results barrier awaits both intended workers before teardown; all prior digest assertions remain. Audited A-3006 red 8/9 and restored strict-cleanup 9/9, plus 147 passing tests across ten targeted files and typecheck evidence; no forced-exit green receipt. Assertion audit retains all identities (2938→3092 calls), both conflict-parent assertions (Agents10/Claude103), and only documented keepalive spelling/reviewed CLI-to-dispatcher refusal forms change. No further high/medium integration finding identified.

No full verify at b19dd038 before C3 correction and new source review. Prior final A-2994/old gate receipts do not settle this production integration; Neovim source also moved, so old A-2993 coverage is not current. C5/C6 remain amended pre-merge data/projection only, with stage-close judgments owed. T-395 second-merger 110-identity reconciliation remains. No Reviewer tests or edits.
Review evidence: A-3012.

Criteria: C3 failed (Incoming epicMergeFiles lane-hold lookup runs Git with process.env instead of the owning in-process hub's explicit environment.).

### impl-393 · 2026-10-15T13:15:04.093Z

Corrected A-3012/C3 as9eade11e: explicit TaskMerges env through epicMergeFiles and both Git calls; conflicting GIT_DIR/GIT_WORK_TREE regression red→green. Existing lane races now use per-fixture env, no process.env mutation; removing only caller env produces2/2 red, restored file11/11 green; typecheck green. A-3016 has logs/proof. Fetched and merged origin/dev1e75347d (tracker-only), pushedbedfcef3. New delta review requested before fresh verification.

### rev-23 · 2026-10-15T13:17:53.106Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-15-393-11
commit: bedfcef31450af863322d26576f6df22033edc66
scope: delta

No high or medium finding remains. C3 correction: hub/src/hub/merge.ts:61 supplies owning #env; hub/src/tracker/epic-surfaces.ts:9,20 forwards it to both history and diff-tree. A-3016 proves conflicting Git provenance red/green and caller-only mutation red/restored whole-file 11/11 green; existing assertions preserved. Standards and Spec clear; full audit in A-3017. Source marks C4,C7,C8,C9 refreshed. C1-C3 require fresh same-head gate; C5/C6 amendments and T-395 110-identity reconciliation remain unchanged. Earlier integrated gate receipts do not carry to this new source. Restore claimant C3 done mark; submit one configured-default no-mode verify at this exact head.

Criteria: C4 verified, C7 verified, C8 verified, C9 verified.

### rev-23 · 2026-10-15T13:42:08.066Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-15-393-12
commit: bedfcef31450af863322d26576f6df22033edc66
scope: evidence

Medium — hub/test/suite-runner.test.ts:76: A-3038 times out waiting for the second nvim runner's held-pid contention diagnostic. The unchanged test holds the first runner only 500 ms; missed overlap is a candidate, not established by this stack, which omits second.output(). Bugs/S find aside reported for exact ownership/disposition; no known-ticket match established.

Actual Linux gate 282b9c70/A-3038 is full-mode exit 1: 1749 pass, one fail, three platform skips; own changed hub files pass, Neovim not reached. Source A-3017 remains clear, C3 done restored; no criterion implementation failed on this evidence alone. No accepted known-flake pair or automatic unchanged retry inferred. Final C1-C3 and amended C5/C6 await accepted integrated evidence; C4/C7/C8/C9 source marks current. Earlier gate pair/Neovim run do not cover this integration. Preserve performance amendments and T-395 110-identity reconciliation. Evidence A-3039; no Reviewer tests or edits.

### impl-393 · 2026-10-15T13:48:41.979Z

First integrated-head Linux282b9c70/A-3038 red only unchanged suite-runner nvim contention-diagnostic wait:1749pass/1fail/3platformskip; ownfilesgreen,Neovim not reached. Directed2ff4abf3 comparison now5/5 wholefiles250/250 green at exactbedfcef3,67–71s, serial/no local holder/load<3 (A-3043). No source changes or dev control required. Reported for E-482 classification before authorized second same-head droplet verify.
