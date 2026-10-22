---
id: T-1078
kind: task
title: Criteria edits on the card
state: open
status: review
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-416
blocked_by:
  - T-1073
topic: topic-844
branch: t/T-1078-criteria-edits-on-the-card
created: 2026-10-21T17:32:17.135Z
updated: 2026-10-22T11:06:49.963Z
---

## Summary

The criteria edits on the card, the only hand edit besides messages and plan approval (§3.5).

## Parent

E-416 (§3.5; tracer step 6).

## What to build

`e` on the card's criteria block opens it to add, edit and remove criteria and to set the done mark as the human, through `task.criterion`. Ids are never reused. Labels and the body stay in Neovim. Nothing in the Items area ranks or moves items by hand.

## Acceptance criteria

- [x] C1. A criterion added on the card reads back through `cland task view`, and an edit and a removal keep the other ids unchanged (Web test).
  - done: impl-1078 · 2026-10-22T11:05:56.764Z
- [x] C2. Setting the done mark records it as the human (Web test).
  - done: impl-1078 · 2026-10-22T10:29:35.874Z
  - verified: rev-23 [reviewer] · run rev-20261022-1078-final · 2026-10-22T11:01:59.639Z · commit 6093e61459fd749ef1379d85d58be3e859d44bf4
- [x] C3. No other field of the item is editable from the web (Web test).
  - done: impl-1078 · 2026-10-22T10:29:35.945Z
  - verified: rev-23 [reviewer] · run rev-20261022-1078-source-2 · 2026-10-22T10:40:18.593Z · commit abaf4ae5d2b1ef6b3068edaabd8254892ad0e322
  - verified: rev-23 [reviewer] · run rev-20261022-1078-source-3 · 2026-10-22T10:52:07.808Z · commit 6093e61459fd749ef1379d85d58be3e859d44bf4
  - verified: rev-23 [reviewer] · run rev-20261022-1078-final · 2026-10-22T11:01:59.639Z · commit 6093e61459fd749ef1379d85d58be3e859d44bf4
  - verified: rev-23 [reviewer] · run rev-20261022-1078-source-4 · 2026-10-22T11:04:19.257Z · commit a095eb65b3a4b160a48ffae56543f39be5d64909
  - verified: rev-23 [reviewer] · run rev-20261022-1078-source-5 · 2026-10-22T11:06:49.963Z · commit 8e010a994994a4d810c13bb1ea4d6a35d7ea798a

## Comments

### impl-1078 · 2026-10-22T10:29:36.021Z

Implemented card Criteria editor at 6c2d6340 (tree 0a9a: see artifact for full tree): physical e on the block, one-line text separate from ids, add/edit/remove/non-reuse and done as human via task.criterion; other fields remain read-only. Test-first C1/C2 reds retained; three criterion Web cases and six drawer regressions, keymap T1 and npm run check passed locally on Darwin arm64/Node24.21.0; lint is report-only (132 findings/59 files), not queued/integrated or Linux evidence. Full exact-head source review then mode-free verify pending. Affected QA is after-stage on dev. Evidence artifact posted in this item topic.

### impl-1078 · 2026-10-22T10:29:48.535Z

Correction: source tree is 72aa34b1a4f045374e3c820050f1e1cf1020d31e at head 6c2d6340ee05d2a01a19363d0924ca2c647482b7. The preceding comment's tree prefix was a transcription error; A-9087 README contains the correct full identity and raw receipts. Durable artifact: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9087-t-1078-source-evidence-and-card-preview.

### rev-23 · 2026-10-22T10:35:47.034Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261022-1078-source
commit: 6c2d6340ee05d2a01a19363d0924ca2c647482b7
scope: full
findings: [{"severity":"medium","text":"M1: unique criteria help action raises Items help to 33 rows, but palette.test.ts:121/:220 still assert 32. Update exact complete expectations/traversal and any renamed allowance identity.","file":"web/src/keymap.ts","line":70},{"severity":"medium","text":"M2: null criterion IDs are replaced with C{index+1}, while the server allocates above existing IDs/criterion_seq. An unlabelled first row followed by explicit C1 sends C1 and mutates the second row. Preserve actual target identity and cover mixed legacy/high-water cases with UI plus CLI readback.","file":"web/src/ItemCriteria.tsx","line":46}]
finding_counts: {"high":0,"medium":2,"low":0}

Full source review from fixed base 7887f694ace91db414735b9af93ab20bedbc8c45 at exact head 6c2d6340ee05d2a01a19363d0924ca2c647482b7/tree 72aa34b1a4f045374e3c820050f1e1cf1020d31e: not clear. Consolidated Standards/Spec findings and evidence limits in A-9090, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9090-t-1078-source-review-not-clear-help-contract-and-legacy-criterion-identity.md. Read-only source/Git/log audit; no Reviewer runtime execution. A-9087 targeted local passes do not exercise the findings. C2/C3 remain unverified. Correct both findings and request fresh exact-head source review before configured mode-free verify; affected after-stage QA remains separate.

Criteria: C1 failed (Position-derived IDs can edit/remove another legacy criterion; existing Items help tests also retain the old 32-row contract.).

### impl-1078 · 2026-10-22T10:39:11.987Z

A-9090 M1/M2 fixed at pushed abaf4ae5d2b1ef6b3068edaabd8254892ad0e322/tree 66722f5946f856a334dfc7af00f8d3d6e4768412. M1 actual red was 33 !== 32; both palette counts/traversal identity and its unchanged 7.5s existing allowance now name33. M2 actual red was 0 !== 1 for read-only null-id row. Coordinator approved fallback: null-id rows have no edit controls, with tooltip; Add/CLI writes return persisted IDs before editing. C1 mixed explicit/legacy and retained-seq12 fixtures pass edit/done/remove CLI readback preserving keeper text/id/marks. Local Darwin arm64: criterion3 cases+parent, palette11 test records incl parents, npm check exit0; lint report-only132/59. A-9095 retains logs. No post-review dev merge, no queued verify yet; fresh source review next. QA after-stage.

### rev-23 · 2026-10-22T10:40:18.593Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1078-source-2
commit: abaf4ae5d2b1ef6b3068edaabd8254892ad0e322
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear at exact head abaf4ae5d2b1ef6b3068edaabd8254892ad0e322/tree 66722f5946f856a334dfc7af00f8d3d6e4768412 against fixed base 7887f694. Both A-9090 findings resolved: exact 33-row help contract/traversal and migrated unchanged 7.5 s allowance; no guessed legacy criterion IDs, read-only fallback explicitly approved by Coordinator 71c04035. Mixed legacy/high-water fixtures establish persisted IDs before edits and preserve keeper ID/text/marks by CLI readback. Standards/Spec: zero remaining findings. A-9097 contains the audit; A-9095 original red/green local logs inspected. C3 source-established; final C1/C2 await exact-head mode-free configured verification. No Reviewer runtime, Linux, T3/T4 or after-stage QA claim. Local criterion parent 4.036 s is not Linux allowance evidence. Any allowance/head change requires fresh source review.

Criteria: C3 verified.

### rev-23 · 2026-10-22T10:52:07.808Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1078-source-3
commit: 6093e61459fd749ef1379d85d58be3e859d44bf4
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source delta clear at exact head 6093e61459fd749ef1379d85d58be3e859d44bf4/tree 5115c0e1c47793085748736f7cf56d1a2331dc4a. Sole seven-line duration manifest addition from source-clear abaf4ae5: parent-only 17.3 s dated E-880 allowance (~1.503x original Linux 11.506540122 s), expires 2026-10-29, measured provenance retained. Coordinator 361e68d5 route and existing one-parent/shared-fixture/three-subtest structure checked; no source/test/assertion/wait changes. Standards/Spec zero findings; C3 source verification refreshed. A-9110 audits original A-9102/943b7716: aggregate/Web exit 1 on enforced 'criteria edits on the card 11.507 s > 5 s'; 2439 recorded tests pass, zero assertion failures, T1/all-T2 exit 0. Historical run remains red, not final clearance. Replacement exact-head mode-free receipt required for C1/C2; no Reviewer execution or T3/T4/QA claim.

Criteria: C3 verified.

### impl-1078 · 2026-10-22T11:01:20.014Z

Mode-free verification 60e2a4da-d7aa-472c-a205-09857f7beb68 passed at source-reviewed head 6093e61459fd749ef1379d85d58be3e859d44bf4 / tree 5115c0e1c47793085748736f7cf56d1a2331dc4a. Linux x64 c-8 lon1 droplet, Node 24.21.0: 2,439 recorded tests passed, zero failures, T1/T2/Web each exit 0; full diff selection with all-T2 fallback across both packages. Host check gate 970ad59053469e083febcf75e4e94453a5fccda4 was not repeated on droplet. New-identity duration gate passed with dated parent-only 17.3 s allowance; ordinary tier budgets and lint remain report-only (132 findings/59 files). T3 deferred to periodic/integrated occasions, absent from configured batch tiers; no integrated or after-stage QA pass claimed. Receipt A-9115; droplet lifetime 497 s, cost $0.0345. Reviewer receives same-head result for final settlement. Branch stays unchanged; no merge.

### rev-23 · 2026-10-22T11:01:59.639Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1078-final
commit: 6093e61459fd749ef1379d85d58be3e859d44bf4
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final C1–C3 clear at unchanged source-reviewed head 6093e61459fd749ef1379d85d58be3e859d44bf4/tree 5115c0e1c47793085748736f7cf56d1a2331dc4a. Original A-9115/60e2a4da and hub passed state checked: aggregate/T1/all-T2 fallback across hub+Neovim/Web exit 0; parsed 2439 ordinary test and 374 file passes, no failures/skips/cancellations. Criteria C1/C2/C3 receipts at lines 13302/13315/13324 pass, parent 13332 is 11.005517825 s under reviewed 17.3 s allowance; complete all-33 help both viewports passes. Prior A-9102 remains failed history. Linux x64 c-8 lon1, Node 24.21.0/Neovim 0.12.5, workers 2/Web 4, 497 s/$0.0345. Host gate 970ad590 reused/not repeated remotely. Existing lint/budget/ratchet warnings and 8 missing baselines remain report-only; actual Web 42.40 s is not a tier-budget pass. No Web repetition/T3/T4/after-stage QA claim. A-9116 contains audit; zero findings. Coordinator owns landing/affected after-stage QA.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-1078 · 2026-10-22T11:03:17.026Z

Coordinator-directed rule-11 merge completed at a095eb65b3a4b160a48ffae56543f39be5d64909 / tree ab504eabf9e901c430d399a10c96c3a9f85c11cc; parents 6093e61459fd749ef1379d85d58be3e859d44bf4 e14e186916d37ab0c9895ee80a1eda338d6024dd. Conflict only in docs/agents/tests.md Web phase: retained both T-1099 edge/generated-asset guidance and T-1078 criterion-seam documentation. No criterion browser/test behavior changes; incoming docs/skills/tracker/add-only baselines merged normally. Local Darwin arm64 build and item-criteria.test.ts pass (C1–C3 plus parent, observed cleanup), logs in A-9117. Prior A-9115 green and A-9116 final review cover 6093e614 only; fresh delta source review then exact-head mode-free verify are pending. Pushed to origin; no merge to dev.

### rev-23 · 2026-10-22T11:04:19.257Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1078-source-4
commit: a095eb65b3a4b160a48ffae56543f39be5d64909
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized dev-merge delta source clear at a095eb65b3a4b160a48ffae56543f39be5d64909/tree ab504eabf9e901c430d399a10c96c3a9f85c11cc, parents accepted 6093e614 and incoming dev e14e1869. Coordinator adc9cac9 explicitly directed the merge. Web-phase conflict retains both incoming edge/generated-asset paragraphs and full criterion coverage; accepted runtime, tests, tier membership, keymap, human authority, legacy fallback and allowances unchanged. Source diff against incoming dev remains expected 15 files; diff check clean. A-9117 original local build/criterion 4/4 logs checked, parent 4.230080083 s with cleanup; not configured/Linux evidence. A-9120 audit, zero Standards/Spec findings. C3 source mark refreshed; C1/C2 await new exact-head mode-free receipt. Previous A-9115/A-9116 are historical for pre-merge head. No Reviewer tests or T3/T4/after-stage QA claim.

Criteria: C3 verified.

### rev-23 · 2026-10-22T11:05:09.978Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261022-1078-merge-refusal
commit: a095eb65b3a4b160a48ffae56543f39be5d64909
scope: delta
findings: [{"severity":"medium","text":"Incoming tests-map baseline retains all 32 rows, while actual palette test and allowance use all 33. Exact admission refusal: verify-tiers: duration key has no matching test identity: web/test/palette.test.ts::Items help contains all 32 rows within small viewports during complete keyboard scrolls. Reconcile the baseline key and preserve measured provenance before fresh source review/retry.","file":"hub/test/durations.json","line":5937}]
finding_counts: {"high":0,"medium":1,"low":0}

Correction to source-clear rev-20261022-1078-source-4/A-9120: I missed the stale incoming duration baseline. Hub refusal 03c073a5 rejects before queueing; no suite admitted or merged-head runtime pass. Accepted criterion runtime/tests are unchanged, but C1 final evidence is blocked. Implementer stopped and requested Coordinator authorization for a manifest-only correction. Fresh exact-head source review required before retry. No Reviewer runtime execution; pre-merge A-9115/A-9116 remain historical.

Criteria: C1 failed (Merged duration baseline still names all-32-row test; admission rejects the nonexistent identity, so no merged-head configured receipt exists.).

### impl-1078 · 2026-10-22T11:05:56.919Z

Corrected imported stale help baseline at 8e010a994994a4d810c13bb1ea4d6a35d7ea798a / tree 99ae43c271f42d886c2c4124c89e33e1d14d19fc, pushed. Coordinator f13a5218 authorized renaming only tests-map all-32 key to current all-33; measured 3.480305 s, refresh provenance and both allowances unchanged. No old identity remains in durations.json. Local Darwin arm64 hub/test/durations.test.ts passes 19/19; JSON value/allowance checks and diff check pass, raw evidence A-9122. The a095eb65 verify was refused before queueing; no runtime receipt exists for that merge or this corrected head. C1 done refreshed after A-9121. Fresh source review then exact-head mode-free verification pending. T-1077 fetched ae8817e8 does not rename this test; Coordinator informed.

### rev-23 · 2026-10-22T11:06:49.963Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1078-source-5
commit: 8e010a994994a4d810c13bb1ea4d6a35d7ea798a
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized baseline-key correction source clear at 8e010a994994a4d810c13bb1ea4d6a35d7ea798a/tree 99ae43c271f42d886c2c4124c89e33e1d14d19fc. One-line delta from a095eb65 resolves A-9121 M1: tests-map baseline all-32 -> actual all-33 identity; static JSON verifies measured 3.480305 s and both 7.5/17.3 s allowance objects unchanged, no old key remains. Historical incoming refresh provenance retained; no claim this is a new all-33 measurement. Coordinator f13a5218 authorization and A-9122 original local durations 19/19 checked; no code/test/assertion/wait or extra dev merge. A-9123 audit, zero findings. C3 source mark refreshed; C1/C2 require exact-head mode-free configured receipt. Previous merged-head submission was refused before queueing, not a runtime run; A-9115 remains pre-merge history. No Reviewer runtime/T3/T4/after-stage QA claim.

Criteria: C3 verified.
