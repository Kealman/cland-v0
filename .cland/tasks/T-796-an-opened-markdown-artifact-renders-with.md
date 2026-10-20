---
id: T-796
kind: task
title: An opened Markdown artifact renders with the thread's Markdown decorations, with a raw toggle
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-795
blocked_by: []
topic: topic-754
branch: t/T-796-an-opened-markdown-artifact-renders-with
created: 2026-10-18T10:14:36.589Z
updated: 2026-10-20T17:00:30.200Z
---

## Summary

An opened Markdown artifact shows a read-only rendered view built from `thread_md.lua`'s projection (tables laid out as in the thread, link tails compacted) instead of the raw `filetype = markdown` source, with a toggle to the raw editable buffer (human, 2026-10-20). Rendered is always the default and the mode is not remembered (Coordinator decision, 2026-10-20). Mermaid and HTML artifacts stay as they are.

## What to build

The rendered view is a separate read-only buffer fed by `thread_md.render` (or a shared extraction of it) over the artifact's text, wrapping with `linebreak` and `breakindent` like the thread. The toggle switches between it and the raw editable buffer that `artifacts.lua` opens today; `:w` and editing happen only in raw. The toggle is a registered action with the key `␣v` (chosen free in artifact buffers, where `R` is the Mermaid preview and `q` goes back), shown in `␣?` and the palette.

Notes, pages, `.md` and `.markdown` files, and folder entry files and children render; prompt drafts open raw (Coordinator decision, 2026-10-20). Spans are cached per artifact version, where the version key is client-side: the path, mtime and size of the file. Following links in a rendered artifact is out of scope (a follow-up idea).

## Acceptance criteria

- [ ] C1. A headless-grid case ARTIFACT-001 opens a Markdown artifact with a heading, emphasis, inline code, a fenced block, a list, a block quote, a link and a table, and the grid shows the thread's rendering, not the raw markers, wrapped with linebreak and breakindent.
- [ ] C2. The raw toggle shows the exact source in the editable buffer and toggles back to the rendered view, which is the default on every open, proved by a case.
- [ ] C3. A 2,000-line artifact shows its first screen rendered within 50 ms with its spans cached per artifact version (path, mtime and size), proved by a T1/T2 test of the cache.
- [ ] C4. The raw toggle is a registered action with its key `␣v` in `␣?` and the palette, and the "Shared artifacts" section of `nvim/README.md` describes the rendered and raw modes.
- [ ] C5. Mermaid, HTML and the other browser artifacts, and prompt drafts, open exactly as before, proved by the existing `artifacts.test.ts` cases passing unchanged.

## Comments

### impl-796 · 2026-10-20T17:00:30.200Z

Implementation started from the amended 2026-10-20 body and E-795 human decision. Test seams are the specified headless artifact grid/raw toggle and T2 artifact cache; browser and prompt compatibility remain in existing artifacts.test.ts cases.
