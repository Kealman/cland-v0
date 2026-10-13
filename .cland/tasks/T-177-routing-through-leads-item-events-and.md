---
id: T-177
kind: task
title: "Routing through Leads: item events and reports climb through Leads;
  Leads hold their subtree's default subscriptions"
state: closed
status: done
criterion_seq: 4
labels:
  - v0.1
  - ready-for-agent
assignee: impl-177
parent: E-113
blocked_by:
  - T-176
topic: topic-103
branch: t/T-177-routing-through-leads-item-events-and
created: 2026-10-10T15:38:35.781Z
updated: 2026-10-10T21:06:09.197Z
closed: 2026-10-10T21:06:09.296Z
---

## Parent

T-113, slice 2 of 7. Read the epic's Contents, its choices where the spec is silent, and its Constraints, which apply to this slice.

## What to build

Events and reports about an item climb the chain through Leads; Lead sessions get the default subscription to their subtree, less the subtrees with their own lead; idle and death notices reach them.

## Acceptance criteria

- [x] C1. The behaviour above works end to end through the v0 seams: the hub frame protocol, the fake harnesses and headless Neovim where the UI is touched.
  - done: impl-177 · 2026-10-10T19:57:51.067Z
  - verified: rev-13 [reviewer] · run rev-13-20261010-177-1 · 2026-10-10T19:59:59.114Z
  - verified: rev-13 [reviewer] · run rev-13-20261010-177-3 · 2026-10-10T20:30:15.305Z
- [x] C2. Demo: an Implementer's "blocked" report under the epic reaches `lead-1`, not the Coordinator.
  - done: impl-177 · 2026-10-10T19:57:51.266Z
  - verified: rev-13 [reviewer] · run rev-13-20261010-177-1 · 2026-10-10T19:59:59.114Z
  - verified: rev-13 [reviewer] · run rev-13-20261010-177-3 · 2026-10-10T20:30:15.305Z
- [x] C3. Docs (hub/README.md, nvim/README.md or docs/) describe what changed; any role clause change lists the exact .cland/roles.toml lines in the handover.
  - done: impl-177 · 2026-10-10T19:57:51.449Z
  - verified: rev-13 [reviewer] · run rev-13-20261010-177-1 · 2026-10-10T19:59:59.114Z
  - verified: rev-13 [reviewer] · run rev-13-20261010-177-3 · 2026-10-10T20:30:15.305Z
- [x] C4. `npm run typecheck && npm test` pass (or `npm run test:nvim` for a Neovim-only slice).
  - verified: rev-13 [reviewer] · run rev-13-20261010-177-5 · 2026-10-10T21:05:36.816Z
  - done: impl-177 · 2026-10-10T21:05:52.761Z

## Comments

### impl-177 · 2026-10-10T19:49:08.803Z

Implementation started on the claimed worktree. Tests use the epic's agreed hub frame-protocol seam: real hub, spoke MCP and UI socket; fake harnesses only where lifecycle delivery is involved. Scope is subtree defaults, nearest/upstream Lead reports, lifecycle notices, and flat-shape compatibility.

### impl-177 · 2026-10-10T19:54:32.350Z

Protocol tracer tests reproduced self-delivery of blocked reports and Coordinator-only ready routing. Shared node-chain resolution now skips the reporting claimant, inherits the nearest Lead for unclaimed descendants, and routes ready action delivery to the supervising Lead. Nested lifecycle coverage exercises item → epic → release → root and stopped-Lead fallback. Defaults reuse the existing claim partition; explicit addresses retain their meaning.

### rev-13 · 2026-10-10T19:59:59.114Z

verdict: review
result: clear
by: rev-13 [reviewer]
run: rev-13-20261010-177-1
commit: fb717a1afa2dbe606450cf1e3628cba1a60ea922

No high or medium findings.
Low — hub/test/lead-routing.test.ts:13: a setup failure before lead's initialization makes the teardown hook throw and skip impl.close; register owned closes after each successful spawn.
Low — hub/src/spoke/instructions.ts:9: generic QUESTIONS prose still directs questions straight to coordinator, conflicting with the new parent-Lead blocker route; align guidance while preserving Coordinator-only ask authority.

C1–C3 verified: inherited ownership/sender exclusion, ready supervisor action with item digest, partitioned defaults and lifecycle fallback match the spec. Independent typecheck/diff check and in-memory routing/delivery-mode probes pass. Real-hub/fake-harness scenarios inspected and reported targeted 3/3 plus item-lead 10/10; exact instance-clause handover A-740 matches current root lines. C4 remains unverified pending the full suite; this verdict does not establish final readiness.

Review A-744: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-744-t-177-review-at-fb717a1-routing-clear-c4-pending.md.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-177 · 2026-10-10T20:25:40.539Z

Final package validation A-741 failed: hub 1046 tests, 1042 passed and 4 failed (two obsolete clause expectations plus one timed-out merge subtest and its parent); Neovim phase did not start. Deterministic clause-only repro is red. Updating expectations to the required Lead route and tightening Coordinator fallback prose to unclaimed items; separately rerunning the merge timeout before any timeout-related change. Full post-fix verification and re-review will follow after merging fresh origin/dev (now includes T-196).

### rev-13 · 2026-10-10T20:25:42.337Z

verdict: review
result: not clear
by: rev-13 [reviewer]
run: rev-13-20261010-177-2
commit: fb717a1afa2dbe606450cf1e3628cba1a60ea922

Medium — hub/test/review-qa.test.ts:104: expected old Coordinator fallback wording conflicts with the requested inherited Lead chain.
Medium — hub/test/surface.test.ts:63: expected direct Coordinator blocker route conflicts with the requested Implementer-to-parent-Lead route.
Medium — hub/test/merge.test.ts:474: nested README.md index-lock restoration merge timed out and was killed by SIGTERM; parent case also failed. Cause is not established by this log.

C4 failed. A-741 reports hub1042/1046,4fail,zero cancelled/skipped/todo; three cases account for four counts because of the nested merge test. Neovim never ran. Update meaningful clause assertions, resolve/establish merge timeout cause, request delta review and provide full final-head evidence. Prior C1–C3 A-744 remain verified. Durable writing suite inspected rather than independently rerun.

Review A-774: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-774-t-177-c4-review-at-fb717a1-hub-failures-remain.md.

Criteria: C4 failed (A-741 hub1042/1046 has two stale clause assertions plus an index-lock merge timeout (including its parent failure); Neovim phase did not run.).

### impl-177 · 2026-10-10T20:29:15.895Z

C4 fixes at a27dcee: old clause expectations now require nearest Lead routing; Coordinator fallback explicitly applies only to unclaimed items. Corrected both review lows (generic QUESTIONS route and early teardown registration). The merge timeout reproduced at the helper's 30 s bound; giving only merge the CLI's existing 60 s reply budget plus 5 s startup made the same README case finish in 46.479 s with all original lock/ref/index/status/file assertions green (2/2, no skips). No merger production behavior changed. T-196 origin/dev merged conflict-free. Post-merge routing 3/3, surface 3/3, two clause probes, typecheck and diff check pass. Corrected exact role handover A-777 supersedes A-740. Fresh full-package rerun follows.

### rev-13 · 2026-10-10T20:30:15.305Z

verdict: review
result: clear
by: rev-13 [reviewer]
run: rev-13-20261010-177-3
commit: a27dcee81e7ae5ed5f13b30ab85baa87723bcbd2

No high or medium delta findings. Clause assertions now cover Lead routing/unclaimed root fallback; generic QUESTIONS and per-spawn teardown resolve both lows. Merge-only test deadline65s matches actual CLI60s reply budget. A-777 records old30s reproduction then46.479s success with every rollback assertion intact. Conflict-free T-196 import retains routing/subscriptions.

Independent typecheck/diff check pass; clean pinned worktree. Targeted post-merge routing3/3, surface3/3, clause2/2 and rollback2/2 inspected via handover evidence. C1–C3 verified; C4 remains failed/pending A-774 until fresh full suite and claimant done mark. No readiness conclusion.

Review A-781: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-781-t-177-delta-review-at-a27dcee-coverage-corrected-c4-pending.md.

Criteria: C1 verified, C2 verified, C3 verified.

### rev-13 · 2026-10-10T21:04:25.647Z

verdict: review
result: not clear
by: rev-13 [reviewer]
run: rev-13-20261010-177-4
commit: a27dcee81e7ae5ed5f13b30ab85baa87723bcbd2

Medium — nvim/test/vboard.test.ts:178: rank-operation snapshot receives undefined instead of T-14; C4's complete package run is unsuccessful. This matches T-190's request-arrival race fixed and reviewed in a3cd609/A-787/A-788; coordinate reuse of its held-result and changed sibling-order barriers while retaining operation/cursor/refusal assertions.

A-782: typecheck passes; hub1059/1059; Neovim237/238 one fail; both phases zero cancelled/skipped/todo; command exit1. Earlier clause/merge failures pass. Clean unchanged pinned head; prior C1–C3/Standards/Spec A-781 remain supported. Full writing-suite evidence inspected rather than independently rerun.

Review A-801: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-801-t-177-full-suite-review-at-a27dcee-rank-fixture-failure.md.

Criteria: C4 failed (A-782 complete package run exits1: hub1059/1059; Neovim237/238 with vboard rank-operation undefined/T-14 failure.).

### rev-13 · 2026-10-10T21:05:36.816Z

verdict: review
result: clear
by: rev-13 [reviewer]
run: rev-13-20261010-177-5
commit: a27dcee81e7ae5ed5f13b30ab85baa87723bcbd2

No remaining high or medium findings under Coordinator63adc1e7's named exception. C4 verified on A-782: typecheck passes, hub1059/1059, Neovim237/238, sole vboard rank snapshot failure at nvim/test/vboard.test.ts:178; zero cancelled/skipped/todo. Independently checked this fixture is unchanged from dev8783ac3. Its a3cd609 correction is reviewed in T-190/A-788 and will land there; Coordinator directs no copying or rerun and merging T-177 after T-190.

Acceptance is under the explicit exception; npm test itself exited1. This supersedes A-801's blocking disposition. Clean unchanged head; prior C1–C3 and Standards/Spec A-781 stand. Claimant done mark remains separate if absent.

Review A-802: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-802-t-177-c4-at-a27dcee-clear-under-named-rank-race-exception.md.

Criteria: C4 verified.

### impl-177 · 2026-10-10T21:05:52.670Z

Final validation A-782 at unchanged clean a27dcee81e7ae5ed5f13b30ab85baa87723bcbd2: typecheck passed; hub 1059/1059; Neovim 237/238; npm test exit 1. C4 is accepted only under Coordinator decision 63adc1e7's named exception for nvim/test/vboard.test.ts:178, independently verified unchanged from dev and fixed/reviewed by T-190 a3cd609. Reviewer A-802 verifies C4 under that exception. No copy, branch changes or rerun, as directed; T-177 will merge after T-190. Adding claimant C4 done mark under this explicit exception, not claiming a fully green suite.

### coord · 2026-10-10T21:06:09.197Z

Merged fd1aeac3be37b58bb0633514af3e215a5d56acf0 onto dev.
