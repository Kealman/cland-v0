---
id: E-110
kind: epic
title: "Threads that read"
state: closed
labels:
  - epic
  - v0.1
  - ready-for-agent
assignee: null
parent: R-130
blocked_by:
  - E-109
topic: topic-95
branch: null
created: 2026-10-09T21:51:33.608Z
updated: 2026-10-10T17:04:19.569Z
---

## Goal

The human reads a topic thread in the workbench as easily as a harness's own TUI: role-coloured gutters, Markdown, day rules, verdicts in red or green, and agent-to-agent runs folded into one line. The top bar counts only what needs the human now, so agent traffic no longer raises it. Today a thread is plain white text with no Markdown, dates or rules, and the human sat in the Coordinator's TUI instead.

## Contents

- **Thread rendering** (map ticket T-97): each message a block with its header, a role gutter, the human's band and the delivery stage; Markdown per message; day rules; red or green verdict lines; ask cards, artifact chips and the message's kind on its header; incremental updates over the latest 200 messages; legible at 80 columns.
- **§3.5 Visibility levels, the message part**: a message sits in now (addressed to the human; asks), watch (the Coordinator's reports to the human, dimmed) or background (agent to agent); a run of agent-to-agent messages folds into one line in a thread; the top bar counts the hub's needs-you entries only (decision T-169: asks, approvals and waiting topics; amended on T-198, 2026-10-10).

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
5. **The top bar counts what needs you.** The top bar's count is the hub's needsYou: asks, approvals and topics waiting for the human, each with a resolution rule (T-169). Demo: a burst of agent-to-agent messages in an item topic leaves the top bar unchanged; an ask addressed to the human raises it. Amended 2026-10-10 by the stand-in's decision on T-198: unread human-addressed messages as a counted kind move to T-171.

## Definition of done

QA runs the demo below on `dev`, playing the human's part through the `cland` CLI and a headless workbench (one `nvim --headless` process, keys by `nvim_input`, the screen read with `screenstring()`), and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes. The human does not run this demo: the human accepts only the release (T-117), decision D16.

The human opens General and an item topic with real history. The Coordinator's messages carry its gutter colour, an Implementer's violet, a Reviewer's pink; Markdown renders; a rule marks each day; a run of four agent-to-agent messages shows as one line that `za` opens; a not-clear verdict's first line is red; an ask's card takes a digit. At 80 columns the thread still reads. A burst of agent traffic leaves the top bar's count unchanged, and an ask addressed to the human raises it.

- [ ] Each message renders as one block with its header, role gutter, band and delivery stage; a rule marks every local day.
- [ ] Markdown renders per message with conceal; a body the parser rejects shows as plain text; verdict lines are red or green.
- [ ] Agent-to-agent runs fold into one line naming the sessions and counting the messages; asks, verdicts, answers, the human's messages and an Aide's never fold; the fold keys work and open runs survive rewrites.
- [ ] A new message, a stage change or an ask update rewrites only its own lines; a full rewrite of 200 messages stays in the tens of milliseconds T-86 measured.
- [ ] At 80 columns none of the five narrow-width breakages of T-86 appears.
- [ ] The top bar counts the hub's needsYou only (asks, approvals, waiting topics; T-169, amended by T-198): agent traffic leaves it unchanged, an ask raises it.
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

## Comments

### qa-15 · 2026-10-10T16:57:54.923Z

verdict: qa
result: not clear
by: qa-15 [qa]
run: qa-2026-10-10-15-110-c
commit: e3b702eb343f138b63754d4f36e527aa687661d3

| case | surface | result | evidence |
| --- | --- | --- | --- |
| THREAD-001 through THREAD-010 | headless-grid | PASS | .cland/qa/T-110/qa-2026-10-10-15-110/ |
| M1–M5, M7 | headless-grid / hub-api | PASS | .cland/qa/T-110/qa-2026-10-10-15-110-b/M<n>.txt |
| M3-M4-supplement | headless-grid | PASS (3 targeted tests) | .cland/qa/T-110/qa-2026-10-10-15-110-b/targeted-thread.log |
| M6 | headless-grid | FAIL, reproduced in clean scratch | .cland/qa/T-110/qa-2026-10-10-15-110-c/M6.txt and M6-counter.screen.txt |

Medium — M6 / C6: in /tmp/qa-T-110-qa15-c, ten agent-to-agent sends left the top-bar needs-you count unchanged, as expected. A Coordinator send addressed to the human (documented MCP send with topic and omitted to) was accepted, but the count remained 0 after 1.5 seconds instead of rising to 1. In the earlier run with an open ask it likewise stayed 1 → 1. The counter's current hub implementation computes asks + approvals + waiting topics (hub/src/hub/inbox.ts:224), so a plain human-addressed message is absent from the count. This conflicts with the epic demo and M6's expectation. No fix attempted.

verified: C1,C2,C3,C4,C5,C7,C8
failed: C6=M6 human-addressed message does not increase the top-bar count.
deferred to the T-117 walkthrough: none.

The 200 real-message warm render median was 26.475833ms (15 samples), within the 35ms production test ceiling and T-86's tens-of-ms range. Append line events avoided a full rewrite. Three targeted nvim/test/thread.test.ts cases passed for parser rejection fallback, stage changes without text rewrites, and ask-local rewrites. An unclosed fence alone is valid Markdown; the explicit parser-rejection test proves fallback. T-86's fifth narrow-width issue is foldtext clipping, covered by THREAD-006's cell-budget/count assertion. Real history, distinct role colors, two local-day fixture rules, four-message folds and nonfolding boundaries passed.

Commit: e3b702eb343f138b63754d4f36e527aa687661d3; source clean outside live .cland metadata. The first manual attempt mistakenly passed to:[human] (an unknown session target); the corrected -b/-c runs omit to per the API. Earlier driver failures are retained and superseded.

### qa-15 · 2026-10-10T17:04:04.761Z

verdict: qa
result: clear
by: qa-15 [qa]
run: qa-2026-10-10-15-110-e
commit: 21a57ac4b75ae0560cf20ff39f99a1bf000cbb83

| case | surface | result | evidence |
| --- | --- | --- | --- |
| THREAD-001 through THREAD-010 | headless-grid | PASS (carried forward) | .cland/qa/T-110/qa-2026-10-10-15-110/ |
| M1–M5, M7 | headless-grid / hub-api | PASS (carried forward) | .cland/qa/T-110/qa-2026-10-10-15-110-b/M<n>.txt |
| M3-M4-supplement | headless-grid | PASS (3 targeted tests, carried forward) | .cland/qa/T-110/qa-2026-10-10-15-110-b/targeted-thread.log |
| M6, amended by T-198 | headless-grid | PASS | .cland/qa/T-110/qa-2026-10-10-15-110-e/M6.txt and M6-counter.screen.txt |

No unresolved findings against the amended scope. In a fresh scratch project, ten agent messages kept needs-you at 0; a plain Coordinator message to the human kept it at 0; an ask raised it to 1. This matches the T-169 needsYou rule adopted for C6 and M6. The extra kind=question probe in run -d also left the count unchanged without a waiting-topic state; it is informational, superseded by the amended pass condition.

verified: C1,C2,C3,C4,C5,C6,C7,C8
failed: none
deferred to the T-117 walkthrough: none.

Commit: 21a57ac4b75ae0560cf20ff39f99a1bf000cbb83, the dev tip when the rerun started. The Coordinator explicitly requested only M6 be rerun and previous passing evidence cited. Relative to e3b702e, the relevant changes are the amended T-110 brief/criterion and root role-clause documentation; no thread product code changed. Earlier full verdict qa-2026-10-10-15-110-c contains the full evidence mapping and 26.475833ms 200-message rendering result. The source was clean outside live tracker metadata. No product fixes.
