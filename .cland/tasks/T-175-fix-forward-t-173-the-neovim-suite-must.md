---
id: T-175
kind: task
title: "Fix forward T-173: the Neovim suite must not run beside a hub suite (load 28, 14 shell timeouts)"
state: open
status: backlog
labels:
  - tech-debt
  - ready-for-agent
  - bug
assignee: null
parent: T-19
blocked_by: []
topic: null
branch: null
created: 2026-10-10T12:28:36.106Z
updated: 2026-10-10T12:28:36.106Z
---

## Parent

T-19 (follow-ups). A fix forward for T-173 (merged 0820d97), found on 2026-10-10 by T-173's own Neovim validation.

## What to build

With T-173's separate Neovim lock, a Neovim run started at once beside a full hub suite: lock wait 0.01 s. Machine load peaked at 28.7, and 14 Neovim shell tests timed out in startShell after about 12 s (A-602). Alone, the Neovim suite peaks at a load of 5–8, and a hub suite at 18–21. The two together overload the dev machine.

Restore safe serialization while keeping T-173's improvements: the shared stale recovery, the runner-wide interrupt latch and the per-phase leases. The Neovim phase must not run while a hub phase runs on the machine. The simplest correct form: every phase also takes the machine lock, so the Neovim lock only orders Neovim runs among themselves. A load gate is an option only if it is deterministic and tested.

## Acceptance criteria

- [ ] A Neovim run never overlaps a hub run on the machine; a runner test covers a Neovim run waiting while a hub run holds the machine lock.
- [ ] T-173's interrupt latch, stale recovery and wait messages are unchanged, and its 28 runner tests still pass.
- [ ] The Implementer and QA clauses and docs/agents/tests.md describe the actual rule; the handover lists the exact instance lines.
- [ ] `npm run typecheck && npm run test:nvim` pass, and one full `npm test` passes on the branch.

## Notes

Size XS. High priority: until it lands, Neovim runs on branches based on dev after 0820d97 can overlap hub runs.
