---
id: T-1018
kind: task
title: Merge batches skip the typecheck on the combined tree, so two green tasks broke dev
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1193
blocked_by: []
topic: topic-928
branch: t/T-1018-merge-batches-skip-the-typecheck-on-the
created: 2026-10-20T17:30:31.804Z
updated: 2026-10-24T08:34:14.504Z
---

## Summary

Merge batches run `[merge] batch_tiers = ["T1"]` (D67) and no typecheck on the combined candidate tree. On 2026-10-20 T-979 (wire module with type-level conformance) and T-978 (adds `HubStatus.web`) each passed review and their own T0 at their own heads and landed in separate green T1 batches; the combination broke `npm run typecheck` on dev (TS2344, fixed by T-1017). Every task branch that merged dev then failed its T0.

## What to build

Every merge batch runs the T0 checks (at least `npm run typecheck` and the static lints) on the candidate tree before its tiers, and a red T0 bisects like a red tier. It is cheap (about 30 s) and catches cross-task type and lint breaks that per-branch T0 cannot.

## Acceptance criteria

- [x] C1. A batch whose candidate tree fails `npm run typecheck` is red and its members are bisected, even when its T1 tests pass (test with two members that typecheck alone but not together).
  - done: impl-1018 · 2026-10-24T07:53:19.069Z
  - verified: rev-23 [reviewer] · run rev-20261024-1018-final · 2026-10-24T08:27:06.399Z · commit c28fc37e222fabbcd8a0a815a569074610ed57e6
- [x] C2. The batch result names the T0 step with its duration, and `docs/agents/tests.md` documents it.
  - done: impl-1018 · 2026-10-24T07:44:22.354Z
  - verified: rev-23 [reviewer] · run rev-20261024-1018-final · 2026-10-24T08:27:06.399Z · commit c28fc37e222fabbcd8a0a815a569074610ed57e6

## Comments

### impl-1018 · 2026-10-24T07:30:34.890Z

TDD seams approved by the Coordinator in topic-928. Red proof: batch plan omitted check, and a TS2344/T0 receipt held the batch as 'no failing-test receipt'. Implemented mandatory check before configured tiers, timed T0 receipts for worker/host checks, additive diagnostic step selection and receipt-backed T0 bisection. Local macOS working-tree checks: npm run check green (static lint report mode, zero refusals), verification-commands 15/15 and merge-batches 37/37 T1, suite.test.ts 18/18 T3. Remaining: remote transport/demo targeted files, final dev integration and source review. No optional real-compiler regression; C1 uses the approved semantic receipt seam and the real repository command-plan assertion.

### rev-26 · 2026-10-24T07:37:13.940Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261024-1018-source-1
commit: 6e762430c279cc3e96bbf04f20b816de79c0250c
scope: full
findings: [{"severity":"high","text":"M1: A failed original T0 stops runtime tiers, but a passing T0-only omission or same-tree repeat is returned directly as the landing candidate. Suites filters steps to check when files=[], so no configured T1/T3 ever runs before landing. After diagnostic selection, require the remaining configured batch tiers on that exact candidate (or rerun its full batch plan); test both unique-green omission and passing-repeat paths with a later tier failure.","file":"hub/src/hub/merge-batches.ts","line":240},{"severity":"medium","text":"M2: Original-batch diagnosticResult is called without expected steps, so outcome.code=0 with no T0 receipt (or a recorded nonzero T0) is accepted green. The receipt-backed check is only applied to diagnostic jobs. Require the configured check's successful receipt for original/recovered batches too, and hold missing/conflicting evidence rather than landing or reporting an unobserved T0 pass.","file":"hub/src/hub/merge-batches.ts","line":157}]
finding_counts: {"high":1,"medium":1,"low":0}

Full audit complete at6e762430. Spec M1high merge-batches.ts:240: redT0 prevents runtime tiers, but T0-only green omission/repeat directly becomes landing candidate; require configured tiers/fullplan at selected exactcandidate before landing, cover both success paths with later-tier red. M2medium line157: original diagnosticResult omits expectedsteps so outcome0/noT0 or conflicting redT0 isgreen; require receipt-backed configuredcheck on original/recovered success and hold missing/conflicting proof. C1/C2 failed. No independent Standards findings: plan/wrapper/host receipt, docs/help/clauses/skills/wire changes otherwise align. Coordinator-approved T1 semantic+realcommandplan seam accepted, no realcompiler test demanded. A-10386 local/T3 partial provenance retained; preserve original commands/stdout/exits/timings as artifacts without transcription reruns. Fresh corrected-head review before verify. NoQA requirement orReviewer runtime. A-10393: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10393-t-1018-source-review-at-6e762430.md.

Criteria: C1 failed (A T0-only green omission/repeat can land without runtime tiers that original red T0 prevented from running.), C2 failed (Original/recovered batch green accepts absent/conflicting T0 receipts because expected-step proof is omitted.).

### impl-1018 · 2026-10-24T07:44:40.166Z

Source-review findings M1/M2 fixed at pushed head 322f3b6ecaa43d4ff87ee96741d62b7aeb5840f8. Added four static-diagnosis/full-confirmation T1 cases with config changes/reopen and green/red later tiers, plus two recovered missing/conflicting T0 cases. Red regressions were observed before fixes. Local macOS on corrected head: npm run check exit0 (test lint report mode, zero refusals), merge-batches43/43, verification-commands15/15. Native raw stdout/stderr/exit/timing receipts and source delta copied to A-10411, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10411-t-1018-m1-m2-raw-regression-and-committed-head-receipts. C1/C2 done again; fresh source review delivered to Reviewer before mode-free verify. No merge with dev after the first source review.

### rev-26 · 2026-10-24T07:47:29.908Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261024-1018-source-2
commit: 322f3b6ecaa43d4ff87ee96741d62b7aeb5840f8
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear at 322f3b6e/tree fa4e26d9, building on full A-10393. M1 resolved: static omission/repeat now selects a new exact-candidate full confirmation using the original recorded commands/tier selection across config reload/store reopen; later red runtime tier cannot land. Detached checkout can be recreated after diagnosis cleanup. M2 resolved: original/recovered successful batches with configured check require passing, nonconflicting T0 receipt; absent/conflicting proof holds durably. Four full-plan and two recovered-proof T1 regressions retain final assertions. Standards/docs/skills/provenance delta reviewed; no findings. A-10411 raw local corrected-head check0 (lint report-only/0 refusals), batch43/43 and commands15/15 retained; development red/green and old T3 source limits remain explicit. A-10418: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10418-t-1018-corrected-source-review-at-322f3b6e.md. C1/C2 runtime verification remains pending mode-free configured verification at this unchanged head; no current configured pass, Linux/T3/T4 or QA claim. Proceed to that run.

### rev-26 · 2026-10-24T07:52:22.043Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261024-1018-evidence-1
commit: 322f3b6ecaa43d4ff87ee96741d62b7aeb5840f8
scope: evidence
findings: [{"severity":"medium","text":"M3: Configured T1 fails the unchanged compatibility matrix: fixture configures check, actual batch plan ['check','T1'] vs expected ['T1'] at115 (A-10432 lines4773–4790). Mandatory T0 is intended; migrate the batch expectation while retaining all other occasion and no-Web assertions. This task-owned test migration blocks configured verification; T2/Web never ran.","file":"hub/test/web-phase.test.ts","line":113}]
finding_counts: {"high":0,"medium":1,"low":0}

A-10432/653d0b93 at unchanged322f3b6e exits1: actual ['check','T1'], expected ['T1'] (web-phase.test.ts115). Source M1/M2 remain corrected perA-10418, but this compatibility migration was missed by source review. Independent native counts:782ordinary tests pass/1fail,133files pass/1fail;40actual load-gate tests+40files pass. T1exit1;T2/Web/T3/T4 absent, projections notpasses. Linux x64 c-8 lon1 cland-v0-38e799e9 Node24.21/Nvim0.12.5 workers2(T1serial), lifetime156s/$0.0108. Successful hostcheck reusedtree1bfc7fd7 remotely, lint/duration/tier/ratchet diagnosticsreport-only. A-10436: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10436-t-1018-failed-configured-evidence-at-322f3b6e.md. Updateonly intended expectation with preserved final phase assertions, re-markC1done, new-head source review before fresh mode-free verify.

Criteria: C1 failed (Configured T1 fails the compatibility matrix's obsolete batch skip-check expectation; no accepted configured pass.).

### impl-1018 · 2026-10-24T07:53:35.683Z

Configured Linux run653d0b93 at322f3b6e failed T1 on the missed no-Web compatibility expectation: actual ['check','T1'], expected ['T1']; original A-10432 retained, T2/Web not executed. Fixed only expected list and added file guidance/index at pushed0e732613c193605b8ff09c72c0956bdc5134c066. Corrected-head local macOS: npm run check exit0 (lint report mode, zero refusals), web-phase8/8 and doclinks2/2 T1. Raw red/green/check outputs and exact delta A-10441, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10441-t-1018-m3-no-web-batch-expectation-native-receipts. C1 re-marked done; fresh source review routed to Reviewer before another mode-free run.

### rev-23 · 2026-10-24T07:54:15.372Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261024-1018-source3
commit: 0e732613c193605b8ff09c72c0956bdc5134c066
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1018 M3-only delta source review — clear

Head 0e732613c193605b8ff09c72c0956bdc5134c066; tree 4bbc42268b8ef2e30daab26b8443dfacef975b11. Fixed accepted-source point 322f3b6ecaa43d4ff87ee96741d62b7aeb5840f8, reviewed by rev-26 in A-10418. Comparison git diff 322f3b6e...0e732613c193605b8ff09c72c0956bdc5134c066. Three files: one expected-list correction, new per-test guidance and index entry. No implementation or post-review dev merge. Run rev-20261024-1018-source3; findings []; C1/C2 runtime pending.

## Standards

No findings. M3 is resolved: the configured-check/no-Web batch expectation is now ['check','T1'], matching the intended mandatory T0 command plan. Every other occasion, no-Web exclusion and package phase assertion remains; test identity, fixture and observation bounds are unchanged. The separate fixture with no configured check still expects ['T1','T3']. This is a specific compatibility migration, not an assertion removed to hide failure.

The new document has the exact repository test path heading/index mapping. It accurately separates candidate command plans, package phases, configured check and Web exclusion. Existing T1 classification is retained, no new process/browser. Task worktree is tracked-clean at reviewed head; diff whitespace check passes.

## Spec

No additional findings. The prior accepted source review A-10418 and full review history carry forward unchanged: M1 requires full exact-candidate confirmation after T0-only diagnosis before landing; M2 requires successful configured T0 receipts on original/recovered batches. This delta does not modify either accepted implementation, their regressions, durable plans, protocol or role/skill guidance.

Source inspection confirms pinVerificationPlan starts with configured check and independently excludes Web for batch occasions. M3 updates exactly the stale expected list that failed configured T1. C1/C2 remain unverified until new-head configured evidence is accepted; this source clearance alone is not final runtime proof.

## Evidence and limits

A-10441 contains original native logs and exact source.patch. Prior-head isolated red reproduces the configured ['check','T1'] versus ['T1'] mismatch. Corrected-head local macOS arm64 receipts show whole web-phase file 8/8, docs guards 2/2 and npm run check exit 0; raw output is retained, 132 findings / 59 files remain report-only with zero refusals. No total npm-check wall time is inferred.

Old A-10432 / 653d0b93 at 322f3b6e remains failed T1 evidence: 782 ordinary pass / one fail plus 40 passing actual load repetitions, T2/Web absent. It is not relabelled green or reused at the new head. Proceed with mode-free verification at exact 0e732613. No new Linux/T3/T4/integrated or QA proof is supplied by these local checks.

QA policy none/after-stage, no per-item brief/criteria. Reviewer performed source/Git/artifact inspection only, no tests/probes, edits, browser, merge or delegation. Both axes completed in-session. Standards: zero findings. Spec: zero findings.
Durable review A-10450.

### rev-23 · 2026-10-24T08:10:16.703Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261024-1018-evidence2
commit: 0e732613c193605b8ff09c72c0956bdc5134c066
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1018 same-head evidence audit — clear, readiness held for authorized integration

Head 0e732613c193605b8ff09c72c0956bdc5134c066; tree 4bbc42268b8ef2e30daab26b8443dfacef975b11. Run rev-20261024-1018-evidence2. Source3 A-10450 and accepted implementation review A-10418 carry forward; M1/M2 implementation and M3 compatibility correction are unchanged. Findings [].

A-10476 / configured mode-free run 4945e202-85c4-419e-9f73-d9e18c069eca reports exit 0 at this exact head, independently matched to task.verify and current task branch. Parsed native finish events: 2,794 ordinary test passes / 418 file passes, plus 40 actual load-gate test passes / 40 file passes (eight new identities, five repetitions each), zero failures/cancellations/skips. The 2,794 count excludes repetitions.

Actual completed phases: T1, fallback all T2 across hub/Neovim, and complete Web (44 files, 223 top-level tests). Linux x64 6.8.0-142-generic droplet c-8 lon1 cland-v0-e3ed54c0; Node v24.21.0, Neovim v0.12.5, workers 2 / Web runner 4. Droplet lifetime 737 s, cost $0.0512. Native suite durations 65.64 s / 376.41 s / 175.38 s; Web shard 175.23 s. Report phase envelopes (71/381/179 s) and projected walls are distinct. Host npm run check output is retained; f0bd4f03470ba4d155317aa44fba42d1b70a77d1 resolves to a tree object and is the matching candidate host-check gate, reused rather than rerun on Linux. T3/T4 were not executed; configured policy defers T3 to periodic/integrated occasions, absent batch tiers.

The new combined-T0 bisection identity passed in 0.122713595 s, with 5/5 actual repetitions max 0.237227639 s. Four full-pinned-plan confirmation cases (unique omission/passing repeat x later-tier green/red) each passed with 5/5 actual repetitions, maximum 0.33862415 s. Both recovered missing/conflicting T0-proof cases passed with 5/5 each, maximum 0.140470303 s. Timed red host-check receipt/no-droplet case passed in 0.032971551 s, 5/5 maximum 0.080289851 s. Corrected no-Web batch case passed in 0.039373134 s; all eight web-phase cases passed. No new T1 identity reaches the 0.4 s allowance threshold in this run. No affected-file tier mismatch found.

Generic duration/test-lint/ratchet diagnostics remain report-only: 132 findings in 59 files, one missing baseline, incomplete ratchet base, slow existing Web/scale identities and projected Web wall warnings. They are retained, not reclassified as enforced green budgets. Slow disk measurements (fsync 280.4 ms, SQLite 306.03 ms) are environmental observations, not evidence of an assertion failure or of a product performance guarantee. Old A-10432 / 653d0b93 remains failed historical T1 evidence.

Standards evidence: ordinary and actual repetition events confirm the approved T1 seams; no Reviewer runtime execution or delegation. Spec evidence: combined candidate T0 failure/bisection, exact-candidate full-plan confirmation and timed T0 reporting are observed at the approved semantic seam; no real compiler process or actual production batch landing is claimed.

Post-run lead reports three documentation conflicts with fetched origin/dev 4727549e, head/index/worktree unchanged. Coordinator decision 7f1a082b-6bdb-4f78-811e-071b84536b38 explicitly requests a single dev merge after the current batch lands, preserving T-1184 guidance, index entries and both README sections, followed by delta review and fresh mode-free verification. Therefore this receipt is accepted as green evidence for 0e732613 and retained as provenance; final C1/C2 criterion verification/readiness is intentionally left pending the replacement merge head. It must not be reused as exact-head evidence for that changed head.

QA policy none/after-stage. No tests/probes, browser, edits, merge or delegation by Reviewer. Both axes completed in-session; zero findings.
Durable audit A-10484.

### impl-1018 · 2026-10-24T08:13:58.716Z

Per Coordinator rule11 request7f1a082b, waited for T-1188/T-1015/T-421 to land, fetched devb49b3d91 and merged once into task headc28fc37e222fabbcd8a0a815a569074610ed57e6. Four text conflicts combined, retaining both guidance/policies and sorted index union; code auto-merged. Pushed clean. Local macOS head checks: npm run check exit0 (test lint report mode133findings/60files, zero refusals); targeted T1 batches46/46, commands15/15, webphase8/8, clauses39/39, docs2/2. Raw outputs/Git resolution diff A-10492 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10492-t-1018-dev-integration-c28fc37e-resolutions-and-native-checks. Delta source review requested; fresh mode-free verify pending source clear. Parent0e732613 green remains provenance only, with2794ordinary and40actual load repetitions separately counted.

### rev-23 · 2026-10-24T08:14:55.409Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261024-1018-source4
commit: c28fc37e222fabbcd8a0a815a569074610ed57e6
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1018 authorized dev integration delta source review — clear

Head c28fc37e222fabbcd8a0a815a569074610ed57e6; tree aa45a754db1a3a45d33c945dae88b065f10d03ad. Parents independently read from Git: accepted task 0e732613c193605b8ff09c72c0956bdc5134c066 and dev b49b3d91fc22393924c0c50a7be885cfa7f08f03. Coordinator authority 7f1a082b-6bdb-4f78-811e-071b84536b38 requested integration after T-1188/T-1015/T-421 landed. Comparison git diff 0e732613...c28fc37e plus parent comparisons and the retained native remerge-resolution.patch in A-10492. Run rev-20261024-1018-source4; scope delta. Both axes reviewed in-session.

Standards: clear, no findings. Four manual text resolutions preserve both sides: implement skill retains periodic committed-object/not-run guidance plus T0 batch procedure; merge-batches test note retains complete static proof/full-plan confirmation and T-1184 landing-race guidance; README retains integration-base versus task-head movement policy plus T0 leave-one-out/confirmation policy. Index independently contains every row from both parents, 94 rows with 94 unique rows and none missing. Test path headings/anchors and role-byte reserve remain guarded by the local checks. No conflict markers or whitespace errors in reviewed diff. Upstream documentation/roles/test changes remain attributable to the integrated dev parent rather than new task scope.

Spec: clear, no findings. T-1018 merge-batches production module, verification-plan module, verification-commands tests and web-phase tests are byte-identical to accepted task parent. Mandatory T0, passing-proof checks and pinned full-plan confirmation therefore remain intact. The auto-merged Suites changes add upstream periodic dev committed-only delivery and infrastructure not-run result recovery without changing the task's batch confirmation selection/recorded commands. Protocol/shared wire retain the upstream additive notRun marker. T-1184 regression additions retain stable FIFO landing, integration-base-move rebuild and changed-task-head drop assertions alongside all T0 regressions. No implementation conflict was manually resolved or extra task behavior introduced.

Evidence: A-10492 preserves clean committed-head local Darwin arm64 command/exit/source attribution and original native stdout. Inspected logs show merge-batches 46/46, verification-commands 15/15, web-phase 8/8, roles-clauses 39/39, test-docs 2/2: 110 targeted T1 tests, zero failures/cancellations/skips. Native file durations 9495.963416 / 3066.767209 / 1227.386250 / 271.707417 / 227.652292 ms respectively; these are file execution receipts, not per-test budgets. npm run check exit 0 is recorded, including report-only test lint 133 findings/60 files, zero refusals. No npm-check wall time inferred.

Parent A-10476 / 4945e202 remains green at 0e732613 only: 2794 ordinary tests plus 40 actual repetitions, host-check reuse and Linux T1/T2/Web evidence as audited in A-10484. It is provenance, not an integration-head pass. C1/C2 remain done and runtime unverified pending a fresh mode-free configured result at exactly c28fc37e. Source clearance permits that run; no final readiness, T3/T4 or actual batch-landing claim. QA none/after-stage.

Reviewer performed static source/Git/artifact inspection only; no tests/probes, GUI, edits, merge or delegation. Standards zero findings; Spec zero findings. Findings [].
Durable review A-10498.

### impl-1018 · 2026-10-24T08:26:50.173Z

Fresh mode-free run286a8a19 at exact reviewed c28fc37e222fabbcd8a0a815a569074610ed57e6 passed T0–T2+Web on Linux c-8 lon1: 2833ordinary passes plus40actual load repetitions (8×5) separately counted; T3/T4 outside coverage, lint/duration budgets report-only. Lifetime573s, cost$0.0398. Native A-10522 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10522-suite-286a8a19-4b81-4c45-84ea-89f6c6a0cbce-auto-at-c28fc37.log. Final fetch origin/devfd959ce7 and read-only merge-tree exit0/no conflicts; reviewed head/index/worktree unchanged. Reviewer final settlement pending; Coordinator enqueues, no self-merge.

### rev-23 · 2026-10-24T08:27:06.399Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261024-1018-final
commit: c28fc37e222fabbcd8a0a815a569074610ed57e6
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1018 final evidence review — clear

Head c28fc37e222fabbcd8a0a815a569074610ed57e6; tree aa45a754db1a3a45d33c945dae88b065f10d03ad. Run rev-20261024-1018-final. Source4 A-10498, source3 A-10450 and accepted implementation review A-10418 carry forward. Original M1/M2 proof gaps and M3 stale no-Web expectation are resolved. Findings [].

A-10522 / fresh configured mode-free run 286a8a19-4b81-4c45-84ea-89f6c6a0cbce is exit0 at this exact source-cleared merge head. Independently matched task.verify and current branch head. Parsed native finish events: 2,833 ordinary test passes / 418 file passes, plus 40 actual load-gate test/file passes (eight identities x five repetitions), zero failures/cancellations/skips. Ordinary and repetition counts remain separate.

Actual completed phases: all T1, fallback all T2 across hub/Neovim, and complete Web (44 files, 223 top-level tests). Linux x64 6.8.0-142-generic droplet c-8 lon1 cland-v0-36d024cb; Node v24.21.0, Neovim v0.12.5; workers2/Web4; lifetime573s/cost$0.0398. Native suite durations50.64/294.60/127.98s, Web shard127.88s. Phase envelopes54/299/131s and projected wall are separate measures. Host npm run check stdout is retained; gate34624b8c032403ac622900e4640b963938cd3583 independently resolves to a tree object for the matching candidate and is reused, not rerun on Linux.

C1 verified. The approved semantic MergeBatches/Suites seam observes two individually passing candidates with red combined T0, bisection and refusal after red repeat. This identity passes0.126668421s plus5/5 actual repetitions max0.175926177s. Four unique-omission/passing-repeat x later-tier green/red cases each pass with5/5, max0.295361639s; they enforce exact-candidate pinned full-plan confirmation before landing. Both recovered missing/conflicting T0-proof cases pass with5/5 each, max0.105757209s. This is controller/command-plan evidence, not a claim of running a real compiler on synthetic branches; A-10418 explicitly accepted that seam.

C2 verified. Timed red batch-host-check receipt/no-droplet case passes0.027762462s plus5/5 max0.052932157s. Reviewed production reports retain named T0 code/duration, and docs/agents/tests.md plus matching README/skills explain its placement and diagnostic/confirmation behavior. Corrected no-Web expectation passes0.040626753s. No new T1 identity in this run reaches0.4s; prior observed max0.33862415s also remains below it, so no new allowance required. No affected-file tier mismatch found.

Generic lint133 findings/60files, duration budgets, one missing baseline and incomplete-base ratchet remain report-only. Existing Web/scale and projected-wall warnings are retained; assertion-green is not enforced-budget compliance. T3/T4 were not selected; configured policy defers T3 to periodic/integrated occasions and excludes it from batch tiers. No Linux T3, full integration, actual production batch landing or QA claim.

A-10492 preserves integration-head local110 targeted T1 passes/check0; A-10441 earlier M3 native receipts, A-10411 implementation correction provenance, and original failed A-10432 remain distinctly attributed. Parent A-10476 and auditA-10484 are green provenance for0e732613 only, not reused for this head; A-10522 is the fresh replacement-head receipt.

At audit, branch remainsc28fc37e. The lead owns its required fresh origin/dev conflict check before enqueueing; if a new conflict requires another authorized integration, changed-head delta review/verification is mandatory. No new head mutation is requested by this verdict. Both C1/C2 verified at this exact head. QA policy none/after-stage. Reviewer performed static source/Git/artifact evidence inspection only, no tests/probes, edits, browser, merge or delegation. Standards zero findings; Spec zero findings.
Durable final review A-10529.

Criteria: C1 verified, C2 verified.
