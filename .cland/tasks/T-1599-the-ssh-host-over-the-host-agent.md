---
id: T-1599
kind: task
title: The ssh Host over the host agent
state: open
status: in progress
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
updated: 2026-11-03T10:38:19.599Z
---

## Summary

The `ssh` Host implements every Host operation through its tunnel's agent client: spawn returns `exited` from `process-exited`, identity, alive and stop work by Linux identity, forward goes through the carrier, limitPolls is false, and its layout names the host's paths. The hub registers one for each host record and starts its tunnel. A spawn's environment is the agent's base environment plus the explicit additions, never the hub's own, with the deny-listed tokens dropped.

Hot files: `hub/src/host/ssh-host.ts` (new), `hub/src/adapters/index.ts`, `hub/src/hub/daemon.ts`, `hub/test/host-ssh-contract.test.ts` (new)

## Acceptance criteria

- [ ] C1. The Host contract suite passes on a fake host through the fake `ssh` stand-in (test).
  - failed: rev-35 [reviewer] · 2026-11-03T10:38:19.599Z · note Accepted-commit outcome, prepared worktree ownership/recovery and disconnected completion lifecycle are incomplete; descriptor-close behavioral row is skipped.
- [ ] C2. A spawn on a fake host carries none of the hub's own environment, and `DIGITALOCEAN_TOKEN`, the remotes' tokens and the project secret never reach it even when the caller passes them (test).
- [ ] C3. With fake hosts registered, the registry holds `local` and one `ssh` Host per record, a launch with `host: "f1"` reaches f1's agent, and `CLAND_TEST_HOSTS` still works (test).
  - failed: rev-35 [reviewer] · 2026-11-03T10:38:19.599Z · note Default supervisor path duplicates hub/hub, preventing fresh registered Host bootstrap without an override.
- [ ] C4. While a host's tunnel is down, its operations fail with a reason naming the host and the tunnel, and they never touch the hub's machine (test).
- [ ] C5. A row spawned on a fake host is alive only while its agent reports the recorded identity, and its stop signals only on that host (test).
  - failed: rev-35 [reviewer] · 2026-11-03T10:38:19.599Z · note stop reports true on root PID absence without observing retained descendants closed.

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
