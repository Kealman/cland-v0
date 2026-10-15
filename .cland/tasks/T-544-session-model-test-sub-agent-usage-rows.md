---
id: T-544
kind: task
title: "session-model test: sub-agent usage rows in task view arrive in hook order, not agent order (Linux)"
state: open
status: in progress
size: XS
criterion_seq: 2
labels:
  - flaky
assignee: null
parent: E-482
blocked_by: []
regression_of: T-480
topic: topic-335
branch: t/T-544-session-model-test-sub-agent-usage-rows
created: 2026-10-15T22:41:39.095Z
updated: 2026-10-15T22:56:14.913Z
---

## Summary
E-387 stage-close cover 725bd529 at dev 21ae664d (2026-10-15 22:40Z; shard-1 cland-v0-7f8dcbd7, peak load 9.9; log A-3413) failed in `hub/test/session-model.test.ts`, 'launched Claude sub-agents retain their parent role and launch item through real hook commands'. That's T-480's new case, merged at 22:26Z. The journal assertion sorts by agentId. The `task view` usage assertion (`usage.subagents` deepEqual) doesn't, and the two SubagentStart hooks can journal in either order: the run saw unknown-child before known-child.

## Acceptance criteria
- [ ] C1. The usage assertion compares the sub-agent rows in a defined order: sorted by agentId in the test, or the hub orders `usage.subagents` deterministically by start time then agentId and the test relies on that. Every row's fields are still asserted.
  - verified: rev-30 [reviewer] · run rev-20261015-544-source · 2026-10-15T22:54:20.569Z · commit 420e0de6deacf9e9628f574542d97717c681368d
- [ ] C2. session-model.test.ts passes 5/5 serially as a whole file on the Mac, plus once on a droplet in the task's verify.

## Comments

### impl-544 · 2026-10-15T22:42:54.394Z

Implementation plan: normalize task-view sub-agent usage rows by agentId in the existing assertion. Preserve both rows and all five asserted fields. Evidence: five serial whole-file Mac passes labelled with load, followed by source review and same-head droplet verification.

### impl-544 · 2026-10-15T22:52:47.269Z

Implemented and pushed 420e0de6 on t/T-544-session-model-test-sub-agent-usage-rows. Usage rows now sort by agentId exactly as the nearby journal assertion; both expected rows and all five fields remain asserted. Five serial whole-file Mac runs passed 11/11 each, labelled loaded; pre-run loads 14.52, 14.48, 13.10, 13.40, 13.18, wall 41.8/40.4/38.6/44.1/40.6s. A-3420 holds full logs at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3420-t-544-five-serial-mac-whole-file-passes.txt. Hub typecheck and diff check passed. Fetched/merged origin/dev before review. No QA scope/criteria or brief required.

### rev-30 · 2026-10-15T22:54:20.569Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-544-source
commit: 420e0de6deacf9e9628f574542d97717c681368d
scope: full

Source review T-544 clear at 420e0de6deacf9e9628f574542d97717c681368d, parent 75017065fcd76fe166628c7c7f1e3cba56840c99. Standards and Spec reviewed directly under the no-delegation role. No high, medium or low findings.

## Standards
No findings. The one-line replacement at hub/test/session-model.test.ts:108 sorts the private JSON-parsed CLI response array by agentId using the comparator already present at :100. It does not mutate hub state, change production ordering, share a fixture, introduce timing waits, change test identities, or alter a duration allowance. git diff --check is clear. Existing project-hub/frame/CLI boundaries and teardown remain unchanged, consistent with docs/agents/tests.md.

## Spec
C1 verified. A-3413's stage-cover failure shows the same two complete usage rows in reversed hook arrival order. Journal.subagents reads matching durable records in file order (hub/src/hub/journal.ts:353–371), and task.view forwards that array (dispatch.ts:852–855); no production sorted-order contract is established. The test now normalizes by stable agent identity before the unchanged projection and deepEqual. Both known-child and unknown-child remain required, with session, sessionId, harness, agentId and model checked exactly. Sorting neither drops duplicates nor hides missing/extra rows or wrong models. Journal role/item attribution assertions, parent model assertion, human-readable usage output and unrelated-item empty usage remain unchanged.

C2 remains UNVERIFIED in full. A-3420 contains five complete serial Mac whole-file passes, each 11/11, total 55 passes, zero failures/cancellations/skips. Durations 41.781/40.448/38.604/44.118/40.560 seconds; pre-run loads 14.52/14.48/13.10/13.40/13.18, labelled loaded. Evidence discloses no active targeted runner and local holder impl-493 rather than Coordinator. The final pass follows the pre-review dev fast-forward; immutable history shows no intervening session-model/harness change beyond the reviewed normalization, consistent with the disclosed identical task source in the first four passes. Typecheck is reported green. An actual droplet task verify at this exact source head is still required, with acceptable overall gate evidence.

Proceed with one same-head diff-selected cland verify under current Coordinator admission rules, no mode/executor override as directed to the Implementer. Preserve the actual executor/platform; a local result does not by itself satisfy C2's droplet requirement. No per-item QA criteria.

Evidence A-3420: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3420-t-544-five-serial-mac-whole-file-passes.txt. No Reviewer tests, edits, compiler execution, merges or provider actions.

Standards: 0 findings; Spec: 0 findings, Linux portion of C2 pending.

Review artifact A-3422 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3422-t-544-source-clear-at-420e0de6-compare-usage-by-stable-agent-identity.md.

Criteria: C1 verified.

### rev-30 · 2026-10-15T22:56:14.913Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261015-544-cancelled-local
commit: 420e0de6deacf9e9628f574542d97717c681368d
scope: evidence

T-544 evidence review not clear at 420e0de6deacf9e9628f574542d97717c681368d. A-3424 / 71ef9a43-285c-43b7-ae05-e1ff9fd97675 is a cancelled local Darwin run, exit 143 (worker interrupted by SIGTERM), after 38 passing tests. Neither complete task-file coverage nor a completed suite nor any Linux evidence is established. Item history records the Implementer requested Coordinator intervention because the fallback included the pre-T-545 real-OpenCode isolation gap, then cancelled through the hub. This report does not infer a task-source failure from cancellation.

Source clearance A-3422 and C1 stand; five Mac whole-file passes A-3420 stand. C2 remains unverified, with no failed criterion mark. No source change is required by this receipt. Await Coordinator admission/isolation direction for an actual droplet task verify; do not repeat a local fallback that exercises the known isolation gap. A-3424 is excluded from qualifying gate receipts.

Log: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3424-suite-71ef9a43-285c-43b7-ae05-e1ff9fd97675-auto-at-420e0de.log. No Reviewer tests, edits or process/provider actions.

Review artifact A-3429 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3429-t-544-cancelled-local-receipt-source-clear-linux-requirement-pending.md.
