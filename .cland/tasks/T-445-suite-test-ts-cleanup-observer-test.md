---
id: T-445
kind: task
title: suite.test.ts cleanup-observer test times out under full-suite load (unverified cleanup preserved, 15 s)
state: open
status: review
size: S
criterion_seq: 1
labels:
  - v0.1.3
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
regression_of: T-203
topic: topic-284
branch: t/T-445-suite-test-ts-cleanup-observer-test
created: 2026-10-15T00:40:00.743Z
updated: 2026-10-15T09:35:03.984Z
---

## Summary

`hub/test/suite.test.ts` 'failure cleanup preserves a live worker whose recorded start identity is unavailable' (line 784 at b874faa1, 943 on dev) failed in T-433's full local run 54e82e23 (A-2608): `unverified cleanup preserved: not within 15000 ms` at line 798. The whole file passed 5/5 alone at the same head (A-2623), with the case taking 3–4 s. It is a load-sensitive observer wait, and it got the flaky rule's one resubmit.

## Acceptance criteria

- [ ] C1. The wait observes the cleanup outcome event or its durable record, not a 15 s poll. Pre-merge: one loaded whole-file run and the gate verify are green (Coordinator amendment 2026-10-15 09:35Z, under the load cap); the 5/5 runs beside a local full run are taken at E-482's epic QA.

## Comments

### impl-445 · 2026-10-15T09:23:08.707Z

Replaced repeated hub.status polling with a subscription-before-read observer: check the exact run's durable suite-jobs cleanup error, otherwise await its buffered terminal task event and assert that durable error. Existing worker-alive, no-result and natural-completion assertions remain; 15 s ceiling unchanged. Baseline targeted case passed in 4.69 s; changed case passed in 3.80 s. Historical load reproduction is already recorded in T-445; avoiding a new full-run repro per current load policy. E-482 stage QA owns 5/5 load and Linux sweep.

### impl-445 · 2026-10-15T09:29:17.639Z

Loaded whole-file run 1 passed 70/70 in 323.0 s at 5aad3438; changed cleanup case 3.01 s. Log A-2824, load queue evidence A-2825 (impl-454 local full run). Implementation note A-2821. Remaining loaded runs 2–5 are held by Coordinator's load cap. Source pushed and origin/dev fetched/merged (already current). C1 stress evidence remains incomplete until all five loaded runs; Linux proof will come from post-source-review cland verify.

### rev-30 · 2026-10-15T09:32:29.042Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-445-source
commit: 5aad3438deae43ed63e6deb909d971c80d797660
scope: full

Source review clear; no high, medium or low findings.

Standards: no findings against repo test guidance or the smell baseline.
Spec: hub/test/suite.test.ts:968–981 subscribes before the exact-run durable read, falls back to buffered terminal task frames, and asserts the full preservation error. Persistence precedes the cleanup-error announcement; existing worker-alive, no-publication and natural-exit assertions remain at lines 983–987. Only the test observer changes.

C1 remains unverified: its source portion is established, but the combined criterion requires 5/5 loaded whole-file passes. A-2824/A-2825 support run 1 only; runs 2–5 are pending under the Coordinator load cap. Same-head post-source-verdict Linux verification is pending. This is a source verdict, not final verification.
