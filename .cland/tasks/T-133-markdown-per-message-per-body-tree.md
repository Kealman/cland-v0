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
updated: 2026-10-10T03:09:15.983Z
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

### impl-133 · 2026-10-10T02:58:58.931Z

Committed head from git log -1: 28e89fcc8fb9a9da2ce9b0880b2f5dced2b7134d. Focused thread 12/12 and THREAD-001..004 4/4 pass; typecheck passes. Warm redraw 22.609 ms/0 parses, append+fresh parse+eviction 1.243 ms, cold 200 distinct bodies 227.508 ms/200 parses; bounds ≤35/≤2 ms. Resize differential regression and coalesced burst/stale window cases pass. Skill review runs before the single locked root suite; no block cache.

### rev-66 · 2026-10-10T03:02:23.897Z

verdict: review
result: not clear
by: rev-66 [reviewer]
run: rev-66-133-1
commit: 28e89fcc8fb9a9da2ce9b0880b2f5dced2b7134d

High: 0. Medium: 3. Low: 0.

Medium — nvim/lua/cland/thread_md.lua:334: a valid wide header-only pipe table produces lines=[] when stacked because only data rows are emitted; the message body disappears at narrow widths.

Medium — nvim/lua/cland/thread_md.lua:338: stacked header labels copy raw Markdown without spans/link metadata, so [brief](https://...) becomes visible URL text and loses its destination range; project header decorations and links too.

Medium — nvim/lua/cland/thread_md.lua:265: fit uses raw table source width before compacting hidden URLs, so a table with short labels stacks even when its displayed rows fit; fit against projected display-cell widths.

All three reproduced with actual thread_md and bundled Neovim parser in a read-only focused probe. Worktree module matches pinned head; tests reviewed from git show because another session has a dirty test file. Independent per-body parsing/cache, plain failure fallback, bounded fences, full extmark/row-link differential, first-line verdict colours, blue ids/registry gi, scheduled resize guards and local-only conceal options have no other findings. Coordinator's accepted warm ≤35/append ≤2 ms and deferred T-134 foldtext scope respected. No suite or edits.

Standards: 0 findings. Spec: 3 medium findings. Evidence A-373: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-373-t-133-review-28e89fc-table-projection-findings.md.

### impl-133 · 2026-10-10T03:08:22.736Z

Review follow-up: reproduced header-only table loss and stacked header Markdown/link metadata loss. Shared table cell projection now preserves text, highlights and links, fits by rendered widths through the cell fitter, and retains header-only cells. Added valid reference-link destination resolution. Focused new regression checks and updated THREAD-003/004 pass; expanded 80/120 differential and full targeted rerun pending. Root suite remains held.

### impl-133 · 2026-10-10T03:09:15.983Z

Delta head from git log -1: 952b8d9eb275e7a22097d5a42be229e6315d1b9c, clean. Focused thread14/14 and width-aware differential pass; updated THREAD-003/004 pass and typecheck passes. Table cells/headers carry rendered text, spans and links together; full columns fit rendered widths through shared fitter, narrow headers retain Markdown/targets, header-only content stays. Valid reference links also retain destinations. Warm21.412 ms/0 parses, append+eviction1.279 ms, cold221.701 ms/200 distinct parses. Root suite held for Coordinator's review delta.
