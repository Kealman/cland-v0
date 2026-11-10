---
id: T-1803
kind: task
title: "Snapshot scheduler: bounded scheduling on login changes and no snapshot of a pending binding"
state: closed
status: done
size: M
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1535
blocked_by:
  - T-1778
regression_of: T-1781
found_by: review
topic: topic-1466
branch: t/T-1803-snapshot-scheduler-bounded-scheduling-on
created: 2026-11-10T10:12:35.258Z
updated: 2026-11-10T15:00:53.187Z
closed: 2026-11-10T15:00:53.187Z
---

## Summary

Two gaps in T-1781's snapshot scheduler, closed together once T-1778's binding phase is on dev. `LoginSnapshots.schedule()` calls `logins.list()` on every `LoginRecords.onChange`, so each login save (including T-1778's pending and settled binding writes on the launch path) decodes all retained logins: an unbounded hot path under rule 23. And the scheduler doesn't yet refuse to snapshot a login whose binding is `pending` (T-1778's fence), which T-1781 deferred until T-1778 landed.

## Context

- **Source path.** `logins.save` → listener → `schedule` → `logins.list` (login-snapshots.ts, about lines 176–192). Found by impl-1778 in the T-1778 integration review, 2026-11-10; no runtime failure claimed.
- **Coordinator decision.** The pending refusal moved out of T-1781 to this item (answer dc7b29a3).

## Acceptance criteria

- [x] C1. A login change schedules work for that login only. With a synthetic corpus of 10,000 retained logins, one save decodes at most a bounded number of rows, shown by decode-count and query-work controls (test).
  - done: impl-1803 · 2026-11-10T13:56:55.468Z
  - verified: rev-35 [reviewer] · run rev-35-1803-final-1 · 2026-11-10T14:22:53.310Z · commit 73df80b3f3c4afbcd9501d0b1421bf0a0cbbbe90
- [x] C2. A login whose binding phase is `pending` is never frozen or snapshotted. The scheduler records a deferred reason, and an absent phase reads as settled (test).
  - done: impl-1803 · 2026-11-10T13:46:30.329Z
  - verified: rev-35 [reviewer] · run rev-35-1803-final-1 · 2026-11-10T14:22:53.310Z · commit 73df80b3f3c4afbcd9501d0b1421bf0a0cbbbe90
- [x] C3. Existing snapshot, rate-retry, release-fence and recovery tests pass unchanged (test).
  - done: impl-1803 · 2026-11-10T13:46:30.565Z
  - verified: rev-35 [reviewer] · run rev-35-1803-final-1 · 2026-11-10T14:22:53.310Z · commit 73df80b3f3c4afbcd9501d0b1421bf0a0cbbbe90

## Comments

### impl-1803 · 2026-11-10T13:46:29.741Z

Rule-20 sweep posted in topic-1466: only LoginSnapshots subscribes to LoginRecords.onChange; Dispatcher and login-signin consume snapshot owners, release owner uses beginRelease/onReleased. LoginRecords readers: HostRecords, binder, keys, dispatcher; transitive test fixtures and T1-T4 searched by class, field, function and notification names. Additive changed-name argument retains zero-argument callbacks; regression covers prior listener shape. No wire/schema shape changes. Synthetic 10,000 rows: red 20001 decodes/save, green 3 decodes and 5 queries, indexed SEARCH only. Existing freeze/thaw, release and recovery tests unchanged.

### rev-35 · 2026-11-10T13:53:51.213Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1803-source-1
commit: a8f2638286d8c95ff391c6933cbbca9bb50b6e46
scope: full
findings: [{"severity":"medium","text":"deferPending uses bindings(name).some, materializing all bindings on every login save. Non-exclusive readers have no cardinality bound (lead7c6f2172 confirms), so an indexed SEARCH still leaves unbounded synchronous per-save work. C1's 10k-login test counts JSON decodes/query calls/plans but no returned binding-row work; it cannot detect this. Replace with bounded indexed pending-existence detection and add many-binding true/false work controls, preserving lifecycle behavior.","file":"hub/src/host/login-snapshots.ts","line":153}]
finding_counts: {"high":0,"medium":1,"low":0}

A-18392 complete source pass: Standards1medium/SpecC1partial for same boundary; no independent C2/C3 source defect established. Changed-name timers/legacy listener shape/pending deferral/future deadline are present, existing23tests and lifecycle source unchanged; runtimeC2/C3unverified. A-18390 narrative only, not raw/exact-head receipt; leadb495bd4e will preserve available original transcript excerpts/provenance limits and tier-normalized consumer disposition, no provenance-only rerun. No reviewer tests/native/API runs. Fix then fresh committed source review before modefreeverify; fullremainingtiers/after-stageQA separate. Holdreleased.

Criteria: C1 failed (Per-save pending detection still materializes an unbounded non-exclusive binding list; existing decode/query guard misses returned-row work.).

### rev-35 · 2026-11-10T14:00:57.923Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1803-source-2
commit: 73df80b3f3c4afbcd9501d0b1421bf0a0cbbbe90
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18398: Standards0/Spec0 unresolvedsourcefindings. Source1 fixed with indexed(login,phase)pendingexistence/get/LIMIT1; many-reader positive row-work controls3/7/3 and10klogin3decodes/5queries supplement eachother. Selection schema-downgrade fixture correctly dropsphaseindex; originalredretained. Pending/manual/scheduled deferral,legacyphase/futuredeadline/name notifications present;23existingcases/lifecycle source unchanged. A-18395honestoriginaltranscriptexcerpts/provenancelimits,A-18396revisionnativeexits+54correctedlocalpasses,not exact-headconfiguredproof. A-18397normalized703paths=73T1/334T2/230T3/14T4/52Web,preservesallpaths/unknowns,Webselectionpending/not locallyexecuted. C1–C3runtimeunverified pendingexactmodefreeverify+actualcase/file/consumerreconciliation. No reviewer runs;nofulltask/native request. Holdreleased.

### rev-35 · 2026-11-10T14:22:53.310Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1803-final-1
commit: 73df80b3f3c4afbcd9501d0b1421bf0a0cbbbe90
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18406: C1–C3verified,Standards0/Spec0unresolved. ExactA-18404 fdf14fed exit0,5875basepass/0negative;664case+filepositive/allmanifest213T1+399T2+52Webzero missing. Five new taskcontrolsbase+5/5=25load;150total separate loadpasses includes125siteguards,not addedtobase. Exacthead/export8e24d241independentlymatchesGit;fulltree6a829624distinct. C1measured3decodes/5indexedqueries+3/7/3bindingrows,C2pending/futuredeadline/legacycontrolspositive,C3all23unchangedcasesplus27current snapshotnames/secondsindependentlymatch. A-18405preserves703inventorypaths,459lower/Webpositive,230T3/14T4unexecuted/deferred. ActualuncachedLinuxx64Node24.21/Nvim0.12.5/Headless1248Chrome156,c8lon1,1041s/$0.0723. Timing/lint/skipadvisoriesreportonly;oldcandidate/transcript/failedmigrationlimitsretained. FullremainingT3/T4/affectedafter-stageQAseparate.No reviewer runs.Holdreleased.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-11-10T15:00:53.187Z

Merged 63954d9c8ffbeab2e6b6d553e0476265aae22132 onto dev.
