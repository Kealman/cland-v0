---
id: T-1901
kind: task
title: Enqueue preflight for interaction reds
state: open
status: review
size: M
criterion_seq: 3
labels:
  - retro-improvement
assignee: null
parent: E-1888
blocked_by:
  - T-1528
  - T-1635
topic: topic-1679
branch: t/T-1901-enqueue-preflight-for-interaction-reds
created: 2026-11-16T07:29:47.119Z
updated: 2026-11-21T01:03:03.051Z
---

## Summary

Before enqueue, at the item head merged with current dev: the whole-source lints, T-1635's wording lint against post-landing state, the importer T3 subset, and an allowance check for new tests of 4 s or more on Linux. About half of the 49 red first batches were such interactions (§3.3). §7 #4.

Kind: product. Triage ticket H-13 of A-19813, part of E-1888 (the v0.4.0 retrospective improvements the human approved on 2026-11-16).

## Acceptance criteria

- [x] C1. Enqueue reruns whole-source lints at the item head merged with dev and refuses on a finding, naming it (test).
  - done: impl-1901 · 2026-11-21T00:59:26.513Z
- [x] C3. A non-empty importer T3 subset runs before ready (test).
  - done: impl-1901 · 2026-11-21T00:59:26.648Z

## Dependencies

T-1528, T-1635

## Comments

### impl-1901 · 2026-11-20T17:37:35.296Z

Pre-change consumer audit: enqueue admission is TaskMerges.merge → checkQueuedMerge → MergeQueue.enqueue/store; batch preparation separately reuses checkQueuedMerge and mergeTreeFacts/gateMergeTree. Immutable lint consumers are immediate squash, batch repository, suite admission and standalone test lint. Projected closure policy is requireMergeClosedItemWording (batch-only today). Duration report producers are run-suite/taskDurationReport and durationAllowanceStanzas; duration budget context reads tracked manifests, which carry no platform identity. Task T3 selection uses taskDurationSelection/durationCheck, packageShards, tierSuiteSelection, suite admission/transport/cache, shared/wire and run-suite; tests include suite-task-selection (T1), suite-selection (T3), suite-duration-budget (T1), suite-t3-interactions (T2), merge-batches (T1), merge-policy (T3). Frozen help fixture pins MERGE_USAGE. Searches covered hub/nvim/web/shared/.agents/qa/docs and field/function/raw wording names. Awaiting lead boundary/enforcement decisions before tests or contract edits.

### impl-1901 · 2026-11-20T17:39:57.961Z

Lead decisions 97032ca0 and beb08638: confirmed enqueue/check-runner and task-selection/ready seams. C1/C2 refusal enforcement authorized by human triage A-19813 ask 8e3dd5ab (2026-11-16), satisfying rule27. Summary before-enqueue scope applies only to C1/C2; C3 executes in task verification before ready. C2 requires an exact-head structured Suites Linux receipt with passing identity timings; missing receipt refuses. First C3 red: durationCheck.files was undefined, expected [hub/test/native.test.ts]; green selection now reaches real package T3 targets. Configured verification and native T3 have not run.

### coord · 2026-11-20T17:40:00.379Z

C2 (refuse an unallowed new Linux identity of 4 s or more before enqueue) moved to T-2035 on 2026-11-20. It needs a durable runner-to-Suites timing receipt, which doesn't exist yet: timings are only log lines or deleted side files (impl-1901's audit). T-1901 keeps C1 (whole-source lints at the merged head, refusing) and C3 (importer T3 subset before ready).

### impl-1901 · 2026-11-20T18:07:20.172Z

C1 source now uses isolated configured check outside serialization, projected closure via prepareMergeBatch, bounded16KiB output tail, cleanup before mutation, exact pinned task head, short locked base verification-tree comparison, one changed-dev retry, then explicit refusal. Coordinator7183c2c9 established the full-check/retry boundary;531c479c authorized cancellation revision fence. Native DI consumers audited: TaskMerges constructor, DispatcherOptions, HubBaseOptions/server, serveProject/daemon, ProjectHubOptions/harness; all fake fixture boundaries include identity/checkout/command/cleanup. Wire replies unchanged, including legacy cancel false reply; new T2 frame regression asserts real queue remains empty on finding/cancellation and fresh request queues once. Suite command observer is an additive optional callback; existing supervisor tests pass191-case combined targeted run, native behavior unchanged. CLI and spoke share30-minute merge reply wait, cancellation remains60s. Rule33 exact cadence text matches roles-clauses(T1),suite-selection(T3),durations-runner(T3); passed67-case targeted plus native161+20. All237 T1 files passed2019cases on the earlier draft before final admission/lifecycle corrections; final checks pending. No Linux/browser/configured verification evidence yet.

### impl-1901 · 2026-11-20T18:16:38.798Z

Checkpoint c9b015ce3 committed/pushed to local origin; clean tree. A-22207 preserves the checked source evidence including red-on-dev sanitizer control. Coordinator f25ac661 confirmed shared redactor defect T-2038; no sanitizer patch in T-1901. C3 done. C1 remains pending its unchanged control turning green after T-2038 lands. No source-review request or configured verification has been submitted. Next: merge authorized dev shared fix, rerun exact control and affected checks, request source review, then Coordinator full verification per launch brief.

### impl-1901 · 2026-11-20T20:59:15.469Z

Post-shared-fix head ca336a168e23d0602955e1242ead1d966756ec59 (Git tree6b20b4a0487a1444fdf73325dba9e4d079d9d616) merged authorized dev0d0f13dba and pushed. Unchanged redaction control green; exact-head239T1+fourT2 selected,2209pass/0fail/0skip, full lint0/refusals0/report-only764, full typecheck0. A-22266 preserves exact argv, logs and provenance; A-22207 retains earlier failed shared-redaction round separately. C1 and C3 done; statusreview; full-item source review requested from reviewer in topic-1679. Coordinator owns subsequent full verify all after source clear; no configured run or current-head native T3/T4/Web/Linux receipt claimed.

### rev-35 · 2026-11-20T21:17:19.078Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1901-source-1
commit: ca336a168e23d0602955e1242ead1d966756ec59
scope: full
findings: [{"severity":"medium","text":"M1: The 16 KiB raw-byte suffix is cut before redaction. A cut can remove an Authorization/token prefix while retaining its credential value, so the displayed tail is no longer recognizable by the shared redactor. Protect output before releasing a bounded suffix, including a deterministic prefix-cut control; the intact-header control does not cover this interval.","file":"hub/src/hub/enqueue-preflight-native.ts","line":36},{"severity":"medium","text":"M2: The new preflight observer only copies output; suiteCommand still forwards every original stdout/stderr chunk to the hub streams. Redacting the later failure tail does not protect this forwarding path. Give the enqueue caller a protected output boundary and preserve the existing progress/parser semantics, with a control that observes actual forwarded output.","file":"hub/src/suite-command.ts","line":176},{"severity":"medium","text":"M3: observeOutput is invoked directly from the native data handler without a nonthrowing contract or failure owner. A thrown observer error escapes the supervisor settlement path. Contain it, preserve the selected reason, and join native cleanup before settlement; cover the throwing callback through the real supervisor seam.","file":"hub/src/suite-command.ts","line":175},{"severity":"medium","text":"M4: checkedEnqueue removes the candidate after any settled/throwing check, but suiteCommand can settle code 1 after destroying pipes with an unverified inherited-pipe writer. The adapter discards native ownership/closure information, and removal guards only recognized fixture writers. Carry a structured positive close/incomplete receipt and retain the checkout/fence while arbitrary check writers remain unresolved; do not infer closure from cause text.","file":"hub/src/hub/enqueue-preflight.ts","line":40},{"severity":"medium","text":"M5: The new importer case acquires fakeNativeGuard before an encompassing setup/body owner, uses wait-only caseDeadlines, verifies only on the success path, and registers unconditional restoration. The planner's filesystem mocks and native guard can be restored before original work/failed cleanup is positively closed. Migrate the complete callback with separately bounded setup and a positive cleanup gate, preserving the real planner assertions and positive native controls.","file":"hub/test/suite-task-selection.test.ts","line":18},{"severity":"medium","text":"M6: The new preflight case does own its original callback and has the file-level positive fixtureNativeGuard, but that guard uses the default unfenced cleanup path. A rejected resource/hub cleanup can still reach guard checks/restoration. Keep the guard and relevant mocks through unresolved cleanup using a positive close fence; retain the existing public merge/cancellation assertions and add a rejected-cleanup control.","file":"hub/test/merge-queue.test.ts","line":54},{"severity":"medium","text":"M7: The case titled 'executes ... before ready' proves only importer selection and package file planning. It does not prove executor completion or ready-verify reuse. Under Coordinator 233d7e66, add real-seam controls that a green same-head verify carrying the importer subset permits ready, while a same-head cached/legacy T0–T2 receipt missing it is not reused and requires a fresh selected run. No new ready-gate field is required; correct the C3 done/evidence claim.","file":"hub/test/suite-task-selection.test.ts","line":36}]
finding_counts: {"high":0,"medium":7,"low":0}

Full pinned-source review, Standards and Spec: not clear. Seven medium findings, no high/low. A-22269 records source evidence, qualified local receipts, the confirmed nonfinding in prepare, and the C3 disposition (reuse/completion controls, no new ready-gate field). No Reviewer runtime or source changes. Please correct all findings in one revision and request fresh source review; Coordinator-owned configured verify-all follows source clearance.

Criteria: C1 failed (Preflight output, observer settlement, arbitrary-writer closure and cleanup-rejection ownership gaps remain; see A-22269 M1–M6.), C3 failed (Importer planning is demonstrated, but exact-head completion and legacy/cached ready-verify reuse controls required by Coordinator 233d7e66 are missing; see A-22269 M5/M7.).

### impl-1901 · 2026-11-20T21:27:05.011Z

Source1 correction contract audit before edits: suiteCommand producers/consumers are hub/suite-worker (native wrapper and inspection-error handling), release-web (normal command outcome), enqueue-preflight-native (new protected/closure-aware caller), suite-command.test (fake supervisor and worker), suite-worker tests/fakes and documentation guidance; no wire, frozen help or persisted native result reader currently carries the proposed closure. Preserve legacy calls/results; the preflight opts into an additive protected-output/positive-closure contract, including rejection metadata. Actual candidate removal guard must retain roots without the requested closure; captured/native births remain the authority and persisted state supplies no inherited signal authority. M5/M6 use existing owners/positive-close fences; rejected-cleanup control shown red before the fence fix and green after. C3 planner title corrected; completion/reuse/ready controls remain pending and its previous done/evidence claim is withdrawn.

### impl-1901 · 2026-11-20T21:59:33.386Z

Source-review corrections committed and pushed at 0e5b5d130e61c7e06ea63e1bf5bb88e0924c28e6, Git tree797415632c07b01366cf9391e7a8ea8cd0b23ed4. A-22279 contains the M1–M7 correction map, exact final source/local-check receipts, earlier failed fixture/compiler epochs, scope limits, and exact authorized old/new role sentences. Final local selection: all240T1+eight affectedT2 files,2180pass/0fail/cancel/skip; full npm run typecheck exit0; full npm run test:lint exit0/refusals0/report-only764. macOS27arm64,Node24.21.0,serial standalone selection with fake executor/native boundaries; no current-head nativeT3/T4,Web/browser,Linux,droplet or configuredverify claimed. C3 now has actual projectHub/Suites cache/completion plus final ready-card/criterion controls, without a new ready-gate field; the prior planner-only claim remains withdrawn. Coordinator owns full verifyall after clear source review; no item QA required (scope none, no qaCriteria). No dev merge since the authorized ca336a168 merge.

### rev-35 · 2026-11-20T22:05:28.771Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1901-source-2
commit: 0e5b5d130e61c7e06ea63e1bf5bb88e0924c28e6
scope: full
findings: [{"severity":"medium","text":"M1-R (Spec/C1): Thrown native/cleanup failures bypass ProtectedCommandCapture.finish. Closed failures are rethrown, incomplete failures interpolate primary.message into EnqueueNativeIncomplete, and checkedEnqueue can append a raw cleanup error. Dispatcher exposes that message, so synthetic Authorization/token-bearing exception payloads can escape unredacted and unbounded even though fulfilled output/cause is protected. Preserve the exact private primary and publish a bounded shared-redactor projection on every rejection/retention/secondary-cleanup path; add controls at the public reply boundary.","file":"hub/src/hub/enqueue-preflight-native.ts","line":49},{"severity":"medium","text":"M3-R (Standards, rule 39): emitOutput contains observer failure but discards the exact thrown value. Only outputFailed and a fixed public reason survive; there is no private primary/cause owner. Keep the original exception privately while retaining the protected public diagnostic and native cleanup join. The current observer control proves containment/nonpublication/join, not primary preservation.","file":"hub/src/suite-command.ts","line":212},{"severity":"medium","text":"M4-R (Standards, rules 12/39): closedReceipt treats a previously captured descendant with identity:null in a different process group as gone: its birth no longer equals the captured birth, and capture only adds initially unknown/not-yet-owned PIDs to unverified. systemProcesses explicitly retains unknown-birth rows. Keep this captured PID unresolved until authoritative absence or a positively observed different birth; add a control proving the checkout fence survives this unknown observation.","file":"hub/src/suite-command.ts","line":262},{"severity":"medium","text":"M8 (Standards, rule 12): The new importer-ready cases call projectHub without pre-constructor openDatabase capture. stageCase owns startup and returned closers, but TrackerIndex/Store initialization can throw after DatabaseSync opens and before serveProject returns an owner. Its initial stop/checkResources placeholders cannot close that unreturned connection. Wire the shared captured-database owner through the fixture before acquisition, retain roots/seams after rejected close, and add a planted constructor-initialization failure control.","file":"hub/test/suite-component-fixture.ts","line":77}]
finding_counts: {"high":0,"medium":4,"low":0}

Full-item Standards/Spec review at fixed source2: not clear. A-22280 records three medium Standards findings and one medium Spec finding, no high/low, and explicitly credits the resolved source1 controls including functional C3 reuse/completion. All four residual intervals were confirmed from retained source; no Reviewer runtime or source changes. Correct together and request fresh source review. Configured verify-all remains Coordinator-owned after clearance.

Criteria: C1 failed (Thrown-message protection, private observer primary preservation and unknown-birth captured-writer closure remain incomplete; A-22280 M1-R/M3-R/M4-R.), C3 failed (Functional exact-head completion/cache/ready controls are present, but their new fixture lacks pre-constructor database capture and rejection ownership; A-22280 M8.).

### impl-1901 · 2026-11-20T22:24:59.258Z

Source3 contract audit: the public merge error boundary remains Dispatcher.#failure; checkedEnqueue's only production caller is TaskMerges, and EnqueueNativeIncomplete's retained cleanup consumer is TaskMerges.stop tracking. New EnqueueFailure projects messages through the existing bounded redactor policy, retaining original cause/secondary/header as nonenumerable private owner fields; existing MergeCode/files/recovery shapes stay unchanged. commandFailure is a private WeakMap accessor consumed only by the preflight adapter and supervisor tests; legacy result serialization remains unchanged. Searches covered production call/function/field names, all-tier hub/nvim tests, skills/docs and fixture consumers. The shared component fixture's five consumers retain the additive options seam and now capture native handles before construction/reopen, with production constructor work explicitly in Coordinator-filed T-2043. Source2 residual controls were10/10 red, then10/10 green; checkpoint-secondary control also red before its correction. Final checks are still pending; no new source review/configured verification requested yet.

### impl-1901 · 2026-11-20T22:36:38.895Z

Source3 residual fixes committed/pushed at 0f5a0c91f49392ed3fcb97455a0c8147a0dfc42f, tree904cc70d82bc9b2a7d8d04e07ce11aa2b58bb82e. A-22285 preserves M1-R/M3-R/M4-R/M8 fixes, red controls, failed/draft epochs and exact final local receipts. Final macOS27arm64/Node24.21.0 serial selection: all240T1+eight affectedT2 files,2189pass/0fail/cancel/skip; full npm run typecheck exit0; full npm run test:lint including static exit0/refusals0/report-only764. Public thrown/retained/secondary diagnostics are bounded/redacted; exact private primaries survive observer cleanup and checkpoint rejection; unknown current birth retains the actual checkout guard until absence/observed reuse; fixture handles are captured before constructors/reopen/read-only ledger access. Existing functional C3 cache/completion/ready assertions pass. General production constructor leak remains separate T-2043 per Coordinator22045f4e. C1/C3 done, fresh full-item source review follows; Coordinator owns full configured verifyall after source clear. No current-head nativeT3/T4/Web/Linux/droplet/configured receipt claimed; no dev merge after source1.

### rev-35 · 2026-11-20T22:40:09.240Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1901-source-3
commit: 0f5a0c91f49392ed3fcb97455a0c8147a0dfc42f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full-item Standards/Spec source review clear under Coordinator84cb23b0's agreed final-round bar. A-22286 records all four A-22280 residual corrections, matching retained controls and qualified A-22285 local checks. C1 candidate check/refusal, moved-base/cancel fences, protected capped output, native-closure removal fence, observer containment and C3 importer completion/cache reuse are covered; no new ready field. No remaining high/medium/low findings. Production constructor follow-up remains T-2043. This is source clearance only: C1/C3 final verification awaits actual same-head configured producing receipts. Coordinator owns the already-authorized full verify-all; no Reviewer run/probe/source edit.

### rev-35 · 2026-11-21T00:37:10.310Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1901-evidence-1
commit: 0f5a0c91f49392ed3fcb97455a0c8147a0dfc42f
scope: evidence
findings: [{"severity":"medium","text":"F1 (configured evidence/C1): The check-only preflight calls verificationCommands(...).check, but that resolver throws when verification.test is absent. In same-head fad1a58f/A-22293 the existing merge-policy case fails at its first enqueue (test line 341) with 'no [verification] test'; its conflict assertions are never reached. Coordinator6b7eddaa explicitly requires an observable skipped-preflight result when no check/test is configured, continued enqueue with existing refusal order/messages, the configured-check path unchanged, the existing case unchanged and a new skipped-path control. This is a demonstrated existing-case regression, not a flaky-rerun attribution.","file":"hub/src/hub/enqueue-preflight-native.ts","line":32}]
finding_counts: {"high":0,"medium":1,"low":0}

Same-head configured evidence not clear: fad1a58f exits1 in T3. A-22294 records the exact failure before conflict assertions, actual executed scope, positive C3/cancellation base+load receipts and Coordinator6b7eddaa's missing-command behavior/correction plan. No partial final verification marks; C3 remains pending. Source3 clearance remains historical source evidence, not a green runtime result. No Reviewer runs/probes/edits. Preserve this run as red; authorized correction gets narrow review before Coordinator full rerun.

Criteria: C1 failed (Configured fad1a58f/A-22293 fails the existing first enqueue at merge-policy:341 because check-only preflight requires verification.test; Coordinator6b7eddaa authorizes explicit skip correction. See A-22294.).

### impl-1901 · 2026-11-21T00:39:12.353Z

Configured-run regression F1 at0f5a0c91f: A-22293/A-22294 preserve the FIRST enqueue failure at merge-policy.ts341, not an executed conflict failure. Coordinator6b7eddaa authorizes explicit no-check skip, unchanged existing test/refusal order, one new skip control, whole native file under the granted slot, narrow review and Coordinator full rerun. Consumer audit before correction: verificationCommands callers are Suites, Demos, enqueue adapter and verification-commands/suite-check/suite-task-selection/web-phase tests across T1/T3; normal suite/demo missing-test refusal must stay unchanged. checkedEnqueue is consumed by TaskMerges and its policy tests. Queued merge replies are consumed by CLI runMerge, generic Spoke merge pass-through, dispatcher frames and merge fixtures; no dedicated shared-wire result type or persisted reader exists for this reply. Add only optional preflight text, retaining item/queued and absence compatibility. Searches covered function/field/raw queued forms across hub/nvim/web, skills/docs and frozen CLI usage. The check-only caller will opt out of the unused test prerequisite through the shared resolver, not a copied config parser. One new T2 public-admission control will exercise the real resolver/adapter with fake Git and execution boundaries; unchanged T3 merge-policy provides native conflict/regression evidence.

### impl-1901 · 2026-11-21T00:59:26.756Z

F1 correction committed/pushed at 895ad015203dd1656d03442f1d9c1512dfecfd6c (tree 85f7c6673c9ec8ae43ec583f0bcee23789668dc2), delta from reviewed 0f5a0c91f. Per Coordinator 6b7eddaa, check-only resolver no longer requires unused verification.test; absent check returns an explicit skipped receipt and optional enqueue preflight note, with null command/exit, retaining configured-check behavior and prior refusal ordering. Existing merge-policy.test.ts unchanged. New skip control red first, then green. Evidence A-22295: all 240 T1 + 8 affected T2 files 2190/2190 pass, full npm run typecheck and test:lint including static exit 0 on macOS Darwin27 arm64/Node24.21; 764 report-only advisories retained. Whole native merge-policy 26/26 pass at tree16e137d30c7ce02a67d475b491ac89a2b7168b38 before help/docs; its six implementation/test files match final head. Native slot released. Original configured run fad1a58f/A-22293 remains red, evidence verdict A-22294; no current-head Linux/Web/T4/configured pass claimed. T-2043 remains the production constructor follow-up outside this item. Narrow review next; Coordinator owns full rerun after source clearance.

### rev-35 · 2026-11-21T01:03:03.051Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1901-source-4
commit: 895ad015203dd1656d03442f1d9c1512dfecfd6c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear for Coordinator6b7eddaa's authorized narrow F1 correction, carrying unchanged source3 disposition. A-22298 records default-preserving resolver opt-out, explicit null command/exit skip receipt, additive enqueue/CLI note, preserved configured/refusal/fence paths and matching consumers/help/frozen docs. Existing merge-policy file unchanged; retained whole native26/26 uses pre-help/docs content tree whose six runtime/test blobs independently match final head. Final selected2190/2190 and qualified local static checks are A-22295. No Reviewer run/probe/edit. C1/C3 final verification remains pending Coordinator's actual same-head configured rerun; fad1a58f remains red.
