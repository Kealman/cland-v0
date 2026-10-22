---
id: T-1107
kind: task
title: "Neovim sometimes never shows hub: connected when ui.json is unreadable, after T-1054's mark import"
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-413
blocked_by: []
regression_of: T-1054
topic: null
branch: t/T-1107-neovim-sometimes-never-shows-hub
created: 2026-10-22T12:32:29.333Z
updated: 2026-10-22T12:32:43.194Z
---

## Summary

`nvim/test/ui.test.ts` "absent ui.json silently defaults; unreadable or corrupt files notify without hiding inbox answers" fails intermittently: "the screen never showed the stub hub connected within 10000 ms" (the client helper waits for `hub: connected` on screen, ui.test.ts line 29). It failed in the macOS stage cover ab78e484 (A-9149, dev b99de2c7) and in 2 of 5 runs alone on macOS at the same commit (coord, 2026-10-22 12:33Z), so it is not only load. The screen at timeout shows the shell with "no coordinator" and no `hub: connected`. T-1054 (c6396710) changed nvim/lua/cland/ui.lua to import last looks and plan marks from ui.json once into the hub; the case loops over absent, directory, `{broken`, wrong-shape and wrong-version ui.json files, so the import path on an unreadable file is the first suspect.

## Acceptance criteria

- [ ] C1. The cause is found and stated in the item topic with the failing ui.json variant; the fix makes the Neovim client reach `hub: connected` for every ui.json variant the test covers, and the preference notice still shows without hiding the inbox answer hint (test).
- [ ] C2. ui.test.ts passes 20/20 alone on macOS and in the mode-free Linux run, with the samples listed in the item topic (test).
