---
id: T-1897
kind: task
title: c-4 control run and per-second load metrics
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - retro-improvement
assignee: null
parent: E-1888
blocked_by: []
topic: topic-1681
branch: t/T-1897-c-4-control-run-and-per-second-load
created: 2026-11-16T07:29:46.333Z
updated: 2026-11-21T01:00:50.220Z
closed: 2026-11-21T01:00:50.220Z
---

## Summary

The human decided on 2026-10-17 to size the droplet after the test optimisation. `executor/droplet/health.ts` already samples iowait and steal; per-second cadence is unverified. §7 #11.

Kind: config + measurement. Triage ticket H-9 of A-19813, part of E-1888 (the v0.4.0 retrospective improvements the human approved on 2026-11-16).

## Decision change

implements the human's 2026-10-17 decision. The human approved this change on 2026-11-16 at 07:25Z (ask 8e3dd5ab, triage A-19813).

## Acceptance criteria

- [x] C1. Droplet run logs carry load, CPU and iowait at about 1 s resolution (test).
  - done: impl-1897 · 2026-11-20T21:43:43.988Z
  - verified: rev-40 [reviewer] · run rev-40-20261121-1897-final · 2026-11-20T23:35:50.692Z · commit 6fa48265056f00c04b20c4956d5281d074924a64

## Dependencies

after A1 stage 1

## Comments

### impl-1897 · 2026-11-20T17:40:24.260Z

C1 consumer inventory: production run.ts upload list and run.sh completion; health.ts CPU exports retained via re-export, suites.ts aggregate parser and dispatch.ts summary unchanged; suite-log.ts retains additive metric lines. Tests: executor-health-math, executor-health, executor-run, executor-prepare-component, executor-run-rules, suite-accounting, suite-phase, suite-summary, suite-log-backfill, suite-cover, suite-command, verification-workers, dev-t3-search, web-phase, executor-prepare, executor-droplet-component, executor-lease-index, suite-bundle-native, system-processes. Search included docs, QA briefs, skills, web, nvim and shared; no previous machine-metrics consumers. Version-1 health receipt and existing older-shape test remain unchanged. Red/green: fake cadence test failed missing metrics module then 3/3 green; fake transport failed missing sampler upload then green. macOS arm64 Node v24.21.0, targeted only; Linux and full suite not run. C2 pending paired measurement and launcher deployment sequencing.

### coord · 2026-11-20T17:40:47.961Z

C2 (paired c-4/c-8 cover comparison) moved to T-2036 on 2026-11-20. The hub uploads the runner from its own tree (rule 19), so the comparison can only use C1's sampler after T-1897 lands and the hub restarts. T-1897 keeps C1.

### rev-35 · 2026-11-20T17:53:37.426Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1897-source-1
commit: 39efe5628f583f0fb8a0dd5e92c4cc76a6830e3b
scope: full
findings: [{"severity":"medium","text":"M1: unbounded TERM/wait on the advisory sampler can fence exit/done indefinitely when its JS handler cannot run during synchronous I/O. No local bounded close/escalation/incomplete owner exists; add a bounded owned stop/reap boundary and stuck-writer control.","file":"hub/src/executor/droplet/run.sh","line":25},{"severity":"medium","text":"M2: independent sampler/package appends lack complete-line framing. Partial/no-newline package output can prefix a metric record, which suite-log.ts:58 then drops during reduction. Add a framed channel/serialization boundary and controlled interleaving proof preserving package and metric output.","file":"hub/src/executor/droplet/run.sh","line":46},{"severity":"medium","text":"M3: changed transport caller has no pre-acquisition whole-setup/body owner, separate setup bound, positive native guard or positive-close restoration fence; acquisition precedes try and rejecting release finally can replace the primary error. Migrate the caller to a guarded owned scope while retaining existing delivery/fallback/refusal assertions.","file":"hub/test/executor-prepare-component.test.ts","line":831},{"severity":"low","text":"L1: wait-order assertion accepts a missing wait (indexOf=-1). Assert both anchors exist before comparing order and retain a positive missing-wait control.","file":"hub/test/executor-prepare-component.test.ts","line":879}]
finding_counts: {"high":0,"medium":3,"low":1}

Consolidated source review A-22199: Standards M1/M3/L1; Spec M2. Implementer6ea345d0 confirms no omitted control or exception. Pure math/schedule/queued-stop path, helper re-export/aggregate shape, upload list and semantic intent inspected; no other consumer/default/permission/wire change. A-22193 selected local synopsis is not configured/deployed Linux proof. Approved fake-clock/proc/log and transport seams remain the test scope; no native run requested here. C1 failed; C2 already moved to T-2036 under Coordinator571fb0b2. Correct all findings together, fresh source review before configured verify. Reviewer ran no project checks or experiments; hold released.

Criteria: C1 failed (Sampler completion/framing and changed transport test ownership remain unproved/incorrect (M1–M3); correct with bounded owned shutdown, framed records and guarded caller controls.).

### rev-40 · 2026-11-20T18:08:26.455Z

verdict: review
result: not clear
by: rev-40 [reviewer]
run: rev-40-20261120-1897-source2
commit: c662394ba7f6a644b55559e3e51ba9b6409963b0
scope: full
findings: [{"severity":"medium","text":"M1-R: timeout monitors Node, which exits on default TERM before a TERM-resistant bash/package child closes; timeout can return on that monitored PID before kill-after escalation, then run.sh publishes done without child closure. Retain bounded owned stop/escalation/close or explicit incomplete fencing, and cover supervisor termination rather than only injected successful native-close.","file":"hub/src/executor/droplet/health.ts","line":82}]
finding_counts: {"high":0,"medium":1,"low":0}

Source2 not clear: one medium Standards finding M1-R, no additional Spec findings. Prior M2/M3/L1 resolved by separate framed append, guarded delivery ownership and positive missing-anchor control. Foreground sampler removes old independent wait but Node default TERM bypasses child-close/finally; shared process group does not ensure remaining children are closed when timeout's monitored Node exits. Implementer decision28fac1eb confirms no other owner/control; machine watchdog is eventual cleanup, not completion proof. Primary Node24 signal docs and GNU timeout source support this source inference (artifact records links). No native probe/tests run by Reviewer. A-22202 is partial local macOS selected evidence; no configured/deployed Linux proof. C1 failed; fresh reviewed correction required before verify.

Criteria: C1 failed (Supervisor TERM can publish terminal completion before resistant package children close; bounded owned shutdown and regression remain missing (M1-R).).

### impl-1897 · 2026-11-20T18:15:05.579Z

M1-R consumer search before additive packageClosure handoff: executor/executor.ts RunStatus, executor/droplet/run.ts native producer/status reader/start/cancel, droplet.ts proxy/release, hub/suites.ts persisted SuiteJob and recovery/collection/shards/accounting/report, executor/local.ts (optional field absent unchanged), hub/suite-isolation.ts (no new signal authority, old completed rows unchanged), hub/test/fakes/digitalocean/scripted-machine.ts and suite-unit-fixture.ts, executor-droplet-component.test.ts VM/raw status readers and old shape regression, suite-accounting.test.ts and suite-run-rules/phase/cover/summary fixtures; suites-worker, suite-batch, suite-recovery consumers selected by RunStatus/accountingPending search. Search includes src/test all tiers, shared, web, nvim, QA and skills; no UI/native positional reader or frozen CLI-usage consumer of new optional field. Old runner status retains exact old shape; new receipt must fence final result until lease release is positively confirmed, across restart and expired accounting window. Producer native exit retained separately from incomplete failure classification.

### impl-1897 · 2026-11-20T18:23:58.874Z

Exact M1-R consumer disposition: migrated executor/executor.ts (one optional packageClosure field), executor/droplet/run.ts (bounded native handoff reader and old-runner fallback), hub/suites.ts (persisted job/result/recovery and confirmed-release gate), health.ts/run.sh (producer fence), suite-log.ts (retained structured closure line). Existing droplet.ts release supplies positive lease.state released only after deletion; unchanged. Unaffected consumers: executor/local.ts (field absent); hub/suite-isolation.ts and suite-retention.ts (new handoff cannot become reported/cleaned before release); fakes/digitalocean/scripted-machine.ts and suite-unit-fixture.ts (old absent-field replies, explicit new fake receipt in test); suite-component-fixture.ts, task-card-component.test.ts, measure-memory.test.ts, suite-human-component.test.ts, suite-protocol.test.ts, verify-submission.test.ts, merge-queue.test.ts and qa/briefs/E-1533.md (existing normal/legacy outcomes and accounting window unchanged). Guarded new VM cases in executor-droplet-component.test.ts retain prior exact shape, native137/124/0/unknown and bounded9-byte reads; suite-accounting.test.ts proves the new producer receipt persists beyond accounting expiry/restart and forbids final publication before deletion. No timing fields or T-2035 capability added.

### impl-1897 · 2026-11-20T18:27:21.098Z

M1-R projection consumer extension: Suites latest()/verifyResult -> dispatch onJob -> tracker.verifyChanged -> task cards also needed the same release predicate as final reporting. Added a positively controlled terminal-card assertion: absent/deferred until deletion, then failed at the same branch after deletion; it was red on `failed !== null` before applying the shared packageClosurePending predicate. The report and projection now share this single predicate, not parallel parsers or extra fields. The preexisting structured field remains optional and default absent on all legacy/local paths.

### rev-40 · 2026-11-20T18:38:00.834Z

verdict: review
result: not clear
by: rev-40 [reviewer]
run: rev-40-20261120-1897-source3
commit: be126c78a9821017a428dc5d0083cf646fe2d7eb
scope: full
findings: [{"severity":"medium","text":"M5: incomplete branch returns before the only metrics.log append, while DropletRun.log collects only suite.log. TERM/timeout/supervisor KILL lose already-sampled telemetry when confirmed deletion destroys the machine. Retain bounded framed samples through the actual interrupted collection path before deletion, with missing/partial-series controls and unchanged outcome/closure fencing.","file":"hub/src/executor/droplet/run.sh","line":29}]
finding_counts: {"high":0,"medium":1,"low":0}

Source3 not clear: Standards0 remaining findings; Spec1medium M5. Prior M1-R closure/publication defect addressed by pre-launch fence, armed interruption observation, bounded uncertain handoff and shared confirmed-release report/card gate across expiry/restart. Prior M2/M3/L1 remain resolved. New incomplete path skips the sole metrics append, so interrupted telemetry is destroyed at machine release; implementer decision1beffcf0 confirms no alternative collector. Preserve available bounded framed metric series before deletion even if supervisor/shell cannot finish, with explicit unavailable/incomplete evidence and original native outcome preserved. A-22222 is partial local macOS selected proof, not configured/native/Linux receipt. Reviewer ran no tests/probes/browser. C1 failed; fresh corrected-head source review before verify.

Criteria: C1 failed (Already sampled per-second metrics are not retained for interrupted runs before machine deletion (M5).).

### impl-1897 · 2026-11-20T18:45:30.981Z

C1/M5 disposition per Coordinator decision096ec159-6ee8-45d3-ae94-97aa86b6bb71: cadence applies to normal completed droplet runs. Interrupted TERM/KILL/no-shell-finish series loss is accepted with final-log disclosure `machine metrics unavailable: run interrupted before collection`, cause and known/unknown foreground native exit. Pre-deletion collection is a separate C-326 follow-up to be filed by the Coordinator. Source4 implements only that disclosure from the existing durable handoff, retained through semantic reduction and regenerated once on finalization retry; no collector, sidecar or new RunStatus field. M1-R closure fence remains unchanged.

### rev-40 · 2026-11-20T18:54:16.881Z

verdict: review
result: not clear
by: rev-40 [reviewer]
run: rev-40-20261120-1897-source4
commit: 923cf5138414092d06b2b18cf1f01253ea87e370
scope: full
findings: [{"severity":"medium","text":"M6: parent finalization strips copied shard interrupted-metrics disclosures as generated footers; aggregateSuiteLogs preserves their prefix but parent has no packageClosure to regenerate them. Required loss/cause marker disappears from final sharded artifact. Preserve child disclosures through aggregate+parent retry and add that actual-path regression.","file":"hub/src/suite-provenance.ts","line":12}]
finding_counts: {"high":0,"medium":1,"low":0}

Source4 not clear: Standards0 remaining; Spec1medium M6. Independently confirmed Coordinator096ec159: normal completed-run cadence is C1; interrupted series loss accepted with final-log marker/cause; M5 dispositioned to separate C-326 collector, no collector demanded here. Single-run disclosure/retry and native137/0/unknown are correct; closure fence unchanged. But generatedFooter removes copied child marker lines during parent finalization, and parent has no packageClosure to re-emit them. Implementer33a43711 confirms this aggregation path. Retain child disclosure/cause through aggregateSuiteLogs+parent appendSuiteProvenance, including retry/no-invented-sample controls. C1 failed solely for M6. A-22234 selected local macOS proof is partial, no configured/Linux/native run; Reviewer ran no tests/probes/browser.

Criteria: C1 failed (Required interrupted-metrics disclosure is removed from the final parent log of a sharded run (M6).).

### rev-40 · 2026-11-20T19:05:30.722Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261120-1897-source5
commit: e8b22da3dd32931c363601d8a0088bd4fcf4a534
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source5 clear: Standards no findings; Spec no findings within Coordinator dc44cfdb's agreed final-round bar. M6 resolved: parent without its own packageClosure retains copied interrupted-child loss/cause disclosures; its own provenance/accounting replacement remains. Actual filesystem child-finalize/aggregate/rename/parent-finalize regression checks attributed native137/unknown causes, one marker per child and one parent footer through repeated aggregation/finalization. Prior closure/report/card fence and normal cadence/framing remain unchanged and source-clear; no new field/collector added. Coordinator096ec159's accepted interrupted-series loss remains explicit, collection follow-up outside this item. C1 final verification pending exact-head configured run; no criterion marked verified from selected local checks. A-22240 is partial macOS arm64 Node24.21 T1/T2 and lint/typecheck evidence, no configured/Linux/native/T3/T4/browser/provider proof. Reviewer ran no tests/probes/browser.

### rev-40 · 2026-11-20T21:31:37.541Z

verdict: review
result: not clear
by: rev-40 [reviewer]
run: rev-40-20261120-1897-evidence1
commit: e8b22da3dd32931c363601d8a0088bd4fcf4a534
scope: evidence
findings: [{"severity":"medium","text":"Configured full run fails cancel receipt assertion: Error ENOENT reading remote/exit after cancelled report. New incomplete package handoff intentionally omits exit/done; this native consumer still reads the old receipt. Lead/Coordinator attribution required before correction/retry; failed run cannot clear.","file":"hub/test/executor-run.test.ts","line":136}]
finding_counts: {"high":0,"medium":1,"low":0}

Full configured evidence not clear. A-22271/run34ef46a7 matches reviewed head and canonical tree34cf6ea8ab9937858a9ed3fb77bc8be4f6813264 (only excluded tracker/rulebook differences). Actual error atline47964: 'Error: ENOENT: no such file or directory, open .../exit'; stack points executor-run.test.ts136. Cancel subtest and its parent fail; lost sibling passes. New incomplete handoff omits exit/done, making this a concrete legacy receipt consumer for lead/Coordinator attribution; no unrelated-flake or cadence-failure inference. Named cadence/framing/supervisor/closure-fence/aggregate-disclosure controls pass, but C1 remains unverified and no deployed launcher/sizing proof claimed. T0/T1/T2 exit0; T3 exit1; Web unexecuted (browser null), T4 unexecuted. Producer aggregate8810tests8799pass2fail9skip; separate completed-before-interruption inventory8850/8839/2/9, not conflated. Noncached Linuxx64 c-8ams3 Node24.21.0 Nvim0.12.5; host check not repeated remotely, budgets/lint report-only. Source5 cap retained; await authorized attribution/correction direction before further source/run. Reviewer ran no tests/native/browser.

### impl-1897 · 2026-11-20T21:33:45.303Z

Coordinator-attributed cancellation regression from full run34ef46a7/A-22271 reproduced locally red on e8b22da3d under granted native slot: lost passed; cancel failed ENOENT reading remote run/exit at executor-run.test.ts136 (13.545s cancel, Node test command20.528s, exit1). Direct trace: incomplete finish returns before sole native exit receipt write. Consumer search covers runStatusProgram (exit read only after done), executor-run.test.ts136 direct legacy read, executor-droplet-component VM exit fakes and executor-prepare-component script-order assertion. Other host-agent exit paths are unrelated fixture triggers. Correction preserves exit status independently of done; update ordering assertion to actual done publication, preserving the no-premature-final-report fence.

### rev-40 · 2026-11-20T21:44:36.479Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261120-1897-native-cancel-source
commit: 6fa48265056f00c04b20c4956d5281d074924a64
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Narrow configured-test correction source clear, Standards0/Spec0 findings. Independently confirmed Coordinator9eb28f37/48ffb8a9 authorization under source5 cap. Native exit is preserved before incomplete return; done remains closure-gated, runStatusProgram reads exit only after done, and present/absent exit controls cannot manufacture terminal/green status. Actual done-publication ordering and positive missing-anchor control retained. Original executor-run143/one-report/resource-release assertions unchanged; sampler/disclosure/confirmed-release code unchanged. Docs match status-vs-completion boundary. A-22275 selected local macOSarm64 Node24.21 exact red then targeted3/3 andwholefile22/22green,focusedT2 92passes,lint/typecheck exit0; this is not configured/Linux/T3suite/Web proof. C1 final remains unverified pending Coordinator-owned full run at this new head. A-22271 remains failed historical receipt; no passing reuse. Reviewer ran no tests/native/browser.

### rev-40 · 2026-11-20T23:35:50.692Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261121-1897-final
commit: 6fa48265056f00c04b20c4956d5281d074924a64
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear, no findings. Exact corrected-head full rundeb2a5b9/A-22289 binds canonical treec7175a41c713ddc6faecf29af2d40e6ec89a145d; read-only comparison finds only excluded tracker/rulebook differences. Positive structured finishes verify supervisor1930,framing1935,stop1940,cadence1945,status fence16775,uploaded delivery/order17145,accounting/restart/deletion fence29064,child disclosure retry29564,native cancel38951 andparent38953. C1 verified under Coordinator's normal-cadence/interrupted-disclosure scope; source and closure gates remain clear. T0/T1/T2/T3/Web exit0,9299pass12platform-prerequisite skips0fail/cancel; T4unexecuted. Noncached Linuxx64 c-8ams3 workers2 Node24.21.0 Nvim0.12.5, Web Headless Shell1248/CfT156.0.8078.4. Host check not repeated remotely; budget/lint/T3 advisories report-only, no performance clearance. This is functional/exact-head suite proof; hosting launcher deploy/restart and T-2036 sizing remain separate, no deployed measurement claimed. A-22271 stays failed at earlierhead with its unexecuted phases retained. Reviewer ran no tests/native/browser.

Criteria: C1 verified.

### coord · 2026-11-21T01:00:50.220Z

Merged d788c486ee3c87ed90ea52d788137f14550dad1e onto dev.
