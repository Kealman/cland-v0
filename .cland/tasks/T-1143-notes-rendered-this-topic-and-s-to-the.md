---
id: T-1143
kind: task
title: Notes rendered, This topic and `s` to the composer
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-418
blocked_by:
  - T-1140
  - T-1119
  - T-1124
  - T-1116
topic: null
branch: null
created: 2026-10-22T15:16:16.723Z
updated: 2026-10-23T02:19:51.428Z
---

## Summary

On E-417's Markdown and composer, notes open as rendered Markdown in the drawer, the tree gains This topic, and `s` attaches an artifact to that topic's composer.

## Parent

E-418 (§3.2; v0.1 §3.6; tracer step 6). Ordered after E-417's thread (its Markdown renderer) and composer, which it reuses; the web takes no new dependency for Markdown.

## What to build

- **Notes.** Enter on a note or a prompt (a Markdown file) opens it in the drawer rendered with E-417's Markdown renderer, as thread messages render, with the raw source one toggle away, as E-795 does in Neovim.
- **This topic** is the topic whose thread the human last opened in this browser; the section lists that topic's artifacts and is absent before one is opened.
- **`s`** attaches the selected artifact to that topic's composer draft, and refuses with the reason in place an archived artifact, an artifact of another topic, or while the composer answers an ask, as Neovim does.

## Acceptance criteria

- [ ] C1. Enter on a note artifact opens it in the drawer rendered as Markdown (headings, lists, code), and the toggle shows its raw source (Web test).
- [ ] C2. After a topic's thread is opened, This topic lists that topic's artifacts (Web test).
- [ ] C3. `s` on an artifact of that topic adds it to the topic's composer draft, and the sent message carries it as the hub's topic history reads (Web test).
- [ ] C4. `s` on an archived artifact or one of another topic says why and attaches nothing (Web test).
- [ ] C5. `web/README.md` describes notes, This topic and `s` (docs).
