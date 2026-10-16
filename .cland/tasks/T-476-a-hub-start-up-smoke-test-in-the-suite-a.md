---
id: T-476
kind: task
title: "A hub start-up smoke test in the suite: a built tree starts, serves a request and stops within a bound"
state: open
status: review
size: S
criterion_seq: 3
labels:
  - v0.1.3
  - hub
assignee: null
parent: E-425
blocked_by: []
topic: topic-364
branch: t/T-476-a-hub-start-up-smoke-test-in-the-suite-a
created: 2026-10-15T09:13:19.071Z
updated: 2026-10-16T08:18:51.895Z
---

## Summary

Retrospective A-2783, STOP 6: on 2026-10-12 a start-up change (T-283) made the hub listen without serving, and it took 18 restarts in 27 minutes to diagnose (T-293). The suite gets a smoke test that starts the hub as `cland hub start` does, from the candidate tree, and requires a served request within a bound.

## What to build

A test in hub/test starts `cland hub start` in a fresh project, waits at most 10 s for `hub status` to answer over the socket, sends one tracker request, and stops the hub. It runs in every hub phase and in integrated runs, and a hang names the last start-up log event.

## Acceptance criteria

- [x] C1. The smoke test passes on dev and fails within its bound on a planted start-up hang, naming the last log event.
  - done: impl-476 · 2026-10-16T07:35:09.038Z
  - verified: rev-30 [reviewer] · run rev-20261016-476-final · 2026-10-16T08:17:05.652Z · commit 4dd3a151b224107827b7a868e8183e0d640aca03
- [x] C2. It runs in every hub phase selection, including hub-only task runs.
  - done: impl-476 · 2026-10-16T07:24:33.344Z
  - verified: rev-30 [reviewer] · run rev-20261016-476-correction · 2026-10-16T07:37:07.313Z · commit 4dd3a151b224107827b7a868e8183e0d640aca03
  - verified: rev-30 [reviewer] · run rev-20261016-476-final · 2026-10-16T08:17:05.652Z · commit 4dd3a151b224107827b7a868e8183e0d640aca03
- [x] C3. hub/README.md lists it under Tests.
  - done: impl-476 · 2026-10-16T07:24:33.711Z
  - verified: rev-30 [reviewer] · run rev-20261016-476-correction · 2026-10-16T07:37:07.313Z · commit 4dd3a151b224107827b7a868e8183e0d640aca03
  - verified: rev-30 [reviewer] · run rev-20261016-476-final · 2026-10-16T08:17:05.652Z · commit 4dd3a151b224107827b7a868e8183e0d640aca03

## Comments

### impl-476 · 2026-10-16T07:17:24.269Z

Planted listening-but-silent startup regression written first. Observed red at 10.376 s (missing last-event diagnostic), then green 2/2: hang proof 10.372 s, healthy CLI/status/tracker/stop 0.561 s. One 10 s budget spans start and served status; machine classification and reasoned hang-duration allowance added. Integrating smoke selection assertions; origin/dev refresh including T-488 is required before first source review.

### rev-30 · 2026-10-16T07:27:49.329Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261016-476-source-first
commit: 52c001d582d84721da392f29c569c5a67ba5672c
scope: full

# T-476 source review not clear

Head `52c001d582d84721da392f29c569c5a67ba5672c`, pushed branch `t/T-476-a-hub-start-up-smoke-test-in-the-suite-a`; local/origin agree. Fixed point fetched dev `44f623dc26cf5b77252e7936c537ebcf882bd32a`; captured `git diff 44f623dc...HEAD` and commits56f8c59c plus two pre-review dev merges. Seven-file task scope. task.view confirms live claimant and C1–C3 done. Direct read-only Standards/Spec review; no Reviewer execution or subagents.

## Standards

**M1 — medium — hub/test/startup-smoke.test.ts:82 (and CLI helper at49–52): discovery-dependent ownership leaks a pre-discovery daemon on timeout.** `execFile(...hub start...)` is bounded, but production hub start spawns hub serve detached. When the10s smoke budget kills the CLI, that detached child survives. The finally block registers it with ownProcess only after successful readDiscovery; if startup hangs before hub.json is written, readDiscovery returns null and no daemon identity is registered. tempProject/ownDirectory removes the root after stopping only registered identities; cleanupOwnedProcesses with no seeds returns immediately. Thus a live startup writer can outlive deletion of its fixture root.

This is a current failure-path gap, not hypothetical provider behavior: serveProject acquires the lock and initializes tracker/store/adapters before writing discovery at daemon.ts:337. The test explicitly times out that startup, while conditional ownership at82–83 covers only the later listening/discovered hang. Project rule12 requires stopping and observing every writer before directory deletion; rule9 requires the bounded exact lifecycle observation.

Correct cleanup to own and observe the actual detached daemon independently of successful discovery/readiness. Preserve the genuine CLI startup seam and10s shared readiness bound. Add controlled pre-discovery startup-hang proof that fails within the readiness budget, names its available structured event, and demonstrates daemon exit before root removal. Retain the current listening-but-silent regression as a separate boundary. Do not rely on a phase-wide orphan sweep after deletion or only on killing the hub-start client.

No other Standards finding. Existing selection fixture changes are additive, the deliberately ten-second regression has a measured reasoned allowance and machine classification, and the spawned daemon is justified by the lifecycle assertion.

## Spec

The intended positive path is otherwise implemented: fresh isolated project; candidate CLI_ENTRY via real hub start; performance-based single10s remaining budget across start and socket-backed hub status --json; one tracker list; separate bounded stop followed by PID disappearance and discovery/socket absence assertions. Production CLI status probes the socket; discovery/listening alone is not treated as readiness. Last-event diagnosis skips non-JSON stderr rather than echoing the final line.

C2 selection wiring is present: adding startup-smoke to HUB_SMOKE retains it for nvim-only and coverage-selected modes; full/hub-only glob every hub test. Existing real package-runner fixtures now require the file in reduced selections and integrated function-map output. C3 README Tests documents the seam, bound and scope. These observations do not override M1; no criteria are verified on this not-clear pass.

A-3818/A-3821 document red-before-green, initial smoke2/2, selection85/85 and changed integrated-map1/1, plus typecheck/shard lint. The request reports repeated smoke after T-488 (healthy0.637s/listening-hang10.369s) and a final T-566-only pre-review merge. These are claimant notes rather than raw failure/cleanup logs; none claims or demonstrates the pre-discovery boundary that exposes M1. No formal exact-head verification yet.

Source verdict **not clear**, fail C1 for incomplete bounded startup-failure cleanup. Implement the ownership/cleanup correction and controlled red/green + whole affected-file proof, push a new head and request delta source review before verification. No generic dev merge after this first review except Coordinator authorization/conflict. QA policy none/after-stage; no per-item QA.

Findings: Standards1 medium (M1); Spec0 separate findings, C1 blocked by M1.

Artifact A-3826 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3826-t-476-source-not-clear-startup-timeout-before-discovery-leaves-daemon-unowned.md

Criteria: C1 failed (A startup timeout before hub.json exists kills only the CLI; the detached daemon remains unowned and can outlive fixture removal. Add discovery-independent bounded cleanup proof.).

### rev-30 · 2026-10-16T07:37:07.313Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-476-correction
commit: 4dd3a151b224107827b7a868e8183e0d640aca03
scope: delta

# T-476 correction delta source review clear

Reviewed pushed head `4dd3a151b224107827b7a868e8183e0d640aca03`, branch `t/T-476-a-hub-start-up-smoke-test-in-the-suite-a`; origin agrees. Delta against first-reviewed52c001d5: startup-smoke.test.ts ownership/hang proof, README and one reasoned duration allowance; no production, selection or post-review dev merge. task.view confirms live claimant and restored C1 done. Direct read-only review; no Reviewer execution/subagents.

## Standards

M1 from A-3826 is resolved. Remaining findings0 high/0 medium/0 low.

The smoke writes a test-only preload that wraps the actual CLI process's native spawn call and sends the detached hub-serve PID over IPC. Every CLI child is registered; the received daemon PID is registered immediately, before hub.json/readiness. Production still chooses its own entry, detach/log/socket behavior; no production readiness bypass or fake daemon replaces the healthy path. Status must name the same observed PID.

I checked process-cleanup ordering: ownProcess resources stop first; beforeDirectories hooks then require exact PID disappearance with a3s bound, repeat the final assertion, stat the still-existing root and emit the cleanup receipt; directory disposal follows. Ownership no longer depends on readDiscovery. The CLI timer covers its spawn/ownership-observation overhead and uses the remaining monotonic startup deadline; it is cleared on close/error. Existing ownership identity checks govern actual process cleanup.

The pre-discovery regression holds the real hub-serve process before daemon import/discovery, writes a PID/root receipt, and makes the outer test own that held PID while alive, containing even a regression that leaks the inner daemon. It runs the exact healthy smoke in a child worker, requires failure/last structured event, PID already gone when that worker exits, the PID-gone-before-removal diagnostic, and the inner fixture root absent. This directly proves the M1 boundary and rule12 ordering rather than only a stop acknowledgement. The listening-but-silent proof remains separate, including non-JSON stderr after its event.

## Spec

Source C2/C3 verified. Unchanged selection wiring adds the startup file to HUB_SMOKE for nvim-only and coverage-selected modes; full/hub-only include it through all-hub globs. Existing real package-runner/coverage-map fixtures assert execution/preservation. README now documents both hang boundaries and discovery-independent ownership.

C1 implementation is corrected: a real candidate CLI start and socket-backed status share one10,000ms readiness budget. It then serves a tracker request and stops with bounded exact PID/discovery/socket assertions. Both hang tests require inner failed test duration<12s (10s readiness plus2s fixture/report overhead), with a separate20s subprocess escape bound. These are distinct bounds, not a claim that the entire test file lasts10s.

## Evidence

A-3830 contains exact controlled red and final whole-file green excerpts. Before ownership correction, pre-discovery regression fails on `PID still alive when smoke exits` (true versusfalse), confirming the reviewed leak rather than a diagnostic mismatch. The outer test owns the hung fixture for containment.

Corrected whole file: **3/3**, no fail/cancel/skip,21.519s total: pre-discovery10.334s, listening10.352s, healthy0.603s, with PID-gone-before-root-removal receipt. A reasoned observed10.323s allowance covers the deliberately ten-second new regression; the existing listening allowance remains unchanged. Typecheck/shard lint/whitespace are reported green in A-3830; the artifact contains excerpts, not a separate full raw-log bundle.

A-3818/A-3821's selection85/85 and changed integrated-map1/1 evidence still covers unchanged selection inputs; source selection audit independently confirms all automatic modes. No new full local suite or formal verification yet.

Source delta clear; verify **C2/C3** only. C1/final remains pending fresh exact-head diff-selected droplet verification, including healthy startup, both hang cases and new-test repetitions. Any new own assertion/load failure blocks final settlement. No per-item QA (none/after-stage); any changed head needs delta review under rule11.

Findings: Standards0 remaining (M1 resolved); Spec0.

Artifact A-3831 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3831-t-476-correction-source-clear-detached-daemon-owned-before-discovery-with-teardo.md

Criteria: C2 verified, C3 verified.

### rev-30 · 2026-10-16T08:17:05.652Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-476-final
commit: 4dd3a151b224107827b7a868e8183e0d640aca03
scope: evidence

# T-476 final evidence clear under explicit hub-phase gate disposition

Reviewed unchanged pushed `4dd3a151b224107827b7a868e8183e0d640aca03`, branch `t/T-476-a-hub-start-up-smoke-test-in-the-suite-a`; local/origin refs agree. Current claimant/criteria and hold checked. Source correction **A-3831 /rev-20261016-476-correction** verified C2/C3, resolved discovery-dependent ownership M1; no later source/head change. No Reviewer test/compiler/process/provider execution or edits.

## Standards

No remaining high/medium/low finding. Corrected source owns actual daemon PID before discovery, exact bounded reap before directory removal and both separate hang boundaries. Original readiness/diagnostic assertions remain. This pass audits runtime evidence rather than revisiting unchanged source.

## Spec / owned runtime evidence

Refresh **C1–C3**. **A-3851 /9955455a-7ee4-47aa-bca2-9074a1e78d0b** actualLinux c-8 lon1/x64,fourworkers,Node24.21.0/Neovim pin0.12.5:1924tests/1916pass/3fail/5skip,exit1. Whole raw log independently read through uncapped tail.

All three smoke cases pass ordinary and **5/5 fresh repetitions each (15/15)**:
- pre-discovery hang parent12.258984937s;
- listening-but-silent hang parent11.780349528s;
- healthy CLI/socket/tracker/stop2.995158047s.
The parent includes spawning/teardown/report overhead; its duration is not the single10s inner readiness bound. Committed assertions require inner bounded failure/structured-event diagnostic and PID-gone/root cleanup; the successful assertions and explicit log3054 `startup cleanup: pid206852 gone before fixture removal` retain proof of lifecycle ordering. Existing C2 selection tests and source audit establish every automatic hub selection; C3 README unchanged.

## Known outside reds and missing phase

Three ordinary reds: demo.test.ts:71 run-timeout/machine-lifetime watchdog cases `demo deadline reached during delivery` (T-569), and tracker-levels.test.ts:87 parent-close recheck true-vsfalse (T-584). Six hard budget lines, all outside task diff: four demo-release identities (earlier-delete lost-tags6.508s; persistent tags7.397s; persistent id5.296s; detached watchdog8.104s), tracker-load20sessions/200000events5.714s, and verdict-findings CLI/MCP severity/journal5.469s. The sixth was absent from capped hub result but is retained in the raw tail and this review. No unknown failure or own smoke budget miss is omitted.

**Primary Coordinator fc3c84c5-f750-4c77-aa31-4d7ac7e4691c**, directly delivered to Reviewer, explicitly accepts this hub phase: T-569/T-584 ordinary reds and six budgets covered by posted shared5b29038c/4ffbe84f on dev. No pick/head change or further task run required.

Mode full stops after hub; **Neovim was not run and is not claimed green**. Same primary disposition defers it to the **next integrated dev cover before any hub restart on T-476 code**. Carry this Coordinator-owned condition forward. No waiver is inferred merely from outside-diff status.

Suite2007.73s,peak16.11,load-gate extra23.27s,lifetime/costunknown. No hard budget failure is rewritten as a green run. Final evidence **clear under explicit gate disposition**, C1/C2/C3 refreshed; no per-item QA. Current E-468 freeze/order remains Coordinator-owned. Findings: Standards0; Spec0.

Artifact A-3861 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3861-t-476-final-clear-owned-smoke-15-15-integrated-neovim-required-before-restart.md

Criteria: C1 verified, C2 verified, C3 verified.
