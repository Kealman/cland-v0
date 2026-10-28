---
id: T-1370
kind: task
title: Telegram voice notes, messages and approvals read with their marks in both workbenches
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1313
blocked_by:
  - E-1311
topic: topic-1165
branch: t/T-1370-telegram-voice-notes-messages-and
created: 2026-10-27T05:46:51.211Z
updated: 2026-10-28T22:23:13.175Z
---

## Summary

A voice note's transcript message shows its 🎤 marker, "via Telegram" and its audio artifact in Neovim and the web. A text message and a card approval made on the fake Bot API read with "via Telegram" in both workbenches.

## What to build

Spec §3.11 (source and voice marks), §3.1 (`via`) and §3.6 (the transcript message). T-1322 renders `via` through the test messenger. This ticket checks the whole path from the fake Bot API, and it makes the 🎤 marker, "🎤 not transcribed" and "nothing recognised" read as a distinct mark in a message row, not as body text, in both workbenches. This needs the transcript message's shape as E-1311 builds it.

**External wait and shared files:** E-1311 (voice notes; this also implies E-1310's cards, which E-1311 follows) · **Shared files:** web/src/MessageBlock.tsx, nvim/lua/cland/thread.lua, web/src/provenance.ts, nvim/lua/cland/provenance.lua

## Acceptance criteria

- [ ] C1. A voice note on the fake Bot API, transcribed by the fake speech provider, reads in headless Neovim and headless Chromium with its 🎤 mark, "via Telegram" and its audio artifact, and an untranscribed note reads "🎤 not transcribed" (test).
- [ ] C2. A text message and a card approval made on the fake Bot API read "via Telegram" on the thread row and on the approval's inbox outcome in both workbenches (test).
