---
id: T-1787
kind: task
title: Capacity and login storage in `login list` and `host status`
state: closed
status: done
size: S
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1535
blocked_by:
  - T-1784
topic: topic-1472
branch: t/T-1787-capacity-and-login-storage-in-login-list
created: 2026-11-09T12:44:11.318Z
updated: 2026-11-11T04:30:50.856Z
closed: 2026-11-11T04:30:50.856Z
---

## Summary

`cland login list` ends with the capacity per pool and harness, min(`max_hosts`, free logins), and `cland host status` shows each host's logins in use. Each pool's month figure in `cland host status` adds the storage of its logins' volumes and snapshots at the provider's declared storage prices. Storage is shown but never reserved.

## What to build

The capacity uses T-1784's free-login count per pool region and harness; a non-exclusive or key login gives `max_hosts`. The harnesses listed are those of the roles bound to the pool and those with logins. Provider declarations gain `volumePerGiBMonth` and `snapshotPerGiBMonth`: 0 on the fake, and on DigitalOcean $0.10 and $0.06, under the declarations' check date. Accrued storage comes from the volume and snapshot lifetimes on the rows. It never enters a hosts reservation.

## Acceptance criteria

- [x] C1. `cland login list` shows "capacity <pool>/<harness>: <n>" equal to min(`max_hosts`, free logins of that harness in the pool's region) for each pool and harness (test).
  - done: impl-1787 · 2026-11-11T03:21:17.857Z
  - verified: rev-35 [reviewer] · run rev-35-1787-final-1 · 2026-11-11T03:48:43.482Z · commit b0903704b63487d91b2e14f381881c7391d3362e
- [x] C2. `cland host status` lists each host's bound logins by harness and name (test).
  - done: impl-1787 · 2026-11-11T03:06:58.877Z
  - verified: rev-35 [reviewer] · run rev-35-1787-final-1 · 2026-11-11T03:48:43.482Z · commit b0903704b63487d91b2e14f381881c7391d3362e
- [x] C3. Each pool's month figure in `cland host status` adds the accrued storage of its logins' volumes and snapshots at the declared prices, and no hosts reservation includes storage (test).
  - done: impl-1787 · 2026-11-11T03:21:18.065Z
  - verified: rev-35 [reviewer] · run rev-35-1787-final-1 · 2026-11-11T03:48:43.482Z · commit b0903704b63487d91b2e14f381881c7391d3362e
- [x] C4. A provider declaration without the storage prices is refused naming the keys, and the fake declares them as 0 (test).
  - done: impl-1787 · 2026-11-11T03:06:59.420Z
  - verified: rev-35 [reviewer] · run rev-35-1787-final-1 · 2026-11-11T03:48:43.482Z · commit b0903704b63487d91b2e14f381881c7391d3362e

## Blocked by

- T-1784

## Notes

- Hot files: `hub/src/cli/login.ts` (the capacity line), `hub/src/cli/host.ts`, `hub/src/host/provider/declarations.ts`, `hub/src/host/provider/fake.ts` and `hub/src/host/provider/digitalocean.ts` (declarations only). Registration point: `hub/src/hub/dispatch.ts` (`host.status`).
- Tests: `hub/test/host-status.test.ts` (T2, new cases); new `hub/test/login-capacity-list.test.ts` (T2).
- Serves epic C1 and C6. Spec §3.6 puts storage in the month figure; E-1534 left it to this epic (its decision 16). See question 17.

## Comments

### impl-1787 · 2026-11-11T02:59:25.292Z

Rule-20 sweep before mutation: shared suite importingTests graph from logins.ts, status.ts and provider/declarations.ts reaches 707 tests, plus 15 unknowns counted as reached (full list captured for evidence). Explicit fields/frames/functions sweep: CLI login.ts (list/add), host.ts; dispatch login.list/host.status; shared/wire/index.ts frame union; web authority denies both; nvim generic result transport and record-nvim-frames catalog (no explicit status/list fixture); production declaration consumers registry/provider, pool-runtime, provision-host, host-restart. Additive pool.capacity and host.logins keep old fields; login.list array remains unchanged, and new CLI tolerates older host.status without capacity/logins. Tests: login-list, host-status exact deep-equals migrate; declaration fixtures host-provider-declarations, host-provider-fake, pool-idle-stop migrate. QA E-1533, E-1534-stage-1/stage-3 and login snapshot/exclusive/key-spawn docs retain old fields, no changed positional parser. Native reached cases include host-create-ready, host-destroy-native, host-restart, host-unreachable, host-stop and login-write-back: declaration fields do not alter lifecycle or reservations; no lifecycle edits intended. Capacity changes bounded store reads beside existing selection only. Proposed project rule: status cost additions should retain explicit unknown when durable resource lifetime receipts are absent rather than infer dates from sign-in.

### impl-1787 · 2026-11-11T03:08:02.676Z

Rule-20 addendum at reviewed head 2a336f7fc: expanded transitive sweep A-18564 records 708 reached tests plus 15 unknowns counted as reached. Explicit frame/catalog sweep found no login.list/host.status consumers in nvim/ or web/src, nor recorded catalog frames. Coordinator decision d6ffd31b: no recorder run because additive result.value fields do not change request or HubFrame wire type. login-list.test.ts retains previous array shape (including creating key legacy row), CLI login/host tolerate old status without new capacity/logins fields. New declaration fields migrate production fake/DigitalOcean and test fixture declarations; login-capacity/login-selection downgrade fixtures drop the new private capacity index. Native unchanged producers include login-add, login-write-back, host-create-ready and host-destroy-native, to run after source verdict. Core useClock adds one post-Store line without reordering construction.

### rev-35 · 2026-11-11T03:14:03.798Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1787-source-1
commit: 2a336f7fc170d550661648614e16a385ead14a10
scope: full
findings: [{"severity":"medium","text":"harnesses DISTINCT walks all retained login history; storageRows decodes every storage-bearing login, including deleted-only prior-month rows, on each host.status call. No bounded derived/current-month owner or work-budget control. Rule23; lead8b12da4f confirms, Coordinator94615549 approves a private indexed repair not yet present.","file":"hub/src/host/logins.ts","line":66},{"severity":"medium","text":"New storage T2 case supplies only clock to projectHub, omitting both shared fake lock process seams. Default hub-PID shim does not supply both fake facts; declared T2 isolation is unproved. Lead8b12da4f confirms. Inject processes and droplet.processes as in the capacity fixture.","file":"hub/test/host-status.test.ts","line":118},{"severity":"medium","text":"HOST_USAGE advertises capacity although host status text does not render it (JSON only); LOGIN_USAGE omits the new login-list capacity footer. No approved distinction per lead17976ce0. Update matching help and frozen usage consumers under Rules16/20.","file":"hub/src/cli/usage.ts","line":49}]
finding_counts: {"high":0,"medium":3,"low":0}

A-18568 complete source-1 pass at2a336f7fc/treeb41706ee: Standards3medium/Spec0; no additional production/spec finding. Approved additive shapes, UTC overlap/month-only/nonreservation/source lifetime writes assessed, but runtime proof remains candidate only. A-18566 preserves honest producer/excerpt/failed-history limits; A-18567 corrects object tiers for723conservative consumers (78T1/346T2/233T3/14T4/52Web). No configured/Linux/native execution yet. No Neovim recorder required by Coordinator d6ffd31b; native four-file collection follows fresh source clearance. Release hold for all three corrections, then new committed source request before experiments/verify. C2/C4 runtime-unverified. RemainingT3/T4/after-stageQA separate; no Reviewer experiments/provenance reruns.

Criteria: C1 failed (Capacity status adds a full retained harness-index walk and command help omits/misstates the capacity output.), C3 failed (Storage status rereads retained deleted-only history, and the new T2 cost fixture lacks both fake process facts.).

### impl-1787 · 2026-11-11T03:17:18.842Z

Source-1 findings repair: bounded status harness reads now use three existence lookups through plain login_harnesses index; current-month storage uses private storage_pool/storage_through columns and one storage_through-leading range index, per Coordinator 94615549/93ab04df. Private derived writes share the storage record transaction and are absent from public JSON; prior storage-row shape retained. New 300-history-row positive-control budget regression, private-column/sentinel non-exposure controls, and removed-pool storage discovery added. New storage T2 has both fakeLockProcesses seams. LOGIN_USAGE and HOST_USAGE plus frozen consumers corrected. Consumer inventory A-18567 still applies; no new request/HubFrame changes. New store migration adds private columns only, legacy rows without storage remain NULL. No dev merge after first review.

### rev-35 · 2026-11-11T03:20:58.356Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1787-source-2
commit: b0903704b63487d91b2e14f381881c7391d3362e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18571 full corrective source review atb0903704/tree445a5468: Standards0/Spec0. All3prior findings fixed:3indexed harness LIMIT1 reads; private storage projection/savepoint/backfill and through,pool current-month range, with302→2decode positive/work control4SEARCH queries and public-sentinel exclusion; two fake process seams in new T2 storage case; matching help/frozen usage. Coordinator94615549/93ab04df scope respected. A-18569 targeted37/37 andA-18570typecheck remain local candidate support with declared source/exit limits, no exact-head configured claim. A-18567 normalized723consumer union retained. Hold released for four directed native files then mode-free verify at unchangedhead. Allcriteria runtime-unverified; C1/C3old failed marks need lead restore done for resolvedsource issues. No Reviewer experiments; remainingT3/T4/after-stageQA separate.

### rev-35 · 2026-11-11T03:48:43.482Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1787-final-1
commit: b0903704b63487d91b2e14f381881c7391d3362e
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18582 final same-head review. Run3e2e79a6/A-18578 passed exactb0903704; independent5993base test/671file passes plus30separate load tests/files,zero negative. All6new capacity/storage/declaration/work identities base+5/5; bound-login status casebase1. All670manifest lower/Web and476required lower/Web consumer paths have positive case+file receipts,zero missing; A-18579 joins match rawlog.723union=477configured+4exact-head localnative=481qualified;229T3+13T4deferred. NativeA-18572/74–77 fourfiles17/17 code0, originalargv/cwd/wrapper/CLOSE linkageA-18580/81; prefix-onlyinventory[]→[]0→0, no fullcensus or unrecordedsignal claim. Gitroot445a5468/exportd41eb62d independently match. Actual uncached Linuxx64 Node24.21/Nvim0.12.5,HeadlessShell1248 Chrome156.0.8078.4; lifetime/costunknown. T0/T1/allT2/mappedT4/Webcomplete; noLinuxT3/T4repetition. Report-onlyduration/lint/resource notices retained, including existingstatuscasechildspawn event. C1–C4verified, source1failed/candidatehistory retained. RemainingT3batch/broaderT4/affectedafter-stageQA separate; no Reviewer experiments.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-11-11T04:30:50.856Z

Merged 427f522ec88e9ad77d4fa39257a650980c383422 onto dev.
