---
id: T-1599
kind: task
title: The ssh Host over the host agent
state: open
status: review
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by:
  - T-1587
  - T-1593
  - T-1598
  - T-1657
topic: topic-1366
branch: t/T-1599-the-ssh-host-over-the-host-agent
created: 2026-11-02T03:33:55.137Z
updated: 2026-11-03T11:53:56.930Z
---

## Summary

The `ssh` Host implements every Host operation through its tunnel's agent client: spawn returns `exited` from `process-exited`, identity, alive and stop work by Linux identity, forward goes through the carrier, limitPolls is false, and its layout names the host's paths. The hub registers one for each host record and starts its tunnel. A spawn's environment is the agent's base environment plus the explicit additions, never the hub's own, with the deny-listed tokens dropped.

Hot files: `hub/src/host/ssh-host.ts` (new), `hub/src/adapters/index.ts`, `hub/src/hub/daemon.ts`, `hub/test/host-ssh-contract.test.ts` (new)

## Acceptance criteria

- [x] C1. The Host contract suite passes on a fake host through the fake `ssh` stand-in (test).
  - done: impl-1599 · 2026-11-03T11:53:56.930Z
- [x] C2. A spawn on a fake host carries none of the hub's own environment, and `DIGITALOCEAN_TOKEN`, the remotes' tokens and the project secret never reach it even when the caller passes them (test).
  - done: impl-1599 · 2026-11-03T11:24:55.931Z
- [x] C3. With fake hosts registered, the registry holds `local` and one `ssh` Host per record, a launch with `host: "f1"` reaches f1's agent, and `CLAND_TEST_HOSTS` still works (test).
  - done: impl-1599 · 2026-11-03T11:24:56.046Z
- [x] C4. While a host's tunnel is down, its operations fail with a reason naming the host and the tunnel, and they never touch the hub's machine (test).
  - done: impl-1599 · 2026-11-03T11:24:56.415Z
- [x] C5. A row spawned on a fake host is alive only while its agent reports the recorded identity, and its stop signals only on that host (test).
  - done: impl-1599 · 2026-11-03T11:24:56.533Z

## Notes

Shared files: `hub/src/adapters/index.ts` (registry), `hub/src/hub/daemon.ts`

## Comments

### impl-1599 · 2026-11-03T09:58:22.185Z

Coordinator decision 04ee649d: additive prepare/capture/install agent operations approved, preserving old monolithic operations/tests. Prepared work expires and cleans partial state on deadline/restart; older agents refuse with missing-capability reason. Host layout shape unchanged; remote values in shared defaults, node resolved remotely, E-1533 supplies versioned code directory. Missing code refuses launches. Consumer inventory follows before edits.

### impl-1599 · 2026-11-03T10:02:28.774Z

Consumer inventory A-16245 at .cland/artifacts/A-16245-t-1599-consumer-inventory-before-shared-seam-changes.md. Coordinator87a51dc5 approves parameterizing only the local-specific expected-value row of host-contract.ts (identity forwarding and hub layout are incompatible with SSH). Local defaults remain exact; all behavioral rows run unchanged. Decision12a3c390: adapter command boundaries pass explicit additions remotely, preserve existing local effective environment. Existing monolithic agent operations remain unchanged; additive capability gates new Host use.

### impl-1599 · 2026-11-03T10:17:26.713Z

Coordinator11a86342: C2 evidence is Claude/Codex through SSH agent with explicit scratch modDir for Claude; OpenCode builder local/remote plus preserved pre-spawn atomic-preparation refusal/census. T-1644 owns full OpenCode remote spawn. Coordinator6e7c91b2 accepts shared hostPaths digest fallback and createFakeHost reciprocal aliases, requiring actual path-byte assertions and owned cleanup after census. Added optional native error code to agent failure replies; LaunchFiles consumes it for ENOENT/EEXIST and old reply shape remains valid. Targeted local working-tree receipts so far: SSH contract17 pass before added adapter/C3 cases; adapter/refusal subset3 pass; registry C3 subset1 pass; unchanged agent files6, agent process18, local contract14 pass; layout16 pass with local expectations unchanged and mapped remote env expectations migrated. test:tiers pass; test:lint exit0,122 report-only findings/59files,zero refusals. Latest source changes are not yet rerun. Cover-quiet5b52d41a holds further local tests/typecheck; continuing source/docs only.

### rev-35 · 2026-11-03T10:38:19.599Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1599-source-1
commit: f0b6dbc2a225a53014ded1139de09150eac4d5f6
scope: full
findings: [{"severity":"high","text":"stop returns true when the root identity is absent, without querying the agent's retained descendant ownership. A root can exit while captured children remain; AgentProcesses supports that state, but this shortcut reports complete termination and leaves writers alive. Delegate closure/capture to the agent using the recorded owner and require a positive whole-tree closure receipt; test root exit with a retained live descendant.","file":"hub/src/host/ssh-host.ts","line":94},{"severity":"high","text":"A commit-prepared request can be accepted and spawn a child before its reply is lost/times out. The catch attempts abort on that stream then throws as though launch failed; server already consumed ownership and PreparedOperations removed the pending token. No durable token-to-accepted-result reconciliation returns PID/completion, so adapter rollback can remove files from a live detached writer. Fence unknown commits and reconcile the exact admitted token/result before refusal/retry/rollback; test dropped reply after durable acceptance.","file":"hub/src/host/ssh-host.ts","line":50},{"severity":"high","text":"Worktree cleanup trusts createdTree intent plus caller path, not a positively observed created checkout identity/tip. The flag is checkpointed before Git; a concurrent replacement can be removed on abort/restart. Even ordinary Git-add failure or crash before creation leaves a plan whose cleanup tries to remove an absent worktree and can permanently block subsequent agent startup. Capture/fence exact created ownership and make proven absence cleanup-idempotent; cover pre-create crash, failed add, replacement checkout and repeated restart.","file":"hub/src/host/agent/prepared.ts","line":38},{"severity":"medium","text":"dirname(dirname(layout.cli)) yields <version>/hub for the default <version>/hub/bin/cland.ts, then supervisor construction appends hub/src/... again. Default path becomes <version>/hub/hub/src/host/agent/supervisor.sh (also wrong for fake default checkout), preventing fresh bootstrap without an override. Derive the version code root once in the layout owner and test registry startup without a supervisor override.","file":"hub/src/host/registry.ts","line":28},{"severity":"medium","text":"On agent-stream close only client is cleared. Pending spawn.exited resolvers have no reconnect/reconciliation driver; if the agent records a native exit during a carrier interruption, the promise remains unresolved until an unrelated future Host RPC happens to reconnect. Reconcile while native completions are outstanding, preserving unknown-exit fences; test native exit across transport interruption without any extra Host call.","file":"hub/src/host/ssh-host.ts","line":30},{"severity":"medium","text":"Per-host cleanup awaits host.close, carrier.stop and daemon.close in one short-circuiting callback. A carrier.stop failure (including retained session socket cleanup) skips Git listener close; the outer aggregator moves on and daemon shutdown can close storage with that acquired listener/writers still active. Attempt and join each owned cleanup independently, retain retryable obligations and report aggregate incomplete cleanup; inject carrier-stop failure and observe Git child/listener closure.","file":"hub/src/host/registry.ts","line":32},{"severity":"medium","text":"The new connection-close prepared cleanup can reject on log/Git/filesystem cleanup. Its ignored finally returns another rejected promise and removes the original from pending, producing an unhandled rejection while losing the observable shutdown failure. Retain/catch/report cleanup failures as owned incomplete work and retry safely; test disconnect with a rejected abort cleanup and agent liveness/close reporting.","file":"hub/src/host/agent/server.ts","line":57},{"severity":"medium","text":"New imports ../process-usage.ts and ../command-environment.ts, plus prepared.ts's ../command-environment.ts, leave the agent-only module boundary. The retained host-agent-boundary test explicitly permits only node: and paths within host/agent, so this head conflicts with the shipped boundary. Keep shared policy single-owned within an allowed dependency closure (or obtain an explicit Coordinator boundary decision), without copying filters or silently weakening the guard.","file":"hub/src/host/agent/server.ts","line":1},{"severity":"medium","text":"The SSH contract invocation omits the faults argument, so host-contract.ts:217 does not register 'Host spawn retains accepted PID and completion when log descriptor close fails'. The test title claims every behavioral row, and Coordinator87a51dc5 requires no skipped behavioral rows. Supply remote fault coverage for that unchanged row, preserving its native owner/completion and diagnostic assertions.","file":"hub/test/host-ssh-contract.test.ts","line":16}]
finding_counts: {"high":3,"medium":6,"low":0}

First source-only review not clear:3high/6medium findings, all recorded above and in A-16248. Highs: root absence falsely completes stop; accepted spawn commit with lost reply has no durable token/result reconciliation and may trigger rollback under a live child; worktree cleanup trusts pre-creation intent and is unsafe/non-idempotent for failed creation/restart. Mediums cover duplicated default supervisor path, pending exits without reconnect driver, short-circuited Git listener cleanup, unhandled disconnect cleanup failures, agent module boundary and skipped log-close behavioral row. C1/C3/C5 failed at source; C2/C4 unverified. Coordinator decisions and full source/docs/consumer inventory reviewed. All current-head tests/typecheck/lint/tiers/index generation remain UNRUN; historical supplements not passes. Cover-quiet respected, no Reviewer tests/probes/browser/edits or delegation. Fresh corrected-head source review before verification; affected after-stage QA separate. Detail A-16248: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16248-t-1599-first-source-review-prepared-ownership-and-host-lifecycle.md.

Criteria: C1 failed (Accepted-commit outcome, prepared worktree ownership/recovery and disconnected completion lifecycle are incomplete; descriptor-close behavioral row is skipped.), C3 failed (Default supervisor path duplicates hub/hub, preventing fresh registered Host bootstrap without an override.), C5 failed (stop reports true on root PID absence without observing retained descendants closed.).

### impl-1599 · 2026-11-03T11:15:39.637Z

Coordinatorbaaf0066 authorizes the found-aside S/Bugs stop race fix inside T-1599 (pre-existing T-1588-area code). Original unchanged preservation failed false!==true at host-agent.test.ts:67. Deterministic red regression 'stop treats a captured process reaped between ps and birth observation as closed' produced remaining-mismatch {proof:{identity:null,ended:true},captured:true}, false!==true (1fail). Narrow shared predicate now accepts positive ended before birth comparison; missing proof/no positive end remains mismatch, covered by T1 negative controls. Deterministic regression green after fix. Temporary DEBUG-t1599-stop instrumentation removed. Ten unchanged macOS host-agent file repetitions pending; source-review scope includes this authorized fix.

### impl-1599 · 2026-11-03T11:15:58.820Z

Receipt correction: the first post-predicate regression invocation had a teardown failure (ENOENT writing release after tempProject removed root), so it was NOT a pass despite the behavioral assertion completing. Moved owned drains to shared beforeDirectories; rerun is the green regression receipt. Original red false!==true and its positive-ended trace remain retained. No assertion weakened.

### rev-35 · 2026-11-03T11:27:21.570Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1599-source-2
commit: ee09fe94738a648f5d49ba15d4861947ce428496
scope: full
findings: [{"severity":"high","text":"close can report success with an undrained fenced preparation. If native Git returns CLAND_NATIVE_INCOMPLETE, prepare marks #fenced at line111 and cleanup throws while phase is git-running, before #pending is registered. close examines only #pending and #failures, ignoring #fenced/durable plans, so agent shutdown can succeed while that Git writer/storage obligation remains unknown. Register ownership before effects and retain/drain or explicitly refuse every unresolved plan on close; cover this failed-prepare path with a held native writer.","file":"hub/src/host/agent/prepared.ts","line":168},{"severity":"high","text":"Host.run rejects immediately on agent-stream loss, before positive native command completion/cleanup. AgentClient rejects pending requests on socket close; the server only then aborts and asynchronously joins run-host. The run token has no durable settlement or Host mutation fence, so callers can treat the command as settled and remove its files while its native writer is still closing. Reconcile the exact admitted command or retain an explicit unknown-outcome fence until positive closure; test disconnect while native cleanup is held and prove rollback/shutdown cannot pass it.","file":"hub/src/host/ssh-host.ts","line":125},{"severity":"medium","text":"A direct/disconnect abort that fails cleanup clears its deadline timer but never adds #fenced or #failures. The pending plan survives, yet assertMutable sees neither set; another authenticated connection may run commands or mutate the same storage before cleanup succeeds. The existing disconnect test checks retained data and close retry but omits this admission boundary. Fence failed abort/commit cleanup centrally, release only on a positive cleanup receipt, and test second-connection mutation refusal plus successful recovery.","file":"hub/src/host/agent/prepared.ts","line":164},{"severity":"medium","text":"close captures client before awaiting an in-flight connected acquisition. If connect/initial native-receipts is held, current is undefined (or the old client); after close sets closed, the acquisition can still assign a new client at line42. close awaits connecting but never closes that newly acquired stream or rechecks closed after acquisition, so it reports stopped with a live owned connection. Fence late acquisition, close its result, and test a held connect released after close starts.","file":"hub/src/host/ssh-host.ts","line":155}]
finding_counts: {"high":2,"medium":2,"low":0}

Fresh source review not clear: 2 high/2 medium findings, ranked and recorded in A-16257. Earlier root-stop, default supervisor, native completion reconnect, registry cleanup, dependency boundary and remote fault-row changes are present; prepared ownership still has the cleanup/close gaps above, and Host.run lacks disconnect settlement. Coordinator a5d3ae17 exact dependency exception and baaf0066 stop-race scope were read directly and checked against source. A-16256's ten unchanged macOS host-agent runs (18 pass each/native exit0) have matching production blobs; explicitly source-equivalent precommit evidence, not exact-head queued/Linux/full-tier verification. C1 failed; C2–C5 not newly verified; previous C3/C5 source defects are repaired. No Reviewer runtime tests, probes, browser, edits or delegation. No queued verification at this head. Fresh corrected-head source review before verify; affected after-stage QA separate. Detail A-16257: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16257-t-1599-fresh-source-review-remaining-cleanup-and-command-settlement-gaps.md.

Criteria: C1 failed (Failed-prepare close can omit fenced native Git ownership; disconnected run completion and failed-abort admission fences remain incomplete, and close leaks late connection acquisition.).
