---
id: T-1727
kind: task
title: A Claude launch refused on a host stays "still supervised; cleanup is pending" with no generation receipt, blocking a relaunch of that name
state: open
status: ready
size: S
criterion_seq: 2
labels:
  - needs-triage
assignee: null
parent: E-1533
blocked_by: []
regression_of: T-1607
found_by: qa
topic: topic-1414
branch: t/T-1727-a-claude-launch-refused-on-a-host-stays
created: 2026-11-06T16:38:40.126Z
updated: 2026-11-06T22:10:59.528Z
---

## Summary

qa-678 hit this in E-1532's Definition-of-done run at dev 6f0cf6ae (row E1532D-21, CLI-started scratch hub, fake host f2). A Claude Code launch was refused by the account-root fence: `Claude account config root must be an agent-owned directory with mode 0700`. The fence is correct; the scratch root was 0755. The same refusal then reported `spawned process cleanup failed: cleanup-incomplete on host f2: Error: Claude generation receipt missing; cleanup is pending and the failed launch remains supervised`.
- The session list, the host's processes.json and launches, and the process census showed no cc.
- After the root was fixed to 0700, a relaunch of the same name was refused with `failed launch of "cc" is still supervised; cleanup is pending`.
So a refusal that happens before any Claude process starts leaves a supervised failed generation that waits for a receipt which can never arrive, and it blocks the name.

## What to build

A launch refused before spawn, or a spawn whose generation never produced a process, settles its supervision with a named terminal outcome: no receipt is expected when no process was started. A relaunch of the same name is then admitted. A genuinely unknown spawn outcome stays fenced, as today. Find where the failed-launch supervision waits for the generation receipt (the Claude stop owner and receipt path from T-1607/T-1673/T-1683).

## Acceptance criteria

- [x] C1. A Claude launch on a host refused by the account-root fence before spawn leaves no supervised failed launch, and an immediate relaunch of the same name is admitted (test, red before the fix).
  - done: impl-1727 · 2026-11-06T20:43:34.571Z
  - verified: rev-35 [reviewer] · run rev-35-1727-final-1 · 2026-11-06T22:10:59.370Z · commit fa013de2ec22fea55ed7c5e1bdcc88e62f29d4ae
- [x] C2. A launch whose spawn outcome is genuinely unknown stays fenced with its existing message (test).
  - done: impl-1727 · 2026-11-06T20:43:37.119Z
  - verified: rev-35 [reviewer] · run rev-35-1727-final-1 · 2026-11-06T22:10:59.370Z · commit fa013de2ec22fea55ed7c5e1bdcc88e62f29d4ae

## Comments

### coord · 2026-11-06T16:40:47.750Z

The effect is host-wide (coord, from qa-678's DoD run and a read-only source reading). After the refused cc launch, a fresh launch under a new name, cc2, on the same host was refused with `host f2: tunnel outcome unknown for claude-adopt:17b2477e-…; storage remains fenced`. In hub/src/host/ssh-host.ts, a failed `adopt-claude` adds `claude-adopt:<generation>` to the host's `unknown` set, and `check()` then fences later storage operations on that host. So one Claude launch refused before spawn leaves the whole host fenced for Claude operations, not just the session name. Scratch evidence (hub log, f2's agent log, the harness_pending_stops row) is retained in qa-678's run. The fix should settle the pre-spawn refusal without leaving an unknown admission. Add a test where a second session is launched on the same host after a refused one.

### coord · 2026-11-06T16:41:38.726Z

Confirmed by qa-678, read-only. cc's failed generation 17b2477e-1d3d-4f2e-8f14-fdc80e2b2be0 is exactly cc2's fence token. The failed launch stayed in phase launching with pid null, pending 354 s at the last observation, and its harness_pending_stops row reads stopped:true, rowRemoved:false, roleRolledBack:false. Source path:
- sessions.ts:934 hides pending rows from the list;
- :1087–1091 retries the cleanup every 5 s;
- :1344 fences the name;
- claude-code.ts:574–579 requires adoption before settlement;
- ssh-host.ts:201–214 keeps the host-wide unknown token.
The hub log repeats missing-receipt cleanup failures, and f2's agent output has no per-adopt diagnostic. So a launch refused before spawn retries forever, fences the host, and is invisible in the session list.

### impl-1727 · 2026-11-06T20:37:13.308Z

Rule 20 sweep before contract edit: searched adopt-claude/claude-adopt, unknown set mutations, generation receipt missing, account config root, LaunchSettled/settleFailedLaunch, RunResult/nativeCommandFailure, CLAND_AGENT_ADMISSION_REFUSED and claude-failed across production, all test tiers, docs, QA and shipped skills. Consumers: agent/claude.ts produces result; agent/server.ts routes run-host/adopt; agent/prepared.ts persists accepted result; agent/command.ts bounds results; ssh-host.ts run/recovery reads results and adopt/forget/release own unknown; adapters/claude-code.ts consumes launch result and persists failed generation phase; sessions.ts + launch-files.ts own failed supervision; generation-adapter.ts routes fallback. Other command result consumers: local-host, agent operations, native-stop, provider machine/connect, provider factories and tools, run-host callers. Additive optional result field only; retain old fields, no persisted failed-record change. SSH launchClaude alone will translate positively typed refusal into existing CLAND_AGENT_ADMISSION_REFUSED; missing field stays conservative. Existing remote-files untyped lookalike and missing receipt controls retain previous-shape compatibility. Tests implicated: claude-code-remote/files/launch/stop, host-agent/ssh/ssh-registry, host-survival-native, host-revoke-native, host-relaunch, launch-recovery, claude-code-accounts; command-output-limit, host atomic/phase/admission tests remain unchanged because generic command semantics do not change. Docs: adapters-and-sessions, host-agent, ssh-host and implement skill describe receipt boundary; QA briefs and startup probes consume no new field. New regressions use existing remote Claude frame-launch fixture, actual agent root validation, same-name and different-name recovery.

### impl-1727 · 2026-11-06T20:42:28.369Z

Rule20 follow-through: HostRunResult is the sole result shape; agent RunResult now aliases it. Added client regressions in host-command-environment.test.ts using previous wire shape, mismatched generation and exact generation. Legacy/mismatched receipts return without typed cleanup authority; only exact match maps to existing non-admission class. Agent producer tests also preserve ambiguous-discovery and already-admitted-generation fences. No unknown-set clearing code or failed-launch persisted shape changed.

### impl-1727 · 2026-11-06T20:52:59.840Z

Coordinator decision f5e95222 (2026-11-06): native known-no-process paths are in scope, nothing deferred. Owner must record no spawn call for already-aborted signal, or synchronous spawn throw / error with child.pid undefined; any observed PID, lost reply or missing/unreadable receipt stays unknown. Only typed native no-process result maps to settled non-admission. New red-first tests must check same-name and different-name admission after each known absence, and fences after PID-existed lost reply. Still S; existing rollback and command-result persistence are reused. Rule20 extension: native run()/RunResult/HostRunResult, boundedCommandResult, nativeCommandIncomplete/nativeCommandFailure, prepared.runCommand durable accepted result, server run-host and claude.launch, sshHost.run/launchClaude, Claude adapter failed-generation settlement and Sessions supervision are consumers. Generic run callers ignore optional no-process receipt and preserve existing error behavior; Claude launch alone maps it. Tests: native command tests, claude-agent-launch, remote Claude, client environment, remote-files, host native/relaunch/recovery/accounts/registry; existing old-wire shape controls retained. Docs/QA/skill receipt descriptions will be extended.

### impl-1727 · 2026-11-06T21:10:06.186Z

Coordinator decision 9be88778 (in addition to f5e95222): include pre-wire cancellation. wire() itself must detect its already-aborted signal before any write and emit CLAND_AGENT_ADMISSION_REFUSED with cancelled-before-send reason. Never classify generic AbortError name/text. Any partial/not-flushed write counts as sent; post-write abort grants no client non-admission authority and stays fenced absent positive native reconciliation. Add red-first same/different pre-wire retry cases plus sent-abort control. Still S.

### impl-1727 · 2026-11-06T21:10:54.271Z

Pre-wire extension sweep: wire() is shared by SSH spawn/run preparation; consumers are sshHost.spawn/run/launchClaude plus Host-contract and host-command-environment/remote tests. Typed cancellation affects only signal.aborted before wire creation; no generic AbortError matching. The host-ssh-contract Claude env test consumes the old returned refusal result and must migrate to typed rejection (same error assertion retained). For post-write abort proof, extend only sshHostFixture options with additive afterOperation callback routed through server's existing pre-reply hook; existing callers unchanged. Remote regression can cork the native reply after worker persistence, then abort before uncorking/disconnecting, proving sent ownership stays fenced. No production server protocol change.

### rev-35 · 2026-11-06T21:17:48.881Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1727-source-1
commit: b06292b6c343c1c7dd800c5f79ca0cad37d99a2d
scope: full
findings: [{"severity":"medium","text":"The native-aborted end-to-end control writes run-host then cancel-run without holding native admission until cancellation is observed. Stream order plus asynchronous preflight does not guarantee the signal is aborted before spawn; delayed cancel delivery can launch a PID and fail the intended no-process test under load. Add an owned held admission/cancellation receipt boundary before releasing native execution, retaining zero-spawn and immediate-retry assertions.","file":"hub/test/claude-code-remote.test.ts","line":35},{"severity":"medium","text":"nativeCommandIncomplete ignores the new positive owner receipts and classifies only error text. PreparedOperations.runCommand calls it before persisting the terminal result. A proven no-PID error or prevalidation refusal whose executable/cwd/config path contains 'cleanup incomplete' is therefore fenced instead of accepted, despite nativeAdmission/claudeAdmission. Make shared classification honor positive owner non-admission proof before the legacy text fallback, while preserving untyped/real incomplete fences; cover that path end to end.","file":"hub/src/host/agent/command.ts","line":16}]
finding_counts: {"high":0,"medium":2,"low":0}

A-17239: complete replacement source review, two medium findings. Native-aborted end-to-end fixture has no held admission/cancel receipt guarantee (confirmedce8ceda9); delayed frame delivery may exercise post-spawn cancellation. Shared nativeCommandIncomplete ignores positive owner facts, allowing path text 'cleanup incomplete' to fence proven non-admission before durable result persistence (confirmed839b0ae6). Correct both with shared classification and owned deterministic fixture, preserve real-unknown fences/old-wire controls. No other source finding. C1/C2 unverified; A-17232 working-candidate evidence qualified, original-output supplement pending. Fresh corrected source pin before configured verification.

### impl-1727 · 2026-11-06T21:19:12.109Z

A-17239 correction sweep before source edits: nativeCommandIncomplete/nativeCommandFailure consumers remain agent/prepared, agent operations/server command paths, SSH native failure handling and doctor/report exports; typed proof will precede only the existing error-text fallback, with no added authority at SSH generation matching. Tests must retain untyped/real incomplete result behavior. runStarted hook search across production/tests/docs/skills found AgentOptions/server invocation and sshHostFixture only. Extend its optional callback to awaitable with additive captured AbortSignal; existing fixture callback migrated, default production absent/unaffected. Fixture supplies a bounded hold until signal.aborted is positively observed, so deps.run cannot start first. No wire/protocol fields or replies change for this fixture fix.

### rev-35 · 2026-11-06T21:39:48.077Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1727-source-2
commit: a52f93a7339121b85967a98cdb15076e50f693af
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-17251: corrected cumulative source clear, no remaining findings. Awaited captured-signal runStarted owner plus one-shot positive abort gate resolves composed cancellation ordering. Shared explicit non-admission precedence resolves diagnostic path-text classification; bounded/untyped/real-incomplete and exact-generation compatibility controls preserved. A-17250 native/component close0/signalnull,16/16+52/52, declared hashes and seven source hashes independently match final bytes. Earlier A-17240 remains qualified prior candidate with transcribed producer completion/unknown child signals. Only twelve existing own allowance entries refreshed; Linux projection labelled. C1/C2 remain unverified pending exact-head configured evidence; after-stageQA separate.

### rev-35 · 2026-11-06T21:46:15.710Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1727-evidence-1
commit: a52f93a7339121b85967a98cdb15076e50f693af
scope: evidence
findings: [{"severity":"medium","text":"The committed agent closure still contains predecessor hashes for claude.ts, command.ts and server.ts. Same-head configured66df0bdd/A-17252 fails host-agent-closure before T2/native/Web. Regenerate the existing closure from the corrected agent graph and review the resulting metadata-only delta, preserving its full graph assertion and prior failed receipt.","file":"hub/src/host/agent/closure.json","line":1}]
finding_counts: {"high":0,"medium":1,"low":0}

A-17253: A-17252 same-head66df0bdd exit1. T0green/T1closure assertionred, T2/nativeT3/T4/Web unexecuted. Independently confirmed exactly3 stale recorded source hashes (claude/command/server) among32closure entries. Regenerate existing manifest and request corrected source review before another verify, preserve graph assertion/failed receipt. No new functional source finding. C1/C2 remain unverified; prior local native evidence stays separately qualified.

### rev-35 · 2026-11-06T21:47:36.434Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1727-source-3
commit: fa013de2ec22fea55ed7c5e1bdcc88e62f29d4ae
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-17255: corrected cumulative source clear. Entire delta only3closure SHA replacements; all32paths unchanged and every recorded hash independently matches Gitfa013 bytes; runtime/tests/full graph assertion unchanged. A-17254 retained original source-only red3/4 close1/null then green4/4close0/null, declared hashes checked. Resolves A-17253. Prior native/preservation evidence limits stay labelled; failedA-17252 remainsfailed. C1/C2 unverified until fresh exact-head configured run; after-stageQA separate.

### rev-35 · 2026-11-06T22:10:59.371Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1727-final-1
commit: fa013de2ec22fea55ed7c5e1bdcc88e62f29d4ae
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-17270: final same-head clear,C1/C2verified. Independently parsed A-17269 exit0 hub5361/base5210, five empty failure arrays, matching reconstructed projectiondcaaca699c65e036c47d00e06c5a99620d218f70. All12same/other-name and4native-owner identities pass; both rootrefusals immediately retry, lost/sent outcomes retain exact fences.12new component identities each base+5distinct loadpass; closure4pass. T0/T1/allT2/changedT3twofiles67identities once/Web complete; remainingT3deferred,T4unrun. Linuxx64Node24.21/Shell1248CfT156 provenance checked; lifetime/cost unavailable in retainedlog, notzero. Qualified prior native/source evidence remains separately labelled; failedA-17252retained. Affected after-stageQA separate.

Criteria: C1 verified, C2 verified.
