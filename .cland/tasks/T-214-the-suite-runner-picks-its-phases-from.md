---
id: T-214
kind: task
title: "The suite runner picks its phases from the diff: hub-only changes skip the Neovim phase, Neovim-only changes skip the hub phase"
state: open
status: backlog
labels:
  - tech-debt
  - ready-for-agent
assignee: null
parent: T-216
blocked_by:
  - T-174
topic: null
branch: null
created: 2026-10-11T06:30:53.442Z
updated: 2026-10-11T06:35:56.821Z
---

## What to build

`hub/test/run-suite.ts` and `cland suite` compute the branch's changed paths against fetched `dev` and choose the phases:

- **`hub/` only:** the hub phase, plus a Neovim smoke subset (the tests that drive a real hub through the spoke).
- **`nvim/` only:** the Neovim phase, plus the targeted hub tests the item names.
- **Anything else** runs the full suite as today. That covers changes to both, `.cland/`, the roles or crew files, the message protocol, or the hub event shape.

The integrated dev suite after a batch always runs in full. The chosen mode is printed in the duration line and in the suite report, together with the file list that decided it.

## Acceptance criteria

- [ ] The phase choice is a pure function of the diff, with a unit test per rule.
- [ ] `--all` forces the full run.
- [ ] The suite report names the mode and the deciding files.
- [ ] A hub-only item on dev shows the lock held for the hub phase and the smoke only.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Requested by the human via the stand-in, 2026-10-11. Launch right after T-174 lands. Context: most wall-clock goes to waiting for the serialized suite, and T-201, T-207 and T-203 made the queue fair but not shorter.
