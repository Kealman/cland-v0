---
id: T-196
kind: task
title: "Epics close by QA (D16): criteria marks on containers, and task.close requires a clear QA verdict with every criterion verified"
state: open
status: planned
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-117
blocked_by: []
topic: null
branch: null
created: 2026-10-10T16:41:01.014Z
updated: 2026-10-10T16:41:06.770Z
---

## Parent

T-112 (Criteria that live). From D16 (the human, 2026-10-10): an epic closes when all its children are closed and QA has run its definition-of-done demo on dev with a clear verdict recorded on the epic, criteria verified by id, in the same gate shape as items.

## What to build

Today criteria operations refuse anything but a task (`criteria operations require a task`, tracker.ts). A container closes as soon as its children are closed, with no verdict check. D16 needs both to change:
- Criteria marks (verify and fail, done where it applies) work on containers (epics and releases), so a QA verdict on an epic can pass `--verified` with the epic's Definition-of-done checkbox ids.
- Closing an epic (`task.close` / `cland task close`) requires a current clear QA verdict on it with every criterion verified, in addition to no open children, and refuses naming what is missing. The human's `--override` skips it, logged as for merges.
- Releases keep their own path through `cland release --item` (T-117).

## Acceptance criteria

- [ ] QA can record `--verified C1,…` on an epic's clear verdict, and the epic's criteria show the marks.
- [ ] `cland task close T-<epic>` refuses without a current clear QA verdict with all criteria verified, naming the missing ones; it succeeds once they are present.
- [ ] Closing an epic with open children still refuses as today.
- [ ] Docs (docs/agents/issue-tracker.md, docs/review-and-qa.md, the QA clause) describe epic closure by QA.
- [ ] `npm run typecheck && npm test` pass.

## Notes

High: it blocks closing epics under D16 the gated way. Until it lands, the Coordinator closes an epic by hand after QA's clear verdict on it lists the verified checkboxes in its text. Size S to M.
