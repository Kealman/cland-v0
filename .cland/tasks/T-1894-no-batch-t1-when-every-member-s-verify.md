---
id: T-1894
kind: task
title: No batch T1 when every member's verify is current
state: open
status: ready
size: S
criterion_seq: 2
labels:
  - retro-improvement
assignee: null
parent: E-1888
blocked_by:
  - T-1582
topic: topic-1617
branch: t/T-1894-no-batch-t1-when-every-member-s-verify
created: 2026-11-16T07:29:45.714Z
updated: 2026-11-18T08:37:14.257Z
---

## Summary

A member's mode-free verify already ran T0–T2 at its head. Skip the batch's T1 when every member's verify is green at its exact head. Merges §7 #6 option 2 ("stop paying twice") with impl #1.

Kind: product. Triage ticket H-6 of A-19813, part of E-1888 (the v0.4.0 retrospective improvements the human approved on 2026-11-16).

## Decision change

changes rule 6 and `merge.batch_tiers`. The human approved this change on 2026-11-16 at 07:25Z (ask 8e3dd5ab, triage A-19813).

## Acceptance criteria

- [x] C1. A batch whose members all have green mode-free verifies at their exact heads runs no T1, and its summary names those verifies (test).
  - done: impl-1894 · 2026-11-18T08:05:12.967Z
  - verified: rev-36 [reviewer] · run rev-36-1894-final-1 · 2026-11-18T08:37:14.042Z · commit 53ed3f37b36d7f47e830580e71d0fd3d871e00f8
- [x] C2. A stale or missing member verify brings T1 back for the batch (test).
  - done: impl-1894 · 2026-11-18T08:05:13.107Z
  - verified: rev-36 [reviewer] · run rev-36-1894-final-1 · 2026-11-18T08:37:14.042Z · commit 53ed3f37b36d7f47e830580e71d0fd3d871e00f8

## Dependencies

T-1582

## Comments

### impl-1894 · 2026-11-18T06:19:32.362Z

Decision recorded in topic-1617: Coordinator confirms immediate enforcement under human ask 8e3dd5ab (2026-11-16, triage A-19813). This changes rule 6's always-T1+T3 batch wording and merge.batch_tiers effective selection: T1 may be omitted only with complete green mode-free exact-head member receipts; T3 stays. Coordinator will update rule 6 after landing; no role clause lines added. Confirmed TDD seams: pure receipt policy and sealed Suites admission/MergeBatches summary, including older-head fallback with explanation. Tests staged; no tests executed while cover-quiet 34ba2b0d holds the machine. Red receipts pending test-slot wake-up.

### impl-1894 · 2026-11-18T06:20:34.785Z

Rule 20/41 consumer inventory published as A-21065, durable path /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21065-t-1894-consumer-inventory-before-implementation.md. Covers config/occasion/command planning, archived Suites receipts/cache, controller/member-topic reporting, shared wire, CLI frozen help, Web verification view (no merge.queue requester exists under web/src here), nvim, T1–T4 consumers, QA briefs and shipped skills. Staged inventory copy removed. Added first C1/C2 regression slices in merge-batches.test.ts; no execution or passing claim yet.

### impl-1894 · 2026-11-18T06:37:27.857Z

Consumer inventory disposition update: policy decision is stored only in optional internal SuiteJob.batchT1, not SuiteSelection, BatchSuite, MergeBatchStatus or shared wire. Persisted readers: Store.suiteJobSummaries/suiteHistoryProjection intentionally omit this detail; Suites.#full/receipt loads the indexed full job only for the selected current member, preserving retained-history bounds. Suites.status/recentStatus and verification queue keep prior wire shapes. CLI merge queue still reads MergeBatchStatus members/tree/failure, no tier assertion. Web sessions/VerifyLine.tsx and sessions/verification.ts consume verification.queue (connection.ts); no merge.queue requester/merge batch view is implemented in web/src at this head, so no UI migration needed. nvim likewise has no batch-tier reader. Old internal jobs without batchT1 render 'T1 policy unavailable (legacy receipt)', never skipped. Existing wire-conformance fixtures remain unchanged previous-shape controls. Coordinator confirmed member-topic summary persistence is sufficient; no tracker write added.

### impl-1894 · 2026-11-18T06:43:48.802Z

Implementation pushed at 548cb6609c45d07add71293776ffef3da615d8d1. Red/targeted validation artifact A-21082: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21082-t-1894-red-and-targeted-validation-evidence.md. Selected local macOS T1 batch: 51 files / 650 tests passed; required cli-help T2: 9 tests passed; full typecheck passed. No T3/T4 or browser execution. First full test:lint passed with zero refusals and report-only advisories; final post-doc-cleanup run is finishing before source review. All criteria marked done; no per-item QA required. Source review then mode-free verification window remains outstanding.

### impl-1894 · 2026-11-18T06:51:49.203Z

Consolidated-fix decisions (Coordinator 424ee075 and 7f80d57d): eligibility must use additive structured per-tier status receipts written by the producing runner; no log parsing. Old/missing metadata always retains configured T1, so no rule-19 rollout dependency. Same-tree cache receipts count without new source head/item/branch restrictions. Only remove T1 when another configured tier remains: ['T1'] always runs T1; no-T1 configs stay unchanged and acquire no fallback. Add all three config cases. New callback tests must enroll whole-callback ownership before acquisition, bound setup separately and install positively controlled native launch guards through cleanup. Holding source/experiments at reviewed 548cb6609 pending consolidated verdict. Retained-command/native-return supplement is A-21086 (correcting the mistaken id in one reply).

### rev-35 · 2026-11-18T06:52:48.837Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1894-source-1
commit: 548cb6609c45d07add71293776ffef3da615d8d1
scope: full
findings: [{"severity":"medium","text":"Standards/rules17/39/40: new per-step completeness authorization regex-parses log tier outcomes and accepts unbound lines at18; no producing-owner structured step receipt/approved exception exists (e95d6a02). Use durable owner-bound execution/completion facts across supported executors/cache paths; legacy/unknown retains T1. Printed tier strings or copied bindings must not authorize omission.","file":"hub/src/batch-member-verification.ts","line":16},{"severity":"medium","text":"Standards/rules9/12: five new controller callbacks use raw fixture(t) without pre-acquisition whole-callback fencing/join or separate setup bounds. suiteUnit owns partial resources, not later caller/reopen/mock continuations; existing helpers are not enrolled. Adopt/join original work before captured storage/root/mock cleanup, preserving all assertions. Author confirmse95d6a02.","file":"hub/test/merge-batches.test.ts","line":120},{"severity":"medium","text":"Standards/rule38: new fake-only callbacks have semantic executor mocks but no positively controlled native launch guard for callback/custom/sync/lower-spawn routes through setup/body/cleanup. Enroll shared counted guard under joined ownership and verify zero non-control attempts after resource/root teardown before restore; confirmedfb21ae67/A-21086.","file":"hub/test/merge-batches.test.ts","line":162},{"severity":"medium","text":"Spec/C1: source cache job is required to match the member head/item/branch, although existing #cached accepts same-tree/commands/selection reuse across those identities. A valid exact-head cached member can wrongly retain T1. Validate source receipt via cache correspondence/completeness, keep member identity on cached job, cover legitimate cross-head/item source and invalid/unavailable fallback; restriction unapprovede95d6a02.","file":"hub/src/hub/suites.ts","line":1869},{"severity":"medium","text":"Spec/C1/config scope: batch_tiers=['T1'] can be filtered to[] and leave a T0-only batch. Coordinator7f80d57d requires soleT1 always run; only remove T1 if another configured tier remains. Cover soleT1, T1+other and noT1 unchanged cases; do not force T1/T3 into a noT1 custom config.","file":"hub/src/hub/suites.ts","line":636},{"severity":"low","text":"Standards/rule16: later shard-planning paragraph still states 'Hub-owned batches plan T1/T3 on one slot' unconditionally after the main section adds conditional T1 reuse. Qualify default/config/receipt conditions and document the clarified soleT1/noT1 cases.","file":"docs/hub/running.md","line":1711}]
finding_counts: {"high":0,"medium":5,"low":1}

A-21090 full source review at Git tree449756201c99eba0ea02e711f46f6c0ddd3481e1, fixed base303b482b82f898df49c31449b70417880005152f: Standards3medium+1low; Spec2medium. Immediate enforcement/per-member topic reporting/internal metadata approved4aac9dff/be4c0781; config decision7f80d57d independently read. Indexed latest/full-job hydration and shared streaming evidence, pinned diagnostics/confirmation, unchanged public wire, MERGE_USAGE/frozen exact bytes and existing Web planner retained. A-21082/A-21086 independently hashed;51selectedT1 paths confirmedT1,650aggregateexit0 with truncated titles;cli-help9exit0; typecheck/lint finalexit0/zero refusals130report-only, all qualified precommit epochs. Setup/compiler/manifest failures retained separately; no configured/native/browser proof, native guard absent. C1/C2failed/unverified;QA none. Consolidate fixes then fresh clean-head source review before configured run; no dev merge or Reviewer runtime/edits. Hold released.

Criteria: C1 failed (Eligibility uses log-derived step proof, rejects legitimate cross-identity cache sources, and can empty a sole-T1 batch.), C2 failed (New stale/missing/cache controller regressions lack whole-callback acquisition ownership and positive full-lifetime native isolation.).

### impl-1894 · 2026-11-18T07:09:10.865Z

Additive tier receipt consumer inventory (supplement to A-21065; searches include RunRef, RunStatus, WorkerCompletion, runStatusProgram, verificationStepCommand, status/finished/code result readers and raw result.json accesses): hub/src/verification-plan.ts, hub/src/hub/suite-worker.ts, hub/src/hub/suites.ts, hub/test/clock.test.ts, hub/src/executor/local.ts, hub/src/executor/droplet/run.ts, hub/src/executor/droplet/droplet.ts, hub/test/suite-human-component.test.ts, hub/src/executor/droplet/dependencies.ts, hub/src/executor/executor.ts, hub/test/merge-queue.test.ts, qa/briefs/E-1533.md, hub/src/suite-worker-admission.ts, hub/test/executor-safety-component.test.ts, hub/test/suite-worker-cause.test.ts, hub/test/dev-t3-search-component.test.ts, hub/test/task-card-component.test.ts, hub/test/suite-unit-fixture.ts, hub/test/verify-submission.test.ts, hub/test/suite-queue-policy.test.ts, hub/test/suite-component-fixture.ts, hub/test/executor-droplet-component.test.ts, hub/test/fakes/digitalocean/scripted-machine.ts, docs/agents/tests/hub-test-executor-prepare-retry.test.ts.md. Local native producer/admission and remote generated writer/status reader now carry optional tierReceipts. LocalExecutor.status already spreads arbitrary completion fields; hub status assimilation, terminal result rewrites and remote restart restoration explicitly preserve them. Store compact indexes/public status and queue projections intentionally omit the internal detail; full selected-job hydration retains it. Existing old-shape worker-cause and raw remote-status controls remain; absence means configured T1 runs. Scripted-machine/suite-unit fixture builders accept explicit metadata; they never infer it from logs. Native T3 executor-run/recovery/protocol/close result consumers read selected prior fields or diagnostic text, so optional fields do not change their assertions; they remain unexecuted locally pending configured verification. No public shared-wire type, parser setting or default is changed. Metadata grammar/writer/read bounds live in one shared verification-tier-receipts module.

### impl-1894 · 2026-11-18T07:32:15.133Z

Consolidated fix pushed at 4750d206e6d1ad8867bdf0251cabd37995a8664a, tree 32b4c8aba3b12b0601561d77bf657e52e30d095b. M1–M5/L1 addressed. A-21117 explains source/finding dispositions and validation epochs; A-21118 retains returned commands/test names/output and the additional failed interaction regression. SHA256: A-21117 888c30e17df495dc91ce6f7b9326641aade7f858d0a0baff4de6d997aaa9368f; A-21118 0dd03acbea81eef110f96306916c2dc1eab858a30ceaeecaa60f3969378fe54c. Publication scan positive control exit 0, output scan exit 1/no matches; staged copies removed. Final-head typecheck/full lint, 11 guarded criterion tests and 9 cli-help T2 pass. Broader 102-file/1061-test T1 proof is explicitly ea75a524b before the isolated sole-T1 interaction fix, not a final-head full run; changed executor T2 18 tests at 780acd5b has identical runtime source to final head. Full artifact epochs retained. Fresh source review delivered to assigned Reviewer role; configured verify/window remains outstanding.

### rev-36 · 2026-11-18T07:46:41.916Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1894-source-2
commit: 4750d206e6d1ad8867bdf0251cabd37995a8664a
scope: full
findings: [{"severity":"medium","text":"guardedMemberCase joins the pending whole callback before executing the captured joinedCase owner.close hook, leaving the actual callback's step admission unfenced during teardown. Enroll the native-free fence before acquisition and before joining, then drain captured cleanup and verify/restore the guard.","file":"hub/test/merge-batches.test.ts","line":45},{"severity":"medium","text":"The new uploaded-status receipt case directly awaits native guard setup and dynamic import while t.after may verify/restore that guard without joining the caller continuation. Use guardedLeaseCase or equivalent pre-acquisition whole-case ownership with named setup and fenced/joined steps.","file":"hub/test/executor-droplet-component.test.ts","line":245}]
finding_counts: {"high":0,"medium":2,"low":0}

Full reworked-source review at pinned tree 32b4c8aba3b12b0601561d77bf657e52e30d095b vs fixed base 303b482b82f898df49c31449b70417880005152f. A-21131 contains separate Standards (2 medium) and Spec (0 independent) reports, complete correction/evidence epoch boundaries and consumer/tier checks. Receipt authority, same-tree source cache reuse, sole/no-T1 configuration, help/frozen bytes and docs fixes pass source inspection. C1 remains runtime-unverified; no configured run exists. Retained A-21118 local passes remain scoped: earlier 102 T1/1061 summary, final 11 criterion cases, parent identical-runtime T2 18, final help9 and typecheck/lint0refusals. Earlier failed rounds remain failed. No Reviewer experiments. T-1962 is the separately filed pre-existing admission race, outside this correction. Verdict releases the pin for consolidated M1/M2 fixes; corrected pushed head needs fresh source review before verification.

Criteria: C2 failed (The stale/missing controller regressions still use a helper that fences the actual callback only after joining it; nominal passing assertions do not settle the required caller lifetime.).

### impl-1894 · 2026-11-18T08:05:13.819Z

Review-2 ownership correction pushed at 53ed3f37b36d7f47e830580e71d0fd3d871e00f8 / tree 96d7bc05cb9b27bd3beddad78fb05b610d0ab3ca. A-21137 explains the early actual-owner fence and T2 guardedLeaseCase correction; A-21138 retains decoded commands/results, names and the failed teardown/abort controls. SHA256: A-21137 d39a6d8221fe61e7d58b8414e7aaef9c6315cf068ed559f48d2f1305e63dfa4d; A-21138 f486e28e73f171de51144d2e7aca1bfde2c61489981ce9f0f69a0c07edbcc776. Current-head 13 owner/criterion T1 cases, changed T2 file 18 cases, full typecheck and full lint pass; precommit full changed T1 file 103 cases remains scoped to that epoch. Positive publication scan control exit 0, output scan exit 1/no matches, staged copies removed. Fresh source review requested before any configured verification. Separate legacy helper work is T-1963; admission race is T-1962.

### rev-36 · 2026-11-18T08:08:04.150Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1894-source-3
commit: 53ed3f37b36d7f47e830580e71d0fd3d871e00f8
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-21139 full corrected-source clearance, tree96d7bc05cb9b27bd3beddad78fb05b610d0ab3ca, fixed base303b482b82f898df49c31449b70417880005152f; prior full production/spec/census basis A-21131 unchanged. Four-file correction only (two tests/guides), no dev merge. M1 actual callback fixtureWork is created pre-acquisition; releaseOnClose/TestContext-abort synchronously fence before pending joins, captured resources await its positive join, final guard requires ownerJoined/settled/completed hooks. Two held-continuation controls positively require admission-closed rejection and no later admission; old order failed both. M2 uploaded-status uses existing guardedLeaseCase with named import setup and admitted VM steps; exit/metadata/byte/close assertions retained. Standards0/Spec0. Independently read A-21137/A-21138: exact-head13targetedT1,18fullchangedT2 and full typecheck/lint0refusals pass;103fullT1 pass remains precommit identical-runtime claim with unknown invocation tree, not exact-head launch. Counts overlap; failed rounds/older102T1selection retain epochs. No current configured/nativeT3/T4/browser/deployed-runner proof, no Reviewer experiments/edits. C1/C2 implementation-done, leave runtime-unverified. SeparateT-1962/T-1963 confirmed outside unchanged scope. Hold released; lead may request Coordinator mode-free window at this exact head. Changed head requires new source review; no full task-head suite/provenance rerun requested.

### impl-1894 · 2026-11-18T08:12:16.892Z

Configured mode-free verify admitted once: b2ef4f6b-b91b-499d-ab6f-25e5ae292a56, reviewed head 53ed3f37b36d7f47e830580e71d0fd3d871e00f8. Coordinator window grant 8cade5f9; command `node hub/bin/cland.ts verify --report topic-1617 --to rev-36 --to impl-1894`. Clean preflight, load 1.9755859375, CLI exit 0 means submitted only. Matching run log confirms local host `tier T0: exit 0; duration 86.6 s; output tail: host check`; window released. Runtime verification remains pending; no full pass/platform/cost claim until hub result. Head stays fixed; no resubmission.

### rev-36 · 2026-11-18T08:37:14.042Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1894-final-1
commit: 53ed3f37b36d7f47e830580e71d0fd3d871e00f8
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head settlement A-21147, source basis rev-36-1894-source-3/A-21139 clear. Task-view owner records b2ef4f6b-b91b-499d-ab6f-25e5ae292a56/A-21145 finished/passed; durable owner exit0 at39758 and provenance39801 pin53ed3f37b, normalized runtime tree68a9ab6bff8f05c8bd1dda8cc343ccfa90c148fc,cached:null. Clean committed Git tree96d7bc05cb9b27bd3beddad78fb05b610d0ab3ca unchanged. Independently streamed227/227T1,430/430T2(incl44nvim),55/55Web positive base file envelopes;6735basepasses incl145nested,380loadpasses counted separately; zero typed nonpass. All34 task identities have one positive base/timing plus five distinct load pass frames and exact named5/5proof:13controller/owner,15policy,4producer,1worker publication,1uploaded-status. Complete files103/15/4/8/18 pass. C1 skip/identity summaries/cache/config boundaries and C2 stale/missing/invalid fallback positively tested through sealed fake executor/component/pure/VM seams. This is not deployed-hosting-runner/native merge-batch omission or speedup proof. T0/T1/T2/Web exit0; T3/T4 unexecuted, merge/occasion deferral retained. Linuxx64 droplet Node24.21.0/nvim0.12.5, actual HeadlessShell1248/ChromeTesting156.0.8078.4. Budget/lint/ratchet advisories report-only, including controller file wall advisory; no retry/allowance. Prior failed/local epochs remain separate; no Reviewer runtime/source changes. Standards0/Spec0; verify C1,C2 and release hold. Hub/lead owns ready/landing; approved rule6 amendment remains Coordinator-owned after landing, T-1962/T-1963 separate.

Criteria: C1 verified, C2 verified.
