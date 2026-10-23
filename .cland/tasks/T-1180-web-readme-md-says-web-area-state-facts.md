---
id: T-1180
kind: task
title: web/README.md says web-area-state facts do not yet have UI
state: open
status: backlog
size: XS
labels:
  - qa-found
  - needs-triage
assignee: null
parent: C-326
blocked_by: []
topic: null
branch: null
created: 2026-10-23T10:53:51.578Z
updated: 2026-10-23T10:53:51.578Z
---

## Summary

E-417 stage-4 QA (A-9983, qa-s4-2026-10-23-1 at e2721ab5) found that `web/README.md` around line 446 still says web-area-state covers "facts that do not yet have UI". The Sessions, Accounts and artifact model facts it means now have rendered areas (E-418 stages 1–3).

## What to build

Reword the sentence so it describes what web-area-state holds today, with no "not yet" claim about areas that have landed.

## Acceptance criteria

- [ ] C1. `web/README.md` no longer says any web-area-state fact lacks UI, and its description of web-area-state matches the areas that render those facts (docs).
