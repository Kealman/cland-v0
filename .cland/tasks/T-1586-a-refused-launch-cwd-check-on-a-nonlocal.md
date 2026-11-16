---
id: T-1586
kind: task
title: A refused launch-cwd check on a nonlocal host names the host's refusal
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1884
blocked_by: []
regression_of: T-1553
found_by: qa
topic: null
branch: null
created: 2026-11-02T01:53:50.628Z
updated: 2026-11-16T07:31:15.744Z
---

## Summary

A launch on a nonlocal host whose cwd check is refused by that host reports `invalid-cwd: launch cwd "<path>" is not an accessible directory`, which hides that the host refused the operation. The refusal names the host and its reason.

## What to build

When the launch's cwd check (`statDirectory`) on a nonlocal host fails because the host refused or failed the operation, the launch result names the host and carries the host's error, for example `host t1 could not check launch cwd "<path>": test host t1 refuses statDirectory`. A cwd that the host reports missing or not a directory keeps today's `invalid-cwd` wording. The local host keeps today's message unchanged.

Found by qa-678 in E-1531 stage-2 QA (E1531S2-18, topic-1315, 2026-11-02 01:53Z): an Implementer launched on test host t1 returned `invalid-cwd` after the only Host operation `t1:statDirectory` was refused.

## Acceptance criteria

- [ ] C1. A launch on a nonlocal host whose `statDirectory` of the cwd is refused returns an error naming the host and the host's refusal, with no process row left.
- [ ] C2. A cwd the host reports missing or not a directory keeps the `invalid-cwd` code and wording.
- [ ] C3. On the local host, launch cwd errors are byte-identical to today's, proven by the existing launch tests passing unchanged.
