---
id: T-173
kind: task
title: "The Neovim suite takes its own lock: test:nvim never waits behind a hub suite"
state: open
status: in progress
labels:
  - tech-debt
  - ready-for-agent
assignee: null
parent: T-19
blocked_by: []
topic: topic-83
branch: t/T-173-the-neovim-suite-takes-its-own-lock-test
created: 2026-10-10T12:06:34.443Z
updated: 2026-10-10T12:07:12.272Z
---

## Parent

T-19 (follow-ups). From the stand-in's suite-queue analysis on 2026-10-10. Lock waits that morning reached 1800, 1388, 1045, 624 and 556 s, while the Neovim suite takes 2–3 min at a peak load of 5–8.

## What to build

`npm run test:nvim` takes its own lock, `/tmp/cland-suite-nvim.lock`, instead of the machine-wide suite lock. It already runs under its own TMPDIR root. Hub suites (`npm test`'s hub phase, `run-suite.ts all` and `hub`) keep the machine lock.

When `npm test` runs both phases, the hub phase takes the machine lock and the Neovim phase takes the Neovim lock. So two Neovim-only runs never overlap, and a Neovim run never waits for a hub run.

## Acceptance criteria

- [ ] `run-suite.ts nvim` acquires only the Neovim lock; `hub` and `all` acquire the machine lock for the hub phase and the Neovim lock for the Neovim phase.
- [ ] Two concurrent `test:nvim` runs serialize on the Neovim lock; a `test:nvim` run starts while a hub run holds the machine lock.
- [ ] Stale-lock recovery, the wait message and interruption behave the same for both locks; a test covers each lock.
- [ ] The Implementer and QA clauses and docs/agents notes name both locks.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size S. tech-debt; high payoff for the v0.1 run.

## Comments

### impl-173 · 2026-10-10T12:07:12.272Z

Implementation started. Runner currently holds one machine lock across hub and Neovim; will acquire/release per phase, keep shared ownership/recovery cleanup, cover routing and both locks, and update Implementer/QA guidance.
