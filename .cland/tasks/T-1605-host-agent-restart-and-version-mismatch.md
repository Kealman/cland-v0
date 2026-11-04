---
id: T-1605
kind: task
title: Host agent restart and version mismatch
state: open
status: review
size: M
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by:
  - T-1599
  - T-1604
topic: topic-1376
branch: t/T-1605-host-agent-restart-and-version-mismatch
created: 2026-11-02T03:33:56.605Z
updated: 2026-11-04T03:35:04.275Z
---

## Summary

The hub's agent client reconnects after the agent restarts and re-reads its table. When the hello reports a version other than the hub's, the hub delivers its own code to the host over the master and restarts the agent through the supervisor. Harnesses survive either restart.

Hot files: `hub/src/host/agent-client.ts`, `hub/src/host/ssh-host.ts`, `hub/src/host/code-delivery.ts` (new), `hub/src/host/agent/server.ts`, `hub/test/host-agent-restart.test.ts` (new)

## Acceptance criteria

- [x] C1. After `fake-host.ts kill-agent`, the hub's client reconnects within 5 s, re-reads the table, and every running row on that host stays running with the same identity (test).
  - done: impl-1605 · 2026-11-04T03:25:08.910Z
- [x] C2. A host agent reporting another version gets the hub's code delivered over the master and is restarted, and its next hello reports the hub's version (test).
  - done: impl-1605 · 2026-11-04T03:32:20.749Z
- [ ] C3. Processes the old agent spawned are in the new agent's table after a version restart, and none was signalled (test).
- [x] C4. Code delivery carries no secret and never writes outside the host's code directory (test).
  - done: impl-1605 · 2026-11-04T03:12:35.401Z

## Notes

Shared files: `hub/src/host/ssh-host.ts`; the agent protocol module (hello)

## Comments

### impl-1605 · 2026-11-04T03:03:24.821Z

Contract inventory before edits: hello consumers: AgentClient.connect; SshTransport probe/readiness; registry beforeReady; fake-host kill-agent; transport-contract-fixture old hello stub; host-agent, host-supervisor, host-agent-files, host-clone-integration, host-ssh-contract, remote-discovery-host tests; QA E-1532-stage-2/3 startup probes; implement skill T-1599 consumer notes. Table/processes consumers: agent server and AgentProcesses; host-agent and host-supervisor tests; SSH Host currently reads native-receipts only. No hello/table fields will be removed or required. Additive restart support will preserve protocol-1 hello without capabilities in AgentClient. Existing table semantics unchanged; reconnect will read it.

### impl-1605 · 2026-11-04T03:09:16.270Z

Implementation tree targeted macOS local evidence (not source reviewed; no full verification yet): host-agent-restart 3/3 pass, host-agent-boundary 2/2 pass on Node 24.21.0. C1 measured kill-agent to reconciled table under 5 s. Version-delivered standalone runtime starts outside repo, preserves agent-spawned process identity and signal log remains empty. C4 corrupt hash/escaping path rejected before selectable publication. C3 adopted generation case remains explicitly pending T-1607 landing + Coordinator-authorized merge. Running the six requested unedited preservation files sequentially now.

### rev-35 · 2026-11-04T03:20:25.186Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1605-source-1
commit: 2da33d3a823de1f0000a78290203cb4c63517c2f
scope: full
findings: [{"severity":"high","text":"The static typescript import reaches ordinary hub startup through registry.ts even though TypeScript is a devDependency; installed runtime-only hubs now require the development compiler even with no SSH hosts.","file":"hub/src/host/code-delivery.ts","line":6},{"severity":"medium","text":"Reconcile an already verified installed version before retrying delivery: loss after rename but before restart publication makes every later attempt fail on the occupied directory, leaving the old agent and accumulating staging copies.","file":"hub/src/host/code-delivery.ts","line":67},{"severity":"medium","text":"Do not prune the verifier used by the running supervisor: it always imports package.ts beside its original script, so current-plus-previous retention deletes that dependency after consecutive upgrades and blocks future replacements.","file":"hub/src/host/agent/supervisor.sh","line":46},{"severity":"medium","text":"Fence shutdown/quiesce before version delivery: a held connect returning a mismatched hello after close begins still invokes updateAgent and publishes a restart before the later closed check.","file":"hub/src/host/ssh-host.ts","line":48},{"severity":"medium","text":"Bind the new restart signal to the exact Linux birth identity: ps lstart has only second resolution, so equality can authorize a reused PID; retain fresh-child and stale/reused-birth no-signal controls.","file":"hub/src/host/agent/supervisor.sh","line":48},{"severity":"low","text":"Add matching per-test guides/index entries for the new restart and original-hello fixtures, including native writer ownership, completion boundaries, package isolation and the explicitly pending adopted-worker case.","file":"hub/test/host-agent-restart.test.ts","line":1}]
finding_counts: {"high":1,"medium":4,"low":1}

Initial source review not clear: one high, four medium, one low. High: dev-only typescript static import via registry breaks compiler-free installed startup. Medium: retry after installed rename cannot reconcile occupied version; retention prunes running supervisor verifier after consecutive upgrades; held connect can start update after close/quiesce; new SIGTERM proof uses second-resolution lstart rather than exact Linux birth. Low: add new fixture guides/index. Detailed traces/required boundary controls A-16464 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16464-t-1605-initial-source-review-startup-and-version-replacement-findings.md. C1/C2 failed; C4 unverified; adopted-worker C3 is explicitly pending per Coordinator39a66ce7/61eae5eb and not a finding. Scope includes agent-spawned C3 and named hook. No Reviewer runtime checks/probes/browser/edits/Git mutations/delegation; static findings not presented as executed reproductions. A-16460 and later reported123 local preservation passes remain supplemental, earlier interrupted timer run not pass. Fresh source review after repairs; configured verification still waits for T-1607 integration and final authorized delta source review.

Criteria: C1 failed (New unconditional dev-only TypeScript dependency reaches ordinary installed hub startup and prevents the production reconnect path from loading without development dependencies.), C2 failed (Version replacement lacks occupied-install reconciliation, can prune its active verifier, starts late delivery after shutdown and uses coarse restart signal identity.).

### rev-35 · 2026-11-04T03:29:11.037Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1605-source-2
commit: e0236c3d1f43b2be2d4eac90cb1c6d0193677d4f
scope: full
findings: [{"severity":"medium","text":"Use the production version-handoff owner instead of copying registry's delivered fence into the fixture; the immediately preceding 4-versus-3 failure demonstrates policy drift between these paths (rule24).","file":"hub/test/host-agent-restart.test.ts","line":55},{"severity":"medium","text":"Reconcile accepted restart publication and make same-version selection idempotent: a lost reply after writing restart can republish that version and signal an already-selected replacement again, without a new effect receipt.","file":"hub/src/host/agent/supervisor.sh","line":50}]
finding_counts: {"high":0,"medium":2,"low":0}

Repair source pass: six original A-16464 findings addressed, two medium findings remain. Use one shared production/fixture handoff owner instead of copied delivered policy (prior actual4!==3 drift retained). Make immutable version selection idempotent/reconcile lost accepted restart-publication reply; current fault tests lose install reply and fail before publication, leaving the distinct accepted-effect replay untested/unowned. Implementer confirmed both and is repairing. Detailed source traces A-16467 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16467-t-1605-repair-source-review-shared-handoff-and-accepted-publication-replay.md. No dev move, full scope. C2 failed; C1/C4 unverified; full adopted-worker C3 intentionally pending Coordinator39a66ce7/61eae5eb, not finding. 8a0a targeted12/13 stays failed; e023 focused pass/six-file123 reports supplemental local macOS Node24.21, not configured Linux/browser verification. Fresh source review after fixes; configured verify still waits for T-1607 integration/final authorized delta source pass. No Reviewer runtime checks/probes/browser/edits/Git mutations/delegation.

Criteria: C2 failed (Fixture duplicates the production handoff fence; lost accepted restart-publication replies can replay selection and signal a replacement again.).

### rev-35 · 2026-11-04T03:35:04.275Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1605-source-3
commit: c2ca734f8fe98c3ace2e6299cb060103d528b666
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Initial source scope clear, findings []. All A-16464/A-16467 findings addressed: compiler-free generated projection; idempotent verified install reuse/owned cleanup; advancing verifier/retention; exact native birth and lifecycle fencing; guides; one shared agentVersionHandoff used by registry and fixture; immutable already-selected no-signal receipt plus applied readiness checkpoint joined on shutdown. Fault controls retain lost install reply, pre-publication interruption, accepted-publication reply loss, explicit same-child replay receipt/hello and consecutive upgrades/no worker signals. Independently checked all24 closure source SHA-256 entries match pinned commit and six preservation files unedited. Candidate local macOS Node24.21 targeted10/10 report remains supplemental, not configured/current Linux proof; earlier8a0a12/13 stays failed. Details A-16471 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16471-t-1605-initial-source-clear-shared-version-handoff-and-idempotent-selection.md. C1–C4 unverified; full adopted-worker C3 intentionally pending, not finding. IMPORTANT Coordinator61eae5eb verification hold remains: T-1607 must land, Coordinator authorizes one dev merge, integrated head gets final delta source review, then configured verify. This initial clear is not final readiness or authorization to verify now. Affected after-stage QA separate. No Reviewer tests/probes/browser/edits/Git mutations/delegation.
