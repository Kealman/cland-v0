---
id: T-1621
kind: task
title: One resolver for the hub's per-user state, and an inventory of what the hub writes outside the project
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1538
blocked_by: []
topic: null
branch: null
created: 2026-11-02T03:34:17.764Z
updated: 2026-11-02T03:34:46.550Z
---

## Summary

One module names where the hub keeps per-user state: `CLAND_EXECUTOR_STATE`, else `XDG_STATE_HOME/cland`, else `HOME/.local/state/cland`. The spend ledger moves onto that resolver with no change of path. A test starts a hub with `HOME` and `XDG_STATE_HOME` on one temporary directory and proves that every file it writes outside the project lands there. A lint keeps later code from escaping, apart from a named allow-list of per-machine runtime paths.

Hot files: new `hub/src/state-paths.ts`, `hub/src/executor/droplet/spend.ts` [E-1534 adds a category], new `hub/test/state-inventory.test.ts`, new `hub/test/state-paths-lint.test.ts` with its allow-list

## Acceptance criteria

- [ ] C1. One resolver returns the per-user state directory (`CLAND_EXECUTOR_STATE`, else `XDG_STATE_HOME/cland`, else `HOME/.local/state/cland`), and the spend ledger, its lock and its migration record resolve through it (test).
- [ ] C2. The legacy `~/.cland/executor/spend.json` is still read and reconciled as today, and `executor-spend.test.ts` passes with no test edited.
- [ ] C3. A hub started with `HOME` and `XDG_STATE_HOME` on one temporary directory, running a droplet lease on the fake DigitalOcean API and a fake-harness session, writes every file outside the project under that directory, apart from the allow-listed per-machine runtime paths (test).
- [ ] C4. A lint test fails on any `homedir()`, `HOME` join, `tmpdir()` or `/tmp` path in hub source outside the resolvers and an allow-list that names each per-machine runtime path with its reason (test).
- [ ] C5. The same lint fails on a macOS-only path or command (`Library/`, `caffeinate`, `open`) in hub source that no platform guard covers, so nothing macOS-only lies in the serving path (test).

## Notes

Shared files: see Hot files
