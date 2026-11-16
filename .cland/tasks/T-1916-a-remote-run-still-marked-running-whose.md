---
id: T-1916
kind: task
title: "A remote run still marked running whose droplet no longer exists keeps its remote slot after T-1843 (ghost b33e7940 survived restart #77)"
state: closed
status: done
size: S
criterion_seq: 2
labels: []
assignee: null
parent: E-1883
blocked_by: []
regression_of: T-1843
topic: topic-1565
branch: t/T-1916-a-remote-run-still-marked-running-whose
created: 2026-11-16T16:07:55.388Z
updated: 2026-11-16T22:04:54.417Z
closed: 2026-11-16T22:04:54.417Z
---

## Summary

After T-1843 landed (b57847bca) and the hub restarted on it (#77, 2026-11-16 16:05Z), `cland verify queue` still lists run b33e7940 (occasion dev-t3, since 2026-11-12T23:02Z, droplet cland-v0-58c69f29 lon1) as a remote run holding one of the 8 slots. `cland executor status` shows only two tagged droplets, neither of them cland-v0-58c69f29, so its machine is gone. T-1843 reconciles a run whose record is finished and whose lease is gone, and posts a result for one that ended without one. This run's record is apparently still running with no machine, a case neither criterion covered.

## What to build

At hub start and on each remote reconciliation, treat a remote run whose record is still running but whose droplet no longer exists at the provider (confirmed by a read, as for deletions) as ended. Release its slot and post exactly one result naming the missing machine, as T-1843 does for its cases.

## Acceptance criteria

- [x] C1. A persisted remote run in the running state, whose droplet the fake provider no longer lists, is absent from `verify queue` and frees its slot after a hub start (test, red before the fix).
  - done: impl-1916 · 2026-11-16T16:57:12.074Z
  - verified: rev-36 [reviewer] · run rev-36-1916-final-1 · 2026-11-16T18:31:34.025Z · commit f83e202730fe01870ffa609cada5e528c5c45330
- [x] C2. It gets exactly one posted result naming the missing machine; a run whose droplet still exists, and a run whose provider read fails or times out (inventory unknown), both keep their slot (test).
  - done: impl-1916 · 2026-11-16T18:29:01.500Z
  - verified: rev-36 [reviewer] · run rev-36-1916-final-1 · 2026-11-16T18:31:34.025Z · commit f83e202730fe01870ffa609cada5e528c5c45330

## Comments

### impl-1916 · 2026-11-16T16:21:53.448Z

Consumer sweep: searched suite-jobs, suite-job:, suiteJobHistory/Summaries, SuiteJob, DropletRun, remoteLogStart, remote machine lost, VerificationQueue, suite.queue, verification.queue and remoteBudget across hub/src, hub/test all tiers, nvim, web, shared, .agents and docs. Producers/readers: Suites, Store/history, DropletExecutor/Run/lease, suite-worker, heartbeat, snapshot/core/dispatch/web-authority, budget/merge-batches/git-maintenance/startup diagnostics; CLI suite; shared wire/protocol; Neovim state/hub/actions/explorer/init; web connection/sessions verification/state. Existing CLI, web, Neovim queue fixtures retain old wire shape. No schema, wire, parser, credential or permission change; only lost-machine collection recovery changes row lifetime. Fake provider controls exercise absent/present/unknown inventory, persisted restart and single publication. Other consumers remain compatible because existing fields and outcome classifications are preserved; T3/T4 references retained for review, no claim they ran. Path inventory artifact follows.

### impl-1916 · 2026-11-16T16:28:32.709Z

A-20256 expands the rule-20 inventory to qa/briefs, direct field readers, all tiers and gate/cover consumers. Coordinator confirmed the exact live shape: running/null outcome retained green result/log plus partial temporary coverage map. New red-before-fix exact-shape regression fails while present and unknown inventory controls pass. Approved existing code1 incomplete cause retains native result bytes and exit0, supplies no green gate/cache/cover, and is posted verbatim. Added confirmMachineMissing internal method, only called by Suites; no wire/schema or outcome class additions. Final source review and configured verification remain pending.

### rev-35 · 2026-11-16T16:35:14.321Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1916-source-1
commit: 6706aeb8e5ce2bb9bf8c6bfd4da50a9fa82c7f35
scope: full
findings: [{"severity":"medium","text":"A persisted running/null-outcome job with valid green result but missing log bypasses lost-status log reconstruction because restoreRemoteResult suppresses status. Health/log readers throw ENOENT before provider confirmation/release, so missing-machine capacity/result remains stranded. Add the combined green-result/missing-log recovery matrix, preserving native bytes and present/unknown fences; implementer confirms no earlier owner.","file":"hub/src/hub/suites.ts","line":1503},{"severity":"medium","text":"Six new accounting callbacks own only two setup waits, not later filesystem/reopen/tick/successor continuations; the new protocol callback likewise lacks whole seed/body/waiter ownership. Test failure/timeout can race DB/root teardown. Compose pre-acquisition shared fence/join with late adoption and owned held-work control for the full new sequences; implementer confirms.","file":"hub/test/suite-accounting.test.ts","line":31}]
finding_counts: {"high":0,"medium":2,"low":0}

Complete nine-file Standards/Spec pass A-20267. Two medium findings, both source-confirmed by implementer46a836e1/02ffb93c without probe. Coordinatorf12da866 authorized existing code1 incomplete cause/original native result preservation; no objection to representation or new class requested. Existing byte equality/gate/cache/cover/report controls otherwise retained. A-20256/63 partial candidate evidence, intermediate failures/cancellation and above-cap13.09 cover run retained as disclosed, not timing/authorized-load/fullsuite proof. Original receipt/tier-disposition supplement pending with unavailable provenance explicitly unknown; no provenance reruns requested. Hold released for consolidated fixes and fresh committed-head review before configured verification. No Reviewer runtime.

Criteria: C1 failed (Green native result plus missing local log still strands provider-confirmed missing-machine recovery before capacity release.), C2 failed (The combined missing-log shape cannot post its result; new regression sequences also lack full failure-path cleanup ownership.).

### impl-1916 · 2026-11-16T16:42:27.137Z

Repair contract sweep: additive caseDeadlines.run reuses unchanged test-support/fixture-work.ts; caseDeadlines cleanup closes/join this owner before captured teardown, then retains existing named-wait drainage. Direct caller paths: suite-soak-component, web-authority, suite-close-component, suite-accounting, dev-t3-search-component, inject-stalled, suite-log-backfill, tracker-conflict-captures, executor-safety, gateway-state, setup-remotes, outbox-gateway, heartbeat, case-deadlines, suite-soak, suite-remote-log, verifier-routing, worktree-cli, suite-cover, gateway, executor-prepare-retry, executor-prepare, merge-queue, session-retry, suite-persistence (all hub/test .test.ts); helper itself. Existing wait-only callers have no admitted run sequences and retain their interfaces; new accounting/protocol callers use run plus step fencing, with bounded/observed/joined message waiter. Shared helper held-work tests are T2; native caller files remain deferred to configured selection and batch/periodic policies. Complete tier/path dispositions retained in A-20271, new helper additions to follow in final repair packet.

### rev-36 · 2026-11-16T16:50:48.926Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1916-source-2
commit: 1a09f0950fdb8414c37145441dce29cab660a8cb
scope: full
findings: [{"severity":"medium","text":"New whole-case sequence.close runs only through raw t.after; shared signal cleanup bypasses it and can close storage/remove globally owned roots while admitted FS/setup continuations still run. Existing fixture/child signal owners do not join that body (claimant01132b8d). Register pre-acquisition shared signal/resource join plus adopted-root guard, retain roots on incomplete join and own held-control release through the same path. Keep assertions and shared fixtureWork policy.","file":"hub/test/case-deadlines.ts","line":49}]
finding_counts: {"high":0,"medium":1,"low":0}

Not clear, one medium Standards finding; full pass A-20295. Source1 recovery hole is repaired: restored green native/missing-log matrix confirms provider absence before reconstruction, preserves native bytes, incomplete gating and present/unknown fences. Normal-after step/join and bounded protocol observer are valid; signal/root sequence ownership remains absent. A-20271/87/92 preserve original156-path union+helper dispositions, exact-head targeted terminal receipts and missing helper final receipt/scan/hash/native limitations. C1 stays implementation-done/unverified; C2 failed. Pin released for consolidated ownership correction/new source review before verification; no signal/provenance experiment requested.

Criteria: C2 failed (New recovery callback evidence still lacks whole-sequence signal/root-removal ownership.).

### rev-36 · 2026-11-16T16:59:16.057Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1916-source-3
commit: f83e202730fe01870ffa609cada5e528c5c45330
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear under Coordinator55dd6f54 scoped final helper round; Standards0/Spec0. A-20297 traces mandatory pre-acquisition run-user shared normal/signal enrollment, memoized join/root guard, fenced release and late-root adoption inside underlying acquisitions. Wait-onlyT1 API/no-native-import behavior and fixtureWork/process-cleanup unchanged; prior recovery/incomplete/native-byte protections unchanged and accepted. A-20296 retained68 committed-source local passes and compiler0; whole-source lint remains in progress, not claimed pass. Preserve156-path union/helper additions, historical above-cap/failed/unknown and raw/source-linkage limits. C1/C2 remain unverified until same-head configured evidence; finish existing lint then mode-free verify in granted window.

### rev-36 · 2026-11-16T17:35:39.403Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1916-evidence-1
commit: f83e202730fe01870ffa609cada5e528c5c45330
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Evidence not clear; no new source finding. A-20327 verdict/A-20326 independent ledger preserve all13 new identities base1+load5 and all helper/accounting/protocol/cover/persistence file passes. T0/T1/T2 completed; scheduler exit1 remote machine lost during Web, seven start ids unfinished/nine Web files missing, T3/T4 deferred. Hub aggregate6126 completed-phase passes;6435 ordinary+275load finish passes=6710 observed before interruption are distinct, no full-pass substitution. C1 stays done/unverified; C2 failed only for incomplete required task verification, not a failed matrix assertion. Same clean source-clear head; actual machine-loss cause/classification unknown. Lead owns investigation/retry decision; no code edit or extra run requested/authorized. Earlier scope/provenance/advisory/native/QA limits retained.

Criteria: C2 failed (Required same-head configured run9759d489 exited1 remote machine lost during Web; nine Web files lack completion, so final verification remains incomplete despite positive task matrices.).

### rev-36 · 2026-11-16T18:31:34.025Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1916-final-1
commit: f83e202730fe01870ffa609cada5e528c5c45330
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; C1/C2 verified from authorized complete same-head retryd9abbdfa/A-20335. A-20338 verdict/A-20337 independent ledger establish6476 ordinary tests/706files and separate275load tests/files, no nonpass/unfinished/skip. All13required new identities base1+load5 and positive helper5/accounting24/protocol16/cover21/persistence23 files. All172retained refs accounted62configured pass/26T3-T4defer/84source-helper; full992manifest706passes269T3/17T4defer, no lower/Webmissing. Exacthead, actual HeadlessShell1248/CfT156.0.8078.4/LinuxNode24.21, uncached; T0/T1/T2/Web0. Earlier9759 interruption/A-20326/27 retained under Coordinator0a7fe54d sysmond disposition; prior failed/unknown/provenance and report-only advisories stay explicit. Scoped source3 accepted behavior unchanged, no new findings or further run requested.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-16T22:04:54.417Z

Merged 0e093db62ab29fee4202f7d7ccc560b783b85ec8 onto dev.
