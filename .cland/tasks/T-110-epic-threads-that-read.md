---
id: T-110
kind: epic
title: "Epic: Threads that read"
state: open
labels:
  - epic
  - v0.1
  - ready-for-agent
assignee: null
parent: T-130
blocked_by:
  - T-109
topic: null
branch: null
created: 2026-10-09T21:51:33.608Z
updated: 2026-10-10T16:43:26.607Z
---

## Goal

The human reads a topic thread in the workbench as easily as a harness's own TUI: role-coloured gutters, Markdown, day rules, verdicts in red or green, and agent-to-agent runs folded into one line. The top bar counts only what needs the human now, so agent traffic no longer raises it. Today a thread is plain white text with no Markdown, dates or rules, and the human sat in the Coordinator's TUI instead.

## Contents

- **Thread rendering** (map ticket T-97): each message a block with its header, a role gutter, the human's band and the delivery stage; Markdown per message; day rules; red or green verdict lines; ask cards, artifact chips and the message's kind on its header; incremental updates over the latest 200 messages; legible at 80 columns.
- **§3.5 Visibility levels, the message part**: a message sits in now (addressed to the human; asks), watch (the Coordinator's reports to the human, dimmed) or background (agent to agent); a run of agent-to-agent messages folds into one line in a thread; the top bar counts the now layer only.

The spec has no thread section yet: T-97's resolution adds it from the human's reaction to the prototype. Until then the prototype on `prototype/thread` (commit `faec351`) and the mockup `Thread.dc.html` are the reference, and the resolution's words win where they differ. The prototype's rules to keep unless the resolution changes them: the header reads `sender [Role] → addressees  HH:MM` (`→ you` for the human); the gutter is drawn through `'statuscolumn'` on every screen row, heavier on the message under the cursor; each body gets its own tree-sitter parse, with spans cached by text and drawn with conceal, and stays plain text where the parser fails; asks, verdicts, answers, messages to or from the human and anything to or from an Aide never fold; folds are manual, per run and per window, because Neovim does not update expression folds in Insert mode; `zo`, `za`, `zc`, `zR`, `zM` and Enter work on the runs, and the thread's header counts the folded messages.

Not in this epic:

- Layers on the inbox, sessions, items and artifacts, pins and mutes, the `[visibility]` table, and the archive of messages older than 7 days: "Visibility and artifacts", whose classifier later replaces this epic's message rule.
- The Aide's header ("speaks for you"): "The human's own session". The criteria a verdict marked, under its first line: "Criteria that live".

Choice where the spec is silent:

- The Coordinator's reports are told apart by the `report` kind of "A quiet Coordinator"; until that kind exists, every Coordinator message to the human counts as now.

## Tracer-bullet order

1. **Message blocks.** The header with addressees and time, the role gutter through `'statuscolumn'`, the human's band, the day rules, the delivery stage on the right, and appends that touch only their own lines. Demo: General's real history reads with gutters and day rules, and a new message appends without a redraw.
2. **Markdown per message.** The per-body parser, cached spans with conceal, plain text when the parser fails, red or green verdict lines, and the five narrow-width breakages T-86 lists handled. Demo: a Coordinator message with a fenced block, a list and inline code renders at 120 and at 80 columns.
3. **Folded agent runs.** The run rule, manual folds per run and window, the fold keys and Enter, the folded count in the header, and what never folds. Demo: an Implementer and a Reviewer's exchange shows as one line that `za` opens and closes.
4. **Asks, chips and kinds.** Ask cards answered in place, artifact chips, the kind on each header, the watch dimming of the Coordinator's reports. Demo: an ask is answered with a digit inside the thread, and a Coordinator report sits dimmed below a message addressed to the human.
5. **The top bar counts now.** The top bar's count takes now-layer messages and asks only. Demo: a burst of agent-to-agent messages in an item topic leaves the top bar unchanged; a message addressed to the human raises it.

## Definition of done

QA runs the demo below on `dev`, playing the human's part through the `cland` CLI and a headless workbench (one `nvim --headless` process, keys by `nvim_input`, the screen read with `screenstring()`), and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes. The human does not run this demo: the human accepts only the release (T-117), decision D16.

The human opens General and an item topic with real history. The Coordinator's messages carry its gutter colour, an Implementer's violet, a Reviewer's pink; Markdown renders; a rule marks each day; a run of four agent-to-agent messages shows as one line that `za` opens; a not-clear verdict's first line is red; an ask's card takes a digit. At 80 columns the thread still reads. A burst of agent traffic leaves the top bar's count unchanged, and a message addressed to the human raises it.

- [ ] Each message renders as one block with its header, role gutter, band and delivery stage; a rule marks every local day.
- [ ] Markdown renders per message with conceal; a body the parser rejects shows as plain text; verdict lines are red or green.
- [ ] Agent-to-agent runs fold into one line naming the sessions and counting the messages; asks, verdicts, answers, the human's messages and an Aide's never fold; the fold keys work and open runs survive rewrites.
- [ ] A new message, a stage change or an ask update rewrites only its own lines; a full rewrite of 200 messages stays in the tens of milliseconds T-86 measured.
- [ ] At 80 columns none of the five narrow-width breakages of T-86 appears.
- [ ] The top bar counts now-layer messages and asks only.
- [ ] Headless QA cases cover the screens at 120 and 80 columns and the keys, as successors of `THREAD-PROTO` and `THREAD-KEYS` in `nvim/proto/thread/` on `prototype/thread`.
- [ ] `nvim/README.md` describes the thread, its folds and its keys.

## Dogfooding

From this epic on, the human reads the build's General and item topics in the workbench rather than in the Coordinator's TUI. Once "A quiet Coordinator" has landed, the item leads' traffic with Reviewers and QA folds out of the way, and the top bar stays quiet unless something is addressed to the human.

## Constraints

- **ADRs.** 0005 (Neovim is the host): the bundled tree-sitter Markdown parser, extmarks, `'statuscolumn'` and folds, and no plugins.
- **Research.** `research/nvim-rendering` (`docs/research/nvim-rendering.md`, T-86, with its probes `p01` to `p11` and `thread200.lua`): render each message on its own, never one Markdown tree for the thread; narrow widths break five things; a full rewrite of 200 messages costs 17 to 33 ms.
- **References.** `prototype/thread` (commit `faec351`: `nvim/lua/cland/thread.lua`, `thread_md.lua`, `hl.lua`; the checks in `nvim/proto/thread/`), never merged. The mockup `docs/design/main-screen/Thread.dc.html` and `screens/v01-thread.png`. The role colours (violet Implementers, pink Reviewers, sky QA) and the rest of the visual vocabulary are in `docs/design/main-screen/README.md`. The order of authority: the spec's thread section once T-97 resolves, then the prototype's behaviour, then the mockup.
- **Risk** from the sizing: Markdown with conceal per message under live appends, and narrow widths.
- **The v0 tail.** No open tail item touches this code.
- **Order.** Second in the Neovim lane; it waits for "Workbench basics", because both edit the Neovim layout and `init`. "The human's own session" follows it in the lane, and "Visibility and artifacts" waits for it.
- **Git and the gate.** Commit on the task branch `t/<id>-<slug>` in its worktree and push it to `origin`, the local territory; work reaches `dev` only through `cland merge` and its verdict gate; only `cland release` pushes to GitHub.
- **Language.** Every artifact, item, commit and doc in English.
- **Tests** through the v0 seams, in this order: the hub's frame protocol first (a real hub process and a real spoke over MCP and WebSocket, the UI over the JSON-lines socket, the `cland` CLI against a temporary project; `hub/test/harness.ts`); the harness process boundary second, with the fake Claude Code, Codex and OpenCode in `hub/test/fakes/`; the Neovim UI headless from the protocol's other side (`nvim/test` on the stub hub, QA cases in `qa/cases/` run by `cland --headless --qa`). No new seams inside the hub. This epic lives on the Neovim side: the screens at 120 and 80 columns and the keys run as headless cases.

## Links

- Spec: `docs/spec/v0.1.md` on `dev`, §3.5 Visibility levels (the Messages row, "How surfaces show them"); the thread section T-97's resolution adds.
- Map T-81: ticket T-97 (thread rendering), decision T-94 (visibility levels), research T-86.
- GLOSSARY: Topic, General, Agents topic, Ask, Layer, Verdict.
- ADRs: `docs/adr/0005-neovim-is-the-host.md`.
- Branches: `prototype/thread`, `research/nvim-rendering`.
- Mockups: `docs/design/main-screen/Thread.dc.html`; `screens/v01-thread.png`.
