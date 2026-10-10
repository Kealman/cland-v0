---
id: T-132
kind: task
title: "Message blocks: header, role gutter, the human's band, day rules, delivery stage; appends touch only their own lines"
state: open
status: backlog
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-110
blocked_by:
  - T-127
topic: null
branch: null
created: 2026-10-10T01:20:46.278Z
updated: 2026-10-10T01:20:46.278Z
---

## Parent

T-110 (Threads that read), slice 1 of 5. Spec §3.14 (Messages, Cost).

## What to build

A topic thread renders each message as one block. The header reads `sender [Role] → addressees  HH:MM` (`→ you` for the human), with the delivery stage or the waiting state at the right. A gutter bar in the role's colour runs down every screen row of the message, wrapped rows included, drawn through `'statuscolumn'` and heavier on the message under the cursor. A band sits behind the human's messages. A rule marks each local day. Continuation rows align with the text (`breakindent`), and lines break only at spaces, so ids like T-58 stay whole. The thread keeps the latest 200 messages. A new message is appended, and a stage change rewrites only that message's lines; neither redraws the thread.

## Acceptance criteria

- [ ] General's real history renders with headers, role gutters (the Coordinator teal, Implementers violet, Reviewers pink, QA sky, the human blue), the human's band and a rule per local day.
- [ ] A new message is appended without a full rewrite (under 1 ms at 200 messages), and a delivery-stage change rewrites only its message; a test counts the touched lines.
- [ ] A full rewrite of 200 messages stays within the T-86 budget (tens of milliseconds); a test measures it.
- [ ] Wrapped rows keep the gutter, continuation rows align, and `T-58` never breaks across rows.
- [ ] Headless QA cases cover the thread at 120 and 80 columns, as the successor of `THREAD-PROTO`.
- [ ] `nvim/README.md` describes the thread's blocks.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Implementer: Codex. References in order of authority: spec §3.14 and §3.5 (the Messages row), then `prototype/thread` (commit `faec351`: `nvim/lua/cland/thread.lua`, `thread_md.lua`, `hl.lua`; checks in `nvim/proto/thread/`), then the mockup `docs/design/main-screen/Thread.dc.html` and `screens/v01-thread.png`. Research `docs/research/nvim-rendering.md` (T-86). ADR 0005: bundled tree-sitter, extmarks, `'statuscolumn'`, folds, no plugins. Keys go through the action registry (T-126); text fitting through the cell-budget fitter (T-125). Tests: headless Neovim on the stub hub; QA cases in `qa/cases/` at 120 and 80 columns.
