---
id: T-685
kind: task
title: serveProject and createHub take a Clock, and projectHub tests advance a fake one instead of waiting real time
state: open
status: review
size: M
criterion_seq: 4
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
updated: 2026-10-16T20:16:26.608Z
---

## Summary

Several hub modules already take a `now` (`core`, `asks`, `budget`, `journal`, `inbox`, `verification-wait`), but the hub as a whole has no injectable clock, so heartbeat, hygiene windows, TTLs and archive timers are tested with real time (report-strategy §2.3, §3e.1). heartbeat.test.ts alone took five flake tickets (A-4004). This ticket adds the seam the memo calls the core enabler (memo §4 option e) for the hub's own scheduling.

## What to build

- **One `Clock`** (`now()`, `setTimeout`, `clearTimeout`, `setInterval`, `clearInterval`) with the real clock as the production default. `serveProject`, `createHub` and `createHubBase` accept it and pass it to `HubCore` and to the hub-owned timers: heartbeat schedules, hygiene windows, presence and store-and-forward TTLs and their prune, inbox ages, asks, verification-wait metrics, session archive windows, usage publication and the daily retention prune.
- **Out of scope**, staying on real time: journal flush and I/O retries, socket keepalive and reconnect, the harness adapters, `Suites` and the droplet executor, and `AccountPoller` (E-677 moves the last three).
- **`FakeClock`** in `hub/test/` with `advance(ms)`: it runs due timers in time order and lets pending I/O callbacks settle between them, so a test advances time and then waits on the event it expects. `projectHub(t, root, env, { clock })` serves the project with it.
- **Why a seam and not `t.mock.timers`:** `projectHub` keeps real socket edges and an asynchronous journal whose timers must keep running; mocking the globals freezes them.

## Acceptance criteria

- [x] C1. A new T2 test serves a project with a `FakeClock` and sees a heartbeat delivered after `advance(interval)` and none before it, with no real wait, proved by the test and the tier lint.
  - done: impl-685 · 2026-10-16T20:16:01.920Z
  - verified: rev-31 [reviewer] · run rev-20261016-685-c1-evidence · 2026-10-16T20:16:26.608Z · commit 247247d6fc60ac7c6ebae7c1f0cba2a800bafa4f
- [x] C2. The same file shows a store-and-forward message dropped at its TTL and a presence expiring, each after `advance`, with no sleep.
  - verified: rev-31 [reviewer] · run rev-20261016-685-source · 2026-10-16T20:15:18.338Z · commit 247247d6fc60ac7c6ebae7c1f0cba2a800bafa4f
  - done: impl-685 · 2026-10-16T20:15:34.421Z
- [ ] C3. With the default clock the existing heartbeat, hygiene, presence and store-and-forward test files pass unchanged, 5/5 serially as whole files on the Mac and once in the task's droplet verify.
- [x] C4. A source-scan test shows the hub modules behind the seam call no `setTimeout`, `setInterval` or `Date.now` directly, except the listed I/O retries.
  - verified: rev-31 [reviewer] · run rev-20261016-685-source · 2026-10-16T20:15:18.338Z · commit 247247d6fc60ac7c6ebae7c1f0cba2a800bafa4f
  - done: impl-685 · 2026-10-16T20:15:34.777Z

## Comments

### impl-685 · 2026-10-16T20:11:18.654Z

Implemented the Clock seam and FakeClock at the projectHub boundary. T1 tests cover deadline ordering, nested scheduling/microtasks, cancellation, mixed-clock rejection, and the source boundary. T2 tests prove heartbeat, queued delivery expiry, remembered status expiry and timer cleanup through real socket frames. Default clock compatibility keeps legacy now-only tests unchanged; a complete clock and now cannot be supplied together. Infrastructure spawn census: 6 git and 3 ps probes, no hub/spoke/harness/Neovim child; Coordinator assigned the probe follow-up to T-719. Required serial Mac repetitions in progress; droplet verification will follow source review and the Coordinator's hold lift.

### rev-31 · 2026-10-16T20:15:18.338Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-685-source
commit: 247247d6fc60ac7c6ebae7c1f0cba2a800bafa4f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; Standards0/Spec0 findings, A-4181. Reviewed20paths and time consumers. Complete Clock flows from project fixture/daemon/base into core schedules/timestamps, inbox/TTL/hygiene/presence, artifact retention, archive/usage and wait metrics; explicit real I/O/native/executor boundaries retained. Timer cancellation ownership and legacy-now compatibility reviewed; FakeClock orders/yields without claiming I/O completion. T2 frame proofs establish heartbeat/TTL/remembered presence, source scan establishes listed boundary; no new sleeps/native harness processes. Coordinator94a6b3cd independently accepts6git+3ps census with T-719 follow-up. A-4176 audited20wholefiles/135passes, four compatibility files unchanged; exact-head typecheck/shards reportedgreen. C2/C4 verified. C1 explicit tier-lint evidence absent at base/parallelT-679; obtain lint or Coordinator criterion disposition before finalC1. C3 awaits exact-head droplet after explicit submission-hold lift. Claimant done marks absent in read-only item; submit supported evidence marks. No Reviewer edits/tests, no forced full task run.

Criteria: C2 verified, C4 verified.

### coord · 2026-10-16T20:15:51.569Z

Coordinator, criterion disposition (D51): C1's tier-lint receipt can't exist before T-679 and T-682 land. For this ticket the tier evidence is the Reviewer's inspection of the new T2 proof files against 'Test levels' in docs/agents/tests.md: no startDaemon, spawnSpoke or fake harness binary; no literal sleeps or elapsed-ms assertions; a T2 header. The tags are entered when T-679 merges (T-690 retags qualifying files), and T-682 reports the lint result.

### rev-31 · 2026-10-16T20:16:26.608Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-685-c1-evidence
commit: 247247d6fc60ac7c6ebae7c1f0cba2a800bafa4f
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

C1 supplemental evidence clear; Standards0/Spec0 findings, A-4182. Independently read Coordinator6e559ea8 in topic-410 explicitly substituting Reviewer Test-levels inspection for unavailable tier lint at this base. Existing A-4181 inspection confirms T2 header, no daemon/spoke/fake harness, no literal sleep/elapsed-ms assertions, actual heartbeat frame only after fake deadline. No tier-lint execution claimed; T-679/T-690/T-682 own later tagging/lint. C1 verified under that disposition; C2/C4 source current. C3 remains pending same-head droplet2d734657. Head unchanged; no Reviewer edits/tests.

Criteria: C1 verified.
