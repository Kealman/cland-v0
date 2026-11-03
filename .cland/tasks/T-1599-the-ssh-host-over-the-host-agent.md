---
id: T-1599
kind: task
title: The ssh Host over the host agent
state: closed
status: done
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
updated: 2026-11-03T22:04:33.508Z
closed: 2026-11-03T14:31:07.839Z
---

## Summary

The `ssh` Host implements every Host operation through its tunnel's agent client: spawn returns `exited` from `process-exited`, identity, alive and stop work by Linux identity, forward goes through the carrier, limitPolls is false, and its layout names the host's paths. The hub registers one for each host record and starts its tunnel. A spawn's environment is the agent's base environment plus the explicit additions, never the hub's own, with the deny-listed tokens dropped.

Hot files: `hub/src/host/ssh-host.ts` (new), `hub/src/adapters/index.ts`, `hub/src/hub/daemon.ts`, `hub/test/host-ssh-contract.test.ts` (new)

## Acceptance criteria

- [x] C1. The Host contract suite passes on a fake host through the fake `ssh` stand-in (test).
  - done: impl-1599 · 2026-11-03T12:47:09.263Z
  - verified: rev-35 [reviewer] · run rev-35-1599-final-1 · 2026-11-03T13:13:04.794Z · commit 63e8f8296016e4dc06c64143854cb7f09065b97a
- [x] C2. A spawn on a fake host carries none of the hub's own environment, and `DIGITALOCEAN_TOKEN`, the remotes' tokens and the project secret never reach it even when the caller passes them (test).
  - done: impl-1599 · 2026-11-03T11:24:55.931Z
  - verified: rev-35 [reviewer] · run rev-35-1599-final-1 · 2026-11-03T13:13:04.794Z · commit 63e8f8296016e4dc06c64143854cb7f09065b97a
- [x] C3. With fake hosts registered, the registry holds `local` and one `ssh` Host per record, a launch with `host: "f1"` reaches f1's agent, and `CLAND_TEST_HOSTS` still works (test).
  - done: impl-1599 · 2026-11-03T12:22:50.411Z
  - verified: rev-35 [reviewer] · run rev-35-1599-final-1 · 2026-11-03T13:13:04.794Z · commit 63e8f8296016e4dc06c64143854cb7f09065b97a
- [x] C4. While a host's tunnel is down, its operations fail with a reason naming the host and the tunnel, and they never touch the hub's machine (test).
  - done: impl-1599 · 2026-11-03T11:24:56.415Z
  - verified: rev-35 [reviewer] · run rev-35-1599-final-1 · 2026-11-03T13:13:04.794Z · commit 63e8f8296016e4dc06c64143854cb7f09065b97a
- [x] C5. A row spawned on a fake host is alive only while its agent reports the recorded identity, and its stop signals only on that host (test).
  - done: impl-1599 · 2026-11-03T11:24:56.533Z
  - verified: rev-35 [reviewer] · run rev-35-1599-final-1 · 2026-11-03T13:13:04.794Z · commit 63e8f8296016e4dc06c64143854cb7f09065b97a

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

### rev-35 · 2026-11-03T11:55:07.482Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1599-source-3
commit: 947ae5c3ceb9784021d4c3c300a5fb0ff9ec6625
scope: full
findings: [{"severity":"high","text":"Unknown native Git ownership is durably marked git-running only in prepare's catch (line117). If validateCheckout or cleanupCheckout reports CLAND_NATIVE_INCOMPLETE during commit, abort, or recovery cleanup, those paths retain prepared/committing and subsequently retry cleanup/Git (commit even calls #cleanup immediately after the failed inspection). A failed worktree removal can therefore still be writing metadata while close, settle or restart launches another cleanup/removal against it. Centralize durable transition to the unjoined-writer fence at every Git inspection/mutation boundary and require positive writer closure before retry; add held-writer commit/abort cleanup and restart regressions.","file":"hub/src/host/agent/prepared.ts","line":156},{"severity":"medium","text":"runCommand saves an accepted command result without enforcing the wire byte cap. A command producing stdout/stderr above MAX_LINE_BYTES finishes natively and is persisted, but server.ts:137 rejects both its original reply and every later settle-prepared reply as 'agent result exceeds frame cap'. SSH Host catches those errors and retries settlement forever, permanently fencing mutations despite a known completed command. Persist a bounded terminal representation or another retrievable bounded result and test oversized output reaches an explicit finite outcome with its native exit facts preserved.","file":"hub/src/host/agent/prepared.ts","line":196}]
finding_counts: {"high":1,"medium":1,"low":0}

Source review 3 not clear: 1 high/1 medium, detailed in A-16262. The four A-16257 repairs are present, but native incomplete classification is not durably consumed by every cleanup path, and accepted command results can exceed the settlement wire cap. C1 failed; C2–C5 not newly verified. Entire production/test/docs repair delta inspected; prior authorized boundary/stop predicate remain intact. A-16256's production blobs still match, with its source-equivalent precommit macOS limits retained. Implementer filtered/local checks are not queued or complete-tier evidence; exact-head checks still running, no verify/Linux/Web/browser/QA receipt yet. No Reviewer runtime tests, probes, file edits, browser or delegation. Fresh corrected-head source review required before verify. Detail: A-16262 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16262-t-1599-source-review-durable-git-fences-and-bounded-command-settlement.md.

Criteria: C1 failed (Commit/abort/recovery paths can retry an unjoined native Git writer; oversized accepted command output cannot cross the reply cap and settlement waits forever.).

### impl-1599 · 2026-11-03T12:00:42.486Z

A-16262 repairs are implemented in the working tree. Every prepared Git boundary now durably records git-running before native inspection/mutation, restores only after joined completion, and retains unknown fences across commit/abort/settle/close/restart. Native-boundary regressions hold observed writers for commit inspection, abort removal and restart removal. Red: commit launched 2 writers instead of 1; green selected 3/3 and full host-prepared 12/12 on local macOS Node v24.21.0. Oversized durable command results preserve code plus bounded diagnostic tails and an explicit cap error before persistence; direct and lost-reply SSH regressions pass 2/2 after red bounded-settlement timeout. These are precommit targeted receipts, not queued verification or Linux coverage. Full SSH file and typecheck follow before corrected-head review.

### rev-35 · 2026-11-03T12:05:07.042Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1599-source-4
commit: 83428a67a4185a56aaf54d45c2e20edef78a7121
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, no findings. A-16262 repairs checked: every prepared Git boundary checkpoints and retains unknown-writer ownership across commit/abort/cleanup/restart; terminal durable command results are bounded before persistence and retrieved by original/settlement replies with native code and explicit diagnostic tails. Held-writer and direct/dropped-result regressions retain final assertions and independent fixture drainage. Complete repair production/test/docs delta reviewed against prior full passes; earlier authorized boundary/stop predicate and nine original repairs carried forward. C1–C5 all require runtime proof and remain unverified in this source-only verdict. A-16263 local checks and A-16256 ten native repetitions retain source-equivalent precommit macOS provenance; no exact-head queued/Linux/Web/browser/QA receipt yet. Implementer may submit mode-free configured verification at this exact head, then request evidence review. Any head change needs fresh source review. No Reviewer runtime checks, edits, browser or delegation. Detail A-16264: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16264-t-1599-clear-source-review-at-83428a67a.md.

### rev-35 · 2026-11-03T12:22:24.817Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1599-evidence-1
commit: 83428a67a4185a56aaf54d45c2e20edef78a7121
scope: evidence
findings: [{"severity":"medium","text":"Queued run523013bf fails 'Error: host transport already owned' at claimTransport (transport.ts:20). This unchanged status consumer registers host one before projectHub starts, then manually claims its fake carrier after startup; the new automatic SSH registry already owns that carrier. Migrate the fixture through the injected-Host seam and list the consumer while preserving all C6 status/reason/previous-reply assertions; a fresh source review and verification are required.","file":"hub/test/transport-status.test.ts","line":19}]
finding_counts: {"high":0,"medium":1,"low":0}

Queued evidence not clear. Exact-head run523013bf/A-16265 overall/T2 exit1; actual output 'Error: host transport already owned' at transport-status.test.ts:19/transport.ts:20. Ordinary timing row22997 confirms the single named failure. Source trace identifies unchanged fixture consumer conflict with new automatic carrier ownership; Implementer reports local reproduction and will migrate via injected Host while preserving status/old-reply assertions. T0/T1 exit0; changed T3 and Web unexecuted, T4 none; no browser binary/receipt. Uncached Linux x64 droplet Node24.21/Nvim0.12.5, runner tree c52594905ee860121ec19843d25f1546b3a73402; report-only advisories not causal. C3 failed; no criteria verified. Existing source clear is not final run evidence. Fresh source review at corrected head before verification. Detail A-16266: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16266-t-1599-failed-queued-evidence-transport-status-consumer.md. No Reviewer runtime execution or edits.

Criteria: C3 failed (Automatic registry startup owns host one before transport-status fixture's manual fake claim; queued C6 compatibility regression fails with host transport already owned.).

### rev-35 · 2026-11-03T12:23:32.296Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1599-source-5
commit: 0b693d330818f35cd60546d8352511a3bfef3294
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, no findings. The A-16266 transport-status consumer now injects existing inert Host one before daemon startup, allowing its status-only carrier to remain the sole owner. All status/reason/CLI/previous-reply assertions independently compared byte-identical. Production source is unchanged from source-clear83428a67a; consumer inventory/worklog/test guide updated. Prior complete source review carries forward. C1–C5 remain unverified until exact-head configured verification/evidence review. Precommit local C6 red/green supplements are not queued receipts; earlier A-16265 remains failed at its actual head, with changed T3/Web unrun. Submit mode-free verify at this exact head; any head change needs fresh source review. No Reviewer runtime checks, edits, browser or delegation. Detail A-16268: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16268-t-1599-clear-source-review-status-fixture-migration.md.

### rev-35 · 2026-11-03T12:43:59.247Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1599-evidence-2
commit: 0b693d330818f35cd60546d8352511a3bfef3294
scope: evidence
findings: [{"severity":"medium","text":"A-16269 records AssertionError: expected /already checked out/, actual \"fatal: 'used' is already used by worktree at .../elsewhere\". The platform-specific Git diagnostic match stops this regression before its cleanup/replacement/restart assertions run. Accept the equivalent native refusal wording while retaining every ownership and cleanup assertion, then re-review the changed head.","file":"hub/test/host-prepared.test.ts","line":111},{"severity":"medium","text":"A-16269:26571 reports the enforcing legacy duration rejection: shared Host contract wrapper 7.334 s > 5 s. All 14 nested behavioral rows passed, but the aggregate identity fails the configured case gate. Resolve the wrapper's registration/runtime budget through the documented procedure while preserving every behavior row and native receipt; report-only tier/lint/ratchet advisories do not waive this gate.","file":"hub/test/host-ssh-contract.test.ts","line":14}]
finding_counts: {"high":0,"medium":2,"low":0}

Evidence not clear at exact source-reviewed head. Run4fd7d495/A-16269: T0/T1/all fallbackT2 exit0, changedT3 exit1; Web/T4 unexecuted, remainingT3 batch deferred. Actual native output 'used is already used by worktree at .../elsewhere' does not match /already checked out/ at prepared111. Also enforcing legacy duration rejection at26571: shared contract wrapper7.334s >5s. All14 nested behavior rows and SSH19 top-level identities pass; prepared11/12 passes, earlier transport-status now passes. These facts do not make overall run green. Two medium findings recorded; C1 failed, no new criteria verification. Uncached Linux x64 droplet c-8nyc1 Node24.21/Nvim0.12.5; treeee77a1515d0bf192accb50481355bca8d008a243; browser null. Separate report-only lint/tier/ratchet notices not causal substitutes for the enforcing case gate. Fresh corrected-head source review before another verify. No Reviewer tests/probes/edits/browser. Detail A-16270: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16270-t-1599-failed-changed-t3-evidence-git-wording-and-contract-budget.md.

Criteria: C1 failed (Changed T3 fails Linux Git refusal wording and enforcing shared-contract wrapper duration 7.334s > 5s; replacement/restart assertions after wording failure did not execute.).

### rev-35 · 2026-11-03T12:44:57.478Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1599-source-6
commit: 25f7578b64d903f0590dfc0e6edc3221c5a03efe
scope: full
findings: [{"severity":"medium","text":"The enforcing shared-contract wrapper duration failure remains: A-16269:26571 measured7.334s >5s at the parent. Wrapper source and durations configuration are byte-identical at this head. Resolve this known case-gate blocker via the documented registration/runtime budget procedure, preserving every behavioral row/native receipt, before another verification. This is carried parent evidence, not a new timing measurement.","file":"hub/test/host-ssh-contract.test.ts","line":14}]
finding_counts: {"high":0,"medium":1,"low":0}

Git diagnostic compatibility fix is source-correct: rejects now accepts both native branch-in-use messages while every cleanup/replacement/restart assertion remains intact. Production unchanged. Review remains not clear due to the second A-16270 blocker: enforcing wrapper duration remains byte-identical and unresolved. C1 failed, no criteria newly verified. Source scope carried forward; parent run is failed evidence, not a pass; Web remains unexecuted there. No Reviewer tests/probes/edits/browser. Detail A-16272: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16272-t-1599-source-review-git-wording-fixed-case-budget-outstanding.md.

Criteria: C1 failed (Known enforcing shared-contract wrapper duration7.334s >5s remains unresolved; wrapper and case-budget configuration unchanged from failed parent.).

### rev-35 · 2026-11-03T12:48:25.610Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1599-source-7
commit: 63e8f8296016e4dc06c64143854cb7f09065b97a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, no findings. Exact aggregate wrapper allowance11.001s follows documented dated allowance policy: E-880 independently confirmed open standing epic under categoryC-327; addedNov3/expiresNov10, non-TODO lifecycle reason; 1.5x worst recorded passing wrapper sample rounded upward independently recomputed. A-16273 retains two production-checker before-fail/after-no-failure replays with sample head/platform limits. No mode/baseline/production/behavior/assertion/timeout change. Git regex correction retained; prior complete source review carried forward. C1–C5 remain unverified until exact-head configured evidence. Prior failed runs remain failed history; replay is allowance evidence only, no Web/browser claim. Submit mode-free verify at this exact head; changed head needs fresh source review. No Reviewer runtime checks/edits/browser/delegation. Detail A-16274: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16274-t-1599-clear-source-review-dated-aggregate-contract-allowance.md.

### rev-35 · 2026-11-03T13:13:04.794Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1599-final-1
commit: 63e8f8296016e4dc06c64143854cb7f09065b97a
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear, no findings; C1–C5 verified. Exact source-cleared/current head run597abaf5/A-16275 passed T0/T1/fallback allT2/changedT3/Web, aggregate4964/4964 and zero fail/cancel/skip/todo. Independently inspected all14 nested shared behavior passes, SSH19 and prepared12 top-level passes including every prior repair, environment6, registry2, transport-status1, boundary2, layout16/records10/routing16 and stop-observation3. Exact generated names and log lines mapped to each criterion in A-16277. SelectedT3 twofiles/31 top-level identities once; remainingT3 merge-batch deferred, T4 unexecuted, after-stageQA separate. Uncached droplet Linuxx64 6.8.0-142-generic Node24.21/Nvim0.12.5, runner treeb0e4cde8d4eddd462af2f9c95d1d580ae975a82a; isolated HeadlessShell1248/ChromeForTesting156.0.8078.4, browser path in artifact; skips[]/missing0 report. Budgets/lint/ratchet report-only; dated aggregate allowance source-reviewed, current wrapper4.3949004s. Host typecheck recorded at same tree, not repeated remotely. Billing cost/lifetime absent/unknown. Deferred native controls have only qualified historical macOS supplements, no remote-execution claim. Prior failed A-16265/A-16269 stay failed. No Reviewer runtime execution/edits/browser. Detail A-16277: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16277-t-1599-final-clear-exact-head-host-and-prepared-operation-evidence.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-11-03T14:31:07.839Z

Merged aa42c6efdd56a5e2def4b88fea2804e02e726d62 onto dev.

### coord · 2026-11-03T22:02:56.290Z

Seam note (T-1607, coord decision 2026-11-03 22:03Z): the Host contract gains an optional `adopt(process)`, with an agent `adopt` operation advertised as a capability. Older agents are refused explicitly, never skipped silently, and the local and double contracts are unchanged. The agent adopts only a process whose PID and start identity it verifies, that matches the session's single `claude agents --json` worker, and that runs as the agent's user and is tied to this session's launch; anything else is refused. The session credential needed by `--bg` hooks is stored only in the session's private Claude directory at 0600 and removed on stop and rollback.

### coord · 2026-11-03T22:04:33.508Z

Seam note (T-1607, 2026-11-03, supersedes the credential part of the earlier adopt note): the Claude agent module owns an agent-side `launch` operation. It runs `claude --bg` plus a single `claude agents --json`, then pins job/session/PID/native birth/UID in a durable record, written atomically and scoped by generation. `adopt` accepts only that record's exact worker; it never takes a PID from the caller and refuses PID reuse. The capability gates both; an older agent is refused. Zero, several or unparseable matches fail closed, roll back and report cleanup-incomplete when the rollback can't prove its work. There is no /proc cmdline/env fallback. The credential is the existing CLAND_LAUNCH_TOKEN, kept in the private 0600 mcp.json/settings.json and removed by generation after a confirmed stop or rollback. A planted-value scan proves it appears nowhere else.
