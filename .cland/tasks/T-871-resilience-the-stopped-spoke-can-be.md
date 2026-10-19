---
id: T-871
kind: task
title: "resilience: the stopped spoke can be swept before alpha's send, so the send returns no outcomes (load flake)"
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - flake
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-593
branch: t/T-871-resilience-the-stopped-spoke-can-be
created: 2026-10-19T12:16:19.694Z
updated: 2026-10-19T14:39:24.094Z
closed: 2026-10-19T14:39:07.143Z
---

## Summary

`hub/test/resilience.test.ts` "a spoke acks every deliver and hands a message re-sent under the same id to its session once" failed in merge batch 8942325b (run 22fe413f, A-6016) at line 172 with `TypeError: Cannot read properties of undefined (reading 0)`. `sent.outcomes` was undefined, so alpha's send to beta returned no outcomes. Most likely the 100 ms keepalive sweep had already dropped the SIGSTOPped beta before the send. All three leave-one-out reruns passed 11/11 (A-6017, A-6018 and the T-509 omission).

## Acceptance criteria

- [x] C1. The case sends to beta only after observing that beta is still present with its socket open after the stop, or it asserts the send reply shape before reading outcomes. Either way the race between SIGSTOP and the keepalive sweep is closed on an observed boundary, every existing assertion stays, and a red-to-green proof delays the send past one keepalive.
  - verified: rev-30 [reviewer] · run rev-20261019-871-source · 2026-10-19T13:41:42.663Z · commit 8960e2e805dcdbe96e790c38c62e18af004c02f5
  - done: impl-871 · 2026-10-19T13:41:55.312Z
  - verified: rev-30 [reviewer] · run rev-20261019-871-final · 2026-10-19T13:48:07.752Z · commit 8960e2e805dcdbe96e790c38c62e18af004c02f5
- [x] C2. resilience.test.ts passes 20/20 serially on the Mac, whole file and alone, and the mode-free task verify passes at the reviewed head; the T3 Linux run comes from the merge batch that lands this item and is recorded by the Coordinator as landing evidence, not as a gate.
  - done: impl-871 · 2026-10-19T13:47:32.666Z
  - verified: rev-30 [reviewer] · run rev-20261019-871-final · 2026-10-19T13:48:07.752Z · commit 8960e2e805dcdbe96e790c38c62e18af004c02f5

## Comments

### impl-871 · 2026-10-19T13:34:33.894Z

Controlled red reproduced on macOS: injecting a 350 ms delay after SIGSTOP into the existing test makes beta's send outcome queued, failing the unchanged delivered assertion (691 ms). This confirms the silent-beta keepalive sweep race. Investigating moving SIGSTOP to the synchronous committed-message publication boundary, before delivery, so alpha's scheduling delay occurs while beta can still heartbeat.

### impl-871 · 2026-10-19T13:38:03.799Z

Implemented and pushed 8960e2e805dcdbe96e790c38c62e18af004c02f5 on t/T-871-resilience-the-stopped-spoke-can-be after fetch/merge origin/dev (already current). Stops beta at synchronous committed-message publication before delivery; validates ok/outcomes before indexing; retains all five original assertions. Controlled 350 ms proof: old source red (queued vs delivered), fixed source green plus 5/5 delayed repetitions, A-6063. Final source full file macOS 20/20 serial (220/220 tests), 5.655–6.525 s wall per file, A-6064. npm run typecheck and npm run test:lint passed (existing report-only debt). No QA brief needed: qaPolicy scope none, no qaCriteria. Awaiting source review before mode-free task verify; Linux T3 is merge-batch landing evidence.

### rev-30 · 2026-10-19T13:41:42.663Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-871-source
commit: 8960e2e805dcdbe96e790c38c62e18af004c02f5
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at exact 8960e2e8; no findings. A-6067 records Standards/Spec audit: matching committed-message subscription stops beta synchronously before delivery, closing the stop-to-send keepalive gap while preserving every original assertion; ok/outcomes shape and paused callback are checked before indexing. A-6063 controlled 350 ms delay proves old queued failure → corrected green, plus five delayed passes. A-6064 independently counted 20 serial whole-file Mac exits 0, 220/220 tests, no failures/cancellations/skips/TODO, wall 5.655–6.525 s. C1 verified; C2's mode-free exact-head task receipt remains outstanding. Native Linux T3 remains Coordinator landing evidence per C2. No Reviewer test execution.

Criteria: C1 verified.

### impl-871 · 2026-10-19T13:42:06.005Z

Source review clear rev-20261019-871-source / A-6067 at unchanged 8960e2e8. Submitted required mode-free verify: 4c21eacb-ddcd-478b-8f90-effd1d266692, configured droplet executor, report topic-593, to source Reviewer and claimant. C1 done mark recorded; C2 awaits green same-head receipt.

### rev-30 · 2026-10-19T13:48:07.752Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-871-final
commit: 8960e2e805dcdbe96e790c38c62e18af004c02f5
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear, no findings. A-6071 records full A-6070 audit: mode-free run 4c21eacb at exact reviewed 8960e2e8, ordinary 418/418 with zero fail/cancel/skip/TODO, 190 load-gate groups all 5/5 and zero tier-mismatch rows. Linux droplet lifetime 299 s/$0.0208. Native resilience T3 did not execute in this task gate; C2 expressly assigns that run to Coordinator-owned landing evidence. Its item gate is satisfied by this passed mode-free receipt plus independently audited A-6064's 20/20 serial whole-file Mac passes, 220/220 tests; C1 retains A-6067 source and A-6063 delayed red→green proof. Both claimant done marks present. Report-only inherited budget/baseline debt retained, including T-872 .508 s versus .5 s. C1–C2 verified; no new run or source change.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-19T14:39:07.143Z

Merged 40d7191750fd6eef7555bbd6e68401b007833fbd onto dev.

### coord · 2026-10-19T14:39:24.094Z

Landing evidence (C2, Coordinator-owned, not a gate): merge batch with T-870, T-871 and T-856, run 3c90c8ec, Linux x64 c-8 lon1 (A-6088). Native resilience.test.ts passed whole-file (12 pass, 0 fail), including 'a spoke acks every deliver and hands a message re-sent under the same id to its session once'. Landed at 40d71917.
