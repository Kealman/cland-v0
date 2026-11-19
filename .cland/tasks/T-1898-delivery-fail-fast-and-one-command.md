---
id: T-1898
kind: task
title: Delivery fail-fast and one-command fallback off droplets
state: open
status: in progress
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
updated: 2026-11-19T21:20:09.591Z
---

## Summary

`configuration.ts:239` lists `verification.executor` and `verification.droplet` as applied on reload, yet restarts #71–#75 were used to switch (unverified why). One command switches executor, workers and batch location live and verifies the switch. It also adds a pre-submit reachability probe and T-1664's C2 (replace the droplet once). Merges impl #7 and §7 #7.

Kind: product. Triage ticket H-10 of A-19813, part of E-1888 (the v0.4.0 retrospective improvements the human approved on 2026-11-16).

## Acceptance criteria

- [x] C1. `cland verify executor local\|droplet` (name unverified) switches executor and workers without a hub restart, and the next queued run uses the new executor (test).
  - done: impl-1898 · 2026-11-19T20:37:35.251Z
- [x] C2. A transport-level delivery failure after T-1842's retry replaces the droplet once within the run (test).
  - done: impl-1898 · 2026-11-19T20:37:36.877Z
- [ ] C3. A region whose API or SSH probe fails before submission is skipped with a reason naming it (test).
  - failed: rev-36 [reviewer] · 2026-11-19T21:10:30.721Z · note Configured pre-submit/probe consumers regress shared-cap fallback, held-size cancellation and stop/drain, plus three region-refusal diagnostics; run1577bd6c failed/partial, Coordinator44db6128 attributes all six here. Original oracles must survive correction.

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
