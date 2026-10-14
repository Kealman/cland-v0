---
id: E-413
kind: epic
title: Hub-computed fields and read marks
state: open
labels:
  - epic
  - v0.2
  - ready-for-agent
assignee: null
parent: R-377
blocked_by: []
topic: null
branch: null
created: 2026-10-14T15:59:14.313Z
updated: 2026-10-14T15:59:14.313Z
---

## Summary

The hub computes once, for both clients, what Neovim computes in Lua today: unread counts, merged session rows, the explorer's roll-ups and summaries, the events filter and the card's facts, so that no client needs a request per card. The human's last look and read marks move into the hub, a run of agent messages gets a fold line built from facts, and declining an ask becomes an answer with a reason.

## Goal

Both clients show the same numbers and agree on what the human has seen, and the browser duplicates no client logic. Today a topic's unread count moves by counting `message` frames, a session row merges two reads, the explorer's tree, roll-ups and summary rule run in Lua (`explorer_summary.lua` alone is 333 lines), and the events' last look and the plans' marks live in Neovim's `ui.json`. The Q-405 prototype had to port about 850 lines of that logic to TypeScript; its unread counts only grew (the Agents topic reached 14,927), and its events' last look disagreed with Neovim's at once. A card costs a `task.view` (52 kB for T-347) and an epic row a `task.plan show`: Neovim sent 1,780 and 564 of them in the 61 hours Q-400 measured.

## Contents

- **§3.3 Computed once in the hub, for both clients.**
  - **Unread counts.** A topic's `unread` and `lastMessageAt` travel with every message delta, so no client counts frames.
  - **Merged session rows.** One sessions projection: the process row with presence, the role, the item with a verifier's hold and +N or a requested item dimmed (v0.1.2 §3.4), the state with its age and the command it waits on, the account and the usage.
  - **The explorer's roll-ups and the summary rule.** On each item summary: the summary with its provenance line by the v0.1.2 §3.9 rule; for a container, done/total, the status breakdown, the derived status, glyph and layer, the stage in work, the claims and holds of its tasks, the latest verdict of its subtree naming the item, and the last activity naming its source; for every item, a `blocked` flag; for every container, its `next` item.
  - **The events filter**, by kind, warnings and subject, held with a connection's subscription, so its first page and its live rows arrive filtered.
  - **The last look and the read marks per human** (§3.6): the events' last look, each plan's last look and the topics' read marks are held in the hub per human, not per client, so Neovim and every browser agree.
  - **The card's facts in the snapshot and the deltas:** the latest verdict's one-line reason, round and scope; the Decision block; each stage's state for an epic with a plan; the sections and size of the agents' text for its fold line. No client needs a `task.view` per card or a `task.plan show` per epic row; the full body and the comments come only when the human opens the agents' text.
- **§3.4 Threads and actions, the hub side.**
  - **The fold line.** A run of agent messages folds into one line that the hub builds from facts: who, how many messages, the latest step and the age; never written by a model.
  - **The answered ask.** An ask's record carries its outcome (the option or the free answer, who answered, when) into the thread for good and into the inbox's delta, so that a client folds it in place to one line.
  - **Declining.** Declining an ask is an answer with the value `declined` and a reason: the asker receives it as any answer, the topic stays open and may ask again, and there is no separate "ask me later".
  - **The inbox's leave rule, refined** (v0.1.2 §3.7): the hub reports an answered row with its outcome, and a client keeps it folded until the human leaves the inbox; then it goes to the archive, so rows never move under a finger.

Not in this epic: approvals ({E03}); the web views that show these fields ({E05} to {E08}); Neovim's own explorer and thread switching to the hub's fields and fold lines, which waits until Neovim adopts the extension in 0.2.x.

Choices where the spec is silent:

- **The rules move, guarded.** The summary rule and the roll-ups move from Lua into the hub in TypeScript, with a differential test against `explorer_summary.lua` and the Lua roll-ups on the live tracker's bodies; the Q-405 port's zero differences over 410 bodies is the bar. Neovim keeps its Lua until it adopts the extension in 0.2.x, under the same test.
- **Incremental.** The roll-ups are recomputed for the changed item's ancestors only, and a delta carries just the items whose fields changed.
- **Marks.** A mark only moves forward, and the latest from any client wins. Neovim moves its events' last look and its plans' marks from `ui.json` to the hub, reading and setting them through frames, with a one-time import of the values `ui.json` holds; `ui.json` keeps Neovim's interface state (filters, folds, the current release). Pins and mutes stay where they are, since the hub already applies them to every client's layers.
- **What counts as read** is the client's act, sent as `topic.read` up to a message number: Neovim keeps its rule (a thread in view), and the web's rule is {E06}'s. The hub keeps the highest mark per human.
- **The events filter** is sent with `subscribe` and on each change; a connection without one gets every row, as Neovim does today.
- **Runs.** A run is consecutive agent-to-agent messages with nothing between them that never folds (an ask, a verdict, an answer, anything to or from the human or an Aide), as v0.1 §3.14 says. The hub gives each run an id, its first message number, and sends its fold line with the history pages and in a delta each time the run grows. The fold line names the first three sessions and a count of the rest, the number of messages, the latest message's kind and first words, and its age.
- **Declining.** `topic.answer` takes `declined: true` with a non-empty reason; the asker's delivery reads `declined: <reason>`. Neovim shows a declined ask folded with its reason; declining from Neovim is not added in 0.2.0. The role clauses say how a session treats a declined ask: as a decision, never as consent.
- **The answered row's outcome** comes in the inbox's departure, `answered` or `declined`, with who and when; how long a client keeps the folded row is the client's.

## Tracer-bullet order

1. **Fields on the item summary.** The summary with its provenance, the roll-ups, `blocked` and `next`, the verdict's reason, the Decision block, the stage states and the fold line of the agents' text, in the snapshot and the deltas, with the differential test against the Lua. Demo: on a copy of the live tracker every item's summary and roll-ups in the hub equal the Lua's, and a frame client reads a card's summary, verdict reason and decision without a `task.view`.
2. **Unread counts and one sessions projection.** `unread` and `lastMessageAt` with every message delta, and the merged session rows. Demo: a frame client's unread count for a topic follows three new messages without counting frames, a verifier's row carries its hold with +N, and a waiting row its command.
3. **Marks per human and the events filter.** The events' last look, the plans' marks and the topics' read marks in the hub, Neovim moved onto them, and the filter on the subscription. Demo: opening the events view in the headless Neovim workbench sets the last look that a frame client then reads, and a subscription filtered to warnings receives only warning rows.
4. **The fold line and the answered ask.** Runs with their fold lines in the history pages and the deltas, and the answered ask's outcome in the thread and in the inbox's departure. Demo: four agent messages arrive as one fold line naming both sessions, four messages, the latest step and its age, and a fifth updates the same run without a re-read.
5. **Declining.** `declined` with a reason through `topic.answer`, delivered to the asker, the topic left open, and the clauses updated. Demo: a fake Implementer's ask declined with a reason receives `declined: <reason>`, and its topic stays open for its next ask.

## Definition of done

QA runs the demo below on `dev`, playing the human's part through the `cland` CLI, a frame client holding the web's cookie and a headless Neovim workbench (one `nvim --headless` process, keys by `nvim_input`, the screen read with `screenstring()`), and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes. The human does not run this demo (spec §4: no separate human acceptance pass).

In a scratch project holding a copy of the live tracker and the fake harnesses, QA runs the differential test of the summary and the roll-ups against the Lua and reads zero differences. A frame client takes the snapshot and reads a task's card facts (the summary with its provenance, the verdict's reason, the Decision block) and an epic's stage states without a `task.view` or a `task.plan show`. QA sends three messages into a topic and reads its unread count from the deltas, and reads a verifier's merged session row with its hold and +N. QA opens the events view in the headless Neovim workbench and reads the same last look from the frame client, then marks a topic read in the frame client and reads it read in Neovim. A subscription filtered to warnings receives only warnings. A fake Implementer and a fake Reviewer exchange four messages, and the frame client reads one fold line that a fifth message updates. The frame client answers one ask with an option and declines another with a reason: both fold with their outcomes in the thread and in the inbox's departures, the asker receives `declined: <reason>`, and the topic stays open.

- [ ] C1. Item summaries carry the summary with its provenance, the container roll-ups, `blocked` and `next`, the verdict's reason, the Decision block and the stage states, equal to the Lua's rules on a copy of the live tracker.
- [ ] C2. A topic's unread count and last message time come with every message delta, and sessions come as one merged projection.
- [ ] C3. The events' last look, each plan's last look and the topics' read marks are held in the hub per human, and Neovim and every browser read and set the same marks.
- [ ] C4. A subscription can carry the events filter, and its first page and live rows arrive filtered.
- [ ] C5. A run of agent messages comes with a fold line built from facts (who, how many, the latest step, the age) that follows the run as it grows.
- [ ] C6. An answered ask carries its outcome in the thread and in the inbox's departure, and declining is an answer with the value `declined` and a reason that the asker receives, with the topic left open.
- [ ] C7. `hub/README.md`, `nvim/README.md` and the role clauses describe the fields, the marks, the fold line and declining.

## Dogfooding

From this epic on Neovim and the browser agree on what the human has seen: the events' last look, the plans' marks and the topics' read marks are the same in both, and the web's card shows the summaries and roll-ups Neovim's explorer draws.

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub: the cland tools belong to the session that started them. Only `cland release` pushes to GitHub: commit on the task branch `t/<id>-<slug>` in its worktree, push it to `origin`, the local territory, and reach `dev` only through `cland merge` and its verdict gate. Suites run through `cland verify` (D25 and D29 of v0.1 §4). The hub's frame protocol is the first test seam (a real hub, real clients, the CLI against a temporary project; `hub/test/harness.ts`), the fake harnesses in `hub/test/fakes/` the second, and Playwright the third (headless Chromium through `playwright-core` under `node:test`, only for what needs a page); no new seams inside the hub. The web never sees the hub's secret. No hex colour outside the tokens in `web/src/tokens.css`. No iframe has `allow-scripts` together with `allow-same-origin`. Keys match by physical key (`KeyboardEvent.code`).
- **Precedence.** The spec's words; then the Lua rules (`nvim/lua/cland/explorer_summary.lua`, `explorer.lua`, `explorer_card.lua`, and the thread's folds in `thread.lua`), which define the results; then the Q-405 port (`web/src/summary.ts`, `web/src/explorer.ts`, `web/proto/summary-lua.test.ts` on `prototype/web-shell`), a reference never merged.
- **ADRs.** 0002 (Tracker files are the source of truth): the computed fields are projections, never written into item files. 0007 (Events reach sessions as deliveries): a declined answer reaches the asker as a delivery.
- **Risks.** Computing the roll-ups on every tracker change must not cost the event loop: recomputation per subtree, measured on the live tracker. Moving the marks out of `ui.json` must not lose the human's current last look. A declined ask must never read as consent.
- **Size.** About four sessions on the v0 scale.
- **Order.** Second in the hub lane: it waits for {E01}. {E03} waits for it, and so does {E06} in the web lane. {E05} reads its fields without an edge, so its first slice is the one to land early.

## Links

- Spec: `docs/spec/v0.2.md` on `dev`, §3.3, §3.4 and §3.6; `docs/spec/v0.1.2.md` §3.4, §3.7, §3.8 and §3.9; `docs/spec/v0.1.md` §3.14.
- Map M-399 and the tickets this epic absorbs: Q-400 (W10 and W11), Q-405 (its open points on read marks, the last look and the card's reads), Q-406 (declining), Q-407 (the fields and the marks), Q-408 (the fold line and the answered ask).
- Research: `research/web-client-surface` (`docs/research/web-client-surface.md` §3.2, the table per web area, and §4, W10 and W11); `research/web-prior-art` (`docs/research/web-prior-art.md` §7.2: the fold line, and an answer that must not read as consent).
- Prototype: `prototype/web-shell` (`web/PROTOTYPE.md`; `web/src/summary.ts`, `web/src/explorer.ts`, `web/proto/summary-lua.test.ts`).
- Mockups: `docs/design/web/Thread.dc.html` (P13), `PhoneThread.dc.html` (P32), `PhoneAsk.dc.html` (P37, P38).
- GLOSSARY: Summary, Card, Explorer, Ask, Events view.
