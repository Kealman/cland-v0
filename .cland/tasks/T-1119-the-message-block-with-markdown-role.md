---
id: T-1119
kind: task
title: The message block with Markdown, role colours, verdicts and chips
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-417
blocked_by:
  - T-1118
  - T-1116
topic: null
branch: null
created: 2026-10-22T15:16:12.897Z
updated: 2026-10-22T15:16:12.897Z
---

## Summary

Every message in the thread becomes the message block of P12: a header over a Markdown body, the role colour in its own gutter, the human's band, dimmed watch messages, verdicts with their criteria marks and artifact chips.

## Parent

E-417 (§3.4 and v0.1 §3.14; P12; tracer step 1).

## What to build

The header carries the sender, the role in its colour, the addressees, the kind (an agent's send kind and the human's Message, Decision or Question once the hub carries it), the time and the delivery stage or waiting state at the right. The role colour is a 3 px bar in its own gutter running down the whole message; the human's and an Aide's messages sit on a band spanning the row (an Aide's bar dashed); no message is a boxed card. Watch-layer messages (the Coordinator's reports, a clear verdict) are dimmed. A verdict shows its result in red or green with the criteria it marked and a failed criterion's note; a clear verdict takes one row. A date line appears when the day changes. The body renders the Markdown parser's tokens as React elements: code blocks inset in the band with their language label, lists aligned, links underlined and opening outside the page (`target="_blank"`, `rel="noopener noreferrer"`), item ids as links that open the item and never break at the hyphen. An artifact posted with a message, and a file or folder artifact, shows as a chip naming its id, kind and title; an HTML artifact also shows as a chip until the inline ticket. Role colours are the build's (`hl.lua`) through tokens in `tokens.css`, and secondary text keeps 4.5:1.

## Acceptance criteria

- [ ] C1. A message shows the P12 header (sender, role in its colour, addressees, kind, time, delivery stage) over its body, with the role colour as a 3 px bar in its own gutter (Web test).
- [ ] C2. The human's messages sit on a band, a watch-layer message is dimmed, and a not-clear verdict shows its result with its criteria marks and the failed criterion's note (Web test).
- [ ] C3. Markdown in a message renders headings, lists, code blocks and links, links open outside the page, and HTML in a message shows as text with no element from it in the DOM (Web test).
- [ ] C4. Item ids in a body are links that open the item and stay on one line at the hyphen, and artifact, file and folder posts show as chips (Web test).
