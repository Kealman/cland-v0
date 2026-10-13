---
id: Q-258
kind: question
title: Summary fallback on the existing items, and prior art for tree explorers
  with a detail pane
state: closed
labels:
  - wayfinder:research
assignee: cland-design
parent: M-264
blocked_by: []
topic: null
branch: null
created: 2026-10-12T09:10:35.385Z
updated: 2026-10-12T10:00:08.411Z
closed: 2026-10-12T10:00:08.445Z
---

## Question

Two facts the explorer's design waits on.

1. How good is the summary fallback on the existing items (spec v0.1.2 §3.9: the first paragraph of the first section that is not Parent)? For every item in `.cland/tasks`, extract that paragraph, measure its length, and judge on a sample of forty across kinds whether it reads as a summary; report the share that needs a written `## Summary`, the edge cases by first heading (Question, Open question, What happened, Comments, Goal, What to build), and a better rule if one exists.
2. Prior art for keyboard tree explorers with a detail pane, in terminals and keyboard-first tools (neo-tree, oil.nvim, nvim-tree, taskwarrior-tui, org-mode agenda and outline folding, jira and Linear-style TUIs, lazygit's panels): how they fold, scope to a node, show counts per node, keep the cursor across updates, and lay out the detail pane; what to copy and what to avoid for an explorer in a Neovim buffer.

Deliver `docs/research/explorer-prior-art.md` with the extraction script beside it on the branch `research/explorer-prior-art` (pushed to origin only, never merged), and the resolution comment here.

## Comments

### human · 2026-10-12T10:00:01.975Z

Resolution: research on branch `research/explorer-prior-art` (pushed to origin only, not merged), commit dd1c7032721d6b4ab30887a2383ae8e1a85cc02f.

Files:
- `docs/research/explorer-prior-art.md`, the findings;
- `docs/research/explorer-prior-art/summary-fallback.py`, the extraction script (standard library, read-only on the item files);
- `docs/research/explorer-prior-art/summary-fallback.csv`, one row per item, with both rules' texts and the by-eye verdicts.

**1. The summary fallback (spec v0.1.2 §3.9) on the 264 items in `.cland/tasks`**

- **The decided rule** (the first paragraph of the first section that is not Parent) reads as a summary on 167 of 264 items (63%).
  - On the forty-item sample judged by eye, it reads on 23 of 40 (57.5%, 95% interval 42–71%).
  - 97 items would need a written `## Summary`, 8 of them among the 27 open items: T-218, T-255, T-257 and T-258 to T-262.
- **Why it fails.**
  - Mostly length: the median paragraph is 58 words, and 73 run past 80 words.
  - Sections that open with a list of facts, steps, sources or a journal.
  - Provenance-only openers ("Found by …", "Observation from the human …").
  - Paragraphs that open with context.
  - Two reference preambles (T-19, T-20).
- **First sections:** What to build 140, Question 43, What happened 26, Goal 17, text before any heading 11, Open question 11, others 16. No item has a `## Summary` yet, and no body is empty.
- **Edge cases.**
  - The answer to a closed question and the decision on a decided item live in comments (36 closed questions, 14 tasks), so the fallback shows the question or the observation.
  - The v0 bug items (T-43 to T-79) keep their description in `## Parent`.
  - The fallback must run on the parsed body: two items have `## Comments` as their first heading.
  - Paragraphs must be split at list boundaries: a blank-line split gives 18 items a different first paragraph.
- **Recommended rule (rule B).**
  1. A written `## Summary` wins.
  2. Otherwise take the first section that is not Parent, Notes, Sources, References, Acceptance criteria or Definition of done.
  3. In it, take the first prose paragraph, with leading provenance sentences dropped. When the section has no prose, take its first list item.
  4. Trim to whole sentences: at most two and 50 words, with a trailing list lead-in dropped.
  It reads on 231 of 264 items (87.5%). 33 would still need a written summary, 3 of them open (T-218, T-257, T-258).

**2. Prior art, in brief**

Tools read: neo-tree, nvim-tree, oil, aerial, outline.nvim, trouble, nvim-ufo, Org's outline and agenda, treemacs, lazygit, k9s, taskwarrior-tui, jira-cli, jiratui, gh-dash, GitHub Projects, Linear and two Linear TUIs, Workflowy and Dynalist.

Copy:
- **Folding.** Render the tree from the model, with Vim folds off. Keep the expanded state per item id outside the buffer, as `items_folds` already does. Give Vim's fold keys their Vim meanings on nodes (trouble). Keep the human's folds apart from automatic reveals (neo-tree).
- **The cursor.** After each render, re-find it by item id inside `winsaveview`/`winrestview` (trouble), with the id captured right before the model changes (lazygit). When the item is gone, fall back in a fixed order: the next survivor, the previous, the nearest visible ancestor (treemacs, lazygit). Redraw only on a visible change and coalesce bursts.
- **The card.** Give it its own window, updated on `CursorMoved` with focus kept in the tree: Org's agenda follow mode, lazygit, gh-dash, taskwarrior-tui, Linear's peek. Skip the update when the item is unchanged, and debounce about 100 ms or cancel the stale render. One key goes in and one comes back; a toggle hides it.
- **Scope.** Re-root with the cursor on the node the human came from. Draw breadcrumbs from a real stack in the winbar (k9s's crumbs; the Workflowy and Dynalist zoom); back pops, and the root never pops.
- **Counts.** Compute them from the children, as compact text: `[2/5]`, `{count}`, "5 of 20", or right-aligned virtual text. No tool read shows a status breakdown.
- **Filters.** Keep the matches' ancestors and show the filter in the view. One key clears it and restores the folds and the item under the cursor.

Avoid:
- Vim folds over a buffer that is rewritten, fold state keyed by position, and folds reset on refresh (k9s's xray).
- Restoring the line number after a refresh. neo-tree, nvim-tree, oil, k9s, gh-dash and Org's agenda do it, and their trackers show the cursor landing on another item. Also: yanking the cursor to a followed item on refresh.
- A detail loaded only on Enter (jiratui) or one that covers the list (k9s); slow work per cursor move (taskwarrior-tui before its cache); borrowing another window for the card.
- A focus stack sold as history; one key that both clears a filter and leaves the scope; a jump to the first row on each filter keystroke.

**Open questions** are listed in the doc for the map's later tickets:
- rule A or rule B;
- a backfill of written summaries;
- resolutions and decisions on the card;
- where fold state is kept;
- whole-subtree keys;
- the card's debounce;
- where the cursor goes when its item vanishes;
- search and filter;
- large trees.

### human · 2026-10-12T10:00:08.411Z

Resolved: see the resolution comment; docs/research/explorer-prior-art.md on research/explorer-prior-art
