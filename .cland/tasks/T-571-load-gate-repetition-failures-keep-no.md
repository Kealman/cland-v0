---
id: T-571
kind: task
title: Load-gate repetition failures keep no assertion text, so a remote 4/5 can't be diagnosed from its log
state: open
status: backlog
size: S
labels:
  - hub
  - tech-debt
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-10-16T04:36:25.357Z
updated: 2026-10-16T04:36:25.357Z
---

## Summary
Found by impl-557 on 2026-10-16, and confirmed by its Reviewer in A-3706. When a repetition in T-471's new-test load gate fails, the collected log keeps only the count ("4/5"). The repetition child reports through the load-gate JSON reporter alone, so no assertion or stack text reaches the artifact. In T-557's run ef335684 (A-3704:1062) the cause had to be guessed and reproduced locally. The same gap hid the cause of T-570's 4/5 and T-556's 0/5.

## Acceptance criteria
- [ ] C1. A failed exact-name repetition writes a bounded excerpt of its `test:fail` diagnostic (assertion message, file:line) into the suite log and report next to the count, with the existing redaction and receipt checks unchanged.
- [ ] C2. A test makes one repetition of a new test fail and shows its assertion text in the log and in the posted report.
