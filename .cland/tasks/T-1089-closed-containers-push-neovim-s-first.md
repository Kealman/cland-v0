---
id: T-1089
kind: task
title: Closed containers push Neovim's first payload to 240 KB on the live tracker, over the 128 KiB budget
state: open
status: review
size: M
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-413
blocked_by: []
regression_of: T-1081
topic: topic-828
branch: t/T-1089-closed-containers-push-neovim-s-first
created: 2026-10-22T01:04:50.220Z
updated: 2026-10-22T01:36:51.429Z
---

## Summary

Since T-1081, Neovim's first item payload carries every container, closed releases and epics included. On a copy of the live tracker (1,088 items, 109 open) it is 240,750 bytes, against the 131,072-byte (128 KiB) first-payload budget that E-1006 C3 set. That is `AssertionError: first item payload budget: 240750 bytes > 131072 bytes`, found by impl-1088 at dev 780e7ba7 with the startup probe on macOS. The thousand-item test fixture stays at 121 KB because it holds few closed containers, so no suite run caught it. Connection-to-render is still 40 ms, but the budget is a hard limit.

## What to build

Neovim's first item payload, and the web's open snapshot where it feeds the same budget, holds the open items and only the containers they need: open containers, and the ancestors of open items. Fully closed containers whose subtree has no open item move to the bounded closed pages, like closed tasks. The hub's roll-ups on the remaining rows keep counting closed descendants, so done/total and the stage counts stay correct. Unfolding a closed container, or turning on `D`, loads it through the pages.

## Acceptance criteria

- [x] C1. On a copy of the live tracker, Neovim's first item payload stays at or under 120 KiB, measured by the startup probe and asserted in a test with a fixture that holds many closed containers (test).
  - done: impl-1089 · 2026-10-22T01:36:24.804Z
- [x] C2. Releases, epics and categories still show their full done/total and stage counts from the hub's roll-ups with closed containers out of the first payload, in Neovim and in the web tree (tests).
  - done: impl-1089 · 2026-10-22T01:14:59.431Z
- [x] C3. Unfolding a closed epic or showing done items loads closed containers and tasks through the bounded pages with one row per identity (test).
  - done: impl-1089 · 2026-10-22T01:14:59.528Z
- [x] C4. The 1 MiB items cap check and the Lua differential still pass on the copied tracker (tests).
  - done: impl-1089 · 2026-10-22T01:14:59.593Z

## Comments

### impl-1089 · 2026-10-22T01:13:12.863Z

Checkpoint: public-frame forest regression reproduced first reply236737 >122880 bytes; ancestor-closure projection reduces it to3017. Closed parent pages now include containers with numeric identity cursors; Neovim scoped/all archive reads discover new containers recursively, and Web traverses/deduplicates nested pages. Local Darwin arm64 targeted: item-summary10/10, tracker-summary12/12, snapshot12/12, native progress6/6, native copied closed-pages1/1 (6.048s), browser items8/8 (new identity0.831s), copied-body Lua1/1 (6.640s,1088+3 bodies,0differences,121791-byte snapshot). npm check passed; test lint report mode,0refusals. Supporting worktree evidence only, not exact-head Linux/suite proof. Startup support/probe contract intentionally untouched until Coordinator posts T-1088 landing, per decision e1bbd285.
