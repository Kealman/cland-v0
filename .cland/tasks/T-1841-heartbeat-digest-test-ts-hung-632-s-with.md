---
id: T-1841
kind: task
title: heartbeat-digest.test.ts hung 632 s with no output in a Linux T1 run and stalled a task verify
state: open
status: review
size: S
criterion_seq: 2
labels: []
assignee: null
parent: E-1881
blocked_by:
  - T-1796
topic: topic-1546
branch: t/T-1841-heartbeat-digest-test-ts-hung-632-s-with
created: 2026-11-13T00:27:22.788Z
updated: 2026-11-16T13:51:25.324Z
---

## Summary

`hub/test/heartbeat-digest.test.ts` (T1, one test, fake clock, no sockets) hung for 632 s with no output in T-1827's mode-free verify `dafa1d1a` on a Linux droplet (A-19160, 2026-11-13 ~00:15Z), so the runner stopped the suite as stalled (exit 124) after 345 passing tests. The same file passes 5/5 alone on macOS in about 0.12 s each, and T-1827's change (a durations.json line) doesn't reach it.

## What to build

Find why the file can hang under the full T1 run on Linux (an unresolved timer or promise on the fake clock, an open handle, or a wait on a shared resource) and make it finish or fail within a named bound, so a stall never costs a 10-minute runner timeout.

## Acceptance criteria

- [x] C1. The hang is located from the A-19160 log and the file's code (the file started but its only test never did, so test-process startup or import), and the item records what the log cannot settle (test).
  - done: impl-1841 · 2026-11-16T13:19:37.829Z
  - verified: rev-36 [reviewer] · run rev-36-1841-source-3 · 2026-11-16T13:51:25.324Z · commit 11eb236a624e56f4bd9f6dc12e18bca58d0d8844
- [x] C2. A test file that starts but begins no test within a named bound, well under the runner's no-output limit, fails at once with the runner's stall evidence from T-1796, on the local suiteCommand tier path and the droplet run-suite path, not after the 10-minute stall guard (test, red before the fix); repetition children are T-1911; heartbeat-digest.test.ts passes five lone Linux repetitions (evidence).
  - done: impl-1841 · 2026-11-16T13:48:45.301Z

## Comments

### impl-1841 · 2026-11-16T09:53:53.224Z

C1 finding from A-19160 (Linux x64, Node24.21, droplet, bac216bee8662af959eec209800682884f45a508): final events are file-start for heartbeat-digest.test.ts, followed by `in flight: hub/test/heartbeat-digest.test.ts :: /home/runner/cland/hub/test/heartbeat-digest.test.ts (running 632 s)`. There is no start event for its only test. This localizes the stall to test-process startup/import, before the synchronous test body. The body uses an in-memory Store, FakeClock.now/block, and synchronous digest/assertions; it creates no timer, promise, socket or shared resource. The runtime import graph has no top-level await or initiated async work. No fake-clock defect was found. The historical log lacks PID/native-exit/pipe receipts, so it cannot distinguish native spawn/bootstrap/import blockage or establish the exact native cause. Per Coordinator decision 69815e1a, T-1841 will add a runner first-test-start bound after T-1796's diagnostics land; no test-local async import workaround.

### impl-1841 · 2026-11-16T13:18:09.052Z

Consumer audit: until.ts's exports/import paths are retained; suiteLoadFactor and waitTimeoutMs extracted verbatim to hub/src/suite-wait-budget.ts, with until.test.ts preserving local/droplet/explicit/invalid factors and exact behaviour/injected-clock semantics. Direct callers checked: run-suite.ts, fakes/discord/hub.ts, host-fixture-cleanup.test.ts, login-terminal.test.ts, scenario-reply-owner.ts, until.test.ts, plus all121 direct until/scaling paths inventoried in the pre-review artifact. Typed TestProgress wire is unchanged; previous untyped shape regression added. New timeout wording consumer suite-cover.ts migrated to classify startup stalls as timeout. suite-worker, suites, release-web and log reduction retain {code,cause}/native semantic evidence. Full consumer inventory will accompany review.

### rev-35 · 2026-11-16T13:25:34.702Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1841-source-1
commit: b2d89906c755597a49186ec1c10dc2de1ac25b80
scope: full
findings: [{"severity":"medium","text":"Watchdog covers local suite-worker/release-web only. Historical failure is droplet execution: run.sh executes @COMMANDS@ directly and run-suite never calls suiteCommand, so that file-start hang still waits for ordinary stall timeout. No earlier owner/local-only disposition exists (claimant confirmed). Extract one shared startup watchdog for suiteCommand and run-suite; connect runner/droplet path to existing cleanup/evidence owner and add a deterministic failing-before runner-path control, retaining reporter/scope/replay/disarm tests.","file":"hub/src/suite-command.ts","line":13}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source audit A-20098 plus tracker-mark correction: Standards0 additional/Spec1 medium. C1 diagnosis source-established from A-19160:1981 sole file start and :1985 in-flight632s, synchronous body, exact native startup/import cause unknown; no C1 tracker verification mark is recorded because verified requires a clear verdict. Prior five lone Linux receipts A-19942 positive/heartbeat blob unchanged, not new watchdog executions. A-20097 retains121/28 normalized source sets and candidate/raw/hash/publication limits; typecheck predates final isolation edit, no exact-head verify. Local guard/test cleanup/arithmetic extraction otherwise consistent. Hold releases with this stored verdict; fresh shared-owner correction/source review before verification, no provenance rerun requested.

Criteria: C2 failed (New startup watchdog is absent from the droplet/package-runner path that produced A-19160.).

### rev-35 · 2026-11-16T13:47:09.716Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1841-source-2
commit: b95ae2d9404b70fdc9aa22dc8d0227172861b08c
scope: full
findings: [{"severity":"medium","text":"New tierFinished awaits child close before the existing sweep(holder) normal-exit writer cleanup. If a coordinator exits with an inherited pipe writer, close waits on that writer while the cleanup owner is unreachable. phaseGuard.result only joins cleanup on guard-triggered stalls; claimant confirms no earlier normal-exit owner. Preserve cleanup-before-close and end delegation at the Coordinator-approved boundary, with the requested fake exited-parent/inherited-pipe reclaim control. This is an in-scope marker ordering regression, not deferred T-1911 implementation.","file":"hub/test/run-suite.ts","line":328}]
finding_counts: {"high":0,"medium":1,"low":0}

Full narrowed-C2 pass A-20105: one medium Standards finding, no additional Spec finding. Shared ordinary local/droplet guard wiring otherwise read; repetition implementation belongs to T-1911 per c4374931. Prior source/evidence/hash/consumer/capture limits retained; new two helper tests do not exercise wait-before-sweep. C1 source-established but not marked verified in not-clear verdict. Hold released for Coordinator-authorized exact delta B reported e2b120ed: preserve original sweep-before-close, document exit/timeout-cleanup marker boundary and add one fake inherited-pipe/native-exit control, then fresh source review. No Reviewer runtime.

Criteria: C2 failed (Marker lifetime delta introduces a close wait before normal-exit inherited-writer cleanup, potentially hanging the runner.).

### rev-36 · 2026-11-16T13:51:25.324Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1841-source-3
commit: 11eb236a624e56f4bd9f6dc12e18bca58d0d8844
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final source review A-20112: prior close-before-sweep finding resolved per Coordinator d6c9e63b. Finish follows guarded native exit + timeout cleanup; existing sweep-before-close preserved, delegation ends before repetition waiting. Explicit finish and new native-exit/open-pipe fake controls cover outer reclaim; no other findings under c4374931 narrowed C2/T-1911 split. C1 diagnosis verified from A-19160 file-only start/632s and synchronous body; exact historical cause unknown. A-20108 candidate23/23, prior67/static and five prior-base Linux heartbeat passes with identical blob remain distinctly scoped; no configured/current watchdog execution claim. C2 waits exact-head mode-free result. No Reviewer runtime; hold released for authorized verification.

Criteria: C1 verified.
