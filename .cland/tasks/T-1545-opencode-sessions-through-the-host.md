---
id: T-1545
kind: task
title: OpenCode sessions through the Host
state: open
status: in progress
size: S
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1531
blocked_by:
  - T-1544
topic: topic-1295
branch: t/T-1545-opencode-sessions-through-the-host
created: 2026-10-31T23:47:41.079Z
updated: 2026-11-01T07:18:57.887Z
---

## Summary

OpenCode's `opencode serve` spawn, its pid checks, its liveness on resume and its stop go through the session's Host, with launch, delivery and stop behaviour unchanged.

Hot files: `hub/src/adapters/opencode.ts`, `hub/src/adapters/opencode/server.ts`

## Acceptance criteria

- [ ] C1. `opencode serve` is started by the Host's spawn with the same arguments, environment, working directory and log file as today (test).
- [ ] C2. The adapter's poll, resume and stop use the Host's alive and stop for the row, and the adapter's own `process.kill` probe is gone.
- [ ] C3. A test with a recording Host shows one spawn per launch, with every liveness check and stop of an OpenCode row reaching that Host (test).
- [ ] C4. The opencode-adapter and opencode-native test files pass with no test edited; in opencode-launch-policy only its cp.spawn fake may change, to emit `spawn` and an owned exit receipt the way a real child does, with every test body and assertion byte-identical (exception decided by the Coordinator 2026-11-01; the fake never modelled a child's lifecycle).

## Comments

### impl-1545 · 2026-11-01T07:12:58.219Z

Rule 20 consumer inventory before shared Host spawn extension: searched HostCommand, HostProcess, Host['spawn'], Host annotations, startServer, transaction.child, hostForLaunch/hostForProcess and direct spawn/probe names across hub/nvim/web/shared/qa and shipped skills. Production: host/local.ts is the sole Host implementation; sessions.ts owns lookup; launch-files.ts registers/rolls back children; opencode.ts and opencode/server.ts consume spawn/liveness/stop. Existing Claude/Codex native child registrations remain on child() unchanged (T-1546 will consume spawned()). Shared contract host-contract.ts (T3 wrapper host-local-contract.test.ts), host-contract-coverage.test.ts (T1), session-host.test.ts (T2), opencode adapter/native/launch-policy fixtures are consumers; no wire/persisted record changes. Existing spawn consumers destructure pid and are compatible with added required exited; logFile defaults to ignored stdio. Upcoming T-1552 fake Host must implement required exited; Coordinator notified and T-1546 given exact method signature. Docs: existing Host README and implement skill sections, per-test guides. No protocol older-hub regression needed: this is an internal injected interface, not a wire shape.

### impl-1545 · 2026-11-01T07:18:57.887Z

C4 fixture exception authorized by Coordinator decisions a0e3c455 and dc781da0: the launch-policy cp.spawn fake returned a synthetic already-exited child that emitted neither spawn nor exit, and threw on every ps query. It never modeled native admission/completion. Only its fixture changes: native ps passthrough with scratch-only env and impossible real PID 99999999, owned spawn/exit/kill/teardown receipts. All test bodies and assertions remain byte-identical; opencode-adapter and opencode-native remain byte-unedited. Will present this fixture diff separately in source review. All loaded-run receipts are diagnostic only; local heavy work is paused by Coordinator.
