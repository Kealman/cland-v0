---
id: T-179
kind: task
title: "Asks up the chain: a lead answers or forwards an ask one level up; only
  the root's lead asks the human"
state: closed
status: done
criterion_seq: 4
labels:
  - v0.1
  - ready-for-agent
assignee: impl-179
parent: E-113
blocked_by:
  - T-176
topic: topic-108
branch: t/T-179-asks-up-the-chain-a-lead-answers-or
created: 2026-10-10T15:38:36.263Z
updated: 2026-10-11T03:31:18.316Z
closed: 2026-10-11T03:31:18.544Z
---

## Parent

T-113, slice 4 of 7. Read the epic's Contents, its choices where the spec is silent, and its Constraints, which apply to this slice.

## What to build

A lead answers an ask from below or forwards it unchanged with one call; only the root's lead asks the human; the topic waits on the right party at each step.

## Acceptance criteria

- [x] C1. The behaviour above works end to end through the v0 seams: the hub frame protocol, the fake harnesses and headless Neovim where the UI is touched.
  - done: impl-179 · 2026-10-10T22:25:03.505Z
  - verified: rev-14 [reviewer] · run rev-20261011-179-3 · 2026-10-10T22:26:16.475Z
  - verified: rev-14 [reviewer] · run rev-20261011-179-4 · 2026-10-10T23:27:08.587Z
  - verified: rev-14 [reviewer] · run rev-20261011-179-5 · 2026-10-11T00:23:00.856Z
  - verified: rev-14 [reviewer] · run rev-20261011-179-7 · 2026-10-11T01:42:54.437Z
  - verified: rev-14 [reviewer] · run rev-20261011-179-8 · 2026-10-11T02:26:27.487Z
  - verified: rev-14 [reviewer] · run rev-20261011-179-11 · 2026-10-11T03:02:08.750Z
- [x] C2. Demo: an Implementer's question goes to `lead-1`, which forwards it; the Coordinator turns it into an ask for the human.
  - done: impl-179 · 2026-10-10T22:04:05.233Z
  - verified: rev-14 [reviewer] · run rev-20261011-179-1 · 2026-10-10T22:13:14.941Z
  - verified: rev-14 [reviewer] · run rev-20261011-179-2 · 2026-10-10T22:21:34.076Z
  - verified: rev-14 [reviewer] · run rev-20261011-179-3 · 2026-10-10T22:26:16.475Z
  - verified: rev-14 [reviewer] · run rev-20261011-179-4 · 2026-10-10T23:27:08.588Z
  - verified: rev-14 [reviewer] · run rev-20261011-179-5 · 2026-10-11T00:23:00.857Z
  - verified: rev-14 [reviewer] · run rev-20261011-179-7 · 2026-10-11T01:42:54.437Z
  - verified: rev-14 [reviewer] · run rev-20261011-179-8 · 2026-10-11T02:26:27.487Z
  - verified: rev-14 [reviewer] · run rev-20261011-179-11 · 2026-10-11T03:02:08.750Z
- [x] C3. Docs (hub/README.md, nvim/README.md or docs/) describe what changed; any role clause change lists the exact .cland/roles.toml lines in the handover.
  - done: impl-179 · 2026-10-10T22:04:05.364Z
  - verified: rev-14 [reviewer] · run rev-20261011-179-1 · 2026-10-10T22:13:15.152Z
  - verified: rev-14 [reviewer] · run rev-20261011-179-2 · 2026-10-10T22:21:34.265Z
  - verified: rev-14 [reviewer] · run rev-20261011-179-3 · 2026-10-10T22:26:16.475Z
  - verified: rev-14 [reviewer] · run rev-20261011-179-4 · 2026-10-10T23:27:08.588Z
  - verified: rev-14 [reviewer] · run rev-20261011-179-5 · 2026-10-11T00:23:00.857Z
  - verified: rev-14 [reviewer] · run rev-20261011-179-7 · 2026-10-11T01:42:54.438Z
  - verified: rev-14 [reviewer] · run rev-20261011-179-8 · 2026-10-11T02:26:27.488Z
  - verified: rev-14 [reviewer] · run rev-20261011-179-11 · 2026-10-11T03:02:08.751Z
- [x] C4. `npm run typecheck && npm test` pass (or `npm run test:nvim` for a Neovim-only slice).
  - done: impl-179 · 2026-10-11T03:28:48.296Z
  - verified: rev-14 [reviewer] · run rev-20261011-179-12 · 2026-10-11T03:30:57.891Z

## Comments

### impl-179 · 2026-10-10T21:49:34.622Z

Claimed T-179 in its task worktree. Testing at the epic's pre-agreed hub frame/real-spoke seam; implementing local answers, unchanged one-call forwarding, root-only human asks and waiting-party state. Reading T-176/T-177 routing and coordinating overlap with T-178.

### impl-179 · 2026-10-10T22:02:12.459Z

Implemented durable incoming questions via send kind=question, one-call ask.forward and local ask.answer, root-only human asks, exact question preservation, identity-bound recipients and topic waitingFor. Three protocol scenarios cover local/human answers, epic+release hops through fake harnesses, cancellation, restart and duplicate/foreign actions. The headless thread regression covers agent cards outside the human inbox. Also fixed the harness reply hint and unresolved-question role-state visibility. Dummy interim callback proof A-816 passed; C4 is still pending the full suite.

### impl-179 · 2026-10-10T22:09:20.492Z

Final implementation pushed at 53142681158b70397884ff442c35e5e9bcb98ec0. Fetched/merged origin/dev (83f0698), no conflicts. Local two-axis review completed; rename identity and displayed-card findings fixed, no remaining findings. Targeted protocol4/4 (A-824), rename card/wait/answer (A-827), MCP surface3/3 (A-828), headless card (A-819), permissions and typecheck pass. C1-C3 done; C4 pending own full suite. Exact role-file handover remains A-820.

### rev-14 · 2026-10-10T22:13:15.322Z

verdict: review
result: not clear
by: rev-14 [reviewer]
run: rev-20261011-179-1
commit: 53142681158b70397884ff442c35e5e9bcb98ec0

Medium — hub/src/hub/asks.ts:86: Coordinator handover leaves the pending ask tied to the revoked holder; its new holder cannot answer/forward, violating ADR 0001/0006 role-bound state.
Medium — hub/src/hub/core.ts:600: After reparenting, the original receiving Lead can forward the ask to the task's Implementer, reversing the upward chain required by v0.1 §3.7.
Medium — hub/src/hub/asks.ts:66: Aide recipients can acquire tracked asks although their fixed permission boundary forbids both settling tools, leaving an unactionable wait (§3.3).
All three reproduced with actual HubCore and memory Store, no disk changes. Independent Standards/Spec axes and probe source: A-834 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-834-t-179-review-not-clear-at-5314268-ask-ownership-and-routing.md.
C2/C3 separately verified in this run; C1 failed; C4 pending complete final-head suite.

Criteria: C1 failed (Pending asks retain revoked recipients, may forward down after reparenting, and can wait on an Aide forbidden to answer or forward.).

### impl-179 · 2026-10-10T22:19:43.943Z

Fixed rev-20261011-179-1 medium findings at 4cf683d90533bfefe8a76288259543c60359a059, pushed to origin. Agent ask endpoints move atomically/durably with handover; stale receiving Leads cannot forward outside current ancestry; Aide questions remain ordinary sends. Protocol regressions7/7 (A-837), upstream return after asker handover1/1 (A-838), typecheck pass. Local two-axis follow-up review reports no remaining findings. origin/dev fetched/merged again (83f0698); worktree clean. C1 re-marked done, requesting rev-14 again. New own full suite starts only after previous run settles, using the same proved one-report callback.

### rev-14 · 2026-10-10T22:21:34.422Z

verdict: review
result: not clear
by: rev-14 [reviewer]
run: rev-20261011-179-2
commit: 4cf683d90533bfefe8a76288259543c60359a059

Medium — hub/src/hub/store.ts:1139: Exact identity matching misses pending asks transferred to a never-connected successor after its first hello binds a real id. core.ts:1492 stores name:<successor>; store.ts:398 updates only sessions. A second handover leaves the ask with the revoked predecessor, and a rename makes even its current holder fail authorization. Adopt both actionable ask endpoint columns with identity binding; cover unseen successor -> hello -> rename/re-handover.
Actual HubCore/Store(:memory:) probes confirm both supported human-role-move cases. Original three findings are corrected. Standards/Spec axes, probe source and evidence: A-844 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-844-t-179-re-review-not-clear-at-4cf683d-provisional-ask-identities.md.
C1 failed; C2/C3 separately verified for this run. C4 pending; obsolete-head A-842 exit130 does not qualify.

Criteria: C1 failed (Ask endpoint ids remain provisional after an unseen handover successor connects, so rename or a later handover strands the pending ask.).

### impl-179 · 2026-10-10T22:25:03.569Z

Fixed rev-20261011-179-2 provisional identity finding at d8c93aeec4982a20a1295eb1e3826ff3766f31cb, pushed to origin. Real session binding now adopts recipient and return endpoint ids transactionally, including retained aliases. Protocol2/2 (A-847) covers unseen→connect→rename→re-handover and return-path adoption; typecheck passes, local two-axis follow-up review has no findings. origin/dev83f0698 fetched/merged again; clean. Obsolete4cf683d run cancelled cleanly (A-845 exit130). C1 re-marked done; external rev-14 request and own final-head package suite next.

### rev-14 · 2026-10-10T22:26:16.475Z

verdict: review
result: clear
by: rev-14 [reviewer]
run: rev-20261011-179-3
commit: d8c93aeec4982a20a1295eb1e3826ff3766f31cb

No high or medium findings remain. Standards and Spec reviews are clear: session binding atomically adopts both actionable ask endpoints from provisional current names and retained aliases; unknown remains provisional. Independent memory probes confirm offline successor rename/re-handover, return routing, alias adoption and nested transactions. Earlier reparent/Aide/identified-handover fixes remain correct.
C1-C3 checked through protocol evidence A-8472/2, prior A-8377/7/A-8381/1, unchanged headless/surface evidence, docs and exact role-file handover A-820. C4 remains pending complete passing package validation on this head; no full suite rerun by Reviewer.
Evidence A-849 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-849-t-179-review-clear-at-d8c93ae-c1-c3-verified-c4-pending.md.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-179 · 2026-10-10T23:24:07.081Z

Pushed combined head b2ef37714cb4b9780316fb9f17a20a0e9439b1b7 after merging origin/dev 01ea28d. Fixed Aide diagnostic precedence; Node24 typecheck, ask-chain 10/10, Aide 6/6 recheck, guard-ticket 1/1 and Neovim card 1/1 pass (A-879–A-882). Local Standards/Spec review clear. New named review and full Node24 suite follow; C4 remains pending.

### rev-14 · 2026-10-10T23:27:08.588Z

verdict: review
result: clear
by: rev-14 [reviewer]
run: rev-20261011-179-4
commit: b2ef37714cb4b9780316fb9f17a20a0e9439b1b7

No high or medium findings remain. Standards and Spec axes are clear on the combined T-190/T-207 head. The Aide diagnostic order is fixed; identity adoption and one-hop routing remain correct. Actual memory probe confirms agent cards/answers follow the explicit Now exception while human inbox needsYou stays 0. C1-C3 verified through A-879 chain10/10, A-880 Aide6/6, A-882 headless1/1, routing/docs and unchanged exact role handover A-820. C4 pending complete passing final-head package validation; targeted tests do not establish it. Evidence A-884 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-884-t-179-combined-head-review-clear-at-b2ef377-c4-pending.md.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-179 · 2026-10-11T00:21:23.220Z

A-921 full Node24 suite had one failure: daemon.test.ts expected three adjacent shutdown logs; startup orphan sweep completion legally interleaves because stop closes the socket then awaits sweep. Correcting the test-only adjacency assumption. Socket inode, daemon exit, discovery removal, exact ordered stopping/socket-kept/stopped and actual terminal stopped are retained. Captured trace red/green replay confirms reordered/missing/late/error events still fail. Targeted socket test passes; full daemon file/typecheck and local review in progress before a new reviewed-head full suite.

### impl-179 · 2026-10-11T00:22:13.533Z

Pushed a1bec5c93bad531d0fac8307000d6d0a1cb96ea0: test-only shutdown-log correction permits startup sweep interleaving and retains ordered shutdown, terminal stopped and all process/socket/discovery safety assertions. Node24 daemon file14/14 and typecheck pass; local Standards/Spec clear. Fetched/merged origin/dev01ea28d again, clean. Diagnosis/captured red-green replay A-923. Fresh named review and final-head full suite next; C4 pending.

### rev-14 · 2026-10-11T00:23:00.857Z

verdict: review
result: clear
by: rev-14 [reviewer]
run: rev-20261011-179-5
commit: a1bec5c93bad531d0fac8307000d6d0a1cb96ea0

No high or medium findings. Both axes clear: test-only change permits supported orphan-sweep interleaving while preserving exact ordered shutdown, actual terminal stopped and process/inode/discovery assertions. Actual branch assertion replay passes3 permitted traces and rejects6 failure traces. A924Node24daemon14/14 passes. T179 production/docs/rolehandoverA820 unchanged; C1-C3 carryforward/reverified fromA884. C4 remains pending completepassing final-headpackage; A921 prior failuredoesnotqualify. Evidence A-925 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-925-t-179-shutdown-assertion-delta-clear-at-a1bec5c-c4-pending.md.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-179 · 2026-10-11T01:12:46.877Z

A-947 same-head hub phase1085/1086 has solely request-guard flood554ms failure; zero cancellations/skips/todo. Verified Coordinator standing40a3548f and flood amendment63aba695 against same-way dev01ea28d failure A-911. Reviewer A-948 accepts named T-172 flood exception. Completing typecheck and full Neovim package phase on unchanged a1bec5c per allowed split-run rule; rationale A-949. No code changes or additional waived failures.

### rev-14 · 2026-10-11T01:37:00.670Z

verdict: review
result: clear
by: rev-14 [reviewer]
run: rev-20261011-179-6
commit: a1bec5c93bad531d0fac8307000d6d0a1cb96ea0

No new code findings; A-925 Standards/Spec and C1-C3 clearance unchanged. A-957 typecheck0, Neovim starts/passing cases then exit130 without a completed summary. Cancellation cause not established. No regression attributed, but C4 remains unverified and no criterion marks change. Standing flood exception does not waive unfinished phase evidence; retain A-947 hub evidence and supply a complete same-head Neovim result.
Evidence A-958 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-958-t-179-a-957-incomplete-neovim-validation-code-clearance-unchanged.md.

### impl-179 · 2026-10-11T01:40:31.274Z

Resolved and pushed merge with origin/dev1c2f5d6 at2dcb539aaa2f13142f37c458d53df8f7d7e8d851. Ask/artifact grants and MCP inventory unioned; sendFromSession preserves suite stable-ID/all-recipient arguments and appends answerTo. Node24 typecheck and targeted ask-chain10/10(A-964), suite-report11/11(A-965), artifact-folders7/7(A-966), Aide6/6(A-967), recovery2/2(A-961), Neovim card1/1(A-962). Initial permissions4/5 seed-order mismatch fixed, replay1/1(A-963/A-968). Final local Standards/Spec clear. Exact updated roles lines/patch in A-969 supersedes A-820. Refetched/merged dev again, clean. Pinned delta review and cland suite all next, C4 pending.

### rev-14 · 2026-10-11T01:42:54.438Z

verdict: review
result: clear
by: rev-14 [reviewer]
run: rev-20261011-179-7
commit: 2dcb539aaa2f13142f37c458d53df8f7d7e8d851

No high or medium findings. Standards and Spec axes clear: merge preserves suite stable IDs/all-recipient admission, appended ask answerTo, atomic message/ask updates, combined artifact/ask grants and fixed Aide/QA boundaries. C1–C3 verified through A-961–A-967, source review and exact updated role handover A-969. Independent memory HubCore diagnostic confirms tracked answers and Now projections without human inbox entries. C4 remains pending complete current-head package validation; obsolete cancellation A-957 and targeted passes do not establish it. Evidence A-972 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-972-t-179-merged-integration-review-clear-at-2dcb539-c4-pending.md.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-179 · 2026-10-11T02:24:29.918Z

Merged current dev4990b6a (T-172) with its actual daemon.test.ts conflict resolved, pushed clean25a9d6a19dd73f6d75cf5bed1b18694b6abc0384. Retained reviewed ordered shutdown and actual terminal stopped; all other upstream stabilization changes kept. Node24 typecheck, request-guard14/14(A-986), socket1/1(A-987), Neovim card1/1(A-988), local Standards/Spec clear. Role handover A-969 unchanged; final integration note A-989. Older2dcb539 exception preserved by Coordinator but won't substitute for final mergeable-head coverage. No T-172 exceptions apply to this new head. Fresh delta review + cland suite all now; C4 pending.

### rev-14 · 2026-10-11T02:26:27.488Z

verdict: review
result: clear
by: rev-14 [reviewer]
run: rev-20261011-179-8
commit: 25a9d6a19dd73f6d75cf5bed1b18694b6abc0384

No high or medium findings. Standards and Spec axes clear: T-172 upstream changes retained; daemon conflict preserves the reviewed ordered shutdown and actual terminal stopped assertion. Production asks/suite routing/docs/roles unchanged from 2dcb539. C1–C3 verified from retained A-972/A-969 and A-986 guard14/14, A-987 socket1/1, A-988 headless card1/1; zero failures/cancellations/skips. Independent assertion replay passes 3 legitimate traces and rejects 6 bad traces; memory ask/answer probe still passes. C4 pending complete fresh-head package validation. This head contains T-172 and receives no prior exceptions. Evidence A-990 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-990-t-179-t-172-integration-review-clear-at-25a9d6a-c4-pending.md.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-179 · 2026-10-11T02:55:56.743Z

Final current-head cland suite13b689f9 at25a9d6a19dd73f6d75cf5bed1b18694b6abc0384 passed typecheck and both package phases: hub1123/1123, Neovim253/253, total1376/1376, zero failure/cancellation/skip/todo. Durable log A-997. Verified unchanged clean worktree/head; no exceptions. C4 marked done; requesting final reviewer verification. Exact role-file handover remains A-969.

### rev-14 · 2026-10-11T02:56:27.741Z

verdict: review
result: clear
by: rev-14 [reviewer]
run: rev-20261011-179-9
commit: 25a9d6a19dd73f6d75cf5bed1b18694b6abc0384

No high or medium findings remain. Identical clean head retains A-990 Standards/Spec and C1–C3 clearance plus exact A-969 role handover. C4 verified from complete A-997: typecheck succeeds; hub1123/1123 and Neovim253/253, combined1376/1376; both phases zero failure/cancellation/skip/todo, final exit0. No exception applied. Worktree HEAD/status checked read-only; no edits or package tests by Reviewer. Final evidence A-998 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-998-t-179-final-c4-verified-at-25a9d6a-complete-package-exit-0.md.

Criteria: C4 verified.

### impl-179 · 2026-10-11T02:59:19.570Z

Resolved and pushed devfa8877f/T-178 merge at06f3bbb515812987cc940139a27617b9dfaf0197. Three role grant conflicts resolved with ask.forward/answer and Lead launch/stop/merge grants retained; verifier request wording preserved. Node24 typecheck and targeted permissions5/5(A-1000), Lead management5/5(A-1001), ask-chain10/10(A-1002) pass. Local Standards/Spec integration reviews clear. Exact updated role-file handover A-999 supersedes A-969. Reviewer asked to invalidate C4 old-head marks; new full suite is required before ready. origin/dev refetched/merged again, clean; delta review and cland suite all next.

### rev-14 · 2026-10-11T02:59:32.148Z

verdict: review
result: not clear
by: rev-14 [reviewer]
run: rev-20261011-179-10
commit: 06f3bbb515812987cc940139a27617b9dfaf0197

Medium validation gap — package.json:16–17: existing C4 marks are backed by A-997 at predecessor 25a9d6a; the current 06f3bbb integration changes dispatch, lifecycle authorization and role grants. Freshness-only request explicitly asks to invalidate those marks before delta clearance. C4 failed/reset pending complete current-head package results. No regression attributed and prior passing evidence remains valid for its original head. Full integration review is separate and pending. Evidence A-1003 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1003-t-179-c4-predecessor-marks-invalidated-for-06f3bbb-integration.md.

Criteria: C4 failed (Current head 06f3bbb contains T-178 integration; predecessor 25a9d6a validation does not cover it. Complete current-head typecheck/hub/Neovim validation is pending.).

### rev-14 · 2026-10-11T03:02:08.751Z

verdict: review
result: clear
by: rev-14 [reviewer]
run: rev-20261011-179-11
commit: 06f3bbb515812987cc940139a27617b9dfaf0197

No high or medium findings. Standards/Spec clear: combined project/default/table grants retain asks, Lead management and artifacts; level checks scope management without blocking forwarding/answers. Automatic dispatch/adapter/spoke merges preserve question metadata/tools, stable IDs and recipient admission. C1–C3 verified from A-1000 permissions5/5, A-1001 Lead5/5, A-1002 ask10/10, unchanged headless evidence and exact A-999 handover. Independent exact-line/grant comparison and memory ask/answer probe pass. C4 remains reset/unverified pending complete current-head package evidence; predecessor A-997 cannot promote this head. No exceptions apply. Evidence A-1004 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1004-t-179-t-178-integration-review-clear-at-06f3bbb-fresh-c4-pending.md.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-179 · 2026-10-11T03:28:48.360Z

Final combined-head cland suite c37da89a at06f3bbb515812987cc940139a27617b9dfaf0197 passed typecheck and both package phases: total1385/1385, zero failures/cancellations/skips/todo. Durable log A-1007. Verified unchanged clean head/worktree. C4 re-marked done from this fresh result; final rev-14 verification requested. Exact current role-file handover A-999.

### rev-14 · 2026-10-11T03:30:57.891Z

verdict: review
result: clear
by: rev-14 [reviewer]
run: rev-20261011-179-12
commit: 06f3bbb515812987cc940139a27617b9dfaf0197

No high or medium findings remain. Identical clean head retains A-1004 Standards/Spec and C1–C3 clearance plus exact role handover A-999. C4 verified from complete A-1007: typecheck succeeds, hub 1132/1132 and Neovim 253/253, combined 1385/1385; both phases zero failure/cancellation/skip/todo, final exit 0. No exceptions applied. Worktree HEAD/status checked read-only; no edits or package tests by Reviewer. Final evidence A-1008 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1008-t-179-final-c4-verified-at-06f3bbb-complete-package-exit-0.md.

Criteria: C4 verified.

### coord · 2026-10-11T03:31:18.316Z

Merged 75b133d60203d6b65c96513c67542433f2898c26 onto dev.
