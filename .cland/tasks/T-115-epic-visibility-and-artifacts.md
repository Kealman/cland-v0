---
id: T-115
kind: epic
title: "Epic: Visibility and artifacts"
state: open
labels:
  - epic
  - v0.1
  - ready-for-agent
assignee: null
parent: null
blocked_by:
  - T-110
  - T-109
topic: null
branch: null
created: 2026-10-09T21:51:34.527Z
updated: 2026-10-09T21:51:48.122Z
---

## Goal

Every surface of the workbench shows what needs the human now and what is worth watching, folds agent bookkeeping and keeps the old out of sight, and the human pins or mutes topics, sessions and artifacts. The human keeps their own artifacts, files or folders such as a prompt drafted over days, in an Artifacts browser where they never expire, while agents' reports follow their topics unless kept. Today the inbox and the panels show everything at once, and an artifact is a single file swept away with its topic.

## Contents

- **§3.5 Visibility levels, the rest**: the four layers on the inbox, the sessions, the items and the artifacts by the default placement table, with messages older than 7 days in archive; now and watch shown everywhere, background folded behind a count and archive reached only by an action; pins and mutes on topics, sessions and artifacts kept in `.cland/ui.json`; a `[visibility]` table for project overrides; and one classifier for every surface, the thread, the top bar and the palette included.
- **§3.6 Artifacts as a workspace**: an artifact is a file or a folder with an entry file; the human's and Aides' artifacts never expire, while agents' follow their topic unless `kept`; `artifact.keep`, `artifact.move`, `artifact.archive` and the `cland artifact` CLI; an "Artifacts" browser in the centre with the sections mine, this topic, kept, by role and archived, and its keys; and editing in place, where saving the buffer is the artifact.

Not in this epic: the thread's folds of agent runs and the top bar's now count, which "Threads that read" built and this epic's classifier takes over.

Choice where the spec is silent: the `[visibility]` table is keyed by surface and kind, each value a layer, mirroring the cells of the default placement table.

## Tracer-bullet order

1. **One classifier.** A module that places messages, inbox events, sessions, items and artifacts in a layer by the default table, overridable by `[visibility]`; the thread, the top bar and the palette move onto it. Demo: a project's `[visibility]` raises long idles to now, and the top bar counts them.
2. **Layers on the inbox and the sessions.** The inbox shows now and watch, with background only in the Agents log; "more (N)" folds and unfold keys; archive reached only by an action. Demo: a clear verdict sits under watch, and a session's bookkeeping never reaches the inbox.
3. **Layers on items, messages and artifacts; pins and mutes.** The items panel's filters as layers; messages older than 7 days archived; artifact lists by layer; pin and mute on topics, sessions and artifacts, kept in `ui.json`. Demo: the human mutes a noisy topic and pins a Reviewer, and both survive a restart.
4. **Folder artifacts and their lifetime.** `artifact.create` with a folder and an entry file; its files listed on request; the human's and Aides' artifacts exempt from the sweep; `kept`; `artifact.keep`, `artifact.move` and `artifact.archive`; agents refused on the human's artifacts. Demo: an agent's report without `kept` is swept after the retention period, and the human's folder is not.
5. **The artifact CLI.** `cland artifact new | open | keep | move | archive | promote`, including promoting a folder into the repository. Demo: the human creates a folder artifact from the shell and promotes it into `docs/`.
6. **The Artifacts browser.** The centre view with its sections and keys, editing in place, attaching to the composer with `s`. Demo: the human creates a folder "v0.2 notes" in the browser, adds two files, and attaches it to a message with `s`.

## Definition of done

The human starts the day. The inbox shows an ask and a not-clear verdict on top, the clear verdicts under watch, and no agent bookkeeping; the sessions panel folds the stopped sessions; the items panel shows the release's work with backlog and done folded. They mute a noisy item topic and pin a Reviewer. In the Artifacts browser they create a folder "v0.2 notes", add files over two days and attach it to a message with `s`. An agent's report artifact disappears after the retention period unless it was kept; the human's folder never does.

- [ ] One classifier places every message, inbox event, session, item and artifact by the default table and `[visibility]`.
- [ ] Each surface shows now and watch, folds background behind a count, and reaches archive only on an action; the inbox never shows background.
- [ ] Pins and mutes on topics, sessions and artifacts persist in `.cland/ui.json`.
- [ ] Messages older than 7 days leave the thread until the human asks for them.
- [ ] A folder artifact has one id and an entry file, and its files are listed on request.
- [ ] The human's and Aides' artifacts are never archived or deleted automatically; `kept` exempts an agent's artifact from the sweep and raises it to watch.
- [ ] `artifact.keep`, `artifact.move`, `artifact.archive` and the `cland artifact` commands work; agents cannot change the human's or an Aide's artifacts.
- [ ] The Artifacts browser has the sections and keys of §3.6, and saving a buffer saves the artifact.
- [ ] `hub/README.md` and `nvim/README.md` describe the layers, the overrides and the artifacts.

## Dogfooding

From this epic on, the human's inbox holds only what needs them during the rest of the build, and agent traffic stays folded on every surface. The human's notes for v0.2 and the drafts of the v0.1 release notes live as their own folder artifacts, from which the release item's Notes are written.

## Constraints

- **ADRs.** 0005 (Neovim is the host): the browser and the folds are Neovim views, with no plugins. 0003 (The hub is a per-project daemon extracted from the BCAS driver hub): the hub keeps the artifact index and the retention sweep. No ADR covers layers or artifacts; §3.5 and §3.6 record none.
- **Risks** from the sizing: one classifier for every surface, or they disagree; folders through paths written for files (copy, promote, archive, retention delete), the path and partial-failure classes that cost the v0 run the most review rounds.
- **References.** The mockups in `docs/design/main-screen/`: `Inbox.dc.html` (the v0 inbox anatomy), `Thread.dc.html` (watch dimmed, the inbox column's sections), `SessionsPanel.dc.html` (the stopped fold), `ItemsBoard.dc.html` (folded backlog), `Palette.dc.html` (dimmed hits, the `~` group). No mockup shows the Artifacts browser, so §3.6's words are the reference.
- **The v0 tail.** No open tail item touches this code.
- **Order.** Last in the Neovim lane, after "The task graph"; it waits for "Workbench basics" and "Threads that read". "Release from the item" waits for it.
- **Git and the gate.** Commit on the task branch `t/<id>-<slug>` in its worktree and push it to `origin`, the local territory; work reaches `dev` only through `cland merge` and its verdict gate; only `cland release` pushes to GitHub.
- **Language.** Every artifact, item, commit and doc in English.
- **Tests** through the v0 seams, in this order: the hub's frame protocol first (a real hub process and a real spoke over MCP and WebSocket, the UI over the JSON-lines socket, the `cland` CLI against a temporary project; `hub/test/harness.ts`); the harness process boundary second, with the fake Claude Code, Codex and OpenCode in `hub/test/fakes/`; the Neovim UI headless from the protocol's other side (`nvim/test` on the stub hub, QA cases in `qa/cases/` run by `cland --headless --qa`). No new seams inside the hub. Here the protocol covers the artifact tools, the retention sweep and the refusals.

## Links

- Spec: `docs/spec/v0.1.md` on `dev`, §3.5 Visibility levels, §3.6 Artifacts as a workspace.
- Map T-81: decisions T-94 and T-95.
- GLOSSARY: Layer, Artifact, Aide, Topic, Agents topic.
- ADRs: `docs/adr/0005-neovim-is-the-host.md`, `docs/adr/0003-hub-is-a-per-project-daemon-from-the-bcas-core.md`.
- Mockups: `docs/design/main-screen/Inbox.dc.html`, `Thread.dc.html`, `SessionsPanel.dc.html`, `ItemsBoard.dc.html`, `Palette.dc.html`.
