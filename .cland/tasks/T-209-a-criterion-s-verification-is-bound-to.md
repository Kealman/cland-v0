---
id: T-209
kind: task
title: A criterion's verification is bound to the head it was verified at; a new head reopens it
state: closed
status: done
criterion_seq: 4
labels:
  - v0.1
  - high
  - ready-for-agent
assignee: impl-209
parent: T-216
blocked_by: []
topic: topic-112
branch: t/T-209-a-criterion-s-verification-is-bound-to
created: 2026-10-11T01:45:38.211Z
updated: 2026-10-11T08:39:25.685Z
---

## What to build

Seen on T-178 (2026-10-11 01:45Z). rev-13 verified C4 at head 06cb6f6. The branch then moved to e98771b after a dev merge with conflict resolution, and rev-13 recorded a clear review for C1–C3 at the new head. The hub moved T-178 to `ready` because C4's old verified mark still stood, though no full-suite evidence exists for e98771b. The merge gate would have let it through.

A verification mark records the commit it was made at. When the item's head moves past that commit, the mark stops counting toward `ready` and the merge gate until it is verified again at the new head. A done mark stays, since the work is still done, but verification is per head. The item view shows a stale verified mark as stale.

## Acceptance criteria

- [x] C1. A criterion verified at commit A no longer counts for ready or merge once the branch head is B ≠ A, and counts again when re-verified at B.
  - done: impl-209 · 2026-10-11T03:33:11.239Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-209-1 · 2026-10-11T03:36:51.344Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-209-3 · 2026-10-11T04:05:57.538Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-209-5 · 2026-10-11T04:54:14.023Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-209-7 · 2026-10-11T05:44:22.748Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-209-8 · 2026-10-11T07:36:54.630Z
- [x] C2. `task view` and the board show a stale verification distinctly.
  - done: impl-209 · 2026-10-11T03:33:11.335Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-209-1 · 2026-10-11T03:36:51.344Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-209-3 · 2026-10-11T04:05:57.538Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-209-5 · 2026-10-11T04:54:14.023Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-209-7 · 2026-10-11T05:44:22.748Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-209-8 · 2026-10-11T07:36:54.630Z
- [x] C3. A protocol test covers verify at A, push B (status falls back from ready), re-verify at B (ready again).
  - done: impl-209 · 2026-10-11T03:33:11.404Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-209-1 · 2026-10-11T03:36:51.344Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-209-3 · 2026-10-11T04:05:57.538Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-209-5 · 2026-10-11T04:54:14.023Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-209-7 · 2026-10-11T05:44:22.748Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-209-8 · 2026-10-11T07:36:54.630Z
- [x] C4. `npm run typecheck && npm test` pass.
  - done: impl-209 · 2026-10-11T05:38:38.347Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-209-6 · 2026-10-11T05:38:54.078Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-209-9 · 2026-10-11T08:38:57.481Z

## Notes

Size S. Interim: the Coordinator checks that each criterion's verification matches the head before merging.

## Comments

### impl-209 · 2026-10-11T03:28:51.669Z

Reproduced with node --test --test-name-pattern='criterion verification follows' hub/test/merge.test.ts: 1 test failed in 4.5s because merge succeeded after verify at A, an empty commit pushed as B, and partial verification at B. The regression isolates criterion freshness from patch-equivalent review freshness. Checking mark persistence, gate evaluation and shared Neovim criteria display.

### impl-209 · 2026-10-11T03:33:11.493Z

Implemented exact-head criterion verification in commit 48047d6. Verification marks persist the build SHA, task views annotate current/stale, ready/merge require current marks, and the board/item view display stale evidence while preserving done. Legacy unbound marks fail closed. Regression covers push A→B, automatic ready revocation, partial review, explicit old verdict commit, standalone re-verification and merge. Typecheck, tracker-criteria (6), Neovim criteria (4), epic-close (12), plan-gate (8), and the strengthened regression passed. Broader merge-file run is still finishing; final cland suite all will be requested after review handoff.

### impl-209 · 2026-10-11T03:34:55.610Z

Requested rev-13 review of pushed head 48047d676de5b7635434ae3347902c603715c672, then submitted cland suite all: run 4ed4bb09-ae42-4d17-8432-75a3685ccafd, worker PID 95197, queue position 2, reports to topic-112/rev-13/impl-209. Final origin/dev fetch/merge was up to date. Targeted broad merge run was 41/42; the sole startup failure was an ask.forward role-catalog mismatch caused by merging T-179 while that process was running. The affected test and T-209 regression both passed on the settled tree. C4 remains pending the full suite; retaining the claim and going idle for hub results.

### rev-13 · 2026-10-11T03:36:51.344Z

verdict: review
result: clear
by: rev-13 [reviewer]
run: rev-13-20261011-209-1
commit: 48047d676de5b7635434ae3347902c603715c672

No high or medium findings. Standards and Spec independently clear. Exact verification SHA is persisted atomically with verdict marks and resolved for standalone verify; task/QA/epic gates require current-head marks, legacy/unresolved marks fail closed and done remains. Head changes invalidate detail even with patch-equivalent review; task view and board show stale distinctly. Protocol regression covers verifyA→pushB→readyrevoked→partial/explicit-old verification→standaloneverifyB→ready/merge restored.

Independent typecheck/diff check, actual-module parser→annotation→task/QA/epic gate probe and one-process Neovim criteria presentation probe pass; clean pinned head. The Neovim probe executed assertions despite read-only temp/server/log startup refusals; it is not full UI integration. A-1011 targeted passes are a summary, not complete execution logs; writing suites inspected rather than independently rerun. C1–C3 verified. C4 remains unchecked/unverified pending complete same-head full validation; prior configured-main failure/isolated pass is not final evidence. Head contains T-1724990b6a, so no T-172 exceptions. Final readiness withheld.

A-1014: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1014-t-209-review-at-48047d6-c1-c3-clear-c4-full-suite-pending.md.

Criteria: C1 verified, C2 verified, C3 verified.

### rev-13 · 2026-10-11T04:03:47.211Z

verdict: review
result: not clear
by: rev-13 [reviewer]
run: rev-13-20261011-209-2
commit: 48047d676de5b7635434ae3347902c603715c672

Medium — hub/test/task-worktrees.test.ts:382: worktree.list measured-resumption test observes3 session snapshots, expected2; complete npm test exits1 and does not reach Neovim. C4 failed. A-1021 typecheck completes, hub1132/1133 with this sole failure, zero cancelled/skipped/todo. This is a snapshot-count failure; no production defect or root cause inferred from it alone.

Clean unchanged pinned head. Durable full result inspected read-only; writing suites not independently rerun. Prior Standards/Spec C1–C3 review A-1014 stands. This head contains T-1724990b6a, so no T-172 exception applies; this assertion is also outside those named cases. An isolated retry is insufficient for final C4: resolve the failure and provide complete final same-head hub+Neovim validation.

Review artifact A-1022 (durable topic note) records evidence and limitations.

Criteria: C4 failed (A-1021 npm test exits1: worktree.list measured-resumption assertion at task-worktrees.test.ts382 sees3 snapshots instead of2; hub1132/1133, Neovim not reached.).

### impl-209 · 2026-10-11T04:04:46.125Z

Resolved full-suite C4 failure in pushed head 40b052d7aabac7ac38f98ba4238662981e5ab4ff. Independent reproduction confirmed 3 sessions snapshots; tracing identified the new tip event's dispatcher listener as the third, alongside the two request snapshots. Budget test fixture now uses existing manualTips scheduling; assertions remain unchanged. Both affected budget tests pass (2/2), debug tracing removed, diff check clean, final origin/dev fetch/merge up to date. Requesting fresh review and full suite; C4 remains pending.

### impl-209 · 2026-10-11T04:05:00.249Z

Fresh full suite submitted on 40b052d: d7c39dfd-90c0-4488-88cc-d07e47f7acb3, worker PID 63229, queue position 3. Reports to topic-112, rev-13 and impl-209. Review request sent first. Keeping C4 pending and claim held; idle until the hub delivers the result.

### rev-13 · 2026-10-11T04:05:57.538Z

verdict: review
result: clear
by: rev-13 [reviewer]
run: rev-13-20261011-209-3
commit: 40b052d7aabac7ac38f98ba4238662981e5ab4ff

No high or medium findings. Both axes clear: existing manualTips scheduler isolates unrelated background tip events only in guardedHub's two budget fixtures. Exact snapshots===2, correct worktree output, one resumed/client slow record,400mscharge and real branch-link subscriber assertions remain unchanged. Production and C1–C3 implementation/coverage unchanged; prior A-1014 review/probes carry forward and C1–C3 verification refreshed to this head.

Independent typecheck/diff pass; clean pinned one-file4+/1- delta, no debug tracing. Source corroborates dispatcher sessions listener as an extra background path; no observation assertions weakened. A-1023 reports red reproduction then fixed2/2; writing tests not independently rerun and complete targeted output not supplied.

C4 remains unverified pending new complete same-head full run d7c39dfd. Prior48047d6 suite failure is not final evidence on40b052d; no T-172 exceptions. Final readiness withheld.

A-1024: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1024-t-209-re-review-at-40b052d-budget-fixture-isolated-c1-c3-clear.md

Criteria: C1 verified, C2 verified, C3 verified.

### rev-13 · 2026-10-11T04:51:14.272Z

verdict: review
result: not clear
by: rev-13 [reviewer]
run: rev-13-20261011-209-4
commit: 40b052d7aabac7ac38f98ba4238662981e5ab4ff

Medium — qa/cases/ITEMS-002.lua:14 (also36): fixture writes legacy verification marks without commit, while line63 expects3/4 fresh marks; T-209 correctly displays0/4 3stale, so the headless QA test fails at nvim/test/qa.test.ts:96. Bind the fixture's fresh verification to a real resolved head and retain all watched-save/80/120-column glyph/fraction/highlight checks.

A-1033 completes typecheck and both phases at clean unchanged40b052d: hub1133/1133, Neovim252/253, sole ITEMS-002 failure, no cancellation/skip/todo, exit1. Previous budget failure is absent. Prior A-1024 C1–C3 review stands; C4 failed. This is outside the named T-210 exception, and no T-172 exception applies. Final C4 requires complete corrected-head validation.

A-1034: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1034-t-209-c4-at-40b052d-unbound-items-002-fixture-fails-final-suite.md

Criteria: C4 failed (A-1033 full suite exits1: hub1133/1133, Neovim252/253; ITEMS-002 writes unbound verification marks, renders0/4 3stale, and times out expecting3/4.).

### impl-209 · 2026-10-11T04:52:57.158Z

Pushed 9f911adbb59c541406c9020d059ee37aa72e6a8f: repaired ITEMS-002's unbound verification fixture with a real isolated Git build and exact-head marks, preserving both-width 3/4→green 4/4 layout/highlight checks and adding head-move stale board/item checks. Independent case reproduction failed before repair and passed after (1/1). Prior all run passed hub1133/1133 and Neovim252/253; this was the only failure. Final origin/dev fetch/merge up to date; C4 remains pending complete validation on this head.

### impl-209 · 2026-10-11T04:53:09.627Z

Final all suite submitted on 9f911ad: 3c7e3958-93db-4801-8504-f5691dd33e7f, worker PID 49969, queue position 4, reports topic-112/rev-13/impl-209. Fresh review request sent first. C4 stays pending; retaining claim and going idle for the hub result.

### rev-13 · 2026-10-11T04:54:14.023Z

verdict: review
result: clear
by: rev-13 [reviewer]
run: rev-13-20261011-209-5
commit: 9f911adbb59c541406c9020d059ee37aa72e6a8f

No high or medium findings. Both axes clear: ITEMS-002 initializes an isolated real dev build and binds initial/completion marks to its exact full SHA. Original80/120-column watched-save3/4→green4/4, authors/glyphs and width/highlight checks retained. Added empty commit asserts stale board0/4 4stale and itemlabel/glyph without source/timestamp edits. Production and prior C1–C3 coverage unchanged; A-1024 carries forward with fresh exact-head verification.

Independent typecheck/diff pass; clean pinned one-file delta. QA fixture lifecycle and frontmatter/abort semantics checked read-only. A-1036 reports red→green1/1; complete targeted output not supplied and writing suites not independently rerun.

C4 remains unverified pending complete same-head full run3c7e3958; no waiver. Old40b052d failure is not final evidence on9f911ad. A-1039: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1039-t-209-re-review-at-9f911ad-items-002-bound-to-real-head-c1-c3-clear.md

Criteria: C1 verified, C2 verified, C3 verified.

### impl-209 · 2026-10-11T05:38:38.560Z

Final same-head validation passed: suite 3c7e3958-93db-4801-8504-f5691dd33e7f at 9f911adbb59c541406c9020d059ee37aa72e6a8f, durable log A-1086 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1086-suite-3c7e3958-93db-4801-8504-f5691dd33e7f-all-at-9f911ad.log. Typecheck passed, hub1133/1133 and Neovim253/253, zero failed/cancelled/skipped/todo. Both repaired fixtures pass; no exception applied. Confirmed clean unchanged local/pushed head. C4 marked done and rev-13 notified for final verification. Retaining claim until merge.

### rev-13 · 2026-10-11T05:38:54.078Z

verdict: review
result: clear
by: rev-13 [reviewer]
run: rev-13-20261011-209-6
commit: 9f911adbb59c541406c9020d059ee37aa72e6a8f

No remaining high or medium findings. C4 verified at exact clean unchanged9f911ad: A-1086 full hub-owned run3c7e3958 executes typecheck+hub1133/1133+Neovim253/253, combined1386/1386,zero fail/cancel/skip/todo,exit0. Repaired ITEMS-002 and measured-resumption tests now pass. No exception applied.

Prior parallel Standards/Spec C1–C3 clear review A-1039 at this same head stands; final readiness clear. Full durable log inspected read-only, head/diff checks clean; writing suites notindependentlyrerun. Lead markedC4done withthisevidence.

A-1087: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1087-t-209-final-c4-at-9f911ad-full-1386-1386-clear.md

Criteria: C4 verified.

### impl-209 · 2026-10-11T05:42:53.491Z

Merged origin/dev da0d0c4 and pushed faa781198a6c4010afb044bd9c42237ca1d037cf. Sole Tracker.#viewOf conflict resolved retaining both plan-container approval and head-annotated criteria; plan approval/journal paths preserved. Typecheck and targeted tracker criteria6/6, verdict criteria4/4, plan approval2/2, task plan10/10, plan gate8/8 and merge criterion regressions3/3 pass. Final fetch/merge already up to date; clean pushed head. Integration artifact A-1088. Prior full suite covers 9f911ad only; requesting refreshed C1–C3 review and C4 same-head full suite, with no exceptions.

### impl-209 · 2026-10-11T05:43:03.287Z

Fresh review request sent to rev-13, then submitted final integrated-head all suite f95733ae-0048-4af5-b46a-70cea3b99bc3 on faa7811. Worker PID10569, queue position5, reports topic-112/rev-13/impl-209. Holding head stable and retaining claim; idle until the hub reports the result. C4 verification from9f911ad is stale at this new head.

### rev-13 · 2026-10-11T05:44:22.748Z

verdict: review
result: clear
by: rev-13 [reviewer]
run: rev-13-20261011-209-7
commit: faa781198a6c4010afb044bd9c42237ca1d037cf

No high or medium findings. Both axes clear: sole Tracker.#viewOf conflict retains plan approval spread and exact-head criteria annotation. Accepted-plan-hash approval, live authorization/launch checks and committed plan journals preserved; unpublished gate previews still avoid acceptance/journaling. T-209 exactSHA mark persistence, legacy-stale handling, done retention, freshness fanout and task/QA/epic gates intact. Reviewed T-210 protective assertions and prior QA/budget fixture fixes retained.

Independent typecheck/diff pass; clean pinned merge. A-1088 targeted33/33 is summary evidence, not complete logs; writing suites notindependentlyrerun. Prior C1–C3 implementation review carries forward with exact-head verification refreshed.

C4 remains unverified onfaa7811: old9f911ad mark/A-1086 is stale, not newhead evidence. Awaitallrunf95733ae; no exceptions apply becausehead containsT172/T210. Finalreadiness withheld. A-1089: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1089-t-209-integration-at-faa7811-approval-journal-retained-c1-c3-clear.md

Criteria: C1 verified, C2 verified, C3 verified.

### impl-209 · 2026-10-11T07:33:44.316Z

Integrated origin/dev343226b (stage QA and intervening dev changes), pushed clean head0230188b16ad585174e82da18f651ac6de8ccb05. Sole Tracker.#viewOf conflict resolved retaining approval, stages and exact-head #criteriaOf together. Typecheck passes; targeted criteria/gate/plan/stage tests44/44, including exact-head invalidation/restoration, independent epic demo, queued stage publication rechecks and ancestry recovery. Final fetch/merge up to date. Artifact A-1111 records integration and commands; A-1108 full pass covers previous faa7811 only. Requesting new-head delta review and full suite, no exceptions.

### impl-209 · 2026-10-11T07:33:54.501Z

Hub reconnected; new-head review request delivered to rev-13 before submitting all suite c638b068-582b-43d8-bae1-981f988c663d at0230188. Worker PID48873, project queue position6, reports topic-112/rev-13/impl-209. Keeping head stable and claim held; idle awaiting the hub result. C4 only to be verified from this new complete same-head run.

### rev-13 · 2026-10-11T07:36:54.630Z

verdict: review
result: clear
by: rev-13 [reviewer]
run: rev-13-20261011-209-8
commit: 0230188b16ad585174e82da18f651ac6de8ccb05

No high, medium or low findings in the stage-QA integration. Tracker.#viewOf retains approval/stages plus exact-head criteria annotation. Stage QA rejects criterion marks and ordinary gates exclude stage verdicts; stage ancestry freshness stays separate from final epic exact-head verification.

C1–C3 refreshed at 0230188. Independent typecheck/diff check passed; A-1111 records 44/44 targeted checks. A-1115 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1115-t-209-integration-at-0230188-stage-qa-and-head-bound-criteria-clear-suite-pendin.md records both axes and evidence.

C4 remains pending the complete new-head full suite. A-1108 at faa7811 is historical only; no exception applied. Final readiness withheld.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-209 · 2026-10-11T08:38:14.583Z

Final integrated-head validation passed: suite c638b068-582b-43d8-bae1-981f988c663d at0230188b16ad585174e82da18f651ac6de8ccb05. Durable log A-1140 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1140-suite-c638b068-582b-43d8-bae1-981f988c663d-all-at-0230188.log checked: typecheck passes, hub1151/1151 and Neovim254/254, combined1405/1405, zero fail/cancel/skip/todo, exit0. Confirmed clean unchanged local and pushed head. No exceptions applied. C4 remains done; requesting its exact-head verification from rev-13 and retaining claim until merge.

### rev-13 · 2026-10-11T08:38:57.481Z

verdict: review
result: clear
by: rev-13 [reviewer]
run: rev-13-20261011-209-9
commit: 0230188b16ad585174e82da18f651ac6de8ccb05

No high, medium or low findings. C4 verified at exact head 0230188 from complete A-1140: typecheck and npm test exit 0, hub 1151/1151 plus Neovim 254/254 = 1405/1405, zero failures/cancellations/skips/todo. Local/pushed head unchanged and clean; no exception applied.

Same-head C1–C3 and both clear axes from rev-13-20261011-209-8 / A-1115 stand. This completes the reviewed-head gate; historical faa7811 evidence was not used. A-1141 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1141-t-209-final-c4-at-0230188-full-1405-1405-clear.md records the final verification.

Criteria: C4 verified.

### coord · 2026-10-11T08:39:25.685Z

Merged 3c09642f31ba09f9a1cbbdfa4de2dca9fcce7675 onto dev.
