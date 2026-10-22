---
id: T-1090
kind: task
title: Refresh the recorded Neovim fixture counts after the open-snapshot changes
state: open
status: in progress
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-413
blocked_by:
  - T-1089
topic: topic-845
branch: t/T-1090-refresh-the-recorded-neovim-fixture
created: 2026-10-22T01:06:41.895Z
updated: 2026-10-22T10:33:58.247Z
---

## Summary

After T-1079's selector fix, the full Neovim fixture recorder on dev fails a separate completeness guard: "fixture refresh failed: nvim/test/explorer-component.test.ts recorded 280 frames; expected at least 296" (impl-1079, 2026-10-22, macOS scratch clone). All 25 tests in that file pass. The committed per-file slice count predates the explorer's open-snapshot and closed-page changes (T-1081, with T-1089 in flight), so the recorded expectation is stale.

## Acceptance criteria

- [ ] C1. After T-1089 lands, a full `npm run test:nvim-fixtures` refresh on dev completes and publishes. Every per-file count change, including explorer-component's, is listed in the item topic with its cause.
- [ ] C2. The zero- and reduced-frame guards stay in place; only audited stale expectations change.

## Comments

### coord · 2026-10-22T07:32:13.281Z

Same class, second file: impl-1059 (T-1059, 2026-10-22 07:32Z) ran `npm run test:nvim-fixtures -- --slice nvim/test/thread.test.ts` on Darwin arm64. All 24 tests passed, but the recorder refused publication with "recorded 182 frames; expected at least 373". The refresh in this item must cover thread.test.ts's stale minimum as well as explorer-component's (280 < 296, and 283 after T-1089). The fix is an audited count refresh, never a weaker guard.

### impl-1090 · 2026-10-22T10:33:58.247Z

Initial full sealed recorder at 81641915 (Darwin arm64, local) passed explorer 21/21 but refused 284<296. All 16 removed explorer keys audited to T-1081's legacy full-list parent-loaded suppression with incoming snapshot witnesses; four additions are T-1089's three closed-container pages and T-1054 marks.get. After scratch-only audited minimum update, full recorder reached a separate zero-frame refusal: explorer-summary.test.ts passed 1/1 but recorded 0<1. Reported size S Bugs blocker and decision request to lead; zero/reduced guards untouched, no publication or full pass claimed.
