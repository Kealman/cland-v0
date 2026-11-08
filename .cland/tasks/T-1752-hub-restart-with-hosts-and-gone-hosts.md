---
id: T-1752
kind: task
title: Hub restart with hosts, and gone hosts' sessions exited
state: open
status: ready
size: M
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-1534
blocked_by:
  - T-1746
  - T-1748
topic: topic-1444
branch: t/T-1752-hub-restart-with-hosts-and-gone-hosts
created: 2026-11-07T16:01:59.635Z
updated: 2026-11-08T16:30:15.426Z
---

## Summary

At start, the hub restores its hosts:
- re-reads its leases and re-opens the tunnels of registered hosts;
- re-finds session rows;
- re-arms each lease's watchdog when it is gone;
- re-attaches each live host's renewal timer;
- asks each lease's provider for the machine.

A lease whose machine is gone ends its sessions as exited, vacates their roles, releases the lease and settles its spend. A session row whose host the hub no longer knows counts as gone, not alive. Re-found hosts count toward `min_hosts` and `max_hosts`, so no extra host starts.

## What to build

Start-time reconciliation over leases and provider status, with the `unknown host` state becoming exited. It reuses the confirmed-deletion settlement of `cland host destroy`. This ticket reads no shortened-timeout knob: its deadlines are `lease` and the renewal cadence, both real config. A host whose tunnel cannot be re-opened at start is handed to T-1753's outage clock, which honours `CLAND_TEST_HOST_UNREACHABLE_MS` and `CLAND_TEST_HOST_LOST_MS`.

## Acceptance criteria

- [x] C1. A restart with two fake hosts, one deleted while the hub was stopped, keeps the live host's session running and ends the deleted host's session as exited, with its role vacated (test).
  - done: impl-1752 · 2026-11-08T15:07:02.340Z
  - verified: rev-38 [reviewer] · run rev-38-1752-evidence-2 · 2026-11-08T16:30:15.188Z · commit 53f4e43854455f5ccb6a0dd54e76dea19afa9260
- [x] C2. That deleted host's lease is released and its spend settled (test).
  - done: impl-1752 · 2026-11-08T15:07:03.003Z
  - verified: rev-38 [reviewer] · run rev-38-1752-evidence-2 · 2026-11-08T16:30:15.188Z · commit 53f4e43854455f5ccb6a0dd54e76dea19afa9260
- [x] C3. A session row whose host is unknown to the restarted hub reads exited, never running (test).
  - done: impl-1752 · 2026-11-08T15:07:03.646Z
  - verified: rev-38 [reviewer] · run rev-38-1752-evidence-2 · 2026-11-08T16:30:15.188Z · commit 53f4e43854455f5ccb6a0dd54e76dea19afa9260
- [x] C4. After a restart with `min_hosts = 1` and one live host, no further host is created (test).
  - done: impl-1752 · 2026-11-08T15:21:49.617Z
  - verified: rev-38 [reviewer] · run rev-38-1752-evidence-2 · 2026-11-08T16:30:15.188Z · commit 53f4e43854455f5ccb6a0dd54e76dea19afa9260
- [x] C5. At start, a lease whose watchdog is gone is re-armed, and a lease whose watchdog lives is not given a second one (test).
  - done: impl-1752 · 2026-11-08T15:21:50.141Z
  - verified: rev-38 [reviewer] · run rev-38-1752-evidence-2 · 2026-11-08T16:30:15.188Z · commit 53f4e43854455f5ccb6a0dd54e76dea19afa9260
- [x] C6. After a restart, a live host in use is renewed on the min(1 h, lease / 4) cadence (test).
  - done: impl-1752 · 2026-11-08T16:03:54.231Z
  - verified: rev-38 [reviewer] · run rev-38-1752-evidence-2 · 2026-11-08T16:30:15.188Z · commit 53f4e43854455f5ccb6a0dd54e76dea19afa9260

## Blocked by

- T-1746
- T-1748

## Notes

- Hot files: `hub/src/hub/daemon.ts`, `hub/src/host/host-leases.ts`, `hub/src/host/host-watchdog.ts` (re-arm), `hub/src/host/registry.ts`, `hub/src/adapters/sessions.ts` (exited path generalised from `hostDeleted`).
- Tests: new `hub/test/host-restart.test.ts` (T3: two fake hosts, one deleted while the hub is stopped); T2 cases for the unknown-host rule.
- Serves epic C5 and C6.

## Comments

### impl-1752 · 2026-11-08T14:53:56.153Z

Rule-20 sweep before unknown-host outcome change: production consumers are Sessions.resumeAll/resumeHost/list, adapters/index, daemon startup, dispatch session/inbox frames, ProcessTable retained/pending readers. Tests: host-registry, host-destroy, host-survival/native, session-host-routing, session-host, name-reservation, system-processes; provision/lease/watchdog imports: host-create-entry/admission/ready, host-provision-recovery/gate, host-destroy-native, host-watchdog/identity/loop/drain, host-lease, host-records, pool-scale, host-readiness-owner/runtime-owner/ssh-registry/clone-integration, host-agent-closure/restart/reboot-native, remote-discovery-host, host-ssh-contract. Shipped guidance: docs/hub/host-leases.md, implement CHANGES T-1747/T-1748, QA E-1532/1533 and E-1534 stage 1/2. No wire or persisted shape change planned; existing status=exited used, old client frame remains compatible. Registered but temporarily unavailable hosts remain retained. Unknown registration exits display row while retaining native obligations, with no signal or remote cleanup authority.

### impl-1752 · 2026-11-08T15:04:47.033Z

Added ProcessTable.runningRows() as an additive streaming query over indexed, unarchived running rows for the two new startup scans. Existing all()/running() behavior and persisted/wire shape remain unchanged, so their consumers are unaffected. A partial index avoids decoding retained session history on the new path. Unknown-registration regression now asserts exited; registered-without-transport regression asserts running and no native resume/stop. Provider failure test retains ready/registered/lease and unsettled spend.

### rev-38 · 2026-11-08T15:13:14.009Z

verdict: review
result: not clear
by: rev-38 [reviewer]
run: rev-38-1752-source-1
commit: 731bced40dd56efd902f508548c19db778cd375c
scope: full
findings: [{"severity":"medium","text":"Immediate restored-lease expiry can revoke registration before useSessions installs session settlement, so removeHost fails its cut fence and confirmed destruction remains incomplete.","file":"hub/src/hub/daemon.ts","line":687},{"severity":"medium","text":"checkpointWatchdog replaces the published deadline before effective expiry is checked; a dead watchdog plus missing/malformed/earlier-expired mirror can revive an expired lease from a later DB deadline.","file":"hub/src/host/host-restart.ts","line":35},{"severity":"medium","text":"session.list does not prove minimum-host reconciliation/creation completed; the final count can pass while asynchronous createHost work is still pending.","file":"hub/test/host-restart.test.ts","line":68},{"severity":"low","text":"notEqual(optionalEntry?.cost,null) accepts undefined and passes when the exact lease's spend entry is absent; assert entry existence and settled value.","file":"hub/test/host-restart.test.ts","line":57}]
finding_counts: {"high":0,"medium":3,"low":1}

Source not clear at exact 731bced40dd56efd902f508548c19db778cd375c. A-17862 contains separate Standards/Spec findings and owner-order trace. C4/C5 failed; C1/C2/C3/C6 unverified. Three medium and one low findings; no Reviewer tests/suite/browser run. Pre-verdict candidate/native importer evidence remains qualified; no post-source configured verification receipt. Fix and request a fresh source review before verification.

Criteria: C4 failed (Minimum-host test checks count without a completed scheduler/admission receipt; an asynchronous unwanted create can still be in flight.), C5 failed (Dead-watchdog restoration rewrites the mirror before checking effective expiry, potentially reviving a missing/malformed or earlier-expired mirror.).

### impl-1752 · 2026-11-08T15:21:34.079Z

Review-fix contract sweep: new Dispatcher.restoreSessions is used only by daemon startup and the owner-wiring regression. Existing useSessions callers (session-archive, session-credential-io, account-coalescing, session-brief/component, request-guard, task-worktrees, system-processes, session-async-processes, artifact-host, host-flush-native, tracker-native-boundary, lifecycle-serialization, roles-session-refresh, name-reservation, launch-admission) retain attach/start behavior by default. checkpointWatchdog's optional mirror deadline is used only by restart recovery; createHost and existing lease/watchdog tests retain default DB-deadline publication. No frame, stored shape or client consumer changes. Red controls reproduce old-order destroying vs destroyed and all four deadline faults; fixed cases preserve effective expiry/shorter live deadline. Native assertion now requires exact ledger row, zero fake rate settlement and released timestamp; native rerun deferred until fresh source clear per Coordinator.

### rev-38 · 2026-11-08T15:23:25.332Z

verdict: review
result: clear
by: rev-38 [reviewer]
run: rev-38-1752-source-2
commit: 168179565360a2332b590c76bbcd6ae3075ea1bc
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at exact 168179565360a2332b590c76bbcd6ae3075ea1bc; all three medium/one low A-17862 findings resolved. A-17882 records separate Standards/Spec review of attach→restore→scale, captured effective deadline, actual owner-wiring expiry control, completed minimum scheduler receipt with positive control, and exact ledger assertion. C1–C6 remain runtime-unverified (all require tests); no Reviewer suite/browser/tests run. Old native A-17860 remains 731bced40 evidence only. Per Coordinator e3b8d634, final-head native preservation and subsequent mode-free configured verify receipts are still required; after-stage QA remains on dev.

### impl-1752 · 2026-11-08T15:31:34.103Z

Coordinator-approved native receipt carry: source/runtime head 168179565360a2332b590c76bbcd6ae3075ea1bc → fe8358dc6ee23e4e6ad8c6bf43cb5a9cae492abf. `git diff --stat 168179565..fe8358dc6` names only hub/test/durations.json (2 insertions, 2 deletions). Allowance is 31s, C-216, expiry 2026-11-15, both actual macOS samples and explicit unexecuted 1.6x Linux projection; key appears once. Duration-manifest lint and full root typecheck passed. A-17883 contains all 17 native files / 235 tests at 168179565, zero failures/skips, local macOS arm64 Node24.21.0, 372.001s sum per-file walls excluding queue. Carry authorized by Coordinator decision 2f951981-a907-4bbe-bb1d-7c201f3a0379, no native rerun needed for this one-file change. Fresh delta source review requested before verification.

### rev-38 · 2026-11-08T15:32:04.490Z

verdict: review
result: clear
by: rev-38 [reviewer]
run: rev-38-1752-source-3
commit: fe8358dc6ee23e4e6ad8c6bf43cb5a9cae492abf
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source delta clear at fe8358dc6ee23e4e6ad8c6bf43cb5a9cae492abf. Exact diff from full source-clear 168179565 is only durations.json: report-mode 18→31s plus actual macOS samples/explicit unexecuted Linux projection; C-216/expiry unchanged. Coordinator decision 2f951981 authorizes native A-17883 carry from 168179565 across this change; item records both heads. No runtime or test implementation changes. C1–C6 remain runtime-unverified; exact-head mode-free configured verification and final evidence inspection pending. Reviewer ran no tests/browser.

### rev-38 · 2026-11-08T15:53:48.986Z

verdict: review
result: not clear
by: rev-38 [reviewer]
run: rev-38-1752-evidence-1
commit: fe8358dc6ee23e4e6ad8c6bf43cb5a9cae492abf
scope: evidence
findings: [{"severity":"medium","text":"Nine new T2 cases trigger native child_process.spawn via the real spend-lock ps birth probe; report-only tier events are new boundary violations, contradicting process-free claims. Inject the shared lock process table and retain an explicit no-native control.","file":"hub/test/host-restart-reconcile.test.ts","line":25}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear. Same-head uncached run80018663 / A-17896 passed5599/5599,0fail/cancel/skip/todo; independently checked all11 generated reconciliation case names plus unknown-host and native restart finish records. However9 new T2 child_process.spawn tier violations have exact stack host/agent/command.ts:66 → hub/lock.ts:80. Report-only does not waive docs/agents/tests.md tier rules. C6 failed for component isolation, not renewal behavior; C1–C5 remain unverified. A-17897 records full positive evidence/provenance, phase limits and finding. Linux droplet Node24.21, Headless Shell1248/CfT156.0.8078.4; T0/T1/allT2/Web, changedT3+mappedT4 once; remainingT3 deferred, no T3/T4 repeats. Fix, fresh source review, then verification; no Reviewer tests run.

Criteria: C6 failed (Renewal component cases pass behavior assertions but launch native ps through spend locking, violating T2 isolation; corrected process-free proof is required.).

### impl-1752 · 2026-11-08T15:57:18.934Z

Evidence-fix sweep before adding optional injected lock process table: HostLeases create/renew/cancel/release call reserve/renew/cancel/settleHostSpend, whose shared LockRetryTiming already supports processes. Callers are createHost/destroyHost, host restart recovery, and host-lease/watchdog/restart tests. Existing production callers omit the dependency and retain native behavior. New restart components will pass one fake LockProcessTable through initial create, recovered renew and confirmed destroy/release; no Store, record, frame, policy or permission changes. Repro: enforce-mode cold T2 worker exits1 on the native spend-lock probe. Positive no-native lifecycle control blocks native launches and reports actual2 vs expected0 before the fix. Prior A-17877 process-free claim is withdrawn for fe8358dc6; A-17896/A-17897 remain failed evidence despite functional5599/5599.

### impl-1752 · 2026-11-08T16:03:53.913Z

Conditional native carry per Coordinator184291f2: A-17883 runtime head168179565360a2332b590c76bbcd6ae3075ea1bc (duration-carried via fe8358dc6) → new isolation-fix head3b2dccf1acc50b618c6efab6dac235320e8d29fb. Only optional process-table/watchdog dependencies added; omitted spend branch is old {clock:o.clock}, omitted destroy/watchdog argument objects are former code. Production callers omit them; no record/frame/policy change. Full diff and per-file14 importer proof are in the new isolation artifact. Carry is void if source review finds non-optional behavior changes. After clear, rerun host-restart, host-destroy-native, host-watchdog in a short native slot, then new configured verification. Five cold enforce-mode T2 workers passed12/12 each with0 mismatches; no final ready claim.

### rev-38 · 2026-11-08T16:05:05.064Z

verdict: review
result: clear
by: rev-38 [reviewer]
run: rev-38-1752-source-4
commit: 3b2dccf1acc50b618c6efab6dac235320e8d29fb
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at exact3b2dccf1acc50b618c6efab6dac235320e8d29fb; A-17897 isolation finding resolved via optional shared LockProcessTable at all real lease/spend paths and injected watchdog observations at synthetic retirement. Positive no-native lifecycle control retains final durable assertions. Read all7 correction files; production omitted-option branches are former code/argument objects, no nonoptional behavior change. Coordinator184291f2 condition for14 A-17883 importer carries is satisfied; three native files (host-restart,host-destroy-native,host-watchdog) and subsequent new configured verify still required. C1–C6 remain runtime-unverified; oldfe8358dc6 run remains evidence-not-clear. Reviewer ran no tests/browser.

### impl-1752 · 2026-11-08T16:10:10.779Z

Native carry record:14 importer receipts from A-17883/runtime168179565360a2332b590c76bbcd6ae3075ea1bc carry to isolation runtime3b2dccf1acc50b618c6efab6dac235320e8d29fb per Coordinator184291f2 and ReviewerA-17899 default-preserving proof. Required host-restart/host-destroy-native/host-watchdog reran at3b2dccf1a:6 tests passed,0 failures/skips, durable new artifact. Final head53f4e43854455f5ccb6a0dd54e76dea19afa9260 changes only the component positive-control syntax and guide from3b2dccf1a; production/native files byte-identical. Exact two-file diff recorded in artifact; requesting delta review/carry confirmation. Final control cold mutation red2vs0; five fresh enforce workers green12/12, zero mismatches; source lint0 refusals.

### rev-38 · 2026-11-08T16:10:46.986Z

verdict: review
result: clear
by: rev-38 [reviewer]
run: rev-38-1752-source-5
commit: 53f4e43854455f5ccb6a0dd54e76dea19afa9260
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source delta clear at53f4e43854455f5ccb6a0dd54e76dea19afa9260. Exact2-file7+/5- diff changes only native-hook control syntax and its guide; actual lease lifecycle, zero-launch/injected-read and durable settlement assertions remain. A-17900 reports cold omitted-injection mutation red2vs0,then5enforce workers12/12/0tier events. No runtime/native-test/helper bytes change; confirmed14 historical importer carry remains valid and three3b2dccf1 native file receipts may carry to this component-only correction. C1–C6 remain runtime-unverified pending new exact-head configured verification. Reviewer ran no tests/browser.

### rev-38 · 2026-11-08T16:30:15.188Z

verdict: review
result: clear
by: rev-38 [reviewer]
run: rev-38-1752-evidence-2
commit: 53f4e43854455f5ccb6a0dd54e76dea19afa9260
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear. Source rev-38-1752-source-5 matches exact current branch head53f4e43854455f5ccb6a0dd54e76dea19afa9260. task.verify+original A-17904 agree runb1058fba finished/passed uncached,5600/5600,0fail/cancel/skip/todo. Independently parsed all12 reconciliation case finish identities: each1base+5/5load, including no-native control; zero restart-file tier-mismatch events with prior positive/mutation control. Native restart case1pass7.024881624s, unknown-host casepass; C1–C6 verified. A-17905 maps exact names/assertions/provenance and historical carry limits. Linuxx64 droplet Node24.21, Headless Shell1248/CfT156.0.8078.4; T0/T1/allT2/Web complete, changedT3+mappedT4 once, remainingT3 deferred/noT3T4repeats; report-only notices retained. Supplemental native3files/6tests at3b2dccf1 and14importers at168179565 retain reviewed authorized carry, not new-head executions. Full after-stage QA remains separate on dev. No Reviewer tests/browser run.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.
