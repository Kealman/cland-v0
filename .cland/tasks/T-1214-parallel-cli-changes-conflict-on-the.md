---
id: T-1214
kind: task
title: Parallel CLI changes conflict on the single usage text in hub/src/cli/usage.ts
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1196
blocked_by: []
topic: topic-975
branch: t/T-1214-parallel-cli-changes-conflict-on-the
created: 2026-10-24T09:01:40.293Z
updated: 2026-10-24T12:52:12.617Z
---

## Summary

On 2026-10-24 five branches added help lines to `hub/src/cli/usage.ts` (T-1188, T-1198, T-1018, T-542, T-1144), and three of them conflicted there: T-1198 with T-1188, T-1144 with dev, T-1203 with T-1144. Each conflict costs a dev merge, a delta review and a fresh verify (~15 min). The usage text is one long template where adjacent commands' lines touch each other. Git union merge is unsafe for code.

## Acceptance criteria

- [x] C1. Each command's usage lines live in their own entry (one module or one table row per command), so two branches that change the help of different commands merge without a conflict, shown with a scratch Git repository (test).
  - verified: rev-26 [reviewer] · run rev-20261024-1214-final-1 · 2026-10-24T12:25:15.100Z · commit e03a3a3f340f621580982e909b51da163f0a933e
  - verified: rev-32 [reviewer] · run rev-20261024-1214-final-2 · 2026-10-24T12:51:15.673Z · commit 9eb0c63e88e66b68d9239821e34c43a402340ba2
  - done: impl-1214 · 2026-10-24T12:52:12.408Z
- [x] C2. `cland --help` output and every existing help/usage test are unchanged byte for byte by the refactor (test).
  - verified: rev-26 [reviewer] · run rev-20261024-1214-final-1 · 2026-10-24T12:25:15.100Z · commit e03a3a3f340f621580982e909b51da163f0a933e
  - verified: rev-32 [reviewer] · run rev-20261024-1214-final-2 · 2026-10-24T12:51:15.674Z · commit 9eb0c63e88e66b68d9239821e34c43a402340ba2
  - done: impl-1214 · 2026-10-24T12:52:12.518Z

## Comments

### impl-1214 · 2026-10-24T11:54:27.143Z

Test-first receipt: new merge-boundary test failed with `AssertionError: verify help occupies one table row` before the refactor. Implemented blank-separated command string rows with stable named exports/import graph. Local macOS targeted checks so far: frozen named exports, actual --help bytes, native Git merge + merge-tree, unchanged cli-imports (3 tests), child-environment guard pass. Typecheck caught optional lookup narrowing in the new test; corrected before review.

### rev-31 · 2026-10-24T12:01:55.144Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261024-1214-source
commit: 24713d5d6f72d058aea66c384aafe95983611936
scope: full
findings: [{"severity":"medium","text":"M1: indexed test guide heading violates existing test-docs guard. Use exact '# hub/test/cli-usage-merge.test.ts' while retaining guidance/index.","file":"docs/agents/tests/hub-test-cli-usage-merge.test.ts.md","line":1},{"severity":"medium","text":"M2: distinct top-level commands still share physical source and golden rows: init/update, publish/release/sync, subscribe/unsubscribe/subscriptions. Isolate owned entries behind byte-compatible exports and prove a formerly shared pair through native merge and merge-tree.","file":"hub/src/cli/usage.ts","line":47}]
finding_counts: {"high":0,"medium":2,"low":0}

T-1214 full source review — not clear

Head24713d5d6f72d058aea66c384aafe95983611936, treee06f140857effab8801f30805c09f9cd39040039. Fixed base/merge-base512c4960bb573e8df6e215de8bceb509af8e7d6a, merged before first review. Reviewed git diff512c4960...24713d5d and task commits9fe7abbc/4b66a1b5/24713d5d. Clean task tree and whitespace check. C1/C2 claimant done; QA none/after-stage. Standards and Spec reviewed in-session; no delegation or runtime execution.

Standards — M1 medium
docs/agents/tests/hub-test-cli-usage-merge.test.ts.md:1 uses "# Command help merge boundary (T-1214)". The existing hub/test/test-docs.test.ts guard requires an exact "# <repository/path>.test.ts" heading matching the document's filename and indexed test. It will reject this guide at its "test file heading" assertion. Use "# hub/test/cli-usage-merge.test.ts", preserving body and index row. This is static source inspection of the guard, not an executed guard failure. Validate the existing guard during the correction; do not weaken it.

Other standards checks: T1 frozen-export comparison is repository-only. T2 explicitly tests a real CLI subprocess with sealed fixtureEnvironment, bounded exec and synchronous completion before owned-directory removal. T3 native Git merge/merge-tree seam has a lifecycle reason, sealed scratch environment and synchronous commands with bounds; no process remains at cleanup. All three files have tier entries and preserve the import graph; existing cli-usage/cli-imports/cli.test/qa-lint-cli files are unchanged. No dependencies, authority, runtime command behavior, Git union attribute or project Git settings changed.

Spec — M2 medium
hub/src/cli/usage.ts:47,65,79: not every independent top-level command has its own edit entry. INIT_USAGE still stores init and update on the same physical row; RELEASE_USAGE stores publish/release/sync on one row; SUBSCRIPTIONS_USAGE stores subscribe/unsubscribe/subscriptions on one row. C1 says each command has its own entry so different commands merge without conflict. Two branches changing init versus update, or publish versus sync, still replace the same source line and the same frozen-export fixture row. The current native proof exercises only SUITE_USAGE versus EXECUTOR_USAGE and cannot establish those remaining boundaries.

Split independent command text into blank-separated owned entries and compose the existing public exports without changing their bytes/import graph. Preserve aliases and intentional subcommand families, but isolate distinct top-level commands. Retain command ownership in the frozen fixtures too, rather than moving their conflict into a shared expected-output row. Extend the native merge/merge-tree proof with a formerly shared pair such as init/update and require both source and expected data edits to survive. Existing export names and full-help output must remain byte-identical.

Compatibility checks and evidence:
Using read-only string/JSON parsing (no module execution), all29 original exports at fixed base512c4960 equal the frozen exports, and all29 current production values equal those same fixtures, including IMPORT_USAGE composition. Existing help/import tests have empty fixed-base diffs. Frozen full-help template expands only frozen values plus current version, not production exports; CLI test compares actual bytes. Golden rows preserve blank separators for the tested verify/executor pair. No byte compatibility finding.

A-10883 contains summary evidence only: pre-refactor structure red, local compatibility/help/native merge green; native Git observations1.376/.706/1.037s, related existing tests and typecheck with stated premerge/refinement limits. No original complete command/stdout/exit/native timing bundle audited here and no configured run. Preserve the available original records durably with actual source/platform/executor attribution, keeping unavailable/truncated pieces explicit and without transcription reruns.

Disposition:
Complete remaining findings M1/M2. C1 failed for incomplete command isolation and the new guide's guard contract; C2 remains pending exact-head runtime settlement. Correct/commit/push, restore claimant done mark and request fresh full source review before ordinary configured mode-free verification. No post-review dev merge absent Coordinator authorization. No enqueue, QA or full-suite claim. Reviewer performed read-only Git/source/artifact inspection only.
Durable review A-10898.

Criteria: C1 failed (Distinct commands still share conflict-prone rows, and the new indexed guide violates its heading guard.).

### rev-26 · 2026-10-24T12:09:10.169Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261024-1214-source-2
commit: e03a3a3f340f621580982e909b51da163f0a933e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1214 corrected full source review — clear

Head e03a3a3f340f621580982e909b51da163f0a933e; tree a87d0d6f9c9c67f1c8e98d2b1ef9a7d96f4c8f3d. Fixed base 512c4960bb573e8df6e215de8bceb509af8e7d6a, integrated before the first source review. Reviewed full base-to-head change and correction from 24713d5d, task C1/C2, prior rev-31 findings, tests and retained A-10907/A-10908 evidence. Standards and Spec assessed in-session without delegation or runtime execution.

## Standards
No findings. M1 resolved: indexed guide heading is exactly "# hub/test/cli-usage-merge.test.ts"; body and index remain aligned. T1 uses independent frozen JSON data; T2 exercises the actual CLI byte boundary with a sealed scratch environment and bounded synchronous child completion before cleanup. T3 has the necessary native Git merge/merge-tree contract seam, bounded synchronous native calls, scratch environment and directory ownership. Tier declarations and existing import boundary remain intact. No dependency, Git union driver or runtime authority changes.

## Spec
No findings. M2 resolved: init/update, publish/release/sync and subscribe/unsubscribe/subscriptions now have separate blank-separated source rows and frozen command-data rows. The original named exports compose those owned entries, preserving all existing export names. Intentional aliases/subcommand families remain grouped. Both native cases edit production and frozen data independently, prove merge-tree and ordinary Git merge retain both edits, and retain conflict assertions; the formerly shared init/update boundary is now covered.

Independent read-only source/JSON parsing reconstructed all 29 existing exports from the new fixtures and compared them with the pre-correction frozen values: all equal. New production literal/composition values match their independent command fixtures. The full-help expectation expands frozen values plus the current version and does not source its expectation from production exports. Existing help/import behavior is not broadened.

## Evidence and limits
A-10907 explicitly preserves available original excerpts and their development/pre-review attribution; missing complete raw records are labelled. A-10908 preserves complete correction tool-result records, including the missing update-row red case and an intermediate unrelated first-pair failure, rather than reconstructing a clean history. Final macOS correction-tree native Git tests pass 2/2 (877.734334 and 283.834042 ms; runner 1242.013541 ms), frozen T1 1/1, real CLI help 1/1 (88.166458 ms), docs guard 3/3, and static checks exit 0 with report-only lint. These working-tree checks were committed unchanged; they are not a configured Linux suite receipt or an inferred end-to-end check duration.

Disposition: full source clear at the exact head, zero findings on either axis. C1/C2 remain run-dependent and are not marked verified by this source verdict. The claimant may submit ordinary configured mode-free verification at this unchanged head, including changed T3 once; preserve the measured native timing/selection and report-only diagnostics for same-head evidence settlement. No full-suite green, landing or QA claim. Any source change requires fresh source review; no post-review dev integration without Coordinator authorization.

Standards: 0 findings. Spec: 0 findings.
Durable review: A-10916.

### rev-26 · 2026-10-24T12:25:15.100Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261024-1214-final-1
commit: e03a3a3f340f621580982e909b51da163f0a933e
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1214 final same-head evidence review — clear

Head e03a3a3f340f621580982e909b51da163f0a933e; tree a87d0d6f9c9c67f1c8e98d2b1ef9a7d96f4c8f3d. Current full source clearance A-10916 / rev-20261024-1214-source-2 is unchanged. Original configured log A-10963, run 46ae7f1b-03cc-41a0-9c3d-327d7f0ab04e, matches task.view's exact head and finished/passed result.

## Standards
No findings. Read-only evidence review, no new runtime execution or source edits. Local macOS correction receipts A-10908 retain their actual correction-tree attribution and intermediate red outcomes; original partial A-10907 records remain explicitly partial. Neither is relabelled as this Linux configured result.

## Spec and criteria
C1 verified: A-10916 establishes separate source/frozen rows for each independent top-level command behind byte-compatible exports. The changed native T3 file passed both source-plus-golden merge and merge-tree cases once: SUITE_USAGE/EXECUTOR_USAGE 0.064036280 s; INIT_USAGE/UPDATE_USAGE 0.057110873 s. No conflict assertion or independent-edit retention was relaxed.
C2 verified: frozen comparison of all 29 pre-refactor named export values passed ordinary T1 at 0.002262355 s and 5/5 actual load repetitions. Actual cland --help byte comparison passed ordinary T2 at 0.101149157 s and 5/5 repetitions (worst 0.120788471 s). Expectations remain independent frozen fixtures. Existing test sources are unchanged by the refactor as checked in A-10916; selected existing cli-usage 1/1, cli 9/9, qa-lint-cli 2/2 and docs guard 3/3 passed. No claim that unchanged, unselected T3 CLI-import lifecycle tests executed in this task run.

## Configured result and limits
Mode-free configured task run, mode full, exit 0; T0, T1, all fallback T2 across hub/Neovim, changed T3 once and Web exit 0. Deduplicated native progress: 2955 ordinary passing tests, 426 passing file records, no failures/cancellations/skips; 10 extra load-gate test passes for the two new compatibility identities counted separately (5/5 each). Changed T3 has two identities, one base execution, no repetitions; selected-phase added wall 0.383 s excludes machine wait. Both native cases are far below 8 s (80% of 10 s); duration output says no stanza. Remaining general T3 and T4 did not run.

Executor: Linux x64 6.8.0-142-generic, droplet c-8 lon1 cland-v0-e3c71efb, Node v24.21.0, Neovim v0.12.5; configured workers 2, lifetime 651 s, cost $0.0452. T0 host check exit 0, 43.13 s; full stdout preserved. Remote typecheck explicitly says matching host gate f3e300f93b1482d19b4b55fcf6813fa483190bb4 not repeated. Read-only Git confirms this identifier is a tree object, not another head. No remote repeated typecheck claim.

Duration/lint/ratchet remain report-only: 133 lint findings across 60 files, three missing baselines, existing Web shell/items/connection and hub scale/Neovim artifact warnings, projected Web wall over 40 s, T3 ratchet 2195.425 vs base 2195.304 would refuse growth. Exit 0 is not an enforce-mode budget or growth-gate pass.

Final evidence clear, findings []; C1/C2 all verified across current source and exact-head runtime receipt. QA none/after-stage needs no per-item run. Coordinator owns landing; retain the normal read-only current-dev conflict check and unchanged reviewed head. Standards 0 findings; Spec 0 findings.
Durable review: A-10966.

Criteria: C1 verified, C2 verified.

### impl-1214 · 2026-10-24T12:32:35.586Z

Coordinator-authorized one-time dev integration after T-1086: fetched d76d69fb, merged once, resolving only usage.ts. New upstream help retained: merge queue automatic retry explanation; demo status now includes state and provisioning/active explanation. Re-froze expected bytes independently from original dev module. Test-first integration receipt: compatibility test failed on exactly those missing DEMO_USAGE/MERGE_USAGE lines with old production text; source rows updated, then exported-byte check, real --help check and both native source+golden merge/merge-tree tests passed locally on macOS. No new dependencies or test changes; delta review will precede a new configured verification.

### rev-32 · 2026-10-24T12:37:38.782Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261024-1214-delta
commit: 9eb0c63e88e66b68d9239821e34c43a402340ba2
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1214 authorized integration delta source review — clear

Head 9eb0c63e88e66b68d9239821e34c43a402340ba2; tree ed12e6489910d6d0f5bf2d693081b34efd21e03c. Parents e03a3a3f340f621580982e909b51da163f0a933e and d76d69fb79ccb2ede084dd04f75a3854a1a66df1. Origin agrees, task worktree clean, dev-to-task whitespace check passes. Carry rev-26's accepted source2/A-10916 and old-head final1/A-10966. Direct/hub-routed delta request assigned rev-32; free hold taken and prior reviewer informed.

## Standards

Coordinator c7927d60 independently read in topic-975 explicitly directs one dev merge after T-1213/T-1083/T-1108/T-1086 land, preserving new help, re-freezing from merged dev, delta review then fresh verification. The merge's actual second parent is that d76d69fb dev head.

Relative to the previous reviewed task source, only MERGE_USAGE and DEMO_USAGE command strings change: merge queue recoverable-block automatic retry guidance, and demo status state/provisioning/active guidance. Matching independent frozen command entries change in the same two places. The original export-composition and help-order fixtures, test implementations and fixture loader are byte-identical to e03a3a3f. No dependency or test-tier change in this resolution. Existing source/frozen command separation and blank separators remain intact, including init/update, publish/release/sync and subscribe/unsubscribe/subscriptions.

No new standards findings. Existing canonical guide/index and sealed scratch/native Git ownership/bounds remain as accepted in A-10916. No merge driver or authority behavior added. Runtime usage consumers in cli.ts are unchanged from incorporated dev.

## Spec

Independent read-only parsing reconstructs all 29 exported values from d76d69fb's original module: 28 template literals (including IMPORT_USAGE substitution) and the single-quoted PUSH_USAGE. Every value equals the integrated frozen export composition. Separately, all 34 production command rows (including IMPORT_USAGE) reconstruct the same frozen exports. Thus the refreshed expectations preserve incorporated dev's bytes, rather than merely agreeing with an accidentally changed implementation. Only the two expected command keys differ from old task frozen data; all legacy export names/composition and full-help ordering remain unchanged.

C1's command ownership and formerly shared init/update regression remain unchanged. C2 now targets the authorized incorporated-dev help bytes, preserving all new landed text; old-head Linux verification is historical and cannot verify this changed head.

Evidence A-10997 preserves the original integration red against old production bytes and corrected macOS local green tool records. The first red is explicitly truncated (original token count 12385); no complete-original-red claim. Green T1 export comparison 1/1 (1.322416 ms test, runner 72.389042 ms); actual CLI help 1/1 (66.34125 ms test, runner 155.733875 ms); native merge/merge-tree 2/2 (242.142542/226.013958 ms, runner 549.606209 ms); hub typecheck completion exit 0. Source is labelled integration working tree later committed here, not exact-head configured reruns. Per-call wait/poll wall intervals are not whole command duration.

Clear delta source, findings []. Both C1/C2 remain run-dependent/unverified until a fresh ordinary configured mode-free run at this exact unchanged head, including the changed T3 Git regression and actual compatibility/help receipts. Prior 46ae7f1b/A-10963 remains old-head evidence. QA none/after-stage; no new suite/landing pass claimed. No further dev merge without the required authorization. Standards 0 findings; Spec 0 findings. Reviewer used read-only source/Git/artifact inspection and data parsing only; no tests, browser, edits, merge or delegation.
Durable audit A-11009.

### rev-32 · 2026-10-24T12:51:15.674Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261024-1214-final-2
commit: 9eb0c63e88e66b68d9239821e34c43a402340ba2
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1214 final integrated-head evidence review — clear

Head 9eb0c63e88e66b68d9239821e34c43a402340ba2; tree ed12e6489910d6d0f5bf2d693081b34efd21e03c. Origin matches, task tree clean. Carry current integration delta/A-11009 and accepted full source2/A-10916. Independently read configured run 278005d9-e1ff-4ae0-9218-c6eeddb5d11d / A-11040; task.view confirms finished/passed at this exact head. No findings.

## Standards

Actual configured phases: host T0 check exits 0 (34.196 s), all T1, fallback all hub/Neovim T2, changed T3 once and Web each exit 0. Raw progress records establish 2966 ordinary passes across 427 passing file records, no failures/cancellations/skips. Two new compatibility identities additionally pass 5/5 load repetitions each (10 test/file records), counted separately from ordinary outcomes. No remaining general T3 or T4 execution claimed.

Linux x64 6.8.0-142-generic, c-8 lon1 droplet cland-v0-5315dbf4, Node v24.21.0, Neovim v0.12.5, workers 2 (Web 4). Matching host gate 07c9927747cf56a37194d7a18a3b71494bb32214 is reused remotely, not repeated. T1/T2/T3/Web phase envelopes 62/346/5/146 s differ from suite walls 58.15/341.63/0.47/142.03 s. Lifetime 650 s and cost $0.0451 are machine accounting.

Generic lint/duration/ratchet remain report-only: 133 lint findings/60 files, zero static refusals, four missing baselines, existing shell/items/connection/hub-scale/Neovim-artifact would-fail lines and Web over-budget retained. Ratchet 2195.429 versus 2195.304 s would refuse growth in enforce mode; it is not an enforce-mode growth pass. The changed native file's two identity times are far below its 8 s allowance-print threshold (80% of 10 s); runner reports no stanza. No duration allowance edit required.

## Spec

C1 verified: the source audit establishes separate command-owned source/frozen rows behind legacy exports. Changed T3 native Git cases both pass once, preserving edits in production and frozen data through ordinary merge and merge-tree: SUITE_USAGE/EXECUTOR_USAGE 0.066553037 s; formerly shared INIT_USAGE/UPDATE_USAGE 0.058869353 s. The selected-phase added wall is 0.414 s excluding machine wait, one execution/no repetitions. No conflict/assertion relaxation.

C2 verified: all 29 legacy export bytes match the independent incorporated-dev fixtures (ordinary 0.002040827 s, five repetitions peak 0.003061504 s). Actual cland --help bytes pass at 0.104289663 s, five repetitions peak 0.147277278 s. Current source remains independently equivalent to incorporated d76d69fb's original module per A-11009, preserving new merge/demo help. Existing cli-usage 1/1, cli 9/9, qa-lint-cli 2/2 and docs guard 3/3 pass. Unselected unchanged T3 import lifecycle tests are not claimed executed.

A-10997 integration-local records retain their working-tree attribution and truncated original-red limit. Old e03a3a3f/A-10963 green remains historical; this is the fresh receipt for the authorized integrated head.

Final clear, C1/C2 verified across current source and same-head runtime. QA none/after-stage. No full-T3/T4 cover, landing or reviewer execution claim. Read-only inspection only; no source edits, tests, browser, Git mutation or delegation. Standards 0 findings; Spec 0 findings.
Durable audit A-11043.

Criteria: C1 verified, C2 verified.
