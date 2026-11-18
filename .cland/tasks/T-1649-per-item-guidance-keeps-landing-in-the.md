---
id: T-1649
kind: task
title: Per-item guidance keeps landing in the implement skill, making it the remaining merge hotspot
state: open
status: ready
size: S
criterion_seq: 2
labels: []
assignee: null
parent: E-1887
blocked_by: []
topic: topic-1633
branch: t/T-1649-per-item-guidance-keeps-landing-in-the
created: 2026-11-03T01:51:41.764Z
updated: 2026-11-18T21:41:07.796Z
---

## Summary

After T-1631 split `hub/README.md`, `.agents/skills/implement/SKILL.md` (143 lines) is the remaining hotspot. Since 2026-11-02 00:00Z, 33 dev commits touched it. Today it caused merge conflicts for T-1588, T-1592, T-1596, T-1601 (twice), T-1615 and T-1631. One automatic merge silently dropped a section (T-1601, caught by a both-parent comparison). Items add subsystem paragraphs to it even though `.agents/skills/implement/CHANGES/T-<n>-*.md` files and `docs/hub/<subsystem>.md` exist.

## What to build

Keep `SKILL.md` to the stable workflow. Move subsystem guidance into `docs/hub/<subsystem>.md`, or into per-subsystem notes the skill points to, and make the per-item `CHANGES/` file the only place an item adds text. Add a lint that refuses item-scoped additions to `SKILL.md`, unless they are an explicit workflow change marked as such.

## Acceptance criteria

- [x] C1. `SKILL.md` keeps only workflow steps and pointers; every subsystem paragraph moves verbatim to its `docs/hub/` file or subsystem note, proven by a byte-preservation check like T-1631's (test).
  - done: impl-1649 · 2026-11-18T18:12:01.158Z
  - verified: rev-36 [reviewer] · run rev-36-1649-final-1 · 2026-11-18T19:50:16.536Z · commit a9f9223850774e4027fa65331ed8d553ad25c623
  - verified: rev-36 [reviewer] · run rev-36-1649-final-2 · 2026-11-18T21:41:07.443Z · commit 0f234d12db2dae47d7d5c5946c8bdbe994c0c287
- [x] C2. A lint refuses a change that adds subsystem text to `SKILL.md` and points to the destination; a workflow-change marker allows a deliberate edit (test).
  - done: impl-1649 · 2026-11-18T18:23:00.263Z
  - verified: rev-36 [reviewer] · run rev-36-1649-final-1 · 2026-11-18T19:50:16.536Z · commit a9f9223850774e4027fa65331ed8d553ad25c623
  - verified: rev-36 [reviewer] · run rev-36-1649-final-2 · 2026-11-18T21:41:07.443Z · commit 0f234d12db2dae47d7d5c5946c8bdbe994c0c287

## Comments

### impl-1649 · 2026-11-18T17:45:45.980Z

Consumer map: hub/test/{roles-clauses,review-qa-component,evidence-publish,skill-provenance,skill-provenance-merge}.test.ts read/provision this skill; shared/hub-reference.ts reads indexed subsystem notes. docs/hub/check-move.py and move-manifest.json retain historical T-1631 evidence; QA briefs and docs/evidence references are historical path/change records, unaffected. New C1 test freezes pre-move skill and explicit paragraph destinations; C2 will use pure paragraph policy plus existing test:static integration. No wire/product contract changes. Quiet cover remains respected; tests not run yet.

### impl-1649 · 2026-11-18T17:46:20.808Z

Proposed project rule for the next human rule batch: Keep .agents/skills/implement/SKILL.md to shared workflow steps and pointers. Put subsystem implementation guidance in its indexed docs/hub reference or subsystem note; record each item's skill provenance in a new CHANGES/<item>-<topic>.md entry. A deliberate workflow addition or edit carries an immediately preceding paragraph-scoped <!-- cland-workflow-change: T-<n> <reason> --> marker. The static lint rejects unmarked new or edited paragraphs and points to the appropriate destinations.

### impl-1649 · 2026-11-18T18:11:19.252Z

Source implementation complete under Coordinator quiet-period exception (agents e4d70de2): tests/red receipt and full test:lint pending quiet-over. Full npm run typecheck passed on local macOS, Node v24.21.0, source tree with the move and guard. Package script consumer search (rule 33): verification-commands.test.ts pins test:lint/test:static relationships; suite-check.test.ts uses an isolated fixture script rather than repository script bytes; skill-provenance.test.ts imports its unchanged gate. Additional reached T1 files: implement-skill, roles-clauses, review-qa-component, skill-provenance, test-docs, verification-commands, web-readme. T2 evidence-publish and session-usage plus unchanged T3 preservation consumers will be named to review; no native test batch requested during quiet. Historical docs/hub/check-move.py proves its recorded T-1631 snapshot and retains old offsets; new C1 fixture proves this move separately.

### rev-35 · 2026-11-18T18:20:43.752Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1649-source-1
commit: a72bcbe5860ab540ddcfa92c16d2e248eb81c363
scope: full
findings: [{"severity":"medium","text":"Standards S1: the newly wired T0/static check immediately exits 1 on findings. Rule27 and Coordinator4336b63d require the wired default to report findings/exit0, with refusal behind an enforcement switch and tests for both modes.","file":"hub/test/lint-implement-workflow.ts","line":12},{"severity":"medium","text":"Spec M1: unconditional live-skill retention of every unmoved frozen paragraph rejects a valid marked replacement even though the pure lint accepts it. Preserve historical move proof without freezing future workflow edits; add complete-contract marked/unmarked replacement controls.","file":"hub/test/implement-skill.test.ts","line":58}]
finding_counts: {"high":0,"medium":2,"low":0}

First source pass not clear; full audit A-21345. Standards: one medium (new check must default report-only); Spec: one medium (marked replacement fails the unconditional preservation loop), confirmed by impl201d6534. Static inspection verifies the present source move: frozen baseline equals pinned d7050e7e2, all53 mapped paragraphs preserved in9 indexed notes,34 unmoved nonempty paragraphs retained,27 moved link file targets exist. These are static facts, not passing tests. C1 remains unverified pending actual proof; C2 failed. Coordinatore4d70de2 permits source-only review during quiet with red pending. Full typecheck is reported passed at a72bcbe58/macOS Node24.21; no test/full lint/verify has run. Hold released for consolidated corrections, retaining quiet and rule11. No runtime tests or verification are requested before explicit quiet release. /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21345-t-1649-first-source-review-marked-workflow-edits-and-report-only-rollout.md.

Criteria: C2 failed (The complete T1 contract rejects valid marked replacements, and the newly wired check enforces immediately instead of defaulting to report-only as required by rule27/Coordinator4336b63d.).

### impl-1649 · 2026-11-18T18:22:44.447Z

Corrected S1/M1 from A-21345 in pushed 6d515437e40d3747853a07a93817cc86faf60c16. S1: shared checkWorkflow returns mode/findings/exitCode; wired T0 omits --enforce, prints findings and exits 0; explicit --enforce refuses. T0 seeded controls and T1 wired-default/enforcing controls use that shared checker. M1: immutable byte proof checks original retained workflow in the unchanged frozen baseline, not live obsolete prose; a complete-contract control replaces an archived original paragraph and passes migration plus enforcement only with a valid marker. The report-mode controls use frozen fixtures so unrelated future report findings cannot make T1 an accidental enforcement gate. Docs/provenance updated; no dev merge after first source review. Quiet restriction still active: no tests, test:lint or verify executed; full root typecheck is the only run and is being repeated on final head.

### rev-39 · 2026-11-18T18:24:51.066Z

verdict: review
result: clear
by: rev-39 [reviewer]
run: rev-20261118-1649-source-2
commit: 6d515437e40d3747853a07a93817cc86faf60c16
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source-only full re-review: A-21345 S1/M1 both resolved at exact head 6d515437e40d3747853a07a93817cc86faf60c16. Shared checker and wired command default report-only; explicit --enforce refuses. Immutable migration proof no longer freezes live old workflow paragraphs; complete-contract marked/unmarked replacement controls authored. Static byte inspection independently found all53 moved paragraphs in9 indexed notes,34 retained workflow paragraphs in frozen baseline,27 moved link file targets present; these are source facts, not passing tests. No findings on Standards or Spec. C1/C2 remain unverified because both require runtime tests. Reviewer ran no tests/lint/typecheck/native/browser probes during quiet. Final-head typecheck reported passed by Implementer on local macOS Node24.21.0; tests/red/full test:lint/configured verify remain unexecuted. Source clear does not release quiet or confer final readiness; wait for explicit Coordinator quiet/window before running and submit same-head evidence afterward. Full source report is the artifact in this topic titled T-1649 source re-review at 6d515437e — clear.

### impl-1649 · 2026-11-18T18:51:14.260Z

Post-quiet local receipts published as A-21360 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21360-t-1649-local-targeted-typecheck-and-lint-receipts.md). Final head a9f9223850774e4027fa65331ed8d553ad25c623, tree 6965b17499d3293c0d3b0457d4eef2e9ed3e4275: full root typecheck exit 0; full test:lint exit 0 on the identical source tree before commit, report-mode workflow guard 0 findings/test-lint refusals 0; all nine targeted T1/T2 files rerun at final head, 100 passed/0 failed/cancelled/skipped, local macOS Node v24.21.0, serial starts load 10.39–14.44. No browser, configured verify, T3/T4 or full-suite claim. Earlier 100 tests at 6d515 remain evidence; first full lint exited 1 on my tier-row order at lint-repository-tier-plan.ts:19. The only new source delta fixes that row order. No preimplementation C1/C2 red was collected during quiet; after-release negative/positive controls actually ran. Full lint advisories retained in artifact; one scanner-refused export line was replaced by its hash and the same helper then published after a clean seeded scan.

### rev-36 · 2026-11-18T19:14:51.809Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1649-source-3
commit: a9f9223850774e4027fa65331ed8d553ad25c623
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-21362 completed full-item source review, now formally recorded after Coordinator1f02a4a0 hub-responsive notice. Exact HEAD/origin a9f9223850774e4027fa65331ed8d553ad25c623/tree6965b17499d3293c0d3b0457d4eef2e9ed3e4275, clean; prior clear basis rev-39/A-21349 at6d515437e. Sole later delta is alphabetical placement of implement-skill.test.ts:T1; parsed tier maps equal and final order sorted, no classification/logic change. Standards0/Spec0. Shared checker remains report-only in wired test:static, explicit--enforce uses same policy; historical migration proof does not freeze obsolete live workflow. Independently checked frozen skill equals pinned d7050e7e2,53distinct moved paragraphs preserved in9 indexed notes,34retained nonempty paragraphs in frozen workflow,none of moved paragraphs leftlive,27relative Markdown file targets exist (not rendered/allanchors). Upstreammetadata.CHANGES,package/docs/readers/tierhistory reviewed. A-21360 nine selected local files tally100/100 with completed exit0 continuation chunks;7T1/2T2, no whole-tier/configured/Web/T3/T4 claim. Exact5new marker/report/enforce/migration/replacement controls positive; root typecheck reported0 athead; full lint0 onidentical precommit content,workflowreport0/testlintrefusals0,advisories retained. Earlier6d515437e lint ordering assertion remainsFAILED/distinct; earlier100selection notcountedtwice. No invented preimplementation red/native invocation provenance. C1/C2 remain runtime-unverified at source gate,done marks retained; same-head configured evidence pending. Reviewer onlyread source/Git/docs/data/retainedreceipts,no tests/checkers/scanners/native/browser/provenance rerun/source edits. Recovery readback confirmed original timed-out hold persisted,validationcomment/statuspersisted,noverdict existed; nohold/status/commentretry was needed,onlythismissingverdict written. Source hold released; claimant may request Coordinator's one-at-a-time verify window at exacthead (impl1807 currentlyfirst). Source artifact alone previously conferred no verification permission; this is formal sourceclear,notfinalready.

### impl-1649 · 2026-11-18T19:48:08.788Z

Configured run 390de124-d084-4bb4-b7f1-04162a51fa7c exit 0 at reviewed a9f922385; log A-21391. T0/T1/T2/Web completed; 6854 tests passed, none failed/cancelled/skipped. All five implement-skill generated case timing records separately checked as outcome pass (C1 verbatim preservation; C2 refusing/marker/report-default/complete-replacement controls). Executor droplet Linux x64 6.8.0-147-generic, Node v24.21.0, Neovim v0.12.5, Chrome Headless Shell / Google Chrome for Testing 156.0.8078.4; lifetime 1203 s and cost $0.0835 from executor receipt, not suite wall time. Runner provenance tree 792d91b83a38d3b9ec36f9eb5b40e917752dffc7; head matches exact reviewed commit. T3 deferred to enabled merge batch, T4 unexecuted. Budget and lint findings remained report-only, not an enforcement pass. No source changes after review; awaiting Reviewer final settlement.

### rev-36 · 2026-11-18T19:50:16.536Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1649-final-1
commit: a9f9223850774e4027fa65331ed8d553ad25c623
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; A-21394 records the independent streaming audit of run 390de124-d084-4bb4-b7f1-04162a51fa7c / A-21391. The owner result is finished/passed exit0 at reviewed a9f9223850774e4027fa65331ed8d553ad25c623; provenance pins runtime verification tree792d91b83a38d3b9ec36f9eb5b40e917752dffc7 and cached:null. Clean HEAD/local origin still match source3; its source basis remains unchanged. Standards/Spec have no remaining findings. Verify C1,C2.

All five exact generated implement-skill cases have positive base finish/timing pairs at3418/3419,3423/3424,3428/3429,3435/3436,3440/3441. Each also has five distinct passing load identities plus exact5/5 proof; base file passes at3443. These prove indexed verbatim preservation and the negative/positive destination, item/reason marker, wired report-default/enforce and complete-contract marked-replacement controls. Host static receipt82 reports workflow lint report mode with0 findings. Explicit enforcement refusal is proven; the wired gate stays report-only.

Manifest audit found positive base envelopes for all230T1/432T2/55Web files, no missing/nonpass/extra file or parse error. Base6854=6709top-level+145nested passes, zero fail/cancel/skip;235 load passes are separate. T0/T1/T2/Web exit0. All248T3/17T4 files are unexecuted; T3 remains merge-batch deferred, including the T3 skill-provenance-merge consumer. No all-tier claim.

Droplet Linuxx64 6.8.0-147-generic, Node24.21.0/Neovim0.12.5; actual browser chromium_headless_shell-1248 chrome-headless-shell-linux64/chrome-headless-shell, Google Chrome for Testing156.0.8078.4, exact path in A-21394/provenance39356. T0 host check138.344s is step-only; lifetime1203s/$0.0835 is executor accounting, not suite wall. Budget/Web-wall/ratchet/lint findings remain report-only. Earlier source not-clear,6d515 ordering-lint failure and local selected runs retain their own outcomes/epochs. No rerun or invented red/native provenance. QA scope none. Reviewer only read source/Git/manifest/structured retained log; no runtime tests/checkers/scanners/native/browser probes or edits. Release evidence hold and return final readiness through the normal hub/lead gate.

Criteria: C1 verified, C2 verified.

### impl-1649 · 2026-11-18T21:05:49.864Z

Coordinator-authorized merge completed and pushed: 0f234d12db2dae47d7d5c5946c8bdbe994c0c287 (tree 3d990e7e65aa38b77a85efca9fb68d77e46f2226), parents a9f922385 and dev fb513e13f. Sole conflict SKILL.md resolved to unchanged shared workflow; T-1895/T-1671 incoming paragraphs moved verbatim to running/adapters notes, superseding old guidance. New separate frozen receipt ties old bytes to untouched original fixtures and checks incoming bytes at indexed destinations. Preservation observed red before moving text (missing running paragraph 27), then all five cases green. Full lint/typecheck exit 0 on identical committed tree; 165 selected T1/T2 tests in 11 files passed, including all five dev_t3_every key matches before merge commit and inherited help/config compatibility. Local macOS Node v24.21.0, serial starts load <20; no new configured/native/T3/T4 run. A-21421 retains provenance and limits. Requesting narrow merge-delta review before a new verify window; old run evidence remains historical at a9f922385.

### impl-1649 · 2026-11-18T21:09:30.159Z

Evidence wording correction for A-21421 at pinned 0f234d12d: its statement 'No browser/native/T3/T4 run was performed' is too broad. The selected T1/T2 invocation set did include isolated native Git/CLI subprocesses in cli-help and scheduler component fixtures. The intended limit is: no separate T3/T4 run, native-provider fixture, full native batch, real provider/droplet creation, browser run, or new configured verify was initiated by this session during those local checks. Native subprocess work inside the named selected T2 tests is included in their 165 selected test outcomes and is not excluded from that evidence. This clarification uses existing invocation/source facts only; no rerun or source edit during the Reviewer pin.

### rev-36 · 2026-11-18T21:11:32.419Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1649-source-4
commit: 0f234d12db2dae47d7d5c5946c8bdbe994c0c287
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized merge-delta source clear; A-21422 records Standards/Spec review, no findings. Exact0f234d12db2dae47d7d5c5946c8bdbe994c0c287/tree3d990e7e65aa38b77a85efca9fb68d77e46f2226, parents cleareda9f922385 and devfb513e13f. Clean HEAD equals local origin. Coordinator0477d7ff explicitly authorizes this rule11 merge/relocation/checks/review/new window.

Independent byte audit: final SKILL exactly equals cleared workflow; original3 migration/workflow fixtures unchanged. Incoming dev differs from historical skill by exactly2paragraph values. Separate receipt pins sourceHead/path, positions27→running/69→adapters; previous values equal frozen originals, new828/829-byte paragraphs occur verbatim in incoming skill and indexed notes, absent live workflow; old destination prose replaced. All53 mapped positions/9notes accounted for:51 unchanged+2 incoming replacements. New test rejects duplicate/unmapped receipts and binds previous/destination/current bytes; retained historical workflow and full-contract marker controls remain. CHANGES note/guide updated without live workflow drift.

Manual delta is two notes, receipt, preservation test/guide and CHANGES entry. Production/config/help/frozen usage equal incoming dev; workflow policy/wired lint/package equal cleared parent. Existing source1 report-default and marked-replacement fixes remain intact. No manual inherited production change.

A-21421 reports intermediate missing-paragraph red and final5preservation/policy positives, full lint/typecheck0 on identical committed content and165 selectedT1/T2 tests in11files. All6 combined config-key matches are included: five literal-key files plus separately listed init-config camelCase consumer. Local macOS Node24.21, serial reportedload2.83–5.13. Its broad 'no native' line is corrected by Implementer6afa1581 and persisted21:09:30comment: selected T2 includes isolated nativeGit/CLI work; no separateT3/T4/native-provider/full-native batch/browser/real-provider/droplet/configured run. No raw invocation-time tree/native provenance inferred, no differently scoped speedup claim.

Verify no criterion at source gate. C1/C2 implementation-done; old verification marks remain stale at this new head until fresh configured evidence. Old A-21391 remains historical pass at a9f922385 only. Reviewer only read tracker/Git/JSON/source/docs/artifacts, no edits/tests/checkers/scanners/native/browser/provenance probes. Release hold; unchanged head may request Coordinator window, any changed head needs fresh review.

### impl-1649 · 2026-11-18T21:39:21.068Z

New configured run dff751d3-3fef-4ee1-994b-c1e56df3ab52 exits 0 at delta-reviewed 0f234d12db2dae47d7d5c5946c8bdbe994c0c287; A-21427. T0/T1/T2/Web pass, 6891 tests passed and none failed/cancelled/skipped. All five implement-skill generated suite timing records separately checked as outcome pass, including current supersession-aware byte preservation. Provenance tree b3b45edbed87bcfac33bbd2b01cf2862ffe08d0f; droplet Linux x64 6.8.0-147-generic, Node v24.21.0, Neovim v0.12.5, Chrome Headless Shell / Google Chrome for Testing 156.0.8078.4. Executor lifetime 1406 s/cost $0.0976 (not a suite-wall comparison). Lint/budget advisories remain report-only; T3 remains for merge batch. Source/worktree unchanged since delta review. Awaiting Reviewer final same-head settlement; old A-21391 remains historical.

### rev-36 · 2026-11-18T21:41:07.443Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1649-final-2
commit: 0f234d12db2dae47d7d5c5946c8bdbe994c0c287
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final post-merge evidence clear; A-21428 records the independent streaming audit of dff751d3-3fef-4ee1-994b-c1e56df3ab52 / A-21427. Owner result finished/passed exit 0 at source4 delta-reviewed 0f234d12db2dae47d7d5c5946c8bdbe994c0c287. Provenance 39589 pins runtime tree b3b45edbed87bcfac33bbd2b01cf2862ffe08d0f and cached:null; clean HEAD/local origin still agree. Standards/Spec no remaining findings. Refresh C1,C2 verification at this exact head.

All five expected implement-skill cases have pass finish/timing pairs at 3527/3528, 3532/3533, 3537/3538, 3542/3543 and 3547/3548. Each has five distinct passing load identities plus exact 5/5 proof; base file 3552 passes. C1 executes the merged receipt contract: 51 original moved paragraphs plus two exact incoming supersessions tied to frozen previous bytes/positions27 and69, indexed destinations and unchanged shared workflow. C2 negative/destination, scoped marker, wired report-default/enforce and full-contract marked replacement controls pass. Host static line82 reports workflow lint in report mode with 0 findings. No stale first-parent result is reused for this proof.

Manifest audit confirms one positive base-file envelope for every 231 T1/435 T2/55 Web file, 721 total, no missing/nonpass/duplicate/extra file or progress parse error. Base 6891 =6746 top-level +145 nested passes, zero fail/cancel/skip; 235 load passes are separate. T0/T1/T2/Web exit 0. All 248 T3/17 T4 remain unexecuted, including skill-provenance-merge; remaining T3 is merge-batch work. Recorded Linux x64 6.8.0-147-generic, Node24.21.0/Neovim0.12.5; actual chromium_headless_shell-1248 binary, Google Chrome for Testing156.0.8078.4, full path in A-21428. T0 host108.417s is step-only; lifetime1406s/$0.0976 is accounting, not suite wall. Budget/lint/Web-wall/ratchet notices remain report-only.

Prior A-21391/A-21394 remain historical green only at a9f922385, not added to this aggregate. Earlier not-clear/lint failure/intermediate merge red and local selections retain their epochs and limits; A-21421's native wording correction remains recorded. Source4/A-21422 is the current source basis. QA scope none. Reviewer only read retained data/source/Git/manifest; no edits/runtime/checker/scanner/native/browser/provenance probes. Release evidence hold for the normal ready/landing gate; no further run requested.

Criteria: C1 verified, C2 verified.
