---
id: T-120
kind: task
title: "Status on events: the status field, moved by claims, verdicts, merges, closes and reopens; set by hand only by the Coordinator, the human and the Implementer's review"
state: open
labels:
  - ready-for-agent
  - v0.1
assignee: null
parent: T-107
blocked_by:
  - T-118
topic: topic-45
branch: t/T-120-status-on-events-the-status-field-moved
created: 2026-10-09T21:56:19.707Z
updated: 2026-10-09T23:55:12.805Z
---

## Parent

T-107 (v0.1 release and status), slice 3 of 6. Spec §3.2 (Status is explicit, The hub moves it on events).

## What to build

A task carries `status` in its frontmatter: `backlog`, the default at creation, `planned`, `in progress`, `review`, `qa`, `ready` or `done`. State stays `open` or `closed`, and done tasks are closed. Containers, questions and specs have no status.

The hub moves the status on events:
- an Implementer's claim sets `in progress`;
- a verdict that is not clear sets `in progress`;
- a merge or a close sets `done`;
- a reopen sets `backlog`.

The Coordinator and the human set any status with `cland task edit --status` and its MCP tool. The Implementer may set `review` on its own claimed item, and the Implementer clause says it does so when handing the item over. A manual status edit by any other session is refused. The status travels in the `task` event the UI already consumes. Existing open tasks get a status on first index: `in progress` when claimed, otherwise `backlog`.

`ready` and the verifier holds are slice 4; this slice does not set `review` or `qa` from Reviewer or QA activity.

## Acceptance criteria

- [ ] A new task is `backlog`; an Implementer's claim makes it `in progress`; a not-clear verdict returns it to `in progress`; `cland merge` and a close make it `done`; a reopen makes it `backlog`. Each is shown by `cland task view` and carried in the `task` event.
- [ ] `--status` is accepted from the Coordinator and the human, and `review` from the claiming Implementer on its own item. Every other caller is refused, through the permission table.
- [ ] Existing items are migrated on index, and a hand-edited `status` is re-indexed (ADR 0002).
- [ ] The merge gate accepts and refuses exactly what it did before, which the existing T-59, T-74 and T-104 tests prove unchanged.
- [ ] The Implementer clause in the default roles names the `review` hand-over. List the exact `.cland/roles.toml` line for this project in your report.
- [ ] `hub/README.md` and `docs/agents/issue-tracker.md` describe status and who may set it.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size M. Implementer: Codex. Await checklist (A-96, class B): status writes ride the tracker's single queue (T-77). Never derive status in two places. Can run in parallel with slice 2, but both touch the item parser: whichever lands second rebases once.

## Comments

### impl-120 · 2026-10-09T23:01:55.366Z

Starting status-on-events implementation. Coverage at T-107's existing hub protocol seam; status writes stay on the tracker queue, merge gate behavior remains unchanged. Project roles.toml change will be reported for the Coordinator to commit.

### impl-120 · 2026-10-09T23:10:33.084Z

Status field and permissions are implemented; targeted creation, manual transition, verdict and merge status tests pass. Migration tests cover existing DB hashes and durable claims. Claims publish status and the live hold together; grant rechecks occur at admission and before rename. Updating legacy tracker assertions for the newly persisted status (merge gate assertions remain unchanged).

### rev-6 · 2026-10-09T23:20:44.810Z

verdict: review
result: clear
by: rev-6 [reviewer]
run: rev-6-120-1
commit: 5ac72deb7ebd0130176398ed4238714e1e3313da

No high or medium findings remain in the full 9ddfd79..5ac72de range. Both migration defects are fixed: offline close/reopen meaning survives queued persistence, and moved-ID migration removes the old row/claim. Production memory probes confirm all three cases. Status transitions use the tracker queue; manual status permissions and live grant/claim rechecks are connected. Automatic ready/verifier holds remain T-121. Merge gate production is unchanged; existing gate test assertions remain unchanged apart from claim awaits.

Hub typecheck/full-range diff check pass; no suite/native integration tests run by Reviewer. Separate Standards/Spec reports and exact probes: A-257, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-257-t-120-full-review-rev-6-120-1-at-5ac72de.md.

Project activation for Coordinator: .cland/roles.toml:78 needs the review handover clause, and :92 needs task.edit:review in the Implementer tools list; defaults already contain both. This is a project activation follow-up, not a branch blocker.

### impl-120 · 2026-10-09T23:33:20.762Z

Committed and pushed test-only delta f264ff156f81de272f12d099ec7ea627bff6edb8 (git log -1). The first full run passed 750/751 hub tests; sole failure was the outdated permission name expected for an Implementer assignee edit (log A-262). The edit remains refused and now asserts the review-only/claimed-item/no-other-edits reason. Added refused mixed-field, wrong-status and unclaimed-item variants. All 5 permissions tests and typecheck pass; second full suite is queued next. Delta note A-263.

### rev-6 · 2026-10-09T23:34:16.191Z

verdict: review
result: clear
by: rev-6 [reviewer]
run: rev-6-120-2
commit: f264ff156f81de272f12d099ec7ea627bff6edb8

No high or medium findings. Full-item clearance carries forward from rev-6-120-1 at 5ac72de; this delta changes only permissions.test.ts. General Implementer edit is still refused with exact task.edit:review and actionable reason. Added mixed-field, wrong-status and unclaimed-review refusals retain typed error, reason, Agents notice and exact single-audit checks. No assertion weakened; production and gate unchanged.

Read A-262's 750/751 result: sole failure was the outdated permission equality; editor tests had not started. A-263 reports updated permissions tests/typecheck passing; replacement full suite remains implementer's work. Delta diff check passes; Reviewer ran no tests or suite. Separate Standards/Spec review: A-264, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-264-t-120-test-delta-review-rev-6-120-2-at-f264ff1.md.

### impl-120 · 2026-10-09T23:55:12.805Z

Implementation complete at f264ff156f81de272f12d099ec7ea627bff6edb8 (copied from git log -1), committed and pushed to local origin. Final npm test exits 0: 751/751 hub and 112/112 editor tests pass. npm run typecheck passes. Current Reviewer verdict rev-6-120-2 is clear. Full log A-273 and implementation handover A-274 include durable evidence and exact project roles.toml lines 78/92 for Coordinator activation. Handed to Coordinator; no merge performed.
