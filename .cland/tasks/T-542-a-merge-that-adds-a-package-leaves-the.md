---
id: T-542
kind: task
title: A merge that adds a package leaves the root checkout without it, and the next root-run typecheck fails
state: open
status: review
size: S
criterion_seq: 3
labels:
  - bug
  - hub
  - ready-for-agent
assignee: null
parent: E-1193
blocked_by: []
topic: topic-929
branch: t/T-542-a-merge-that-adds-a-package-leaves-the
created: 2026-10-15T21:42:23.476Z
updated: 2026-10-24T08:16:20.609Z
---

## Summary
T-427 merged at 21:28Z (bd2fdba4). It switched the typecheck script to `typescript7@npm:typescript@7.0.2`. `cland merge` doesn't install dependencies, so the root checkout's `node_modules` had no `typescript7`. The next root run, E-387's stage close 02c7cfc7 at 21:40Z, failed in 9 s with "host typecheck failed (exit 1); no droplet created", and a `MODULE_NOT_FOUND` showed in the log. Task worktrees resolve `node_modules` from the root, so every implementer's typecheck after rebasing on dev would fail the same way. The Coordinator recovered with `npm install` in the root, which left the lockfile unchanged.

## Acceptance criteria
- [x] C1. When a merge changes `package.json` or `package-lock.json`, the root's dependencies are brought up to date (an incremental install that doesn't remove packages a running hub may load), or the merge report names the install as required.
  - done: impl-542 · 2026-10-24T07:57:07.047Z
  - verified: rev-26 [reviewer] · run rev-20261024-542-final-1 · 2026-10-24T08:12:12.006Z · commit 429165999efae93962d52d84a36ef3f92d837bff
- [x] C2. A host typecheck that fails with MODULE_NOT_FOUND for a dependency named in the lockfile reports "dependencies out of date: run npm install", not just exit 1.
  - done: impl-542 · 2026-10-24T07:32:19.602Z
  - verified: rev-26 [reviewer] · run rev-20261024-542-final-1 · 2026-10-24T08:12:12.006Z · commit 429165999efae93962d52d84a36ef3f92d837bff
- [x] C3. `task claim` leaves a new task worktree resolving the root's dependencies (playwright-core included), or links them, and the report names a stale worktree install (test).
  - done: impl-542 · 2026-10-24T07:38:30.667Z
  - verified: rev-26 [reviewer] · run rev-20261024-542-final-1 · 2026-10-24T08:12:12.006Z · commit 429165999efae93962d52d84a36ef3f92d837bff

## Comments

### coord · 2026-10-15T22:43:24.442Z

Second form, 22:41Z: task worktrees an implementer filled with its own `npm ci` hold their own node_modules, so a later dependency change on dev doesn't reach them either. impl-499's verify c6147dd0 at 289b3c17 failed with "host typecheck: MODULE_NOT_FOUND …/T-499/node_modules/typescript7". Worktrees without node_modules resolve the root's, which is updated. C1 should cover the worktree case too: the worktree preparation installs from the lockfile at its base, or verify checks the lockfile hash before the host typecheck.

### impl-542 · 2026-10-24T07:32:32.188Z

Implemented and pushed 6054e5aa. Required root npm install reporting replaces automatic shared-tree mutation; task prep links dependencies and reports stale installs; locked MODULE_NOT_FOUND gets an explicit install hint. Local macOS npm run check passed (lint report-only, zero refusals); targeted task-worktrees 11/11, merge-recovery 17/17, merge-queue 13/13 plus queue CLI assertion, suite-queue-policy 6/6. Details: A-10382, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10382-t-542-implementation-and-targeted-tdd-evidence.md. Source review requested from reviewer; exact-head hub verification follows clear source verdict. No per-item QA required (none/after-stage).

### rev-23 · 2026-10-24T07:35:56.659Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261024-542-source
commit: 6054e5aa6eebd0d4d7f7b1041b1645aeb5f19ec1
scope: full
findings: [{"severity":"medium","text":"M1: inspect actual installed required package artifacts/manifests, not just node_modules/.package-lock.json. Matching metadata can hide missing/old packages; add claim/reclaim controls and preserve installs.","file":"hub/src/hub/worktrees.ts","line":137},{"severity":"medium","text":"M2: do not mark valid omitted optional or inapplicable OS/CPU packages as stale. The root lock lists many platform packages absent in a healthy local install; add healthy negative controls.","file":"hub/src/hub/worktrees.ts","line":139}]
finding_counts: {"high":0,"medium":2,"low":0}

T-542 full source review — not clear

Head 6054e5aa6eebd0d4d7f7b1041b1645aeb5f19ec1; tree fe3078daa96ffb70a1b9498dec4f4a05d6545688. Fixed parent d9ffa83083f437f19f4a46c426ba83d0d828873a. Comparison git diff d9ffa830...6054e5aa6eebd0d4d7f7b1041b1645aeb5f19ec1: 27 files, 285 additions / 24 removals. Run rev-20261024-542-source.

## Standards

M1 (medium), hub/src/hub/worktrees.ts:137–140: installation metadata alone does not establish installed artifacts. The code compares the candidate lock with node_modules/.package-lock.json but never reads actual package directories/manifests. Matching metadata can therefore suppress a stale warning even if required playwright-core is missing or its actual package.json is old. A claim then returns a seemingly fresh root link/own install that cannot resolve the required dependency. Add claim/reclaim controls with matching hidden-lock metadata and missing/older actual packages; audit the installed artifacts while preserving existing installations.

M2 (medium), same lines: the expected-lock loop treats every absent package as stale, including optional entries for other OS/CPU targets and valid optional omissions. A healthy install gets false stale warnings. Independent read-only comparison of this repository lock and installed hidden lock finds 61 absent platform-specific optional entries, including Android/FreeBSD/Linux Oxlint bindings on this Darwin arm64 install. Respect package applicability/optional omission while validating advertised installed artifacts; add healthy negative controls. Do not make the M1 fix simply require every lock entry to exist.

Both accepted by the implementer; complete finding set is M1/M2 only. Existing narrow module boundaries and optional wire additions otherwise fit the design. Tests reuse existing classified component seams, scratch package trees and injected Git/host-check machinery; the CLI queue check uses the executable because its rendering is the subject. No installer/download is added. No independent smell finding.

## Spec

C1/C2 source paths otherwise look sound. Coordinator 1a5574f4 explicitly confirms the install-required-report alternative and requires queue/landing/enqueuer visibility without modifying live shared dependencies. Changed package.json/package-lock.json paths, including workspace manifests, are sorted/deduplicated. Queue entries carry optional metadata mirrored in shared/wire; CLI queue/landing rendering guards its absence. Landed squash-commit paths are reread for normal/recovered results; durable comments and Agents text retain the requirement, and batch landing emits an idempotent notice addressed to enqueuer/item lead. No npm invocation or shared tree replacement is performed.

The host-check path retains exit/no-droplet failure and appends “dependencies out of date: run npm install” only for a missing module/package represented in the candidate lock. ESM names and absolute node_modules CJS paths are handled; unknown imports and ordinary type errors are negative controls. Local/remote host-gate branches use the helper and original log output remains.

C3 links an absent worktree node_modules to root, preserves existing installs, and returns path/kind warnings through shared claim/launch preparation and plain claim output. That behavior is incomplete until M1/M2 distinguish genuinely stale artifacts from healthy platform-specific installs. C3 fails source review; C1/C2 remain runtime pending. Help, README, tracker docs, relevant skills/test notes describe this scope; clauses are unchanged.

## Evidence and limits

A-10382 reports local macOS working-tree check pass with report-only lint/zero refusals; task-worktrees 11/11, merge-recovery 17/17, merge-queue 13/13 plus the later queue CLI assertion separately, suite-queue-policy 6/6. It distinguishes the initial cover-quiet refusal from admitted red/green. These are summaries, not a configured/Linux receipt. Preserve original command/stdout/exits/timing with precise source/platform attribution without reruns for transcription; corrected checks should have separate receipts.

Task worktree is tracked-clean at reviewed head. No verification has been submitted and no per-item QA brief/criteria under none/after-stage policy. Fix M1/M2, update the matching freshness documentation, commit/push and request fresh source review before mode-free verification. Reviewer inspected source/Git/artifacts only, no tests/probes, installs, browser, edits, merge or delegation. Both axes completed in-session.

Standards: two medium findings. Spec: no separate finding; C3 blocked by M1/M2.
Durable review A-10387.

Criteria: C3 failed (Freshness trusts hidden-lock metadata without checking installed artifacts and flags valid missing optional/platform packages as stale; claim cannot reliably identify stale own/link installs.).

### impl-542 · 2026-10-24T07:37:31.860Z

Addressed review M1/M2 in dcb96064 (pushed): actual installed manifests are checked, while optional/platform omissions are allowed. Corrected-head local macOS receipt: task-worktrees.test.ts 19/19 and fresh npm run check passed (test lint report-only, zero refusals). Correction evidence A-10391: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10391-t-542-m1-m2-corrections-at-dcb96064.md. Fresh source review requested from reviewer; verification held pending clear source verdict.

### rev-32 · 2026-10-24T07:38:15.983Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261024-542-source-2
commit: dcb96064ac74df66473b0e2b8f50e8d325a1ca1e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-542 corrected source review — clear
Head dcb96064ac74df66473b0e2b8f50e8d325a1ca1e; tree 49fd1e84fe8f59567972c7a6cd0273c8d720b9e8.
Parent 6054e5aa6eebd0d4d7f7b1041b1645aeb5f19ec1. Correction comparison: git diff --no-ext-diff --no-textconv 6054e5aa...dcb96064 --; four files, 67 additions/4 removals. No intervening dev merge. This full corrected-source pass carries rev-23's accepted original source scope in A-10387 and audits the complete correction personally, without delegation.

## Standards
No outstanding findings. M1 is resolved: expected/hidden-lock metadata is followed by reading the actual installed package.json and checking its version. Missing/unreadable manifests or older actual versions produce the existing path-and-install-kind warning. The check is read-only and preserves both existing own installs and links.
M2 is resolved: optional entries omitted from the installed lock, and optional bindings inapplicable to the current OS/CPU, are allowed; advertised applicable entries still undergo metadata/artifact checks. Required missing entries remain stale.
The new T2 regression cases reuse the existing scratch-root, FakeClock, injected-territory and in-process hub fixture. Four missing/older required-package permutations exercise own/link installs with matching hidden metadata and assert preservation. Two healthy controls cover own/link installs with optional omissions. They await claim completion and assert the resulting warning/filesystem facts; no sleeps, native Git, installers, downloads or new process lifecycle are introduced.
hub/README.md now describes actual manifest checks and optional omissions; the matching per-file test note records both corrections. Original help/tracker/skills documentation remains at the accepted source. No independent smell finding.

## Spec
C1/C2 production and accepted behavior are unchanged. I also reread the original dependency helper, merge/queue/landing notice integrations, CLI formatting, host-check failure diagnosis and mirrored optional wire additions at the reviewed head. Coordinator decision 1a5574f4 permits the explicit required-install report, requires root npm install and enqueuer visibility, and forbids automatic shared-install replacement. Those source paths still match.
C3 now distinguishes the originally reported stale required artifacts from valid optional omissions while preserving installs and linking an absent worktree install to root. The original package-resolution proof remains alongside the new warning controls.
No new spec findings. All C1–C3 execution-dependent verification remains pending the post-source mode-free receipt at this exact head. The tracker currently retains the earlier C3 failed mark; the claimant must restore its done mark after addressing that finding. No verified criterion is claimed by this source pass.

Evidence: A-10391 explicitly attributes corrected task-worktrees 19/19 and npm run check to the local macOS working tree immediately before this commit, with test lint report-only/zero refusals. It is a summary, not an original raw/configured/Linux receipt; other-file executions remain attributed to 6054e5aa. Preserve retained original tool receipts with exact provenance without rerunning solely for transcription. No configured verification has yet run at this corrected head. QA policy none/after-stage, no per-item QA criterion.
Reviewer performed source/Git/document/artifact reads only; no tests, probes, edits, installs, browser actions or merge.
Standards: 0 outstanding findings. Spec: 0 outstanding findings.
Durable audit A-10396: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10396-t-542-corrected-source-review-at-dcb96064.md

### rev-32 · 2026-10-24T07:42:28.979Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261024-542-evidence-1
commit: dcb96064ac74df66473b0e2b8f50e8d325a1ca1e
scope: evidence
findings: [{"severity":"medium","text":"M3: real TaskMerges batch composition lacks the new landed-commit diff-tree Git fact; FIFO landing assertion fails actual [] vs T-1/T-2/T-3. Supply the immutable fact at the injected seam, retaining all landing/receipt assertions.","file":"hub/test/merge-batches.test.ts","line":448}]
finding_counts: {"high":0,"medium":1,"low":0}

T-542 final evidence review — not clear
Reviewed head dcb96064ac74df66473b0e2b8f50e8d325a1ca1e; tree 49fd1e84fe8f59567972c7a6cd0273c8d720b9e8.
Run 273963b9-f207-4bb5-927f-3ba774da5c4b, original log A-10405.

Actual failure, before classification: hub/test/merge-batches.test.ts:491 reports “AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal”; actual [] versus expected ['T-1', 'T-2', 'T-3'], in “three queued heads run once on a single candidate before landing FIFO” (log lines 4443–4463).

## Standards
M3 (medium), hub/test/merge-batches.test.ts:448: the immutable Git facts used by the real TaskMerges composition have not been extended for this item's new landed-commit diff-tree read. The fixture returns null for diff-tree and its native-boundary wrapper asserts that every Git fact is supplied (lines 470–474). TaskMerges now catches that missing fact as an incomplete dependency report (hub/src/hub/merge.ts:250–254), so the test's landing boundary cannot complete. This source trace explains the observed empty FIFO landing list; this is a fixture-composition regression, not evidence that native Git itself fails. Add the exact immutable landed-commit path fact at the existing injected seam, retaining the no-before-green, FIFO, receipt and closed-item assertions. No production fallback that hides Git errors or relaxed assertions is warranted.

## Spec
C1 cannot clear: the required dependency-report path breaks the existing real merge/finishMerge batch proof. It must coexist with successful queued landing. C1 failed pending correction and fresh source review/verification. C2 and C3 remain unverified: their T2 files did not execute in this run. Earlier M1/M2 remain source-resolved; no new evidence contradicts their corrections.

Evidence limits: Linux x64 6.8.0-142-generic, c-8 lon1 droplet cland-v0-29dfefc3, Node v24.21.0 / Neovim v0.12.5, workers 2. Overall exit 1. T1 exited 1: 775 reported tests, 774 passes/1 failure, zero skipped/cancelled/todo. The file-plan aggregate (773) is separate from executor counts. T1 command duration 50s, measured shard duration 46.43s. T2/Web did not run; T3/T4 absent/deferred, not passes. Typecheck reused host gate 6841495b0cb4028a000d8647430808cb5b5c9bd3, not repeated on droplet. Generic lint/duration/ratchet policy report-only; one missing baseline. Projected later phase timings are not observed runtime. No passing overall or load-gate claim.
Fix at the existing seam, commit/push, and request fresh source review before another mode-free run. Reviewer performed read-only source/log audit, no tests, edits, browser, installs or delegation.
Standards: one medium finding. Spec: C1 blocked by that integration regression; C2/C3 unverified.
Durable audit A-10407: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10407-t-542-failed-same-head-evidence-at-dcb96064.md

Criteria: C1 failed (Same-head T1 batch landing regression fails FIFO actual [] vs T-1/T-2/T-3; new dependency-report diff-tree read lacks an injected Git fact.).

### rev-32 · 2026-10-24T07:45:00.521Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261024-542-source-3
commit: 2b17007cfe8eb4b50822cb40c2e94819c4a2ed46
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-542 corrected source review — clear
Head 2b17007cfe8eb4b50822cb40c2e94819c4a2ed46; tree df81c470a59cb1f4550434162ab513e46312b331; sole parent dcb96064ac74df66473b0e2b8f50e8d325a1ca1e. Three-file correction, no dev merge. Carries accepted source from A-10387/A-10396.

## Standards
No findings. M3 resolved at hub/test/merge-batches.test.ts:446: injected Git now supplies the immutable landed parser path for diff-tree. The real TaskMerges composition retains its failure behavior for other absent Git facts. Both modified assertions add diagnostic messages only; no-before-green, FIFO order, one-suite, receipt SHA, closed-item, report and controller-cleanup assertions remain unchanged. No timing, process, installer or production code changes. The new per-file documentation and index describe the precise fixture seam and retained assertions.

## Spec
No outstanding findings. C1's landing proof can now consume the new dependency-report read without suppressing native errors. C1/C2/C3 product behavior is unchanged from the source reviewed at dcb96064; M1/M2 stay resolved. All three claimant done marks are current. All execution-dependent criterion verification remains pending a fresh post-source mode-free receipt at this exact new head; no criterion verified by this pass.

A-10410 distinguishes the earlier failed Linux run 273963b9/A-10405 from new local macOS correction checks: single test, 36/36 full merge-batches file and npm run check passed on the precommit tree; report-only test lint/zero refusals. This is summarized supplemental evidence, not a green configured/Linux receipt. Failed historical evidence remains failed/partial. Preserve original tool output provenance, without reruns for transcription.
Reviewer read source/Git/docs/artifact only, with no tests, edits, installs, browser or delegation. Both review axes completed in-session. QA scope none/after-stage.
Standards: 0 outstanding findings. Spec: 0 outstanding findings.
Durable audit A-10412: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10412-t-542-m3-corrected-source-review-at-2b17007c.md

### rev-32 · 2026-10-24T07:53:57.723Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261024-542-evidence-2
commit: 2b17007cfe8eb4b50822cb40c2e94819c4a2ed46
scope: evidence
findings: [{"severity":"medium","text":"M4: shared T2 TaskMerges fixture leaves native Git uninjected; new diff-tree read invokes real Git against scratch nonrepository and fails nine plan/stage landing assertions. Inject immutable landed paths at that boundary and retain all final assertions.","file":"hub/test/plan-stage-fixture.ts","line":165}]
finding_counts: {"high":0,"medium":1,"low":0}

T-542 final evidence review — not clear
Exact source-reviewed head 2b17007cfe8eb4b50822cb40c2e94819c4a2ed46; tree df81c470a59cb1f4550434162ab513e46312b331. Run f4a5bb3a-c6f8-46ee-a57c-a76293c25eaa, raw log A-10437.

Actual failure before classification (A-10437:12616): “merged, follow-up failed: dependency report: git diff-tree --no-commit-id --name-only --no-renames -r -z 0000000000000000000000000000000000000002 --: fatal: not a git repository”; assertion false !== true at plan-gate.test.ts:62. The same dependency-report failure appears in planned-stage.test.ts:150 and :269. Nine failures total across the two files (including the plan override/QA test at plan-gate:104).

## Standards
M4 (medium), hub/test/plan-stage-fixture.ts:165: the shared T2 fixture injects verdict Git but leaves the TaskMerges native Git argument undefined. This item's new landed-commit diff-tree read therefore invokes real Git against the scratch nonrepository. The log's report-only tier mismatch confirms child_process.execFile from merge.ts:250 through this helper. This is another fixture composition missed when adding the read, not an external platform failure.
Wire the existing immutable PlanGit model through the native Git boundary as well, respecting the requested no-commit-id/NUL path format and failing unexpected facts. Preserve every ready-vs-merge, QA gate, stage advancement, persisted receipt, close-frame and fixed-query-budget assertion. Do not run native Git or weaken production reporting to accommodate the fixture.
Read-only census found only three TaskMerges constructor sites in hub/test: this helper, corrected merge-batches and merge-component-support. The last already injects facts. The Implementer independently reports the same local reproduction and census; these remain supplemental local evidence, not a replacement configured pass.

## Spec
C1 fails again because the dependency report prevents the existing stage/plan landing proofs from completing. M1/M2 remain source-resolved and M3 now passed in T1; M4 is the remaining observed blocker. C2/C3 receive no verification mark from this failed/partial overall run. Fresh source review is required after the fixture change, before another mode-free run.

Evidence: Linux x64 6.8.0-142-generic c-8 lon1 droplet cland-v0-74f5a2b0, Node v24.21.0/Neovim v0.12.5, workers2; overall exit1. T1 exit0 (56s command, 51.99s shard); hub T2 exit1 (235s command, 231.93s shard). Neovim/Web did not execute; T3/T4 deferred/unrun. Completed counts including load repetitions: 2293, 2284 pass/9 fail; ordinary printed aggregate: 2183, 2174 pass/9 fail. They are different aggregates, not two successful receipts. No skip/todo, base cancelled0. Typecheck host gate 22c780a2cacc31ad90fd491b4b4c12c7d1e86f04 was reused, not remotely repeated. Generic timing/lint/ratchet/tier diagnostics report-only; one missing baseline. Later phase projections are not runtime. No suite pass claimed.
Reviewer read source/logs only; no tests, edits, installs, browser, merge or delegation. qaPolicy none/after-stage.
Standards: one medium finding. Spec: C1 blocked by this integration regression; no final criterion verification.
Durable audit A-10446: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10446-t-542-stage-fixture-failure-at-2b17007c.md

Criteria: C1 failed (Same-head T2 plan/stage landing fails nine assertions: dependency-report diff-tree escapes uninjected native Git boundary and reports not a git repository.).

### rev-26 · 2026-10-24T07:56:12.752Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261024-542-source-4
commit: dd8ddb167e44c6683c385dc83912886dbb468ce1
scope: delta
findings: [{"severity":"medium","text":"M5: New indexed helper note heading is '# hub/test/plan-stage-fixture.ts', but test-docs.test.ts requires every indexed heading to match a .test.ts path and corresponding document/index row. This new entry deterministically fails the T1 guard. Move guidance into a consumer .test.ts note/index (e.g. planned-stage), retaining the guard.","file":"docs/agents/tests/hub-test-plan-stage-fixture.ts.md","line":1}]
finding_counts: {"high":0,"medium":1,"low":0}

Complete delta audit atdd8ddb16/tree6e986e69 from2b17007c: M4PlanGit/nativeGit injection resolved; --no-commit-id respects raw path format and older commit-prefix consumers remain. No existing assertion/timing/product changes, no devmerge. Carry accepted source A-10387/A-10396/A-10412; M1/M2/M3 remain resolved. Only new findingM5medium docs helper-index contract; C1failed,C2/C3runtimepending. A-10453 preserves failedLinuxA-10437 and separately summarizes precommitlocal9+12+15/check0, notraw/exact-headconfiguredproof. Preserve original stdout/exits/native timing/source limits without transcriptionreruns. A-10457: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10457-t-542-m4-correction-review-at-dd8ddb16.md. Correctdoc/index, re-markC1done, freshsource beforemode-freeverify; noprerun atthishead. Nootherdeltafindings.

Criteria: C1 failed (The M4 correction adds an indexed helper note that cannot satisfy the existing .test.ts heading guard, blocking configured verification.).

### rev-26 · 2026-10-24T07:57:42.315Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261024-542-source-5
commit: 429165999efae93962d52d84a36ef3f92d837bff
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear at42916599/treed8c4d18f. M5resolved: helper guidance moved to planned-stage.test.ts consumer note/heading/index; docs guard unchanged. Documentation-only delta fromdd8ddb16, no devmerge. M4resolved source assessment A-10457 and accepted product/M3 reviews A-10387/A-10396/A-10412 carried; no findings. A-10461 original local macOS working-tree stdout/exits/native timings inspected:9plan-gate+12planned-stage+15epic-close, plus docs2/2 on later doccorrectiontree; not relabelled exactnewhead. Check excerpt explicitlypartialstdout/exit0/lintreport132/59/0refusals, not totalwallproof. HistoricalA-10437 remainsfailedpartial. A-10462: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10462-t-542-corrected-documentation-at-42916599.md. AllC1/C2/C3 remainpendingfreshsame-headconfiguredreceipt; proceedmode-freeverify. No currentconfiguredgreen/T3T4/Linux/QAclaim.

### rev-26 · 2026-10-24T08:12:12.006Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261024-542-final-1
commit: 429165999efae93962d52d84a36ef3f92d837bff
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final C1/C2/C3 clear atunchanged42916599/treed8c4d18f, accepted source A-10387/A-10396/A-10412/A-10457/A-10462 carried and criterion paths/tests reread. A-10485/f6b6b5b9 exit0: independently parsed2808ordinary/418file passes; load110testfinishes =40top-level repetitions(8identities×5)+70nested,40files pass; nofail/cancel/skip. C1package/lock/workspacechanges name rootnpm install in responses/notices/comments/recovery/queue, sharedreader intact. C2lock-backed missing-package hints and negative controls/no-machine pass. C3Playwright resolution/rootlink, staleown/link/artifact/optionalomission controls pass. FIFO/stage/plan/docs repairedproofs pass; noassertionrelaxation. Newtoploadmax0.905245s belowallowancetrigger. T1/allfallbackT2hub+Neovim/Webexit0 Linuxc8lon1 cland-v0-4d8efb91 Node24.21/Nvim0.12.5 workers2(Web4),736s/$0.0511. Hostcheckstdout/0refusals, remotereusedf33c9188tree/notrepeated. Lint132/59,duration/tier/ratchetreport-only, Web175.14s suite/175s shard>40sreportbudget/1missingbaseline retained. NoT3T4/afterstageQAclaim; oldfailures/localprovenancelimits retained. A-10486: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10486-t-542-final-evidence-at-42916599.md. No findings.

Criteria: C1 verified, C2 verified, C3 verified.

### rev-32 · 2026-10-24T08:16:20.609Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261024-542-merge-source
commit: 9c368b0a932ceb9b386a385e597a2eba29b4d1c0
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-542 authorized merge delta source review — clear
Head 9c368b0a932ceb9b386a385e597a2eba29b4d1c0; tree 414134c9b166d4e9140808f36b38b2a2dfcda56d. Parents 429165999efae93962d52d84a36ef3f92d837bff (reviewed task) and fa47bbb4351367584fa3309ac9b9b5b47872190b (incoming dev); merge base d9ffa83083f437f19f4a46c426ba83d0d828873a. Coordinator f5f55ffd explicitly requested this merge, combined notes and retained cases before fresh review/verify.

## Standards
No findings. Read-only three-way blob audit: 12 task-only paths exactly preserve the task parent, 62 incoming-only paths exactly preserve dev, and no changes occur outside either parent's changes. Reviewed the 19 shared nontracker paths against both parents.
Conflict resolution in merge-batches keeps upstream queuedLanding's stable/dev/task movement cases and refusal routing, while retaining T-542's immutable diff-tree path fact and failure diagnostics. All no-before-green/FIFO/receipt/closed-item/controller assertions remain. PlanGit injection and its no-commit-id path formatting remain exactly as accepted after M4. T-421 planned-stage cases are incoming-only/exact.
Both add/add per-test notes retain each side under one valid test heading. Index links are deduplicated, not removed. Skill instructions/change entry, README, tracker docs and usage retain both T-542 and upstream changes.
Shared source merges are complementary: queue/result/landing dependency notices survive T-1184's head/base movement guards; dispatcher preserves both dependency notice and base-race rebuild routing; merge CLI retains dependency rendering and T-1188 help early return; task CLI retains warning output and old-hub optional field guard. Protocol/shared-wire retain both optional dependency metadata and infrastructure outcome metadata. Suites retains locked-dependency host-failure diagnosis beside upstream periodic captured-commit/recovery behavior.
No new native process/test boundary, relaxed assertion or timing change was introduced by the resolution. No independent smell finding.

## Spec
No findings. Carry original accepted source and M1–M5 corrections from A-10387/A-10396/A-10412/A-10457/A-10462, plus rev-26 final A-10486 at42916599. This delta preserves C1 required-install reporting, C2 missing-lock diagnostics and C3 root links/stale-artifact/optional omission behavior. The existing prior-head verification marks are stale at this new commit and are not renewed by source review. All C1–C3 require fresh same-head evidence before final verification. qaPolicy none/after-stage.

A-10494 preserves local macOS merged precommit tree excerpts/exits: merge-batches39/39, planned-stage16/16, test-docs2/2, npm run check exit0 (report-only lint133/60, zero refusals). Native file durations8.012813125/9.885730542/0.159070625s are those targeted runs, not configured suite wall. Prior Linux A-10485/f6b6b5b9 green2808 and finalA-10486 remain historical at42916599 only. No merged-head configured/Linux green yet.
Reviewer read source, Git object metadata, topic authorization and artifacts; no tests, edits, merge, browser, install or delegation. Both axes completed personally.
Standards:0 findings. Spec:0 findings.
Durable audit A-10503: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10503-t-542-authorized-merge-delta-at-9c368b0a.md
