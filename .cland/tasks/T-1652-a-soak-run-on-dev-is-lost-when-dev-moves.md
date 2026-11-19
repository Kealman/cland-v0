---
id: T-1652
kind: task
title: "A soak run on dev is lost when dev moves during its host gate: it bundles the live root, not the submitted commit"
state: closed
status: done
size: S
criterion_seq: 2
labels: []
assignee: null
parent: E-1883
blocked_by: []
regression_of: T-1015
topic: topic-1644
branch: t/T-1652-a-soak-run-on-dev-is-lost-when-dev-moves
created: 2026-11-03T03:03:13.829Z
updated: 2026-11-19T06:11:10.080Z
closed: 2026-11-19T06:11:10.080Z
---

## Summary

Soak run a19be651 (A-16141) was admitted at 2026-11-03T03:00:08Z on dev f6128ed4, from the live root. T-1594 landed at 03:01:59Z, during the 37 s T0 host gate. Droplet delivery then refused with "dirty or changed worktree cannot be bundled for droplet: HEAD changed", and the run ended "all exit 1" with no tests run. Soak delivery runs `checkWorktree` against the live root (`hub/src/executor/droplet/run.ts:33`). Demos already deliver the submitted commit with `committedOnly` (`hub/src/hub/demos.ts:81`), and T-1015 fixed the same race for periodic dev T3. On a busy merge queue, dev moves every ~30–40 min, so soak runs can keep being lost.

## What to build

Soak runs, and any other integrated-dev occasion admitted from the live root, bundle the submitted committed head (committed-only delivery), as T-1015 did for periodic T3. A delivery that still cannot be made records the run as not run for an infrastructure cause, not as exit 1.

## Acceptance criteria

- [x] C1. A soak run admitted at dev commit A, with dev moved to B during its host gate, delivers A's tree to the droplet and runs (test).
  - done: impl-1652 · 2026-11-19T04:18:12.043Z
  - verified: rev-36 [reviewer] · run rev-36-1652-final-1 · 2026-11-19T04:50:37.596Z · commit f0728bf7989660372e5cc5c6eabe615649c260e2
- [x] C2. A soak delivery that fails for an infrastructure cause is recorded as not run with that cause, never as a red exit, and starts no culprit search or incident (test).
  - done: impl-1652 · 2026-11-19T03:36:11.796Z
  - verified: rev-36 [reviewer] · run rev-36-1652-final-1 · 2026-11-19T04:50:37.596Z · commit f0728bf7989660372e5cc5c6eabe615649c260e2

## Comments

### impl-1652 · 2026-11-19T03:00:22.270Z

Consumer inventory before policy change (rg committedOnly/runBundle/buildBundle/.deliver plus occasion/integrated/notRun across hub/src, hub/test, docs, .agents/skills and qa): all droplet bundles use executor/droplet/run.ts (initial delivery and full-bundle retry). Suites verify/task path currently checks exact source; batch uses a durable candidate cwd/head in merge-batches.ts; periodic dev-t3 already committedOnly; integrated soak and stage/epic/release/ordinary dev share Suites launch; sharded occasions additionally check live tree in #launchShards; demos.ts already passes true with captured head. Local executor builds no bundle and keeps existing HEAD checks. Consumers of existing outcome.notRun: dispatch resultText, dev-t3-result/search, suite covers/classify/latest, persisted result reader/recovery, journal and heartbeat, tracker verify projections, web/nvim views and protocol fixtures. No fields/wire shape/help bytes change; historical clients continue receiving existing code/cause/notRun fields. Soak quarantine reporting also must ignore notRun even if delivery diagnostics look like test failures. Existing guidance and QA docs do not prescribe a different bundling API; update running reference and soak test guide.

### rev-36 · 2026-11-19T03:16:47.460Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1652-source-1
commit: d2bdbf66465600bca66a336281ba159d2a740e0d
scope: full
findings: [{"severity":"medium","text":"A late integrated-soak delivery rejection unconditionally replaces an outcome already selected by cancellation (code143/cancelled) with code1/notRun:infrastructure. Public job.cancelled classification does not restore the durable outcome. Preserve selected outcomes and retain the late failure as a secondary diagnostic, with the held-delivery/cancel/reject durable-result regression.","file":"hub/src/hub/suites.ts","line":1073},{"severity":"medium","text":"New/reworked cover, native-bundle and public refusal callbacks use wait-only caseDeadlines without whole-caller pre-acquisition run/step ownership, root adoption, normal/signal fencing or a separate setup bound. suiteUnit/remote-fixture own their fixtures, not caller continuations. Compose existing whole-case owners around the affected callbacks while retaining assertions and native/async joins.","file":"hub/test/suite-soak.test.ts","line":19},{"severity":"medium","text":"The new/reworked fake-only cover/soak/report paths have semantic executor/provider fakes but no positively controlled callback/custom/sync/lower-spawn guard across setup/body/cleanup. Add complete fake-boundary protection for those paths, distinct from the intentionally native Git bundle proof.","file":"hub/test/suite-soak.test.ts","line":19},{"severity":"medium","text":"The newly generated soak bundle case repeatedly runs native Git, committedTree and real runBundle while remaining T2, contrary to the documented tier boundary. A native scheduling slot is not a tier exception. Move the native proof to its appropriate tier, preserve captured-byte/completion assertions and do not borrow old T2 evidence after migration.","file":"hub/test/suite-soak-component.test.ts","line":46},{"severity":"medium","text":"This missed affected QA consumer requires an integrated cover to reuse a local host gate and contain no remote check, while the new committed-only policy deliberately checks remotely. Update the expectation or record an explicit historical disposition; no approved exemption or QA execution exists.","file":"qa/briefs/E-614.md","line":300}]
finding_counts: {"high":0,"medium":5,"low":0}

Full Standards and Spec source review at d2bdbf66465600bca66a336281ba159d2a740e0d, tree 3a21d5f6ef491df304ea38310b65ee4894b7a537, fixed base 13cefb4b05e6be0b36a3038761739add149b8777. Five medium findings, none high or low. A-21526 retains exact findings, positive source checks, consumer dispositions and evidence limits. Author confirmations: 4f6676e1 (owners/guards/QA), e63e8f2b (selected cancellation), 5d57d91d (tier/QA). No edits/probes occurred during this pass.

Positive source: integrated dev and its shards now pass captured committed delivery, skip live-root host/tree gating, and retain existing task/local checks. The existing Git-object bundler pins the requested head. Quarantine now ignores structured notRun; the executed-failure positive control preserves the incident distinction. The new cancellation path and regression/consumer gaps prevent clearance.

A-21520 and retained invocation response4f6676e1 report local macOS arm64/Node24.21,27 distinct pinned T1 files/390 outcomes, final public reporting2/2, an earlier complete component40/40 before the added public soak case, and full lint/typecheck exit0 with report-only notices. Reviewer checked the27 filenames against tiers. The full private T1 log was deleted; invocation-time whole-tree/native Git/uname facts and unavailable raw bytes remain unknown. Precommit work-sequence association is not independent exact-head test provenance. No configured, T3/T4, Web browser or QA pass is inferred; old T2 proof cannot be reused for a moved native case. Reviewer ran no tests/checkers/scanners/provider/browser operations. Clean head/tree/origin and diff whitespace checks match the pin.

C1 and C2 failed; none verified. This consolidated verdict releases the source/experiment pin for the scoped corrections. Preserve assertions and all historical failure/evidence scopes; obtain any historical QA disposition from the Coordinator. Fresh immutable-head source review and authorized runtime/verification window precede a configured run.

Criteria: C1 failed (The required captured-commit regression lacks whole-caller ownership and its new native Git case remains in the wrong tier.), C2 failed (Late delivery rejection can overwrite selected cancellation, and refusal/report controls lack whole-caller and fake-native boundary protection.).

### impl-1652 · 2026-11-19T03:27:35.814Z

Review correction census: qa/briefs/E-614.md:300 was missed/affected, not historically exempt; updated its integrated-cover expectation plus related C1 qualification, D7 docs check and evidence mapping. docs/agents/tests.md Project commands and docs/hub/running.md host-gate paragraphs now explicitly distinguish ordinary tasks/batches (host check/reuse) from integrated dev/dev-t3 (captured-commit remote check). qa/briefs/E-676.md D8/L2/R1 remain ordinary task or compatible-host-receipt checks and are unaffected; L3 integrated cover checks counts/head without demanding host reuse. qa/briefs/E-468.md has no matched host-gate/no-remote-check assertion. All three QA briefs remain unexecuted in this item. Native bundle pair migrated T2 -> T3 in suite-bundle-native.test.ts; no T2 proof carried forward. Existing unrelated T2 native ancestry case is Coordinator-filed T-1996 and stays untouched. New cancellation receipt regression covers cancel during held delivery followed by rejection; actual durable JSON keeps143/cancelled and full log retains secondary failure.

### rev-36 · 2026-11-19T03:40:02.223Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1652-source-2
commit: cb2ddfcd778be18aaf19f43dd75e1dbd42e01a53
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at cb2ddfcd778be18aaf19f43dd75e1dbd42e01a53, tree04cc478ad3b90c5f4e440c61a3fa78b59c022739. Full Standards and Spec source review of the reworked ownership design and five source1 corrections; findings []. A-21537 retains the detailed audit.

The delivery catch preserves a selected cancellation and records the late rejection secondarily. The new guarded cancellation case checks actual durable143/cancelled/no-notRun JSON and full persisted diagnostic log. suiteCase enrolls shared normal/signal ownership before guard/acquisition, captures late roots before cancellation checks, fences operations, joins original work and retains guard restoration through cleanup. Fake-only paths use the positive callback/custom/sync/lower-spawn guard; the real Git bundle pair moved to its own T3 file with fresh native proof and preserved source-byte/head/completion assertions. E-614 and shared host/remote-check docs now describe the changed boundary; other named QA consumers remain explicitly unaffected/unexecuted. Unchanged ancestry tier debt is filed T-1996.

A-21535 retains exact-head local Darwin27 arm64/Node24.21 evidence:27 distinct pinned T1 files391/391, selected public T2 reporting2/2, and new native T3 bundle2/2 under the Coordinator slot. Reviewer inspected named positive records beyond exits. Final full typecheck/lint completed exit0, lint refusals0;129 findings/62 files and existing notices remain report-only. Source1/development failures and precommit receipts retain their original scope; home-path publication redactions and unknown resolved native Git facts remain qualified. This is not full T2/T3/T4/Web browser/QA or configured verification. Read-only source/metadata checks match the clean pushed pin; no dev merge after source1. Reviewer ran no tests, scanners, provider or browser operations.

C1/C2 remain done but unverified; no criterion verified by this source pass. The Implementer may request the Coordinator's window for mode-free configured verification at this unchanged head. Final evidence must retain exact generated task/native receipts and completed/unexecuted phase/provenance distinctions. A changed head needs fresh source review.

### rev-36 · 2026-11-19T04:12:23.269Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1652-evidence-1
commit: cb2ddfcd778be18aaf19f43dd75e1dbd42e01a53
scope: evidence
findings: [{"severity":"medium","text":"Configured run4efc4411/A-21556 fails the missed affected integrated-stage consumer: expected /Host gate: check not set/, but the changed committed-only delivery emits Commands: check not set · test printf project-test and creates no local gate. Migrate this boundary assertion and census while retaining one-run/sharding/stage-cover/message/cleanup assertions; then fresh source review before another configured run.","file":"hub/test/suite-close-component.test.ts","line":478}]
finding_counts: {"high":0,"medium":1,"low":0}

Not clear: run4efc4411-55d2-429f-afba-a16d51e573b9/A-21556 finished failed at source-clear cb2ddfcd778be18aaf19f43dd75e1dbd42e01a53, runtime tree a513584e3597786dd7ac6ea391436b1c47269ca8. A-21557 records the literal assertion, read-only structured audit and Coordinator attribution5c68e70b. Sole failure is another project stage close skips sharding and runs once without a check; the obsolete Host gate expectation missed the new integrated committed-only delivery policy. Assigned to T-1652 as a missed consumer; add its file to rule20 census and obtain narrow source review after correction. T0/T1 pass, T2 fail; 6168 base receipts=6167pass/1fail plus240 distinct passing load observations=owner6408completed. Six related fake-policy cases and their5/5 repetitions pass, but native changed T3/Web unexecuted, remainingT3 deferred/T4 unexecuted. Linux droplet x64/Node24.21/Nv0.12.5, browser null, cached null; report-only advisories are not causes. C1 failed; C2 remains done/unverified. Hold released for the authorized narrow correction, not a same-head retry. Preserve4efc4411 failed/partial; no Reviewer experiments performed.

Criteria: C1 failed (The changed integrated-delivery contract still has a failing stage-close consumer at suite-close-component.test.ts:478; new native bundle acceptance proof was unexecuted in this failed partial round.).

### impl-1652 · 2026-11-19T04:13:46.483Z

Evidence1 correction census: hub/test/suite-close-component.test.ts (T2), 'another project stage close skips sharding and runs once without a check', was a missed affected Host-gate text consumer. A-21556 run4efc4411 remains failed/partial: literal AssertionError expected /Host gate: check not set/, actual Commands: check not set · test printf project-test; T0/T1 passed, T2 failed, native changedT3/Web unexecuted. Reviewer rev-36-1652-evidence-1 / A-21557 and Coordinator5c68e70b assign this consumer here. Narrow fix asserts the recorded unset check/test command and absence of local Host gate, retaining every other assertion. Local targeted case reproduced the same red before correction. Exact-text search over hub/test, nvim/test, docs and QA also found suite-remote-log.test.ts (T1, supplied-compatible-host-receipt byte ownership), executor-run.test.ts (T3, ordinary task/recorded check), scenarios/droplet-verify.test.ts (T3, ordinary task compatible-host receipt), plus QA E-676's ordinary-task checks; these remain unaffected, not new integrated gate expectations. No production change or head/dev merge in this correction.

### rev-36 · 2026-11-19T04:19:26.580Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1652-source-3
commit: f0728bf7989660372e5cc5c6eabe615649c260e2
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source3 clear at f0728bf7989660372e5cc5c6eabe615649c260e2, tree72bc7fa3d4f2baa7ac4e39042d43e425e4fcef99. A-21561 records Standards/Spec review of the requested two-file correction with source2's unchanged production/ownership basis. Sole parent is cb2ddfcd7; clean/pushed; no production/helper/config/duration/tier/dev-merge change. The corrected T2 case positively matches the exact Commands: check not set · test printf project-test header and asserts no local Host gate line. Every other original completed-result, stage-cover, sharding-warning, single-acquisition/message and cleanup assertion remains. Matching per-file guide and missed-consumer census are corrected; other exact-text readers have explicit unaffected/deferred dispositions. No findings. A-21559 retains original red, precommit targeted green, exact-head affected T2 file18/18 and full typecheck/lint exit0/zero refusals;129 findings62files remain report-only. Reviewer inspected the named case/completion output; no tests/probes ran during review. These local macOS scripted receipts do not replace configured/native proof. Run4efc4411/A-21556 remains failed/partial. C1/C2 remain done/unverified. Source review hold released; Implementer may request a new Coordinator mode-free verification window at this unchanged head, with exact named corrected T2 and selected native T3 receipts required for final settlement.

### rev-36 · 2026-11-19T04:50:37.596Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1652-final-1
commit: f0728bf7989660372e5cc5c6eabe615649c260e2
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear at unchanged clean/pushed f0728bf7989660372e5cc5c6eabe615649c260e2, source tree72bc7fa3d4f2baa7ac4e39042d43e425e4fcef99. A-21578 records audit of02b3eeaf-f468-4202-a69e-e9734905017c/A-21577, finished/passed, ownerautoexit0. Exact native T3 dev-t3/soak captured-commit bundle cases pass at37112/37117; corrected stage-close consumer passes30046. Six captured-head/recovery/cancellation/infrastructure-report cases pass base plus5distinctload repetitions each. Reviewed real Git/runBundle/receiver-byte proof establishes C1 at the scripted executor boundary; actual durable structured notRun/cause/no-red/no-culprit/no-incident and selected-cancellation assertions establish C2.6906basepasses=6761top-level+145nested, zero fail/cancel/skip/todo;240separateloadpasses;723passingbasefiles231T1/436T2/selected1T3/55Web. T0/T1/T2/selectedT3/Web exit0; remainingT3batch-deferred/T4unexecuted. Provenance39753 binds head/runtimetree717971f9191b93f4a32d2633b5e218633d2c4d5a, uncached droplet Linuxx64 6.8.0-147-generic Node24.21/Nv0.12.5 and actual isolated HeadlessShell1248/ChromeTesting156.0.8078.4.132.21s is T0hoststep only. Budget/ratchet/oldowneradvice and129lintfindings62files remain report-only. Earlier4efc4411/A-21556 remains failed/partial with nativeT3/Webunexecuted, never retroactively green. No findings or Reviewer runtime. C1/C2verified; hold released.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-19T06:11:10.080Z

Merged 4b7c7648ad36d029ac91fe685148583c78f33f87 onto dev.
