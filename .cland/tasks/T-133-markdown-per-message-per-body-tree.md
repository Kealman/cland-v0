---
id: T-133
kind: task
title: "Markdown per message: per-body tree-sitter parse with cached conceal spans, plain fallback, verdict colours, blue item ids, 80-column safe"
state: open
status: ready
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
updated: 2026-10-10T03:31:39.287Z
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

### rev-66 · 2026-10-10T03:13:04.378Z

verdict: review
result: not clear
by: rev-66 [reviewer]
run: rev-66-133-2
commit: 952b8d9eb275e7a22097d5a42be229e6315d1b9c

High: 0. Medium: 3. Low: 0. All original A-373 findings resolved.

Medium — nvim/lua/cland/thread_md.lua:437: stacked rendering walks only present data cells; a short row | x | drops its trailing linked header and target at widths78/118 while full width200 preserves them. Iterate all columns with empty cell fallbacks.

Medium — nvim/lua/cland/thread_md.lua:181: duplicate reference labels overwrite the first destination; all full/collapsed/shortcut references resolve to the second URL, contrary to Coordinator's first-wins rule in56d979c5.

Medium — nvim/lua/cland/thread_md.lua:190: link capture excludes URL/email autolinks; both forms have empty target metadata, contrary to Coordinator's follow-up requirement.

Actual pinned-source/bundled-Neovim probes reproduce all three. Original header-only, stacked styled-header, and hidden-URL fit probes now pass. Width sweep confirms explicit empty-leading/middle cells and normal Unicode/styled/link cells preserve positions and targets. Expanded differential covers new regular examples but lacks short-row trailing-header case. No suite or edits.

Full-item unaffected parser/cache/fallback, fences, verdict/gi, incremental extmarks, resize/local options and accepted cost/fold scope carry forward from A-373. Standards:0; Spec:3medium. Evidence A-383: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-383-t-133-952b8d9-review-original-fixes-pass-remaining-link-table-findings.md.

### impl-133 · 2026-10-10T03:23:19.436Z

Metadata/table follow-up committed at ce49922cdb73bdb781bc19197e1b4d9a878e202a (git log -1): first duplicate reference definition wins; URI/email autolinks retain destination and label byte ranges; stacked short rows render all header columns with empty missing cells. Regression covers short/long rows at 80 and full table at 120; generated differential includes all three edges. 15 focused tests and typecheck pass. Baseline npm test: 814/815 hub tests passed; sole verifier-hold rename timing failure assigned to T-145 by Coordinator (A-385). Per Coordinator evidence plan, running locked npm run test:nvim on fix head instead of repeating unchanged hub suite.

### rev-66 · 2026-10-10T03:25:07.687Z

verdict: review
result: not clear
by: rev-66 [reviewer]
run: rev-66-133-3
commit: ce49922cdb73bdb781bc19197e1b4d9a878e202a

High: 0. Medium: 1. Low: 0. All A-383 findings resolved.

Medium — nvim/lua/cland/thread_md.lua:442: header-only stacked iteration drops surplus data cells and their link metadata; a two-header/three-cell row keeps its linked third cell at width 200 but loses it at 78/118. Iterate max(headers,cells), with missing-cell and fallback-label handling. Coordinator accepted in 5a3b9530 and requested an independent generated ragged-table preservation invariant.

Pinned-source/bundled-Neovim probes verify first-definition precedence, full/collapsed/shortcut refs, URL/email autolink target ranges, short-row trailing headers, explicit empty-leading/middle cells, escaped pipes and Cyrillic styled cells. No suite or edits. Tests add corrected short-row cases but no surplus-column preservation check yet.

Full-item unaffected checks in A-373/A-383 carry forward: parser/cache/fallback/fences, extmark differential, verdicts/gi, resize/local options, earlier table fit/header fixes and accepted cost/fold scope. Standards: 0. Spec: 1 medium. Evidence A-387: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-387-t-133-ce49922-review-prior-fixes-pass-surplus-cell-regression.md.

### impl-133 · 2026-10-10T03:29:55.214Z

Ragged-table invariant committed at 7f011884fcb12c41c32a4c4e83ed57c61179616a (git log -1). Stacked projection iterates max(header count, data-cell count), preserving missing cells as empty and surplus cells with positional labels. Generated property checks 12 table shapes with short/equal/long rows at 40,78,118,512: complete ordered label text and link destinations, buffer retention, both full and stacked forms. It fails ce49922 on surplus loss and passes the fix. Differential now includes surplus rows. 16 focused tests, typecheck and both local review axes pass; warm17.102ms/0 parses, append+eviction0.496ms, cold91.270ms/200 parses. Evidence A-388. Previous Neovim run canceled per Coordinator; final locked test:nvim running on this clean head.

### rev-66 · 2026-10-10T03:31:39.269Z

verdict: review
result: clear
by: rev-66 [reviewer]
run: rev-66-133-4
commit: 7f011884fcb12c41c32a4c4e83ed57c61179616a

High: 0. Medium: 0. Low: 0. All A-373/A-383/A-387 findings resolved.

Pinned bundled-Neovim probes confirm source text/targets preserved for missing and surplus cells at 78/118/200, first-wins reference variants and URL/email autolink ranges. Five additional shapes outside the generator (single header/mixed four cells, empty headers/rows, no outer pipes, multiple rich/Unicode links per cell, linked header-only table) retain content/order/targets at 0/1/10/40/78/118/512. Every target range stays within its row and slices its intended label.

Generated property independently derives ordered text/targets from source cells for 12 ragged shapes at four widths, verifies buffer retention, and exercises both layouts. Surplus bodies also enter the full-extmark live differential. Reviewed, not suite-rerun.

Full-item parser/cache/fallback/fences, verdict/gi, fitting/header fixes, incremental extmarks, stale/coalesced resize, local options and accepted cost/fold scope carry forward from earlier reviews. No suite or edits; suite validation remains Implementer/Coordinator work. Standards: 0 findings. Spec: 0 findings.

Evidence A-391: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-391-t-133-7f01188-full-item-review-clear.md.
