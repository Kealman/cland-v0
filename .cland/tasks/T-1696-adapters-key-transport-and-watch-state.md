---
id: T-1696
kind: task
title: Adapters key transport and watch state by generation, with a no-signal handoff that releases an unreachable old generation (prefactor for T-1614)
state: open
status: in progress
size: M
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by: []
topic: topic-1396
branch: t/T-1696-adapters-key-transport-and-watch-state
created: 2026-11-05T19:05:29.327Z
updated: 2026-11-05T19:23:22.491Z
---

## Summary

T-1614 (relaunch elsewhere) starts a fresh native generation of a session on another host while keeping the same cland sessionId. The adapters key transport and in-flight state by the stable sessionId:
- OpenCode's `#connections` and `#forwards`, with `#connectTo` reusing a connection by URL alone;
- Codex's and Claude's watcher and in-flight maps.

A fresh launch on f2 can reuse f1's connection when the host-local URL matches. Cleanup of the old generation's forwards or watches can also race the new generation that shares the id. Found by impl-1614 before it touched adapter internals.

## What to build

Add a generation handoff to the adapter contract, used by T-1614:
- adapter transport, forward, watch and in-flight state is keyed by the generation (the launch generation or native identity), not by the sessionId alone;
- connection reuse requires the same generation, never the URL alone;
- an optional adapter hook releases an unreachable old generation: it drains and drops that generation's transport, forward, watch and in-flight work with no native signal and no Host call to the lost host, then reports what it dropped;
- the Sessions caller invokes the hook before starting the new generation and keeps the old generation's obligations (T-1613, T-1666) unchanged.

## Acceptance criteria

- [ ] C1. For each of OpenCode, Codex and Claude, a new generation with the same sessionId and the same host-local URL never reuses the old generation's connection, forward or watch (test).
  - failed: rev-35 [reviewer] · 2026-11-05T19:23:22.491Z · note Generation lookup omits native birth identity and can reuse a different generation's scope.
- [ ] C2. Releasing an unreachable generation sends no signal and makes no Host call to its host, drops its transport, forward, watch and in-flight state, and cannot affect a running new generation with the same id (test, with a held old cleanup racing the new launch).
  - failed: rev-35 [reviewer] · 2026-11-05T19:23:22.491Z · note Old-row lookup can replace current routing; detach does not fence metadata/settlement authority or join every admitted stop/recovery writer.
- [ ] C3. Same-host resume and the existing stop, settle and revoke behaviour are unchanged: the existing adapter and session tests pass with no test edited.
  - failed: rev-35 [reviewer] · 2026-11-05T19:23:22.491Z · note Whole-adapter partitioning changes shared Claude scheduling and failed-launch admission, bypasses installed public wrappers and masks close diagnostics.

## Comments

### impl-1696 · 2026-11-05T19:10:00.654Z

Rule 20 consumer sweep recorded in docs/evidence/T-1696-consumers.md: native map readers/writers, contract importers, recording/observer fakes, all tiers, skills and QA references. Optional internal hook preserves structural fakes and previous wire shapes. Existing preservation tests remain unchanged.

### impl-1696 · 2026-11-05T19:14:04.266Z

Forward-id sweep added to docs/evidence/T-1696-consumers.md: SSH Host, SshTransport map/reconnect/stop, status projections, survival fixtures, fake SSH and recording doubles. Transport IDs are opaque strings and not persisted by SshTransport; existing legacy ids remain accepted. New generation scope namespaces the adapter-created ids only.

### rev-35 · 2026-11-05T19:23:22.491Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1696-source-1
commit: 41d14980840c7731bb46717a01b1727089c416bf
scope: full
findings: [{"severity":"high","text":"Spec: identity() omits pid and pidIdentity. Distinct native births with the same stable id, host, harness and startedAt resolve to one adapter scope; releasing one fences the other. Use captured generation identity, with explicit aliases only for adapter-owned re-exec/resume updates.","file":"hub/src/adapters/generation-adapter.ts","line":59},{"severity":"high","text":"Spec: find() creates and bind()s an unseen old retained row, which overwrites current[sessionId]. releaseUnreachableGeneration(old) can therefore redirect id-only forget/unwatch away from a running new generation. Lookup/retained cleanup must not promote current routing.","file":"hub/src/adapters/generation-adapter.ts","line":67},{"severity":"high","text":"Spec / rules 25–26: scope.settlement globally reopens Host and callback authority for every old continuation during releaseHostGeneration, while nested adapterState.write is never fenced at all. A held old continuation can regain Host/native effects or overwrite stable-id metadata belonging to the new generation. Keep the unreachable scope permanently fenced and isolate explicitly authorized retained settlement.","file":"hub/src/adapters/generation-adapter.ts","line":105},{"severity":"medium","text":"Spec / rule 12: detach does not join already-admitted public Claude stops or settlementWriters, and all three detach implementations stop FailedLaunches timers without draining an active retry. released:true can precede owned continuation/writer completion. Track and join every admitted operation, including recovery/settlement, without acquiring new lost-host authority.","file":"hub/src/adapters/claude-code.ts","line":1314},{"severity":"medium","text":"Spec: constructing a whole Claude adapter for each generation also partitions the intentionally shared local config-directory discovery schedule, cache, agentsFlight and signed-out latch. Existing #directory/#agents policy requires local rows in the same directory to share that owner. Isolate generation state without duplicating directory scheduling.","file":"hub/src/adapters/claude-code.ts","line":292},{"severity":"medium","text":"Spec: routed get() ignores caller-installed public method overrides. Existing spawn wrappers supplying sealed fixture accountEnv, and forget wrappers injecting pruning faults, are bypassed. This breaks unedited preservation consumers in claude-code-remote, host-survival-native, host-revoke-native and others; preserve wrappers around routed public operations.","file":"hub/src/adapters/generation-adapter.ts","line":89},{"severity":"medium","text":"Standards / rule 12: raw t.after release+close does not run before tempProject directory cleanup. Register held release and adapter.close through beforeDirectories immediately after adapter construction, before watch/setup admission, so failure paths drain the old poll before root removal.","file":"hub/test/adapter-generation.test.ts","line":46},{"severity":"medium","text":"Standards / rule 16: both new test files lack their matching per-test guides and generated index entries. Document the recording-Host drain/fence boundaries and native forward lifecycle in their owning guides.","file":"hub/test/adapter-generation.test.ts","line":1},{"severity":"high","text":"Spec / C3: every spawn allocates a fresh adapter whose FailedLaunches registry is empty, bypassing the existing cross-launch assertAvailable(name) fence in Codex/OpenCode. An earlier failed launch still under cleanup no longer prevents a second native launch with that name. Check shared captured failed-launch admission before creating a fresh scope; keep preservation assertions unchanged.","file":"hub/src/adapters/generation-adapter.ts","line":91},{"severity":"low","text":"Spec / C3 diagnostics: the facade replaces detailed child close failures with a generic AggregateError message. Existing callers rendering String(error) lose the original cleanup reason. Preserve the original detail in the outward error while retaining structured causes.","file":"hub/src/adapters/generation-adapter.ts","line":85}]
finding_counts: {"high":4,"medium":5,"low":1}

Initial full source review not clear. A-16913 records separate standards/spec analysis for the eight core findings. Two additional lead-reported issues were independently confirmed before verdict and are included in findings: fresh scopes bypass shared FailedLaunches admission (Codex:981/1460, OpenCode:287/957), and generic close aggregation masks original error detail. Ten findings total: standards two medium; spec four high, three medium, one low. New held T2 teardown must use beforeDirectories; both owning test guides/index are missing at this pinned commit. Working-tree drafts are not reviewed. C1–C3 fail source review and remain unverified; preservation/configured/load evidence is incomplete, no Reviewer execution. Keep existing preservation tests unchanged and request fresh source review after correction.

Criteria: C1 failed (Generation lookup omits native birth identity and can reuse a different generation's scope.), C2 failed (Old-row lookup can replace current routing; detach does not fence metadata/settlement authority or join every admitted stop/recovery writer.), C3 failed (Whole-adapter partitioning changes shared Claude scheduling and failed-launch admission, bypasses installed public wrappers and masks close diagnostics.).
