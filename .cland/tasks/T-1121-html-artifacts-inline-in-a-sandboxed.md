---
id: T-1121
kind: task
title: HTML artifacts inline in a sandboxed iframe
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-417
blocked_by:
  - T-1119
topic: null
branch: null
created: 2026-10-22T15:16:13.272Z
updated: 2026-10-22T15:16:13.272Z
---

## Summary

An HTML artifact posted in a thread renders inline at 240 px in a sandboxed iframe under a header with Open full and Open in a pane; a file or folder artifact stays a chip.

## Parent

E-417 (§3.4 artifacts inline; P15; tracer step 5, the artifacts half).

## What to build

For an HTML (page) artifact the message shows a 240 px frame of it, loaded from the address the hub mints for the browser (`artifact.url`, served under `sandbox allow-scripts`). The iframe's `sandbox` is `allow-scripts` and nothing more: never `allow-same-origin`, never top navigation, popups or forms. The header names the artifact and offers Open full (the artifact's own address in a new tab) and Open in a pane (the artifact full height in the other pane). An artifact the hub cannot serve shows as its chip with the reason in the tooltip. Files and folders keep their chips.

## Acceptance criteria

- [ ] C1. An HTML artifact in a message renders inline at 240 px in an iframe whose `sandbox` attribute is `allow-scripts` alone and whose source is the hub's artifact address (Web test).
- [ ] C2. A script inside the artifact cannot read the workbench page or navigate the top window (Web test).
- [ ] C3. Open full opens the artifact's address in a new page, and Open in a pane shows it in the other pane (Web test).
