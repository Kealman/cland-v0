---
id: T-742
kind: task
title: Some droplet results print 'lifetime unknown · cost $unknown'
state: closed
status: done
size: S
criterion_seq: 1
labels:
  - v0.1.4
  - hub
  - executor
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
topic: topic-455
branch: t/T-742-some-droplet-results-print-lifetime
created: 2026-10-17T15:49:20.649Z
updated: 2026-10-17T18:20:31.235Z
closed: 2026-10-17T18:20:31.235Z
---

## Summary

Two droplet results today printed `lifetime unknown · cost $unknown` in place of the measured lifetime and cost: integrated cover 7c3aa637 (A-4460, 10:28Z) and T-738's run 0cc313d8 (A-4595, 15:49Z). Both runs finished normally. If the spend ledger misses these runs, the daily cap undercounts. If only the result line misses them, the receipts lose evidence.

## What to build

Find out when the result is written without the lease's lifetime and cost. One candidate is the lease being released or reaped before the result reads it. Check whether ~/.cland/executor/spend.json holds both runs. Fix whichever side is missing.

## Acceptance criteria

- [x] C1. The cause is named, both runs' spend is accounted for in the ledger or the gap is quantified, and a regression shows a finished run always reports its lifetime and cost.
  - done: impl-742 · 2026-10-17T17:24:23.440Z
  - verified: rev-30 [reviewer] · run rev-20261017-742-final · 2026-10-17T17:59:13.928Z · commit 355c3c743e9521ff498555d5e4c82a771836d1be

## Comments

### coord · 2026-10-17T17:14:31.708Z

Third case, and this one fails the run: T-695's run e9bd92a9 (A-4644) on the restarted hub (pid 9780, T-738 live) ended with outcome code 1 and an empty cause. It had 2077 passed and 0 failed, but no "Neovim smoke" shard line, and the header shows lifetime unknown and cost $unknown. The journal has executor-lease-active (lease 661a4c68) at 16:35:34Z, then verification-timing and suite-result at 17:13:09Z, with no lease-close event between them. So the run's Neovim smoke phase result and the lease accounting are both missing, and the missing phase turned a green hub run red. Raising priority: this now costs reruns.

### coord · 2026-10-17T17:15:35.933Z

Correction to the third case: e9bd92a9's exit 1 came from T-695's own new-test budget lines (five identities over 5 s), not from this defect. What remains for T-742 there is the missing Neovim smoke shard line and lifetime/cost "unknown". T-694's run bf76cf3d on the same hub reported both normally, so the gap is intermittent.

### coord · 2026-10-17T17:15:56.484Z

Cause narrowed by the stand-in's oversight check (2026-10-17 17:16Z). The spend is charged and the droplets are gone; only the result line races. For e9bd92a9 the journal shows executor-release-retry and executor-release-unconfirmed at 17:13:09Z (DigitalOcean request deadline reached), suite-result written 0.5 s later, then executor-lease-released at 17:13:42Z with lifetimeMs 2266532 and costUsd 0.157. The ledger holds that entry, and droplet 610025677 is absent from the DO list. The two earlier cases (droplet 609910076 at 06:11Z, 609954708 at 10:28Z) have the same shape. Fix direction: the result waits for the release retry, or lifetime and cost are backfilled from the ledger or the lease-released event.

### impl-742 · 2026-10-17T17:21:03.209Z

Diagnosis: all three affected runs were posted immediately after executor-release-unconfirmed; their durable leases then settled later. Ledger values: 7c3aa637=$0.1469426389 (lifetime 2,115,974ms), 0cc313d8=$0.1260245139 (1,814,753ms), e9bd92a9=$0.1573980556 (2,266,532ms). No spend gap. Missing smoke lines are intentional early returns: A-4460 hub test failure; A-4644 duration-budget failure. A-4595 contains Neovim smoke. Implementing Coordinator's bounded 120s accounting wait, pending-confirmation fallback and one late correction; regressions cover saved outcome/log through restart and accounting confirmation.

### rev-30 · 2026-10-17T17:31:32.127Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-742-source
commit: 355c3c743e9521ff498555d5e4c82a771836d1be
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-742 full source review — clear

Reviewed head 355c3c743e9521ff498555d5e4c82a771836d1be, direct child of initial request5860bbc17327d043dfacd4a24fee82eef89681e7. Fixed point01511eee4761c5e27d8c317c10069a30e59df24b. All seven changed files and surrounding accounting/report/recovery paths reviewed read-only; no Reviewer execution or provider operations. Latest pushed branch tip confirmed.

## Standards
No remaining findings. The pre-verdict protocol fixture concern is resolved: its shared seed now passes T-719 probes:'fake' with fake adapters and FakeClock. A-4661 exact-head selected regression census reports one initialized recorder, isolation disabled, exit0 and zero child_process calls. The one-line correction changes no accounting implementation or assertion. Fresh whole-protocol5/5 is reported at3.325–3.979s/load5.67–6.88; prior raw protocol5/5 A-4658 and corrected census are independently inspected.

The new accounting tests use FakeClock and persisted receipts; the chosen119000+1001 deadline advances are followed by reported/result observations, not elapsed native sleeps. Their real ledger/backend purpose is retained. The obsolete real-process unconfirmed-deletion policy case moves to component proof; the real-shell failed-spend-settlement scenario remains in T3. No native lifecycle assertion is replaced merely by a fake timeout.

## Spec / primary behavior disposition
Primary Coordinator0ccb3426-4870-4be7-ba44-07cffb70351f explicitly requires a bounded120s wait, pending-confirmation fallback and one same-topic late correction while durable unreleased leases continue guarding admission. That disposition resolves the criterion's literal always-reports wording: never fabricate accounting; a still-unconfirmed release reports pending and is corrected later.

Source follows it:
- Persist terminal outcome/local result and collected log before waiting. Restore the durable result before status/log access after restart, so a deleted worker is not polled to rediscover its exit.
- Persist accountingWaitStarted once, pass its absolute120s deadline into release, and retain the window across restart. Release attempts keep their existing short limit capped by that deadline.
- While unconfirmed and within-window, defer publication; after expiry, publish explicit lifetime/cost pending confirmation and preserve the live lease's remote admission guard. A confirmed release supplies durable values/ledger settlement.
- Reported pending jobs reread the identity-matched durable released lease, fill confirmed fields, send the callback, then clear pending state. Failed notice publication leaves retryable state. Dispatcher uses a deterministic suite-accounting:<run> notice id; core.noticeTo's existing store lookup makes the durable correction idempotent across restart/crash.
- Grouped receipts retain per-shard pending accounting and pending total rather than inventing zero for an unconfirmed machine. Correction includes all shard machines in the original report topic; original result is not reposted.

## Diagnosis independently checked
Read only the three relevant records from the default spend ledger and relevant project journal events. No spend gap:
7c3aa637-bc5a-4836-9270-39ca3f255c80: lease78ff8f9f, lifetime2115974ms, cost0.1469426388888889USD;
0cc313d8-5883-421b-855f-74e269e2c158: lease56f99fd7, lifetime1814753ms, cost0.12602451388888888USD;
e9bd92a9-7eeb-42c4-87fe-0d1907c29abb: lease661a4c68, lifetime2266532ms, cost0.15739805555555555USD.
Journal unconfirmed/released sequences independently match10:28:49.779→10:32:38.720,15:49:04.970→15:49:11.757 and17:13:09.540→17:13:42.873 UTC. Ledger settled costs equal released-event costs. The report read the unconfirmed return before later release, rather than omitting a charge.

Missing Neovim smoke is independent. A-4460 ends on a hub functional failure with no smoke; A-4644 ends on five owned hard budgets with no smoke; A-4595 is green and has22.21s smoke. run-suite.ts210–212 explicitly returns after nonzero phase code, budget failure or load-gate failure. Accounting did not cause those earlier phase omissions or T-695's exit1.

## Supplied validation and pending runtime
A-4658 final accounting5/5 (7cases each) and original protocol5/5 (8each) are green. A-4659 alternating proof retains head5/5 real-process passes (onecase each) versus dev4/5 with the same remote-group startup timeout. The baseline red is filedT-746 by primary0a4cfe68; no causality claim that this patch fixesT-746. All new lifetime/ledger, retained smoke, blocked waiter, saved wait-start, past-window pending, late correction and restart dedup assertions were inspected. Accounting implementation is unchanged by the final probe-only correction. Supplied typecheck/tier checks pass.

C1 cause/ledger/source-regression support is established; final C1/runtime verification remains unmarked until normal diff-selected exact-head droplet evidence arrives. This source clearance allows that run when Coordinator holds permit. No per-item QA. Full source clear; findings[]. Standards0/Spec0remaining findings.

Durable review: A-4665.

### rev-30 · 2026-10-17T17:59:13.928Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-742-final
commit: 355c3c743e9521ff498555d5e4c82a771836d1be
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-742 final evidence — clear

Exact reviewed head355c3c743e9521ff498555d5e4c82a771836d1be remains branch tip. Source verdict rev-20261017-742-source/A-4665 unchanged. Final evidence scope; no Reviewer execution, provider operations or source changes.

## Standards and Spec
No remaining findings. C1 verified across the prior source/ledger audit and this accepted exact-head execution. Cause is an unconfirmed release returning without settled accounting, allowing the result to publish before a later retry/sweep supplied lifetime/cost. Prior read-only ledger/journal audit confirms both named runs are charged:7c3aa637 cost0.1469426388888889/lifetime2115974ms;0cc313d8 cost0.12602451388888888/lifetime1814753ms. No spend-ledger gap was found. Original missing result fields were publication ordering, not fabricated zero charges.

Primary Coordinator0ccb3426 was read directly again: bounded120s hub-Clock confirmation window, pending-confirmation result after the bound, then one durable correction in the original topic; never an unbounded verdict/merge/queue hold. Source retains this explicit pending exception rather than claiming a deletion that never confirms already has final accounting. Direct identity-matched lease/ledger data supplies correction values. Callback/idempotent notice and persisted state preserve restart behavior.

The source review also distinguished missing Neovim phases in historical failed hub runs from accounting: one old run stopped on a functional failure and T-695 stopped on hard duration budgets; the0cc313d8 successful receipt contained smoke. This change is not credited with retroactively supplying unexecuted phases.

## Exact-head Linux
Run d31d3bee-b48a-4a38-aa22-ae519f107563/A-4687 exits0, normal diff-selected hub-only plus Neovim smoke.2098total/2093pass/0fail/0cancelled/5prerequisite skips. Phase counts155/155 hermetic,1931total/1926pass5skip machine,12/12 smoke. Mode reason docs unsupported coverage is disclosed; no full-Neovim claim.

All16 top-level cases in the three touched test files have positive timing receipts: accounting7, protocol8, remote-process1. All three new regression identities have positive ordinary reporter lines and each passes5/5 load repetitions,15/15:
- within-window confirmed accounting before publication0.388291543s;
- past-window pending result/durable later correction0.211457459s;
- original-topic exactly-once correction0.163651477s.
The retained native two-slot/failed-spend-settlement proof passes8.945839080s. No scoped skip or hard budget failure. Report-only tier/baseline/regression notices remain distinct from gate failures.

Supplied executor Linuxx64 6.8.0-142-generic,c-8lon1,Node24.21.0/Neovim0.12.5,2workers; confirmed lifetime1560s/cost0.1083, suite1484.78s,peak1mload8.54,load-gate extra16.01s,smoke19.84s. Host typecheck gate reused at0fb0acc53459b7c54505c91e987b3c58c3fef884,not repeated remotely. Receipt accounting is a real observed result; no claim that every existing deployed hub already runs this candidate.

Prior supplied Mac5/5 accounting/protocol/native evidence A-4658/A-4659 and corrected zero-child protocol census A-4661 remain applicable; source355c3c74 only hardened fake-probe fixture after5860bbc1. Primary0a4cfe68 filed comparison flakeT-746 after alternating native comparison (candidate5/5/dev4/5); no claim of causally fixing that separate flake.

Standards0/Spec0 findings. Final clear; verify all(C1) at355c3c74. No per-item QA or further task run required.
Durable review A-4688.

Criteria: C1 verified.

### coord · 2026-10-17T18:20:31.235Z

Merged 5f32c1cbf9605266c0733dfdcc2169b01e3efad7 onto dev.
