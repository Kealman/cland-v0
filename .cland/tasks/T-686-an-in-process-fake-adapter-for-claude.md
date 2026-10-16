---
id: T-686
kind: task
title: An in-process fake adapter for Claude Code, Codex and OpenCode that a projectHub test drives directly
state: open
status: planned
size: M
labels:
  - v0.1.4
  - verification
  - hub
assignee: null
parent: E-676
blocked_by: []
topic: null
branch: null
created: 2026-10-16T19:59:28.448Z
updated: 2026-10-16T20:00:51.765Z
---

## Summary

107 test files use the fake harness binaries (`hub/test/fakes/claude-code`, `codex`, `opencode`): each launch is one to three OS processes on 30–50 ms real timers, mostly to prove hub rules (routing, roles, subscriptions, tracker) or just to own a process row (memo §2.3 anti-patterns 7–8, §3.8; report-strategy §2.8). Decision 5 keeps the binaries for one contract file per harness plus the T3 scenarios. Everything else needs an adapter that runs in the test process. Today each in-process test writes its own inline `harness: 'test'` adapter (`launch-admission`, `roles-session-refresh`, `session-brief`).

## What to build

- **`fakeHarness(flavour)`** in `hub/test/fakes/`, implementing `HarnessAdapter` (`hub/src/adapters/contract.ts`) for `claude-code`, `codex` and `opencode`. Its `capabilities` and `clauseAtSpawn` are imported from the real adapters' exported constants (`CLAUDE_CODE_CAPABILITIES`, `CODEX_CAPABILITIES`, `OPENCODE_CAPABILITIES`), so a capability change in a real adapter changes the fake with it.
- **Driven by the test, no processes:** it records each `SpawnRequest` (role clause, brief, cwd, policy); the test calls `turn`, `idle`, `busy`, `exit(code)` and `crash`, scripts each inject's outcome (`accept`, `reject`, `uncertain`, `hold`), feeds usage and model, and answers `resume` as found or gone. State reaches `Sessions` the same way the real adapters' interpretations do.
- **Wiring.** `serveProject` and `createHub` accept an `adapters` option that replaces the registered real adapters under the same harness names, so `roles.toml` harness choices keep working. `projectHub(t, root, env, { harnesses: 'fake' })` uses it and returns the fakes.
- **First consumers.** `session-brief.test.ts` and `roles-session-refresh.test.ts` switch from their inline adapters to the shared fake.

## Acceptance criteria

- [ ] C1. A new T2 test proves launch, role clause, inject, turn, stop and resume through `projectHub` for each of the three flavours with no child process, proved by the tier lint and the file's spawn census row.
- [ ] C2. Each flavour's capabilities equal the real adapter's exported constant, proved by a unit test.
- [ ] C3. Scripted accept, reject and uncertain injects reach the delivery states `injected`, `delivered` and `uncertain` as the real adapters' do, proved by the new test.
- [ ] C4. `session-brief.test.ts` and `roles-session-refresh.test.ts` use the shared fake, with an audit showing their test declarations and assertion meanings unchanged.
- [ ] C5. `docs/agents/tests.md` names the in-process fake adapter as the default for hub rules and the fake binaries as reserved for contract and scenario files.
