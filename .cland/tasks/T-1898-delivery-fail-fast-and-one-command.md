---
id: T-1898
kind: task
title: Delivery fail-fast and one-command fallback off droplets
state: closed
status: done
size: M
criterion_seq: 3
labels:
  - retro-improvement
assignee: null
parent: E-1888
blocked_by:
  - T-1859
topic: topic-1661
branch: t/T-1898-delivery-fail-fast-and-one-command
created: 2026-11-16T07:29:46.497Z
updated: 2026-11-20T03:04:24.664Z
closed: 2026-11-20T03:04:24.664Z
---

## Summary

`configuration.ts:239` lists `verification.executor` and `verification.droplet` as applied on reload, yet restarts #71–#75 were used to switch (unverified why). One command switches executor, workers and batch location live and verifies the switch. It also adds a pre-submit reachability probe and T-1664's C2 (replace the droplet once). Merges impl #7 and §7 #7.

Kind: product. Triage ticket H-10 of A-19813, part of E-1888 (the v0.4.0 retrospective improvements the human approved on 2026-11-16).

## Acceptance criteria

- [x] C1. `cland verify executor local\|droplet` (name unverified) switches executor and workers without a hub restart, and the next queued run uses the new executor (test).
  - done: impl-1898 · 2026-11-19T20:37:35.251Z
  - verified: rev-36 [reviewer] · run rev-36-1898-final-1 · 2026-11-19T23:05:13.508Z · commit 399edf91fab2d1e1c520dc6cc62656655d8cc551
  - verified: rev-36 [reviewer] · run rev-36-1898-final-2 · 2026-11-19T23:52:34.251Z · commit 2d652a74dad96f67c38332e8e01b12fe7375a7e0
- [x] C2. A transport-level delivery failure after T-1842's retry replaces the droplet once within the run (test).
  - done: impl-1898 · 2026-11-19T20:37:36.877Z
  - verified: rev-36 [reviewer] · run rev-36-1898-final-1 · 2026-11-19T23:05:13.508Z · commit 399edf91fab2d1e1c520dc6cc62656655d8cc551
  - verified: rev-36 [reviewer] · run rev-36-1898-final-2 · 2026-11-19T23:52:34.251Z · commit 2d652a74dad96f67c38332e8e01b12fe7375a7e0
- [x] C3. A region whose API or SSH probe fails before submission is skipped with a reason naming it (test).
  - done: impl-1898 · 2026-11-19T22:32:58.108Z
  - verified: rev-36 [reviewer] · run rev-36-1898-final-1 · 2026-11-19T23:05:13.508Z · commit 399edf91fab2d1e1c520dc6cc62656655d8cc551
  - verified: rev-36 [reviewer] · run rev-36-1898-final-2 · 2026-11-19T23:52:34.251Z · commit 2d652a74dad96f67c38332e8e01b12fe7375a7e0

## Dependencies

T-1859

## Comments

### impl-1898 · 2026-11-19T19:16:37.272Z

Consumer inventory before contract changes: production config parser/render/writer (init/config.ts, init/config-set.ts); configuration reload owner; daemon and dispatch control/status; Suites selection/capture/cache/queue/shards; suite-limits.ts, suite-lock.ts, suite-shards.ts, executor/droplet/droplet.ts; merge-batches.ts inherits Suites default executor; periodic dev and soak explicitly pin droplet and remain so. CLI executor/suite/usage, protocol.ts and shared/wire/index.ts, web-authority, session CLI admission and permission guards require additive switch support. Existing clients keep prior config.set/reload/status shapes. Tests: config-set, config-reload/component, verification-workers, suite-unit-fixture, executor-admission/droplet/prepare/safety-component, suite-dry-run/accounting/remote-budget/queue-policy; all-tier search also includes host-provider-digitalocean-prepare/setup-hosts and historical fixture/manifest references. Those retained records and host provisioning consumers are unaffected. Frozen cli-usage commands.json must change with help bytes; cli-help and cli-usage-compatibility run before review. Docs: hub/README index and docs/hub/running, suite-run-references, roles, adapters-and-sessions, cland-setup, project-secrets; docs/agents/tests and verification-shards. The old reload receipt and config.set replies stay compatible; no existing field is removed.

### impl-1898 · 2026-11-19T19:33:08.618Z

Baseline evidence (macOS arm64, Node 24.21, disposable projectHub/fake provider): hub.reload accepted executor/droplet settings before source changes; local workers failed with verification.workers changed: restart required. New switch test failed unknown request type executor.switch before implementation. Delivery replacement test failed 1 !== 2 before implementation. Pre-submit tests failed Missing expected rejection and API error lacked local guidance before implementation. Initial reachable T1 batch: 100 files, 1143 cases, 1141 pass/2 failures, both caused by this item in roles-clauses (growth reserve 6649 > 6528 and old clause wording). Clause was shortened and default versus existing project wording is now asserted separately; rerun follows. Replacement receipts add optional remoteReplacement accounting and machine.resources; suite-accounting, provenance, dispatch reports and late accounting confirmation share the aggregate calculation. Older records omit the fields and retain their previous rendering. No config-pinned project file or live database changed.

### rev-36 · 2026-11-19T19:50:28.671Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1898-source-1
commit: 336ff1aa1f8070efadac7c69397b5ac9da5ba553
scope: full
findings: [{"severity":"medium","text":"Spec P1: replacement passes the old deadline into acquire, but the real non-demo allocator persists new created+configuredLifetime using Infinity instead of runDeadline. There is no later original-lease cap, so replacement extends the lifetime; suiteUnit's fake preserves the argument and masks this mismatch. Preserve the original cap through real allocation/watchdog/spend and add an advanced-time allocation regression. Lead8bd818a1 confirms no approved extension and retracts A-21886's original-deadline claim.","file":"hub/src/executor/droplet/droplet.ts","line":280},{"severity":"medium","text":"Spec P2: if delivery on the replacement rejects, it escapes the committedOnly infrastructure classification in the else branch. The outer catch at1183 adds notRun only for parentRun, so integrated/dev-t3 non-parent jobs can become code1 without notRun:infrastructure although no worker started. Preserve structured pre-execution classification for both attempts and cover these outcomes; keep one-replacement and retained-attempt fencing. Lead6ef54e6a confirms no later owner repairs this.","file":"hub/src/hub/suites.ts","line":1141},{"severity":"medium","text":"Standards S1: three new config-reload callbacks and three executor-run-rules callbacks lack enclosing pre-acquisition normal/signal whole-caller ownership and separate setup bounds. The three executor-admission cases enter regionalFixture.run only after guard installation, leaving that acquisition outside ownership and setup bound. Resource/submission hooks are narrower than the original caller. Enroll original work/late acquisitions before observation and gate root/seam/guard restoration on positive closure. Lead58d466d9 confirms no omitted owner/exception.","file":"hub/test/config-reload-component.test.ts","line":18}]
finding_counts: {"high":0,"medium":3,"low":0}

Source NOT CLEAR at 336ff1aa1f8070efadac7c69397b5ac9da5ba553 / tree e5d69c677a33395a768cc263647b001a9ae3c763, base03efb0fc1, clean readback. A-21888 separates Standards1medium and Spec2medium, all confirmed from pinned source by the lead. P1 real allocator deadline differs from the semantic fake. P2 second replacement-delivery failure bypasses committed-only classification. S1 whole-caller/guard/setup ownership spans nine new callbacks; preserve real CLI subject execution separately from fake-only paths. No Reviewer reproduction.

C3 scope is explicitly approved by Coordinator f04f6926 at19:16:07, independently read from topic history: API/global reachability and regional availability before submission; bounded SSH readiness after acquisition with one different-region replacement. No regional SSH endpoint or pre-submit SSH requirement under that disposition. C3 remains done/unverified, not failed for that scope. C1/C2failed, nothing verified.

Positive source checks: additive Coordinator/human executor.switch, protocol/web authority/session-CLI boundaries, reauthorization at serialized validated atomic settings write and effective receipt; worker reload and queued/admitted snapshot distinction. Durable replacement fence before confirmed release, unique lease/replacement identities, delivered-execution and second-replacement fences, cumulative two-resource accounting with pending-null preservation and old-record rendering. Help/frozen bytes, marked workflow paragraph/CHANGES and default versus existing-project clause migrated. No pinned project config/tier/dependency change. Preserve these controls while fixing lifetime, classification and test ownership.

A-21886 reports serial105files1235/1235 and full typecheck/lint0. Independently confirmed exact listed105 manifest entries are100T1+5T2; selected real CLI subprocesses are not a zero-native census. Local macOSarm64/Node24.21, scripted provider/transport, no browser/real provider or configured/T3/T4/Web/QA proof. Earlier1143-case batch retained1141pass/2attributed role-clause failures (6649>6528 reserve and stale wording), not retroactive green. Original worker-reload error 'verification.workers changed: restart required', switch unknown-request, replacement '1 !== 2', unavailable-region and API-guidance reds stay separate. Summary head label is not an invocation-time tree/native-close attestation; original command/cwd/order/completion evidence requested additively, missing facts remain unknown. P1's original-deadline statement is explicitly retracted by lead8bd818a1, not established by those passes. Counterexamples are uncovered by current success receipts.

Hold released for bounded corrections/required checks, then fresh exact-head source review before configured submission. Keep one replacement, both-resource spend, previous wire/record compatibility, authority and all original assertions/failed epochs; no new full run requested. Reviewer read-only inspection only, no edits/tests/probes/scans/generators/native/browser/delegation.

Criteria: C1 failed (The new live-switch/reload validation callbacks lack pre-acquisition whole-caller cancellation/setup joins; resource hooks alone do not safely establish the acceptance evidence.), C2 failed (Replacement can receive a fresh full lifetime, and a second upload failure can lose infrastructure/not-run classification for integrated/dev-t3 non-parent jobs; semantic retry tests mask or omit these production paths.).

### impl-1898 · 2026-11-19T20:01:12.518Z

P1/S1 review-fix consumer inventory before the additive allocation cap: optional RunRef.leaseDeadline will constrain only replacement lease allocation, leaving the existing acquisition-wait deadline and ordinary/demo/local semantics intact. Production acquires are Suites and demos; local/delivery/worker/hostGate paths omit or ignore the new optional field. All recorded RunRef/leaseDeadline matches: hub/test/executor-admission.test.ts, qa/briefs/E-1533.md, hub/test/clock.test.ts, hub/test/suite-human-component.test.ts, hub/test/merge-queue.test.ts, hub/test/dev-t3-search-component.test.ts, hub/test/executor-safety-component.test.ts, hub/test/task-card-component.test.ts, hub/test/verify-submission.test.ts, hub/test/suite-queue-policy.test.ts, hub/test/suite-component-fixture.ts, hub/test/fakes/digitalocean/scripted-machine.ts, hub/test/suite-unit-fixture.ts, hub/src/hub/suite-worker.ts, hub/src/executor/local.ts, hub/src/executor/droplet/run.ts, hub/src/executor/droplet/droplet.ts, hub/src/executor/droplet/dependencies.ts, hub/src/executor/executor.ts, hub/src/hub/suites.ts. Raw QA E-1533 executor-operation signatures remain unchanged. The suite-unit fake consumes the explicit cap, while the new regression uses the real allocator, persisted lease, fake watchdog and spend inspection. Shared guardedLeaseCase consumers: suite-retention-fixture, evidence-publish, executor-prepare-component, executor-droplet-component, suite-billing-fixture and executor-lease-fixture. Its CLI allowance defaults false; only the distinct real CLI subject case opts in. Existing fake-only callers retain their guard.

### rev-36 · 2026-11-19T20:43:06.347Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1898-source-2
commit: a0a980b99edc98cb84ac799a225bad253c12a85a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source CLEAR at a0a980b99edc98cb84ac799a225bad253c12a85a / tree c3265dfdc835f967dc60ffbe7355f475b4d0f248, clean, correction commits0b0b74c8c+a0a980b99 after336ff1aa1, no dev merge. A-21902 records Standards0/Spec0. All A-21888 findings and the separately attributed fallback regression are resolved for source. C1/C2/C3 remain unverified pending same-head configured evidence.

P1: optional internal RunRef.leaseDeadline explicitly caps replacement resource lifetime, distinct from acquisition wait. Real allocator validates/persists min(cap, existing demo/configured lifetime) before spend/watchdog; omitted-field semantics retained. Advanced-clock/two-region real-allocation test checks original persisted deadline, watchdog input and thirteen-minute reserve after two of fifteen minutes elapsed; semantic fake now shares explicit cap. P2: both delivery attempts reach committed-only/parent infrastructure classification; integrated/dev-t3 tests retain both causes, no start, one replacement and reopen fence. S1: whole-caller admission precedes guard/root acquisition; named setup/original-work joins, late root/provider capture, nested fences and ordered disposal. Distinct real CLI subject alone opts into shared allowCli, default false retained.

Additional scope independently confirmed by Coordinator dd05b396: already-releasing acquisition cleanup stays with reconciliation and original fallback/budget policy. The accounting case now waits for bounded producer settlement then positively asserts its preinstalled fallback notices; original budget/provider/sweep/cancel/report assertions retained. No unknown cleanup becomes replacement authority.

A-21901 retained final serial127 distinct files, independently pinned119T1+8T2,1443/1443 with0fail/cancel/skip. Required cap, integrated/dev-t3, fallback, switch/CLI/queue and probe receipts inspected at final log129/130,211–214,321–325,1062. Separate existing publication subset2/2 is not whole-file proof. All14 export hashes independently match published bytes, not original private bytes or atomic launch identity. Actual P1 red12:17 vs12:15, P2 two reds, malformed setup rejection, interrupted108-file batch972pass/36cancelled and fallback red/green stay separate. Original literal pending-Promise diagnostic preserved. Scoped authorized ps/cwd zero-reference census is not captured-descendant close proof or signal authority; no kills/removal claimed.

Full typecheck/lint0, zero refusals/131 report-only findings62files. Source checks before final commit without intervening edits; batch after commit with clean HEAD/tree observed before/after. Atomic launch-tree/native PID/birth/signal/timestamps unknown. Local darwinarm64 Node24.21, scripted boundaries and isolated CLI subjects, no real provider/browser. No configured/T3/T4/Web/QA evidence; prior A21886/A21889 epochs not promoted. Optional-field/shared-helper/all-tier/QA consumer dispositions retained; authority/old wire+records/help/default-vs-project clause/accounting and C3 f04f6926 scope unchanged.

Hold released for Coordinator's same-head configured window; changed head needs source review. No final-ready claim or additional full run requested. Reviewer read-only task/Git/source/docs/manifest/log/hash inspection only, no edits/tests/probes/scans/generators/native/browser/delegation.

### rev-36 · 2026-11-19T21:10:30.721Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1898-evidence-1
commit: a0a980b99edc98cb84ac799a225bad253c12a85a
scope: evidence
findings: [{"severity":"medium","text":"Spec P1: shard-planning release shutdown case timed out after10000ms (structured timedOut/cancelled10.020462335s, A-21907:16782–16783/34238); the separate owner interruption still reports it running620s. Positive stop/drain/restart completion is missing. Coordinator44db6128 attributes this to T-1898; reproduce unchanged, preserve shutdown/release-intent/reservation/restart assertions and fix the actual boundary.","file":"hub/test/executor-admission-lock.test.ts","line":27},{"severity":"medium","text":"Spec P2: shared-cap fallback/confirmed-release control fails at the second launch with 'daily spend cap $0.063 reached', false!==true (A-21907:34240–34256). Source shows the first reservation is still active; later fallback and confirmed-release assertions are unreached, so double-reservation or release failure is not yet diagnosed. Coordinator attributes here; preserve conservative accounting and the intended fallback/release boundaries.","file":"hub/test/executor-safety-component.test.ts","line":322},{"severity":"medium","text":"Spec P3: held-provider-sizes cancellation control throws TypeError reading id (A-21907:34259–34265). The source reads q.waiters[0].id, leaving cancellation/drain/zero-spend assertions unreached. Coordinator attributes this changed admission boundary here; establish the proper durable admission receipt and preserve all original cancellation and spend oracles.","file":"hub/test/suite-close-component.test.ts","line":315},{"severity":"medium","text":"Standards S1: three region-capacity generated cases at425/454 still expect 'droplet size c-8 unavailable in regions lon1'; production returns 'droplet size c-8 unavailable in regions lon1, nyc1, sfo2; use cland verify executor local'. Coordinator44db6128 identifies missed diagnostic consumers. Migrate assertions/census while preserving refusal/no-fallback/no-red/culprit-search/cleanup/spend controls; the two task variants also fail at481.","file":"hub/test/suite-soak-component.test.ts","line":441}]
finding_counts: {"high":0,"medium":4,"low":0}

Configured evidence NOT CLEAR at a0a980b99edc98cb84ac799a225bad253c12a85a, Git tree c3265dfdc835f967dc60ffbe7355f475b4d0f248; run1577bd6c-9a3b-4c6c-af66-30a097cc3ed4/A-21907 remains failed/partial. A-21910 records exact six case names/literal errors, source boundaries and independent full-log audit. Four medium groups: stop/drain timeout plus separate owner hang; shared-spend admission failure; held-size queue waiter missing before cancellation; three missed region diagnostic consumers. Coordinator44db6128 independently read and attributes all six here, authorizing unchanged-head fake-only reproductions/corrections and consumer inventory, then fresh review/new window. No experimentally established root cause or permission to weaken original oracles is claimed.

Ordinary6299=6293pass+5fail+1cancelled; separate65load passes. Owner6363completed=6358pass+5fail includes65loads and excludes cancellation. Ordinary630file envelopes=233T1+397T2,626pass/4fail;44plannedT2 lack completion. T0host88.456s and T1exit0,T2exit1. No selected T3/Web execution; all272manifestT3 (one selected/rest deferred) and18T4 unexecuted. Browserbinary/versionnull. Report-only131lint/62files,budgets/ratchet are not failure causes. Structured10.020462335s cancellation and620s owner hang are different receipts.

Provenance34519 exact head, uncached runtime tree9a5121fdd8020214f8816bc5a5f9c0a37899790a (distinct from Git tree), dropletc-8sfo2 cland-v0-59d9009f, Linuxx64 6.8.0-149-generic/Node24.21/Nvim0.12.5, lifetime1086960ms/$0.07548333333333333/workers2. These machine accounting figures are not case/suite wall time. No duplicate/unmatched retained progress identities; no native-close inference for the hung owner.

Passing ordinary switch/CLI/reload, probe, real allocator cap, one-replacement/readiness and both second-delivery classification cases remain scoped positive evidence (A-21910 exact names/lines), never a full acceptance pass. C3 failed for unresolved pre-submit admission side effects and missed refusal consumers; C1/C2 remain done/unverified, nothing verified. Earlier source2 clear and prior local/precommit/failed rounds remain separate. Empty worktree readback before later Coordinator-authorized reproduction; later work is not part of this evidence epoch.

Evidence hold released for the Coordinator-authorized bounded work. Keep original release-intent, fallback/refusal/no-red, cancellation/zero-spend, accounting and one-replacement assertions; list missed consumers. No repeat of failed run requested; changed head needs fresh source review and a new window. Reviewer read-only inspection only, no edits/tests/probes/scans/generators/native/browser/delegation.

Criteria: C3 failed (Configured pre-submit/probe consumers regress shared-cap fallback, held-size cancellation and stop/drain, plus three region-refusal diagnostics; run1577bd6c failed/partial, Coordinator44db6128 attributes all six here. Original oracles must survive correction.).

### impl-1898 · 2026-11-19T21:20:09.591Z

Additive missed-consumer inventory after failed/partial run1577bd6c/A-21907 (previous full config/executor inventory retained). Missed T2 readers: executor-admission-lock.test.ts held first provider sizes at pre-submit instead of reserveShards; suite-close-component.test.ts same interception before q.waiters; executor-safety-component.test.ts default fallback under active shared reservation, plus raw verificationSettled admission wait; suite-soak-component.test.ts three exact original-region cause assertions. Migrated holds retain real reserveShards and ledger writes, stop/restart, no create, no spend, single report and cancellation assertions. Reachability/spend now share #probeAvailability; policy fakes suite-unit-fixture.ts and suite-queue-policy.test.ts cover both public boundaries. T1 executor-admission.test.ts uses checkReachability; suite-soak.test.ts seeded historical causes remain old-wire/read compatibility; suite-stage-rules.test.ts and suite-cover.test.ts reserveShards fakes retain their existing owner seam; suite-release-cache.test.ts checkSpend guard remains remote-required and cache-before-probe unchanged. host-provider-digitalocean.test.ts beforeSizes controls belong to host-provider path, not Suites; unaffected. Search of production, shared, hub/nvim/web tests, QA briefs, docs and shipped skills for checkSpend/checkReachability/reserveShards/beforeSizes/old literal found no additional production/import/raw/wire or QA consumer. Frozen CLI help bytes and protocol unchanged by this correction. Existing T3/T4 classification/history unchanged; earlier A-21907 selected T3/Web unexecuted and not claimed. Additional origin/dev comparison for provider-retry case:3/3pass at a8fc01d3 vs same case red at clean a0a980b99; ongoing T-1898 attribution. No configured retry.

### rev-36 · 2026-11-19T21:46:06.653Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1898-source-3
commit: 862e1b6cb41d1e7bc189d03e9c66475805a45829
scope: full
findings: [{"severity":"medium","text":"Standards S1: step owns the bounded receipt callback, not the original drive(f,f.verificationSettled()) promise. receipt() can reject after15s while that original loop remains pending; at223, owning finish() likewise does not join operations abandoned by its internal receipt wrappers (executor-safety-case.ts:18–23). Existing fixture stop/drain does not establish their positive closure before root/seam/guard cleanup. Lead93e9b121 confirms no omitted owner/disposition. Enroll originals at their producer and join them before teardown, separately bound observation, retain immediate rejection observers, unchanged15s/2s bounds and all final assertions.","file":"hub/test/executor-safety-component.test.ts","line":216}]
finding_counts: {"high":0,"medium":1,"low":0}

Source NOT CLEAR at862e1b6cb41d1e7bc189d03e9c66475805a45829/tree3e4e16cd74cd7f35d807fa802d5a3fe45d62a688, clean, sole correction commit aftera0a980b99, no dev merge. A-21921 separates Standards1medium S1 from Spec0 additional blocking findings. C3 failed for the residual original-promise lifetime gap; nothing verified, C1/C2 remain done/unverified. Lead93e9b121 confirms S1; no Reviewer reproduction.

Positive source checks: shared availability producer with reachability-only admission for fallback-eligible requests, remote-required spend check and atomic acquisition retained; held provider interception inside real reserveShards after durable admission; original ledger EEXIST/release-intent/stop/restart/cancellation/zero-spend/no-create oracles preserved. Three region causes migrated while structured refusal/no-fallback/no-red/no-search controls remain. Additional retry control uses exact real ledger contention and producer-driven fake time under unchanged15s bound; later2s/released-lease/empty-provider oracles retained. Source2 lifetime cap, both delivery failures, one-replacement/confirmed-release/accounting/authority/old-wire/live-switch controls unchanged. C3 Coordinatorf04f6926 scope retained.

A-21915 visible command inventories independently match all233T1 (1955/1955), eight domain files1T1+7T2 (131/131) and six furtherT2 (132/132), no aggregate across overlaps. Full typecheck/lint0, zero refusals131report-only findings62files; all25 declared export hashes match, not private original-byte attestation. Original six reds, stop cancellation/local20.459s runner vs old620s owner hang, domain130pass/1fail, original-head retry red, diagnostic-only intermittent pass, held-ledger red/green and dev3/3 controls remain separate. Coordinator051fb9ab independently read, keeps15s bound after detached-deva8fc01d3 controls. Direct native PID/birth/close/signal and atomic launch-tree/timestamps unknown. Local precommit darwinarm64/Node24.21, scripted boundaries and isolated CLI subjects; no browser/real provider/T3/T4/Web/QA/configured proof. Redacted commands/dev-command exports contain whole-line placeholders and are inspected as text, not parseable JSON or reconstructed exact missing paths.

Additive missed-consumer comment and independent function/seam search checked; policy fakes cover both admission boundaries, cache/explicit-size/historical diagnostics and host-provider seam distinctions retained. Frozen help/wire/tier bytes unchanged, matching file guidance and running docs updated. Prior1577bd6c/A-21907 remains failed/partial. Hold released for bounded ownership correction/required checks, fresh exact-head source review before another configured window. Preserve original-work joins, bounds and all final assertions. Reviewer read-only inspection only, no edits/tests/probes/scans/generators/native/browser/delegation.

Criteria: C3 failed (Admission/provider-retry validation still abandons original driver/finish operations when bounded receipt observation fails; callback ownership alone does not join those originals before teardown. Lead confirms the uncovered path at862e1b6cb.).

### impl-1898 · 2026-11-19T21:49:00.098Z

Before the source3 ownership correction: exact-original owner will be an additive optional callback on executor-safety-case.ts finish/scriptedResult; default callers retain existing behavior. Import/field/function/raw-consumer search finds executor-safety-component.test.ts and executor-safety-load.test.ts (T4 foreignLeaseCase/receipt), plus tiers.json and docs/evidence/T-1676-native-consumers.json history. No production, QA brief, nvim or web caller. Existing receipt signature/15s bound stays unchanged. Only the changed provider-retry case supplies its pre-acquisition scope.run owner, including direct admission drive and helper-internal operations/check callbacks; all old callers omit it. Test-helper default compatibility and T4 classification remain unchanged; no T4 run claimed. File-specific docs will record original-operation ownership and final-oracle preservation.

### impl-1898 · 2026-11-19T21:50:04.843Z

Ownership adapter detail before shared helper edit: guardedLeaseCase.run is the guard-installing void whole-case entry and cannot be reused as a value-returning operation owner. Additive own exposes its already-enrolled caseDeadlines.run without reinstalling the guard. Existing guardedLeaseCase consumers (executor lease/admission/droplet/prepare/billing, suite-retention, evidence-publish and config-reload/run-rules callers) keep run/patch/restoration behavior unchanged; only the provider-retry case uses own. No production/wire/role/tier change.

### rev-36 · 2026-11-19T22:37:27.765Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1898-source-4
commit: 399edf91fab2d1e1c520dc6cc62656655d8cc551
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source CLEAR at399edf91fab2d1e1c520dc6cc62656655d8cc551/tree7a5b42fdef5f6b57c548f8f4e48a9b80d8264ba7, clean/pushed, sole four-file correction after862e1b6cb, no dev merge. A-21932 records Standards0/Spec0. Source3 S1 resolved: own exposes generic caseDeadlines.run before the guard-installing run override; exact admission drive and optional finish/scriptedResult original operations/check callbacks enroll before bounded observation. Closure fences later operations and joins admitted originals before resource/root/seam/guard teardown; legacy defaults/value propagation retained. Real-finish held-original order control preserves settlement-before-cleanup, with guarded caller, registered release and enclosing finish join. Unchanged15s admission/2s provider retry and final report/lease/resource assertions. Product/source2/source3 contracts remain unchanged. C1/C2/C3 remain unverified pending fresh same-head configured evidence; no final-ready claim.

A-21930 independent audit: all233 manifestT1 files exactly present, TAP1955/1955;1953top-level native rows include1938visible passes+15scanner-withheld rows, not1953independently visible outcomes. Required probe/cap/queue/replacement records visible inT1/034+040. Fourteen affected full files1T1+13T2: TAP264=263pass+1fail, native258=257pass+1fail,0cancel/skip. This local batch is NOT all-green. Sole literal 'provider entered create: not within15000 ms' belongs to 'stopping during create detaches the provider reply and retains the tagged lease for restart'. Independently read Coordinatore3e7b2a7: create/prelease/cleanup-stop intermittency filedT-2016/outside scope; generic earlier timeout a hung-batch by-product; held-size correction stays here; Linux droplet verify is the gate. Original failed case remains failed under that disposition. Ownership control, provider retry, shared cap, stop/restart and held-size controls visibly pass at this source.

247native root close receipts:233T1 code0;affected13code0/1code1;all signal:null,no deadlines/signals,remaining observed PID sets empty. Root-close and sampled captured-descendant absence remain separate, OS-reap timestamps/machine-wide absence not claimed. Native lifetime is not case/suite wall time. All504 declared export hashes match, not private-original/atomic source-tree proof. Direct lint/typecheck0,zero refusals131report-only findings62files. Local precommit darwinarm64/Node24.21,scripted provider/host and isolated CLI subjects; no real provider/browser/T3/T4/Web/QA/new configured evidence. Atomic launch tree and direct static-check native identity/timestamps unknown; redacted JSON treated as text, withheld identities not reconstructed.

A-21927 retains ownership old-helper red, intermediate generic-result failure, prior2-case green before final control refinement, incomplete14-file epoch, Coordinator-authorized literal TERM/census,20a0/dev controls and isolation differences. None supersedes failed1577bd6c/A-21907 as green. Consumer/default/T4-history and file guidance checked, no production/wire/help/config/tier/role change. Hold released for Coordinator's new same-head window; keep head fixed through delivery, changed head needs source review. No extra full run requested. Reviewer read-only inspection only; no edits/tests/probes/scans/generators/native/browser/delegation.

### rev-36 · 2026-11-19T23:05:13.508Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1898-final-1
commit: 399edf91fab2d1e1c520dc6cc62656655d8cc551
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence CLEAR at 399edf91fab2d1e1c520dc6cc62656655d8cc551, source4/A-21932 unchanged and clean. Configured c0aed9d1-9788-4c6c-b770-a8673f27b8ce / A-21937 is finished/passed, auto exit 0. A-21938 records the complete independent structured-index audit and exact generated case/line census. Standards 0, Spec 0 outstanding findings. C1/C2/C3 verified here; no QA required under scope none.

C1: effective switch, real isolated CLI, executor/worker reload without restart and queued/admitted snapshot distinction. C2: one confirmed-release transport/readiness replacement, real allocation original lifetime/watchdog/spend and both second-delivery infrastructure outcomes. C3: unavailable/API/skipped-region receipts and bounded SSH replacement under Coordinator f04f6926's approved scope. All fourteen new generated identities have one ordinary pass plus exactly five distinct load-gate passes, including the original-work ownership control. Exact names and receipt locations are in A-21938; neither an exit code alone nor a name census is the proof.

7053 ordinary test outcomes all pass, 0 fail/cancel/skip/todo; includes 6896 top-level and 157 nested outcomes. Separate 70 load-gate passes. 731 ordinary file envelopes all pass: 233 T1,441 T2,1 selected T3,1 mapped T4,55 Web; no missing planned files, duplicate or unmatched progress identities, malformed records or bad outcomes. T0 host check exit0/99.236s only; T1/T2/T3/T4/Web command ends11059/36485/36539/36629/39160 exit0. Only roles.test.ts ran in T3 (four cases);271 other T3 files deferred. Only executor-safety-load.test.ts ran in T4, base once: ten internal lane/repetition passes plus parent/lane receipts and positive CPU progress diagnostic36604, not external T4 load repetitions;17 other T4 files unexecuted. Lint131/62, budgets/ratchet remain report-only.

Previously failing stop/release, shared cap, held-size cancellation, three region-refusal consumers, provider retry and unconfirmed-acquire fallback all have ordinary passes at this head. The separate T-2016 local create-stop case also passes this Linux run; no claim that one Linux pass fixes that intermittent macOS item. Selected role/default/launch consumers and mapped legacy foreign-lease helper are positively covered; other process tiers remain limited as above.

Provenance39210 and T0 binding105 name this run/head and uncached runtime tree ac7785dde2d0f1af58dd03a6d045738749f5009b, distinct from Git tree7a5b42fdef5f6b57c548f8f4e48a9b80d8264ba7. Droplet c-8 ams3 cland-v0-57381ae7, workers2, Linux x64 6.8.0-149-generic, Node24.21.0/Nvim0.12.5. Browser: /home/runner/cland/node_modules/playwright-core/.local-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell, Google Chrome for Testing156.0.8078.4. Machine lifetime1228171ms/$0.08528965277777778 are executor accounting, not suite/case wall time. cached:null, skips:[], skipReasonCheck report/missing0 do not turn deferred phases into passes.

Retain failed/partial1577bd6c/A-21907 and prior source/local/incomplete/control epochs separately; this later head/run never makes the old round green. A-21930 local263pass/1T-2016failure and Coordinator e3e7b2a7 disposition remain labelled. Hold released by verdict; no source edits or additional run requested. Reviewer read-only task/Git/source/manifest/complete-log inspection only, no edits/tests/probes/scans/generators/native/browser/delegation.

Criteria: C1 verified, C2 verified, C3 verified.

### rev-36 · 2026-11-19T23:17:28.224Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1898-delta-1
commit: 2d652a74dad96f67c38332e8e01b12fe7375a7e0
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Narrow merge-resolution source CLEAR at2d652a74dad96f67c38332e8e01b12fe7375a7e0/tree76c5e782a7322800310b9c9dd915c19ef028f5b8. Exact parents399edf91f+73bb6f974, clean. Coordinator b77edafc independently read explicitly authorizes post-ready origin/dev merge; rule11 exception satisfied. A-21944 records Standards0/Spec0 within delta scope. No criteria verified at this changed head; previous399edf91f marks remain current:false until fresh configured evidence.

Only combined/manual conflict is configuration.ts:263 applied-setting list. Independently computed exact union: first parent35unique/dev36unique/merge37unique, no duplicates/extra/missing. Retains verification.workers plus suite_retention_min_age_days and suite_retention_pass_limit. Startup-only list excludes all three. Reload calls apply before receipt; serving configure path, Suites live options/queued defaults and admitted snapshot/worker behavior retained; retention option closures/daemon defaults preserve incomingT-1992. No delivery/lifetime/accounting/ownership redesign in resolution, no manual pinned-config/tier change. Incoming dev work remains its own provenance; review covers resolution and shared worker/retention interaction.

A-21943 selection independently matches20T1+3T2 full files.446TAP pass,0fail/cancel/skip;439visible native pass rows+7scanner-withheld rows, no invented hidden identity proof. All23 root closes0/signal:null, no deadline/signal/remaining observed PID. Root close versus captured descendant absence/uncapturedOSreap kept distinct. Visible switch/CLI/live executor+workers/queued snapshot and retention parser/preservation cases pass; frozen CLI usage/compatibility/config-set complete. Full root typecheck/lint0, zero refusals; incoming765report-only findings149files and closed-wording855docs/2014items0findings retained, not a regression gate or comparable old count. All54 export hashes match; original/private/atomic launch-tree limits explicit. Local precommit darwinarm64 Node24.21, default isolation, scripted fixtures/isolatedCLI. Configuration-focused checks only, no all-T1/T2/browser/real provider/T3/T4/QA/fresh configured claim.

Old c0aed9d1/A-21937 and finalA-21938 belong to399edf91f, not this merge head. Hold released for Coordinator's new same-head mode-free window; keep2d652a74d fixed through delivery. No extra full run or enqueue requested here. Reviewer read-only task/history/Git/source/manifest/log/hash inspection only; no edits/tests/probes/scans/generators/native/browser/delegation.

### rev-36 · 2026-11-19T23:52:34.251Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1898-final-2
commit: 2d652a74dad96f67c38332e8e01b12fe7375a7e0
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final merged-head evidence CLEAR at2d652a74dad96f67c38332e8e01b12fe7375a7e0 / Git tree76c5e782a7322800310b9c9dd915c19ef028f5b8, unchanged/clean local and origin. Source delta rev-36-1898-delta-1/A-21944 remains clear. Fresh configured fe805720-2c6f-4afe-b7b6-714833732779/A-21949 finished/passed, auto exit0. A-21950 records complete independent log audit, exact acceptance/load/consumer names and receipt lines. Standards0/Spec0, C1/C2/C3 newly verified at this merge head; QA none.

C1 effective switch/CLI/live reload and queued/admitted worker distinction pass. C2 one confirmed-release transport/readiness replacement, original real lifetime/watchdog/spend, both second-delivery infrastructure outcomes and exact-original cleanup pass. C3 unavailable/API/skipped-region and bounded post-acquisition SSH cases pass under Coordinator f04f6926 scope. All14new generated groups have one ordinary and exactly5distinct load-gate passes. Worker/retention merge union is source-reviewed and fresh parser/scheduler/component/scale consumers pass.

7076 ordinary outcomes all pass,0fail/cancel/skip/todo;6919top-level+157nested. Separate70load passes. All732planned ordinary file envelopes pass:233T1+441T2+1T3+2T4+55Web. No missing planned file, bad outcome, duplicate/unmatched progress ID or malformed record. T0host59.819s only; T1/T2/T3/T4/Web command ends11117/36598/36652/36769/39314 exit0. Roles.test.ts only T3/fourcases, other271T3 deferred. T4 executor-safety-load and suite-retention-scale base once each, no external T4 repetitions; other16T4 unexecuted. Foreign-lease ten internal lane/repetition passes plus CPU-progress diagnostic36721 are separate from external load passes. Three50k-directory/artifact retention scale cases36723/36729/36736 pass; scheduler bounded deletion/reference preservation and cleanup-join controls also pass. No all-T3/T4 claim. Incoming lint765/149 and duration/ratchet overages remain report-only, not failure causes.

Provenance39388 and T0binding106 match this run/head and uncached runtime tree932673113b206ac3336b0eac2ff6bd55b0cc2204, distinct from Git tree. Dropletc-8ams3 cland-v0-7749d52d/workers2, Linuxx64 6.8.0-149-generic, Node24.21.0/Nvim0.12.5. Machine1666024ms/$0.11569611111111111 is accounting, not suite/case wall. Browser exact path /home/runner/cland/node_modules/playwright-core/.local-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell, Google Chrome for Testing156.0.8078.4. skips[],skipReasonCheck report/missing0 do not imply unselected-tier execution.

Older c0aed9d1/A-21937/A-21938 remain at399edf91f, not borrowed for this pass. Original1577bd6c/A-21907 stays failed/partial; local incomplete/control/T-2016 and private/atomic-native provenance limits remain separately retained. A-21943 was scoped446-test merge validation, not a configured pass. Hold released by final verdict; no source change/retry/enqueue/extra run requested. Reviewer read-only task/Git/source/manifest/complete-log inspection only; no edits/tests/probes/scans/generators/native/browser/delegation.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-11-20T03:04:24.664Z

Merged 16f801a05b735c33e9bcf19d0571696c2dd76659 onto dev.
