---
id: T-393
kind: task
title: "In-process hub by default: tests run against a hub served in the test process over its real socket, a spawned hub stays only for lifecycle tests, and the top 20 files move first"
state: open
status: backlog
size: L
labels:
  - v0.1.3
  - hub
  - ready-for-agent
assignee: null
parent: E-387
blocked_by:
  - T-390
  - T-392
topic: null
branch: null
created: 2026-10-14T12:28:19.095Z
updated: 2026-10-14T12:28:20.102Z
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

- [ ] C1. `projectHub` serves a project in the test process; `cland` subprocesses, spokes and UI clients reach it over its real socket and WebSocket with no change to their code, proven by a tracer test that runs the same frames against `projectHub` and `startDaemon`.
- [ ] C2. Cleanup fails a test whose in-process hub leaves handles, timers, `process` listeners or child processes, proven by a test that leaks one on purpose.
- [ ] C3. `serveProject` takes its environment as an option, and two in-process hubs in one file with different adapter timings behave independently, proven by a test.
- [ ] C4. The lifecycle list is posted per file; every test that still calls `startDaemon` or `cland hub start` in the 20 files is on it, and none of the others is.
- [ ] C5. Measured: the 20 files' summed whole-file time on an idle machine falls by at least 20% (median of three per file), with the per-file table posted.
- [ ] C6. Measured: daemon starts per full run fall to under 600 (about 944 in A-2021) from the census or the run log, posted on the item.
- [ ] C7. Each refusal family and each adapter verb keeps at least one frame test, and the moved validation cases keep their asserted error codes and messages.
- [ ] C8. No assertion changes its meaning: the review request lists every changed assertion with what it still proves, and no test is deleted.
- [ ] C9. `hub/README.md` (Tests) and `docs/agents/tests.md` describe `projectHub` as the default, the lifecycle line, and when a new test may use `startDaemon`.
