---
id: T-284
kind: task
title: The inbox in four sections, five rows each, with ages, in Neovim and the CLI
state: open
status: in progress
criterion_seq: 6
labels:
  - v0.1.2
  - nvim
  - ready-for-agent
assignee: null
parent: T-274
blocked_by:
  - T-283
topic: topic-173
branch: t/T-284-the-inbox-in-four-sections-five-rows
created: 2026-10-12T11:57:19.628Z
updated: 2026-10-12T14:47:34.805Z
---

## Summary

The inbox is redrawn on the now layer in its four sections (asks and approvals, plan approvals, requests to you, messages to you), newest first, five rows per section with an "N more" line naming the oldest wait, a waiting age on every row and the selected row unfolded in place. `cland inbox` prints the same four sections.

## Parent

T-274: Inbox and the events view. Spec: docs/spec/v0.1.2.md §3.7.

## What to build

**The four sections.** The panel inbox (`␣n`) and the full-width inbox (`␣N`) show only the now layer, in this order, each with its title and count:

1. Asks and approvals: the human's asks (`?`) and the sessions waiting for a command approval (`▲`).
2. Plan approvals: one row per epic whose plan waits for the human, with its title and its plan's size. Enter opens the plan view, where `a` approves, as today.
3. Requests to you: one row per request, with its glyph for review, QA or handover, its subject, its first line, and its sender in the sender's role colour.
4. Messages to you: one row per message, with its topic or bound item, its first line, and its sender in the sender's role colour.

Each section is newest first and shows its last five rows. The rest fold into one line, "▸ N more · the oldest waits <age>, since <time>", which `za` unfolds and folds again. Every row shows its waiting age, which refreshes at least once a minute with no hub frame. The selected row unfolds in place: an ask shows its question, its numbered options and its free-answer hint (`1`–`9` and `i` answer as today); a command approval shows the command in full; the other rows stay one line. Moving the cursor folds the previous row back. An empty section is not drawn. When nothing waits, the inbox says so ("✓ nothing needs you") and the chip is green. The empty state's events line and archive line arrive with the tickets that build them. The layout follows `docs/design/main-screen/InboxNow.dc.html`.

The v0.1.1 notification list stays below the four sections, unchanged, with its `d`, `D` and cap, until the last ticket of the epic retires it. Nothing the human sees today disappears before the events view exists.

**The CLI.** `cland inbox` prints the four sections in the same order, newest first, with a header per section and its count, one line per row with its id, its subject or topic, its first line, its sender and its waiting age, all rows (no cap). The last line stays `needs you: <n>`. `cland inbox --json` stays the frame as the hub returns it. The usage text describes the new layout.

**The hub.** Only what the drawing needs and the previous ticket did not provide (for example a plan row's title and size, a message's topic title), stated in `hub/README.md` beside the frame.

**Demo.** The headless workbench, on a scenario with one row of each kind, shows an ask first, a plan approval second, a request third and a message fourth, each with its age. A section of seven rows shows five and "▸ 2 more" with the oldest wait.

Out of scope: `r`, `d` on the new rows, and `A` (the next ticket); the events line (the events view ticket, which adds one line below the sections in parallel with this one: leave room for it and keep the renderer's sections and footer separable).

**Constraints.**

- Neovim is the host with no plugins (ADR 0005).
- Tests run the Neovim UI headless from the protocol's other side on the stub hub. The CLI is tested against a real hub on a temporary project.
- A Neovim-only delta needs `npm run test:nvim` green; suites run through `cland verify`.
- Every key goes through the action registry, so the palette and `␣?` list it.
- Commit on the task branch and push it to `origin`; `dev` only through `cland merge`.
- English everywhere.

## Acceptance criteria

- [x] C1. The panel and full-width inbox show the now layer in four sections in the order asks and approvals, plan approvals, requests to you, messages to you, each newest first with its count; senders are in their role colour.
  - done: impl-284 · 2026-10-12T14:47:22.059Z
- [x] C2. A section with more than five rows shows five and a "N more" line naming the oldest wait and its time; `za` on it unfolds and folds the rest.
  - done: impl-284 · 2026-10-12T14:47:34.246Z
- [x] C3. Every row shows its waiting age, and the age advances without a hub frame.
  - done: impl-284 · 2026-10-12T14:47:34.414Z
- [x] C4. The selected ask unfolds its options and free-answer hint in place and the selected approval its full command; other rows stay one line, and Enter on a plan row opens the plan view.
  - done: impl-284 · 2026-10-12T14:47:34.552Z
- [x] C5. `cland inbox` prints the four sections in the same order with ages and ends with `needs you: <n>` equal to the chip.
  - done: impl-284 · 2026-10-12T14:47:34.673Z
- [x] C6. Targeted tests pass (nvim headless tests on the stub hub, read with `screenstring()`; a hub test of `cland inbox` on a real hub), and `nvim/README.md` describes the four sections, their order, the five-row fold and the ages.
  - done: impl-284 · 2026-10-12T14:47:34.805Z

## Comments

### impl-284 · 2026-10-12T14:37:08.668Z

Implemented the four now sections in both views and CLI, per-section five-row folds, selected ask/command details and a local age clock. Added frame metadata for plan stage/lane/item counts and sender roles. Headless and real-hub tests are being updated to the new layout; legacy notifications and events footer remain separate.
