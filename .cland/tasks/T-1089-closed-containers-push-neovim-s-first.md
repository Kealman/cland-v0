---
id: T-1089
kind: task
title: Closed containers push Neovim's first payload to 240 KB on the live tracker, over the 128 KiB budget
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-413
blocked_by: []
regression_of: T-1081
topic: null
branch: t/T-1089-closed-containers-push-neovim-s-first
created: 2026-10-22T01:04:50.220Z
updated: 2026-10-22T01:05:02.144Z
---

## Summary

Since T-1081, Neovim's first item payload carries every container, closed releases and epics included. On a copy of the live tracker (1,088 items, 109 open) it is 240,750 bytes, against the 131,072-byte (128 KiB) first-payload budget that E-1006 C3 set. That is `AssertionError: first item payload budget: 240750 bytes > 131072 bytes`, found by impl-1088 at dev 780e7ba7 with the startup probe on macOS. The thousand-item test fixture stays at 121 KB because it holds few closed containers, so no suite run caught it. Connection-to-render is still 40 ms, but the budget is a hard limit.

## What to build

Neovim's first item payload, and the web's open snapshot where it feeds the same budget, holds the open items and only the containers they need: open containers, and the ancestors of open items. Fully closed containers whose subtree has no open item move to the bounded closed pages, like closed tasks. The hub's roll-ups on the remaining rows keep counting closed descendants, so done/total and the stage counts stay correct. Unfolding a closed container, or turning on `D`, loads it through the pages.

## Acceptance criteria

- [ ] C1. On a copy of the live tracker, Neovim's first item payload stays at or under 120 KiB, measured by the startup probe and asserted in a test with a fixture that holds many closed containers (test).
- [ ] C2. Releases, epics and categories still show their full done/total and stage counts from the hub's roll-ups with closed containers out of the first payload, in Neovim and in the web tree (tests).
- [ ] C3. Unfolding a closed epic or showing done items loads closed containers and tasks through the bounded pages with one row per identity (test).
- [ ] C4. The 1 MiB items cap check and the Lua differential still pass on the copied tracker (tests).
