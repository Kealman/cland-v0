---
id: T-1116
kind: task
title: Markdown for messages as a safe pure parser
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-417
blocked_by: []
topic: null
branch: t/T-1116-markdown-for-messages-as-a-safe-pure
created: 2026-10-22T15:16:12.285Z
updated: 2026-10-22T15:17:01.652Z
---

## Summary

A pure module that parses one message's Markdown into a token tree the web renders as elements, so no raw HTML from an agent ever reaches the page. It has no React or browser dependency and runs in a parallel lane.

## Parent

E-417 (§3.4 and v0.1 §3.14 "Markdown per message"; the Risks constraint; part of tracer step 1).

## What to build

Each message is parsed on its own (v0.1 §3.14): headings, paragraphs, lists aligned under their text, quotes, tables kept as text, fenced code with its language label, inline code, bold, italic, links and bare http(s) addresses, and item ids (any configured prefix, `T-12`, `E-417`) as tokens of their own so a renderer keeps them whole and makes them links. An unclosed fence ends at the message's end and never spills into the next message; plain text is the fallback for anything the parser does not know. Raw HTML stays text. A link token carries only an `http` or `https` address; anything else (`javascript:`, `data:`, relative paths) becomes text. The parser is a hand-rolled subset with no new dependency, ported from the prototype's `thread/markdown.tsx` (`prototype/web-shell`, Q-405) but split so the parsing is pure TypeScript a unit test can import. The web's static checks refuse `dangerouslySetInnerHTML` and writes to `innerHTML` or `outerHTML` anywhere in the workspace's sources.

## Acceptance criteria

- [ ] C1. The parser turns headings, paragraphs, lists, quotes, fenced code with its language, inline code, bold, italic, links and item ids into tokens, and an unclosed fence ends at the message's end (test).
- [ ] C2. Raw HTML in a message stays a text token, and a link token is produced only for an `http` or `https` address (test).
- [ ] C3. The web typecheck fails on `dangerouslySetInnerHTML` or an `innerHTML`/`outerHTML` write in the web sources, with a seeded fixture proving the check (test).
