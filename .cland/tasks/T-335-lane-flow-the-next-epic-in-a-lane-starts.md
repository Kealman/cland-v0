---
id: T-335
kind: task
title: "Lane flow: epics follow epics, a follow is met on the last merge, and a merge hold keeps the follower off the predecessor's files until its demo"
state: open
status: review
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
updated: 2026-10-15T07:40:56.538Z
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
- [x] C2. In a scratch project where E2 follows E1, `task view E2` shows `follows E-1: met` once E1's last ticket merges, and the open tickets before that; E2 is not marked blocked in `task list`.
  - done: impl-335 · 2026-10-15T07:26:35.534Z
- [x] C3. A ticket of E2 whose diff touches a file E1's merges changed is refused at the merge gate with the predecessor, its pending demo and the files named, while a ticket with no overlap merges; both proven by tests.
  - done: impl-335 · 2026-10-15T07:37:23.936Z
- [x] C4. The hold lifts when E1 receives its clear demo verdict or closes, proven by a test.
  - done: impl-335 · 2026-10-15T07:26:38.112Z
- [x] C5. The card and the explorer show `follows` beside `blocked_by`.
  - done: impl-335 · 2026-10-15T07:26:39.039Z
- [x] C6. The Coordinator clause in both places and the `merge`, `to-tickets` and `plan-epic` skills describe follows, the met rule, the hold and preparing the next epic during the last stage's review.
  - done: impl-335 · 2026-10-15T07:39:48.888Z
  - verified: rev-26 [reviewer] · run rev-20261015-335-source-3 · 2026-10-15T07:40:56.538Z · commit bbe943079f12a43dcc707d527fe718b9a58ddfd6
- [x] C7. `hub/README.md` and GLOSSARY's Follows entry describe the relation, the met rule and the hold.
  - done: impl-335 · 2026-10-15T07:26:40.394Z
  - verified: rev-26 [reviewer] · run rev-20261015-335-source-3 · 2026-10-15T07:40:56.538Z · commit bbe943079f12a43dcc707d527fe718b9a58ddfd6

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
