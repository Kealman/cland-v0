---
id: T-1905
kind: task
title: Test process cleanup throws "native process identity unavailable" for a child whose exit was already observed, under Linux load
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - flaky
assignee: null
parent: E-1882
blocked_by: []
topic: topic-1545
branch: t/T-1905-test-process-cleanup-throws-native
created: 2026-11-16T07:44:00.478Z
updated: 2026-11-16T14:03:57.504Z
closed: 2026-11-16T14:00:55.654Z
---

## Summary

In impl-1703's loaded Linux evidence (2026-11-16, Docker `--init`, arm64 Node 24.21.0, load 10.64, dev edbe8da2c plus T-1703's patch), `hub/test/opencode-adapter.test.ts:608` "after a hub restart, resume re-finds the OpenCode server and session through the process table and the event stream goes on" failed 20/21 in cleanup. It reported `Error: native process identity unavailable for pid 1761; fixture preserved; captured: known; current: native exit observed; listed descendants are not confirmed gone`, from `requireIdentities` → `cleanupRecordedProcesses` → `cleanupOwnedProcesses` → `cleanup`. The same file passed 21/21 at load 8.15 just before. The test's assertions passed; only the fixture's teardown refused. `hub/test/process-cleanup.ts:94` throws when either identity is missing and `alive(target.pid)` is true. Here the current row says the native exit was observed, which points to an exited child that isn't reaped yet still answering the liveness probe, or a pid reading taken after exit. It is not T-1703's change, a closed-store fence in sessions.ts.

## What to build

Find what `alive(pid)` sees for a child whose native exit was observed: a zombie, a reaped pid or a reused pid. Make cleanup settle an observed exit as gone when its captured identity matches and no live process with that identity remains, and keep refusing a pid that is live with an unknown identity (T-543 and T-1337 stay intact). Add a regression with a held reap or a fake process table.

## Acceptance criteria

- [x] C1. Cleanup accepts a child whose captured identity is known and whose exit was observed, including while the zombie is unreaped, and still refuses a live pid with an unknown or mismatched identity (test, red before the fix).
  - done: impl-1905 · 2026-11-16T08:53:39.872Z
  - verified: rev-36 [reviewer] · run rev-36-1905-final-1 · 2026-11-16T10:09:25.795Z · commit 39ff848afecea7a7bf394dcc3da995f2ea2c8077
- [x] C2. `opencode-adapter.test.ts` passes 10/10 full-file runs in a Linux `--init` container at a load of at least 10, with no cleanup refusal (evidence).
  - done: impl-1905 · 2026-11-16T09:37:18.261Z
  - verified: rev-36 [reviewer] · run rev-36-1905-final-1 · 2026-11-16T10:09:25.795Z · commit 39ff848afecea7a7bf394dcc3da995f2ea2c8077

## Comments

### coord · 2026-11-16T08:34:34.320Z

A second occurrence, worse: in impl-1703's T-1703 loaded sample 4 (2026-11-16 08:28–08:34Z, Docker `--init`, load 10.03, ffe84f8ed), `opencode-adapter.test.ts:438` "a failed OpenCode turn…" hit the same cleanup refusal (pid 1502, native exit observed, descendants not confirmed gone). After every subtest had printed, the file never completed: a spoke stayed alive under the preserved fixture, and it took SIGTERM after 305 s, with file-level cancelled 1 and "Promise resolution is still pending but the event loop has already resolved". So T-1905 also hangs whole files under load, not just fails a case. It hit in 2 of 4 loaded samples of this file. Priority raised: launching now.

### impl-1905 · 2026-11-16T08:37:17.356Z

Rule 20 sweep before change: cleanupOwnedProcesses direct consumers: hub/test/{harness.ts,run-suite.ts,load-gate.ts,web-repetitions.ts,process-cleanup.test.ts,host-create-ready.test.ts,host-create-fixture.ts,transport-ssh.test.ts,host-reboot-native.test.ts,executor-safety.test.ts,transport-contract-fixture.ts,suite-runner.test.ts,host-supervisor.test.ts,ssh-host-fixture.ts,fakes/fake-host.ts}. requireIdentities is private, called at initial acquisition, pre-signal and post-signal drainage in both discovered and recorded cleanup. All keep Promise<void> API and optional identityError shape; no production callers or wire shape changes. Indirect ownProcess/ownDirectory users keep ownership/fixture-retention semantics. Swept field/function names and helper importers across hub, web, nvim, shared, QA and shipped skills/docs, including all tiers. Relevant documentation: docs/agents/tests/hub-test-process-cleanup.test.ts.md. Existing replaced/unreadable identity and unrecorded-descendant tests must stay intact; add captured descendant drainage regression at this existing synthetic seam.

### impl-1905 · 2026-11-16T08:41:41.183Z

Implementation pushed at 20f97dbc6169121eaa99f5de10e9bb31f1b0fbb1 after merge origin/dev (89b8b0bfe). C1 done: A-19897 deterministic red/green and A-19899 native macOS arm64 Node 24.21.0 full-file 63/63, exit 0, cancelled/skipped 0, 10.628s at start load 4.62. npm run test:lint exit 0 (whole-source and closed-item wording 0 findings; advisory/report-only findings unchanged), npm run typecheck exit 0. C2 loaded Linux 10/10 and configured verify pending after source review. Rule 20 full path inventory A-19900 includes indirect helpers, docs, briefs and fixtures across all tiers; correction: production suite-lock.ts imports cleanupProcesses dynamically and ProcessIdentity type, so is an indirect consumer of internal requireIdentities; unchanged API/safety semantics apply. All callers keep existing shape; no wire change.

### impl-1905 · 2026-11-16T08:48:02.218Z

Evidence supplement A-19907 records original commands/tool sessions/completion receipts and distinguishes candidate trees from commit20f97dbc6, with missing independent native signal/raw streams labelled unknown. A-19908 retains all359 consumer/reference paths with normalized tier and execution/default/QA disposition. No reruns or source changes. Reviewer raised same-birth descendant changing group during post-signal drain: acknowledged, no independent close invariant; holding head while source pass finishes. C2/verify not run.

### rev-36 · 2026-11-16T08:50:10.550Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1905-source-1
commit: 20f97dbc6169121eaa99f5de10e9bb31f1b0fbb1
scope: full
findings: [{"severity":"medium","text":"New post-signal requireIdentities(...,true) admits a captured live descendant for draining, but recorded drain still uses verified(row), which requires captured group equality as well as PID/birth. A same-birth child moving group around the group signal can therefore be dropped from pending writers after parent exit; line498 breaks and seeds settle while it remains live, permitting root disposal. No independent close owner exists (claimant e0730ab6). Retain PID+captured birth for post-signal drainage independent of group; preserve pre-signal authority and add bounded escaped-group/root-retention control.","file":"hub/test/process-cleanup.ts","line":497}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source audit A-19910: Standards0/Spec1 medium. Intended zombie-parent relaxation otherwise preserves identity/refusal boundaries, but same-birth changed-group path must remain pending. A-19907 transcribed original commands/cwd/completions/candidate limits and A-19908 all359 normalized consumer paths retained; A-19899 saved63/63 Mac candidate output is not exact-head/Linux/configured evidence. C2 remains incomplete; requires10 clean loaded Linux --init full native files, without importing T-1703's exception. Final consumer dispositions must follow actual suite infrastructure/default selection including Web rather than generic no-web-diff planning. No criteria verified. Pin released: repair, restore mark, commit/push and request fresh review before native/configured execution; no provenance rerun requested.

Criteria: C1 failed (Post-signal settlement can drop a same-birth live descendant after its group changes, allowing fixture removal before writer exit.).

### rev-36 · 2026-11-16T08:56:50.855Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1905-source-2
commit: 39ff848afecea7a7bf394dcc3da995f2ea2c8077
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source audit A-19919: Standards0/Spec0. Sole A-19910 blocker resolved: recorded post-signal pending life follows PID+captured birth independent of group; pre-signal verification/group/signalling bytes unchanged. Four escaped-group live/root-retention/positive-exit controls shown red4/4 in A-19914 and selected29/29 green A-19915, with exact diagnostic and removal assertions retained. Redacted output/candidate/native completion limitations explicit; predecessor63/63 not relabelled fresh-head. Typecheck/lint completions transcribed,122 findings report-only. C1 done restored, no criteria verified/final ready: C2 requires10 clean Linux --init loaded>=10 full files plus subsequent same-head configured changed-T3/default evidence. A-19907/A-19908 consumer/provenance limits retained; actual configured selection supersedes generic planning. Source clear permits authorized evidence at39ff848af; fresh source change needs review.

### impl-1905 · 2026-11-16T09:18:01.634Z

C2 partial evidence A-19931 at39ff848af: Linux arm64 Node24.21.0 Docker --init/network-none/4CPU, runs1–3 full21/21 native exit0/signalnull, loads entry/end10.14/11.16,11.16/11.22,11.22/11.08. Run4 red20/21 exit1/signalnull,0cancel/skip,load11.08/11.44,no timeout. Exact failure pending-permission case: Error: database is not open, ERR_INVALID_STATE, ProcessTable.bySessionId -> #turnFailed. No cleanup refusal in four files, but run4 does not pass. Reported shared-defect candidate to lead; diagnosis/repetitions held pending Coordinator. Container absent positively inspected; lock released. C2 incomplete3/10; configured verify not submitted. Preservation-lock missing during initial slot interval is retained as evidence limitation in README, alongside native/raw/candidate fields.

### impl-1905 · 2026-11-16T09:20:35.176Z

Coordinator disposition09:18: run4 is existing T-1703 defect; no shared fix/head merge for T-1905. A-19931 forwarded to lead T-1703 in topic-1540. Continue next authorized slot after T-1731, preserving exact known T-1703 failures as raw red/not counted (never green or cleanup failure); any other red, native timeout/cancellation/hang or cleanup refusal stops and escalates. C2 remains3/10, seven green files required. Runner keeps separate per-slot outputs/attempt indices and strict native/generated fact checks. Source head39ff848af unchanged.

### impl-1905 · 2026-11-16T09:39:40.482Z

C2 marked done: A-19937 + A-19931 retain10 green full Linux --init files at exact source39ff848af among11attempts; known T-1703 attempt4 retained red/not counted per Coordinator. Every green21/21 native exit0/signalnull,0cancel/skip,boundedfalse,entry/end load>=10; all21 generated passing case names independently matched across10green logs. Source unchanged. Mode-free verify93669eee-6991-4eba-a933-64e2209bbfee admitted exact reviewed head. CLI exit75/no reply, single queue check confirmed admitted remote acquiring; never resubmitted. Durable T0 exit0 duration81.322s observed; verify window released. Remote configured runtime result and final actual-selection/consumer reconciliation pending. No final-ready claim.

### impl-1905 · 2026-11-16T10:07:23.961Z

Same-head configured verification93669eee green A-19948: modefull suite infrastructure fallback,allT1/allT2/changedcleanupT3/Web;6447pass6447,0fail/cancel/skip. T1 files220/tests1659,T2 files425/tests4242,T3 files1/tests67,Web files55/tests292. HostT0 exit0/81.322s; dropletLinuxx64 Node24.21.0 Neovim0.12.5,c-8nyc1,lifetime1386s,cost$0.0962. Duration/budget/ratchet and122lint findings remain report-only. Pinned Chrome Headless Shell156.0.8078.4 build1248 installed; independent browser-launch version field not captured. Final A-19952 reconciles all359consumer paths from actual streamed outcomes (140configured/manual executed,125deferred,94indirect refs), replacing generic no-Web planning. A-19951 retains actual slot2 controllers and close->JSON mapping with explicit source-copy/provenance limits and missing slot1original snapshot. Both scanned before publication. C2 A-19937/A-19931 ten clean loaded files among11attempts; knownT1703red excluded. Reviewer holds unchanged39ff848af for final settlement; no further tests or source mutation.

### rev-36 · 2026-11-16T10:09:25.795Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1905-final-1
commit: 39ff848afecea7a7bf394dcc3da995f2ea2c8077
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head audit A-19954 / independent ledger A-19950: C1/C2 verified. A-19948 run93669eee passed at reviewed39ff848af; all67 cleanup cases/file have positive finishes, including six new escaped-group/zombie cases and all refusal/identity controls. A-19931/A-19937 independently supply10 clean full21/21 native Linux --init files, child code0/signalnull/unbounded, all identical21 passing names, sampled entry/end load>=10. Attempt4 remains raw T-1703 red/not counted under Coordinator5f8e2a0a; ten clean among11, no cleanup refusal. A-19951 preserves actual slot2 controllers/close mapping, missing slot1 source snapshot/launch hashes and physical-lock gap remain explicit. Configured6447 base tests/701 files plus separate210 load test/file passes;984 manifest paths =701 positive +266 configured-T3/17T4 deferrals, no lower/Web gap. A-19952 retains all359 prior refs,139 configured files independently matched,1 manual-C2,125 deferred,94 source refs. Exact Linux/Node/recorded browser provenance36980, no cache/skips; report-only budgets/lint/ratchet not performance pass. Full remaining integrated tiers/QA separate. Hub/Coordinator own ready/landing.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-16T14:00:55.654Z

Merged 22abbaf227644336ba06d877ea37d21f838599c0 onto dev.
