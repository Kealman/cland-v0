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
updated: 2026-11-05T20:41:35.684Z
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

- [x] C1. For each of OpenCode, Codex and Claude, a new generation with the same sessionId and the same host-local URL never reuses the old generation's connection, forward or watch (test).
  - done: impl-1696 · 2026-11-05T20:01:18.283Z
- [ ] C2. Releasing an unreachable generation sends no signal and makes no Host call to its host, drops its transport, forward, watch and in-flight state, and cannot affect a running new generation with the same id (test, with a held old cleanup racing the new launch).
  - failed: rev-35 [reviewer] · 2026-11-05T20:05:35.545Z · note Captured forwards have no consumable positive cleanup receipt after their transport successfully stops and unregisters.
- [ ] C3. Same-host resume and the existing stop, settle and revoke behaviour are unchanged: the existing adapter and session tests pass with no test edited.
  - failed: rev-35 [reviewer] · 2026-11-05T20:41:35.684Z · note Configured 30a5d709 fails five unchanged bridge/Host preservation cases; T2 exits 1 and later tiers do not run.

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

### rev-35 · 2026-11-05T19:50:28.033Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1696-source-2
commit: 33f931c6fb3988042e7b787922efcf8e931b7e58
scope: full
findings: [{"severity":"high","text":"Spec: every found resume aliases the result into the old scope, including the Codex/OpenCode fallback that positively stops the old native worker and starts a fresh birth/startedAt. Old identity aliases then select the scope containing the new live connection/watch; releasing the captured old row fences and detaches the new generation. Distinguish true same-generation observations from fresh native launch and give the latter an independent scope.","file":"hub/src/adapters/generation-adapter.ts","line":165},{"severity":"medium","text":"Spec: detach drops adapter forward references but leaves their actual SshTransport #forwards entries/socket obligations intact. Reconnect replays those entries (transport/ssh.ts:265), so released generations retain transport-owned forwards. Require a positive local transport-inventory release receipt without a lost-host operation, preserve failures, and cover detach/reconnect against the real transport owner for both forwarded adapters.","file":"hub/src/adapters/opencode.ts","line":1017}]
finding_counts: {"high":1,"medium":1,"low":0}

Corrected full source not clear; A-16918 separates standards/spec review and checks the ten initial repairs. Two remaining ownership gaps: unconditional found-resume aliasing across a fresh native launch, and missing local SSH transport forward-inventory release. Both confirmed by lead; corrections need fresh review before configured verification. C3 remains unverified while preservation/load evidence is incomplete. Existing tests unedited, ordered teardown/docs fixed, no Reviewer execution.

Criteria: C1 failed (A found resume that actually starts a fresh native worker remains aliased into the old generation scope.), C2 failed (Old-row release can detach a fresh resumed generation, and released forward entries remain in SSH transport's reconnect inventory.).

### rev-35 · 2026-11-05T20:05:35.545Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1696-source-3
commit: f262006279b49ad21554cb0cde2a79277df08cd6
scope: full
findings: [{"severity":"medium","text":"Spec: nonempty captured forward IDs cannot be released after their transport successfully stops and unregisters. SshTransport.stop positively removes local forwards then deletes the registry entry, but no owner-bound completion receipt survives; dropHostForwardsLocal therefore throws cleanup unavailable and strands a removed host's generation handoff. Preserve/consume the exact successful local-cleanup receipt, while unknown IDs or incomplete stop remain refused.","file":"hub/src/transport/transport.ts","line":35}]
finding_counts: {"high":0,"medium":1,"low":0}

A-16925 records full corrected source review. The prior fresh-resume alias and active transport-inventory findings are addressed within Coordinator 107dde4a/fabe5a96 scope. One remaining medium gap: successful stop drops its registry owner without preserving a receipt for later generation release, which then refuses despite confirmed cleanup. Lead confirms a3049bd4; require exact stopped-owner receipt rather than treating arbitrary absence as closure. C1/C3 remain unverified pending preservation/load/configured evidence. No Reviewer execution.

Criteria: C2 failed (Captured forwards have no consumable positive cleanup receipt after their transport successfully stops and unregisters.).

### rev-35 · 2026-11-05T20:19:19.831Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1696-source-4
commit: 3c30df86137fcb3aeba8fee66adc7a87dc0ad8c2
scope: full
findings: [{"severity":"low","text":"Non-blocking follow-up under Coordinator 944290ce: stoppedOwners retains every successful carrier-stop owner and its forward-id set indefinitely; Sessions.#localForwardOwners and facade scope/identity indexes likewise retain old ownership entries. Define bounded retirement tied to outstanding generation obligations, preserving idempotence and conservative unknown-proof refusal. No demonstrated C1–C3 or T-1614 main-path failure; filing routed to Coordinator.","file":"hub/src/transport/transport.ts","line":26}]
finding_counts: {"high":0,"medium":0,"low":1}

Source clear under Coordinator 944290ce bar; A-16928 records full standards/spec review. Captured carrier UUID and positively unlinked stopped-owner receipts address the remaining main-path blocker; missing/replaced/unknown proof still refuses without wrong-owner effects. Prior generation routing/fences/drains remain corrected. One low receipt/index-retention follow-up is routed to Coordinator for filing, no blocking finding. C1–C3 remain unverified pending full final-head preservation, macOS/Linux 5/5 and configured exact-head proof. Prior f262 335/335 is explicitly predecessor evidence. No Reviewer execution.

### rev-35 · 2026-11-05T20:21:09.176Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1696-delta-source-1
commit: 8022dfd8418c57fd7c411d0cdc3b11ef4948c45d
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Delta source clear; A-16929 records the only changed file, tiers.json. Two generation entries moved into lexical order; parsed values and T2/T3 assignments identical. Runtime/test/assertion source unchanged from clear 3c30df861. Prior non-blocking retention follow-up now T-1700 under C-216, filed by Coordinator. Previous verify attempt stopped at preflight with no suite/droplet; C1–C3 remain unverified pending exact required receipts. No Reviewer execution.

### rev-35 · 2026-11-05T20:22:59.159Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1696-evidence-1
commit: 8022dfd8418c57fd7c411d0cdc3b11ef4948c45d
scope: evidence
findings: [{"severity":"medium","text":"Configured verification 7ce94a62 exits 1 in T0: dictionary membership must use Object.hasOwn or Map.has. No droplet or runtime phase executed; runtime counts unavailable. Correct task-source lint and obtain fresh source review before rerun.","file":"hub/src/adapters/generation-adapter.ts","line":163}]
finding_counts: {"high":0,"medium":1,"low":0}

A-16931 records the actual A-16930 failure apart from the suite status. T0 host check failed before droplet creation; all runtime/Web tiers unexecuted, projections not evidence. No runtime criterion failure inferred; C1–C3 remain unverified. This enforced static refusal is separate from the lifecycle-edge bar. Lead acknowledged correction; changed pin requires delta source review. No Reviewer execution.

### rev-35 · 2026-11-05T20:24:29.423Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1696-delta-source-2
commit: 7e77d748d09abbe721f4fb7a35ad52548682f4ef
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Delta source clear; A-16932. Sole change uses Object.hasOwn for the guarded process-row discriminator, correcting enforced T0 membership lint while preserving own-field captured-row routing. No assertion or ownership/cleanup changes. Lead reports full local check exit 0; no Reviewer execution. Failed 7ce94a62 remains T0-only with no droplet/runtime proof. C1–C3 remain unverified. T-1700 stays the non-blocking retention follow-up.

### rev-35 · 2026-11-05T20:41:35.684Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1696-evidence-2
commit: 7e77d748d09abbe721f4fb7a35ad52548682f4ef
scope: evidence
findings: [{"severity":"medium","text":"A-16934 records two stale-bridge invalidation failures (1 !== 0) and old-job closure misclassified as bridge-closed instead of bridge-stale-closed at :335.","file":"hub/test/human-hold.test.ts","line":307},{"severity":"medium","text":"A-16934 records expired bridge respawn failure: presence never showed impl, with repeated earlier-launch refusal; actual runtime failure, not advisory timing.","file":"hub/test/mod-bridge.test.ts","line":117},{"severity":"medium","text":"A-16934 records local Host strict-reference compatibility failure: same structure but not reference-equal.","file":"hub/test/session-host.test.ts","line":23}]
finding_counts: {"high":0,"medium":3,"low":0}

A-16937 independently records the five actual errors and named outcomes. C3 not clear under Coordinator 944290ce criterion-failure bar. T0/T1 passed, T2 failed; T3/T4/Web unexecuted. Aggregate and completed-before-interruption counts differ and are retained separately, not combined. No shared/timing classification or automatic retry. Keep preservation tests unchanged; changed fix requires source review. C1/C2 remain unverified. No Reviewer execution.

Criteria: C3 failed (Configured 30a5d709 fails five unchanged bridge/Host preservation cases; T2 exits 1 and later tiers do not run.).
