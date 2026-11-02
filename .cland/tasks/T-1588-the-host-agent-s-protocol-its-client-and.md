---
id: T-1588
kind: task
title: The host agent's protocol, its client and its process operations
state: closed
status: done
size: M
criterion_seq: 8
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by: []
topic: topic-1325
branch: t/T-1588-the-host-agent-s-protocol-its-client-and
created: 2026-11-02T03:33:52.542Z
updated: 2026-11-02T14:00:51.578Z
closed: 2026-11-02T14:00:51.578Z
---

## Summary

`cland host serve`, using Node built-ins only, listens on `agent.sock` in a 0700 run directory and speaks JSON lines: request `{id, op, args}`, reply `{id, ok, result}` or `{id, ok: false, error}`, and the events `process-exited` and `memory`. The hello carries the per-host secret and answers with the agent's version and boot id. It spawns processes detached in their own session and process group, keeps a persisted process table with Linux birth identities, signals and stops by identity, and reports RSS and CPU per process tree; a hub-side client speaks the same protocol.

Hot files: `hub/src/host/agent/` (new: `protocol.ts`, `server.ts`, `processes.ts`), `hub/src/host/agent-client.ts` (new), `hub/src/cli/host.ts` (new), `hub/bin/cland.ts`

## Acceptance criteria

- [x] C1. A hello without the agent's per-host secret, or with another, gets an error reply and the connection is closed, and no other op is answered before a successful hello (test).
  - done: impl-1588 · 2026-11-02T06:00:46.087Z
  - verified: rev-35 [reviewer] · run rev-35-1588-final-1 · 2026-11-02T07:58:23.951Z · commit 78c9f40f8bb354935a957804adc9285c69a3743e
  - verified: rev-35 [reviewer] · run rev-35-1588-final-2 · 2026-11-02T13:13:58.459Z · commit da0e7d2cf8a2a233106be8d4e004b1c5a16faf06
- [x] C2. The hello reply carries the agent's cland version, pid and boot id, and an unknown op or a malformed line gets an error reply without closing the connection (test).
  - done: impl-1588 · 2026-11-02T06:27:07.600Z
  - verified: rev-35 [reviewer] · run rev-35-1588-final-1 · 2026-11-02T07:58:23.951Z · commit 78c9f40f8bb354935a957804adc9285c69a3743e
  - verified: rev-35 [reviewer] · run rev-35-1588-final-2 · 2026-11-02T13:13:58.459Z · commit da0e7d2cf8a2a233106be8d4e004b1c5a16faf06
- [x] C3. A spawn starts a child in its own session and process group with the given argv, environment, cwd and log file. The child survives the agent's exit, the agent's own `CLAND_HOST_*` variables never reach it, and the env never reaches its argv (test).
  - done: impl-1588 · 2026-11-02T06:27:07.805Z
  - verified: rev-35 [reviewer] · run rev-35-1588-final-1 · 2026-11-02T07:58:23.951Z · commit 78c9f40f8bb354935a957804adc9285c69a3743e
  - verified: rev-35 [reviewer] · run rev-35-1588-final-2 · 2026-11-02T13:13:58.459Z · commit da0e7d2cf8a2a233106be8d4e004b1c5a16faf06
- [x] C4. Identities are `linux:<boot id>:<start ticks>`, from `/proc` on Linux; on another platform, and only for a fake host, the start time comes from `ps` and the boot id from the file named by the agent's boot-id variable (test).
  - done: impl-1588 · 2026-11-02T06:00:49.023Z
  - verified: rev-35 [reviewer] · run rev-35-1588-final-1 · 2026-11-02T07:58:23.951Z · commit 78c9f40f8bb354935a957804adc9285c69a3743e
  - verified: rev-35 [reviewer] · run rev-35-1588-final-2 · 2026-11-02T13:13:58.459Z · commit da0e7d2cf8a2a233106be8d4e004b1c5a16faf06
- [x] C5. A signal or stop with a stale identity (reused pid, other boot id) signals nothing and says so, and a live identity's process group gets the signal (test).
  - done: impl-1588 · 2026-11-02T06:27:08.228Z
  - verified: rev-35 [reviewer] · run rev-35-1588-final-1 · 2026-11-02T07:58:23.951Z · commit 78c9f40f8bb354935a957804adc9285c69a3743e
  - verified: rev-35 [reviewer] · run rev-35-1588-final-2 · 2026-11-02T13:13:58.459Z · commit da0e7d2cf8a2a233106be8d4e004b1c5a16faf06
- [x] C6. The process table survives an agent restart, and a restarted agent reports each recorded process's liveness and its tree's RSS and CPU (test).
  - done: impl-1588 · 2026-11-02T07:26:38.799Z
  - verified: rev-35 [reviewer] · run rev-35-1588-final-1 · 2026-11-02T07:58:23.951Z · commit 78c9f40f8bb354935a957804adc9285c69a3743e
  - verified: rev-35 [reviewer] · run rev-35-1588-final-2 · 2026-11-02T13:13:58.459Z · commit da0e7d2cf8a2a233106be8d4e004b1c5a16faf06
- [x] C7. A `process-exited` event reaches a connected client with the process's identity and exit status, and a `memory` event reports total and available memory at a fixed interval (test).
  - done: impl-1588 · 2026-11-02T06:53:04.670Z
  - verified: rev-35 [reviewer] · run rev-35-1588-final-1 · 2026-11-02T07:58:23.951Z · commit 78c9f40f8bb354935a957804adc9285c69a3743e
  - verified: rev-35 [reviewer] · run rev-35-1588-final-2 · 2026-11-02T13:13:58.459Z · commit da0e7d2cf8a2a233106be8d4e004b1c5a16faf06
- [x] C8. A T1 lint fails when a module under `hub/src/host/agent/` imports anything but `node:` built-ins or another agent module (test).
  - done: impl-1588 · 2026-11-02T06:00:51.980Z
  - verified: rev-35 [reviewer] · run rev-35-1588-final-1 · 2026-11-02T07:58:23.951Z · commit 78c9f40f8bb354935a957804adc9285c69a3743e
  - verified: rev-35 [reviewer] · run rev-35-1588-final-2 · 2026-11-02T13:13:58.460Z · commit da0e7d2cf8a2a233106be8d4e004b1c5a16faf06

## Notes

Shared files: the agent protocol module (framing, hello, events owned here; ops added by 07, 19 and 23 in that order); `hub/src/cli/host.ts` (created here)

## Comments

### impl-1588 · 2026-11-02T05:43:27.490Z

Rule 20 inventory before changes: searched host/agent, agent-client, process-exited, CLAND_HOST_, host serve across hub/src, hub/test, web, nvim, shared, docs, qa and shipped skills. No existing agent wire consumers; new consumers are server, client, CLI and tests. Existing process-identity.ts owns Linux birth parsing and must retain old exports/shape. Proposed v1 JSONL: request {id,op,args}; hello args {protocol:1,secret}; success {id,ok:true,result}, failure {id,ok:false,error}; hello result {protocol:1,version,pid,bootId}; events {event:'process-exited',pid,identity,code,signal} and {event:'memory',totalBytes,availableBytes}. Operations spawn, identity, alive, signal, stop, processes. Later op owners T-1593/T-1605/T-1609 extend dispatch. No existing wire shape is replaced.

### impl-1588 · 2026-11-02T05:48:05.684Z

Shared extraction exports: host/agent/identity.ts owns linuxIdentity(pid,stat,boot,report?,reportExited?), readLinuxBootId(): Promise<string>, readLinuxBootIdSync(): string and callback types. process-identity.ts imports/re-exports unchanged linuxIdentity/types and the two new readers. Existing Linux read sites use the readers. Coordinated with T-1615, which consumes the exports. Initial native CLI restart test exposed stale agent.sock after SIGKILL; adding stale-listener recovery while refusing an active listener.

### impl-1588 · 2026-11-02T05:57:40.952Z

Rule 20 extraction inventory (search process-identity/linuxIdentity/readLinuxBootId in production, colocated tests, all tiers, docs, QA, shipped skills): production consumers adapters/{sessions,processes,claude-code-local}, host/local, system-processes, stdio-writers, suite-command, hub/suite-isolation, executor/local and executor/droplet/watchdog retain existing process-identity imports/behavior unchanged. Test/fixture consumers host-boundary, measure-memory, process-cleanup, memory-producer, claude-code-sessions-lifecycle, session-resume-component, system-process-probe, system-processes, process-identity, executor-droplet and process-started are unaffected through re-exports. References in tests.md; per-test guides for host-boundary/lifecycle-serialization/process-identity/session-resume-component/telegram-polling-restart/fake-claude-cleanup/host-local-contract; QA briefs E-1531-stage-2/stage-3 and E-1284 remain valid. T-1615 imports the new boot readers. No old function signature or wire shape is removed.

### rev-35 · 2026-11-02T06:06:41.894Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1588-source-1
commit: 21b160811ebdff271a9556571952d954e02e0eef
scope: full
findings: [{"severity":"high","text":"Detached spawn happens before any durable launch/ownership record (row added at 65, persisted at 66). SIGKILL the agent while identity lookup or the first persist is held: the child survives but restart cannot discover it in processes.json. Persist an admission identity before releasing native execution and reconcile the launch gap; test agent death at that boundary, including fast child completion.","file":"hub/src/host/agent/processes.ts","line":51},{"severity":"medium","text":"finally awaits log.close after the child was durably recorded and the successful pid/identity result prepared. A descriptor-close error overrides that result with an ordinary failed spawn reply while the detached child keeps running. Preserve accepted ownership/outcome or confirm stop before reporting failure; inject a close fault and assert PID/exit ownership.","file":"hub/src/host/agent/processes.ts","line":74},{"severity":"medium","text":"If the child exits while the initial persist is pending, close enqueues an exit checkpoint/event at 57, then spawn emits another event at 72 after only the initial checkpoint. The first event can precede durable exit status and the later checkpoint emits it again. Use one completion owner and publish exactly once after its own durable checkpoint; test with held initial/exit writes.","file":"hub/src/host/agent/processes.ts","line":72},{"severity":"medium","text":"Socket chmod is outside startup cleanup. If it fails, serveAgent rejects while the listening server and memory interval remain live, with no returned close handle. Fence admission during acquisition and drain the server, queued requests and timer on every startup failure; keep a fault regression.","file":"hub/src/host/agent/server.ts","line":86},{"severity":"medium","text":"Server and AgentClient:18 bound the entire buffered chunk before extracting complete lines. A legal near-1-MiB line followed by bytes from another legal line can exceed that aggregate and close the stream. Enforce the limit per decoded line/incomplete tail in one shared decoder, with fragmented/coalesced and multibyte boundary cases.","file":"hub/src/host/agent/server.ts","line":47},{"severity":"medium","text":"signal validates only the root birth, then kills the entire numeric process group; group members have no independent birth proofs. stop likewise captures members then calls this broader signal path, which can signal new members before remaining() notices them. Validate each captured target before signaling, including recovery and member-arrival/reuse regressions (rule 26).","file":"hub/src/host/agent/processes.ts","line":93},{"severity":"medium","text":"New HOST_USAGE export and aggregate help have no migration in frozen commands.json, exports.json or help.txt. Existing full usage deep equality and native --help output comparisons therefore disagree at this head. Add independent expected block/export/placeholder entries while retaining full assertions and native host serve help coverage.","file":"hub/src/cli/usage.ts","line":45},{"severity":"medium","text":"The 256-row cap applies only when code is recorded. Processes that finish while the agent is down retain code === undefined forever, so repeated restart/exit cycles grow processes.json without bound; load and every processes call scan this retained history. Reconcile positively observed ended ownership into bounded unknown-status history and test a work/byte budget on accumulated restart receipts (rule 23).","file":"hub/src/host/agent/processes.ts","line":39},{"severity":"medium","text":"The detached-process test ignores failed/false stop in finally, closes an agent that deliberately preserves children, then deletes their root. Assertion or stop failure can leave a detached writer alive during removal. Register an independent native ownership cleanup at spawn and join it before deleting the fixture; exercise the failed-stop cleanup path.","file":"hub/test/host-agent.test.ts","line":71}]
finding_counts: {"high":1,"medium":8,"low":0}

Source not clear: one high and eight medium findings, all recorded with exact locations. High: detached child creation precedes durable admission/ownership, leaving an agent-crash orphan window. Medium: accepted spawn lost on log-close fault; duplicate/pre-checkpoint exit event race; startup chmod leaks listener/timer; aggregate-buffer framing limit; unfenced initial group signaling; frozen HOST_USAGE/help consumers unmigrated; unbounded recovered unknown-exit rows; detached test cleanup deletes root after ignored stop failure. Detailed counterexamples, standards/spec analysis and execution limits in A-15622 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15622-t-1588-source-review-at-21b160811.md). C2/C3/C5/C6/C7 failed; C1/C4/C8 unverified. Shared Linux parser extraction preserves prior code/exports. No reviewer tests/browser; local macOS reported results are not Linux or queued verification. Address findings and request fresh source review before verification.

Criteria: C2 failed (Both JSONL readers apply the per-line byte limit to aggregate buffered chunks, rejecting legal coalesced frames.), C3 failed (Log-close failure replaces an accepted detached spawn result with an ordinary error while its child remains live.), C5 failed (The initial group signal validates only the root rather than each captured target birth.), C6 failed (Agent death between native spawn and first persistence leaves an unrecorded surviving child; recovered unknown-exit rows are unbounded.), C7 failed (Exit during initial persistence can emit before its exit checkpoint and emits twice.).

### impl-1588 · 2026-11-02T06:08:58.531Z

Review rework shared-contract inventory before changes: existing v1 consumers are AgentClient, server and host-agent tests; bootstrap/admission introduces private durable launch receipt files and optional process-row launchId/ended fields. Existing processes.json array rows remain readable. All v1 wire keys remain; terminal recovery with unknown native status retains null code/signal and optional ended marker. New shared line decoder will be imported by server/client, replacing their duplicated aggregate-buffer limits. CLI frozen help consumers to migrate: fixtures/cli-usage/{commands.json,exports.json,help.txt}, cli-usage-fixture.ts, cli-usage-compatibility.test.ts and native cli-command-help.test.ts. No dev merge after first review.

### impl-1588 · 2026-11-02T06:27:09.175Z

A-15622 rework pushed at 10860b1536418628cc24c38763a52365066493a4. Private durable admissions precede native spawn; bootstrap checkpoints its own identity, awaits table-backed release then execve replaces itself preserving PID/birth/group. Single completion owner emits only after exit checkpoint. Per-target revalidation replaces numeric group signals. Startup acquisition fenced until chmod and rolls back listener/timers. Shared LineDecoder owns byte policy for both streams. Frozen CLI help blocks/export/aggregate fixtures migrated and native host serve help tested. Recovery coalesces current observations, positively retires ended prior-shape rows into a 256-row/<64KiB checkpoint and preserves unreadable state as unknown. Native fixture cleanup captured independently at each launch. Added wire fields are optional spawn warning (accepted log-close fault) and process row launchId/ended; unknown liveness is null. Existing fields and old process-array records retained; no previous deployed agent protocol exists. All consumers remain server/client/tests plus later owner tickets; new internal modules bootstrap/native/storage stay inside built-ins boundary. No dev merge since first review.

### rev-35 · 2026-11-02T06:31:20.359Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1588-source-2
commit: 10860b1536418628cc24c38763a52365066493a4
scope: full
findings: [{"severity":"medium","text":"Reconcile captures active rows, awaits observation, then writes code/signal=null without rechecking whether nativeClosed already stored a known exit on that same row. If the native close handler runs during the observation await, recovery overwrites its known status and can checkpoint null after an event carrying the real code. Serialize terminal settlement or revalidate the row/version after await; hold observation against native completion and compare event with final durable status.","file":"hub/src/host/agent/processes.ts","line":74},{"severity":"medium","text":"Native root close removes its admission and marks the row ended without observing remaining descendants; recovery does the same at 74–78. A parent can spawn a long-lived child with independent stdio then exit: the child survives, stop cannot capture it because the root is ended/not alive, and recovery metadata is removed. Retain identity-bound descendant ownership and refuse completed cleanup until those writers are observed gone (rule 12); test natural root exit before a later stop/restart.","file":"hub/src/host/agent/processes.ts","line":139}]
finding_counts: {"high":0,"medium":2,"low":0}

Reworked source not clear; two medium findings remain. processes.ts:74: reconcile's pre-await active list can overwrite a concurrent known native completion with null and persist it after an event carrying the real exit. processes.ts:139 (and recovery74–78): native root close retires admission/stop authority without observing independently running descendants; natural root exit before stop leaves those writers unreachable. Single terminal settlement and identity-bound descendant recovery are required (rules25/12). A-15656 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15656-t-1588-reworked-source-review-at-10860b153.md) includes exact interleavings, prior-finding resolutions and execution limits. Original crash-gated bootstrap, accepted log-close warning, shared decoder, startup rollback, per-target signals, bounded ended history, help migration and independent fixture cleanup are addressed. C6/C7 failed, no new criterion verified. No reviewer tests; A-15650 local Mac13/13 and static/help reports are not queued/Linux evidence. Fresh source review before verification.

Criteria: C6 failed (Natural root exit removes admission/stop ownership before remaining descendants are observed gone.), C7 failed (Reconciliation can overwrite an already observed native exit code/signal with null after an observation await.).

### impl-1588 · 2026-11-02T06:37:51.266Z

Coordinator decision (coord, 2026-11-02 06:35Z, cc1f120d-0070-4178-ac30-6b759291ccd3): no per-launch supervisor, to preserve host session density. Capture descendant birth identities at root close while agent is live. An unobserved root exit retains unresolved admission/metadata with process authority unknown; stop refuses with an explicit unknown-authority reason and signals nothing. Host reboot/session ending (T-1613) or recycling clears it. This supersedes pruning unobserved-exit ownership as terminal history: only confirmed closed trees enter the 256-row retained history; unresolved authority remains current state until host lifecycle. Shared v1 row additions: authority owned|unknown|closed, targets of {pid,identity}, rootExitObserved; process-exited keeps root PID/birth/code/signal with optional authority/ended so a native root exit is distinct from tree closure. Consumers are agent producer/client, tests/docs and later Host/protocol owner tickets; old rows remain readable. No numeric group is recovery signal authority.

### impl-1588 · 2026-11-02T06:48:20.697Z

Second-review corrections now pass 16/16 native T3 cases on macOS arm64. New controls: recovery observation held across code-19 native event preserves final durable code; natural root code-23 exit retains descendant birth/admission through restart and later complete stop; agent SIGKILL across root code-29 exit yields authority unknown with retained metadata, explicit stop refusal and unchanged live descendant identity. Coordinator decision cc1f120d applied: no per-launch supervisor, unknown ownership remains current state until host lifecycle; confirmed closed history alone capped at 256. Native completion and owned stop join exact per-root completion before tree cleanup; closed-admission receipts support recovery of interrupted metadata deletion. The fake-reboot test now expects unknown-authority refusal after changing the boot identity, rather than restoring authority by reverting a fake UUID.

### rev-36 · 2026-11-02T06:57:42.496Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1588-source-1
commit: 817576cda4f28e4d7ce98419f1a68d2d164884e2
scope: full
findings: [{"severity":"medium","text":"After native root close, #group(rootPid) cannot see a descendant that created its own session/group and was reparented when the root exited. A parent spawning a detached:true, stdio:'ignore' child, waiting for that child's ready receipt and exiting leaves the child live, but members/targets are empty, authority becomes closed, ended=true and admission is removed. Preserve unknown ownership instead of treating an empty post-exit group as complete tree absence, or retain sufficient admitted descendant receipts; cover detached-child root exit/restart and independent native cleanup without adding the Coordinator-rejected supervisor.","file":"hub/src/host/agent/processes.ts","line":175}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source not clear: medium processes.ts:175. Root spawns detached:true/stdio-ignore child, waits ready then exits; child is reparented into its own group. Post-exit #group(rootPid) misses it, empty targets becomes closed/ended and removes admission while the child survives. New live-close test retains same group and misses this case. Preserve unknown ownership or sufficient positive descendant receipts; cover detached escape/restart without the rejected supervisor. Known-exit race, same-group descendant recovery and Coordinator's missed-exit unknown policy otherwise addressed; full protocol/client/bootstrap/help/docs/test source reviewed. C6 failed, others unverified. A-15680 local Mac16/2/static summaries supplemental; no Reviewer execution.

Criteria: C6 failed (A surviving detached descendant is absent from the post-root-exit group scan, so the row is falsely closed and admission/stop ownership is removed.).

### impl-1588 · 2026-11-02T06:59:25.607Z

Coordinator refinement a89c1297-1d3b-42fc-b087-7f619bc9ed91 (coord, 2026-11-02 06:59Z) of the 06:35Z decision: supported remote session authority is its captured process group. A descendant that changes session/group (setsid/double fork) is outside cland authority and must never be tracked/signalled; host recycling cleans it up. An observed natural root exit plus empty same-group scan closes normally. Unknown remains for root exits not observed by the agent; do not classify every ordinary exit unknown. Add a detached-child regression proving no signal, natural row closure and documented boundary. Inspect local behavior before claiming the same limit; report any difference to Coordinator. This refines review A-15689's scope rather than adding a supervisor.

### impl-1588 · 2026-11-02T07:02:03.354Z

Final Coordinator refinement 24e17b6f-978f-44eb-b49f-4ca361a3ddb8 (coord, 2026-11-02 06:59Z), superseding group-only wording in a89c1297: match local Host authority. Capture descendants by PPID ancestry while root is live, with native births; captured descendants remain owned after changing group/session or reparenting. Stop rechecks each birth. Close after root exit and every captured descendant is gone. A descendant that escaped before any capture is outside cland authority on both Hosts and is never signalled; document identical boundary wording in local and remote docs. Unknown remains for root exits the agent missed. Required tests: captured detached process remains owned and stopped after reparenting; escaped-before-capture process never signalled and natural row closes. No per-launch supervisor, no changes to local implementation.

### impl-1588 · 2026-11-02T07:08:28.477Z

Final 24e17b6f boundary implementation: live reconciliation/stop now checkpoint PPID ancestry targets; native root close unions earlier captured births rather than replacing them with a post-exit group snapshot. Thus a detached child captured while ancestry is intact stays owned after reparenting and is individually stopped with a birth check. An escaped-before-capture child remains unowned; natural row closes normally, subsequent stop returns false and native child identity stays alive until independent fixture cleanup. New deterministic two-case native control and identical local/remote boundary wording pass. Red control failed first on missing durable ancestry capture receipt; corrected full native file 17/17 passed locally macOS arm64. Local implementation is unchanged; its ancestry behavior was inspected and the difference from group-only was reported before the final Coordinator refinement.

### rev-35 · 2026-11-02T07:15:48.070Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1588-source-3
commit: a8a54cccdf91ef5ff691a9693dc1017aa518d580
scope: full
findings: [{"severity":"medium","text":"With the root still alive, processes() sums only #group(root), omitting retained captured targets that have detached and reparented. Those targets remain owned for stop under Coordinator24e17b6f, so C6 resource totals undercount the owned tree. Include current ancestry plus independently birth-validated retained targets, deduplicate, preserve unknown observations, and cover live-root/captured-reparented-writer accounting and cleanup.","file":"hub/src/host/agent/processes.ts","line":346},{"severity":"low","text":"The new race regression awaits captured.promise without a separate setup bound. A missing observation-hook receipt relies only on the whole-test timeout and cannot normally enter its release/join finally. Bound setup independently (rule9), retaining final durable code19 and exactly-once assertions.","file":"hub/test/host-agent.test.ts","line":343}]
finding_counts: {"high":0,"medium":1,"low":1}

Full source not clear: medium processes.ts:346 owned resource undercount. Capture a descendant while PPID ancestry is intact, let it change group/reparent while root remains alive: #liveTargets retains its birth, stop owns it, but processes() selects only #group(root) and drops its RSS/CPU. C6 failed. Low host-agent.test.ts:343 unbounded setup receipt await; use a separate bound/release/join while preserving final durable assertions. Earlier known-exit overwrite, closed checkpoint/cleanup, retained descendant and missed-exit unknown fixes otherwise addressed. Read actual final Coordinator24e17b6f; boundary/docs/skill match it, superseding group-only note, no supervisor requested. A-15710 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15710-t-1588-source-review-retained-descendant-resource-accounting.md) records counterexample, both axes and limits. No reviewer tests/browser. A-15705 localMac17/17+T1two/static reports remain targeted; Linux/queued and other criterion verification pending. Fresh corrected-head source review before verification.

Criteria: C6 failed (Captured reparented descendants remain owned but disappear from resource totals while the root is alive because the live branch ignores retained target identities.).

### impl-1588 · 2026-11-02T07:22:45.917Z

A-15710 narrow corrections: live-root RSS/CPU now unions current ancestry with retained captured target roots, validates every retained birth before and after sampling, deduplicates PIDs, and leaves failed/unreadable/changing/incomplete samples null. Exact native exit facts dominate a concurrent resource observation. New still-live-root reparenting fixture uses a fixed 64 MiB writer with independent native ps RSS, checks no duplicate accounting before reparenting, retained bytes afterward, and later stop/independent cleanup. The test first failed on omitted retained writer bytes; corrected full native T3 file 18/18 passed locally macOS arm64. Held recovery-observer setup now has an explicit 3 s reached-receipt bound in try/finally, retaining code-19 persistence and single-event assertions. No authority-boundary change from Coordinator24e17b6f.

### rev-35 · 2026-11-02T07:27:38.657Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1588-source-4
commit: 78c9f40f8bb354935a957804adc9285c69a3743e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full corrected source clear, no findings. Prior medium resolved: resource anchors union current ancestry with retained exact births while root remains live, validate births before/after sampling, deduplicate PIDs, require stable target generation/native rows/finite values, and preserve null for unavailable observations. New still-live-root64MiB reparented writer control verifies initial no-double-count total, retained RSS/CPU, then stop/native absence and independent cleanup. Prior low resolved: held observation setup separately bounded3s in try/finally; final durable code19 and single-event assertions retained. Protocol/per-file docs match; Coordinator24e17b6f capture/unknown policy and prior ownership fixes unchanged. A-15728 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15728-t-1588-corrected-source-review-at-78c9f40f8.md). Read-only diff check clean; reviewer ran no tests/browser. A-15727 localMac18 native passes/static reports are targeted, no Linux/queued evidence. C1–C8 remain unverified pending named exact-head queued/native preservation evidence.

### rev-35 · 2026-11-02T07:58:23.951Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1588-final-1
commit: 78c9f40f8bb354935a957804adc9285c69a3743e
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear, C1–C8 verified, no findings. A-15744 exact-head00d02cd8 exit0/4721pass/zero fail,cancel,skip,todo. Independently matched named host-agent18 (all native auth/framing/spawn/env/session/identity/stale signals/restart/resources/exit/memory/admission/crash/descendant/unknown/dedup controls), boundary2, unedited identity6, frozen usage1 and native CLI help7 pass facts. C4 non-Linux supplement A-15746 retains originalMac18 outputs/native normal completion via check=True+wrapperexit0; pre-commit source linkage reconstructed from retained no-edit run/commit sequence, not producer-pinned HEAD. Two listed source/test blobs independently match78c9f40. Macarm64Node24.21 local/no browser; exact-pinned Linux proc branch separate. T0/T1/all fallbackT2/changed T3host-agent18/Web completed; remainingT3 merge batch,T4 unexecuted, base changed-file once/no repetitions. Duration-check10.365s excludes machinewait, not suite walltime. Budget/lint/ratchet/skipreason advisories report-only. Linuxx64 6.8.0-142-generic c8lon1 Node24.21/Nvim.12.5 workers2; tree0c56e81f8a927b423fb38c27d644b5082a11a012; isolatedHeadlessShell1248/ChromeForTesting156.0.8078.4; cache/occasionnull,skips[],skipReasonCheckreport/missing0. No full integrated-premerge claim; reviewer ran no tests/browser. A-15747 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15747-t-1588-final-evidence-review-at-78c9f40f8.md) maps all criteria and records provenance limits.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified, C8 verified.

### impl-1588 · 2026-11-02T12:46:25.028Z

All four authorized prerequisites have durable merged=true/closed receipts: T-1589, T-1591, T-1566, T-1621. Started the single Coordinator-requested merge of origin/dev 6d0c8efdaa171187f4b0c7a143fabe3ec7239ac3 into reviewed 78c9f40f8. Only README and implement SKILL conflicted; preserved all headings/sections from both parents, kept one Host process heading and both protocols/Git/records/fake-SSH text. Incoming runtime merged automatically. State inventory integration exposed `cli/host.ts:7: home/temp resolver: homedir()`; migrated this owned caller to landed userHome(env), preserving default ~/.cland-host/run and override. Red inventory test then green 5/5. No new dependency or agent protocol/ownership change. Preparing merged-head delta review and requesting Reviewer's fresh-verify decision before any run.

### impl-1588 · 2026-11-02T12:49:30.808Z

Coordinator-authorized single merge completed and pushed: da0e7d2cf8a2a233106be8d4e004b1c5a16faf06, parents reviewed78c9f40f8 and dev6d0c8efdaa. All four prerequisite items landed. README/SKILL conflicts combined with every section retained; agent source/test/client/identity unchanged. New state-inventory coupling fixed by using existing userHome(env) in cli/host.ts, preserving the same default/override without an exception. Root/final-hub typecheck, lint zero refusals, state inventory5/5, state resolver1/1 and frozen usage1/1 pass locally. Old Linux green receipt is pre-merge only. Delta review/fresh-verify decision requested next; no verification before clear.

### rev-35 · 2026-11-02T12:50:42.118Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1588-delta-source-1
commit: da0e7d2cf8a2a233106be8d4e004b1c5a16faf06
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized merge delta clear,no findings. Read Coordinatore1e4ac69 one-merge/prerequisite/preserve-sections instruction. Parents78c9+6d0; agent/client/identity/processidentity/native tests unchanged. Combined README/SKILL keeps complete agent+incomingHost/Git/fakeSSH content; independent parentheading inventory none missing,oneHost operations heading. CLIhost manual integration reuses shareduserHome(env)=env.HOME??homedir for default .cland-host/run, explicitCLAND_HOST_RUN_DIR still first; helper remains outsideagent built-ins boundary,no parallelresolver/exception. Normal default preserved,explicit suppliedHOME honored. Fresh mode-free verify REQUIRED at exact merged head: incomingruntime/CLI change cannot reuse78c9 A-15744 as current run. C1–C8 runtime marks remain stale pending named newhead agent18/boundary2/identity6/help/stateinventory facts. PremergeMac supplements retain oldhead/source-equality labels; no newhead claim. Reported localMac inventory5/resolver1/frozen1/static are targeted. A-15824 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15824-t-1588-authorized-merge-delta-review-at-da0e7d2cf.md). Reviewer ran no tests/browser and made no edits.

### rev-35 · 2026-11-02T13:13:58.460Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1588-final-2
commit: da0e7d2cf8a2a233106be8d4e004b1c5a16faf06
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Merged-head final clear,C1–C8 verified,no findings. Independently matched A-15834 current agent18/boundary2/identity6/CLIhelp7/frozenusage1/state-inventory1/state-pathslint5/resolver1/fakeSSH9/Gitdaemon4 pass facts. Full auth/framing/detachedspawn/admission/nativeexit/restart/stalebirth/unknownauthority/retainedresources/dedup controls pass; delta's sharedhome integration covered. C4 Linux proc currenthead; retainedMac18 A-15746 remains premerge78c9 unchanged-source supplement,not newhead execution: agent/native/identity/tests byte-identical and MacCLIfixtures explicitCLAND_HOST_RUN_DIR bypass changed default. Reconstructed provenance limits retained. Exact-head5fdd29f1 exit0/4765pass/zero fail,cancel,skip,todo;T0/T1/allfallbackT2/selectedT3threefiles31cases/Web complete,remainingT3batch,T4unexecuted. Baseonce/no reps;11.785s selectedaddedwall excludesmachinewait,not suitewall. Linuxx64 6.8.0-142-generic c8nyc1 Node24.21/Nvim.12.5 workers2;tree988fc70c883b82118964a163c938fc85eadbe75f;isolatedHeadlessShell1248/ChromeForTesting156.0.8078.4;cache/occasionnull,skips[],skipreasonreport/missing0. Budget/lint/ratchet advisoryonly,no fullpremerge claim. A-15835 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15835-t-1588-merged-head-final-evidence-at-da0e7d2cf.md). Reviewer ran no tests/browser and made no edits.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified, C8 verified.

### coord · 2026-11-02T14:00:51.578Z

Merged b8b1a95be01a62cba4a0d986d677b1bb2dbb9c0a onto dev.
