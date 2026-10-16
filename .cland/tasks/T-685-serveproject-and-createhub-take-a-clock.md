---
id: T-685
kind: task
title: serveProject and createHub take a Clock, and projectHub tests advance a fake one instead of waiting real time
state: open
status: in progress
size: M
labels:
  - v0.1.4
  - verification
  - hub
assignee: null
parent: E-676
blocked_by: []
topic: topic-410
branch: t/T-685-serveproject-and-createhub-take-a-clock
created: 2026-10-16T19:59:28.353Z
updated: 2026-10-16T20:02:27.688Z
---

## Summary

Several hub modules already take a `now` (`core`, `asks`, `budget`, `journal`, `inbox`, `verification-wait`), but the hub as a whole has no injectable clock, so heartbeat, hygiene windows, TTLs and archive timers are tested with real time (report-strategy §2.3, §3e.1). heartbeat.test.ts alone took five flake tickets (A-4004). This ticket adds the seam the memo calls the core enabler (memo §4 option e) for the hub's own scheduling.

## What to build

- **One `Clock`** (`now()`, `setTimeout`, `clearTimeout`, `setInterval`, `clearInterval`) with the real clock as the production default. `serveProject`, `createHub` and `createHubBase` accept it and pass it to `HubCore` and to the hub-owned timers: heartbeat schedules, hygiene windows, presence and store-and-forward TTLs and their prune, inbox ages, asks, verification-wait metrics, session archive windows, usage publication and the daily retention prune.
- **Out of scope**, staying on real time: journal flush and I/O retries, socket keepalive and reconnect, the harness adapters, `Suites` and the droplet executor, and `AccountPoller` (E-677 moves the last three).
- **`FakeClock`** in `hub/test/` with `advance(ms)`: it runs due timers in time order and lets pending I/O callbacks settle between them, so a test advances time and then waits on the event it expects. `projectHub(t, root, env, { clock })` serves the project with it.
- **Why a seam and not `t.mock.timers`:** `projectHub` keeps real socket edges and an asynchronous journal whose timers must keep running; mocking the globals freezes them.

## Acceptance criteria

- [ ] C1. A new T2 test serves a project with a `FakeClock` and sees a heartbeat delivered after `advance(interval)` and none before it, with no real wait, proved by the test and the tier lint.
- [ ] C2. The same file shows a store-and-forward message dropped at its TTL and a presence expiring, each after `advance`, with no sleep.
- [ ] C3. With the default clock the existing heartbeat, hygiene, presence and store-and-forward test files pass unchanged, 5/5 serially as whole files on the Mac and once in the task's droplet verify.
- [ ] C4. A source-scan test shows the hub modules behind the seam call no `setTimeout`, `setInterval` or `Date.now` directly, except the listed I/O retries.
