---
id: T-164
kind: task
title: "Launch role notice: 'took <Role> at launch' goes missing when spawn
  acceptance and the first hello race (T-141 regression)"
state: closed
status: done
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: E-108
blocked_by: []
topic: topic-73
branch: t/T-164-launch-role-notice-took-role-at-launch
created: 2026-10-10T08:59:53.666Z
updated: 2026-10-10T09:42:26.982Z
---

## Parent

T-108 (A quiet Coordinator), a follow-up from T-141's merge (1f56cf1). Found by the combined dev suite at bd9ee7c.

## What to build

`hub/test/agents-journal.test.ts`, "lifecycle events land in Agents as notices with kinds", fails about half the time on dev, and also fails alone (1 of 2 runs). The launched `coord-1` holds Coordinator: its start, stop and revocation notices all name the role. But the `role-assign` notice "coord-1 took Coordinator at launch" is missing.

T-141 changed when the first grant applies: at the credentialed first hello, or retired at spawn acceptance. Most likely one ordering of first hello versus acceptance grants the role without publishing the notice. Every path that gives a launched session its role must publish exactly one "took <Role> at launch" notice, whichever comes first, and never two.

Assertion seen: `role-assign ~ /^coord-1 took Coordinator at launch/` against notices `[role-assign alpha…, claim, release, role-revoke alpha…, session-start coord-1 [Coordinator] started, session-stop, role-revoke coord-1 … stopped]`.

## Acceptance criteria

- [ ] Both orderings of first hello and spawn acceptance publish exactly one "took <Role> at launch" notice; a frame-protocol test forces each ordering deterministically, without timing.
- [ ] The agents-journal test passes 20 consecutive runs alone.
- [ ] The T-141 role-integrity regressions (name-reservation and item-lead tests) still pass.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size S. A v0.1 regression; it goes before the next hub restart if it is quick.

## Comments

### impl-164 · 2026-10-10T09:02:28.505Z

Reproduced the lifecycle failure with `node --test --test-name-pattern='lifecycle events land' hub/test/agents-journal.test.ts`: Coordinator start/stop/revoke notices exist, but its launch assignment is missing. Added gated socket-frame coverage: hello-first passes on baseline; acceptance-first fails deterministically (zero launch-role notices before hello). The notice currently comes from a role-clause reason, while acceptance retires the first grant. Decoupling the lifecycle notice from clause delivery will preserve the T-141 grant rules and avoid carried-clause duplicates.

### impl-164 · 2026-10-10T09:06:12.135Z

Fix is in core.ts, sessions.ts and agents-topic.ts: the role grant now logs its own lifecycle event; acceptance logs it only when the credentialed first hello has not consumed the grant and the launch role is unchanged. Clause delivery no longer creates new assignment notices, while legacy journal entries remain replayable. Added the event to journal.ts and a daemon assertion that its single journal record carries the matching Agents notice id. Typecheck passed before that journal addition; rerunning it now. All 69 name-reservation/item-lead tests passed, including four deterministic hello/acceptance orderings with ordinary/carried clauses, joins and reconnects.

### impl-164 · 2026-10-10T09:18:23.934Z

Committed and pushed 86835a4a31aecb5c03c1cc67ba14d4a65fa5eaeb to origin. Final typecheck passed; all 69 name-reservation/item-lead tests passed; agents-journal passed 20 consecutive isolated whole-file runs (8 tests per run), with exactly-one notice and matching journal-id assertions. Evidence: A-519 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-519-t-164-20-isolated-agents-journal-runs.log. Full npm test is not queued: Coordinator ordered T-164 to wait for its turn after T-149, T-142 and T-160; handing over for concurrent review with that check pending.

### rev-9 · 2026-10-10T09:20:38.397Z

verdict: review
result: clear
by: rev-9 [reviewer]
run: rev-2026-10-10-164-1
commit: 86835a4a31aecb5c03c1cc67ba14d4a65fa5eaeb

Clear: no high, medium or low findings. Standards and Spec independently clear.

Both hello/acceptance orderings publish the dedicated launch event once; ordinary/carried clauses suppress inferred duplicates, and joins/reconnects keep the first grant retired. Journal replay uses the persisted notice id/checkpoint; a reviewer in-memory check recovered one lost event then added none on repeat, and legacy clause replay remains supported. No T-141 role/ownership semantics changed.

A-519 shows 20 isolated agents-journal runs with 8/8 passes each; A-520 reports final typecheck and 69 role-integrity tests passing. Full npm test is pending Coordinator's suite-order signal, a separate acceptance/merge requirement. Reviewer made no edits or full-suite run.

Evidence and two-axis review: A-524, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-524-t-164-review-exactly-one-launch-assignment-notice.md.

### impl-164 · 2026-10-10T09:42:12.783Z

Final full npm test passed on reviewed/pushed head 86835a4a31aecb5c03c1cc67ba14d4a65fa5eaeb: exit 0, 951/951 hub tests and 214/214 Neovim tests, zero failures/cancellations/skips. Node v24.21.0; worktree remains clean. Full-suite evidence A-537: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-537-t-164-full-npm-test-passed-951-hub-214-neovim.log. Together with final typecheck, 69 name-reservation/item-lead passes, 20/20 isolated agents-journal runs and clear review A-524, all requested validation is complete.

### coord · 2026-10-10T09:42:26.982Z

Merged 7990755777ab953fb5f13198f75300a9ad3e8325 onto dev.
