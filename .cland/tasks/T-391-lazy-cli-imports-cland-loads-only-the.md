---
id: T-391
kind: task
title: "Lazy CLI imports: cland loads only the subcommand it runs, with its usage text in a light module and a module-count guard test"
state: open
status: planned
size: S
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: E-386
blocked_by: []
topic: null
branch: null
created: 2026-10-14T12:28:10.700Z
updated: 2026-10-14T12:28:24.376Z
---

## Summary

`hub/bin/cland.ts` statically imports every subcommand module. Each `cland` process, about 3,700 per suite run plus every agent's own calls, therefore loads 139 of the 144 `hub/src` modules with TypeScript stripping, about 0.09 s idle and more under load. This ticket makes each subcommand a dynamic import and moves the usage texts into a light module, so `cland --help` loads a handful of modules. A guard test keeps it that way. The research estimates 180–300 s of test-time, 0.8–1.3 minutes of a full run.

## Parent

"Test speed: quick wins" (R-228), tracer bullet 3; research #4 (`docs/research/test-speed.md` §3.10 "Lazy CLI subcommand imports", §1 "Fixed setup cost per spawned hub").

## What to build

**Usage texts.** The entry builds its help from 21 `*_USAGE` constants imported from the subcommand modules (`ACCOUNT_USAGE` … `SUBSCRIPTIONS_USAGE`). Move them into one module, `hub/src/cli/usage.ts`, that imports nothing from `hub/src` except `version.ts`. Each subcommand module re-exports its constant from there, so its own `--help` output and its tests are unchanged.

**Dynamic dispatch.** Each `case` in `hub/bin/cland.ts` does `const { runTask } = await import('../src/cli/task.ts')` (and so on) inside its existing `try`, so import errors land in the same `cland: …` error path with the same exit code. `--version`, `--help` and the no-command branch import only `usage.ts` and `version.ts`. The internal `--qa-fixture` path keeps its exit-code behaviour.

**Heavy imports inside subcommands.** Where one subcommand module statically pulls in a large graph for a rarely used branch, move that branch to a dynamic import as well. Example: `cli/hub.ts` importing the daemon for `start`, when `status` and `stop` only need the socket client. Do this only where the guard test's numbers show it pays. The detached daemon process itself is out of scope.

**The guard test, `hub/test/cli-imports.test.ts`.**

- It spawns `node --import <counter> hub/bin/cland.ts <args>` for `--help`, `--version`, `task list --json` (in a temporary project without a hub) and `hub status`. The counter is a `module.registerHooks` resolve hook in a test fixture that counts `hub/src` URLs and writes the count to a file.
- It asserts `--help` and `--version` load at most 10 `hub/src` modules.
- It asserts each other command loads no more than a recorded budget: today's measured closure plus a 10% margin, written in the test with a comment naming how it was measured.

This is a real-process test with no hub, so it runs in the `machine` shard; add it to `hub/test/shards.json`.

## Acceptance criteria

- [ ] C1. `cland --help` and `cland --version` load at most 10 `hub/src` modules (139 today), measured by the guard test.
- [ ] C2. Each subcommand loads only its own closure, and the guard test fails when a static import of another subcommand module is added to `hub/bin/cland.ts`.
- [ ] C3. Measured on an idle machine: `cland --help` takes at most 50 ms (median of 20, about 90 ms today) and `cland task list --json` against a running hub is at least 30 ms faster (median of 20); before/after numbers are posted on the item.
- [ ] C4. Every subcommand's help text, exit codes and error lines are unchanged; existing CLI tests pass without changed assertions.
- [ ] C5. An import failure inside a subcommand reports `cland: <message>` with that subcommand's existing exit code, proven by a test.
- [ ] C6. `hub/README.md` (the CLI section) notes that subcommands load lazily and that the guard test holds the counts.
