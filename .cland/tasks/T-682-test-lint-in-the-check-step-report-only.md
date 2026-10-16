---
id: T-682
kind: task
title: "Test lint in the check step, report only: tier import rules, wall-clock waits and the T3 lifecycle header"
state: open
status: backlog
size: M
labels:
  - v0.1.4
  - verification
  - hub
assignee: null
parent: E-676
blocked_by:
  - T-679
  - T-680
topic: null
branch: null
created: 2026-10-16T19:59:27.971Z
updated: 2026-10-16T20:00:06.808Z
---

## Summary

The guidelines in `docs/agents/tests.md` exist only as text, so 481 `startDaemon` sites, 158 literal sleeps and 147 `Date.now` deltas kept growing (memo §2, §3.1; A-4004 recommendation 4). T0 gets a test lint (memo §5.1, §5.2.2). This ticket runs it in report mode only (memo §5.5 step 0); T-684 makes it refuse. It supersedes T-660's lint half.

## What to build

A lint module beside the tier lint, run once per run in the check step (after the typecheck, T-680) and by `npm run test:lint`. Its rules, per file and tier:

- **T1**: no `node:child_process`, `node:net`, `node:http(s)`, `node:dgram`; none of the harness's process or socket helpers (`projectHub`, `startDaemon`, `spawnSpoke`, `cland`/`clandWithEnv`, `connectUi`, the fake harness binaries); in-process pieces (`createHubBase`, `dispatcherUi`, the in-process fake adapter and fake clock) are allowed.
- **T2**: none of `startDaemon`, `killDaemon`, `spawnSpoke`, `fakeClaude`, `fakeCodex`, `fakeOpenCode`, or a spawned hub; `projectHub`, real sockets and a CLI subprocess are allowed. A Neovim file is T2 when it drives headless Neovim against the stub hub only; one that starts a real hub is T3.
- **Every tier**: a numeric literal passed to `sleep`, `pause`, `delay` or `setTimeout` used as a wait, and an assertion on a `Date.now()`/`performance.now()` difference, unless the line carries `// lint-allow-wall-clock: <reason>`.
- **T3**: the file's first comment block names the process behaviour it proves (`// T3: <behaviour>`), or the file is a contract or scenario entry.

Report mode: the result, the log and `cland verify --dry-run` (T-681) print `test lint (report only): <n> findings in <m> files`, the top findings by file, and per file the lowest tier it already qualifies for. Nothing refuses.

## Acceptance criteria

- [ ] C1. A planted T1 file importing `node:child_process` and a planted T2 file calling `startDaemon` each produce a finding naming file, line and rule, and clean T1/T2 files produce none, proved by lint tests.
- [ ] C2. A planted numeric sleep used as a wait and a planted elapsed-milliseconds assertion each produce a finding, and the reasoned marker suppresses it, proved by lint tests.
- [ ] C3. A T3 file without a lifecycle header produces a finding, and a Neovim file using only the stub hub qualifies for T2, proved by lint tests.
- [ ] C4. The lint runs once per run in the check step, its summary and per-file qualifying tier appear in the result and in the dry run, and no finding changes a run's exit, proved by a run-report test.
- [ ] C5. The repository's finding counts per rule at the merge head are recorded on this item as the baseline T-684 freezes.
