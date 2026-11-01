---
id: T-1546
kind: task
title: Codex spawn, liveness and stop through the Host
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1531
blocked_by:
  - T-1544
topic: topic-1297
branch: t/T-1546-codex-spawn-liveness-and-stop-through
created: 2026-10-31T23:47:41.385Z
updated: 2026-11-01T07:18:02.309Z
---

## Summary

Codex's app-server spawn, the `codex --version` check, the launch's cwd refusal, the pid checks, resume liveness and stop go through the session's Host. Sandbox roots follow in ticket 07, in the same file.

Hot files: `hub/src/adapters/codex.ts`

## Acceptance criteria

- [ ] C1. The app-server is started by the Host's spawn, detached, with the same arguments, environment (executor credentials stripped), working directory and log file as today (test).
- [ ] C2. The `--version` check runs through the Host's run in the session's cwd, and the cwd refusal through its statDirectory (test).
- [ ] C3. The adapter's poll, resume and stop use the Host's alive and stop, and the adapter's own `process.kill` probe is gone.
- [ ] C4. A test with a recording Host shows one spawn and one version check per launch, with every liveness check and stop of a Codex row reaching that Host (test).
- [ ] C5. The codex-adapter, codex-delivery, codex-native and codex-workspace-git test files pass with no test edited.

## Comments

### impl-1546 · 2026-11-01T07:11:39.772Z

Consumer inventory before additive HostCommand.logFile / LaunchFiles PID registration: production Host implementation local.ts; adapters sessions/claude-code/codex/opencode and launch-files through optional AdapterHost lookup callbacks; account poller uses Host.limitPolls only; host-contract, host-local-contract, host-contract-coverage, session-host and host-local-files tests plus existing adapter tests and scripted Codex fake. No wire/schema/persisted format changes; previous Host commands without logFile retain ignored stdio. Docs consumers: hub README Local Host section, implement skill Local Host section and per-test guides. Searches cover HostCommand, HostRunResult, host/host, hostForLaunch/Process and spawn callsites across production, all tests, skills and docs. Existing native fixtures keep optional Host callback compatibility. Pre-agreed seam: recording Host injected into the production CodexAdapter; preservation through unchanged codex-adapter/delivery/native/workspace-git.

### impl-1546 · 2026-11-01T07:16:43.045Z

Implementation checkpoint consumes Coordinator-approved pending T-1545 HostCommand.logFile, spawn.exited and LaunchFiles.spawned; no shared Host code duplicated. Source review/verification not requested pending shared capability landing. Targeted macOS arm64 local Node v24.21.0 working-tree receipts: unchanged codex-native 35/35, codex-delivery 22/22, codex-workspace-git 1/1 synthetic Seatbelt; new cwd/version refusal tests 2/2. Main lifecycle test remains incomplete until T-1545. Coordinator confirmed no per-item QA; after-stage QA covers it.

### impl-1546 · 2026-11-01T07:18:02.309Z

Checkpoint 53d09a95e pushed, tree clean. Artifact A-15211 records pending shared T-1545/T-1547 shapes and validation. Coordinator paused all local heavy runs and invalidated high-load receipts; all prior local results are provisional and will be rerun serially after resume. No source review or verification requested yet. Per Coordinator no per-item QA; stage QA on dev covers this item. Holding claim and waiting for resume/merge-dev instruction.
