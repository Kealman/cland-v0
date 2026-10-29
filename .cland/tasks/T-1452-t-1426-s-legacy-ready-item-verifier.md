---
id: T-1452
kind: task
title: T-1426's legacy ready-item verifier-routing case reads who before the queued review's pending marker is recorded, under load
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
regression_of: T-1426
found_by: cover
topic: topic-1220
branch: t/T-1452-t-1426-s-legacy-ready-item-verifier
created: 2026-10-29T20:55:10.106Z
updated: 2026-10-29T21:22:21.591Z
closed: 2026-10-29T21:22:21.591Z
---

## Summary

The case `legacy ready-item pending after restart cannot block the oldest queued review` in `hub/test/verifier-routing.test.ts` (added by T-1426) failed 1 of 5 load-gate repetitions in the E-1444 macOS stage cover. It waits for the reviewer's delivery event and then reads `who` once, so under load `who` can run before the hub has recorded the pending reservation.

## Evidence

Stage cover 36bbdd50 (local macOS, occasion stage, workers 2) at dev 37f9d65c, log A-14118: `load gate: hub/test/verifier-routing.test.ts::legacy ready-item pending after restart cannot block the oldest queued review 4/5 passed`. Repetition 3: `who.find(s => s.name === 'rev-d')?.pending` was `undefined`; expected `{ item: <next>, kind: 'review' }`. All 3550 ordinary tests passed; T3 and Web did not run after the T2 failure. The identity passes 5/5 alone on the Mac (coord, 2026-10-29 ~21:00Z).

## Acceptance criteria

- [x] C1. The case waits for the pending reservation through an explicit hub receipt or a bounded eventually on `who` rather than a single read after delivery, with its assertions otherwise unchanged; or, if the cause is a product ordering bug (pending recorded after delivery is observable), the hub records pending before delivery and the case proves it.
  - done: impl-1452 · 2026-10-29T20:57:57.499Z
  - verified: rev-26 [reviewer] · run rev-20261029-1452-source-1 · 2026-10-29T20:59:26.862Z · commit e5149cfc4b7572ad1d97b03a44f81ee2168eed01
  - verified: rev-26 [reviewer] · run rev-20261029-1452-evidence-1 · 2026-10-29T21:15:34.852Z · commit e5149cfc4b7572ad1d97b03a44f81ee2168eed01
- [x] C2. The identity passes 10/10 at two workers plus owned CPU load on macOS.
  - done: impl-1452 · 2026-10-29T20:57:57.904Z
  - verified: rev-26 [reviewer] · run rev-20261029-1452-evidence-1 · 2026-10-29T21:15:34.852Z · commit e5149cfc4b7572ad1d97b03a44f81ee2168eed01

## Comments

### impl-1452 · 2026-10-29T20:55:59.245Z

Scope/seam: existing T2 real send/who/session.list frames in sealed projectHub fixture. Red evidence is E-1444 cover 36bbdd50 at 37f9d65c / A-14118: legacy ready-item queued case repetition 3 sees pending undefined, expected next review. Will wait boundedly for exact pending reservation before keeping existing assertions. No production/shared contract change; no consumer migration. C2 macOS exclusive two-worker CPU-load receipt requested from Coordinator.

### rev-26 · 2026-10-29T20:59:26.862Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261029-1452-source-1
commit: e5149cfc4b7572ad1d97b03a44f81ee2168eed01
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14122: Standards clear; Spec clear. Exact queued-review delivered-stage wait follows core.ack's atomic delivery/pending transaction, preserving all pending/FIFO/session-row assertions and production semantics. C1 source-established. Original A-14118 remains red; A-14120/A-14121 derived local 10-run/CPU receipts and missing raw stdout/independent join details are labeled explicitly. C2 and final runtime evidence remain pending unchanged-head configured verification. No Reviewer execution.

Criteria: C1 verified.

### rev-26 · 2026-10-29T21:15:34.852Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261029-1452-evidence-1
commit: e5149cfc4b7572ad1d97b03a44f81ee2168eed01
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14124: final Standards/Spec clear, C1/C2 verified. Original A-14123 exact-head exit0:4225 ordinary+75 scoped load passes, no other outcomes/unmatched starts; all19 verifier-routing base identities pass, repaired ready-item0.162746163s with zero Linux load repetitions. C2 separately established by A-14120/A-14121 ten derived exact-name macOS runs/two lanes/native close statuses/positive CPU progression, with raw-output/join/head-attribution limits retained. HostT0 and LinuxT1/T2/Web complete;T3/T4 unrun; report-only diagnostics retained. Original A-14118 remains failed historical evidence. No Reviewer execution.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-29T21:22:21.591Z

Merged af0297857478de741268c8db2c15e082ae5adcfc onto dev.
