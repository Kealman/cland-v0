---
id: T-1746
kind: task
title: Hosts started on demand, `min_hosts` kept, scaling with `cland config set`
state: closed
status: done
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1534
blocked_by:
  - T-1745
  - T-1737
  - T-1738
topic: topic-1440
branch: t/T-1746-hosts-started-on-demand-min-hosts-kept
created: 2026-11-07T16:01:58.402Z
updated: 2026-11-08T10:28:57.057Z
closed: 2026-11-08T10:28:57.057Z
---

## Summary

The pool runtime creates hosts through the create path. It keeps `min_hosts` hosts per pool from hub start, and starts a further host for a waiting launch while ready plus booting hosts are below `max_hosts`. While that host boots, the launch's reason reads "waiting for host <id> to boot", and the launch is placed when the host is ready. A `max_hosts` raised with `cland config set` re-runs placement at once. Nothing raises `max_hosts` by itself.

## What to build

The scale-up half of the scheduler, over T-1740's decisions. It is driven by hub start, launches, readiness and configuration changes, with one in-flight create per decision. Several waiting launches that fit one new host start one host. Creation goes through T-1737's create seam, without editing `provision-host.ts`.

## Acceptance criteria

- [x] C1. A hub starting with an empty `agents` pool of `min_hosts = 1` creates one fake host without any launch (test).
  - done: impl-1746 · 2026-11-08T09:03:08.885Z
  - verified: rev-35 [reviewer] · run rev-35-1746-final-1 · 2026-11-08T09:52:51.100Z · commit dd1a3a59b0b3d72c4470728630052db372f38b45
- [x] C2. A launch with no room in a pool below `max_hosts` starts a host, waits as "waiting for host <id> to boot", and is placed when that host is ready (test).
  - done: impl-1746 · 2026-11-08T09:29:15.871Z
  - verified: rev-35 [reviewer] · run rev-35-1746-final-1 · 2026-11-08T09:52:51.101Z · commit dd1a3a59b0b3d72c4470728630052db372f38b45
- [x] C3. With `max_hosts` reached, a launch waits as "waiting for a host", and `cland config set hosts.agents.max_hosts 2` starts a second host and places the launch without a hub restart (test).
  - done: impl-1746 · 2026-11-08T09:03:09.149Z
  - verified: rev-35 [reviewer] · run rev-35-1746-final-1 · 2026-11-08T09:52:51.101Z · commit dd1a3a59b0b3d72c4470728630052db372f38b45
- [x] C4. Booting hosts count toward `max_hosts`, and two waiting launches that fit one new host start one host (test).
  - done: impl-1746 · 2026-11-08T09:03:09.424Z
  - verified: rev-35 [reviewer] · run rev-35-1746-final-1 · 2026-11-08T09:52:51.101Z · commit dd1a3a59b0b3d72c4470728630052db372f38b45
- [x] C5. With more waiting launches than `max_hosts` hosts can hold, the pool never exceeds `max_hosts` (test).
  - done: impl-1746 · 2026-11-08T09:29:17.338Z
  - verified: rev-35 [reviewer] · run rev-35-1746-final-1 · 2026-11-08T09:52:51.101Z · commit dd1a3a59b0b3d72c4470728630052db372f38b45

## Blocked by

- T-1745
- T-1737
- T-1738

## Notes

- Hot files: `hub/src/host/pool-runtime.ts`, `hub/src/hub/daemon.ts` (start and config-apply hooks).
- Tests: new `hub/test/pool-scale.test.ts` (T2, injected create seam); one case on the host-create fixture (T3), in which a waiting launch starts a fake host and is placed on it.
- Serves epic C1, C3 and C4.

## Comments

### impl-1746 · 2026-11-08T08:54:13.409Z

Rule-20 sweep before admission change: PoolRuntime consumed only by adapters/sessions.ts; waiting reasons consumed by waiting-launch.ts, waiting-launch-store.ts, waiting-launches-owner.test.ts, session-pool-placement.test.ts, CLI session renderer, web Inbox and nvim inbox (generic string). Scheduler contracts covered host-scheduler.test.ts. Docs/spec/v0.4.md, docs/hub/host-providers.md, qa/briefs/E-1534-stage-1.md retain same wire strings. No reply/record fields change; PoolCapacityUnavailable gains internal reason only. Creation uses dispatch create seam, same records/lease/watchdog; no persisted shape changes. T2 scale tests use projectHub injected create seam; T3 case host-create-ready.test.ts.

### impl-1746 · 2026-11-08T09:00:45.201Z

Consumer migration: waiting-launch.test.ts memory-departure assertion now expects 'waiting for host b to boot' because b remains in cloning; old generic-reason expectation caused the sole failure in 463-case T1/T2 matrix. Updated test passes; prior 462 cases passed. Native T-1746 case passed macOS arm64 Node24.21.0 local at uncommitted tree in 2.960478458s (no browser); uses native fake SSH/provider and fake in-process Codex. active() reader change: PoolRuntime.reserve registered()→active(), plus new min/max counts. Existing expression-state index reused. No wire or stored-row shape changes.

### impl-1746 · 2026-11-08T09:05:43.627Z

Rule-20 extension before next head: provision-host createHost callers: production hub/dispatch (manual and automatic); direct host-lease, host-create-ready, host-destroy-native, host-provision-gate, host-provision-recovery tests; host-create-entry injected seam and harness serveProject option; daemon startup fake membership reconciliation; host-destroy tests/list/destroy imports. QA briefs E-1534-stage-1, E-1533, E-1533-stage-3 are manual host guides and unchanged frame consumers. Proposed optional admission hook keeps previous create signature callable and all record/wire fields unchanged. New occupied() max count must share positive non-acquisition kinds with cancelHostSpend ('not-called', 'provider-refused') and confirmed release path, tested for pending/incomplete restart fences. Waiting-admission fix must also sweep adapters/requests, TaskWorktrees.launch and persisted WaitingLaunchRecord readers; no scaling effects from reserve before durable wait validation.

### rev-35 · 2026-11-08T09:07:31.581Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1746-source-1
commit: 9db67c6bc6abfad10222f47befacab166c4b0231
scope: full
findings: [{"severity":"high","text":"Automatic #flights fences only automatic calls; manual host.create shares a helper but not per-pool admission. Max/config are checked before queued and image/config awaits, with no latest pool/max revalidation at durable creating-row publication. Manual+automatic calls can both take the last slot, and a changed max/pool can admit stale creation. Use shared per-pool pre-row admission/serialization; author79d3e44c confirms; Coordinator3569cd3b approves the narrow provision-host seam.","file":"hub/src/host/pool-runtime.ts","line":43},{"severity":"high","text":"active() correctly contains the approved six states, but using only it for max ignores failed pending acquisitions and retained machines with unknown/incomplete release. Restart/config reapply clears lifetime failure suppression, allowing new billable hosts beyond max while old acquisition remains unresolved. Add separate indexed occupied(pool) receipt-aware fence without broadening active(); author79d3e44c and Coordinator3569cd3b confirm.","file":"hub/src/host/pool-runtime.ts","line":41},{"severity":"high","text":"reserve() starts billable scaling before TaskWorktrees item/claim/name validation and before launchOrWait durably admits a wait. A request later refused or invalidated can therefore start creation with no accepted waiting owner. Keep selection side-effect-free, scale only from validated admitted demand, and revalidate that authority at the pre-row checkpoint; author001566e5 confirms no approved pre-admission billing authorization.","file":"hub/src/host/pool-runtime.ts","line":78},{"severity":"medium","text":"Unconditional async close returns a Promise even without any create flight. For project Sessions with hostPools this forces construction rollback into projectSessions' detached async catch, losing synchronous aggregate cleanup failure semantics repaired in T-1744. Return void when idle and only an owned drain when flights exist; retain abort-before-join and aggregate rollback controls. Author79d3e44c confirms no other owner.","file":"hub/src/host/pool-runtime.ts","line":51}]
finding_counts: {"high":3,"medium":1,"low":0}

A-17781 complete pinned pass:3high+1medium confirmed79d3e44c/001566e5. Need shared latest-config per-pool pre-row create admission for manual+auto, separate receipt-aware occupied billable fence, scale only from valid durable demand (startupminimum explicitserviceauthority), idlevoid close preserving synchronous aggregate rollback. Coordinator3569cd3b explicitly approves occupied count and narrow provision-host callback; keep active() exact approved six-state set. Normaldaemon dispatcher aborts/joins before Sessions close, so no additional normalshutdown deadlock finding. Guides/tiers/frozenhelp/nativeprearmedobserver inspected. A-17779 qualified narrative targetedmixedred/green, notconfiguredproof; originalstreamsnotteed/truncated per a665afb5, preservehonestavailableexcerpts/commands/native/source limits withoutrepeat. Latestnative3.092895792 keeps8s cap sufficient under labelled1.6Linuxprojection; updatequalification,noLinuxclaim. C2/C5failed, othercriteriaunverified. Exactcleanhead/diffcheck confirmed; passclosed, combinefixes afteradmittedproducerdrains/freshcommittedreviewbeforeverify. No Reviewer tests/probes/edits/delegation or extra fullsuite/provenance/unchanged-source repeat/devmerge requested. AfterstageQA separate.

Criteria: C2 failed (Scale creation starts during side-effecting selection before durable validated wait admission, so refused/invalidated item launches can start billable work.), C5 failed (Manual/automatic create lacks shared latest-config pre-row fence, and unresolved failed acquisitions are omitted from max occupancy.).

### rev-35 · 2026-11-08T09:24:34.630Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1746-source-2
commit: fbee6a1429dfbfad6852e268e661f1455c0b40dc
scope: full
findings: [{"severity":"high","text":"Durable wait/demand validation remains incomplete: item-worker nameRefusal and Lead-requires-item checks run only after placement, and #checkRolesLaunch checks load error rather than current role membership. Invalid worker names/Lead requests or a removed role during held preparation can still persist demand and bill a host. Share existing generic validation at durable admission and pre-row revalidation, preserving claim precedence; authord7fe3803/1149feaf confirm, Coordinatorc8066eb9 requires completion.","file":"hub/src/adapters/sessions.ts","line":154},{"severity":"medium","text":"occupiedSql accepts recognized non-acquisition kind plus SQLite julianday(at), while cancelHostSpend uses positiveNonAcquisition/Date.parse. Relative or malformed retained timestamps can therefore free a max slot despite spend refusing the receipt; shared kinds alone do not provide one proof boundary. Use the same production parser after indexed narrowing, with invalid-receipt and 10k released-history decode controls per Coordinatorc8066eb9. Authorcf85b28e confirms no normalization owner.","file":"hub/src/host/provision-records.ts","line":12}]
finding_counts: {"high":1,"medium":1,"low":0}

A-17788 complete corrected pass:1high+1medium. Shared latestconfig/manual-auto synchronous pre-row checkpoint, effect-free selection/read-only item admission and idlevoidclose source-repaired. Remaininggenericvalidator must cover itemnames/Leaditem/currentrole membership atdurableadmission andpre-row (d7fe3803/1149feaf). occupiedSQL julianday differsfrom sharedJSDate.parse, no normalizationowner(cf85b28e); Coordinatorc8066eb9 directs indexednarrowing thenproductionJSvalidator+10khistory/anomaly controls,no columntrigger. Same decision explicitly approves memory-refused readyhost no-create while roombyweight, so earlier memory question is notfinding; document/testpolicy. C2/C5failed, othersunverified. A17782T0producer0; raw A17783components671/672 +A17784recheck22, A17785native371/372 +A17787worktree6, A17786admission5 independentlyread with mixedload/source/producerlimits,notcleanfullmatrix/configuredproof. Cleanpinnedhead/diffcheck confirmed. Passclosed; combinedfix/newcommittedrequestbeforeverify. No Reviewer tests/probes/edits/delegation or extra fullsuite/provenance/unchanged-source repeat/devmerge requested. AfterstageQA separate.

Criteria: C2 failed (Generic name/Lead/current-role validity remains missing at durable demand and pre-row checks, so invalid requests can still bill creation.), C5 failed (Occupancy and spend use different timestamp parsers for positive non-acquisition, allowing unproved retained receipts to free max slots.).

### rev-35 · 2026-11-08T09:32:59.562Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1746-source-3
commit: dd1a3a59b0b3d72c4470728630052db372f38b45
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, Standards and Spec zero remaining findings; audit A-17794. Generic durable-demand/pre-row name, Lead and current-role validation and indexed occupancy/shared positiveNonAcquisition parser parity repaired. Coordinator c8066eb9 memory policy preserved. C1–C5 runtime-unverified pending exact-head configured verification. Newly inspected A-17789 native341/341 producer0, A-17790 retained440/450 failure plus A-17791 affected40/40 producer0 and A-17792 check0 support qualified local preservation; A-17795 explicitly identifies mixed/developing source and no immutable final-head aggregate/Linux proof. No Reviewer runtime execution. After-stage affected QA separate.

### impl-1746 · 2026-11-08T09:52:20.842Z

Configured verification55c22a0e green at reviewed dd1a3a59b/tree0997cfc42c728fc516e7145287fbc7bcdb9199d1, artifact A-17796. Droplet Linuxx64 Node24.21.0, c-8 lon1; uncached; reported5588pass/0fail/0cancel/0skip. T0/T1/all fallbackT2/Web complete; changed T3 host-create-ready11 identities once, mapped T4 inbox-verifier-load once/no repetitions; remaining T3 deferred merge batch. Web Chrome for Testing156.0.8078.4 headless-shell1248. Lifetime1019s cost$0.0708. Report-only duration regressions retained. All16 pool-scale cases confirmed basepass+5/5load; receipt parity/occupied anomaly budget/idleclose and pre-row refusal basepass+5/5. Native T-1746 case2.730734119s, allowance8s retained. Consumer inventory A-17795 and per-test QA guides committed; awaiting Reviewer final criterion settlement, no code or head change.

### rev-35 · 2026-11-08T09:52:51.101Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1746-final-1
commit: dd1a3a59b0b3d72c4470728630052db372f38b45
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final source3 plus exact-head evidence clear; A-17797 independently audits A-17796/55c22a0e. Clean unchanged commit and reconstructed source projection0997cfc42c728fc516e7145287fbc7bcdb9199d1 match. Hub5588/5588, base timing5449/5449, six empty failure arrays. All16 scale cases base+80/80 load passes, five provision-record controls base+25/25 load, pre-row refusal base+5/5, native create-ready11/11 once including exact T1746 case2.730734119s under8s allowance; roles refresh16 base passes. C1–C5 verified. T0/allT1/fallbackallT2/changedT3/mappedT4base/Web exit0, native uncached Linuxx64 Node24.21 Nvim0.12.5, browserShell1248/CfT156.0.8078.4; zero fail/cancel/skip/todo. RemainingT3 merge-batch and T4 repetitions unrun, report-only duration/lint/ratchet notices retained. Qualified local mixed-tree receipts remain qualified. No Reviewer runtime execution or further rerun requested. Affected after-stage QA separate.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-11-08T10:28:57.057Z

Merged 32a5fdbf00d0f7f3dc6128a277f8703c095c6fc1 onto dev.
