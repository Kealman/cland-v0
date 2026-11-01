---
id: T-1545
kind: task
title: OpenCode sessions through the Host
state: open
status: ready
size: S
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1531
blocked_by:
  - T-1544
topic: topic-1295
branch: t/T-1545-opencode-sessions-through-the-host
created: 2026-10-31T23:47:41.079Z
updated: 2026-11-01T17:42:59.206Z
---

## Summary

OpenCode's `opencode serve` spawn, its pid checks, its liveness on resume and its stop go through the session's Host, with launch, delivery and stop behaviour unchanged.

Hot files: `hub/src/adapters/opencode.ts`, `hub/src/adapters/opencode/server.ts`

## Acceptance criteria

- [x] C1. `opencode serve` is started by the Host's spawn with the same arguments, environment, working directory and log file as today (test).
  - done: impl-1545 · 2026-11-01T17:21:11.078Z
  - verified: rev-35 [reviewer] · run rev-35-1545-final-1 · 2026-11-01T17:42:58.711Z · commit 650c90c1816894e23995756832f2b6ea4574c436
- [x] C2. The adapter's poll, resume and stop use the Host's alive and stop for the row, and the adapter's own `process.kill` probe is gone.
  - done: impl-1545 · 2026-11-01T17:21:11.276Z
  - verified: rev-35 [reviewer] · run rev-35-1545-source-2 · 2026-11-01T17:23:25.039Z · commit 60874ec440b5a29a948deeb38821638c94137547
  - verified: rev-35 [reviewer] · run rev-35-1545-source-3 · 2026-11-01T17:24:24.482Z · commit 650c90c1816894e23995756832f2b6ea4574c436
  - verified: rev-35 [reviewer] · run rev-35-1545-final-1 · 2026-11-01T17:42:58.711Z · commit 650c90c1816894e23995756832f2b6ea4574c436
- [x] C3. A test with a recording Host shows one spawn per launch, with every liveness check and stop of an OpenCode row reaching that Host (test).
  - done: impl-1545 · 2026-11-01T17:21:11.646Z
  - verified: rev-35 [reviewer] · run rev-35-1545-final-1 · 2026-11-01T17:42:58.711Z · commit 650c90c1816894e23995756832f2b6ea4574c436
- [x] C4. The opencode-adapter and opencode-native test files pass with no test edited; in opencode-launch-policy only its cp.spawn fake may change, to emit `spawn` and an owned exit receipt the way a real child does, with every test body and assertion byte-identical (exception decided by the Coordinator 2026-11-01; the fake never modelled a child's lifecycle).
  - done: impl-1545 · 2026-11-01T17:05:33.103Z
  - verified: rev-35 [reviewer] · run rev-35-1545-final-1 · 2026-11-01T17:42:58.712Z · commit 650c90c1816894e23995756832f2b6ea4574c436

## Comments

### impl-1545 · 2026-11-01T07:12:58.219Z

Rule 20 consumer inventory before shared Host spawn extension: searched HostCommand, HostProcess, Host['spawn'], Host annotations, startServer, transaction.child, hostForLaunch/hostForProcess and direct spawn/probe names across hub/nvim/web/shared/qa and shipped skills. Production: host/local.ts is the sole Host implementation; sessions.ts owns lookup; launch-files.ts registers/rolls back children; opencode.ts and opencode/server.ts consume spawn/liveness/stop. Existing Claude/Codex native child registrations remain on child() unchanged (T-1546 will consume spawned()). Shared contract host-contract.ts (T3 wrapper host-local-contract.test.ts), host-contract-coverage.test.ts (T1), session-host.test.ts (T2), opencode adapter/native/launch-policy fixtures are consumers; no wire/persisted record changes. Existing spawn consumers destructure pid and are compatible with added required exited; logFile defaults to ignored stdio. Upcoming T-1552 fake Host must implement required exited; Coordinator notified and T-1546 given exact method signature. Docs: existing Host README and implement skill sections, per-test guides. No protocol older-hub regression needed: this is an internal injected interface, not a wire shape.

### impl-1545 · 2026-11-01T07:18:57.887Z

C4 fixture exception authorized by Coordinator decisions a0e3c455 and dc781da0: the launch-policy cp.spawn fake returned a synthetic already-exited child that emitted neither spawn nor exit, and threw on every ps query. It never modeled native admission/completion. Only its fixture changes: native ps passthrough with scratch-only env and impossible real PID 99999999, owned spawn/exit/kill/teardown receipts. All test bodies and assertions remain byte-identical; opencode-adapter and opencode-native remain byte-unedited. Will present this fixture diff separately in source review. All loaded-run receipts are diagnostic only; local heavy work is paused by Coordinator.

### impl-1545 · 2026-11-01T07:26:20.309Z

Implementation pushed at 2ca64564b; spawn seam remains aac95bc4f. C1–C3 marked done. Fresh macOS/local Node24.21.0 checks after resume: typecheck passed (start load4.77); test:lint exit0 with 0 refusals (start load4.98), existing report-only advisory findings retained. Serial targeted results: recording3/3, inventory2/2, native Host contract7/7, unedited native31/31, approved launch-policy fixture5/5. Unedited adapter18/21 has the three Coordinator-confirmed T-1547 positive-absence failures; C4 remains incomplete. No full suite/Web/browser run. Waiting on Coordinator-posted T-1547 merge before adapter rerun and first source review, as directed in 73fdab25.

### impl-1545 · 2026-11-01T17:06:06.604Z

Shared T-1547 fix merged. All C1–C4 now done at pushed b56bff55d. Serial macOS/local Node24.21.0 reruns (start loads2.26–2.84): unedited adapter21/21 (all three prior failures resolved), unedited native31/31, approved lifecycle fixture policy5/5, native Host contract9/9, inventory3/3, recording3/3; typecheck passed; test:lint exit0/0 refusals, advisory findings retained. Evidence A-15323; isolated fixture diff A-15222. New HostStopOptions authorization/log forwarding red/green preserves native signal boundary, spawn seam unchanged. Fresh fetch/merge up-to-date and merge-tree clean. First source review requested and routed to Reviewer rev-35 at exact b56bff55d; verification and final evidence review await clear source.

### rev-35 · 2026-11-01T17:08:16.559Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1545-source-1
commit: b56bff55da4049099959bb59a6eba8103af206b3
scope: full
findings: [{"severity":"medium","text":"close joins #pidCheck only; new resume/stream Host.alive/identity waits remain unowned and resume has no closed continuation fence. A held resume released after close can return running or relaunch after adapter release; disconnect liveness can schedule a timer after close. Join/fence all introduced Host flights and clean accepted launches inside their rollback boundary; add held close regressions.","file":"hub/src/adapters/opencode.ts","line":719},{"severity":"medium","text":"Authorization moved before Host.spawn's new awaited log open. Revoking authority during open(logFile) still permits unguarded native spawn in local.ts:50, whereas old authorization ran after open immediately before spawn. Revalidate at the actual Host native-spawn boundary and test held-open revocation with zero child launch.","file":"hub/src/adapters/opencode/server.ts","line":125},{"severity":"medium","text":"Successful spawn PID/exited publication waits for finally output.close(). If descriptor close rejects after spawn, Host.spawn rejects before LaunchFiles.spawned receives the PID; rollback removes launch files while the unowned native job remains. Preserve ownership across this failure or stop/drain the captured native child before rejecting; fault-inject close failure.","file":"hub/src/host/local.ts","line":55},{"severity":"low","text":"'poll completed' waits for calls.length, an attempt receipt recorded before Host.alive resolves; it does not prove the poll continuation settled. Observe an explicit completion/behavior receipt, preserving final routing assertions.","file":"hub/test/opencode-host.test.ts","line":28},{"severity":"low","text":"The new rollback control awaits stopReceipt without a setup bound, so a missing stop call hangs until a broad runner timeout. Bound setup separately and retain final file/ownership assertions.","file":"hub/test/opencode-host.test.ts","line":91}]
finding_counts: {"high":0,"medium":3,"low":2}

Source not clear: three medium lifecycle/ownership findings and two lows, detailed in attached source artifact. close only drains poll; resume/stream Host waits need joins/fences and accepted-launch rollback. authorize moved ahead of async log open; restore native-boundary guard. Post-spawn output.close rejection currently prevents PID ownership publication. Tests must observe poll completion and bound rollback stop setup. Host routing/argv/env/cwd otherwise match scope; approved fixture-only exception respected. No Reviewer execution; no full verification yet. Fix/shared-contract changes need fresh source review before verify.

Criteria: C1 failed (Host spawn crosses async log preparation without final authorization and loses native ownership if descriptor close fails.), C2 failed (New resume/stream Host observations can outlive close and resume continues after adapter release.), C3 failed (Recording coverage lacks held lifecycle/fault controls; poll attempt count is not completed-boundary evidence.).

### impl-1545 · 2026-11-01T17:16:31.903Z

Review rev-35-1545-source-1 not clear; fixing A-15326 before any verification. Coordinator approved additive HostSpawnOptions.authorize in d730f108, preserving logFile/exited. Consumer delta: local Host invokes new callback after async log preparation; server passes it; shared contract/coverage inventories and test factories migrate; future SSH returns to hub between open and spawn. Existing spawn consumers omit optional options unchanged. Added held resume alive/identity, stream, accepted-spawn durable rollback, log-open revocation and native close-fault controls. Exact red output: close-before-completion true!==false; final-authority Missing expected rejection; synthetic log close failure; durable accepted-launch stop receipt not within15000ms. Targeted controls green after fixes; regression/static reruns pending.

### rev-35 · 2026-11-01T17:23:25.039Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1545-source-2
commit: 60874ec440b5a29a948deeb38821638c94137547
scope: full
findings: [{"severity":"low","text":"A duplicated stale line still requires 'all seven' passing receipts even though this wrapper now registers eleven. Remove the stale duplicate and retain the preceding 'all passing receipts' requirement so the new authority/fault cases cannot be omitted.","file":"docs/agents/tests/hub-test-host-local-contract.test.ts.md","line":28}]
finding_counts: {"high":0,"medium":0,"low":1}

Fresh source clear; no high/medium findings. All prior lifecycle/authority/ownership and test-receipt findings resolved. Tracked operation scopes fence/join close and retain late accepted LaunchFiles through rollback/native completion, including durable incomplete ownership; stream backoff aborts. Coordinator-approved optional authorize runs after log prep at native spawn; close fault logs diagnostic without hiding PID/exited. Native fault hook independently stops/joins even on red. C2 source verified; C1/C3/C4 pending same-head mode-free run and named fixed-head receipts. C4 exception remains fixture-only. Standards low: guide:28 duplicate 'all seven' stale versus eleven cases; retain preceding all-receipts rule. Spec no findings. No Reviewer execution; QA after-stage separate.

Criteria: C2 verified.

### rev-35 · 2026-11-01T17:24:24.482Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1545-source-3
commit: 650c90c1816894e23995756832f2b6ea4574c436
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Fresh source clear; Standards/Spec no findings. Entire difference from60874ec4 is guide signature expected?/faults? and deletion of stale duplicate all-seven line, resolving sole low. Runtime/tests unchanged; full source reviewA-15328 carries forward. C2 verified; C1/C3/C4 await this exact head's queued verification and named native preservation/contract outputs. No Reviewer execution; after-stage QA separate.

Criteria: C2 verified.

### rev-35 · 2026-11-01T17:42:58.712Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1545-final-1
commit: 650c90c1816894e23995756832f2b6ea4574c436
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; Standards/Spec no findings. Same-headA-15336/0e49993a exit0,4616pass,zero fail/cancel/skip/todo. Named recording9/inventory4/Host-contract11/native31/policy5 outcomes pass, including all held close/authority/fault receipts and wrapper attribution. A-15331 supplies exact-head local macOS Node24.21.0 named adapter21 plus native31/policy5/contract11,native exits0,no browser. C4 unchanged adapter/native and fixture-only policy exception retained. Remote Linux x64 droplet Node24.21.0,Neovim0.12.5,isolated Headless Shell1248/Chrome Testing156.0.8078.4; no cache/skips. T0/T1/all fallback T2/selected T3/Web complete; remaining T3/T4/full integrated unexecuted,report-only advisories retained. C1–C4 verified. No Reviewer execution; after-stage QA and merge batch separate.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.
