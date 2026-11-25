---
id: T-2007
kind: task
title: Migrate the remaining QA test callers (qa.test, qa-shipped via qa-runner) to whole-caller fixture ownership
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-2073
blocked_by: []
topic: null
branch: null
created: 2026-11-19T14:04:47.226Z
updated: 2026-11-25T13:02:26.514Z
---

## Summary

The existing QA test callbacks in `nvim/test/qa.test.ts`, and the T4 `nvim/test/qa-shipped.test.ts` through `qa-runner.ts`, still use raw test contexts. Their async root and setup work runs before the child process starts, with no whole-caller owner or join. T-1805 migrated only its five new QA controls to `receiptFixtureCase` (rev-36 source review 4, A-21807). impl-1805 found the rest by reading the code on 2026-11-19; nothing reproduced.

## What to build

Migrate the remaining QA callers to the shared whole-caller fixture ownership that T-1805 used: pre-acquisition normal and signal ownership, named setup bounds, and joins of original work, late roots and children before storage cleanup. Keep every QA case's assertions unchanged.

## Acceptance criteria

- [ ] C1. Every callback in `nvim/test/qa.test.ts` and `nvim/test/qa-shipped.test.ts` that acquires a root or child runs under whole-caller fixture ownership, listed by name in the item (test).
- [ ] C2. A control interrupting setup mid-acquisition shows the root and child joined before storage removal (test).
