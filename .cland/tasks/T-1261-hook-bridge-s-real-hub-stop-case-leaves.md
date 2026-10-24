---
id: T-1261
kind: task
title: hook-bridge's real-hub stop case leaves a Timeout open in projectHub on Linux
state: open
status: review
size: S
criterion_seq: 2
labels:
  - needs-triage
assignee: null
parent: E-1197
blocked_by: []
topic: topic-1008
branch: t/T-1261-hook-bridge-s-real-hub-stop-case-leaves
created: 2026-10-24T20:24:45.140Z
updated: 2026-10-24T21:47:29.426Z
---

## Summary

`hub/test/scenarios/hook-bridge.test.ts:14` "a bridge exits after its real hub stops even while its parent and stdout remain alive" failed three times on Linux droplets on 2026-10-24, each time with `projectHub leaked resources … resources: ['Timeout']` (hub-resources.ts:30 via process-cleanup.ts:63):
- periodic dev T3 5564ec58 at da2d0e6f (A-11297)
- periodic dev T3 679cfcb8 at 8fd6195f (A-11364)
- stage cover 53e77774 at fdcea0b9 (A-11388, shard-2)

It passed in the culprit-search rerun 674fcc32 at da2d0e6f, in T-1255's verify all 1e7e5d01, and on macOS covers. The last green periodic run was at 89e5c304. Something started since then leaves a hub timer unref'd or uncleared at stop, intermittently.

## Acceptance criteria

- [x] C1. The timer the in-process hub leaves after stopping is identified (its creation site) and is cleared on stop, with a red control reproducing the leak (test).
  - done: impl-1261 · 2026-10-24T21:47:11.499Z
- [ ] C2. On a Linux droplet at 2 workers, the item's mode-free verify passes the hook-bridge case and the new deterministic held-native reproduction passes its load-gate repetitions (test).

## Comments

### coord · 2026-10-24T20:31:10.072Z

Local Darwin arm64 at fdcea0b9: hook-bridge.test.ts run alone 5/5 passed (coord scratch clone, one file at a time). macOS stage cover 9c0ab09c at the same SHA was green. The leak so far shows only on Linux droplets; one Linux cover resubmit 14d0d24a is running under the flaky-rerun rule.

### coord · 2026-10-24T21:40:16.649Z

Another Linux occurrence: E-1216 stage cover 0001a9d2 (droplet c-8 lon1, dev 5205aeb6, log A-11486) failed scenarios/hook-bridge.test.ts "a bridge exits after its real hub stops even while its parent and stdout remain alive". The only other failure in that run was T-1263's deterministic accounts regression. That makes two Linux stage covers today with this test red.

### impl-1261 · 2026-10-24T21:43:44.087Z

Deterministic native control: place agents-hold in the fake Claude config directory, wait for agents-started PID, then stop the restarted projectHub. Red on macOS: held query PID remains live at stop. async_hooks stack identifies Timeout(_idleTimeout=15000, _onTimeout=delayedKill) at node:child_process execFile -> hub/src/adapters/claude-code.ts:#run (line 308), called by #agents. Ordinary scenario passed 12 local standalone executions before forcing the window. Planned contract inventory before making Adapter.close optionally awaitable: production consumers are Sessions.close and projectSessions.close, served by daemon.stop (already awaiting). Implementers ClaudeCodeAdapter, CodexAdapter, OpenCodeAdapter and fakeHarness: synchronous close remains supported; only Claude gains an optional drain. Direct Claude test consumers: claude-code-schedule, claude-code-environment, adapter-native-boundary, session-cwd and scripted fake wrappers in claude-code-sessions; pending native work will be awaited where relevant. Other adapter-specific tests/fakes remain synchronous and unaffected. Search covered hub/nvim/web production + all hub test tiers, docs, .agents skills and qa; no wire/snapshot/list/persisted client uses Adapter.close. Existing synchronous fake close stays as previous-contract compatibility coverage.
