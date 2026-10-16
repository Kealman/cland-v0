---
id: T-658
kind: task
title: Task runs wait for a droplet instead of falling back to the Mac
state: open
status: ready
size: S
rank: 4419
criterion_seq: 3
labels:
  - v0.1.4
  - flaky
  - verification
  - hub
assignee: null
parent: E-482
blocked_by: []
topic: topic-400
branch: t/T-658-task-runs-wait-for-a-droplet-instead-of
created: 2026-10-16T16:29:56.442Z
updated: 2026-10-16T18:32:26.811Z
---

## Summary

The Mac hosts 7–16 harness sessions and the hub, so a task run that falls back to it runs at load 15–25 and goes red about half the time (A-4004, recommendation 1). With droplet as the project executor, a task run should wait for a droplet slot instead of falling back to local.

## What to build

A `[verification] local_fallback` setting, default `true`, written `false` in this project's config. When it's false and the executor is droplet, a task run whose remote slots are full waits in the queue with its position and ETA instead of running locally. An explicit `--executor local` still runs locally, and the human's own `npm test` is unchanged. `cland verify queue` reports the setting.

## Acceptance criteria

- [x] C1. With local_fallback = false, a task verify submitted while every remote slot is busy stays queued and runs on the next free droplet, never locally, proved by a suite-queue test with fake slots.
  - done: impl-658 · 2026-10-16T16:43:34.362Z
  - verified: rev-30 [reviewer] · run rev-20261016-658-final · 2026-10-16T18:32:25.730Z · commit 59d2474d817185d73775c8758f74e76a51638176
- [x] C2. With local_fallback = true (the default) today's fallback behaviour is unchanged, and `--executor local` always runs locally, proved by the same test file.
  - done: impl-658 · 2026-10-16T16:43:36.556Z
  - verified: rev-30 [reviewer] · run rev-20261016-658-final · 2026-10-16T18:32:25.730Z · commit 59d2474d817185d73775c8758f74e76a51638176
- [x] C3. `cland verify queue --json` reports the setting, and docs/agents/tests.md describes it.
  - verified: rev-30 [reviewer] · run rev-20261016-658-source · 2026-10-16T16:43:15.104Z · commit 59d2474d817185d73775c8758f74e76a51638176
  - done: impl-658 · 2026-10-16T16:43:37.746Z
  - verified: rev-30 [reviewer] · run rev-20261016-658-final · 2026-10-16T18:32:25.730Z · commit 59d2474d817185d73775c8758f74e76a51638176

## Comments

### impl-658 · 2026-10-16T16:32:45.874Z

Implementation seam: existing suite-remote-budget fake-slot integration test, expanded to cover config-disabled fallback, explicit local progress, queue JSON setting/position/remote ETA; parser validation and render roundtrip. Local targeted runs held while uptime 1-minute load is >=15.

### impl-658 · 2026-10-16T16:39:16.526Z

Implemented and pushed 59d2474d817185d73775c8758f74e76a51638176. Local targeted file: exit 0, 18/18 pass (started load 14.94); npm run typecheck: exit 0 at committed head (started load 14.54). Config default true/project false, remote-only queue admission and JSON/text setting covered. origin/dev 63fcd35d merged before review. No per-item QA required by qaPolicy.

### rev-30 · 2026-10-16T16:43:15.104Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-658-source
commit: 59d2474d817185d73775c8758f74e76a51638176
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source review clear at 59d2474d817185d73775c8758f74e76a51638176, compared with pre-review dev 63fcd35d. Standards and spec reviewed in-session; no findings.

The strict boolean setting defaults true and is rendered, forwarded by daemon configuration, and applied to queued implicit requests on reload and admission. Disabled fallback sets the existing requireRemote policy; both scheduler admission and acquisition-failure fallback respect it. Explicit local requests and human slot reservations retain their separate local path. Existing cancellation and lifecycle ownership remain unchanged.

C3 established: queue JSON carries localFallback, text exposes the policy, and docs/agents/tests.md describes defaults, project false, remote wait/ETA and explicit local behavior. The expanded real CLI/fake-slot test covers false-policy waiting, remote ETA, next remote admission and local progression; existing default-true fallback tests remain. The added worker-result receipt precedes the downstream report wait.

A-4026 reports the whole remote-budget file 18/18 green and exact-head typecheck green; these are claimant summary receipts. The new 20.165 s allowance names its exact new identity and process cost. Read-only git diff --check passed. C1/C2 remain unverified pending the normal exact-head task verification. No per-item QA criteria.
Evidence: A-4028.

Criteria: C3 verified.

### impl-658 · 2026-10-16T18:32:19.015Z

Exact reviewed head 59d2474d817185d73775c8758f74e76a51638176 passed droplet verify f63bcaef-9eb9-4308-9a32-152f2ca66a51, exit 0: 2350 tests, 2342 pass, 0 fail, 8 skipped. Log A-4108 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-4108-suite-f63bcaef-9eb9-4308-9a32-152f2ca66a51-auto-at-59d2474.log. Checked both new tests passed base execution and load-gate repetitions 5/5 each (log lines 3145 and 3323). Linux c-8 lon1 lifetime 1925s, cost $0.1337. Tree/head unchanged; awaiting Reviewer final evidence verdict.

### rev-30 · 2026-10-16T18:32:25.730Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-658-final
commit: 59d2474d817185d73775c8758f74e76a51638176
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-658 final evidence clear at unchanged source-reviewed 59d2474d817185d73775c8758f74e76a51638176. A-4028 source review applies; no findings.

Independently inspected A-4108 / f63bcaef-9eb9-4308-9a32-152f2ca66a51. Header names the exact reviewed head. Host/remote typechecks, full hub and full Neovim phases complete with exit 0: hub free 38/38, hub machine 1914 pass/zero fail/five prerequisite skips, Neovim 390 pass/zero fail/three sandbox skips. Aggregate 2350 tests, 2342 pass, zero failures, eight skips. No hard budget or failed load-gate line.

C1: disabled-fallback fake-slot case passes ordinarily in 21.552 s and 5/5 fresh repetitions (line 3323). Reviewed assertions require free local holder untouched, waiter remote/position/ETA, no over-budget droplet creation, next remote admission and independent explicit local progress. C2: default-true/strict-boolean/render case passes ordinarily and 5/5 (line 3145); existing both fallback-slot variants pass in 20.937/19.198 s, explicit-droplet wait plus explicit-local progress in 21.586 s, and human-slot independence cases pass. All eighteen remote-budget file cases are green. C3 queue JSON/text assertions execute in the same cases; source documentation remains current.

The earlier run 9f4ba11f/A-4085 was cancelled before execution under the Coordinator's one-time priority refresh; it is not counted as evidence. This replacement executes at the same head. Eight skips concern platform/binary prerequisites, not owned cases.

Linux x64 c-8 lon1, Node 24.21.0, Neovim 0.12.5, four workers; suite 1837.66 s, peak load 13.85, lifetime 1925 s, cost $0.1337. All C1–C3 verified; no per-item QA criteria.
Review artifact A-4109.

Criteria: C1 verified, C2 verified, C3 verified.
