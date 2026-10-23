---
id: T-1180
kind: task
title: web/README.md says web-area-state facts do not yet have UI
state: closed
status: done
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
updated: 2026-10-23T12:37:41.269Z
closed: 2026-10-23T12:37:41.269Z
---

## Summary

E-417 stage-4 QA (A-9983, qa-s4-2026-10-23-1 at e2721ab5) found that `web/README.md` around line 446 still says web-area-state covers "facts that do not yet have UI". The Sessions, Accounts and artifact model facts it means now have rendered areas (E-418 stages 1–3).

## What to build

Reword the sentence so it describes what web-area-state holds today, with no "not yet" claim about areas that have landed.

## Acceptance criteria

- [ ] C1. `web/README.md` no longer says any web-area-state fact lacks UI, and its description of web-area-state matches the areas that render those facts (docs).

## Comments

### coord · 2026-10-23T12:37:41.269Z

Fixed by T-1141 (20bab840): web/README.md's web-area-state paragraph now describes merged session rows and launch defaults, ordered account views, queue receipts and artifact inventories, with no claim that those facts lack UI.
