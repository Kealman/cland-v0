---
id: T-445
kind: task
title: suite.test.ts cleanup-observer test times out under full-suite load (unverified cleanup preserved, 15 s)
state: closed
status: done
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
updated: 2026-10-15T11:07:04.970Z
closed: 2026-10-15T11:07:04.970Z
---

## Summary

`hub/test/suite.test.ts` 'failure cleanup preserves a live worker whose recorded start identity is unavailable' (line 784 at b874faa1, 943 on dev) failed in T-433's full local run 54e82e23 (A-2608): `unverified cleanup preserved: not within 15000 ms` at line 798. The whole file passed 5/5 alone at the same head (A-2623), with the case taking 3–4 s. It is a load-sensitive observer wait, and it got the flaky rule's one resubmit.

## Acceptance criteria

- [x] C1. The wait observes the cleanup outcome event or its durable record, not a 15 s poll. Pre-merge: one loaded whole-file run and the gate verify are green (Coordinator amendment 2026-10-15 09:35Z, under the load cap); the 5/5 runs beside a local full run are taken at E-482's epic QA.
  - done: impl-445 · 2026-10-15T11:06:07.758Z
  - verified: rev-30 [reviewer] · run rev-20261015-445-final · 2026-10-15T11:06:42.819Z · commit 5aad3438deae43ed63e6deb909d971c80d797660

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

### impl-445 · 2026-10-15T09:56:00.367Z

Same-head Linux gate d479c493 failed outside scope: codex-adapter.test.ts:997 late reject pending steer response, `impl present as idle: not within 15000 ms`. 1716 passed, 1 failed, 3 skipped; A-2845. The changed cleanup test passed (4.386 s); suite.test.ts had no failures. C1 remains open because amended criterion requires green gate. Reported S/Bugs find and requested lead decision on one same-head resubmit vs waiting for Codex fixture fix. No source changes since clear review.

### rev-30 · 2026-10-15T09:56:06.014Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261015-445-gate-failed
commit: 5aad3438deae43ed63e6deb909d971c80d797660
scope: evidence

Final evidence review not clear.

Medium — hub/test/codex-adapter.test.ts:997: same-head Linux gate d479c493 / A-2845 fails waiting for initial impl idle (`impl present as idle: not within 15000 ms`) in the late reject pending steer response case, before its scenario begins. A failed gate cannot satisfy amended C1's green-gate requirement.

Standards: no new source findings; observer source verdict rev-20261015-445-source stands as the source assessment.
Spec/evidence: changed cleanup-preservation test passed in 4.386 s (A-2845:3287), and A-2824/A-2825 establish the required loaded whole-file pass. The failure is in unchanged Codex adapter test source; no cleanup-observer defect established.

Gate exact head 5aad3438deae43ed63e6deb909d971c80d797660 matches source review and current branch. Linux droplet: 1720 tests, 1716 pass, 1 fail, 3 skip, 0 cancelled; exit 1. C1 failed for missing green gate evidence; 5/5 stress remains E-482 epic QA per amendment.

Criteria: C1 failed (Required green gate missing: d479c493 exited 1 on codex-adapter.test.ts:997 initial impl idle timeout; changed cleanup case passed.).

### impl-445 · 2026-10-15T10:19:58.146Z

Authorized same-head droplet retry 7c73ba03 again failed only outside scope on T-467's Codex initial-idle observer pattern: codex-adapter.test.ts:880, `impl present as idle: not within 15000 ms`. A-2868: 1716 passed, 1 failed, 3 skipped. suite.test.ts remained green on Linux; cleanup case 4.332 s. Submitting one same-head --executor local gate per Coordinator standing rule cb6eaf4c and explicit decision 1dc1d9d7. Reviewer will cite both droplet logs as Linux evidence.

### rev-30 · 2026-10-15T10:20:01.235Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261015-445-linux-retry
commit: 5aad3438deae43ed63e6deb909d971c80d797660
scope: evidence

Evidence review remains not clear; no new observer source findings.

Medium — hub/test/codex-adapter.test.ts:880: authorized Linux retry 7c73ba03/A-2868 fails initial impl idle wait after 15 s in the late-rejected-steer pending-admission case. It is the same startup-idle timeout family as prior :997 assigned to T-467, outside T-445's diff. Gate remains red: 1716 pass, 1 fail, 3 platform skips, exit 1.

The touched cleanup-preservation case passes again in 4.332 s (A-2868:3286); suite.test.ts has no failures. First Linux d479c493/A-2845 also has green cleanup evidence (4.386 s), with overall red retained. Both runs match exact reviewed/current 5aad3438deae43ed63e6deb909d971c80d797660.

C1 remains unverified; existing failed mark for missing accepted green gate stands. Coordinator's direct fallback authorization and standing rule cb6eaf4c allow one same-head local merge gate with both Linux touched-file proofs. Final review awaits that green result. No Reviewer test or retry started.

### rev-30 · 2026-10-15T11:06:42.819Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-445-final
commit: 5aad3438deae43ed63e6deb909d971c80d797660
scope: evidence

Final evidence review clear under replacement human gate rule e6264b46-4524-4b3d-8e77-152fa135680c (ask 9183a54c). No unresolved T-445 source finding; reviewed/current head remains 5aad3438deae43ed63e6deb909d971c80d797660.

Standards: source verdict rev-20261015-445-source stands, no findings.
Spec: C1 verified against its amended pre-merge requirement. Source observes exact-run durable cleanup outcome with buffered-event fallback; existing safety/publication/natural-exit assertions remain. A-2824/A-2825 supply the required loaded whole-file 70/70 pass. Remaining 5/5 stress remains E-482 epic QA.

The explicit human rule accepts these two Linux receipts as the merge gate: d479c493/A-2845 sole failure is `a successful completion reconciles a late reject pending steer response` at Codex :997; retry 7c73ba03/A-2868 sole failure is the different test `a successful completion before a late rejected steer response never replays a pending admission` at Codex :880. Both are known T-467 initial-idle timeouts; touched suite.test.ts is green in both, cleanup 4.386 s and 4.332 s respectively. Both exact heads match; both receipts remain overall red (1716 pass, 1 fail, 3 platform skips, exit 1). Acceptance follows e6264b46, not a claim those suites passed. Neovim smoke was not reached.

Superseded queued local 625b840e/A-2915 cancelled without tests; no local evidence used. Implementer asked to restore C1 done after prior failed gate mark. Review artifact A-2918.

Criteria: C1 verified.

### coord · 2026-10-15T11:07:04.970Z

Merged 0ab904f2a7d6b7d2f2a1f64bc4dc0fc77442ec70 onto dev.
