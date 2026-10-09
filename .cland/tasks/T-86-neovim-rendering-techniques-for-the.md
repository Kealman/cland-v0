---
id: T-86
kind: question
title: Neovim rendering techniques for the thread and a task graph
state: closed
labels:
  - wayfinder:research
assignee: human
parent: T-81
blocked_by: []
topic: null
branch: null
created: 2026-10-09T19:09:40.428Z
updated: 2026-10-09T20:10:16.074Z
---

## Question

With Neovim 0.12 and no plugins, which techniques render a readable chat thread and a dependency graph in a buffer, what are their limits, and what should the two prototypes try first?

## Context

Threads today are plain text: one blank line between messages, no Markdown, no rules, no dates; the human found them a wall of white text and sat in the Coordinator's TUI instead. The board proved less useful than the items panel; the human wants a graph of an epic's items (what follows what, what runs in parallel) scrollable in both axes. Techniques to verify: `line_hl_group` and `hl_eol` extmarks for message bands and author gutters; virtual lines for separators and dates; tree-sitter Markdown with conceal for headings, code blocks, lists and links (what `render-markdown.nvim`-style rendering needs, what breaks on narrow widths); folds for long or agent-to-agent messages; `winhighlight` per window; for the graph, layered DAG layout in text (what `git log --graph` and dagre-style layering do), box-drawing versus ASCII, lanes for parallel items, horizontal scrolling, a cursor on a node with `gi`, `gt`, `gs`.

## Deliverable

`docs/research/nvim-rendering.md` on branch `research/nvim-rendering`: each technique with a minimal Lua snippet verified in headless Neovim (`nvim --clean -u`), what it can and cannot do, and a first-try list for the prototypes "Thread rendering in Neovim" and "Task graph view in Neovim".

## Comments

### human · 2026-10-09T20:10:11.012Z

Resolution: research on branch research/nvim-rendering, file docs/research/nvim-rendering.md (commit 6c3a803).

- **Every thread technique the ticket lists works in 0.12.5 without plugins.** Four of them combined well in one probe (P11), observed:
  - a role gutter from `'statuscolumn'`, which also marks wrapped rows and stays blank on virtual lines;
  - a full-width message band from `line_hl_group`;
  - day rules as `virt_lines`;
  - the delivery stage as `eol_right_align` virtual text with `hl_mode = 'combine'`, which keeps the band under it.
- **The bundled Markdown parser and queries conceal less than render-markdown does.** At `conceallevel=2` they hide emphasis marks, code-span backticks, link targets, and whole code-fence lines (`conceal_lines`, new in 0.11). Headings are bold through `@markup.heading` → `Title`, but the `##`, the bullets, the checkboxes and the `>` stay as raw text. render-markdown and markview add the rest with conceal, overlay or inline virtual text and line highlights. A hand-made version of those decorations is about 30 lines (P5).
- **Narrow widths break five things (observed):**
  - Concealed text keeps its line breaks ([neovim#14409](https://github.com/neovim/neovim/issues/14409), open): a line concealed from 59 to 26 characters still took two rows at 44 columns.
  - `right_align` virtual text covers the header's own text once the header wraps.
  - An overlay repeated on wrapped rows hides each row's first character unless those rows are indented.
  - A pipe table wraps mid-row.
  - `foldtext` is cut off rather than wrapped.
- **One Markdown tree for a whole thread is fragile.** An unclosed fence in one message turned every later message into code (observed). Per-message isolation works in two ways:
  - with the `@private` `LanguageTree:set_included_regions()`;
  - with one string parser per message whose spans are cached and re-applied as extmarks. This uses public API only and costs about 0.3 ms per message once, then 6.5 to 6.8 ms to re-apply 7,096 extmarks for 200 messages.
- **Cost at 200 messages (1,704 lines):**
  - Plain text with bands, gutters and 66 closed folds re-renders and redraws in about 1.2 ms.
  - Under the bundled highlighter, a full rewrite plus redraw costs 17 to 21 ms at `conceallevel` 0 and 20 to 33 ms at 2. The extra comes from the highlighter's per-row `conceal_lines` check.
  - After a single whole-buffer `parse(true)`, the same rewrite costs 68 to 97 ms.
  - Appending a message instead costs 7 to 22 ms.
- **Folds collapse agent-to-agent messages well** with an expression `'foldexpr'` and a chunked `'foldtext'`. Fold state is not tied to messages, though: an opened fold closed again when a re-render inserted three lines above it, and a closed fold hides the virtual lines on its lines. `conceal_lines` is no substitute, because the cursor walks onto the hidden lines.
- **The graph fits a buffer at T-19's size with Sugiyama layering, as dagre implements it.** T-19 has 10 layers and at most 6 items side by side. Drawn left to right with box-drawing characters, it is 300 to 318 columns wide and 15 to 19 rows high. A transitive reduction drops 4 of the 36 edges and cuts crossings from 11 to 5. Git's lane layout gives one item per row instead, but needs 58 rows for the 22 items (43 after reduction), with 18 to 22 columns of ASCII lanes.
- **Text-graph limits (observed):**
  - In box-drawing, a `┼` cannot tell a crossing from a junction; in ASCII every junction is `+`.
  - The glyphs are one cell wide only with `'ambiwidth'` "single".
  - Byte columns are not display columns: T-33's label starts at display column 248 but byte column 334.
  - `<cWORD>` finds an item id only when the cursor is on the id itself. One extmark per label, looked up with `nvim_buf_get_extmarks(..., {overlap = true})`, finds the node from anywhere on its label.
  - Without `'virtualedit'` "all", moving down onto a short row reset the horizontal scroll from column 200 to 0.
- **Layout and drawing cost 0.7 to 2.3 ms for 22 to 40 nodes, so legibility is the limit, not speed.** A random 40-node DAG with long edges still had 122 crossings after reduction and ordering.

Open points for the tickets this research feeds (T-97, T-98; section 4 of the doc is their first-try list): for the thread, whether Markdown comes from cached per-message spans or the buffer highlighter, and whether agent-to-agent messages collapse as folds or as a summary line the renderer draws (T-94 decides which messages collapse); for the graph, which ranking defines a column (ASAP waves or dagre's longest path), where unlinked items go, and whether the layered view or the Git-style list serves the human better.

### human · 2026-10-09T20:10:16.074Z

Resolved: see the resolution comment
