---
id: T-1768
kind: task
title: projectHub T2 fixtures reach native sysctl through the default lock identity
state: open
status: in progress
size: S
criterion_seq: 2
labels: []
assignee: null
parent: E-1882
blocked_by: []
topic: topic-1557
branch: t/T-1768-projecthub-t2-fixtures-reach-native
created: 2026-11-09T06:56:35.201Z
updated: 2026-11-16T14:52:20.073Z
---

## Summary

A T2 test that starts `projectHub` without an explicit `lockIdentity` reaches native `child_process.execFileSync`, along the chain `fixtureLockIdentity` (`hub/test/harness.ts:462`) → `lockHostIdentity` → `sysctl`. The T2 tier tripwire forbids that, and its enforce-mode probe catches it. Found by impl-1751 during T-1751 (2026-11-09). T-1751 injects a fixture identity only in its own cases.

## Acceptance criteria

- [ ] C1. `projectHub` under T2 defaults to a fixture lock identity with no native process call; native identity stays opt-in for T3 (test).
- [ ] C2. An enforce-mode tripwire run over the projectHub-based T2 files reports no native process call from projectHub's own default hub lock path (lock identity or process-start probe); other native calls the run finds are recorded in an artifact for a follow-up item (test).

## Comments

### coord · 2026-11-09T06:56:47.853Z

Probable cause (coord): `fixtureLockIdentity` falls back to native `sysctl` when `CLAND_TEST_LOCK_IDENTITY` is unset, and the suite runner sets that variable. impl-1751's probe was a direct `node -e` run outside the runner. This looks like the same direct-run class as T-1766 (project-probes); see also T-1640. Triage could fold both into one fix: test files fail loudly, or self-provide the runner env, when run directly.

### coord · 2026-11-09T06:59:01.530Z

A second producer of the same class, found by impl-1751 (T-1751): a projectHub restart in T2 runs Dispatcher startup sweep → DropletExecutor.sweep → sweepProjects → spend.locked → acquireLockWithRetry → native processStartedAsync, because the droplet executor's dependencies.processes is absent. projectHub takes droplet dependencies separately from hub options.processes. T-1751 injects droplet.processes in its own fixture. A shared fix would default both fixture facts under T2.

### impl-1768 · 2026-11-16T14:43:08.879Z

Red captured before fix on macOS, Node 24.21.0, direct project-probes.test.ts: new standalone fixture test persisted actual host identity instead of fixture-host/fixture-boot; existing child census failed with actual { execFileSync: 1 }, expected {}. No suite run. Fix keeps runner-provided identity but standalone fallback is synthetic; explicit lockIdentity: 'native' is the T3 opt-in (nativeProjectHub sets it). Production files untouched.

### impl-1768 · 2026-11-16T14:47:58.862Z

Rule 20 consumer sweep searches projectHub/nativeProjectHub/fixtureLockIdentity/CLAND_TEST_LOCK_IDENTITY/lockHostIdentity across production, hub/nvim/web tests (T3/T4 included), helpers, scripts, shipped skills, docs and QA briefs. Full per-file inventory staged for artifact. Native wrapper callers now opt into lockIdentity:'native' centrally; release's probes:'native' fixture and worktree-cli's native status/start fixtures opt in explicitly; task-migrate and telegram-polling-restart already inject lockHostIdentity(). Doctor helper uses shared fixtureLockIdentity. Other embedded fixtures retain fixture identities; production identity readers and wire shapes unchanged.

### impl-1768 · 2026-11-16T14:52:09.620Z

Complete per-file rule 20 sweep published as A-20184 (use the complete consumer sweep artifact in topic-1557; earlier malformed inventory artifacts archived). Native wrapper callers grouped by tier, plus explicit identity controls and fixture-default/unchanged reader consumers. Production, scripts, skills, docs and QA briefs included.

### impl-1768 · 2026-11-16T14:52:20.073Z

Inventory artifact id correction: A-20185, durable path /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20185-t-1768-complete-consumer-sweep-by-tier-and-identity-choice.md.
