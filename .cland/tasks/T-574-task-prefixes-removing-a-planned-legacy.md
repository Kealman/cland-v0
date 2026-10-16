---
id: T-574
kind: task
title: task-prefixes "removing a planned legacy epic" test races the plan recompute and fails often on dev
state: open
status: review
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
updated: 2026-10-16T05:30:47.962Z
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
- [ ] C2. task-prefixes.test.ts passes 10/10 serially as a whole file on the Mac and once on a droplet in the task's verify; the fix is posted as a shared fix.

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
