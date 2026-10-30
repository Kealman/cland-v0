---
id: T-1453
kind: task
title: cland verify runs the tier lint and T3 header check locally before submitting
state: closed
status: done
size: S
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by: []
topic: topic-1232
branch: t/T-1453-cland-verify-runs-the-tier-lint-and-t3
created: 2026-10-30T05:44:56.925Z
updated: 2026-10-30T16:06:03.325Z
closed: 2026-10-30T16:06:03.325Z
---

## Summary

Before admission, `cland verify` runs `npm run test:tiers` and the T3 lifecycle header check in the caller's worktree and names the cause (stale duration keys after a rename, unsorted tier rows, imports above or a missing `T3:` header), so a refusal costs seconds instead of a review round. On 2026-10-29 five submissions were refused this way (T-1445, T-410, T-1436, T-1082, T-1373). Rule batch 4 C1 (A-14151).

## Acceptance criteria

- [x] C1. The local check reports each refusal class the hub's admission reports, with file and line, before any queue entry.
  - verified: rev-26 [reviewer] · run rev-20261030-1453-evidence-1 · 2026-10-30T10:48:40.124Z · commit c2217bb929755acb533ab5e3d68d72db1a434ed7
  - verified: rev-26 [reviewer] · run rev-20261030-1453-evidence-2 · 2026-10-30T14:54:57.378Z · commit 35fa7620e9ef3030d320a0ae678f41ebd47c357b
  - verified: rev-26 [reviewer] · run rev-20261030-1453-evidence-3 · 2026-10-30T15:20:07.211Z · commit 75bc8701718c68b7e3766c87ab593706e94c5282
  - verified: rev-26 [reviewer] · run rev-20261030-1453-source-8 · 2026-10-30T15:45:57.733Z · commit a23466dcdd652fa48f9aa921ceb8822db112d72c
  - verified: rev-26 [reviewer] · run rev-20261030-1453-source-9 · 2026-10-30T15:53:51.702Z · commit d2a221c0088fdc40c83c67b1a33de3ced791b2f7
  - done: impl-1453 · 2026-10-30T15:58:58.943Z
  - verified: rev-26 [reviewer] · run rev-20261030-1453-source-10 · 2026-10-30T15:59:40.130Z · commit a7b4ba04b95a3b4fbe76661dfd0e5b079e31b5d7

## Comments

### impl-1453 · 2026-10-30T10:20:14.352Z

Consumer inventory before shared admission extraction: hub/src/hub/suite-candidate.ts (production suite admission), hub/src/territory.ts (merge policy; unchanged), hub/src/protocol.ts (existing refusal codes; unchanged), CLI suite.ts (new local caller), suite-shards.ts / test-lint-policy.ts (shared existing checks), suite-selection.ts (infrastructure full-selection trigger). Tests across tiers found by names/fields: suite-admission*, suite-dry-run, suite-protocol, suite-task-selection, suite-selection, suite-tiers, test-lint, merge*, durations, web-phase, request-guard. Shipped docs/skills: implement SKILL.md, docs/agents/tests.md, hub/README.md; QA brief consumers use verify unchanged. No wire/schema change; retain prior-wire regression in suite-admission.test.ts. Only CLI adds an invocation; hub refusal policy stays identical.

### rev-26 · 2026-10-30T10:28:35.375Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261030-1453-source-1
commit: 1efd2afc739a41f0a8cd47ba9d29c293d7b60e39
scope: full
findings: [{"severity":"medium","text":"M1: New guide has a prose H1 and no owning Notes index row; SUITE_USAGE changed without its frozen commands.json migration. Reproduce unchanged docs/help guards red/green and correct only owning metadata/fixture rows.","file":"docs/agents/tests/hub-test-suite-preflight.test.ts.md","line":1},{"severity":"medium","text":"M2: Tier locations use disk even when rejection came from committed HEAD. Repair/reorder/remove the committed bad row on disk and the printed row refers to another source or :1. Carry actual rejected-source provenance and exact location through shared diagnostics; add committed-manifest/disk-repair controls.","file":"hub/src/cli/suite.ts","line":81},{"severity":"medium","text":"M3: Both raw promisified Git helpers lack cancellation, finite command bound and registered process/close owner. Held or aborted Git can outlive root cleanup. Reuse shared commandIn ownership with sealed environment, explicit exit assertions and shared adverse cleanup controls.","file":"hub/test/suite-preflight.test.ts","line":17}]
finding_counts: {"high":0,"medium":3,"low":0}

Full source not clear: consolidated A-14265. Standards M1 owning docs/help records and M3 native Git command ownership; Spec M2 wrong source provenance for manifest line locations. Shared admission extraction and report-only semantics otherwise preserved. No Reviewer workloads. Exact replacement-head source review must precede configured verification.

Criteria: C1 failed (Committed manifest refusals are located against repaired disk rather than the rejected HEAD source.).

### impl-1453 · 2026-10-30T10:29:21.556Z

Source1 fixes: M1 corrected only owning guide heading/index and SUITE_USAGE frozen row; unchanged test-docs and cli-usage-compatibility guards red before/green after. M2 moved location formatting out of CLI into suite-shards shared diagnostic owner, with exact source supplied by shared admission and HEAD/worktree label. New committed-unsorted/repaired-disk and committed-stale-duration/repaired-disk regressions assert original lines 5/12 and commit provenance; both red before, green after. M3 all test Git uses existing commandIn owner, final fixtureEnvironment and explicit zero exits; existing init-machine-lifecycle cancellation regression passes. Consumers of formatted error.message are unchanged wire readers and suite tests listed earlier: code/files remain identical, only additive source/location text changes; deep-equal dry-run/live same-source policy preserved.

### rev-26 · 2026-10-30T10:31:13.259Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261030-1453-source-2
commit: e368cba7d549ebe43ea7902efc538428af830e5a
scope: full
findings: [{"severity":"medium","text":"M4: source-qualified shared error now differs from unchanged exact expectations at134/204 and cross-HEAD/disk equality at206. Preserve exact source-specific message/code/files/cause, dry/live equality within each source and queue/reservation assertions; migrate owning consumer after red/green. M1–M3 resolved.","file":"hub/test/suite-admission-cost.test.ts","line":134}]
finding_counts: {"high":0,"medium":1,"low":0}

A-14271: M1–M3 source corrections accepted; one remaining medium Standards finding M4 missed exact diagnostic consumer. No new Spec issue; C1 runtime unverified. No Reviewer workloads. Replacement exact-head source review before configured verification.

### impl-1453 · 2026-10-30T10:32:02.679Z

M4 owning consumer migration: complete unchanged suite-admission-cost.test.ts red at e368cba7 (exact old messages); replacement passes 6/6, asserting exact code/files/full cause and each expected HEAD/worktree suffix, exact dry/live equality per source, stable cause across sources, and all no-queue/no-reservation facts. Full-repo literal/code consumer rescan also found QA E-676 D6/L5–L7; updated for committed plant HEAD provenance, keeping standalone lint output unchanged. Evidence A-14272. Typecheck green; lint rerun pending.

### rev-26 · 2026-10-30T10:32:47.519Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1453-source-3
commit: c2217bb929755acb533ab5e3d68d72db1a434ed7
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14274 source3 clear: M1–M4 resolved. Shared rejected-source diagnostics, owned native Git controls and exact source-specific consumer/QA expectations preserve refusal code/files/cause and no-queue/reservation assertions. C1 runtime remains unverified until same-head configured original-record evidence; no ready claim. No Reviewer workloads.

### rev-26 · 2026-10-30T10:48:40.124Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1453-evidence-1
commit: c2217bb929755acb533ab5e3d68d72db1a434ed7
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final A-14286 independently audits original A-14284:4243ordinary+75scopedload passes, zero nonpass/unmatched;8exact T3 preflight identities once(sum1.090989905s,addedwall2.000s), exact admission-cost/docs/help consumers pass. C1 verified. T0/T1/allfallbackT2/changedT3/Web complete,remainingT3/T4unexecuted. Budgets/lint/ratchet/missingbaseline explicitly report-only. No Reviewer workloads; Coordinator owns integrated/enqueue policy.

Criteria: C1 verified.

### impl-1453 · 2026-10-30T11:42:48.883Z

Coordinator rule 11 instruction 1e3fab26 authorized merge of origin/dev. Merged dev 8b23ee3a0da03e4400e13710574249c048a17db8 into task as 6e8cedd8b11658640153578b1d4ba89ff1cc1382, pushed origin. Only conflict implement SKILL.md: retained local preflight and repository auto-maintenance sections and their test pointers, removed extra blank line; CHANGES records resolution. No task production behavior modified beyond the authorized dev import. Focused Darwin arm64 Node v24.21.0 preflight 8/8, docs 3/3, help compatibility 1/1; typecheck green. Merge-tree against fetched origin/dev clean (8865443fc502851442f0567cb956d3e7db71a0a6). Coordinator owns forthcoming verify all at delta-reviewed head; no implementer verify submitted.

### rev-26 · 2026-10-30T11:44:04.533Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1453-source-4
commit: 6e8cedd8b11658640153578b1d4ba89ff1cc1382
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14311 authorized merge delta clear: retained both implement skill sections/pointers and CHANGES, task preflight/admission production+tests unchanged; imported usage/frozen JSON coherent. No Reviewer workloads. C1 runtime remains stale at successor head; prior A-14284/A-14286 first-parent only. Coordinator's planned verify all must precede final evidence review; no Implementer verification requested.

### impl-1453 · 2026-10-30T14:29:50.866Z

Shared T-1485 fix 960191735 included in pushed conflict-free merge 35fa7620e9ef3030d320a0ae678f41ebd47c357b (dev dbb1dae9), under Coordinator instruction 78106bc4. Task preflight production/test sources unchanged vs source4. Focused local preflight 8/8, admission-cost 6/6, docs 3/3, usage compatibility 1/1 and typecheck green on Darwin arm64 Node v24.21.0. Original failed full A-14387 remains old-head evidence only. Artifact A-14422 records merge/checks; Coordinator owns next all run after named delta review.

### rev-26 · 2026-10-30T14:32:02.858Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1453-source-5
commit: 35fa7620e9ef3030d320a0ae678f41ebd47c357b
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14430 authorized merge delta clear: task preflight/checker/shards/tests/QA bytes unchanged, combined skill guidance intact, own SUITE_USAGE and imported owning rows coherent. A-14387 remains failed old-head evidence; C1 runtime pending Coordinator all at merged head. Focused local receipts limited accurately; no Reviewer workloads.

### impl-1453 · 2026-10-30T14:32:46.507Z

Coordinator disposition cdd54d46 changes runtime plan: prior full af51ef07/A-14387 at 6e8cedd8b supplies T0–T3 (green; only Web shared phone-asks failed), source5 confirms own source unchanged across conflict-free dev merge. Implementer now submits one mode-free configured verify at current 35fa7620e for C1/Web; Reviewer verifies C1 only on this green current-head result, citing both receipts and Coordinator disposition. No second all requested.

### rev-26 · 2026-10-30T14:54:57.378Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1453-evidence-2
commit: 35fa7620e9ef3030d320a0ae678f41ebd47c357b
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14470 independently audits current A-14461/d1ec8a5c: 4270 ordinary passes plus 105 load passes; T0/T1/all T2/changed preflight T3 once/Web complete, remaining T3/T4 unrun. Eight exact C1 refusal/provenance cases pass with matching timings; six admission-cost generated identities pass. Coordinator cdd54d46 rule-7 disposition applied: separately cite pre-merge A-14387 T0–T3 green (203 T3 files), each preflight base+5/5, own source unchanged; preserve old whole native exit1/phone-asks failure, eight skips and interruption marker. Current green includes phone case pass. Advisory budgets/lint/missing baseline retained. C1 current-head verified, no Reviewer workloads.

Criteria: C1 verified.

### impl-1453 · 2026-10-30T15:01:47.638Z

Merged T-1458 dev landing bd0f3e34f under Coordinator 879898c6; pushed 75bc8701718c68b7e3766c87ab593706e94c5282. Three conflicts resolved keeping both skill sections and combined SUITE_USAGE/frozen commands row. Preflight core/test behavior unchanged. Focused preflight 8/8, usage compatibility 1/1, cli-help 5/5, docs 3/3, typecheck and test:lint pass on Darwin arm64 Node v24.21.0. Lint has 124 report-only findings, zero refusals; new imported prerequisite advisory names existing T-1484. A-14482 records merge. Prior A-14461 green is prior head only. Delta review by rev-26 then one mode-free verify and final evidence review.

### rev-26 · 2026-10-30T15:03:34.352Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1453-source-6
commit: 75bc8701718c68b7e3766c87ab593706e94c5282
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14485 authorized T-1458 merge delta clear: own preflight core/tests byte-identical to green first parent; imported runtime/guard files match dev. Combined skill/help and exact frozen usage rows preserve preflight plus both advisory readiness sentences; owning docs/index/T3 entry retained. No report-to-enforce promotion. C1 current runtime pending new same-head configured evidence; predecessor green not carried. Local A-14482 receipts retain advisory T-1484 limit. No Reviewer workloads. One Coordinator-directed mode-free verify may proceed, then final original-record review.

### rev-26 · 2026-10-30T15:20:07.211Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1453-evidence-3
commit: 75bc8701718c68b7e3766c87ab593706e94c5282
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14503 independently audits original A-14502/618b4e13: 4278 ordinary passes plus 105 load passes; T0/T1/all T2/changed preflight T3 once/Web complete, remaining T3/T4 unrun. All eight C1 preflight cases and six admission-cost generated identities pass with timing parity. No current preflight repetitions claimed. Imported CLI prerequisite probe remains incomplete native exit1/known T-1484 TypeScript advisory; site boundary clear and readiness reports are not execution proof. Existing Coordinator cdd54d46 disposition retains separately attributed A-14387 pre-merge full T3, with its whole failure/skips unchanged. Source6 owns unchanged core/tests. C1 current-head verified; report-only warnings retained, no Reviewer workloads.

Criteria: C1 verified.

### impl-1453 · 2026-10-30T15:26:32.423Z

Coordinator 6276c5e2 authorized merge after T-1433/T-1474. Pushed head 276715c81462b774f6e4f9a8c797c6c575ae1f43 merges dev e83b1081e; only conflict README, both local preflight/Telegram album transcripts sections retained verbatim. Own preflight core/test diff empty. Local Darwin arm64 Node v24.21.0 preflight 8/8, docs 3/3, usage compatibility 1/1, typecheck/test:lint pass (124 report-only findings, zero refusals; known T-1484 prerequisite probe incomplete/advisory). A-14507 records merge. Prior A-14502 green is prior head only. Named delta review then one mode-free verify and final evidence review.

### rev-26 · 2026-10-30T15:27:07.503Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1453-source-7
commit: 276715c81462b774f6e4f9a8c797c6c575ae1f43
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14508 authorized merge delta clear: README preserves both complete preflight and Telegram album sections; imported source/tests match actual dev parent. Own preflight core/tests/help/frozen usage unchanged from prior green. C1 current-head runtime pending fresh configured original; prior green remains attributed to 75bc87017, prior qualified T3 disposition unchanged. Local focused/advisory receipts accurately scoped. No Reviewer workloads. One mode-free configured verify may proceed at frozen exact head then final evidence review.

### impl-1453 · 2026-10-30T15:40:42.344Z

Coordinator docs/help waiver d4eb4f30 and explicit merge be52db14: merged T-1460 dev 1bfa2532d as a23466dcdd652fa48f9aa921ceb8822db112d72c, pushed. Text conflicts only: tests.md/README retain both preflight/provenance sections, usage/frozen row retain both help lines. Own preflight production/tests unchanged. Matching guards only, sequential: docs 3/3, usage compatibility 1/1, native help 5/5, Darwin arm64 Node v24.21.0. No new suite under waiver. Last reviewed green A-14502; already-admitted a608f068 remains pinned to prior head 276715c81. Named delta review then ready per disposition.

### impl-1453 · 2026-10-30T15:44:48.586Z

Waiver consumer inventory expanded and disposition recorded in A-14530 (full sequential receipts). At unchanged a23466dcd, additional complete matching files pass: cli-command-help18, cli-usage-merge2, install-claims3, roles-clauses39, web-readme3, session-usage7, remote-docs26 (site README readers included), suite-persistence14, suite-protocol15, suite-remote-log1, suite-summary4, skills-onboarding15, skills-invocation3: 150 total, zero fail/cancel/skip. Existing exact-head docs3/usage-compat1/cli-help5 also green. PUSH-only/import-graph guards unaffected; fixture path classifiers/comment references do not read modified docs, listed in artifact. Footer raw/persisted readers all covered. Parent run a608f068/A-14528 now green 4303 ordinary at 276715c81; attributed as predecessor, not current head. No source change or new verify.

### rev-26 · 2026-10-30T15:45:57.733Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1453-source-8
commit: a23466dcdd652fa48f9aa921ceb8822db112d72c
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14532 records Coordinator docs/help rule6 waiver: exact conflict resolution retains preflight/provenance/help/frozen text; own core/tests unchanged, imported source matches dev. Expanded inventory A-14530 has 150 additional complete-file native exit0 passes plus earlier9 exact-head guards (159 targeted total). Independently audited immediate predecessor A-14528/a608f068 at276715c81:4303 ordinary+125load passes, eight exact C1 cases timing parity, six admission-cost identities, changedT3 once/Web complete; remainingT3/T4 unrun. C1 verified on merged head under waiver, without relabelling any prior receipt. Prior qualified fullT3 and failed whole-run facts remain separate; report-only limits retained. No Reviewer workloads.

Criteria: C1 verified.

### impl-1453 · 2026-10-30T15:51:19.839Z

Applied Coordinator d4d25ee7 after T-1464 landing. Pushed d2a221c0088fdc40c83c67b1a33de3ced791b2f7 merging dev db4bb9a8; conflicts only implement skill/usage/frozen row, both policies retained, CHANGES recorded. T-1464 auto-imports SuiteCandidate.isAncestor exactly from dev; T-1453 checker/CLI/tests unchanged. All16 matching reader files rerun sequentially:159 pass, zero fail/cancel/skip, raw outputs in artifact. Last audited green A-14528 at 276715c81 remains attributed predecessor; source8 waiver A-14532 parent a23466dcd. No new verify under docs/help waiver; requesting named delta before ready.

### rev-26 · 2026-10-30T15:53:51.702Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1453-source-9
commit: d2a221c0088fdc40c83c67b1a33de3ced791b2f7
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14541 source9 waiver audit: both help/skill policies retained and exact frozen row matches; own lintSuiteCandidate/preflight CLI/tests unchanged. Imported ancestry API/Git implementation matches dev (entire shared module is not unchanged). A-14538 complete raw 16 sequential reader files confirms 159 named/terminal passes, all native exit0, zero adverse outcomes at d2a221c00. C1 refreshed under Coordinator d4d25ee7 docs/help waiver using current targeted receipts plus separately attributed A-14528 at ancestor276715c81 and prior full-T3 phase disposition. No new-head full-suite claim or new verify; prior report-only/platform/phase limits retained.

Criteria: C1 verified.

### impl-1453 · 2026-10-30T15:58:59.092Z

Applied Coordinator d152dd49 after T-1484 landing0e4e223cb; pushed a7b4ba04b95a3b4fbe76661dfd0e5b079e31b5d7. Only conflicts usage/frozen row; local preflight and compiler requirement help retained. No authored code changes; imported lazy compiler capability matches dev, own checker/CLI/tests unchanged. Same full matching-reader inventory A-14530 rerun sequentially:16 files/159 pass/zero adverse outcomes, raw outputs in artifact. Last audited ancestor green A-14528 and source9 waiver A-14541 remain attributed. No new verify under standing text waiver; requesting rev-26 delta then ready.

### rev-26 · 2026-10-30T15:59:40.130Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1453-source-10
commit: a7b4ba04b95a3b4fbe76661dfd0e5b079e31b5d7
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source10 waiver clear: local preflight plus incoming compiler requirement and prior help text retained; exact SUITE_USAGE frozen row matches. Own checker/CLI/preflight/admission tests unchanged; compiler capability/consumers and native controls match dev. A-14545 raw16 sequential complete files independently confirms159 named/terminal passes, all native exit0, zero adverse outcomes. C1 refreshed under Coordinator d152dd49 waiver via exact delta/current targeted plus ancestor A-14528 at276715c81; no current-head full/runtime/browser claim and no new verify. Prior qualified fullT3 and all report-only/unrun limits preserved. Full audit in attached source10 artifact.

Criteria: C1 verified.

### coord · 2026-10-30T15:59:49.414Z

Enqueued at a7b4ba04b. Suite evidence under the Coordinator's dispositions: T3 from verify all af51ef07 / A-14387 at 6e8cedd8b (rule 7, phone-asks only); current-head runtime from mode-free 618b4e13 / A-14502 at 75bc87017 and A-14528 at 276715c81. The later merges after T-1458, T-1460, T-1464 and T-1484 landed resolved docs and help text only, under the standing rule 6 waiver, with rev-26 delta reviews and targeted raw text-reader receipts (A-14530, A-14538). T-1453's own preflight code and tests are unchanged since rev-26's source5.

### coord · 2026-10-30T16:06:03.325Z

Merged 18f57f55f107bd3e3bfd24da073eb9a24b8b2b28 onto dev.
