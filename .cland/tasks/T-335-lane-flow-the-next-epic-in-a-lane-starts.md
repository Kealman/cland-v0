---
id: T-335
kind: task
title: "Lane flow: epics follow epics, a follow is met on the last merge, and a merge hold keeps the follower off the predecessor's files until its demo"
state: open
status: ready
size: L
criterion_seq: 7
labels:
  - v0.1.3
  - hub
  - ready-for-agent
assignee: null
parent: E-423
blocked_by: []
topic: topic-277
branch: t/T-335-lane-flow-the-next-epic-in-a-lane-starts
created: 2026-10-13T14:23:44.027Z
updated: 2026-10-15T12:08:14.219Z
---

## Summary

The next epic in a lane starts when the previous epic's last ticket merges, not when its QA demo closes it. This ticket adds a `follows` relation between epics. A follow is met on the predecessor's last merge. A merge hold keeps the follower's tickets off the predecessor's files until its demo verdict. The clause and the skills cut the next epic while the last stage is in review.

## Parent

E-423 "Rules and rhythm" (R-294, v0.1.3), tracer bullet 2, "`follows` and the merge hold". Spec `docs/spec/v0.1.3.md` §3.4 and the epic's choices "The relation", "When a follow is met", "The merge hold" and "Preparing the next epic". GLOSSARY: Follows.

## Background

This started as an observation from the human and the stand-in on 2026-10-13 at 14:30Z. During v0.1.2 the crew went fully idle twice, because each lane serialized on the chain of last merge, integrated run, hub restart, epic QA demo, epic close, then the next epic's tickets and plan. The stand-in's interim lane-flow rule of 2026-10-13 (unlinked epics), and the human's 2026-10-15 instruction to start v0.1.3 on the last v0.1.2 merge, apply the same idea by hand.

## What to build

- **The relation.** `follows` is a list of epic ids in the item's frontmatter, beside `blocked_by`. It is set and removed with `task create --follows <id>`, `task link <id> --follows <id>` and `--unfollow <id>`, and the matching `task.link` tool fields. Any prefix resolves. The hub refuses a cycle, and an edge between items other than epics. `task view`, the card and the explorer show it beside `blocked_by`.
- **When a follow is met.** A follow is met when its predecessor is closed. It is also met when the predecessor has task children, all of them closed, and its last ticket merged. `task view` shows `follows E-<n>: met` or the tickets still open. Only `blocked_by` marks an item blocked in `task list` and the panels.
- **The merge hold.** While a predecessor epic is open, its follow is met and its demo is pending, the merge gate holds a ticket of a following epic if the ticket's diff touches a file that the predecessor's merges changed. Those files are read from the `Item:` trailers on `dev`. The refusal names the predecessor, its pending demo and the files, and the `merge` skill waits it out. A ticket with no overlap merges.
- **Preparing the next epic.** The Coordinator's clause (in `hub/src/roles/default-roles.ts` and `.cland/roles.toml`) and the `merge`, `to-tickets` and `plan-epic` skills say this: when every ticket of an epic's last stage is in review, cut the following epic's tickets and write its plan, so that its first stage launches on the last merge.
- **The file-surface helper.** The function that lists the files an epic's merges changed is exported for ticket T-459 (demo freshness) to reuse.

## Acceptance criteria

- [x] C1. `task create --follows`, `task link --follows/--unfollow` and the `task.link` tool set and remove `follows` in the frontmatter; a cycle and a non-epic edge are refused, proven by tests.
  - done: impl-335 · 2026-10-15T07:26:34.248Z
  - verified: rev-26 [reviewer] · run rev-20261015-335-final-1 · 2026-10-15T12:08:01.280Z · commit fcb1de325def92d9f0d18fc998893cf9ee39ca9e
- [x] C2. In a scratch project where E2 follows E1, `task view E2` shows `follows E-1: met` once E1's last ticket merges, and the open tickets before that; E2 is not marked blocked in `task list`.
  - done: impl-335 · 2026-10-15T07:26:35.534Z
  - verified: rev-26 [reviewer] · run rev-20261015-335-final-1 · 2026-10-15T12:08:01.281Z · commit fcb1de325def92d9f0d18fc998893cf9ee39ca9e
- [x] C3. A ticket of E2 whose diff touches a file E1's merges changed is refused at the merge gate with the predecessor, its pending demo and the files named, while a ticket with no overlap merges; both proven by tests.
  - done: impl-335 · 2026-10-15T07:37:23.936Z
  - verified: rev-26 [reviewer] · run rev-20261015-335-final-1 · 2026-10-15T12:08:01.281Z · commit fcb1de325def92d9f0d18fc998893cf9ee39ca9e
- [x] C4. The hold lifts when E1 receives its clear demo verdict or closes, proven by a test.
  - done: impl-335 · 2026-10-15T07:26:38.112Z
  - verified: rev-26 [reviewer] · run rev-20261015-335-final-1 · 2026-10-15T12:08:01.282Z · commit fcb1de325def92d9f0d18fc998893cf9ee39ca9e
- [x] C5. The card and the explorer show `follows` beside `blocked_by`.
  - done: impl-335 · 2026-10-15T07:26:39.039Z
  - verified: rev-26 [reviewer] · run rev-20261015-335-final-1 · 2026-10-15T12:08:01.283Z · commit fcb1de325def92d9f0d18fc998893cf9ee39ca9e
- [x] C6. The Coordinator clause in both places and the `merge`, `to-tickets` and `plan-epic` skills describe follows, the met rule, the hold and preparing the next epic during the last stage's review.
  - done: impl-335 · 2026-10-15T07:39:48.888Z
  - verified: rev-26 [reviewer] · run rev-20261015-335-source-3 · 2026-10-15T07:40:56.538Z · commit bbe943079f12a43dcc707d527fe718b9a58ddfd6
  - verified: rev-26 [reviewer] · run rev-20261015-335-source-4 · 2026-10-15T08:09:52.728Z · commit fd823c6e0262f771cf4ae32bf68ea58794b7f9e2
  - verified: rev-26 [reviewer] · run rev-20261015-335-source-5 · 2026-10-15T08:29:23.109Z · commit 7ea539c76f214ab1b4a8912ec20d70636fd97fd0
  - verified: rev-26 [reviewer] · run rev-20261015-335-source-6 · 2026-10-15T10:00:41.032Z · commit b6ba04e77de9d9635c00946f526e6edacaeb8ab4
  - verified: rev-26 [reviewer] · run rev-20261015-335-source-7 · 2026-10-15T11:00:26.690Z · commit fcb1de325def92d9f0d18fc998893cf9ee39ca9e
  - verified: rev-26 [reviewer] · run rev-20261015-335-final-1 · 2026-10-15T12:08:01.283Z · commit fcb1de325def92d9f0d18fc998893cf9ee39ca9e
- [x] C7. `hub/README.md` and GLOSSARY's Follows entry describe the relation, the met rule and the hold.
  - done: impl-335 · 2026-10-15T07:26:40.394Z
  - verified: rev-26 [reviewer] · run rev-20261015-335-source-3 · 2026-10-15T07:40:56.538Z · commit bbe943079f12a43dcc707d527fe718b9a58ddfd6
  - verified: rev-26 [reviewer] · run rev-20261015-335-source-4 · 2026-10-15T08:09:52.728Z · commit fd823c6e0262f771cf4ae32bf68ea58794b7f9e2
  - verified: rev-26 [reviewer] · run rev-20261015-335-source-5 · 2026-10-15T08:29:23.109Z · commit 7ea539c76f214ab1b4a8912ec20d70636fd97fd0
  - verified: rev-26 [reviewer] · run rev-20261015-335-source-6 · 2026-10-15T10:00:41.033Z · commit b6ba04e77de9d9635c00946f526e6edacaeb8ab4
  - verified: rev-26 [reviewer] · run rev-20261015-335-source-7 · 2026-10-15T11:00:26.690Z · commit fcb1de325def92d9f0d18fc998893cf9ee39ca9e
  - verified: rev-26 [reviewer] · run rev-20261015-335-final-1 · 2026-10-15T12:08:01.283Z · commit fcb1de325def92d9f0d18fc998893cf9ee39ca9e

## Comments

### impl-335 · 2026-10-15T07:17:12.825Z

Implementation started. Read E-423 choices and spec §3.4; following the epic decision that any recorded demo verdict releases the overlap hold. Building tracker/CLI/tool relation, merge surface helper/gate, UI and clause/skill/docs updates.

### rev-26 · 2026-10-15T07:31:10.015Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261015-335-source-1
commit: 4913d542707de4844202114a620dc36120cfd1aa
scope: full

High — .cland/roles.toml:59 / hub/src/roles/default-roles.ts:70: lane paragraph grows raw project Coordinator clause to7690 bytes before wrapping; unchanged roles.test.ts:80 requires complete reply<=7680, and normal wrapping exceeds8192 send cap. Medium — hub/src/hub/merge.ts:50–60,149–156: follows/predecessor snapshots survive async epicMergeFiles without revalidation; an edge added during final lookup can evade the new predecessor's pending-demo hold. Revalidate lane and same-task gate inputs after awaits; add external-Git barrier regression. Either QA result lifting the hold matches E-423's explicit decision. No Reviewer tests run. Evidence A-2724: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2724-t-335-source-not-clear-at-4913d542-clause-size-and-lane-publication-revalidation.md.

Criteria: C6 failed (Coordinator clause exceeds existing reply headroom and wrapped send-size budget; compact both copies without weakening guards.), C3 failed (Lane facts captured before async surface lookup are not revalidated; adding a predecessor during final lookup can bypass its overlap hold.).

### impl-335 · 2026-10-15T07:37:26.709Z

Addressed A-2724: compacted both Coordinator clauses; unchanged default/project snapshot budget checks pass. Added external Git barriers proving the final-lookup added-follows and changed-review races, then fixed publication revalidation with indexed laneRevision plus fresh task gate view. Both regressions failed before the fix and pass after it; full follows file now 10/10 (34.4s). See correction artifact for details; corrected-head re-review follows, no verification run yet.

### rev-26 · 2026-10-15T07:39:15.260Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261015-335-source-2
commit: cbd9f4527a88e75478122d6ba5b9430a6458406c
scope: full

Medium — hub/src/roles/default-roles.ts:70 / .cland/roles.toml:59: compact lead-ownership and unclaimed-fallback sentences mismatch unchanged review-qa.test.ts:104–105. Byte headroom itself is corrected (trimmed project clause6968 bytes; snapshots2/2 reported). C3 publication correction inspected: laneRevision validation beside final refreshed task verdict/message check rejects changed indexed lane/gate inputs; external final-Git barriers reproduce both old races and pass after correction with refs unchanged. No new synchronous file I/O. Remaining blocker is C6; surface metadata guards apply to unchanged roles and are unaffected. No Reviewer tests run. Evidence A-2730: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2730-t-335-source-re-review-at-cbd9f452-publication-race-fixed-clause-wording-guards-.md.

Criteria: C6 failed (Compact Coordinator wording no longer matches unchanged review-qa.test.ts:104–105 lead-ownership/fallback assertions; restore canonical phrases within byte budget.).

### rev-26 · 2026-10-15T07:40:56.538Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261015-335-source-3
commit: bbe943079f12a43dcc707d527fe718b9a58ddfd6
scope: full

No high/medium findings remain. Coordinator canonical ownership/fallback phrases restored; project default-crew reply7615 bytes fits unchanged7680 limit. Unchanged clause guards reported green A-2731. Corrected gate/tracker/test files unchanged from cbd9f452: indexed lane revision plus fresh final task merge view rejects concurrent follows/verdict edits after Git awaits. Exact surfaces and either-demo-verdict/closure release match E-423. C6/C7 skills/docs/clauses verified from source; C1–C5 final execution settlement awaits accepted same-head no-mode verify with configured executor, no override. Prior targeted lane/UI/workload evidence retained; no Reviewer tests run. Evidence A-2733: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2733-t-335-corrected-source-clear-at-bbe94307-follows-gate-and-clause-guards-preserve.md.

Criteria: C6 verified, C7 verified.

### rev-26 · 2026-10-15T08:06:42.865Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261015-335-evidence-1
commit: bbe943079f12a43dcc707d527fe718b9a58ddfd6
scope: evidence

Medium — hub/test/planned-stage.test.ts:249: stage landing used 11,442 queries against the unchanged <10,000 budget; lead reproduced 11,531 locally. Per-row follows hydration at hub/src/tracker/index-db.ts:440 is under controlled diagnosis.
Medium — hub/test/claude-code-adapter.test.ts:395: latched signed-out restart observed three CLI calls rather than two.
Medium — hub/test/claude-code-sessions.test.ts:44: signal-order test timed out waiting for the clause busy→idle turn before exercising signal ordering.
Medium — hub/test/suite.test.ts: the head-change cache preservation case took 5.047s and failed the enforced undeclared-duration gate.
Accepted receipt 391d9b46/A-2753 matches reviewed bbe94307 but exits 1: 1730 tests, 1724 pass, 3 fail, 3 platform skips; Neovim not reached. Executor c-8 lon1/Linux, lifetime 1409s, cost $0.0978, peak load 13.64. C1–C5 remain unverified; C6/C7 source marks retained. No failed criterion is assigned without demonstrated criterion-specific failure. Diagnostic attribution and any changed-head source re-review are pending; this is not a green full receipt.

### rev-26 · 2026-10-15T08:09:52.728Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261015-335-source-4
commit: fd823c6e0262f771cf4ae32bf68ea58794b7f9e2
scope: full

No high or medium source findings remain. hub/src/tracker/index-db.ts:167 loads ordered follows JSON in each existing get/list/children row SELECT; all hydration callers supply it, canonical IDs/edge order and empty omission are preserved, and the extra per-row prepare/execute is removed. Unchanged planned-stage budget red 11,531 → green 9,698 landing / 7,718 ten closes; A-2759 also records complete follows 10/10 and typecheck. Existing assertions, publication guards, follows policy and clauses remain unchanged. The inherited 5.047s cache test receives a reasoned allowance without changing enforcement or assertions.
Coordinator 7ed283d3 confirms the separate Claude failures are T-461/T-447, excludes their fixes here and permits corrected-source re-review/rerun. Old receipt A-2753 remains red; C1–C5/final settlement await accepted exact-head verification. Renew C6/C7 source marks. The v0.1.3 merge hold remains. No tests run by Reviewer.

Criteria: C6 verified, C7 verified.

### rev-26 · 2026-10-15T08:28:29.215Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261015-335-evidence-2
commit: fd823c6e0262f771cf4ae32bf68ea58794b7f9e2
scope: evidence

Medium — hub/test/follows.test.ts:98: not-clear demo lifecycle case took 5.297s without a required reasoned duration allowance.
Medium — hub/test/follows.test.ts:108: predecessor-close lifecycle case took 5.339s without an allowance.
Exact reviewed-head receipt a22c5ecf/A-2772 selected full, hub assertions all pass 1730/1730, but exits 1 on duration enforcement and never runs Neovim. Local executor was hub-selected fallback after remote budget 2/2 full, with no override; darwin arm64/Node24.21/Neovim0.12.5, wall1054.18s, peakload19.42. Previous query and Claude assertion failures are absent in this receipt. Keep bodies/default bounds intact; any reasoned manifest correction needs changed-head source review. No semantic criterion failure is inferred: C1–C5 final marks pending, C6/C7 source marks retained. v0.1.3 merge hold remains.

### rev-26 · 2026-10-15T08:29:23.109Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261015-335-source-5
commit: 7ea539c76f214ab1b4a8912ec20d70636fd97fd0
scope: delta

No high or medium findings. Manifest-only delta adds measured 5.297s/5.339s allowances for the two real-Git lifecycle cases, with reasons matching overlap refusal, demo/closure and follower landing. Default enforcement, runner and assertions are unchanged. Functional source, UI, follows tests, clauses, skills and docs are byte-identical to fd823c6e; origin/dev integration adds tracker records. Renew C6/C7 source marks. C1–C5 and final verdict await accepted exact-head verification; A-2772 remains a failed duration-gate receipt despite all hub assertions passing. No Reviewer tests run.

Criteria: C6 verified, C7 verified.

### rev-26 · 2026-10-15T08:55:42.729Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261015-335-evidence-3
commit: 7ea539c76f214ab1b4a8912ec20d70636fd97fd0
scope: evidence

Medium — hub/test/claude-code-sessions.test.ts:251/271: two cases time out at the initial 15s clause-injection wait (known T-447 fixture family).
Medium — hub/test/codex-adapter.test.ts:734: expected turn/steer record for the taken-up message is absent; attribution remains open.
Medium — hub/test/daemon.test.ts: fixture-startup sweep case crosses the enforced undeclared duration gate at 5.010s.
Exact-head full receipt c0b5ddc2/A-2794 exits 1: 1730 tests, 1724 pass, 3 fail, 3 existing platform skips; Neovim not reached. Droplet c-8 lon1/Linux, lifetime 1425s, cost $0.0989, wall 1332.72s, peak load 13.77. Follows assertions, query budget and corrected allowances no longer fail, but C1–C5 final marks remain pending; C6/C7 source marks retained. No criterion-specific semantic failure is inferred. Named shared fixes or manifest corrections require new source review before another run.

### impl-335 · 2026-10-15T09:04:25.840Z

A-2794 follow-up per Coordinator: merged refreshed dev manifest at a8a8ac33 (daemon startup case now known; own allowances retained). Ran whole codex-adapter.test.ts five times serially at that head: 5/5 green, 35/35 each (112.676s, 99.662s, 89.725s, 80.788s, 63.293s). Durable logs A-2798, A-2800, A-2803, A-2805, A-2807. No adapter or test edits. Holding full verification for Coordinator's named T-447 shared commit, then combined delta source review before the single resubmit.

### rev-26 · 2026-10-15T10:00:41.033Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261015-335-source-6
commit: b6ba04e77de9d9635c00946f526e6edacaeb8ab4
scope: delta

No high or medium findings. Own follows source/tests, publication guards, UI, clauses, skills/docs are byte-identical to 7ea539c7. Reviewed standalone shared T-442 30a98a6d UTC clock boundary assertions and T-446 5c492862 accepted-RPC readiness wait; existing behavior assertions/timeouts remain, integrated files exactly match dev. Manifest retains all five own/inherited allowances. Current-head UI 15/15+2/2 and typecheck reported green.
Coordinator b4ec2b7f explicitly permits A-2794's passing Linux hub evidence plus one same-head no-mode --executor local gate for macOS Neovim; Linux Neovim is owed at E-423 stage-1 close. A-2794 remains red overall and never ran Neovim. Renew C6/C7; C1–C5/final settlement await the authorized local receipt. No Reviewer tests run.

Criteria: C6 verified, C7 verified.

### rev-26 · 2026-10-15T10:48:53.279Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261015-335-evidence-4
commit: b6ba04e77de9d9635c00946f526e6edacaeb8ab4
scope: evidence

Execution incomplete: A-2893/6dd1546e exits 143 after Coordinator-requested cancellation, with only 37/37 free-shard counts complete; machine shard interrupted, Neovim not run. No source or semantic failure inferred and no criterion failed. C1–C5 final marks pending; C6/C7 source marks retained.
Coordinator 9f7d6175 explicitly preserves the local exception: wait for named T-487 commit, cherry-pick only it, get delta review, then one replacement no-mode --executor local gate. A-2794 Linux hub evidence and E-423 later Linux Neovim obligation remain as b4ec2b7f directs. No Reviewer tests run.

### rev-26 · 2026-10-15T11:00:26.690Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261015-335-source-7
commit: fcb1de325def92d9f0d18fc998893cf9ee39ca9e
scope: delta

No high or medium findings. Exact shared T-487 1419bc34 pick only; fixed clock aligns generated timestamps and visibility, retains CLAND_STUB_NOW override, and explicit archive cases keep eight-day/recent boundary assertions. No production clock/timeout change. All three shared files match; T-335 source/tests/publication guards/UI/clauses/docs remain byte-identical to b6ba04e7. Current layers 14/14, explorer-card 15/15, item-prefixes 2/2 and typecheck reported green.
Renew C6/C7. C1–C5/final settlement await the replacement no-mode --executor local gate preserved by Coordinator 9f7d6175; prior A-2893 cancellation does not consume it. A-2794 Linux hub evidence and b4ec2b7f disposition remain, with Linux Neovim owed at E-423 stage-1 close. No Reviewer tests run.

Criteria: C6 verified, C7 verified.

### impl-335 · 2026-10-15T12:06:29.801Z

Authorized local Neovim package phase completed at source-clear fcb1de325def92d9f0d18fc998893cf9ee39ca9e: `npm run test:nvim -- nvim/test/*.test.ts`, normal lease, exit0, 387/387 pass, no failures/skips/cancellations. Durable full log A-2960. Darwin arm64 Node24.21.0, suite219.44s, peakload44.68; collected under load, existing phase allowed to finish after load rule. Final evidence sent to Reviewer: Linux hub A-2794+A-2935 plus local UI A-2960 and Coordinator 5bed3f06/90193e8c/d05c60c7 disposition. Linux Neovim remains E-423 stage-1 close obligation. Clean tree; no further test runs.

### rev-26 · 2026-10-15T12:08:01.284Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261015-335-final-1
commit: fcb1de325def92d9f0d18fc998893cf9ee39ca9e
scope: evidence

No outstanding high or medium findings. C1–C4 pass through all ten follows cases in both Linux hub receipts, including exact merge surfaces, demo/closure release and concurrent follows/verdict revalidation. C5 is covered by same-head A-2960: explicit all-36-file local Neovim package run, 387/387 pass, zero fail/cancel/skip, normal lease; loaded green (peak 44.68), not a quiet/performance claim. Branch/worktree head still fcb1de32 and worktree clean. C6/C7 reviewed source remains unchanged.
Final gate expressly follows Coordinator 1742ad5b and 5bed3f06, plus 90193e8c/d05c60c7: A-2794 and A-2935 are the accepted Linux hub pair with disjoint known failures and own hub green; A-2960 supplies local UI coverage. Neither Linux receipt is represented as green overall. Linux Neovim remains owed at E-423 stage-1 close after T-454/T-455/T-335 merge, with any attributed defect fixed forward there. Cancelled attempts provide no coverage. Final evidence A-2962. No Reviewer tests run.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified.
