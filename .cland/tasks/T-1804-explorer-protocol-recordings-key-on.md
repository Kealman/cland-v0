---
id: T-1804
kind: task
title: "Explorer protocol recordings key on unrelated archive-loading state: the same task.plan/task.view frame records a new entry once closed archive rows arrive"
state: open
status: backlog
size: M
labels: []
assignee: null
parent: E-1886
blocked_by: []
topic: null
branch: null
created: 2026-11-10T10:27:55.575Z
updated: 2026-11-16T07:29:23.121Z
---

## Summary

During T-1778's recording refresh (`npm run test:nvim-fixtures`, 2026-11-10, at 665554818), `nvim/test/fixtures/protocol-frames.json` and `protocol-frames/explorer-component.json` each gained 4 canonical entries, which represent 2 result frames (`task.plan` record 82ab3ab3…, `task.view` 89dbc2b6…) plus their normalized input nodes. Their frame and output shapes exactly match existing records. The nearest existing inputs differ only at `/items/21–23`: the archived fixture rows R-30, T-31 and T-32. The recording key therefore depends on whether closed archive rows had loaded when the frame was captured. That is scheduling-state nondeterminism, not a wire change. No timing reproducer has been shown.

## Evidence

impl-1778's classification in topic-1461 (2026-11-10 10:27Z). The generated commit was reverted, and the tree was restored to 665554818.

## Acceptance criteria

- [ ] C1. Recording keys for explorer frames don't depend on archive-loading progress: two recording runs, with archive rows loaded before and after the frame, produce the same canonical entries (test).
- [ ] C2. Ordinary replay covers both archive-loading states, or the explorer awaits a defined archive state before capture (test).
- [ ] C3. `npm run test:nvim-fixtures` run twice in a row leaves no versioned diff (test).
