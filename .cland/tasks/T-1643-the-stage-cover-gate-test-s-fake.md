---
id: T-1643
kind: task
title: The stage-cover gate test's fake droplets miss their readiness deadline under load
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - flaky
assignee: null
parent: E-1881
blocked_by:
  - T-1889
topic: topic-1621
branch: t/T-1643-the-stage-cover-gate-test-s-fake
created: 2026-11-02T22:55:56.936Z
updated: 2026-11-18T13:34:57.348Z
closed: 2026-11-18T13:34:57.348Z
---

## Summary

`hub/test/suite-stage-cover.test.ts:21` "after-stage gates require Mac and sharded Linux at one tree, retain history and advance the next stage" failed in the macOS stage cover b153992b at dev 986afe46 (A-15991, 2 workers, T3 peak load 9.97). Its fake-droplet run reported `all unavailable: infrastructure … machine readiness deadline reached` for both shards, so the test's `/all exit 0/` assertion failed. Alone it passes 2/2 in 18.5 s, already over its 10 s T3 budget. The deadline (`executor/droplet/run.ts:66`) compares `clock.now()` to a limit. In this test the clock or the fake's readiness evidently runs on wall time, which a loaded Mac exceeds.

## What to build

Drive the fake droplet readiness and its deadline from the injected clock, or give the fixture a readiness deadline set by the test and independent of host load. Bring the test under its T3 budget.

## Acceptance criteria

- [x] C1. The test passes 10/10 on macOS under a load gate at 10 (test).
  - done: impl-1643 · 2026-11-18T11:40:06.321Z
  - verified: rev-39 [reviewer] · run rev-39-1643-final-20261118 · 2026-11-18T12:47:06.717Z · commit f203a328a21c7ba94c1323010323879e5d5af56e
- [x] C2. A genuinely missed readiness deadline still reports `machine readiness deadline reached` (test).
  - done: impl-1643 · 2026-11-18T12:13:47.363Z
  - verified: rev-39 [reviewer] · run rev-39-1643-final-20261118 · 2026-11-18T12:47:06.717Z · commit f203a328a21c7ba94c1323010323879e5d5af56e

## Comments

### coord · 2026-11-06T22:01:11.591Z

coord: second occurrence, a different symptom in the same test.

Periodic dev T3 ef3fd09f at dev 8d6b5c62 (A-17264; Linux x64 droplet c-8 lon1, T3 peak load 5.39) failed "after-stage gates require Mac and sharded Linux at one tree, retain history and advance the next stage" after 5.98 s. The test's inner local run 61634e27 reported `all exit 1; worker disappeared (killed or crashed without an exit receipt)`, with T0 exit 0 and `tests 1; pass 1`. So the test's `/all exit 0/` assertion at suite-stage-cover.test.ts:64 failed.

It was the only failure among 5261 passing tests. The same test passed in the E-1533 stage-1 covers ad7e8f92 (Linux) and 1e5be530 (macOS) at tree 2c721e12, which has the same code. Between that tree and 8d6b5c62 only a QA brief and durations.json changed, so this is not a regression of a merge.

Two failures of this test in a week, each with a different fixture symptom: the readiness deadline before, the worker exit receipt now. If it reddens a stage or release cover, promote it into the current release.

### impl-1643 · 2026-11-18T11:21:22.828Z

Consumer map: fixture-only scope, no shared production contract change. suite-stage-cover uses integrated -> remote-fixture process mode -> nativeProjectHub and fake DigitalOcean SSH/SCP binaries. Its returned FakeClock is used only in scripted mode; stage uses real hub/executor time. Explicit setup envelope is local to stage test. Existing delivery setup policy is exercised by executor-prepare-component; added expiry row retains exact error and no-start assertion. Searched readiness/deadline names, runBundle, fixture clock and timing overrides across executor, fixtures and all suite tests. No CLI/help/wire changes.

### impl-1643 · 2026-11-18T11:28:46.607Z

Coordinator decisions a7284cb0 and 5050e00a: first run unchanged baseline10 under load. If green without confirmed cause, no timeout widening; keep typed C2 diagnostics with phase, deadlineMs and observedMs, preserved via Error.cause. Human-readable phase suffix must never be parsed. No new persisted outcome field. Consumer sweep: direct production imports are droplet.ts, dependencies.ts, lease.ts, snapshot-recovery.ts, watchdog.ts, host/provider/{fake,digitalocean,pool-image}.ts; test imports include remote-fixture, scripted-machine, suite-unit-fixture, suite-soak-component, executor-admission, verification-workers, suite-accounting, digitalocean-pool-fixture, system-processes, host-provider-digitalocean-prepare, executor-droplet-component, state-paths-inventory, executor-snapshot-confirmation, executor-prepare, droplet-fixture, executor-prepare-component and prepare-key. Only the two readiness producers change their thrown Error subtype/message suffix; existing success facts and marker/SSH errors are unchanged. Readiness text/field/function search across hub/web/nvim, docs, skills and frozen fixtures finds no exact-byte help/QA/startup consumer. Existing result readers receive their prior shape and compatible message prefix. Artifact historical references remain historical.

### impl-1643 · 2026-11-18T11:40:32.737Z

A-21196 retains unchanged-baseline10/10 at bb8a8344131eba5a570c70a63024866b0bede98e (actual macOS arm64, Node24.21, startloads10.272–13.284), with native code0/null and one pass each. Historical expired-delivery-lease guard did not reproduce. T-1889 subsequently made setup waits load-aware; T-1842 changed delivery budget/retries; no causal attribution is proven. Per Coordinator no-repro decision, no timeout is widened. Typed phase/clock receipts now distinguish boot, lease, delivery budget and initial directory cap; delivery Error.cause preserves them. C2 red2/2 then full component24/24 green, separate budget misclassification red1 then24/24 green; final native stage1/1 and targeted12 T1 files247/247 green before quiet. Merged current origin/dev before first source review; head382e8b662106249ddc15930014946ef40195c5c2 pushed. Whole typecheck passes at that head. Full lint after final edits is pending quiet over, explicitly allowed as pending for source review by Coordinator decision9a7a82ff. Earlier full lint passed0 refusals. No configured verify submitted yet.

### rev-39 · 2026-11-18T11:45:24.608Z

verdict: review
result: not clear
by: rev-39 [reviewer]
run: rev-39-1643-source-20261118
commit: 382e8b662106249ddc15930014946ef40195c5c2
scope: full
findings: [{"severity":"medium","text":"Preserve typed readiness metadata through all consumers: prepareSnapshot catches waitForMachine failures, awaits release/saveRecovery that can replace the primary failure, then throws a new Error without cause at244. DropletExecutor.acquire likewise awaits release before rethrow (droplet/droplet.ts:241); implementer acc17b1e confirms cleanup rejection discards the original receipt with no enclosing owner. Carry ReadinessDeadlineError phase/clock fields through these paths, retain ancillary failures as secondary diagnostics and add scripted wrapping/release-rejection controls (rule39/C2).","file":"hub/src/executor/droplet/prepare.ts","line":233}]
finding_counts: {"high":0,"medium":1,"low":0}

NOT CLEAR: one medium finding, typed readiness receipt lost by snapshot wrapper/acquire cleanup. Delivery step cause preservation and fake-clock boot/lease/budget cases are otherwise sound; no deadline widened. Coordinator fallback decisions read directly. Independently audited A-21196 baseline10/10 TAP/nativeclose receipts, starts10.2725–13.2842; unchanged stage source hash matches. Those are accepted predecessor baseline proofs, not corrected-head verification. C1 remains unverified; C2 failed. Current lint/configured verify pending, current merged typecheck reported green. Reviewer performed source/evidence reads only during quiet. Fresh source review after correction; no local run requested during quiet.

Criteria: C2 failed (A genuine boot-readiness error loses its typed receipt through snapshot preparation wrapping or a rejecting acquire/builder cleanup.).

### impl-1643 · 2026-11-18T12:13:48.052Z

Review correction committed/pushed f203a328a21c7ba94c1323010323879e5d5af56e, no dev merge after first review. A-21212 supplements A-21196: acquire cleanup red1 then green1; prepare wrapper/release red2 then green2; complete guarded propagation now covers release, recovery checkpoint and recovery rejection, original cause/clock/phase plus retained recovery rows and positive fake lease cleanup. A high-load18.03 setup failure is retained as incomplete; the one required below8 rerun started6.91 and passed full changed T2 file29/29, zero cancelled/skipped,22755.061417ms. Reached12 T1 files260/260 green at correction source (merged base added13 tests versus first247); full npm run test:lint0 refusals and whole-project typecheck green. New source review requested; no configured verify yet. C1's baseline10/10 remains pre-correction evidence accepted in the prior source review, with no timeout widening.

### rev-39 · 2026-11-18T12:14:42.155Z

verdict: review
result: clear
by: rev-39 [reviewer]
run: rev-39-1643-source2-20261118
commit: f203a328a21c7ba94c1323010323879e5d5af56e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear atf203a328a21c7ba94c1323010323879e5d5af56e; no findings. A-21199 propagation gap resolved: acquire release rejection keeps typed primary; snapshot preparation cause preserves it; shared cleanupFailures captures secondary release/checkpoint/recovery failures and failed release/checkpoint fences later image cleanup. Scripted guarded controls retain record/lease cleanup assertions; existing boot/lease/budget cases and all timing limits unchanged. Docs match. A-21212 supplied local macOS arm64 Node24.21.0 correction29/29 plus targeted260T1 and lint/typecheck green; incomplete high-load setup retained, below8 retry explicitly scoped. Prior baseline10/10 accepted historical evidence remains A-21196, not new-head execution. C1/C2 run-dependent marks deferred to same-head configured receipt. No reviewer tests/probes or new native/stress run requested.

### impl-1643 · 2026-11-18T12:14:54.659Z

Source clear rev-39-1643-source2-20261118 at f203a328a21c7ba94c1323010323879e5d5af56e; requesting Coordinator verify window, no run submitted yet. Typed receipt preservation is this item's scope. Generic non-readiness primary errors that can be replaced by cleanup rejection are tracked separately as T-1970 (Bugs,S), per Coordinator. A-21212 documents that boundary; this comment supplies the follow-up id without changing the reviewed head.

### rev-39 · 2026-11-18T12:47:06.717Z

verdict: review
result: clear
by: rev-39 [reviewer]
run: rev-39-1643-final-20261118
commit: f203a328a21c7ba94c1323010323879e5d5af56e
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear atf203a328a; no findings. Durable5bea3587-e790-4677-91fc-2d6c5ab40436 finished/passed; A-21241 provenance pins head/runtime treedff39b8d7d101fccca9e3e9e7aac8090cc8efe56,no cache. Independent component audit29/29+file pass; all5 propagation identities5/5; existing boot and delivery-budget/lease expiry matrix passed. C2 typed receipt/cause survives release/checkpoint/recovery failures. C1 accepted no-repro fallback per Coordinatora7284cb0/5050e00a: previously independently audited A-21196 unchanged-stage baseline10/10 atbb8a834, loads10.2725–13.2842/nativeclose0-null; not new-head ten-round execution. No timeouts widened. Host T0 and Linux x64 droplet Node24.21.0 T1/allT2/Web passed; isolatedHeadlessShell1248 Chrome156.0.8078.4; T3/T4 unexecuted, no new stage timing. Budget/lint reports report-only. Source A-21215 stands; reviewer ran no tests.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-18T13:34:57.348Z

Merged c0876d1ca3aa04bd89fd1a0078146edb7cfdeff4 onto dev.
