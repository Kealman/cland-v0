---
id: T-951
kind: task
title: The cland CLI has no `topic create`, so a shell-only session cannot open its item topic
state: open
status: review
size: XS
criterion_seq: 3
labels:
  - needs-triage
assignee: null
parent: E-952
blocked_by: []
topic: topic-724
branch: t/T-951-the-cland-cli-has-no-topic-create-so-a
created: 2026-10-20T09:21:21.788Z
updated: 2026-10-20T09:53:15.946Z
---

## Summary

Found in E-617's DoD demo (qa-676, run qa-2026-10-20-2, at 7916d5f7). An Implementer reports `cland verify` into its own item topic, and General is refused (correctly). But the CLI only offers `topic answer` (hub/src/cli/usage.ts ~165), and `task link --topic` needs an existing topic. A session working only from its shell, or a human, therefore cannot open an item topic; harness sessions use the `topic.create` tool.

## Acceptance criteria

- [x] C1. `cland topic create <title> [--item T-n]` opens a topic under the same role rules as the `topic.create` tool, binding it to the item when given, and the usage lists it.
  - done: impl-951 · 2026-10-20T09:44:53.391Z
- [x] C2. A T2 test covers an Implementer opening its own item's topic from the CLI and a refusal for another item.
  - done: impl-951 · 2026-10-20T09:44:54.291Z
- [ ] C3. A mode-free `cland verify` at the reviewed head is green.

## Comments

### impl-951 · 2026-10-20T09:42:50.949Z

Implementation seam: CLI subprocess → existing topic.create handler on projectHub; cover own claimed item and another-item refusal at T2.
