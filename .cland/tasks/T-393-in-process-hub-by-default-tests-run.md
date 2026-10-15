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
updated: 2026-10-15T09:22:40.700Z
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
- [x] C2. Cleanup fails a test whose in-process hub leaves handles, timers, `process` listeners or child processes, proven by a test that leaks one on purpose.
  - done: impl-393 · 2026-10-15T09:19:34.574Z
- [x] C3. `serveProject` takes its environment as an option, and two in-process hubs in one file with different adapter timings behave independently, proven by a test.
  - done: impl-393 · 2026-10-15T09:19:44.326Z
- [x] C4. The lifecycle list is posted per file; every test that still calls `startDaemon` or `cland hub start` in the 20 files is on it, and none of the others is.
  - done: impl-393 · 2026-10-15T08:08:39.537Z
  - verified: rev-23 [reviewer] · run rev-2026-10-15-393-2 · 2026-10-15T09:22:40.699Z · commit 519fc215a8f8b84572f079ba0b5a1b35ed8072fa
- [x] C5. Measured (Coordinator amendment 2026-10-15 09:03Z): the 20 files' summed whole-file time falls by at least 20%, judged after merge from E-387's stage-1 close integrated cover on the Mac against the v0.1.2 release cover A-2714 (both quiet integrated runs), per file from the runner's records; pre-merge, the available paired samples are posted without a claim, because local fallbacks invalidated every pair while remote_budget was 2.
  - done: impl-393 · 2026-10-15T09:04:06.375Z
- [x] C6. Measured (Coordinator amendment 2026-10-15 09:03Z): the migration's daemon-start delta is posted against the fresh census A-2737 (the 20 files 421 → 145, a projected 772 per run against 1047); the under-600 target moves to T-466, the next files' migration.
  - done: impl-393 · 2026-10-15T09:04:07.098Z
- [x] C7. Each refusal family and each adapter verb keeps at least one frame test, and the moved validation cases keep their asserted error codes and messages.
  - done: impl-393 · 2026-10-15T08:08:40.735Z
  - verified: rev-23 [reviewer] · run rev-2026-10-15-393-2 · 2026-10-15T09:22:40.699Z · commit 519fc215a8f8b84572f079ba0b5a1b35ed8072fa
- [x] C8. No assertion changes its meaning: the review request lists every changed assertion with what it still proves, and no test is deleted.
  - done: impl-393 · 2026-10-15T08:08:41.391Z
  - verified: rev-23 [reviewer] · run rev-2026-10-15-393-2 · 2026-10-15T09:22:40.700Z · commit 519fc215a8f8b84572f079ba0b5a1b35ed8072fa
- [x] C9. `hub/README.md` (Tests) and `docs/agents/tests.md` describe `projectHub` as the default, the lifecycle line, and when a new test may use `startDaemon`.
  - done: impl-393 · 2026-10-15T08:08:41.843Z
  - verified: rev-23 [reviewer] · run rev-2026-10-15-393-2 · 2026-10-15T09:22:40.700Z · commit 519fc215a8f8b84572f079ba0b5a1b35ed8072fa

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
