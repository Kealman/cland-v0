---
id: T-1993
kind: task
title: The duration-allowance printer names the nearest open container as owner, which the lint refuses for epics
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-19T02:34:21.412Z
updated: 2026-11-19T02:34:21.412Z
---

## Summary

`durationAllowanceStanzas` prints the allowance owner as the task's nearest open container, and docs/agents/tests.md documents that rule. For a task under an epic, the duration lint refuses that stanza: "duration allowance has epic owner E-1883 ... use a standing container (for example E-880)". impl-1952 hit this in T-1952 on 2026-11-19, so the shared printer's own output fails admission.

## What to build

Make the printer pick an owner the lint accepts, a standing container, and make docs/agents/tests.md say the same. Keep one rule for owner admission and have the printer use it, so the two can't drift apart again.

## Acceptance criteria

- [ ] C1. For a task under an epic, the printed stanza names a standing container, and the duration lint accepts it unchanged (test, red on the current printer).
- [ ] C2. docs/agents/tests.md's generated-stanza paragraph states the same owner rule the lint enforces (docs).
