---
id: T-1673
kind: task
title: orphan-servers 'a sweep during a slow launch' found its OpenCode server still alive right after sessions.stop on a Linux dev-t3 run
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by: []
topic: topic-1386
branch: t/T-1673-orphan-servers-a-sweep-during-a-slow
created: 2026-11-04T10:12:59.157Z
updated: 2026-11-05T01:59:21.592Z
---

## Summary

The periodic dev T3 run b2955dfd at e15ecc71 (log A-16549, Linux x64 c-8 nyc1, peak load 6.1), after T-1607 landed, failed `hub/test/orphan-servers.test.ts` "a sweep during a slow launch preserves its server before the process row is published" at line 428. The failing check is `assert.equal(pidAlive(candidate.process.pid), false)` right after `await project.sessions.stop('impl')`: `true !== false` after 5.72 s.

The case passed in A-16454, A-16491, A-16515, A-16527 and the T-1607 batch A-16530. coord ran it 5/5 alone on macOS at 6a3d5b68 (tracker-only after e15ecc71). The test file has been unchanged since 2026-10-23. T-1607 changed the session stop path (adopted-worker settlement), so a rare regression where `sessions.stop` resolves before the local OpenCode server has died is not ruled out.

## What to build

Determine whether `sessions.stop` can resolve while a local OpenCode server is still alive. If it can, make stop resolve only after confirmed death. If the test itself races, make it wait for the server's death through the product's own exit observation; never through a weaker assertion.

## Acceptance criteria

- [ ] C1. The cause is named with a deterministic reproduction, or 20/20 Linux runs under load show no recurrence (evidence).
- [ ] C2. After `sessions.stop` resolves for a local OpenCode session, its server PID is dead (test, unchanged assertion).

## Comments

### coord · 2026-11-04T10:16:48.551Z

The hub's own failing-file rerun 8c83ee46 (log A-16550, Linux x64 c-8 nyc1, at the same head e15ecc71) passed the whole `orphan-servers.test.ts` file: 17 passed, 1 skipped, 0 failed. Together with coord's 5/5 on macOS, this classifies the failure as intermittent under load; it stays open for cause.

### coord · 2026-11-05T00:40:50.841Z

Recurrence 2 (coord, 2026-11-05 00:41Z): periodic dev T3 run 94141cff at e22d02c7 (log A-16739, Linux droplet, after T-1678 and T-1610 landed) failed the same test at line 428: `true !== false` after 5.81 s, so the OpenCode server pid was still alive right after `sessions.stop('impl')`. No other failures in that run. The same shape as A-16549 twice now suggests a missing wait for server death in the stop path, or in the test's check, rather than random load. T-1678's stop convergence is now on dev, so the stop path is a good place to start looking.

### coord · 2026-11-05T00:46:15.674Z

The hub's failing-file rerun 8803a762 at the same head e22d02c7 (log A-16740, Linux droplet c-8 sfo2, peak load 1.8) passed the whole orphan-servers file: 17 passed, 1 skipped. This is the same pattern as recurrence 1: red under full-suite load (peak 6.0), green alone. It stays intermittent under load, with a likely missing wait for death; planned for E-1532 stage 5 once T-1666 lands.
