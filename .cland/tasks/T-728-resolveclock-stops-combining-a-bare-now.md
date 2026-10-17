---
id: T-728
kind: task
title: resolveClock stops combining a bare now callback with native timers; fixtures pass a complete Clock
state: open
status: in progress
size: S
labels:
  - v0.1.4
  - hub
  - tests
assignee: null
parent: E-677
blocked_by:
  - T-696
topic: topic-438
branch: t/T-728-resolveclock-stops-combining-a-bare-now
created: 2026-10-17T07:54:46.590Z
updated: 2026-10-17T11:38:51.842Z
---

## Summary

`resolveClock` accepts a bare legacy `now` callback and combines it with native timers. Since adapters consume `core.clock` (T-685, T-696), a fixture that passes a frozen or offset `now` silently builds a hybrid: frozen timestamps with real timers. That hybrid caused T-696's red run 181884dc (A-4365), where a relaunched session's pid was never discovered within 45 s. T-696 fixed the one fixture it hit.

## What to build

`resolveClock` stops building hybrids. The bare-callback form is refused, or kept only behind an explicit wrapper that makes the mixed domain visible. Every timer-owning fixture passes a complete Clock object instead: the FakeClock, the real clock, or an offset real clock. The test docs name the rule.

## Acceptance criteria

- [ ] C1. Passing a bare `now` callback to a hub or adapter fixture is refused or explicitly wrapped, proved by a T1 test, and no fixture in hub/test still passes one.
- [ ] C2. Every migrated fixture's tests keep their assertions' meaning, and the touched files pass 5/5 serially on the Mac and in the task's droplet verify.
- [ ] C3. "Test levels" in docs/agents/tests.md says a test injects one complete Clock, never a bare now callback.

## Comments

### impl-728 · 2026-10-17T11:38:51.842Z

Implementation in progress: resolveClock now rejects bare now injection at type and runtime boundaries; T1 red→green regression records the refusal and complete/default clock identity. Migrated the 16 legacy HubCore/startHub call sites (including hub/src/hub/store.test.ts) to FakeClock, with protocol-only cases on inProcessSpoke. Native subscription relaunch retains its explicit offset realClock. Visibility's exact seven-day and +1ms assertions reopen retained storage in-process before the timer-free leap. No baselines or allowances changed. Typecheck and test:tiers pass; report-only test lint captured. Serial Mac 5/5 checks running; one asks approval timeout is under comparison with the Coordinator per A-4481.
