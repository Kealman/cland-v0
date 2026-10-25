---
id: T-1315
kind: task
title: T-323's two help lines push the Artifacts help line off screen and break ARTIFACT-001
state: open
status: planned
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-1283
blocked_by: []
regression_of: T-323
found_by: cover
topic: null
branch: null
created: 2026-10-25T15:29:38.746Z
updated: 2026-10-25T15:29:45.975Z
---

## Summary

T-323 (9b3ae9f9) added two explanatory lines to the Neovim help (`M.HELP` in nvim/lua/cland/init.lua): "Early plan navigation waits for task and tracker snapshots; missing items are reported" and "Late role defaults fill untouched launcher fields once role.list arrives". They push the Artifacts line ("␣v in artifact") below the visible help window, so the shipped QA case ARTIFACT-001 times out at its `wait_for … 'toggle in help'` step (INCONCLUSIVE). Fails 3/3 on dev 83d5c7fc and at 9b3ae9f9; passes at its parent 9f31a3b7 (Coordinator, local macOS). Caught by the Linux stage cover c915ca99 (A-12008). The help lists keys and commands; behaviour explanations belong in docs (project rule).

## Acceptance criteria

- [ ] C1. The two behaviour lines leave `M.HELP`; their content lives in nvim/README.md or the docs instead. `nvim/test/qa-shipped.test.ts` "ARTIFACT-001 passes through the headless QA runner" passes locally 3/3 and in the item's mode-free verify on Linux, with the case unchanged.
