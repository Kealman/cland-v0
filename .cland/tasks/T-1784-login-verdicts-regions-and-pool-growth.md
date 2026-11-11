---
id: T-1784
kind: task
title: Login verdicts, regions and pool growth
state: closed
status: done
size: M
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-1535
blocked_by:
  - T-1778
  - T-1779
topic: topic-1468
branch: t/T-1784-login-verdicts-regions-and-pool-growth
created: 2026-11-09T12:44:10.743Z
updated: 2026-11-11T00:27:52.139Z
closed: 2026-11-11T00:27:52.139Z
---

## Summary

The scheduler's verdict hook is filled from the logins. For each host and harness it answers `serves` (a healthy binding there), `can-bind` (a free login in the host's region), `signed-out` (the host's binding is signed out) or `no-login`. A pool creates a host only when every harness the launch needs has a free login, so its effective size is min(`max_hosts`, free logins of its scarcest harness), and a launch with none waits as "waiting for a login <harness>". A login belongs to its volume's region, and a pool in another region cannot bind it.

## What to build

A verdict function over the login rows and bindings, wired into `decidePlacement`:
- `serves` hosts come first, then `can-bind` hosts, where the launch binds as in T-1778.
- A login is free when it is `ready`, exclusive and unbound, in the pool's region. Non-exclusive logins and key logins never run out.
- The create decision requires a free login for the launch's harness. Without one, the decision is "waiting for a login <harness>".
- A pool's `min_hosts` hosts boot without logins (question 9).
- A create for `cland login add` is exempt from the rule.

A `creating` login is never free. The note "E-1535 supplies login eligibility" in `scheduler.ts` is retired.

## Acceptance criteria

- [x] C1. The verdict is `serves` for a host holding a healthy binding, `can-bind` with a free login in its region, `signed-out` for a signed-out binding and `no-login` otherwise, and placement skips `signed-out` and `no-login` hosts (test).
  - done: impl-1784 · 2026-11-10T22:53:49.831Z
  - verified: rev-35 [reviewer] · run rev-35-1784-final-1 · 2026-11-10T23:49:30.250Z · commit 3be2cf5a0e219efeb67331e81569fd08c4253106
- [x] C2. With `max_hosts = 2`, one exclusive login in use and none free, a launch with no room decides "waiting for a login <harness>" and creates no host (test).
  - done: impl-1784 · 2026-11-10T23:24:23.993Z
  - verified: rev-35 [reviewer] · run rev-35-1784-final-1 · 2026-11-10T23:49:30.250Z · commit 3be2cf5a0e219efeb67331e81569fd08c4253106
- [x] C3. A login in region `fake-1` is never bound by a host of a pool in `fake-2`, and that pool's launch waits for a login of its own (test).
  - done: impl-1784 · 2026-11-10T21:10:56.978Z
  - verified: rev-35 [reviewer] · run rev-35-1784-final-1 · 2026-11-10T23:49:30.250Z · commit 3be2cf5a0e219efeb67331e81569fd08c4253106
- [x] C4. A non-exclusive login or a key login lets every host of the pool serve its harness (test).
  - done: impl-1784 · 2026-11-10T21:10:57.470Z
  - verified: rev-35 [reviewer] · run rev-35-1784-final-1 · 2026-11-10T23:49:30.250Z · commit 3be2cf5a0e219efeb67331e81569fd08c4253106
- [x] C5. A pool's `min_hosts` hosts are created with no free login, and a create for `cland login add` is not held back by the login rule (test).
  - done: impl-1784 · 2026-11-10T21:10:57.967Z
  - verified: rev-35 [reviewer] · run rev-35-1784-final-1 · 2026-11-10T23:49:30.250Z · commit 3be2cf5a0e219efeb67331e81569fd08c4253106
- [x] C6. A `creating` login is never counted free (test).
  - done: impl-1784 · 2026-11-10T21:10:58.505Z
  - verified: rev-35 [reviewer] · run rev-35-1784-final-1 · 2026-11-10T23:49:30.250Z · commit 3be2cf5a0e219efeb67331e81569fd08c4253106

## Blocked by

- T-1778
- T-1779

## Notes

- Hot files: `hub/src/host/scheduler.ts`, `hub/src/host/pool-runtime.ts`, `hub/src/host/login-verdicts.ts` (new; reads bindings, does not edit `login-binding.ts`).
- Tests: `hub/test/host-scheduler.test.ts` (T1, new cases); new `hub/test/login-capacity.test.ts` (T2).
- Serves epic C4 and C6.

## Comments

### impl-1784 · 2026-11-10T21:02:18.494Z

Rule-20 sweep before capacity admission wiring: suite shared transitive importingTests graph over all 938 manifest files reaches 692 tests (15 unknown counted reached), saved inventory /tmp/T-1784-consumers.json for subsequent durable artifact. Production paths: Sessions PoolRuntime reserve, demand, reconcile, configure and launch/wait/restart/resume routes; dispatch createHost -> onConnecting LoginBinder; LoginRecords readers login-binding/snapshots/add/keys/release and login.list. Explicit symbols searched: PoolRuntime, decidePlacement, defaultHarnessVerdict, HarnessVerdict, selectForLaunch, login bindings/exclusive/key fields. Public wire/records stay identical; optional scheduler callback is additive with legacy fallback. Docs/skill: implement host admission, host-providers placement, logins binding; QA E-1534-stage-1, E-1535-stage-2 exercise placement and bind; startup consumers through Sessions reached. Native T3/T4 host-create-ready, host-destroy-native, host-restart, host-unreachable, host-stop, login-write-back all reached by shared graph and deferred/targeted per release split; unknowns conservatively reached. Existing fixture consumers requiring no login will need explicit metadata migration where reserve success was assumed. No protocol/dispatch/web-authority/help/cli registration edits.

### impl-1784 · 2026-11-10T21:10:12.542Z

Consumer sweep durable inventory: A-18480. Fixture migrations: pool-scale now seeds ready regional metadata before demand and matches prepared/config/provision region; host-provision-records and pool-idle-stop seed metadata for reserve success; pool-failures and pool-spend-cap seed pre-demand metadata via additive metadata-only capacityLogin helper (existing native helper behavior unchanged); waiting-launch/session-pool-placement assert login waits when exclusives exhausted; login-binding and login-provision-bind retain unknown fences and now assert durable waits for subsequent admission. Public list/frame shapes unchanged; no Neovim fixture regeneration needed. Shared/key tests cover capacity only, native bind/key injection stays with neighboring lanes. Current targeted macOS results: scheduler 10/10; capacity 10/10 incl 10,000-row query control; pool-scale+waiting-launch 39/39; pool-failures+pool-spend-cap 26/26; login-provision-bind+waiting-launch-restart 33/33. Earlier diagnostic runs that predated fixture migrations failed/interrupted and are not passes. Node 24.21.0, no browser, no full suite run.

### rev-35 · 2026-11-10T21:17:38.135Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1784-source-1
commit: 3ad3614d4a76450f9688d989a7c2476b039683a8
scope: full
findings: [{"severity":"high","text":"Placement/verdict/create admission discard the effective explicit/role account. A wrong-account serves host can outrank a bindable correct host and cause binder refusal; unrelated free logins can authorize billable growth for an unavailable pin. Carry the effective pin through reserve, selectors, verdict and demand. Lead4ec55ba4 confirms no earlier fence; Coordinatorc9db2daf approves the repair.","file":"hub/src/host/pool-runtime.ts","line":269},{"severity":"high","text":"Indexed SEARCH/LIMIT1 leaves unbounded rejected matching candidates: pending-binding and volumeId predicates are post-filters in shared/ready capacity selection. The10k other-region/signed-out corpus and query/decode counts do not bound same-region pending/null-volume work. Use indexed eligibility/derived ownership and representative work controls. Rule23; lead4ec55ba4 confirms.","file":"hub/src/host/logins.ts","line":92},{"severity":"medium","text":"Sequential cleanup skips leases/db when runtime.close rejects, and line86 skips db.close on lease drain rejection. No earlier attempt-all owner exists. Register owners at acquisition and attempt each ordered drain/close while preserving diagnostics. Rule12; leadbf9e86f2 confirms.","file":"hub/test/login-capacity.test.ts","line":16},{"severity":"medium","text":"Existing no-login and unknown-operation paragraphs still claim launch refusal while new pool admission/tests now retain durable login waits. Replace with explicit pool-wait versus binder-refusal conditions; appending Placement capacity leaves contradictory guidance. Rule16; leada498ed70 confirms no approved exception.","file":"docs/hub/logins.md","line":170},{"severity":"medium","text":"Current exact replay lists at480/691 require both removed refusal-case titles. Migrate current replay/receipt names and expectations, preserving actual historical observations explicitly instead of requiring absent identities. Rule20; lead130dfbca confirms no historical disposition.","file":"qa/briefs/E-1535-stage-2.md","line":480}]
finding_counts: {"high":2,"medium":3,"low":0}

A-18484 complete source pass: Standards4 findings (1high/3medium), Spec1high. C1/C2 failed; C3–C6 runtime-unverified. Coordinatorc9db2daf approves bounded eligibility/account work and final-head native reruns after T-1786 landing/explicit merge instruction. Release hold for all five fixes, then fresh committed source review before verification. Evidence supplement A-18485 arrived after A-18484:708 path union now includes every15 unknown plus new capacity file;12 labelled native/component/red/static transcript excerpts preserve candidate/raw-unavailable limits.20 object-valued tier fields still need flattening via .tier (normalized totalsT1=74,T2=337,T3=231,T4=14,Web=52). No Reviewer tests/native/browser experiments; no provenance-only rerun requested.

Criteria: C1 failed (Account-blind serves preference can select an incompatible bound host and reject despite a valid bindable alternative.), C2 failed (An unrelated free account can authorize host growth for a pinned account with no eligible login.).

### impl-1784 · 2026-11-10T21:19:34.025Z

Review correction sweep (Coordinator c9db2daf/3328edcd): additive account pin crosses Sessions.withLaunchPlacement's one reserve call → PoolRuntime reserve/cause/demand → loginVerdict/selectCapacityLogin, preserving no-pin behavior and LoginBinder defence. Runtime callers include constructor/start/close, direct reserve callers in host-provision-records, pool-idle-stop, pool-spend-cap, host-unreachable and all Sessions placements/handoffs/resumes. Added explicit/role account session regressions; direct pinned-unavailable and incompatible-serving-host tests shown red before account plumbing, now green. Pending bounded-query redesign waits for T-1786 landing as directed. Stage-2 schema-downgrade consumer is hub/test/login-selection.test.ts (T2 despite earlier shorthand 'native'); it must drop capacity triggers/index before removing binding.phase. Current QA exact-name selectors in qa/briefs/E-1535-stage-2.md migrate refusal→wait identities while preserving recorded historical receipt provenance. New fixture teardown owns SQLite immediately and attempts every owner, aggregating failures. A-18485 corrects reachability to707 old conservative tests+new capacity=708; 20 object manifest tiers need .tier flattening in next inventory revision.

### impl-1784 · 2026-11-10T22:53:01.389Z

Post-landing rule-20 sweep: explicit Coordinator merge instruction9a00f369 followed; origin/dev aca1a4ffb merged in80f73b9e0, tiers conflict resolved by retaining capacity + both exclusive files. Bounded migration includes logins.pending_bindings, binding pending and reader creating/deleted predicates shared with hasPendingBinding, 6 triggers and one partial login_capacity_launch index. New heldForLaunch extraction approved7bbdaa44: selectForLaunch retains identical held query/reply/candidate selection; verdict no longer evaluates binder's candidate scans. Consumers newly named: LoginRecords.beginReader/saveReader/refuseReader/bindReader/completeReader; login-reader recoverReaderCreation/deleteReaderVolume; login-release and login-release-owner normal/lost/restart release; login-binding prepare/finish/rollback; login-exclusive T2/native regressions; login-selection stage-one schema downgrade drops6 triggers/index/counter before phase removal. Sessions reserve/account consumers remain included. Shared graph refreshed across all tiers:695 reached +15 distinct unknowns=710 conservative test paths, normalized tier/disposition artifact forthcoming. New tests show old verdict visited2000 pending reader candidates and old selector offered a creating reader; current targeted migration/selection/exclusive group44/44 passed before final control expansion. No Linux/full/native-final receipt claimed.

### rev-35 · 2026-11-10T22:57:49.330Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1784-source-2
commit: 061f53cd8f8f14bf89b7b84a369b6b61807a70a6
scope: full
findings: [{"severity":"high","text":"Demand creation rechecks captured cause.harness/account across creator awaits without comparing current durable-wait role selection. A free old A can authorize a billable create after the role changes to unavailable B; admittedDemand checks identity/authority only and current selection is read later at onConnecting. Revalidate canonical current harness/account at pre-row admission, preserving current-role wait semantics. Leadf0393580 confirms no earlier fence or immutable-pin policy.","file":"hub/src/host/pool-runtime.ts","line":172}]
finding_counts: {"high":1,"medium":0,"low":0}

A-18501 complete source-2 pass: Standards0, Spec1high. All five source-1 correction areas are present; one residual current-selection creation gap remains. Approved T-1786 merge/counter6triggers/backfill/index and unchanged held-query extraction reviewed; cleanup/docs/QA-name repairs retained. Treeeafc6d116774664333d9aeb6cbc6e5a69dddd85d. A-18500 has normalized710 path union and supporting local candidate140/140/reds/static captures with explicit limits; no exact-head native/Linux claim. Release hold for remaining fix; fresh committed source before verify. C1/C3–C6 runtime-unverified. No Reviewer experiments or provenance-only reruns.

Criteria: C2 failed (Held creator preparation can admit against obsolete free account A after the waiting launch changes to unavailable account B.).

### rev-35 · 2026-11-10T23:01:18.807Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1784-source-3
commit: 474e602cd9e0f973be129907b2fdbffa12214a8c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18504 source-3 clear: Standards0/Spec0. Existing durable wait authority now precedes canonical current harness/account comparison at demand creation admission; PoolCreationNotAdmitted fences obsolete role selection before row/effect, preserving explicit pins and ordinary capacity recheck. Both held-preparation regressions join creator and assert zero inventory/gates/spawns. Prior source2 bounded migration/extraction and source1 cleanup/docs/QA migrations retained; no remaining findings. A-18502 local candidate74/74 and red/static limits retained; C1–C6 await exact-head runtime proof. Proceed approved final-head preservation and mode-free verification, actual case/file/consumer reconciliation. Remaining fullT3/T4/after-stageQA separate. No Reviewer experiments.

### impl-1784 · 2026-11-10T23:05:45.482Z

Final reviewed head474e602cd9e0f973be129907b2fdbffa12214a8c: preservation scope8files all passed locally macOS Node24.21.0, fake agents/harness/provider, no browser. A-18506 retains complete producer output, generated cases and normalized710-path accounting: host-create-ready12/12; host-destroy-native3/3; host-restart1/1; host-unreachable20/20(T2); host-stop4/4(T2); login-write-back1/1; login-add1/1; login-exclusive-native1/1 =43cases(6T3files+2T2files). No final Linux/full-T3/T4 claim. Inventory limitations are explicit in artifact: first create literal/tmp hc pre-run baseline omitted, observed midrun then absent after; remaining7files zero new roots with existing TMPDIR cland-proj baseline88unchanged. Preservation owner checked/released before mode-free submission. Verify95035dec-701f-476e-81a7-0f905c9a6be7 admitted(position1), pending outcome to Reviewer and claimant. Outstanding binder candidate-walk work is separate Tech debt M item T-1807; selectForLaunch body remains as approved. Full Linux T3 remains merge-queue/integrated occasion; broader T4 and affected after-stage QA remain stage/epic on dev.

### rev-35 · 2026-11-10T23:24:04.739Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1784-evidence-1
commit: 474e602cd9e0f973be129907b2fdbffa12214a8c
scope: evidence
findings: [{"severity":"medium","text":"A-18510 fails the enforced new-test duration budget: capacity index work control5.155s>5s, no allowance at this head. Assertions pass but configured T2 exits1. Full sample set worst is6.010405357s in load (not base5.155), so any authorized allowance must use all samples and documented checker/owner/date policy. Lead confirms task-local failure; no shared-defect classification.","file":"hub/test/login-capacity.test.ts","line":165}]
finding_counts: {"high":0,"medium":1,"low":0}

A-18512 evidence not clear at same reviewed head.5274 base/125 separate load test passes, no assertion failures;213T1+360hubT2 file finishes,43NeovimT2 plus configuredT3/T4/Web unexecuted. Native local subset8files43cases remains separate (19T3+24T2), with stated inventory limits. All six timing samples retained; max6.010405357s requires corrected headroom consideration. Source3 behavior assessment unchanged; C1/C3–C6 unverified. Release hold for authorized allowance correction, production-checker replay of existing pass receipts and fresh source review before verification. No unchanged-head full retry or provenance-only runtime run. No Reviewer experiment.

Criteria: C2 failed (Required verification exits1 on the new capacity work-control's enforced five-second duration budget; later phases remain unexecuted.).

### rev-35 · 2026-11-10T23:25:34.748Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1784-source-4
commit: 3be2cf5a0e219efeb67331e81569fd08c4253106
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18514 allowance-only delta clear. One exact-key10s entry matches Coordinatorbd8c4fb1, ownerC-216 open category, valid2026-11-10→15 span, all6samples/worst6.010405357 and1.5x headroom preserved. Retained samples exactly match A-18510; production replay before[1,0,1,1,1,1]/afterall0 and manifest lint0 retained A-18513. No code/tests/baseline/mode changes. Prior source3 behavior and source2 migration/extraction stand. A-18506 native carry explicitly authorized, not new-head execution; prior failed95035dec stays failed. C1–C6 await exact-head mode-free result and actual consumer/case reconciliation. No Reviewer experiments; fullT3/T4/after-stageQA separate.

### rev-35 · 2026-11-10T23:49:30.250Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1784-final-1
commit: 3be2cf5a0e219efeb67331e81569fd08c4253106
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18521 final evidence clear; C1–C6 verified. Independently scanned same-head A-18520/1eec0c4b:5973 base test/670 file passes,125 separate load passes across25identities×5; all668 manifest lower/Web paths have case+file receipts, zero negatives/missing. Export e1b05182 independently matches full tree28525fa5. Allowance-bound control base5.383/loadmax5.327<10s; prior95035dec remains failed.710consumer union accounted:466configured+5additional carriedT3=471qualified;226T3+13T4 deferred. A-18506 prior474 preservation8files43cases (19T3+24T2) carried only under Coordinatorbd8c4fb1, with first literal/tmp hc missing-baseline and other inventory limits. Actual Linuxx64 Node24.21/Nvim0.12.5/Headless1248 Chrome156 uncached provenance retained; advisory findings remain report-only. Source4 unchanged/clean; no Reviewer experiments. Full remaining LinuxT3 merge batch/T4/stage and affected after-stage QA separate; T-1807 unchanged-binder follow-up retained.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### impl-1784 · 2026-11-10T23:50:30.172Z

Ready at reviewed3be2cf5a0e219efeb67331e81569fd08c4253106, hub confirms statusready andC1-C6verified. Same-head mode-free1eec0c4b/A-18520: T0,T1,T2,selectedT3(login-exclusive-native),mappedT4(inbox-verifier-load),Web all exit0;5973base case passes+125separate load passes(25identities×5),670positive base file-close receipts,zeroskip/fail/cancel/todo. Linux x64 6.8.0-147-generic, dropletc-8lon1/workers2,Node24.21.0,Neovim0.12.5,isolated ChromeHeadlessShell1248 / Chrome forTesting156.0.8078.4; executor lifetime1180s,cost$0.0820(not suite test-wall). A-18523 reconciles710consumer paths:466actual Linux task file receipts,231T3+13T4paths not executed on Linux and explicitly deferred;5ofthoseT3have authorized macOS native carry. A-18506 native43/43 from474e602cd carries across durations-only delta under8a8dd9a2/bd8c4fb1; inventorylimits retained. A-18523 corrects A-18522's672finish-path counter to670file passes:2site helper paths carry case attribution only. Full remainingLinuxT3,broaderT4 and affectedafter-stageQA stay separate, asA-18521 says.95035dec remains failed;single10sallowance expires2026-11-15 underC-216;report-mode tier/skip census unchanged. Binder follow-up T-1807 preserved. Claim held until merge; no more task-head runs requested.

### coord · 2026-11-11T00:27:52.139Z

Merged e14c3bf6d2ece55e17a497112bf7e9bc8d3aaba7 onto dev.
