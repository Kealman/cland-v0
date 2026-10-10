---
id: T-136
kind: task
title: "The top bar counts now: now-layer messages and asks only, through the message-layer rule"
state: open
status: in progress
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-110
blocked_by:
  - T-134
topic: topic-60
branch: t/T-136-the-top-bar-counts-now-now-layer
created: 2026-10-10T01:20:47.341Z
updated: 2026-10-10T05:16:46.670Z
---

## Parent

T-110 (Threads that read), slice 5 of 5. Spec §3.5 (How surfaces show them).

## What to build

The top bar's count takes only now-layer messages and asks, through the message-layer function from slice 3. Agent-to-agent traffic in any topic no longer raises it.

## Acceptance criteria

- [ ] A burst of agent-to-agent messages in an item topic leaves the top bar's count unchanged; a message addressed to the human raises it; an ask raises it.
- [ ] The count uses the slice-3 classifier; no second rule exists.
- [ ] Headless QA cases cover the count.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Implementer: Codex. References in order of authority: spec §3.14 and §3.5 (the Messages row), then `prototype/thread` (commit `faec351`: `nvim/lua/cland/thread.lua`, `thread_md.lua`, `hl.lua`; checks in `nvim/proto/thread/`), then the mockup `docs/design/main-screen/Thread.dc.html` and `screens/v01-thread.png`. Research `docs/research/nvim-rendering.md` (T-86). ADR 0005: bundled tree-sitter, extmarks, `'statuscolumn'`, folds, no plugins. Keys go through the action registry (T-126); text fitting through the cell-budget fitter (T-125). Tests: headless Neovim on the stub hub; QA cases in `qa/cases/` at 120 and 80 columns.

## Comments

### impl-136 · 2026-10-10T04:58:51.232Z

Read epic/spec and predecessor artifacts A-426, A-331 and A-269. Agreed test seams are the existing stub-hub message protocol and shipped headless QA at 120/80 columns. Extracting the sole classifier to a shared message_layer module; coordinating the report-kind watch rule with impl-135. The top-bar/inbox count distinction is awaiting Coordinator scope guidance.

### impl-136 · 2026-10-10T05:04:36.226Z

The single needs-you chip retains asks/approvals/waiting topics and adds unread messages through the unchanged shared classifier. Live-message count, replay deduplication, reading, ask-message/inbox union, answered asks, and cold/reconnect held-history replay pass targeted stub-hub checks. Added THREAD-009/010 at 120/80 columns with message-frame-only updates and the existing display-cell fitter. Coordinator report-kind behavior stays unchanged per Coordinator decision; T-143 owns the later rule change.

### impl-136 · 2026-10-10T05:16:46.670Z

Final implementation head 96621f685f70502a72fc036e48e0e9020176a632 (copied from git log -1). Self-review fixed held-snapshot read-id replay, preservation of live messages beyond the cold-history window, positive partial reads, and partial reads during the initial load. Seven focused count regressions and THREAD-009/010 pass; typecheck and diff check pass. Standards self-review clear; final Spec delta reviewing. Starting the one machine-locked root npm test on this committed head with Node v24.21.0 first on PATH.
