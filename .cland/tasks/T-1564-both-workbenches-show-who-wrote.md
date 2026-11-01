---
id: T-1564
kind: task
title: Both workbenches show who wrote
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1536
blocked_by:
  - T-1561
topic: null
branch: null
created: 2026-10-31T23:47:51.380Z
updated: 2026-11-01T19:53:17.487Z
---

## Summary

In users mode the web and Neovim threads show a human message's author: "you" for the viewer's own user and the display name for any other user. Single mode keeps "you" everywhere. The web follows the web/ rules: CSS Modules, tokens, 4.5:1 secondary text and no local key listeners.

Hot files: `web/src/MessageBlock.tsx`, `web/src/MessageBlock.module.css`, `web/src/PhoneTopicThread.tsx`, `nvim/lua/cland/thread.lua`, web and nvim tests. No hub file.

## Acceptance criteria

- [ ] C1. In a web page signed in as one user, that user's messages show "you" and another user's show that user's display name, on desktop and phone layouts.
- [ ] C2. In Neovim, acting as the first user, the first user's messages show "you" and another user's show the display name.
- [ ] C3. In single mode both workbenches show "you" for human messages, with the existing thread tests unchanged.
- [ ] C4. The web change passes the typecheck's colour and contrast checks, adds no colour outside `tokens.css` and no key listener outside `keymap.ts`.
