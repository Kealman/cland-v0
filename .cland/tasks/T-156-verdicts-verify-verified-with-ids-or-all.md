---
id: T-156
kind: task
title: "Verdicts verify: --verified with ids or all on a verdict, failed criteria with notes, the Reviewer and QA clauses and skills verify by id"
state: open
status: backlog
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-112
blocked_by:
  - T-155
topic: null
branch: null
created: 2026-10-10T07:49:36.173Z
updated: 2026-10-10T07:49:36.173Z
---

## Parent

T-112 (Criteria that live), slice 3 of 5. Spec §3.4 (verified inside a verdict).

## What to build

A verdict verifies criteria. `cland task comment --verdict review|qa` and the verdict tools take `--verified C1,C3` or `--verified all`; a clear verdict with them writes verified marks carrying the verdict's run. A not-clear verdict may name failed criteria with notes. The Reviewer and QA clauses, and the `code-review` and `qa` skills, tell those roles to verify by id and to fail with a note. The verdict's message in the thread lists the criteria it marked.

## Acceptance criteria

- [ ] `--verified` with ids or `all` on a clear verdict marks those criteria verified with the run id; an unknown id refuses the verdict and names it.
- [ ] A not-clear verdict can fail criteria by id with notes, with the same effect as `task.criterion fail`.
- [ ] The verdict's message lists the criteria it marked.
- [ ] The Reviewer and QA default clauses and the `code-review` and `qa` skills describe verifying by id; the handover names the instance lines for `.cland/roles.toml`.
- [ ] `docs/review-and-qa.md` describes `--verified`.
- [ ] `npm run typecheck && npm test` pass.

## Blocked by

- T-155 (Marks the hub writes)
