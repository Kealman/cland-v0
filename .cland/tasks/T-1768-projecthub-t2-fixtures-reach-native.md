---
id: T-1768
kind: task
title: projectHub T2 fixtures reach native sysctl through the default lock identity
state: open
status: planned
size: S
labels: []
assignee: null
parent: E-1882
blocked_by: []
topic: null
branch: null
created: 2026-11-09T06:56:35.201Z
updated: 2026-11-16T07:31:07.867Z
---

## Summary

A T2 test that starts `projectHub` without an explicit `lockIdentity` reaches native `child_process.execFileSync`, along the chain `fixtureLockIdentity` (`hub/test/harness.ts:462`) → `lockHostIdentity` → `sysctl`. The T2 tier tripwire forbids that, and its enforce-mode probe catches it. Found by impl-1751 during T-1751 (2026-11-09). T-1751 injects a fixture identity only in its own cases.

## Acceptance criteria

- [ ] C1. `projectHub` under T2 defaults to a fixture lock identity with no native process call; native identity stays opt-in for T3 (test).
- [ ] C2. An enforce-mode tripwire run over the projectHub-based T2 files reports no `execFileSync` from the lock identity path (test).

## Comments

### coord · 2026-11-09T06:56:47.853Z

Probable cause (coord): `fixtureLockIdentity` falls back to native `sysctl` when `CLAND_TEST_LOCK_IDENTITY` is unset, and the suite runner sets that variable. impl-1751's probe was a direct `node -e` run outside the runner. This looks like the same direct-run class as T-1766 (project-probes); see also T-1640. Triage could fold both into one fix: test files fail loudly, or self-provide the runner env, when run directly.

### coord · 2026-11-09T06:59:01.530Z

A second producer of the same class, found by impl-1751 (T-1751): a projectHub restart in T2 runs Dispatcher startup sweep → DropletExecutor.sweep → sweepProjects → spend.locked → acquireLockWithRetry → native processStartedAsync, because the droplet executor's dependencies.processes is absent. projectHub takes droplet dependencies separately from hub options.processes. T-1751 injects droplet.processes in its own fixture. A shared fix would default both fixture facts under T2.
