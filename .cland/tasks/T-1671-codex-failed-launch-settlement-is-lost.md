---
id: T-1671
kind: task
title: "Codex and OpenCode failed-launch settlement is lost across a hub restart: the async unforward callback lives only in memory"
state: open
status: in progress
size: S
labels: []
assignee: null
parent: E-1885
blocked_by:
  - T-1607
regression_of: T-1606
topic: topic-1629
branch: t/T-1671-codex-failed-launch-settlement-is-lost
created: 2026-11-04T02:35:52.074Z
updated: 2026-11-18T17:46:11.057Z
---

## Summary

impl-1607 found during T-1607 (2026-11-04) that Sessions persists a failed launch's pending files, but `#recoveryObservers`, which carry the `LaunchSettled` callback, live only in memory. After a hub restart the generic rollback succeeds and `#settleFailedLaunch` has no callback, so the role can be released without the adapter's native settlement. T-1606's Codex callback (close or delete live, then unforward on the host) is exposed to the same gap. T-1607 adds an optional `HarnessAdapter.settleFailedLaunch(process)` fallback for Claude.

## What to build

Codex implements `settleFailedLaunch`. It rebuilds its bounded settlement (close and unforward) from exact-generation state after a restart, and fails closed with `cleanup-incomplete` and the role held when it cannot.

## Acceptance criteria

- [ ] C1. A hub restart between a failed remote Codex launch and its settlement still unforwards on the host before the role is released (test).
- [ ] C2. When the generation state is missing after the restart, the row stays held with `cleanup-incomplete` and its cause (test).

## Comments

### coord · 2026-11-04T04:11:42.128Z

Scope extended (coord, 2026-11-04 04:12Z): T-1603's remote OpenCode failed-launch settlement (async unforward through LaunchSettled) has the same restart gap. T-1603 ships the in-memory path only. This item implements `settleFailedLaunch` for both Codex and OpenCode once T-1607 lands, with C1 and C2 applying to each adapter.

### impl-1671 · 2026-11-18T17:46:11.057Z

Consumer map before contract change: #settleFailedLaunch has one caller, #runFailedLaunchStop; launch failure and relaunch failure create pending receipts and #recoveryObservers. The only adapter fallback implementation today is ClaudeCodeAdapter.settleFailedLaunch; generationAdapter routes it; Sessions.register/prune and host-revoke fake inspect its presence; claude-code-remote-files invokes it directly. Proposed additive optional LaunchFilesState settlement receipt is stored/read as JSON by ProcessTable.pendingStop/pendingStops and checkpointed through LaunchFiles.restore/snapshot; those checkpoints must preserve it. No wire change: Sessions.pendingStops projects process/state/error, requests and dispatch consume that projection. Existing tests referencing LaunchFiles or pending JSON: launch-files, launch-settlement, adapter-generation, codex-host, opencode-host, session-archive, session-host, system-processes, process-identity, name-reservation, waiting-launch, host-survival, host-reboot, host-revoke, host-destroy, session-host-routing, session-pool-placement, host-launch-layout, host-contract, host-ssh-contract, host-attach, lifecycle-serialization, lead-permissions-component; T3 launch-recovery, claude-code-remote, codex-remote, opencode-remote. Claude fallback keeps one-argument compatibility; old Codex/OpenCode file receipts without generation metadata must stay cleanup-incomplete. Docs consumers: adapters-and-sessions.md, host-agent.md, implement skill and its T-1607 provenance note; no frozen CLI/help or nvim/web shape change. Read de3eceb22 and preserving its captured-session-id recovery form. New component regression authored for both adapters with positively controlled native launch guard; not run during cover quiet.
