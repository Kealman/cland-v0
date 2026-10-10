---
id: T-23
kind: task
title: General topic over the UI socket with a minimal Neovim client
state: closed
status: done
labels:
  - ready-for-agent
  - slice-1
assignee: Kealman
parent: T-19
blocked_by:
  - T-22
topic: null
branch: null
created: 2026-10-08T11:53:37Z
updated: 2026-10-10T00:58:17.326Z
github:
  repo: Kealman/cland-v0
  number: 23
  url: https://github.com/Kealman/cland-v0/issues/23
---

## Parent

Part of #19. Spec sections 4.5 and 5; decisions https://github.com/Kealman/cland-v0/issues/7 and https://github.com/Kealman/cland-v0/issues/13 (UI transport). Design: `docs/design/main-screen/` on main (thread and composer in `Main.dc.html` and `Charting.dc.html`); prototype branch `prototype/workbench` (`chat` module, composer as a prompt buffer); ADR 0005 mitigations.

## What to build

The hub stores topics and messages and creates the two standing topics, General and Agents, when a project's hub first starts. The UI transport speaks the same frames as the spoke, as JSON lines over the Unix socket (and over stdio when the UI spawns the hub as a child): list topics, read a topic's messages, send a message into a topic, subscribe to events (new message, delivery stage change). A minimal Neovim client, started through the standalone build approach of the prototype (`NVIM_APPNAME`, `--clean -u`, the ADR 0005 mitigations), connects over the socket, shows General as a thread buffer and a prompt-buffer composer, sends on Enter, inserts a newline on Shift+Enter, and shows the delivery stage of each human message. A message sent from the UI reaches a connected spoke as a `deliver` frame carrying the topic id and title; a message sent by the spoke appears in the UI thread.

## Acceptance criteria

- [ ] General and Agents exist after the first start and cannot be deleted or renamed
- [ ] A message typed in the Neovim client reaches a test spoke as a `deliver` with topic id and title; its stage shows `queued` while no spoke is connected and `delivered` once a spoke accepts it
- [ ] A message from the spoke appears in the client's thread within one event round trip, with sender name and time
- [ ] The same frames work over stdio when the client spawns the hub as a child process (test with a stub hub)
- [ ] The client loads nothing from the user's own Neovim configuration (`:scriptnames` shows only the bundled runtime and cland's files)
- [ ] Tests: a real hub plus a scripted UI client over the socket; a headless Neovim driven by `nvim_input` with `screenstring()` asserting the thread text

## Comments

### Kealman · 2026-10-08T13:17:48Z

<!-- github-comment: 6060740017 -->

Done on main (8e2ae4b, 55eedfe, c560b3b): topics and messages in the store with the standing General and Agents, UI frames (topic.list/history/send/rename/delete, subscribe, message and delivery events) over the Unix socket and over stdio (cland hub serve --stdio) on the shared dispatcher; deliver frames carry the topic; nvim/ with the pinned v0.12.5 launcher (NVIM_APPNAME=cland --clean -u), ADR 0005 mitigations, General thread and prompt-buffer composer with delivery stages. Hub 89 tests, nvim 6 headless tests (nvim_input + screenstring against a real hub and real spokes). Open: no @mention parsing yet (#32); stdio mode still binds the Unix socket.
