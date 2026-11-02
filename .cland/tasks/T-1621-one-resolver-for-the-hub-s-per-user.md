---
id: T-1621
kind: task
title: One resolver for the hub's per-user state, and an inventory of what the hub writes outside the project
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1538
blocked_by: []
topic: topic-1332
branch: t/T-1621-one-resolver-for-the-hub-s-per-user
created: 2026-11-02T03:34:17.764Z
updated: 2026-11-02T05:51:39.908Z
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

## Comments

### impl-1621 · 2026-11-02T05:44:28.033Z

Consumer inventory before implementation: spendPath exported from executor/droplet/spend.ts is used by droplet.ts, cli/executor.ts, executor-spend.test.ts, init-machine.ts and retirement/component tests; ledger lock, migration and retirement derive dirname(spendPath). Legacy reader and project HOME safety check are in spend.ts. HOME consumers outside spend: accounts/registry.ts; adapters/claude-code.ts; setup/steps/{accounts,trust}.ts; CLI {init,setup,open}.ts root guards. Runtime temp consumers: project socket fallback, termination-owner, suite-lock, verification-tree, Codex cland-run/sandbox, fixture-processes, QA scratch roots, droplet run/temp/provision scripts and health observation; suite lock defaults in init/config, daemon, suites and suite-worker. Search also covered hub/src colocated tests, all hub/test tiers, docs, skills, QA and shared. New API: hub/src/state-paths.ts exports userStateDirectory(env=process.env), userHome(env=process.env), legacySpendPath(env), and exact-source out-of-project exceptions with reasons. Existing spendPath API/wire and persisted ledger shapes remain unchanged. E-1532 paths must stay project-local or register exact runtime uses here.

### impl-1621 · 2026-11-02T05:51:39.908Z

Full consumer inventory: A-15593 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15593-t-1621-state-contract-consumer-inventory.md). No existing paths or wire/persisted formats change; existing fixtures and client consumers remain compatible. Local macOS/Node v24.21.0 targeted evidence so far: state-paths.test.ts 1/1, state-paths-lint.test.ts 3/3 (including planted controls, TS+shell inventory), state-inventory.test.ts 1/1 (fake harness, scripted provider lease, positive ledger and transient-lock observations), unchanged executor-spend.test.ts 20/20. Root typecheck passed. test:lint initially found missing new-file tier entries; added explicit T1/T2 registrations and rerunning. No T3/T4 or browser run; no full suite yet.
