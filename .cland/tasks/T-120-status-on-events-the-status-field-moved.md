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
topic: null
branch: null
created: 2026-10-09T21:56:19.707Z
updated: 2026-10-09T21:56:19.707Z
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
