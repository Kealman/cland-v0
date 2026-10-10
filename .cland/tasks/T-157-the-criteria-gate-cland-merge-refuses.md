---
id: T-157
kind: task
title: "The criteria gate: cland merge refuses until every criterion is done and verified and names them; ready waits for the same; in-flight items are not stranded"
state: open
status: planned
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-112
blocked_by:
  - T-155
  - T-156
topic: null
branch: null
created: 2026-10-10T07:49:36.269Z
updated: 2026-10-10T09:25:26.733Z
---

## Parent

T-112 (Criteria that live), slice 4 of 5. Spec §3.4 (The merge gate), §3.2 (ready).

## What to build

`cland merge` refuses while any criterion is not done, or not verified by at least one verdict, and names those criteria. `ready` waits for the same. An item with no criteria passes this check. Items already in flight when this lands are not stranded: a legacy section with no ids reads as unmarked criteria, so the gate refuses; the refusal says how to mark them (Implementer marks done, a verdict with `--verified`).

## Acceptance criteria

- [ ] `cland merge T-n` refuses while a criterion is not done or not verified, naming each; it accepts once all are done and verified.
- [ ] `ready` waits for the same condition.
- [ ] An item with no criteria passes the criteria check.
- [ ] The refusal names the path forward for a legacy section; a frame-protocol test covers an in-flight legacy item reaching merge.
- [ ] `docs/review-and-qa.md` and `hub/README.md` describe the gate.
- [ ] `npm run typecheck && npm test` pass.

## Blocked by

- T-155 (Marks the hub writes)
- T-156 (Verdicts verify)
