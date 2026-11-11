---
id: T-1786
kind: task
title: Exclusive and non-exclusive logins
state: closed
status: done
size: L
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1535
blocked_by:
  - T-1779
  - T-1781
topic: topic-1469
branch: t/T-1786-exclusive-and-non-exclusive-logins
created: 2026-11-09T12:44:11.156Z
updated: 2026-11-10T22:46:55.023Z
closed: 2026-11-10T22:46:55.023Z
---

## Summary

`exclusive` is enforced twice: the scheduler never binds an exclusive login that is in use, and an attach the provider refuses as "attached elsewhere" counts as in use. A non-exclusive login serves readers. The first host to bind it takes the login's own volume and is its writer. Each later host gets a reader volume made from the latest snapshot, never writes back, and has that volume deleted when it stops. `cland login set <name> --exclusive true|false` changes the flag while the login is not in use.

## What to build

Writer and reader bindings:
- **A reader bind.** `createVolume` from the latest snapshot, then attach and mount.
- **A reader release.** Unmount, detach and a confirmed `deleteVolume`.
- **The writer.** It binds and releases as in T-1778 and T-1779.

A reader bind with no snapshot is refused naming it. The `login.set` frame and `cland login set` are added; the command is refused while the login is in use. Every disk login defaults to exclusive.

## Acceptance criteria

- [x] C1. A second host cannot bind an exclusive login in use, and a provider attach refused as attached elsewhere leaves the launch unplaced on that host and the login unchanged (test).
  - done: impl-1786 · 2026-11-10T21:11:57.860Z
  - verified: rev-36 [reviewer] · run rev-36-1786-final-1 · 2026-11-10T22:08:46.618Z · commit e9ec2f1cfd16b9547399648b13d2cb4ba7867546
- [x] C2. With `exclusive = false`, two fake hosts run sessions on one login at once: the first holds the login's own volume and the second a volume made from the latest snapshot (test).
  - done: impl-1786 · 2026-11-10T21:38:18.673Z
  - verified: rev-36 [reviewer] · run rev-36-1786-final-1 · 2026-11-10T22:08:46.618Z · commit e9ec2f1cfd16b9547399648b13d2cb4ba7867546
- [x] C3. After both hosts stop, the login's own volume holds the writer's turns and none of the reader's, and the reader's volume is deleted with a confirming read (test).
  - done: impl-1786 · 2026-11-10T21:38:19.109Z
  - verified: rev-36 [reviewer] · run rev-36-1786-final-1 · 2026-11-10T22:08:46.618Z · commit e9ec2f1cfd16b9547399648b13d2cb4ba7867546
- [x] C4. `cland login set <name> --exclusive false` is refused while the login is in use, and `cland login list` shows the writer's host and each reader's host (test).
  - done: impl-1786 · 2026-11-10T21:11:58.450Z
  - verified: rev-36 [reviewer] · run rev-36-1786-final-1 · 2026-11-10T22:08:46.618Z · commit e9ec2f1cfd16b9547399648b13d2cb4ba7867546
- [x] C5. A reader bind of a non-exclusive login with no snapshot is refused naming the missing snapshot (test).
  - done: impl-1786 · 2026-11-10T21:11:58.745Z
  - verified: rev-36 [reviewer] · run rev-36-1786-final-1 · 2026-11-10T22:08:46.618Z · commit e9ec2f1cfd16b9547399648b13d2cb4ba7867546

## Blocked by

- T-1779
- T-1781

## Notes

- Hot files: `hub/src/host/login-binding.ts`, `hub/src/host/logins.ts`, `hub/src/cli/login.ts` (`set`). Registration points: `hub/src/protocol.ts`, `hub/src/hub/dispatch.ts`.
- Tests: new `hub/test/login-exclusive.test.ts` (T2); one T3 case with the fake harness on two fake hosts for C3.
- Serves epic C4.

## Comments

### impl-1786 · 2026-11-10T21:01:35.323Z

Rule-20 pre-change sweep: suite-import-graph importingTests over all 938 tier catalog entries for logins.ts/login-binding.ts/login-release.ts reaches 691 tests, with 15 unknowns treated as reached (full list in topic artifact). Explicit field/function sweep includes LoginRecords.selectForLaunch/bind/updateBackup, LoginBinder.prepare/finish, releaseHostLogins, LoginSnapshots, Sessions spawn/provision/resume, CLI login list/add/snapshot, protocol validation, local-human/web/users authority. No existing wire fields change; login.set is additive. Persisted legacy absent binding.phase remains settled. Native reached consumers include host-create-ready, host-destroy-native, host-restart, host-unreachable, host-stop and login-write-back; T4 remains stage occasion. QA E-1535 stages 1/2 and implement skill describe unchanged writer behavior; docs will add reader behavior. Existing nvim catalog fixtures retain previous wire shape. No key-policy change.

### impl-1786 · 2026-11-10T21:08:27.530Z

Consumer-sweep addendum: shared/wire/index.ts adds the approved login.set declaration; hub/test/wire-conformance.ts checks parity with protocol.ts. hub/test/login-list.test.ts migrates its explicit web/gateway/session-as refusal catalog to include login.set (existing frames and legacy list shapes unchanged). T2 records/binding/release/selection: 80/80 local macOS passed. Native reached host-create-ready 12, host-destroy-native 3, host-restart 1, host-unreachable 20, host-stop 4, login-write-back 1 all passed locally, each file sequential in preservation slot. Native reader isolation 1/1 passed (fake Codex and two fake agents). Full frame regeneration/catalog consumers currently running; Linux mode-free verify still pending source review.

### rev-36 · 2026-11-10T21:15:25.815Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1786-source-1
commit: b58455745b490a51a988ae55fbcc329335f5ee73
scope: full
findings: [{"severity":"high","text":"Reader clone create occurs before durable binding/operation ownership and outside rollback. Lost committed-create response or post-create records.bind failure leaks an untracked clone; persist intent/identity before admission and retain exact-owned reconciliation across unknown/failure/restart.","file":"hub/src/host/login-binding.ts","line":63},{"severity":"high","text":"Reader deleteVolume success precedes unbind without durable deletion receipt. Failed unbind/restart leaves an absent clone that subsequent inventory rejects forever; same delete-before-unbind class exists in bind rollback/refusal. Persist/reconcile exact positive deletion ownership for reachable/lost/restart paths.","file":"hub/src/host/login-release.ts","line":36},{"severity":"medium","text":"LOGIN_USAGE prepends login.set but frozen commands.json LOGIN_USAGE still starts login snapshot; required cli-usage-compatibility deepEqual consumer not migrated. Update intended bytes while preserving compatibility assertion.","file":"hub/src/cli/usage/login.ts","line":2},{"severity":"medium","text":"FIFO onCleanup closes Store before Binder.close and admitted bind joins. Use an owned teardown joining binder/work before storage/root, including forced early-failure coverage.","file":"hub/test/login-exclusive.test.ts","line":20},{"severity":"low","text":"snapshot helper starts asynchronous FakeClock.advance without awaiting; provider snapshot and later advances can race the pinned clock. Await advancement before the effect/disposal.","file":"hub/test/login-exclusive.test.ts","line":31}]
finding_counts: {"high":2,"medium":2,"low":1}

A-18482 contains consolidated Standards(2 medium/1 low) and Spec(2 high) review. Implementer confirms all five gaps; no omitted owner/exception. C1/C4/C5 remain runtime-unverified; no configured Linux receipt exists. Preserve ordinary writer/reader/authority/list assertions and add operation fault/restart ownership controls. Pin review complete: fix, commit/push and request fresh source review before verification. Existing local narrative/catalog/native evidence is qualified candidate support, not exact-head configured pass; full T3/T4/after-stage QA separate.

Criteria: C2 failed (Reader allocation lacks durable ownership/recovery for a committed create with lost response or failed binding publication.), C3 failed (Confirmed reader deletion followed by failed unbind/restart strands the retained binding with no exact deletion reconciliation.).

### impl-1786 · 2026-11-10T21:17:12.937Z

Review-fix contract sweep: durable reader-operation metadata is additive/private to LoginRecords, consumed by LoginBinder and existing release owner through a shared reader deletion helper. Existing public Login/LoginBinding/list wire shapes stay unchanged; selection/snapshot pending checks include unresolved create intents. Original transitive reached/unknown inventory A-18479 remains conservative; persisted-reader restart regressions added in login-exclusive.test.ts. New red: lost create response + reopened SQLite caused a second allocation (2 !== 1).

### rev-36 · 2026-11-10T21:29:10.365Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1786-source-2
commit: cc1e69c613ea526fd274dcdf9d54a300be590fbc
scope: full
findings: [{"severity":"high","text":"Deleting intent + omitted listVolumes id skips exact delete/absence confirmation and persists deleted/unbinds. Intent proves ownership/detach, not deletion; always obtain exact captured-id deleteVolume confirming result, including omission recovery.","file":"hub/src/host/login-reader.ts","line":18},{"severity":"high","text":"Destroyed early return checks settled login_bindings only, so installed retry skips unbound reader obligations despite boundHosts discovery. Include reader operations in real destroy/retry admission and test installed owner→destroyHost through shutdown/reopen.","file":"hub/src/host/provision-host.ts","line":217},{"severity":"medium","text":"Retained-operation cleanup and releaseHostLogins pre-loop recovery can remove the last reader without onReleased, leaving ready login backup.releasing=true forever. Use shared final-reader snapshot-notification handoff with real scheduler regression.","file":"hub/src/host/login-binding.ts","line":41}]
finding_counts: {"high":2,"medium":1,"low":0}

A-18488: source2 not clear, three confirmed Spec findings (2 high,1 medium); Standards0. Source1 help/teardown/clock corrections accepted, and pre-create durable ownership/binding publication fault controls improved. Implementer confirms no omitted exact-absence contract, actual retry owner or snapshot handoff. Preserve controls, repair these consolidated boundaries, commit/push and request fresh source review before verify. Other runtime criteria remain unverified; local/candidate native evidence qualified, no configured same-head pass.

Criteria: C2 failed (Real restart/destroy admission can skip retained unbound reader operations; durable allocation recovery is not complete.), C3 failed (Deletion recovery trusts inventory omission and final-reader recovery can retain the snapshot release fence.).

### impl-1786 · 2026-11-10T21:30:19.801Z

Source-2 rule-20 sweep extension approved by Coordinator dc7cb556: destroyHost callers include explicit host.stop/destroy dispatch, create failure cleanup, health/loss, pool idle lifecycle and startup destroyed-host reconciliation; LoginReleaseOwner is installed by dispatcher and release tests, with restart pages from LoginRecords.boundHosts and clock retry through destroyHost. Native reached files remain host-create-ready, host-destroy-native, host-restart, host-unreachable, host-stop and login-write-back (plus new reader native case). Recovery/admission tests will exercise installed owner -> destroy, not only release helper. No public wire changes; original A-18479 reached/unknown inventory retained. New source-2 red: deleting intent + omitted still-existing clone incorrectly completed without exact provider deletion (missing expected rejection).

### rev-36 · 2026-11-10T21:39:58.072Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1786-source-3
commit: e9ec2f1cfd16b9547399648b13d2cb4ba7867546
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18491: cumulative source clear. Exact-id deleteVolume confirmation required despite list omission; shared obligation policy retains interrupted/already-destroyed reader cleanup through installed owner→destroyHost; final-reader unbind/snapshot onReleased acknowledgment/marker removal commit together, with creating/deleted admission fence. Real scheduler and installed-owner/reopen controls preserve final assertions. Earlier create intent/metadata faults/help/teardown/clock fixes accepted; optional wire remains compatible. C1–C5 runtime-unverified pending same-head configured receipt. After directed preservation slot release, mode-free verify may proceed at e9ec; preserve actual per-file tier/head/output/producer limits and union consumer/case accounting. Full T3/T4/after-stage QA separate.

### rev-36 · 2026-11-10T22:08:46.618Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1786-final-1
commit: e9ec2f1cfd16b9547399648b13d2cb4ba7867546
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; C1–C5 verified. A-18494 records the independent assessment of A-18492 configured run 5d655d64 (5949/5949, zero failures/cancellations/skips), 25 new generated T2 identities each base plus five passing repetitions, and the native writer/reader rotation criterion. A-18493 preserves seven hash-matched original local outputs: 42 passing cases (18 T3 and 24 T2), exact commands/cwd/head and joined exit receipts, with signal/provenance limits retained. Consumer union reconciles 710 files to 464 positive current-head file finishes and 246 T3/T4 deferrals, no missing lower-tier/Web consumer. Source clearance A-18491 remains applicable. Report-only budget/lint advisories retained; full remaining Linux T3, T4 and affected after-stage QA remain separate. No new findings or reviewer test execution.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-11-10T22:46:55.023Z

Merged aca1a4ffb520105269e8212795c997e7f27fc78e onto dev.
