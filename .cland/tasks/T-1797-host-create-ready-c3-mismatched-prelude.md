---
id: T-1797
kind: task
title: "host-create-ready C3 mismatched-prelude case flakes under load: the 300 ms gate times out before the provision exit is recorded"
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-09T19:35:22.739Z
updated: 2026-11-09T19:35:22.739Z
---

## Summary

`hub/test/host-create-ready.test.ts`: "C3 mismatched prelude key never registers or starts a supervisor and releases machine after gate" (T3) uses `gateMs: 300`. It asserts that the failure reason carries both `pinned-key … timed out` and `provision command exit=… signal=`. Under suite load on macOS, the gate timed out before the provision command's exit was observed, so the reason was only `pinned-key provisioning gate timed out`. Alone it passes 5/5 at the same commit.

## Evidence

- E-1535 stage-1 macOS cover e143c24d at dev 700f88ce (A-18176): `AssertionError … The input did not match /provision command exit=.* signal=/. Input: 'pinned-key provisioning gate timed out'` at host-create-ready.test.ts:78. Peak 1-minute load was about 10.
- The same tree's Linux cover 70a2f91e (A-18172) is green. Five solo runs on macOS at 700f88ce: 5/5 pass.

## Acceptance criteria

- [ ] C1. The case's assertion about the provision command's exit doesn't depend on the command finishing within a 300 ms wall gate: it uses the hub clock or a held fake command, or asserts the exit receipt after joining the provision owner (test).
- [ ] C2. The case passes 20/20 under the load gate's repetition with 2 workers and a CPU burner on macOS (test).
