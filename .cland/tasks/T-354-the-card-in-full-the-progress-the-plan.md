---
id: T-354
kind: task
title: "The card in full: the progress, the plan stage, the latest verdict with its round, reason and scope, the relations with regression_of, the branch and the latest cland verify, the dates and last activity, the Decision block, zb, and the card over the right panel when the centre is narrow"
state: open
status: backlog
size: L
labels:
  - v0.1.2
  - nvim
  - ready-for-agent
assignee: null
parent: E-276
blocked_by:
  - T-352
  - T-353
topic: null
branch: null
created: 2026-10-13T20:53:51.826Z
updated: 2026-10-13T20:53:54.259Z
---

## Summary

The card shows everything §3.9 lists, from the hub's summary fields and the one cached `task.view` of the item shown, never a `task.view` per row. That covers the progress, the plan stage, the latest verdict, the relations, the branch and suite block, the dates, the Decision block and the agents' text behind `zb`. When both side panels leave the tree too narrow, the card takes the right panel's place.

## Parent

E-276: The explorer and the card, tracer bullet 2. Spec: `docs/spec/v0.1.2.md` §3.9 (The card, the accepted mockups T-260, the prototype's answers) and §3.8 (the prototype's answers: the card over the right panel). The hub fields: `closed`, `criteria` and `verify` (T-330), `size` and `regression_of` (T-331), the verdict `scope` (T-332), the stages of a closed epic (T-328), `rank_set` (ticket T-353). Prototype: `explorer_card.lua` (`C.compose`, `C.paint`) on `prototype/explorer`. Boards: `CardTask.dc.html`, `CardEpic.dc.html`.

## What to build

**The blocks** after ticket T-352's summary and facts, in the boards' order. Each block is a section line (`PROGRESS`, …) with its right-aligned hint in faint.

1. **Facts, completed.** `rank <n>` with the ordinal only when the summary carries `rank_set` (ticket T-353). Otherwise the ordinal alone.
2. **Progress.**
   - **Task.** The criteria from the cached `task.view` (`criteria`), one line each: the glyph (○ open, ◐ done, ● verified, ✗ failed, as `cland.criteria` draws them), the id and the text, and under it the latest mark (`verified · rev-26 · r1 · 18:31`, or the failed note). The header reads `N of M verified · K failed · S stale` from the summary's `criteria` counts.
   - **Container.** `N of M done`, one cell per child in status order (ticket T-350's cells), and the counts in words (`2 done · 1 review · 2 in progress · 2 planned, 1 blocked · 3 backlog`). For an epic with a plan, the same cells per stage, one line each (`S1 ■■ closed`).
3. **Plan** (epic only), from `plan.get(epic)`.
   - The section is `plan · stage n of m`.
   - The stage in work with its merged count and QA policy. The stages before and after, one line each with their state and closing time.
   - The approval line: `approval human · approved by <who> <when>`, `pending`, or `not required`.
   - `gp opens the plan view` as the hint.
   - An epic without a plan shows `no plan`. A closed epic shows every stage closed (T-328).
4. **Latest verdict.**
   - **Task.** The latest verdict in file order, with:
     - `✓` or `✗`, the kind and the result;
     - `by` with its role, and the round (the verdict's position among the item's verdicts of that kind);
     - the scope (`full`, `delta` or `evidence`) when present, and the time;
     - the one-line reason: the first sentence of the verdict comment's text after its header, from the cached `task.view` `comments`, matched by `run`;
     - the run id.
   - **Container.** The latest verdict in its subtree by `at`, naming the item (`in its tasks · T-279 The card`). Its reason needs that item's `task.view`, one cached fetch.
   - `none yet` when there is none.
5. **Branch and suite** (task only).
   - `branch` is the summary's `branch` or `—`.
   - `suite` comes from the summary's `verify`: `✓ passed`, `✗ failed`, `cancelled`, `queued` or `running`, then the job id, the head's first 7 characters, the finish time, and `cached` when it was a cache hit.
   - Without one: `no cland verify run for this task`.
6. **Relations and dates.**
   - `blocked by` and `blocks` (`items.blocks`), each with its glyph and state (`T-277 ● done 15:02`).
   - `regression of` with its target's glyph and title, when the task carries `regression_of`.
   - `created` and `updated` in local time.
   - `last`: the later of the item's `updated` and its topic's `lastMessageAt` (`items.topic(it)`), naming which (`19:22 · a message in its topic` or `11:05 · item updated`).
   - For a container, the latest across its subtree, naming the item.
7. **Decision.** For an item with a comment that opens with `Resolution` or `Decided` (the prototype's rule): the latest such comment, trimmed like the summary, with its author and time. No block otherwise.
8. **The agents' text.**
   - A fold line: `▸ agents' text · <the ## headings, comma-separated> · <N> words  zb`, from `explorer_summary.outline(body)`, cut to the width.
   - `zb` in the tree or the card unfolds it in place: the body as wrapped text lines, with headings in `ClandHeading`, unchanged for the agents.
   - `zb` again folds it. The open state is per item, in memory.

**References.** Each card line that names an item (the parent, a blocker, a blocked item, the `regression_of` target, a verdict's item) carries it. Enter on such a line in the focused card reveals that item in the tree, as `gi` does. `gi`, `gt` and `gs` in the card use the line's item when there is one, else the card's.

**The card over the right panel** (the prototype's answer 2).

- While the explorer is the centre and a right panel is open, compute the tree's width with the card beside it. When it would be under 80 columns, the card takes the right panel's place: the right panel's window closes, and the card opens in its slot at the panel's width.
- `state.S.ui.right` is left unchanged in `ui.json`, so the panel returns when another centre view opens or the screen widens.
- `layout.lua`'s `apply_view` and `fix` decide it, through one explorer hook.
- At 200 columns with both side panels open, the tree gets the centre and the card the right slot.

**Header keys.** The card's winbar lists the keys that work there: `↵ reveal · h back · zb text · gt topic · gs session · gp plan` (and `m` from ticket T-355).

**Docs.** `nvim/README.md`'s Explorer section lists the card's blocks, their sources (summary fields or the item's cached `task.view`), `zb`, Enter on a reference, and the narrow layout.

**Demo** (the epic's tracer bullet 2). The card of a task filed after E-270 shows its size, its `regression_of` and its latest `cland verify` result. The stub hub's frame log shows no `task.view` for any row but the one the card shows.

**Out of scope.**

- The composer line and `m` (ticket T-355).
- The branch's commit counts and push time drawn on the CardTask board (P19). The hub has no such field, and §3.9 asks only for the branch and the latest verify.
- Hand edits: the card has no edit keys (§3.8). The criteria keys stay on `gI`'s item view.
- Cards for virtual roots beyond ticket T-352's list (ticket T-356).

**Constraints.**

- Neovim is the host, with no plugins (ADR 0005). The card is drawn from the item model, `plan.get` and the cached `task.view` of the item it shows.
- No `task.view` per row and no hub request per cursor move. A container's verdict reason costs at most one extra cached `task.view`.
- Tests run headless on the stub hub through the frame protocol, one `nvim --headless` per test, keys by `nvim_input`, the screen read with `screenstring()` at 200x50. The stub fixtures carry a task with `size`, `regression_of`, `verify`, a not-clear verdict with `scope` and its comment, a resolution comment, criteria with marks, and an epic with `plan`, `stages` and `approval`.
- Tests wait on state, never on a sleep. Every key goes through the action registry.
- A Neovim-only delta needs `npm run test:nvim` green. Suites run through `cland verify`, only after a clear source review and at the exact reviewed head (D25), and only when `cland verify queue --json` shows no holder.
- Commit on the task branch and push it to `origin`. `dev` is reached only through `cland merge`. Everything is in English.

## Acceptance criteria

- [ ] C1. A task's card shows its criteria with marks and the `N of M verified` header from the summary's counts. The latest verdict shows its round, scope, by and role, and its one-line reason from the comment. The branch and suite block shows `verify`'s result, job, head and time.
- [ ] C2. An epic's card shows its children's cells and counts in words, the cells per stage, and the plan block with the stage in work, its merged count and the approval. A closed epic's plan reads every stage closed.
- [ ] C3. The relations show blocked by, blocks and `regression of` with each end's state. `last` names whether it came from the item's `updated` or its topic's latest message. A container's latest verdict and last activity name the item in its subtree.
- [ ] C4. The rank fact shows `rank <n>` only for an item whose summary has `rank_set`. Otherwise only the ordinal.
- [ ] C5. A body with a `Resolution …` comment shows the Decision block. One without shows none.
- [ ] C6. The fold line names the body's `##` headings and word count. `zb` unfolds the body in the card and folds it again, from the tree and from the card.
- [ ] C7. Enter on the blocker's line in the focused card reveals the blocker in the tree with its card.
- [ ] C8. With both side panels open at 200x50, the card takes the right panel's place, and the right panel returns when `␣g` opens General. `ui.json`'s `panels.right` is unchanged.
- [ ] C9. Moving over every row of the fixture tree sends `task.view` only for rows the cursor rested on (frame log), and never for a row passed with `j` held.
- [ ] C10. `nvim/README.md` describes the card's blocks and their sources, `zb`, Enter on a reference and the narrow layout.
- [ ] C11. The human's picture first and the agents' text folded. The blocks run in this order: summary, facts, progress, plan, verdict, relations, branch and suite, dates, the Decision block, then the agents' text as one fold line. On every first open of an item's card, and after a hub event redraws it, the agents' text is folded. Only `zb` unfolds it, and it never pushes the human's blocks out of view (spec §3.9, T-244).
