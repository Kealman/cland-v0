---
id: T-1090
kind: task
title: Refresh the recorded Neovim fixture counts after the open-snapshot changes
state: open
status: backlog
size: XS
labels:
  - ready-for-agent
assignee: null
parent: C-216
blocked_by:
  - T-1089
topic: null
branch: null
created: 2026-10-22T01:06:41.895Z
updated: 2026-10-22T01:06:41.895Z
---

## Summary

After T-1079's selector fix, the full Neovim fixture recorder on dev fails a separate completeness guard: "fixture refresh failed: nvim/test/explorer-component.test.ts recorded 280 frames; expected at least 296" (impl-1079, 2026-10-22, macOS scratch clone). All 25 tests in that file pass. The committed per-file slice count predates the explorer's open-snapshot and closed-page changes (T-1081, with T-1089 in flight), so the recorded expectation is stale.

## Acceptance criteria

- [ ] C1. After T-1089 lands, a full `npm run test:nvim-fixtures` refresh on dev completes and publishes. Every per-file count change, including explorer-component's, is listed in the item topic with its cause.
- [ ] C2. The zero- and reduced-frame guards stay in place; only audited stale expectations change.
