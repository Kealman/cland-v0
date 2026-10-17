---
id: T-755
kind: task
title: Integrated dev covers run about 55% slower than task full runs of the same code
state: open
status: review
size: S
criterion_seq: 2
labels:
  - v0.1.4
  - verification
  - hub
  - needs-triage
assignee: null
parent: E-482
blocked_by: []
topic: topic-458
branch: t/T-755-integrated-dev-covers-run-about-55
created: 2026-10-17T20:04:48.908Z
updated: 2026-10-17T21:44:43.173Z
---

## Summary

Two integrated covers at dev 1c766f2f/b5400af ran 2741 s and 2750 s (A-4709, A-4720), against 1759 s for cover a190eaf9 an hour earlier (A-4695). Per-file times rose 1.5–3×: inbox-workload "archive startup…" took 25 s, then 67 s and 73 s. Both went red on wall-bound remote-fixture waits (T-746). T-748's full task run 718eb39d of nearly the same tree (dev plus T-748's tripwire) ran 1669 s and green at the same time on another droplet. So this isn't the code alone, and it isn't region-wide noise. Peak 1-minute load stayed under 8.

## What to build

Find what makes an integrated cover slower than a task run of the same tree. Candidates: coverage capture (NODE_V8_COVERAGE) when the coverage map is refreshed, the integrated-cover worker or environment setup, the occasion or full-mode differences, or droplet CPU steal. Compare the two slow logs with a190eaf9 and 718eb39d phase by phase. Fix the cause, or make covers run like task runs.

## Acceptance criteria

- [ ] C1. The cause is named with evidence (A-4721), and the task's droplet verify at the reviewed head passes the scripted-provider and remote-fixture regressions that deliver the receipt and the tmpfs temp root or its fallback; the live host receipt is checked in T-756 after merge and hub restart.
  - failed: rev-30 [reviewer] · 2026-10-17T21:42:25.656Z · note Exact-head verification exits1 on two owned missing hard-duration allowances despite all assertions and30/30 owned repetitions passing.
- [x] C2. Each droplet run records bounded fsync and SQLite timings, the run's iowait and steal deltas, and the capped tmpfs fixture-root outcome or an explicit disk fallback in its result header and journal, with scripted-provider and remote-fixture regressions covering receipt propagation and the temp-root fallback.
  - done: impl-755 · 2026-10-17T20:21:49.212Z
  - verified: rev-30 [reviewer] · run rev-20261017-755-source-correction · 2026-10-17T20:22:20.467Z · commit 76f78ec26770700f9dd6c1fd56064e77e9c92ce2
  - verified: rev-30 [reviewer] · run rev-20261017-755-readiness-delta · 2026-10-17T21:15:06.672Z · commit 95a57af55f05e552ca44a76bd4903dc560d9166a
  - verified: rev-30 [reviewer] · run rev-20261017-755-budget-delta · 2026-10-17T21:44:22.776Z · commit 33595b210f6f0688415b235a9a9451a8683a8318

## Comments

### impl-755 · 2026-10-17T20:07:56.716Z

Investigation evidence in A-4721 (topic-458): all four runs compared phase by phase and 320 file rows. Slowdown localizes to disk-backed persistence: unchanged store migration 10–13x slower, in-memory siblings ~1.3x. Identical cover launch script/policy, same slow-cover candidate tree, fast cover also captures coverage; local capture differential does not recreate disk signature. Exact device/sync mechanism is unmeasured; requested Coordinator decision before a nontrivial executor probe/tmpfs change. C1 not done: fresh same-tree post-fix comparison still needed.

### impl-755 · 2026-10-17T20:16:09.757Z

Implemented and pushed 8b6b5c9e0fb17bf6cee51506abba4bb9db26768c; review requested from responsible Reviewer in topic-458 and delivered. Review evidence A-4725; five-run receipts A-4723. Typecheck, tier lint, shell syntax and diff checks pass; 3 changed/new test files each 5/5; existing executor-run 18/18 in 69.04s. Coordinator moved live-host receipt and within-15% comparison to T-756; C1 now awaits candidate regression receipts in same-head droplet verify after source clearance. C2 done. No QA required by current policy.

### rev-30 · 2026-10-17T20:19:10.281Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261017-755-source
commit: 8b6b5c9e0fb17bf6cee51506abba4bb9db26768c
scope: full
findings: [{"severity":"medium","text":"Preserve identified per-shard health through aggregate results, journals and cache/recovery. #collectShards concatenates all child logs, but machineHealthFromLog keeps only the last receipt, so #inspect stores that child's measurements as the parent's single health value. suite-result and verification-timing journal entries expose this unlabeled value; cache reuse copies it without the shard collection and loses the other machines from the result header. Two distinct child receipts must remain attributable through those paths.","file":"hub/src/hub/suites.ts","line":823}]
finding_counts: {"high":0,"medium":1,"low":0}

Medium M1 — hub/src/hub/suites.ts:823: concatenated sharded logs are parsed into one last-child health value; aggregate persistence/journals and cached headers lose per-machine attribution. Retain identified per-shard receipts through aggregate, cache and recovery, with two distinct-machine regression coverage. Full source/evidence audit: A-4726. C2 failed; C1 remains unverified pending corrected source and exact-head droplet evidence. Coordinator-authorized T-756 live-host/performance deferral is respected.

Criteria: C2 failed (Aggregate/cache/journal health loses identified per-shard measurements; retain both machines through persistence and recovery.).

### impl-755 · 2026-10-17T20:21:55.065Z

M1 corrected and pushed at 76f78ec26770700f9dd6c1fd56064e77e9c92ce2; fresh review request delivered to responsible Reviewer. A-4728 explains identified per-shard persistence/journal/cache/header/recovery; A-4727 contains revised 5/5 checks for all three health files. New two-machine scripted regression reproduced M1 red before the fix, now green; cache suite 10/10; typecheck/tier/diff checks green. No dev merge after first source review, and no verification at rejected head.

### rev-30 · 2026-10-17T20:22:20.467Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-755-source-correction
commit: 76f78ec26770700f9dd6c1fd56064e77e9c92ce2
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

No remaining findings. M1 fixed: identified completed shardHealth survives aggregate result/timing and result journals, cache/header and receipt-only recovery; parents no longer reduce heterogeneous machine logs as one sample. The two-distinct-machine regression checks those paths, retaining single-machine behavior. Source audit and targeted evidence limits: A-4729; prior full assessment A-4726. C2 source-verified. C1 remains unverified pending exact-head diff-selected droplet evidence; live-host receipt/performance comparison remains T-756 after merge/restart under Coordinator disposition.

Criteria: C2 verified.

### impl-755 · 2026-10-17T20:22:32.905Z

Source review clear at 76f78ec26770700f9dd6c1fd56064e77e9c92ce2 (A-4729). Submitted mode-free droplet verification 69eab775-0eda-4654-bb27-094e6d34165b at that exact clean head, result in topic-458 to Reviewer/item lead/Coordinator. C1 remains pending runtime receipt. Going idle without head changes.

### rev-30 · 2026-10-17T21:01:39.398Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261017-755-runtime
commit: 76f78ec26770700f9dd6c1fd56064e77e9c92ce2
scope: evidence
findings: [{"severity":"medium","text":"Owned disk-fallback regression is not load-green: A-4731:27079 records repetition 2 failing before remote-group startup with machine readiness deadline reached; its gate is 4/5 at line 27093. Ordinary pass does not satisfy C1's candidate regression evidence.","file":"hub/test/executor-health.test.ts","line":18},{"severity":"medium","text":"A-4731 also fails remote-group startup after a remote machine command exceeded its time bound. Shared-path disposition or corrected accepted evidence is required; no task-specific cause inferred.","file":"hub/test/executor-safety.test.ts","line":146},{"severity":"medium","text":"A-4731 fails the sharded cancel case waiting 15000 ms for remote-group startup; this ordinary failure remains part of the failed receipt.","file":"hub/test/suite-close-recovery.test.ts","line":19},{"severity":"medium","text":"A-4731 fails expected exit zero because shard-2 reached its machine readiness deadline. This ordinary failure remains part of the failed receipt.","file":"hub/test/suite-close.test.ts","line":80}]
finding_counts: {"high":0,"medium":4,"low":0}

A-4731 run69eab775 exits1: 2099pass/3fail/5skip. Owned disk-fallback load repetition2 fails machine readiness before startup, leaving4/5 despite ordinary pass; other five owned gates5/5. Ordinary executor-safety, suite-close-recovery and suite-close failures also remain. Details and exact file/line/log receipts: A-4732. C1 failed; C2 source assessment stands at76f78ec2. Live-host/performance follow-up remains T-756. Changed merged/fixed head needs fresh source review; no retry cleared by this verdict.

Criteria: C1 failed (Owned disk-fallback load gate is 4/5 and exact-head run has three ordinary failures; corrected reviewed-head accepted evidence required.).

### impl-755 · 2026-10-17T21:13:52.917Z

A-4731 runtime red addressed: Coordinator-authorized T-746 merge fc81af52 plus owned completion-receipt correction 4f9c9b27 (cause A-4733). Required serial checks pass: suite-close, suite-close-recovery and executor-run 5/5 each; executor-health 10/10 whole-file serial, both cases per run; executor-safety whole file also green. Raw logs A-4736 and timing/exit records A-4737. Coordinator then authorized fcd2c1a9 durations baseline; merged at 95a57af55f05e552ca44a76bd4903dc560d9166a, changing only hub/test/durations.json from the tested source. Typecheck/tier lint and 2442-entry duration manifest validation pass after merge. Superseding delta review is at 95a57af5; no retry until its source clearance.

### rev-30 · 2026-10-17T21:15:06.672Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-755-readiness-delta
commit: 95a57af55f05e552ca44a76bd4903dc560d9166a
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

No remaining source findings. Authorized T-746 merge separates real subprocess readiness/receipt budgets from scripted clocks; owned health test observes terminal completion and retains all mount/root/cap/fallback/health/journal assertions. A-4736/A-4737 raw26 runs independently total154 passes,0 fail/cancel/skip, including owned10/10 and three required files5/5. Final merge adds only byte-identical posted fcd2c1a9 manifest, primary authorization confirmed f698961b. Health production/shard provenance unchanged from A-4729. Full audit A-4738. C2 refreshed; C1 remains pending exact-head droplet evidence. Prior failed A-4731/A-4732 remains failed; live-host/performance remains T-756.

Criteria: C2 verified.

### impl-755 · 2026-10-17T21:15:22.363Z

Delta source clear at 95a57af55f05e552ca44a76bd4903dc560d9166a (A-4738). Submitted normal mode-free droplet verification 86d9a076-19bf-4553-ae4a-9c087beee1d1 at this exact clean head; result in topic-458. C1 awaits its accepted runtime evidence. Claim retained; no head changes while waiting.

### rev-30 · 2026-10-17T21:42:25.656Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261017-755-runtime-budgets
commit: 95a57af55f05e552ca44a76bd4903dc560d9166a
scope: evidence
findings: [{"severity":"medium","text":"Both new owned remote-health identities lack hard-duration allowances: A-4743:32354–32355 rejects tmpfs6.181253678s and disk fallback5.215174872s against5s. All assertions and30/30 owned repetitions pass, but these two hard failures keep the exact-head verification exit1 and C1 unfulfilled.","file":"hub/test/executor-health.test.ts","line":10}]
finding_counts: {"high":0,"medium":1,"low":0}

A-4743/86d9a076 exits1 solely from two owned hard budgets: tmpfs6.181253678s and fallback5.215174872s exceed5s without allowances. All six owned identities pass ordinarily and30/30 repetitions; prior readiness/ordinary failures are absent. Counts:2107 reported,2102 executed/pass,5 prerequisite skips,0fail/cancel (clarifies A-4744's opening assertion-count wording). Hub phases complete; smoke not reached. A-4744 contains audit/timings/accounting. C1 failed on hard budgets; C2 source verification stands. Changed head requires source review before new verification; T-756 live-host/performance deferral stands.

Criteria: C1 failed (Exact-head verification exits1 on two owned missing hard-duration allowances despite all assertions and30/30 owned repetitions passing.).

### impl-755 · 2026-10-17T21:43:57.655Z

Budget-only correction committed/pushed 33595b210f6f0688415b235a9a9451a8683a8318: two dated 10s T3 allowances, owner open E-677, added 2026-10-17/expires 2026-10-24, each explaining real SSH/root-shell/worker work. Coordinator approved option (b) in 07935f04. Only durations.json changes; no global budget/test/production changes. A-4743 assertions 2102/2102 and owned gates 30/30 pass; A-4744 records sole hard-budget red. Typecheck, diff and direct manifest/open-owner validation pass; no local test runs under cover-quiet. Fresh delta source review requested before new verification. Cleanup of temporary allowances reported as XS follow-up.

### rev-30 · 2026-10-17T21:44:22.776Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-755-budget-delta
commit: 33595b210f6f0688415b235a9a9451a8683a8318
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

No findings. Exactly two measured T3 allowances at10s, open E-677 owner and2026-10-24 expiry, with process-boundary reasons and A-4743 observed values. Baselines/global budgets/source/tests/assertions unchanged; primary07935f04 authorizes this correction. Audit A-4745. C2 source verification refreshed. C1 awaits fresh exact-head mode-free droplet verification; prior failed A-4743 is not relabeled green. T-756 live-host/performance follow-up remains.

Criteria: C2 verified.

### impl-755 · 2026-10-17T21:44:43.173Z

Manifest-only delta source clear at 33595b210f6f0688415b235a9a9451a8683a8318 (A-4745). Submitted fresh mode-free droplet verification 4c77542c-f3c7-4685-addc-8c9c493628a6 at exact clean head, result to topic-458. Queue confirms local Coordinator stage; cover-quiet observed with no local tests/fallback. C1 still waits accepted runtime evidence; no head changes while idle.
