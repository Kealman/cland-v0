---
id: T-1962
kind: task
title: waitForWorkerAdmission admits a worker whose SIGTERM is already set when the gate is ready on the first check
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2074
blocked_by: []
topic: topic-1743
branch: t/T-1962-waitforworkeradmission-admits-a-worker
created: 2026-11-18T07:40:42.589Z
updated: 2026-11-24T14:27:06.423Z
closed: 2026-11-24T14:27:06.423Z
---

## Summary

Found by the T-1894 reviewer (2026-11-18) from the source, with no runtime failure seen yet. `waitForWorkerAdmission` in hub/src/suite-worker-admission.ts checks the stop signal only inside its gate-not-ready loop. When the gate is ready on the first check and SIGTERM is already set, it returns `admitted: true`, so `runWorkerWithAdmission` calls `options.run` and the real worker starts its identity and Git setup before any later signal check. No existing item mentions `waitForWorkerAdmission`.

## What to build

Check the signal before admitting, on the first pass as well as in the wait loop, so an interrupted worker is never admitted. The refusal carries the same structured cause as the in-loop interruption.

## Acceptance criteria

- [x] C1. With an immediately ready gate and a signal already set, admission returns `admitted: false` with cause "worker interrupted by SIGTERM", and `options.run` is never called (test with a FakeClock and fake run).
  - done: impl-1962 · 2026-11-24T12:36:31.695Z
  - verified: rev-35 [reviewer] · run rev-35-1962-evidence-1 · 2026-11-24T13:14:04.206Z · commit a17608f08362e8070112a5d5c68db77d6cceb6e9
- [x] C2. A ready gate with no signal still admits on the first check, with no added wait (test).
  - done: impl-1962 · 2026-11-24T12:36:32.073Z
  - verified: rev-35 [reviewer] · run rev-35-1962-evidence-1 · 2026-11-24T13:14:04.206Z · commit a17608f08362e8070112a5d5c68db77d6cceb6e9

## Comments

### impl-1962 · 2026-11-24T12:01:04.600Z

Consumer census (rg function/type names, file importers, interruption/gate causes and job.result across hub, nvim, docs and shipped skills): waitForWorkerAdmission is used only by runWorkerWithAdmission; production suiteWorker injects its gate/signal/run and persists WorkerCompletion. hub/test/suite-worker-cause.test.ts covers receipt shape and signal/cleanup behavior. The existing producing-tier-receipts test sets SIGTERM before admission while expecting run output; migrate it to set the signal during run, matching its post-run purpose. Wire shape, result readers, frozen CLI usage, docs/briefs and T3/T4 consumers remain unchanged: this restores the existing interruption refusal for an immediately ready gate, with no field or public wording change.

### rev-35 · 2026-11-24T12:38:03.355Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1962-source-1
commit: a17608f08362e8070112a5d5c68db77d6cceb6e9
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-22937: Standards0/Spec0. Every awaited gate result now checks interruption before ready admission; refusal cause/receipt, deadline and polling delay unchanged. New pure FakeClock/fake-run controls assert preset-SIGTERM refusal with zero setup and immediate no-signal admission with exactly one check/no timer. Existing producing-receipt control now signals during run, preserving post-run assertions. Shared-helper consumers inspected; no shape/public wording change; T-1945 diagnostic/final-persist sequence unchanged. A-22935 reports local13/13 and conservative34/34 T1 plus typecheck/lint0, not configured verification. C1/C2 done/unverified pending actual same-head run. No reviewer tests/probes/edits. Hold releases for Coordinator mode-free window at unchanged head.

### rev-35 · 2026-11-24T13:14:04.206Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1962-evidence-1
commit: a17608f08362e8070112a5d5c68db77d6cceb6e9
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-22958: same-head configured 5cca29d2/A-22956 finished passed, code 0/cause empty. Both exact ready-gate controls pass base plus five distinct loaded identities each; the retained producing-receipt case passes and full worker-cause file is 13/13. C1/C2 verified current. T0/all 243 T1/all 445 T2/seven selected T3/all 55 Web completed exit 0; 266 T3 deferred, T4 unexecuted. Hub aggregate 7480 tests/7479 pass/one prerequisite skip/zero fail; ten passing load records and five skips separate. Linux x64 droplet Node 24.21.0, nvim 0.12.5, Headless 1248/CfT 156.0.8078.4. Budgets/lint report-only; earlier red and known F2 rows retained separately. No reviewer tests, probes, reruns or source changes.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-24T14:27:06.423Z

Merged 58104b5599425f85c3b01093eca02e6498e51c2a onto dev.
