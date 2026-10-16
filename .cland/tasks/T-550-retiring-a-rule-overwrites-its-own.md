---
id: T-550
kind: task
title: Retiring a rule overwrites its own origin with the retirement's origin
state: open
status: in progress
size: S
labels:
  - v0.1.3
  - hub
  - qa-found
assignee: null
parent: E-423
blocked_by: []
regression_of: T-455
topic: null
branch: t/T-550-retiring-a-rule-overwrites-its-own
created: 2026-10-16T00:31:38.513Z
updated: 2026-10-16T00:32:43.713Z
---

## Summary
Found by qa-27 in E-423's Definition-of-done demo (run qa-2026-10-16-27-15, case L10, at cdad9cdc). Retiring a rule replaced its origin (`session:qa-aide`) with the retiring human message's origin (`message:general/<id>`). The E-423 brief, and the rulebook's purpose, require each rule to keep its own origin. The cause is in `hub/src/rules/file.ts:120`: `retire()` spreads `{ origin }` over the rule whenever an origin is passed.

## Acceptance criteria
- [ ] C1. Retiring a rule keeps its own `origin` unchanged and records the retirement's origin in a separate field (for example `retired_origin`), which `cland rule show` and `rule.list --all` display.
- [ ] C2. A test retires a rule added by an Aide session through a human-origin retirement, and reads back both origins. `rule edit` keeps its current origin behaviour, and RULES.md round-trips the new field.
