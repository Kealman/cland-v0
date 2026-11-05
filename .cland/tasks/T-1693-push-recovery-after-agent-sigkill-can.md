---
id: T-1693
kind: task
title: Push recovery after agent SIGKILL can find the producer ended with no completed receipt under load
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by: []
regression_of: T-1609
topic: null
branch: t/T-1693-push-recovery-after-agent-sigkill-can
created: 2026-11-05T17:56:03.123Z
updated: 2026-11-05T23:07:15.058Z
---

## Summary

`hub/test/host-push-on-ref-move.test.ts` "interrupted admitted native push survives agent SIGKILL and recovery publishes only the current head" failed in impl-1692's loaded macOS batch (T-1692 evidence, macOS arm64 Node 24.21.0, about 17 of load, repetition 5 of 5). The error was `watch …/worktrees/crash: producer result missing; native cleanup retained` after 5.99 s. That cause comes from ref-push `observe` (hub/src/host/agent/ref-push.ts): no completed receipt was found while the producer's root had ended or its identity had changed. The earlier Linux failures (T-1684, T-1613's diagnostic runs) showed the bare-unknown form of this case. T-1684 fixed the ESRCH /proc race, and this is a different branch.

## What to build

Determine whether, after an agent SIGKILL, the push producer (`ref-push-worker`) can end before writing its completed receipt, or its receipt write can lose a race with recovery's first observation. Name the cause with a reproduction, for example a held receipt write or a delayed worker exit. Fix it in the product: a producer that completes must leave a durable completed receipt before it ends, or recovery must wait for that receipt. A truly missing result stays fenced and named. Never weaken the fence or the assertion.

## Acceptance criteria

- [ ] C1. The failing order (producer end versus receipt write versus recovery observation) is named with a deterministic reproduction (test, red before the fix).
- [ ] C2. After the fix, host-push-on-ref-move passes 10/10 under heavy CPU load on macOS and in a Linux container run with `docker run --init`, with fences and assertions unchanged (evidence).

## Comments

### coord · 2026-11-05T23:06:44.918Z

Promoted to E-1532 stage 6 (coord, 2026-11-06). The hub flagged it as a shared defect: it now reds item verifies on unrelated items. T-1614's verify c0f68bd2 at 8370003e (A-16963, Linux x64) had 4900 passed and its only failure was this case, "killed producer without result stays named and fenced…", with `producer result missing; native cleanup retained`. Earlier hits: T-1613's 6380ee28 (A-16761), dev-t3 A-16807, and the macOS load proof A-16903. It is the remaining branch after T-1684 fixed the ESRCH race.
