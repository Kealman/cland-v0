---
id: T-97
kind: question
title: Thread rendering in Neovim
state: closed
labels:
  - wayfinder:prototype
assignee: null
parent: T-81
blocked_by:
  - T-86
  - T-94
topic: null
branch: null
created: 2026-10-09T19:09:49.140Z
updated: 2026-10-09T21:24:02.429Z
---

## Question

How should a topic thread render in the workbench so that it reads better than the harnesses' own TUIs: what the human reacts to in a prototype built on real history?

## Context

Threads are plain text today: author line, body without Markdown, one blank line between messages, no rules, no dates; the human found them a wall of white text and sat in the Coordinator's TUI, which has colours and typography. The research "Neovim rendering techniques for the thread and a task graph" lists what is feasible without plugins; the visibility levels decision says which messages fold (agent-to-agent traffic) and which stand out (asks, verdicts, messages to the human).

## Prototype

First a mockup on the design canvas (one artboard: a General thread with a mix of human, Coordinator, agent-to-agent and verdict messages, an ask, an artifact chip). Then branch `prototype/thread` (never merged): the thread view rendering real `history` of General with author bands or gutters per role colour, Markdown with conceal, separators and dates, folded agent-to-agent messages, chips and the composer. The human reads real history in it and says what works.

Resolve with the human's reaction: the thread section of the spec (what renders how, what folds, the keys), recorded as a comment with the branch and canvas links.

## Comments

### human · 2026-10-09T21:17:27.528Z

Prototype ready to try: branch `prototype/thread` at `eda13cc` (two commits on dev's `29ef41d`: `faec351` the thread, `eda13cc` the tail after a resize), pushed to the territory. Never merged.

## Try it against the live hub

From the main worktree (`/Users/evgeniyivanov/Projects/cland/v0`):

```sh
git worktree add --detach ../cland-thread prototype/thread
../cland-thread/nvim/bin/cland-nvim .
```

It is the normal workbench with the prototype's thread: it connects to the running hub through `.cland/hub.json` and takes the pinned Neovim from the main worktree's cache. `--detach` because the branch is checked out in the agent's worktree. Remove it afterwards with `git worktree remove ../cland-thread`. While the agent's worktree exists, `.claude/worktrees/agent-a15f548aa0184ad7c/nvim/bin/cland-nvim .` runs the same code without a new worktree.

## What renders how

- **A block per message**: a blank line, the header `sender [Role] → addressees  HH:MM`, then the body. A message to the human shows `→ you`; the human's own shows `you → coord`.
- **Gutter**: one cell per screen row, wrapped rows included, in the author's role colour (`'statuscolumn'`): Coordinator teal, Implementer violet, Reviewer pink, QA cyan, Aide light blue (it speaks for the human, T-92), the human blue, the hub faint. The message under the cursor gets a heavier bar (`▌`). A band hides a `'cursorline'` background, so the cursor line itself is not highlighted.
- **The human's messages** sit on a band (`ClandMine`). The delivery stage stays at the header's right end (`⌁ queued`, `✓ delivered`, `✓✓ injected`, `eol_right_align`) and changes in place.
- **Days**: a rule `── Thu 9 Oct ─────` is a virtual line where the local day changes.
- **Markdown inside each message**: the bundled tree-sitter parser runs once per message on its own text, its spans are cached and drawn as extmarks with conceal.
  - Headings are bold with the `#` hidden.
  - Inline code sits on a chip background with the backticks hidden.
  - A fenced block is a band with its fences hidden and the language dim; Lua, Vim and C are highlighted.
  - `-` and `*` bullets show as `•`; numbered lists are dim.
  - Links are blue with the target hidden; quotes are dim with a bar.
  - Wrapped list rows line up under the item's text.
  - Wrapping breaks at blanks, never inside `T-43` or a path; a path longer than the line still breaks at the edge.
  - An unclosed fence stays inside its own message.
  - A message the parser cannot read stays plain text.
- **Verdicts**: the report's first line is red (`✗ review not clear T-76`) or green (`✓ qa clear T-59`). A request line (`review request T-12`) is bold.
- **Unchanged**: chips (`▣ A-3 note · …`, Enter opens), the ask card and the composer.

## The fold rule

- **Background** (spec v0.1 §3.5): a message an agent or the hub sends to sessions. It is not background when:
  - one of the addressees is the human or an Aide;
  - it is an ask, an answer or a verdict.
- **Bare artifact posts**: the chip `artifact.create` posts with no addressee counts as background when an Implementer, Reviewer or QA posted it, because T-94 puts agents' reports in background. The Coordinator's chips stay visible.
- **Runs**: consecutive background messages on one day form a run. A run folds into one line: `▸ impl-76 → coord · 7 messages · 4 artifacts  19:27–19:43`. With one sender it shows `a → b, c`; with two parties `a ↔ b`; with more, the names.
- **Never folded**: asks, verdicts, answers, anything to or from the human, anything to or from an Aide.
- **How**: the folds are real Vim folds, manual and made per run and window. Neovim does not update expression folds while the composer is in Insert mode, which is where the human usually is.
- **Header count**: the thread header counts what is folded, for example `68 folded · zR`.

## Keys

Every existing key and the three motions are kept. New in the thread:

| Key | What it does |
| --- | --- |
| `zo` `za` `zc` | Open, toggle or close the run under the cursor. |
| `zR` | Open every run. |
| `zM` | Fold every run. |
| `↵` | Toggle the fold under the cursor; on a chip it still opens the artifact. |

A run the human opened stays open across new messages, view switches and rewrites (kept by run id). New runs arrive folded unless `zR` is in force.

## Costs

Apple M4, headless, centre 120 columns, three alternating runs at load about 5, the same data for both. Each append goes through the client's event path, parses its own text and includes the redraw.

| | dev's renderer | prototype |
| --- | --- | --- |
| Append one message, 200 in the thread | 2.1 ms (a full rewrite each time) | 0.73–0.75 ms median (0.50–1.04) |
| Append one message, General (80) | 1.2–1.6 ms | 0.76–0.88 ms |
| Full render and redraw, 200 messages | 2.1–2.3 ms | 7.3–9.2 ms (Markdown cached) |
| Full render and redraw, General | 1.3–1.5 ms | 3.1–3.7 ms |
| Markdown parse, once per message | none | about 0.3 ms; a 200-message topic's first render costs about 60 ms more |

A full render happens on the first load, on a merge that brings an older message, and once every 50 messages past 200 (the trim).

## What was checked

- `nvim/proto/thread/THREAD-PROTO.lua` runs on the stub hub with copies of the live history (`fetch-history.ts`, read-only). It renders General (68 messages), T-76's topic (74, 57 of them agent to agent) and a Markdown sampler at 120 and 80 columns: folded, with `zR`, top and tail. The colours were read cell by cell on the screen.
- `THREAD-KEYS.lua` checks:
  - every fold key, and Enter on a fold and on a chip;
  - `1` on an ask card, with the answer showing under it;
  - a send from the composer: Insert mode kept, the stage changing in place;
  - `gs` and `gi` from the thread;
  - the trim of the 200 window.
- Neovim tests: 104 of 104 pass when run directly. Five assertions pinned the old header (a leading space, no addressee); they now expect the gutter and the arrow.

## Stand-ins and limits

- **Colours**: violet, pink and cyan are new hues beside the design palette; Aide is light blue.
- **`→ you`** shows on every Coordinator message in General.
- **Layers not shown apart**:
  - watch (the Coordinator's reports) and now (messages to the human) look the same; only asks and verdicts stand out;
  - archive (older than 7 days) is not rendered differently, and nothing in the live history is that old;
  - there are no pins or mutes.
- **Folded chips**: agents' bare artifact posts fold into their run. Say if chips should stay out of folds.
- **Neovim limits**:
  - Concealed text keeps its line breaks (neovim#14409): a line with a long hidden link target wraps early and can leave a row that looks empty.
  - The ask card does not repeat its bar on wrapped rows (as before).
  - Pipe tables are not aligned.
  - A fold line is cut at the window's edge.
  - The window's top message can show cut off, marked `<<<` (`'smoothscroll'`), so the tail always fills the window.
- **Not tried interactively against the live hub**: a headless run there would mark topics read. The client's hub connection is dev's, unchanged.

T-76's topic at 80 columns, folded (live history copy):

```
  ── Fri 9 Oct ──────────────────────────────────────────────────────
▌ ▸ impl-76, coord, rev-65 · 4 messages · 3 artifacts  18:06–18:15

▎ rev-65 [Reviewer] → coord  18:16
▎ ✗ review not clear T-76
▎ rev-65-76-1 on ae7af32: one high in the inherited shared termination path
▎ newly used by doctor --fix. Group membership is checked before awaited
…
▎ ▸ coord, impl-76, rev-65 · 8 messages · 2 artifacts  18:16–18:25

▎ rev-65 [Reviewer] → coord  18:25
▎ ✗ review not clear T-76
```

### human · 2026-10-09T21:23:55.760Z

Resolution (2026-10-09). The human accepted the mockup Thread (design canvas, mirrored in docs/design/main-screen/) and the Neovim prototype on prototype/thread (faec351, eda13cc; run command in the comment above): role gutters, bands on the human's side, per-message Markdown with conceal, date lines, verdicts with criteria marks, the ask as an amber band, manual folds for agent-to-agent runs, appends without a full rewrite. The prototype's own call, folding an agent's addressee-less artifact post into the surrounding run, stands (background layer).

Recorded in docs/spec/v0.1.md §3.14.

### human · 2026-10-09T21:24:02.429Z

Resolved: see the resolution comment; spec v0.1 §3.14
