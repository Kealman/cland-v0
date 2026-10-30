---
id: T-373
kind: task
title: "Executor interface: declare prepare and reap so the droplet backend implements all nine operations"
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by: []
topic: topic-1244
branch: t/T-373-executor-interface-declare-prepare-and
created: 2026-10-14T03:43:39.962Z
updated: 2026-10-30T16:42:47.496Z
---

## Summary

The droplet backend implements 7 of the executor interface's 9 operations through `Executor`: acquire, deliver, start, status, log, cancel and release. `prepare` and `reap` keep backend-specific signatures behind `cland executor`. Unify them, so a second backend (MicroVMs, then Fly Machines) plugs in through the interface alone.

## Context

E-271's DoD C1 was accepted on this reading by the stand-in under D24 on 2026-10-14 (comment on E-271). The interface lives under `hub/src/executor/`.

## Acceptance criteria

- [x] C1. `prepare` and `reap` are declared on the `Executor` interface with backend-neutral arguments and results, and `DropletExecutor` implements the whole interface without `Pick<Executor, …>`.
  - done: impl-373 · 2026-10-30T14:46:31.972Z
  - verified: rev-26 [reviewer] · run rev-20261030-373-source-3 · 2026-10-30T14:57:29.793Z · commit 10b574f02b2bb114183beebeb1c01a7e48c285b0
  - verified: rev-26 [reviewer] · run rev-20261030-373-evidence-1 · 2026-10-30T15:18:01.592Z · commit 10b574f02b2bb114183beebeb1c01a7e48c285b0
  - verified: rev-26 [reviewer] · run rev-20261030-373-evidence-2 · 2026-10-30T16:40:39.940Z · commit 10b574f02b2bb114183beebeb1c01a7e48c285b0
- [x] C2. The local executor implements both as no-ops returning a typed "not applicable" result, and the existing executor tests pass unchanged.
  - done: impl-373 · 2026-10-30T14:57:02.513Z
  - verified: rev-26 [reviewer] · run rev-20261030-373-evidence-2 · 2026-10-30T16:40:39.940Z · commit 10b574f02b2bb114183beebeb1c01a7e48c285b0

## Comments

### impl-373 · 2026-10-30T14:42:49.296Z

Contract inventory before edits: Executor prepare(identity:string):Promise<void>, reap(olderThanMs?):Promise<void>; LocalExecutor implements these, with reap currently doing recovery. Production callers: Suites recovery (#local.reap) and admission (#local.prepare); DropletExecutor submitPrepare calls prepare(key,step), sweep calls reap(); dispatch executor.reap passes authorize callback and executor.prepare uses submitPrepare. Direct backend caller: executor-prepare-retry.test.ts prepare(key). Search includes all hub/web/nvim/shared source/tests, shipped skills, docs and QA briefs by method/type/frame names. Other .prepare matches are SQLite statements, not executor calls. Existing prepare/reap CLI/frame and persisted snapshot/lease readers remain unchanged; neutral interface will retain backend-specific overloads/results for compatibility. Local recovery moves to named reconcile, leaving interface reap a typed no-op. Existing Executor consumers (Suites/dev-T3 fake fixtures) are checked by typecheck. Proof seams: interface through scripted provider, existing CLI preparation/reap regressions, local interface no-ops.

### impl-373 · 2026-10-30T14:45:16.222Z

Expanded inventory found string-based LocalExecutor recovery mocks in suite-unit-fixture.ts, suite-component-fixture.ts, task-card-component.test.ts, executor-liveness.test.ts, verify-submission.test.ts, suite-human-component.test.ts, suite-persistence.test.ts, suite-queue-policy.test.ts and merge-queue.test.ts. Migrating those recovery interceptors to reconcile; removed redundant preparation mocks to reuse production no-op. Assertions remain unchanged. Full consumer dispositions are recorded in docs/agents/tests/hub-test-executor-prepare-retry.test.ts.md. C1 red: neutral options attempted builder delivery and failed 'deliver: scripted transport does not copy files'; green neutral current-image preparation/reap. C2 red: expected typed not-applicable result, got undefined; green local no-op test. Local file checks are running serially; no full local suite.

### rev-26 · 2026-10-30T14:51:48.829Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261030-373-source-1
commit: 2db67f208023d4e85d5411cbdc64ab1f9d838713
scope: full
findings: [{"severity":"medium","text":"M1: new guide lacks canonical test-path H1 and owning Notes index row; unchanged complete docs guard fails (lead red/green A-14457, correction not in reviewed head).","file":"docs/agents/tests/hub-test-executor-prepare-retry.test.ts.md","line":1},{"severity":"medium","text":"M2: new provider-interface case has unbounded setup/method waits and no pre-owned pending-operation join before fixture disposal; use shared bounded acquisition/observation/drain ownership, preserving assertions and omitted/aborted controls.","file":"hub/test/executor-prepare-retry.test.ts","line":55}]
finding_counts: {"high":0,"medium":2,"low":0}

A-14465 consolidates Standards M1/M2. Spec: neutral nine-operation interface, typed local no-ops and preserved local recovery/legacy droplet callers are source-implemented, no additional product defect found. Read-only review; no Reviewer workload. Correct both findings and request fresh exact pushed-head source review before verification; no dev merge unless authorized.

Criteria: C2 failed (New proof lacks bounded setup/effect ownership and guide violates unchanged docs guard; existing-tests pass requirement remains unverified.).

### rev-26 · 2026-10-30T14:56:51.669Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261030-373-source-2
commit: a7456b3f9e3dae51c75f2a14e8b7af042f02caa2
scope: full
findings: [{"severity":"medium","text":"Remaining M2: uploadOwner.setup(acquisition) caps complete cold fixture creation at fixed 1000 ms, overriding the existing separate 30 s caseDeadlines acquisition guard. Keep that guard and ownership; retain short receipt controls and effect/drain bounds.","file":"hub/test/executor-prepare-retry.test.ts","line":74}]
finding_counts: {"high":0,"medium":1,"low":0}

A-14474 consolidates source2: M1 resolved; M2 pending-work ownership/results/drain and omitted/aborted controls corrected, with only full-acquisition deadline mismatch remaining. Product bytes unchanged, no further Spec finding. Lead's one-line correction not in this verdict commit. Exact pushed-head source review before verify; no Reviewer workload.

Criteria: C2 failed (Full fixture acquisition is coupled to the short receipt deadline; corrected exact-head source review and configured tests-pass evidence remain required.).

### rev-26 · 2026-10-30T14:57:29.793Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-373-source-3
commit: 10b574f02b2bb114183beebeb1c01a7e48c285b0
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14476 source3 clear: sole one-line delta lets existing 30 s caseDeadlines acquisition govern full fixture creation, retaining pre-owned work/drain/root barriers and unchanged 1000 ms receipt/5000 ms effect/drain controls. M1/M2 resolved, production bytes unchanged since source1. C1 source-verified; C2 typed no-ops source-implemented but existing-tests-pass clause awaits same-head configured final evidence. Local targeted/typecheck correction receipts and prior-head advisory lint accurately separated. No Reviewer workloads. One mode-free verify at frozen exact head may proceed; final original-record review follows.

Criteria: C1 verified.

### rev-26 · 2026-10-30T15:18:01.592Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-373-evidence-1
commit: 10b574f02b2bb114183beebeb1c01a7e48c285b0
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14498 clear executed scope of original A-14495/24f20c9d:4266 ordinary+125load passes,T0/T1/allT2/Web complete,T3/T4 unrun. Four new exact interface/noop/drain identities each base+5/5load; all16selected executor files and migrated recovery consumers pass, docs3/3. C1 verified; C2 typed-noop portion established but existing native T3 executor tests have no receipt, so C2 remains unverified pending Coordinator-owned verify all at this exact head before enqueue. This is not final C2/ready clearance, nor a failure classification. Report-only advisories retained; no Reviewer workloads.

Criteria: C1 verified.

### rev-26 · 2026-10-30T16:40:39.940Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-373-evidence-2
commit: 10b574f02b2bb114183beebeb1c01a7e48c285b0
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14585 independently audits A-14575:5300 ordinary pass/0fail/5skip plus125 load passes. All existing native executor files now execute with unchanged assertions; typed local no-op base+5/5 load and full preparation controls pass. C2 verified under Coordinator688eb123 explicit shared T-1491 duration-gate disposition; C1 retained. Native run remains exit1 solely offline V8 analyzer5.134>5s; no relabelled green. Web/T4 unexecuted here; prior same-head A-14495 Web proof separate. No Reviewer workload. T-1491 landing, authorized dev merge and exact delta review remain before landing per Coordinator.

Criteria: C1 verified, C2 verified.
