---
id: T-574
kind: task
title: task-prefixes "removing a planned legacy epic" test races the plan recompute and fails often on dev
state: open
status: ready
size: S
criterion_seq: 2
labels:
  - bug
  - hub
  - flaky
  - v0.1.3
assignee: null
parent: E-482
blocked_by: []
topic: topic-358
branch: t/T-574-task-prefixes-removing-a-planned-legacy
created: 2026-10-16T05:25:32.740Z
updated: 2026-10-16T05:34:30.143Z
---

## Summary
hub/test/task-prefixes.test.ts:200, "removing a planned legacy epic drops its candidate; prefix renames preserve a live plan", expects `plan: null` for a replacement epic with an invalid plan, but gets the removed epic's earlier plan (stage "build", lane T-2). T-296's Linux run 033386f2 hit it (A-3733, lines 4351–4375). On a quiet Mac on 2026-10-16 the Coordinator saw:
- dev 9b415c1e: 3/3 fail;
- eee3fd1d: 1/1 fail, although its Linux cover passed;
- 8aff7b26, d8e43644 and c3a04cce: fail;
- a06020a3, 50a94688, 8b5fe173 and b214d3d3: pass.
So it's a race with a high failure rate, not one breaking commit. The test reads the plan right after the item becomes visible again (`eventually('replacement epic is indexed')`). Either the plan for a re-created id is served from state kept from the removed item, or it's recomputed after the item is published. Under the shared-fix rule this is a dev defect.

## Acceptance criteria
- [x] C1. Find whether a removed epic's plan or candidate state outlives its file (product) or the test reads before a defined recompute point (test), fix that cause, and record it on this item. If the product serves a stale plan for a re-created id, fix the product.
  - done: impl-574 · 2026-10-16T05:28:02.337Z
  - verified: rev-30 [reviewer] · run rev-20261016-574-source · 2026-10-16T05:30:47.962Z · commit c63a8a9bff1e3c4bc003078dce0e4c98d36c12b7
  - verified: rev-30 [reviewer] · run rev-20261016-574-final · 2026-10-16T05:34:29.491Z · commit c63a8a9bff1e3c4bc003078dce0e4c98d36c12b7
- [x] C2. task-prefixes.test.ts passes 10/10 serially as a whole file on the Mac and once on a droplet in the task's verify; the fix is posted as a shared fix.
  - done: impl-574 · 2026-10-16T05:34:04.004Z
  - verified: rev-30 [reviewer] · run rev-20261016-574-final · 2026-10-16T05:34:29.491Z · commit c63a8a9bff1e3c4bc003078dce0e4c98d36c12b7

## Comments

### impl-574 · 2026-10-16T05:27:42.124Z

Diagnosis: this is an observation-boundary race in the test, not retained state surviving an indexed removal. Exact isolated test failed 3/3 probes at 9b415c1e. At the old eventually('epic removal is indexed') boundary, task.view returned false because its file read hit ENOENT, while an immediate task.list still contained E-1 with the old build/T-2 plan. Journal had no removal for E-1-epic.md. Recreating the file before the debounced watcher sees absence is an invalid hand edit to a still-indexed item; retaining its last accepted plan is intentional (#planState). Tracker #dropFile already clears the index plan and candidate synchronously before #changed publishes removal. Fix waits for E-1 to disappear from task.list (the indexed publication boundary) before recreating it. The final strict null-plan assertion and rename-plan assertion remain unchanged; they continue detecting real cleanup regressions. No product relaxation.

### rev-30 · 2026-10-16T05:30:47.962Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-574-source
commit: c63a8a9bff1e3c4bc003078dce0e4c98d36c12b7
scope: full

# T-574 source review clear at c63a8a9b

Head c63a8a9bff1e3c4bc003078dce0e4c98d36c12b7; branch t/T-574-task-prefixes-removing-a-planned-legacy.
Fixed point pre-review merged origin/devd6af381289f0022e179aea262a09d3c08a8f4665. One commit, one test file,5additions/1deletion. Origin ref matches; immutable whitespace clean. task.view confirms claimant and C1/C2.

## Standards
No high, medium or low findings (0).
The change replaces task.view failure as an alleged indexing receipt with a bounded eventually over actual task.list absence of canonical E-1. No sleep, deadline extension, mocked product state, assertion deletion or production change is introduced. Existing prefix-rename validity checks and strict replacement plan===null remain.
This follows the project's exact-observation principle: filesystem ENOENT and index removal are different boundaries. No new abstraction/smell finding is warranted for the small local predicate.

## Spec
C1 verified as a test synchronization defect, not a required product-plan retention fix.
Source trace: tracker.ts #readViewAsync1363–1370 resolves indexed identity then attempts filesystem read; its ENOENT throws without dropping the index. Thus the old task.view.ok===false can become true while E-1 remains indexed with its accepted plan. The test can then recreate the same file/id before the watcher ever observes absence, turning the replacement into an invalid hand edit of a still-live indexed epic.
#dropFile960–977 removes the indexed item and then synchronously clears stage dependencies, plan candidates and errors before publication. IndexDb.remove335–339 clears persisted plan before deleting its item row. task.list1785–1790 reads that actual index. Once the new absence predicate passes, the entire synchronous cleanup boundary is complete; replacement cannot inherit the removed accepted plan through that path.
Last-valid-plan retention for invalid edits of an existing item is intentional and independently asserted in task-plan.test.ts:188–219, including restart and later valid edits. Preserving that behavior while observing a real removal is narrower and better supported than altering product retention to satisfy the old premature predicate.
A-3747 records the old boundary's list-still-contains-E-1 probe and baseline strict-plan failure, and the diagnosis on the item. Source trace independently corroborates its explanation. No claim that product promises to observe every transient remove/recreate without waiting is made.

## Evidence
A-3747 contains ten complete serial whole task-prefixes logs at this head,8cases each=80pass,0fail/cancel/skip/TODO. Changed case passes ten times (0.730–0.842s); all original other cases retained. Admission summary reports no competing test PIDs and load2.37–3.18<10 before every file; these are Implementer admissions, not Reviewer execution. Root typecheck reported green.
C2 remains pending its required exact-head droplet verification and Coordinator shared-fix publication. The accepted Mac half is complete; no Linux receipt or posted shared-fix completion is invented. After source clear submit one --executor droplet --fresh at unchanged head, with result routed to the source reviewer and lead. New head requires delta review. No per-item QA.

Source verdict clear, verify C1 only. Proposed project rule: watcher/index lifecycle tests wait for the indexed-state transition before reusing an id; a filesystem read failure alone is not an index-removal receipt. This generalizes the demonstrated boundary without changing product behavior.
No Reviewer tests/compiler/binary execution, edits, signals, installs, provider calls, commits, merges or subagents. Totals Standards0,Spec0 findings.

Artifact A-3752 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3752-t-574-source-clear-indexed-removal-boundary-and-10-whole-file-mac-passes.md

Criteria: C1 verified.

### impl-574 · 2026-10-16T05:33:27.234Z

Fresh exact-reviewed-head droplet verification ff34e0b2-6283-48ce-84e5-d9d771cc8a82 passed at c63a8a9bff1e3c4bc003078dce0e4c98d36c12b7: auto hub-selected, 39 pass / 0 fail, whole task-prefixes.test.ts and Neovim smoke, Linux x64 6.8.0-142-generic / Node 24.21.0 / Neovim 0.12.5, c-8 lon1, 51.94s suite, lifetime/cost unknown. Durable log A-3753. Mac proof A-3747 is 10/10 whole files = 80 pass. Source clear A-3752 / rev-20261016-574-source. Coordinator asked to post shared fix, the remaining C2 publication step.

### rev-30 · 2026-10-16T05:34:29.491Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-574-final
commit: c63a8a9bff1e3c4bc003078dce0e4c98d36c12b7
scope: evidence

# T-574 final evidence clear at c63a8a9b

Headc63a8a9bff1e3c4bc003078dce0e4c98d36c12b7 unchanged; origin ref matches. Source A-3752 and runtime audit A-3754 apply. No new source changes/findings.

## Standards
No high, medium or low findings (0). The bounded indexed-removal predicate preserves all strict plan/rename assertions and intentional last-valid-plan retention. No new test or product edits are involved in final settlement.

## Spec
C1 source diagnosis/fix stands: task.view ENOENT is not indexed removal; index.remove clears persisted plan and #dropFile clears candidates synchronously before publication. Bounded task.list absence before id reuse observes the actual lifecycle boundary.
C2 Mac proof A-3747:ten serial complete task-prefixes files,8tests each=80pass,0fail/cancel/skip, quiet guarded admissions. Linux A-3753 /ff34e0b2-6283-48ce-84e5-d9d771cc8a82 at exact head:whole changed task-prefixes file included in hub-selected coverage plus baselines,hub27/27 and Neovim smoke12/12=39/39,no failures/cancellations/skips,exit0. Changed case1.274s; both typechecks/required selected phases complete. Actual Linux c-8lon1,Nodev24.21.0,Neovimv0.12.5,fourworkers;51.94s,peak1m2.17,loadextra0.03s. Provider lifetime/cost remain unknown, not inferred. No run exception is required.
Publication clause is settled under independently read primary Coordinator65798f2f-78e9-4a33-a91f-da7f4d8bb90b: C2 claimant done note is 'shared-fix notice by the Coordinator on merge'; Coordinator merges on ready then posts merged commit to branches in the same minute. Thus final criterion verification follows this explicit sequencing disposition. It does not claim the shared notice has already been published; publication remains the Coordinator's concrete merge action. Earlier7859b20e Linux-before-sharing prerequisite is now fulfilled.

Final evidence clear; C1/C2 refreshed at this exact head. No extra verification/head change needed. No per-item QA. Further source movement requires delta review; branch publication/merge is not performed by Reviewer. No Reviewer tests, compiler/binary execution, edits, signals, provider operations or subagents. Totals Standards0,Spec0 findings.

Artifact A-3755 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3755-t-574-final-clear-10-mac-files-and-green-linux-publication-on-merge.md

Criteria: C1 verified, C2 verified.
