---
id: T-754
kind: task
title: "Runtime tripwire: allow the documented headless Neovim spawn in Neovim T2 files, and remove the ps probe from their fixture"
state: open
status: planned
size: S
labels:
  - v0.1.4
  - verification
  - nvim
  - ready-for-agent
assignee: null
parent: E-677
blocked_by: []
topic: null
branch: null
created: 2026-10-17T19:53:12.953Z
updated: 2026-10-17T21:48:43.306Z
---

## Summary

T-748's final census (A-4712/A-4713 follow-up, 2026-10-17) lists 134 report-only rows in 12 Neovim T2 files (account-poll, events, explorer-summary, graph, inbox-actions, inbox-sections, session-archive, session-resume, ui, vboard, verification-queue, verification-view). They come from two sources:
- startClient's headless Neovim spawn. docs/agents/tests.md explicitly allows this in T2 for files that use only the stub hub, so it's a missing allow-list entry, not a tier error.
- ownProcess's process-list probe in the Neovim fixture.

## What to build

The T2 tripwire allows the documented headless-Neovim spawn from the Neovim test client (the same narrow pattern as the cland CLI helper). The fixture's ps probe becomes injected or lazy, so stub-hub Neovim tests start no other child.

## Acceptance criteria

- [ ] C1. A full droplet run's trip report shows none of the 12 files, while a planted Neovim T2 test that spawns anything other than the headless client still trips, proved by runner tests.
