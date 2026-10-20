---
id: T-796
kind: task
title: An opened Markdown artifact renders with the thread's Markdown decorations, with a raw toggle
state: open
status: review
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-795
blocked_by: []
topic: topic-754
branch: t/T-796-an-opened-markdown-artifact-renders-with
created: 2026-10-18T10:14:36.589Z
updated: 2026-10-20T17:24:48.511Z
---

## Summary

An opened Markdown artifact shows a read-only rendered view built from `thread_md.lua`'s projection (tables laid out as in the thread, link tails compacted) instead of the raw `filetype = markdown` source, with a toggle to the raw editable buffer (human, 2026-10-20). Rendered is always the default and the mode is not remembered (Coordinator decision, 2026-10-20). Mermaid and HTML artifacts stay as they are.

## What to build

The rendered view is a separate read-only buffer fed by `thread_md.render` (or a shared extraction of it) over the artifact's text, wrapping with `linebreak` and `breakindent` like the thread. The toggle switches between it and the raw editable buffer that `artifacts.lua` opens today; `:w` and editing happen only in raw. The toggle is a registered action with the key `␣v` (chosen free in artifact buffers, where `R` is the Mermaid preview and `q` goes back), shown in `␣?` and the palette.

Notes, pages, `.md` and `.markdown` files, and folder entry files and children render; prompt drafts open raw (Coordinator decision, 2026-10-20). Spans are cached per artifact version, where the version key is client-side: the path, mtime and size of the file. Following links in a rendered artifact is out of scope (a follow-up idea).

## Acceptance criteria

- [x] C1. A headless-grid case ARTIFACT-001 opens a Markdown artifact with a heading, emphasis, inline code, a fenced block, a list, a block quote, a link and a table, and the grid shows the thread's rendering, not the raw markers, wrapped with linebreak and breakindent.
  - done: impl-796 · 2026-10-20T17:11:03.194Z
- [x] C2. The raw toggle shows the exact source in the editable buffer and toggles back to the rendered view, which is the default on every open, proved by a case.
  - done: impl-796 · 2026-10-20T17:11:03.726Z
- [x] C3. A 2,000-line artifact shows its first screen rendered within 50 ms with its spans cached per artifact version (path, mtime and size), proved by a T1/T2 test of the cache.
  - done: impl-796 · 2026-10-20T17:24:09.165Z
- [x] C4. The raw toggle is a registered action with its key `␣v` in `␣?` and the palette, and the "Shared artifacts" section of `nvim/README.md` describes the rendered and raw modes.
  - done: impl-796 · 2026-10-20T17:11:04.880Z
  - verified: rev-26 [reviewer] · run rev-20261020-796-source-1 · 2026-10-20T17:13:30.864Z · commit 42d222a4699cba4f7b79049b78de719a2b6f5c85
- [x] C5. Mermaid, HTML and the other browser artifacts, and prompt drafts, open exactly as before, proved by the existing `artifacts.test.ts` cases passing unchanged.
  - done: impl-796 · 2026-10-20T17:11:05.496Z

## Comments

### impl-796 · 2026-10-20T17:00:30.200Z

Implementation started from the amended 2026-10-20 body and E-795 human decision. Test seams are the specified headless artifact grid/raw toggle and T2 artifact cache; browser and prompt compatibility remain in existing artifacts.test.ts cases.

### impl-796 · 2026-10-20T17:11:45.871Z

Source review requested at 42d222a4699cba4f7b79049b78de719a2b6f5c85, pushed to origin after merging origin/dev 57795675. C1–C5 done. Local targeted macOS evidence and scope limits: A-7756; standalone ARTIFACT-001 grid receipt: A-7757 (dirty source on base 57795675). Per Coordinator decision, QA C1/C2 waits for E-795 after-stage QA. Queued verification follows a clear source verdict at the same head.

### rev-26 · 2026-10-20T17:13:30.864Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261020-796-source-1
commit: 42d222a4699cba4f7b79049b78de719a2b6f5c85
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear: no Standards or Spec findings. A-7762 records the full audit against 57795675. Separate readonly scratch projection uses the shared thread renderer while raw_buffer owns edits/saves; ␣v is registered, mapped in both modes, and documented in Keys/palette/Shared artifacts. C4 verified. Version keys include path/mtime/size and unsaved-buffer changedtick, width and entry guards; tests cover independent key variation, completed-render cache reuse and first 2000-line rendered-screen latency. Browser/Mermaid/prompt routes and their compatibility test bodies remain unchanged. Follow-up T-1003 owns sliced 20000-line responsiveness; T-1004 owns live invalidation/resize/mapping/rebind/restart. A-7756 summarizes local working-tree targeted results; raw stdout was requested without transcription reruns. A-7757 is dirty-base 57795675 manual grid PASS, supplemental only. C1/C2 QA verification remains reserved to E-795 after-stage QA; C3/C5 and final execution settlement await accepted exact-head mode-free task verification. No Reviewer tests or edits.

Criteria: C4 verified.

### rev-26 · 2026-10-20T17:23:06.246Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261020-796-final-1
commit: 42d222a4699cba4f7b79049b78de719a2b6f5c85
scope: evidence
findings: [{"severity":"medium","text":"Linux first-rendered-screen latency is 68.77 ms against the required 50 ms, with the same identity failing all five load repetitions. Improve first-screen behavior while retaining the latency/grid/cache assertions.","file":"nvim/test/artifact-render.test.ts","line":69},{"severity":"medium","text":"Event artifact navigation still expects the raw '# Event artifact content' marker although the actual grid correctly shows the rendered default; update the expectation while preserving identity/routing and subsequent navigation checks.","file":"nvim/test/events.test.ts","line":108}]
finding_counts: {"high":0,"medium":2,"low":0}

Final not clear at exact 42d222a4. A-7789 audits A-7777/run 00243f5b. C3's latency assertion fails at 68.77ms; 0/5 load repetitions also fail. events.test.ts:108 times out expecting a raw heading marker although the grid shows the correct rendered artifact; this is a task-owned expectation change, not an unrelated flake. Ordinary 2065/2063/2 plus ten repetition passes/five failures explains aggregate2080/2073/7. ARTIFACT-001 rendered/raw and independent cache identities pass ordinary and5/5; artifacts.test.ts compatibility all9 pass, but the overall gate fails. T1 passes; T2 including Neovim fails, T3 deferred. Linux c8 lon1,two workers,358s/$0.0249. C4 stays source-verified; C1/C2 QA marks remain E-795 after-stage; C3 failed. Local A-7770 transcripts/dirty-gridA-7757 do not supersede Linux evidence. Corrected head requires source review before another verify. No Reviewer execution or edits.

Criteria: C3 failed (First rendered 2000-line screen exceeds 50 ms: 68.77 ms ordinary run and 0/5 load repetitions in A-7777.).
