---
id: T-1124
kind: task
title: "The composer: kinds, the addressee chip, keys and drafts"
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-417
blocked_by:
  - T-1117
  - T-1119
topic: topic-892
branch: t/T-1124-the-composer-kinds-the-addressee-chip
created: 2026-10-22T15:16:13.780Z
updated: 2026-10-23T04:28:26.027Z
---

## Summary

A composer at the foot of every thread chooses Message, Decision or Question and the addressee as a chip, attaches an artifact with `~`, sends with Enter or `⌘Enter`, keeps a draft per topic in the browser and disables Send while the hub is offline.

## Parent

E-417 (§3.4 the composer; v0.1.2 §3.8 addressing; P16; tracer step 4).

## What to build

The kind is a segmented control (P16) sent as the hub's kind. The addressee is a chip: the Coordinator by default in an item's topic; typing `@` picks a session to address instead (the palette's session results); with no chip the hub's own addressing applies, as in Neovim (v0.1.2 §3.8). `~` picks an artifact the message carries as its chip. Enter sends a one-line message, Shift+Enter breaks the line, and `⌘Enter` always sends; in a draft of more than one line Enter breaks the line too. `⌘K` in the composer still opens the palette and keeps the draft. These keys are the composer context's bindings in the one key map. The draft is kept per topic in the browser and survives a disconnection and a reload; Send and the send keys are disabled while the hub is offline, and nothing is queued in the browser. A sent message is shown pending until the hub's receipt; a refusal puts the text back. Writing marks the topic read up to the sent message.

## Acceptance criteria

- [ ] C1. The composer sends a Message, a Decision and a Question, and both the thread and a frame client read each with its kind (Web test).
- [ ] C2. In an item's topic the chip names the Coordinator and the fake Coordinator receives the message; `@` replaces the chip with a chosen session, which receives the next one (Web test).
- [ ] C3. Enter sends a one-line draft, Shift+Enter breaks the line, `⌘Enter` sends a multi-line draft, and `⌘K` opens the palette with the draft kept (Web test).
- [ ] C4. `~` attaches a chosen artifact, and the received message carries it (Web test).
- [ ] C5. A draft survives a reload and a hub disconnection per topic, Send is disabled while the hub is offline, and writing marks the topic read up to the sent message (Web test).
