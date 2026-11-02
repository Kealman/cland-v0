---
id: T-1627
kind: task
title: The first hourly verification-wait snapshot can land inside hub shutdown
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
regression_of: T-470
found_by: review
topic: topic-1333
branch: t/T-1627-the-first-hourly-verification-wait
created: 2026-11-02T05:57:32.136Z
updated: 2026-11-02T10:21:16.951Z
closed: 2026-11-02T10:21:16.951Z
---

## Summary

`hub/test/daemon.test.ts` "a stopping hub leaves alone a socket that is no longer the one it bound, and hub.json goes only at the end" fails intermittently on clean dev: the shutdown log carries an extra `verification-wait` event between `socket-kept` and `stopped`. `VerificationWait.record` logs once per new hour, and a fresh store starts at hour -1, so the first `record` call always logs; when that first call lands inside the shutdown window the test's event list gains it.

## What to build

The shutdown sequence carries no `verification-wait` snapshot: either the hourly snapshot is not recorded once the hub is stopping, or the first snapshot is taken at startup before the hub reports ready, so it can never fall inside shutdown. The daemon test keeps its expected list unchanged. Whichever fix, the hourly snapshot still appears once per hour in a running hub.

Found by impl-1615 during T-1615 (topic-1331, 2026-11-02 05:57Z): clean dev c14994a24, `node --test hub/test/daemon.test.ts`, run 1 18/18, run 2 17/18 at daemon.test.ts:583 with actual `['stopping','socket-kept','verification-wait','stopped']`.

## Acceptance criteria

- [x] C1. A hub stopping before its first hourly snapshot logs no `verification-wait` event between `stopping` and `stopped` (test).
  - done: impl-1627 · 2026-11-02T06:38:49.214Z
  - verified: rev-36 [reviewer] · run rev-36-1627-final-1 · 2026-11-02T07:12:47.415Z · commit 2311a7b325a4c4f57bc89f0d3ef4f2f39c8ef76b
  - verified: rev-36 [reviewer] · run rev-36-1627-final-2 · 2026-11-02T09:16:59.295Z · commit 33c8dc24f0b7e552351fb42b1b8c878560b616fb
- [x] C2. A running hub still logs one `verification-wait` snapshot per clock hour, proven with the fake clock (test).
  - done: impl-1627 · 2026-11-02T06:38:50.117Z
  - verified: rev-36 [reviewer] · run rev-36-1627-final-1 · 2026-11-02T07:12:47.415Z · commit 2311a7b325a4c4f57bc89f0d3ef4f2f39c8ef76b
  - verified: rev-36 [reviewer] · run rev-36-1627-final-2 · 2026-11-02T09:16:59.295Z · commit 33c8dc24f0b7e552351fb42b1b8c878560b616fb
- [x] C3. `hub/test/daemon.test.ts` passes 10 consecutive runs on macOS, each started at a one-minute load of 10 or below, with each run's peak load recorded and no test edited.
  - done: impl-1627 · 2026-11-02T06:38:50.356Z
  - verified: rev-36 [reviewer] · run rev-36-1627-final-1 · 2026-11-02T07:12:47.415Z · commit 2311a7b325a4c4f57bc89f0d3ef4f2f39c8ef76b
  - verified: rev-36 [reviewer] · run rev-36-1627-final-2 · 2026-11-02T09:16:59.295Z · commit 33c8dc24f0b7e552351fb42b1b8c878560b616fb

## Comments

### impl-1627 · 2026-11-02T05:58:56.375Z

Using the brief-authorized startup snapshot alternative at the Suites/log boundary. Consumers searched: VerificationWait/verification-wait/waitClock across hub tests, scheduler, protocol, clients and docs. No wire/schema change; existing hourly/restart metrics regression will move to T-685 FakeClock and assert the initial durable snapshot before any tick. daemon.test.ts remains unedited.

### impl-1627 · 2026-11-02T06:01:57.836Z

Red receipt: suite-wait-metrics.test.ts::hourly verification-wait journal values match queue snapshots and do not repeat after restart (fake clock) failed at startup assertion: AssertionError [ERR_ASSERTION], 0 !== 1. Product adds synchronous VerificationWait.record() before registering scheduler timers. Green focused file: 6/6 on macOS arm64, Node v24.21.0, local executor, no browser. Includes durable shutdown log span and hourly journal/restart proofs. A preliminary rerun started at load 10.17; excluded from low-load evidence, corrected path error, then clean rerun started at 8.48 passed 6/6. daemon.test.ts untouched.

### rev-35 · 2026-11-02T06:23:08.127Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1627-source-1
commit: fdc52e7f162441d8d384248b4c45ca028714c615
scope: full
findings: [{"severity":"medium","text":"The new synchronous startup record calls VerificationWait.snapshot → queueWaitMetrics, which maps/filters/sorts the complete retained #jobs history before readiness (verification-wait.ts:11–16). This introduces unbounded retained-history work on startup, contrary to rule 23; the regression has only one historical job and no work/byte budget. Use an incrementally maintained bounded checkpoint for startup, or the brief's stop-suppression alternative, and retain the shutdown/hourly assertions.","file":"hub/src/hub/suites.ts","line":374}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear. One medium at suites.ts:374: startup record synchronously invokes queueWaitMetrics over the complete retained #jobs history; map/filter/sort remains unbounded and is now on startup, contrary to rule23. Use a bounded incrementally maintained startup checkpoint or the brief-authorized stop-suppression alternative, retaining shutdown/hourly/restart assertions. Functional timing fix and shared FakeClock/durable log tests otherwise match the spec; daemon.test.ts is unchanged. A-15647 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15647-t-1627-source-review-at-fdc52e7f.md) records source chain, standards/spec review and evidence limits. C1 failed for the startup work boundary, C2/C3 unverified. Reviewer ran no tests/browser. A-15640's ten local Mac 18/18 campaigns and reported metrics/typecheck/lint remain targeted, with amended load policy; not queued/Linux evidence. Corrected head needs fresh source review before verification.

Criteria: C1 failed (The chosen startup-snapshot implementation adds a synchronous full retained-history scan/sort before readiness without rule-23 bounds.).

### impl-1627 · 2026-11-02T06:36:42.457Z

Review rev-35-1627-source-1 addressed by switching to stop suppression. Startup record removed. Added internal synchronous stopWaitMetrics chain daemon → Dispatcher → Suites; Suites.close reuses it. Consumers: daemon shutdown (early fence), Dispatcher ownership forwarding, Suites standalone close (same clear), projectHub production lifecycle tests; no wire/frame/schema/client changes. FakeClock held maintenance-recovery controls reproduce 2!==0 and 2!==1 before fence and pass after it, across first tick/new hour. Revised metrics7/7, suite19/19, unchanged daemon10x18/18 at start load≤10: A-15660. Prior A-15612/A-15640 cover superseded startup implementation. Revised typecheck exit0; lint in progress. No dev merge after first review.

### rev-35 · 2026-11-02T06:39:52.433Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1627-source-2
commit: 2311a7b325a4c4f57bc89f0d3ef4f2f39c8ef76b
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at 2311a7b325a4c4f57bc89f0d3ef4f2f39c8ef76b; no findings. Prior rule23 defect resolved by removing startup recording. Daemon synchronously clears wait metrics through Dispatcher/Suites before stopping log or await; standalone close uses the same clock-aware clear. Held drainage regressions cover first tick/new UTC hour with and without prior sample, use bounded setup/release/join and retain durable shutdown span assertions. Running hourly/restart persistence assertions remain; daemon.test.ts unedited; docs supersede startup wording and internal consumers inventoried. A-15670 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15670-t-1627-stop-suppression-source-review-at-2311a7b3.md). No reviewer tests/browser. C1–C3 remain unverified pending named same-head queued evidence and C3's native campaign/source provenance. A-15660 revised local metrics7/suite19/ten daemon18 results are targeted; old startup-design artifacts superseded.

### rev-36 · 2026-11-02T07:12:47.415Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1627-final-1
commit: 2311a7b325a4c4f57bc89f0d3ef4f2f39c8ef76b
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; C1–C3 verified. Independently matched all seven A-15696 metrics outcomes, held-drain durable spans/hourly-restart facts; same-head uncached runb89e9a49 exit0,4701/4701. Independently read A-15700 ten native daemon logs, each18 named passes including unchanged shutdown case, totals18/18; log hashes match. A-15660 records native exit0/start loads<=10/per-run sampled peaks. C3 macOSarm64 Node24.21/local; campaign source linkage is pre-run diff plus no-edit transcript through commit, not contemporaneous source hashes; exported source/test patch matches commit, daemon file unedited, retrospective hashes labelled. Linux droplet Node24.21/Neovim0.12.5 T0/T1/fallback allT2/Web completed; T3batch/T4 unexecuted; isolated HeadlessShell1248 Chrome156.0.8078.4. Advisories/skip check report-only, missing0. No findings/Reviewer execution.

Criteria: C1 verified, C2 verified, C3 verified.

### rev-36 · 2026-11-02T08:48:25.192Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1627-source-3
commit: 33c8dc24f0b7e552351fb42b1b8c878560b616fb
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, no findings. Captured wait timer ownership is nulled before one clear, so early daemon stop and later Suites.close cannot erase the same deliberately planted leak twice. Clock ownership/order/hourly behavior retained; original lifecycle/daemon tests unchanged, guide matches. A-15762 records old0!==1/head3of4-dev4of4 and corrected local4/4/metrics7/suite-close3/static summaries; batchA15755 remains failed. C1–C3 await fresh exact-head mode-free named metrics/lifecycle evidence. C3 old10-run campaign is historical; corrected shutdown-disposal head needs criterion's10 consecutive unchanged macOS daemon runs, startload<=10 and retained peak/native receipts. No Reviewer execution.

### rev-36 · 2026-11-02T09:16:59.295Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1627-final-2
commit: 33c8dc24f0b7e552351fb42b1b8c878560b616fb
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; C1–C3 verified, no findings. Independently streamed A-15771/run5647cbde: exact-head uncached exit0,4701/4701, all seven named metrics cases pass with unchanged durable shutdown/hourly/restart assertions. A-15768 ten fresh macOSarm64 Node24.21 daemon logs each18 named passes/native exit0/signalnull, starts<=10 and sampled peaks retained; all log hashes and before/after source hashes match committed bytes. Lifecycle4 passes including both unchanged leak-positive controls. A-15700 historical/A-15755 failed remain labelled. Linux c-8nyc1 Node24.21/Neovim0.12.5 T0/T1/fallbackT2/Web complete, T3batch/T4 unexecuted; isolated HeadlessShell1248 Chrome156.0.8078.4. Advisory/skip checks report-only, missing0. No Reviewer execution; no per-itemQA.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-11-02T10:21:16.951Z

Merged 67fa15ed528f7a95730000eee167b7afab0d8bcc onto dev.
