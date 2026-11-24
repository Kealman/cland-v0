---
id: T-1971
kind: task
title: Git-maintenance ownership probes time out after 200 ms under hub load and keep territory ownership for a collector that is already gone
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2076
blocked_by: []
topic: topic-1727
branch: t/T-1971-git-maintenance-ownership-probes-time
created: 2026-11-18T12:31:16.257Z
updated: 2026-11-24T09:49:37.419Z
---

## Summary

Found by the hub operator session after restart #84 (2026-11-18). On hub pid 20702, at about 100% CPU, `git-maintenance-failed` at 12:25:19Z reported "process inspection unavailable" for collector pid 27316, and the hub kept territory ownership ("Git collector pid 27316 retains territory ownership; recovery could not confirm its group is gone"). The `ps` and `pgrep` probes in git-maintenance-owner.ts (around lines 58–60 and 88–90) run with a 200 ms timeout. Under load the probe timed out, while afterwards both took 10 ms and `pgrep -g 27316` returned nothing. A timed-out inspection is unknown, not alive, but the result kept territory mutations blocked until the next hub start cleared it.

## What to build

Ownership inspection gets a load-tolerant bound and retries with backoff before it settles. Its outcome comes from the structured probe receipt (rule 39): a timed-out probe stays "unknown" and is retried, rather than settling as a held group. A later successful probe that shows no group releases ownership without a hub restart.

## Acceptance criteria

- [x] C1. With a fake probe that times out twice and then reports no group, recovery releases territory ownership on the retry without a restart, and the intermediate state reads as unknown, never as alive (test).
  - done: impl-1971 · 2026-11-24T09:44:35.453Z
- [x] C2. A probe that keeps timing out reports a structured "inspection unavailable" diagnostic with its attempt count, and every caller of the ownership probes is listed (rule 41) (test).
  - done: impl-1971 · 2026-11-24T09:44:36.142Z

## Comments

### impl-1971 · 2026-11-24T09:05:12.135Z

Consumer inventory: recoverMaintenanceOwner is called by territory.ts async gate, ownedMaintenanceRunner.finish, git-maintenance-cli.test.ts, git-maintenance.test.ts, git-maintenance-startup.test.ts, git-maintenance-recovery.test.ts, system-processes.test.ts. recoverMaintenanceOwnerSync: territory.ts sync gate and system-processes.test.ts. inspect: recovery and ownedMaintenanceRunner.terminate. MaintenanceRecoveryRequired: git-maintenance.ts handoff, daemon.ts startup/report and recovery/maintenance tests. readMaintenanceOwner: doctor/git.ts, daemon.ts, git-maintenance.ts and tests above; executable-path.test.ts imports the runner. Documentation: docs/agents/git-maintenance.md, docs/hub/cland-init-and-cland-update.md and per-file recovery guide. Searches included owner filename, function/type names, probe diagnostics, and receipt path across hub/nvim/web/docs/skills. Existing owner, reporter and wire shapes remain unchanged; structured inspection error property is additive. Red proof on base 5c9533cc9 plus new C1 test: 15 passed / 1 failed, error: Git collector pid 424242 has unresolved ownership; territory mutations preserved until recovery confirms its group is gone; native outcome: process inspection unavailable. Local macOS Node 24.21.0, fake inspection and fake backoff, no browser or executor.

### impl-1971 · 2026-11-24T09:48:47.943Z

Validation at pushed head bea7e7296fb8f29f3868992660209e9dc68ba9c7: root typecheck exit 0, full test:lint exit 0 (0 refusals; report-only advisories retained), serial reachable T1 selection 65 files / 893 passed / zero failed or skipped. Local macOS Node 24.21.0, no browser or native collector. Evidence A-22797; prior red A-22780. Correction: initial red HEAD was 8d3968920, not the triage snapshot cited earlier. Configured verification and T2/T3/T4 remain unexecuted this occasion.

### rev-41 · 2026-11-24T09:49:37.419Z

verdict: review
result: clear
by: rev-41 [reviewer]
run: rev-41-20261124-1971-source1
commit: bea7e7296fb8f29f3868992660209e9dc68ba9c7
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source review clear atbea7e7296fb8f29f3868992660209e9dc68ba9c7 against its fetched-dev second parent (bea7e729^2); first-parent merge delta is tracker state only and not the implementation diff. Standards0/Spec0 findings. Reviewed one production module, policy tests, all three recovery guides and item consumer inventory. No Reviewer edits/tests/native/browser work.

Async/sync recovery share inspectionBackoff: initial inspection,50ms/100ms delayed retries only on unknown, stop on gone/mismatch/alive. Probe bounds increase200ms→1000ms; neither unknown nor exhaustion authorizes kill or owner removal. Later confirmed gone clears durable owner and only matching dead same-host gc.pid. Confirmed alive keeps existing independently observed signal policy, with separate750ms post-initial observation window; its retries/probe completion may extend elapsed time and docs state this. Exhaustion adds structured inspection{state:unknown,reason:inspection unavailable,attempts} to MaintenanceRecoveryRequired while keeping owner/report/message behavior. Existing owner tokens/birth/group validation retained. Sync seam is additive; wait(ms) call sites and listed consumers checked. No wire/config/help/role permission change.

Four new fake policy cases cover unknown/unknown/gone async+sync, retained intermediate owner/no signals, final matching file removal, and permanent-unknown exhaustion3rounds/50+100ms fake backoff/PID reporting/structured error/preserved owner. No native probe/collector launch or wall-clock timer proof claimed; every fixture filesystem operation awaited. Existing recovery safety regressions retained. A-22780/A-22797 report actual prior red unresolved ownership/process inspection unavailable, corrected initial red head8d3968920; final root typecheck/full lint exit0 and65reachableT1files/893pass,0fail/skip/cancel on localmacOS Node24.21. These are selected/static receipts, not configured/native-under-load proof. Consumer inventory includes territory async/sync gates, owned runner finish/terminate, daemon/doctor/readers and all-tier tests. C1/C2 execution verification remains pending exact-head configured receipt; no partial source marks added.
