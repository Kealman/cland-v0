---
id: T-1915
kind: task
title: T2 files whose native CLI reads the hub lock, and other native calls in T2 found by T-1768's census, need a tier or a hermetic seam
state: open
status: backlog
size: M
labels: []
assignee: null
parent: E-1882
blocked_by:
  - T-1768
topic: null
branch: null
created: 2026-11-16T15:13:39.720Z
updated: 2026-11-16T15:14:03.751Z
---

## Summary

T-1768's enforce-mode census of 239 projectHub-based T2 files (2026-11-16, topic-1557, findings artifact from impl-1768) found native calls that T-1768's fixture default does not remove. Ten files call the native CLI `status`/`start`, whose `readForeignHolder` → `lockHostIdentity` reads the real machine identity: config-reload-component, config-set, roles-component, hub-priority, hub-status-component, startup-ready-component, suite-protocol, suite-wait-metrics, merge-queue and auth-mode (users mode, to classify). Others: claude-code-schedule's upgrade-restart case reaches the lock through another caller, codex-remote's process-cleanup `execFileSync`, and host fixture lock probes. T-1768 keeps these files on an explicit native identity opt-in so they behave as on dev.

## What to build

For each file, decide and apply one of: move to T3 (it exercises native lock behaviour; add a duration allowance only if needed), or make its native dependency hermetic through a test seam that does not let a production hub take its lock identity from the environment (E-1538's two-hubs-one-lock guarantee stays intact). Remove the native opt-ins T-1768 added as each file moves.

## Acceptance criteria

- [ ] C1. Every listed file is either in T3 with its reason recorded, or passes an enforce-mode T2 tripwire run with no native process call (test).
- [ ] C2. The other census findings (claude-code-schedule lock caller, codex-remote process cleanup, host fixture lock probes) are each fixed the same way or filed with their stack (test).

## Comments

### coord · 2026-11-16T15:14:03.751Z

Source evidence from T-1768 (impl-1768, 2026-11-16): A-20205 lists every finding with file, case and stack, plus the 2 incomplete outcomes; A-20206 is the raw census of 239 projectHub T2 files under the enforce-mode tripwire (212 exit 0, 25 completed failing, 2 incomplete; not a green tier); A-20200 holds the standalone dev-versus-head comparisons without the tripwire.
