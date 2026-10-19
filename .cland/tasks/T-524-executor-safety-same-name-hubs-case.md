---
id: T-524
kind: task
title: "executor-safety same-name hubs case: remote result not seen within 20 s under load (Linux)"
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
regression_of: T-430
topic: topic-584
branch: t/T-524-executor-safety-same-name-hubs-case
created: 2026-10-15T19:26:17.820Z
updated: 2026-10-19T12:44:14.829Z
closed: 2026-10-19T12:43:42.682Z
---

## Problem

`hub/test/executor-safety.test.ts:206`, 'same-name hubs preserve each other's in-flight keys and conservatively age legacy keys', timed out on Linux in T-474's droplet verify c7535028 (A-3294). The failure was `eventually('remote result')` not within 20000 ms. The case took 103 s at a peak load of 15.8. T-430 fixed this case's same-name-key race earlier, so this is a recurrence under load, with the 20 s remote-result wait too short or racing.

## Acceptance criteria

- [x] C1. The case waits for the remote result on an observed boundary, such as the run's done receipt, before starting its result window, in the style of T-490. Alternatively, the window is aligned with the product deadline it covers, citing the line. Every other assertion stays, and the root cause is recorded in the commit.
  - verified: rev-31 [reviewer] · run rev-20261019-524-source · 2026-10-19T11:37:35.254Z · commit b403e402e9e5458ed4bd64fdd89c786c5d5d4038
  - done: impl-524 · 2026-10-19T11:50:09.902Z
  - verified: rev-31 [reviewer] · run rev-20261019-524-final · 2026-10-19T11:52:59.906Z · commit b403e402e9e5458ed4bd64fdd89c786c5d5d4038
- [x] C2. executor-safety.test.ts and executor-safety-component.test.ts each pass 5/5 serially, whole file and alone, on the Mac, and the mode-free task verify passes at the reviewed head; the T3 Linux run comes from the merge batch that lands this item and is recorded by the Coordinator as landing evidence, not as a gate.
  - done: impl-524 · 2026-10-19T11:50:10.885Z
  - verified: rev-31 [reviewer] · run rev-20261019-524-final · 2026-10-19T11:52:59.906Z · commit b403e402e9e5458ed4bd64fdd89c786c5d5d4038

## Comments

### coord · 2026-10-15T20:01:02.780Z

Second case in this file: executor-safety.test.ts:289, "prepare, run, fallback, cancel and stopped-hub watchdog leave the sentinel nowhere", where eventually("all executor leases finish releasing") ran past 15 s on Linux in T-474's run fb5a0840 (A-3313). The same lease-release timing under load; fix both.

### impl-524 · 2026-10-19T11:28:53.359Z

Controlled delayed first same-name machine (afterMs=5000) reproduced remote result timeout at 30 s; red receipt A-5959. Current finish driver observes durable finished state after joining scheduler I/O before each fake-time step, with both shared-provider hubs sharing a clock and joining peers. Sentinel test now joins startup sweep through executor.reap before its separate lease-empty window. Both whole files pass once; starting required 20/20 serial whole-file Mac repetitions. No QA brief required (qaPolicy scope none).

### impl-524 · 2026-10-19T11:36:56.104Z

Source review refinement now at b403e402: held second start while first persisted proves shared clock frozen; explicit scripted completion observed before downstream report, separately bounded. Product-aligned sentinel receipt accounts for all three recovery/reap phases (3×15s + 15s I/O headroom = 60s). Same-name final-fixture red control A-5970; replacement evidence A-5972 (budget superseded to 60s). Serial runs continuing; exclude lifecycle first 3 before final budget and append 3, yielding 20 final-source passes. No dev merges after initial review.

### rev-31 · 2026-10-19T11:37:35.254Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-524-source
commit: b403e402e9e5458ed4bd64fdd89c786c5d5d4038
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; Standards 0 findings, Spec 0 findings. A-5976 records the pinned two-file review. Same-name ownership/concurrency and legacy-key assertions remain; both persisted starts/admission receipts precede exact-run semantic done status, collection receipt and a separate report window. Held-second-start proof keeps readiness pending and shared time frozen while the first start is persisted. Sentinel recovery joins startup before lease-empty/accounting assertions, with 60s accounting for startup reconcile + startup reap + requested reap (3x15s) plus 15s native-I/O headroom. Current ordering defect is captured in commit messages and A-5970 red control; historical timeout attribution is limited accordingly. C1 verified. C2 unverified pending final-source Mac receipts and same-head execution; its literal native-file Linux requirement awaits the Coordinator's task/batch disposition. One ordinary mode-free configured task verification may follow at this unchanged head; no all-mode authorization or final readiness is implied.

Criteria: C1 verified.

### impl-524 · 2026-10-19T11:45:06.060Z

Mode-free exact reviewed-head task verify eaf8cb45-f4ff-4481-9530-32929fcd9822 passed at b403e402: 406 tests, 406 pass, 0 fail. Linux x64 droplet c-8 lon1, lifetime 297s, cost $0.0206; log A-5988. Coordinator amended C2: Mac serial native + component receipts and exact-head task gate; T3 Linux is Coordinator-owned landing batch evidence, not item gate. Mac 20/20 final-source receipts still completing, no failures.

### impl-524 · 2026-10-19T11:50:23.542Z

Final Mac evidence A-5995: executor-safety-component.test.ts 20/20 serial whole-file; executor-safety.test.ts final-source iterations 4–23 20/20 serial whole-file (initial 3 excluded when receipt budget changed). All commands serial; component source byte-identical between 11058885 and final reviewed b403e402. Exact-head mode-free Linux gate eaf8cb45 green 406/406, A-5988. Head b403e402 clean/pushed; source clear, C1 verified; final C2/evidence settlement requested from responsible Reviewer. T3 landing evidence remains Coordinator-owned under amended C2.

### impl-524 · 2026-10-19T11:51:45.114Z

Final Reviewer confirms A-5995 proves all 40 accepted Mac file runs/320 cases pass, but requests Coordinator disposition for measured duration outliers before C2/final clearance: same-name iteration17 2.975s vs2s; sentinel iterations15/21 25.270s/20.199s vs17.807s allowance; unchanged shell/host parent10 iterations max16.295s vs12.295s allowance. No per-run load receipts in node-test log. Reviewer ask 3b348ddc forwarded upstream; source b403e402 and green eaf8cb45/A-5988 unchanged, no automatic reruns or allowance changes.

### impl-524 · 2026-10-19T11:52:18.477Z

Coordinator decision 3c25bc05 accepted measured Mac overruns for C2 with no further work: budgets/E-677 allowances judged on droplet runs, Mac loops prove pass counts; A-5995 40/40 whole-file pass, Linux A-5988 has no budget violations. Landing batch is the budget check; any over-budget sentinel/component there becomes a separate Coordinator-owned ticket. Returned disposition to responsible Reviewer via ask.answer on 3b348ddc. Awaiting final C2/evidence verdict at unchanged b403e402.

### rev-31 · 2026-10-19T11:52:59.906Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-524-final
commit: b403e402e9e5458ed4bd64fdd89c786c5d5d4038
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear; A-6003 records independent raw-log audit and primary Coordinator dispositions. A-5988 / eaf8cb45 passed at this exact source-cleared head: 406 ordinary pass outcomes, zero fail/cancel/skip, all 172 admitted load gates 5/5; no runtime tier trips or would-fail budget rows. Owned component 10/10, same-name 1.027804193s, eight top-level cases sum 3.379570837s. A-5995 retains 20/20 component Mac whole-file passes (200 tests) and 20/20 final-source native whole-file passes, iterations 4–23 (120 tests); first three native iterations excluded, component blob unchanged across the final budget-only patch. All accepted commands serial and alone, zero failures/cancellations/skips. Mac overrun maxima 2.975458041s same-name and 25.269592292s sentinel, plus unchanged shell/host parent overruns, explicitly disclosed; no per-run load receipts. Coordinator aaad42b7 amended C2 to these Mac passes plus mode-free task gate, with native T3 Linux landing evidence owned by Coordinator. Coordinator 3c25bc05 explicitly accepts these Mac overruns for C2 without more work; droplet landing batch checks remaining native budgets and any overrun is filed separately. C1/C2 verified; no native Linux or Mac budget-compliance claim. Droplet lifetime 297s, cost $0.0206.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-19T12:43:42.682Z

Merged 4deaec2f6193d2fec1708bdb0eac03dc376856e6 onto dev.

### coord · 2026-10-19T12:44:14.829Z

Landing evidence (C2, Coordinator-owned, not a gate): merge batch with T-838 and T-524, run c22b7c7e, Linux x64 c-8 lon1 (A-6038). The native executor-safety.test.ts passed whole-file, including the sentinel case "prepare, run, fallback, cancel and stopped-hub watchdog leave the sentinel nowhere" and both timed-out-run cases. executor-safety-config.test.ts also passed. Landed at 4deaec2f.
