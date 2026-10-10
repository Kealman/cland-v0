---
id: T-133
kind: task
title: "Markdown per message: per-body tree-sitter parse with cached conceal spans, plain fallback, verdict colours, blue item ids, 80-column safe"
state: open
status: in progress
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-110
blocked_by:
  - T-132
topic: topic-53
branch: t/T-133-markdown-per-message-per-body-tree
created: 2026-10-10T01:20:46.534Z
updated: 2026-10-10T02:48:34.396Z
---

## Parent

T-110 (Threads that read), slice 2 of 5. Spec §3.14 (Markdown per message).

## What to build

Each message body is parsed on its own with the bundled tree-sitter Markdown parser, never one tree for the thread. Spans are cached by text and drawn with conceal. Headings, inline code, fenced code blocks (fences hidden, a faint language label on the first row, the block inset inside the band), lists aligned under the bullet text, and links shown as underlined text. An unclosed code block cannot spill into later messages, and a body the parser rejects stays plain text. A verdict's first line shows its result in red or green. Item ids in bodies are blue and are `gi` targets. The five narrow-width breakages T-86 lists are handled at 80 columns.

## Acceptance criteria

- [ ] A Coordinator message with a heading, a fenced block, a list, inline code and a link renders at 120 and 80 columns.
- [ ] An unclosed fence in one message leaves the next message unaffected, and an unparsable body shows as plain text.
- [ ] A not-clear verdict's first line is red, and a clear one green.
- [ ] Item ids in a body are blue, and `gi` on one opens the item.
- [ ] None of T-86's five narrow-width breakages appears at 80 columns; a QA case shows each.
- [ ] Appending a message parses only that message; the cache is keyed by text.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Implementer: Codex. References in order of authority: spec §3.14 and §3.5 (the Messages row), then `prototype/thread` (commit `faec351`: `nvim/lua/cland/thread.lua`, `thread_md.lua`, `hl.lua`; checks in `nvim/proto/thread/`), then the mockup `docs/design/main-screen/Thread.dc.html` and `screens/v01-thread.png`. Research `docs/research/nvim-rendering.md` (T-86). ADR 0005: bundled tree-sitter, extmarks, `'statuscolumn'`, folds, no plugins. Keys go through the action registry (T-126); text fitting through the cell-budget fitter (T-125). Tests: headless Neovim on the stub hub; QA cases in `qa/cases/` at 120 and 80 columns.

## Comments

### impl-133 · 2026-10-10T02:42:12.535Z

Starting at the assigned Neovim/stub-hub seam. Reading spec, ADR, research/probes, prototype and T-132 notes; will extend differential extmark coverage and measure parse/rewrite cost.

### impl-133 · 2026-10-10T02:48:34.396Z

Implemented cached per-body tree-sitter spans through T-132's body seam, code inset/fence conceal, compact links retaining row destinations, responsive table projection, verdict colours and existing registry gi targets. Thread targeted suite 11/11 including Markdown differential states/extmarks/links; THREAD-003/004 pass at 120/80 columns. Four T-86 breakages covered; foldtext clipping is deferred to T-134 per Coordinator. Optimizing cached redraw cost before final checks.
