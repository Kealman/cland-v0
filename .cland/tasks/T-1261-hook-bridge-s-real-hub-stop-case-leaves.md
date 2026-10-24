---
id: T-1261
kind: task
title: hook-bridge's real-hub stop case leaves a Timeout open in projectHub on Linux
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - needs-triage
assignee: null
parent: E-1197
blocked_by: []
topic: topic-1008
branch: t/T-1261-hook-bridge-s-real-hub-stop-case-leaves
created: 2026-10-24T20:24:45.140Z
updated: 2026-10-24T22:15:53.405Z
closed: 2026-10-24T22:15:53.405Z
---

## Summary

`hub/test/scenarios/hook-bridge.test.ts:14` "a bridge exits after its real hub stops even while its parent and stdout remain alive" failed three times on Linux droplets on 2026-10-24, each time with `projectHub leaked resources … resources: ['Timeout']` (hub-resources.ts:30 via process-cleanup.ts:63):
- periodic dev T3 5564ec58 at da2d0e6f (A-11297)
- periodic dev T3 679cfcb8 at 8fd6195f (A-11364)
- stage cover 53e77774 at fdcea0b9 (A-11388, shard-2)

It passed in the culprit-search rerun 674fcc32 at da2d0e6f, in T-1255's verify all 1e7e5d01, and on macOS covers. The last green periodic run was at 89e5c304. Something started since then leaves a hub timer unref'd or uncleared at stop, intermittently.

## Acceptance criteria

- [x] C1. The timer the in-process hub leaves after stopping is identified (its creation site) and is cleared on stop, with a red control reproducing the leak (test).
  - done: impl-1261 · 2026-10-24T21:54:13.277Z
  - verified: rev-32 [reviewer] · run rev-20261024-1261-source2 · 2026-10-24T21:54:57.641Z · commit f7aec632b2385c57f5eec7890d8abcc5f1098b72
  - verified: rev-32 [reviewer] · run rev-20261024-1261-final · 2026-10-24T22:10:01.767Z · commit f7aec632b2385c57f5eec7890d8abcc5f1098b72
- [x] C2. On a Linux droplet at 2 workers, the item's mode-free verify passes the hook-bridge case and the new deterministic held-native reproduction passes its load-gate repetitions (test).
  - done: impl-1261 · 2026-10-24T22:09:40.217Z
  - verified: rev-32 [reviewer] · run rev-20261024-1261-final · 2026-10-24T22:10:01.767Z · commit f7aec632b2385c57f5eec7890d8abcc5f1098b72

## Comments

### coord · 2026-10-24T20:31:10.072Z

Local Darwin arm64 at fdcea0b9: hook-bridge.test.ts run alone 5/5 passed (coord scratch clone, one file at a time). macOS stage cover 9c0ab09c at the same SHA was green. The leak so far shows only on Linux droplets; one Linux cover resubmit 14d0d24a is running under the flaky-rerun rule.

### coord · 2026-10-24T21:40:16.649Z

Another Linux occurrence: E-1216 stage cover 0001a9d2 (droplet c-8 lon1, dev 5205aeb6, log A-11486) failed scenarios/hook-bridge.test.ts "a bridge exits after its real hub stops even while its parent and stdout remain alive". The only other failure in that run was T-1263's deterministic accounts regression. That makes two Linux stage covers today with this test red.

### impl-1261 · 2026-10-24T21:43:44.087Z

Deterministic native control: place agents-hold in the fake Claude config directory, wait for agents-started PID, then stop the restarted projectHub. Red on macOS: held query PID remains live at stop. async_hooks stack identifies Timeout(_idleTimeout=15000, _onTimeout=delayedKill) at node:child_process execFile -> hub/src/adapters/claude-code.ts:#run (line 308), called by #agents. Ordinary scenario passed 12 local standalone executions before forcing the window. Planned contract inventory before making Adapter.close optionally awaitable: production consumers are Sessions.close and projectSessions.close, served by daemon.stop (already awaiting). Implementers ClaudeCodeAdapter, CodexAdapter, OpenCodeAdapter and fakeHarness: synchronous close remains supported; only Claude gains an optional drain. Direct Claude test consumers: claude-code-schedule, claude-code-environment, adapter-native-boundary, session-cwd and scripted fake wrappers in claude-code-sessions; pending native work will be awaited where relevant. Other adapter-specific tests/fakes remain synchronous and unaffected. Search covered hub/nvim/web production + all hub test tiers, docs, .agents skills and qa; no wire/snapshot/list/persisted client uses Adapter.close. Existing synchronous fake close stays as previous-contract compatibility coverage.

### impl-1261 · 2026-10-24T21:50:32.407Z

Rule-20 expanded close-consumer inventory (before corrected-head review):
Production adapters: ClaudeCodeAdapter now returns void|Promise<void>; CodexAdapter and OpenCodeAdapter retain synchronous close. Test adapters: FakeHarness (hub/test/fakes/harness.ts), inline adapters in request-guard.test.ts and tracker-native-boundary.test.ts retain synchronous close; ComponentClaude in mod-bridge.test.ts inherits Claude close but overrides native spawn/watch, creates no CLI command. Compatibility remains void|Promise, so all old synchronous implementations remain valid.
Composition owners: Sessions.close starts every registered adapter.close and includes returned promises in its pre-storage-close drain, preserving failures; projectSessions.close awaits Sessions plus every unregistered factory adapter before ProcessTable.close (including construction failure cleanup, which observes its drain rejection); daemon.stop awaits projectSessions.close. projectHub fixture shutdown awaits daemon.stop; nativeProjectHub uses this same path. Callers of Sessions.close/projectSessions.close (tests and production) already return/await their existing optional promises.
Direct Claude consumers: claude-code-schedule.test.ts after hooks return adapter.close; its shared-schedule restart calls close only after awaited spawn with FakeClock (no held native command), so void remains sufficient there; held-query test explicitly awaits close and will unconditionally release/drain on failure. claude-code-environment.test.ts finally blocks follow completed awaited scripted spawn/resume/stop; fake-clock cases have no active CLI, and real-clock scripted calls complete in microtasks, so no deferred native ownership escapes. adapter-native-boundary.test.ts first after hook returns adapter.close; its shared fixture cleanup calls close after awaited launch/failure, pollMs=600000 normally, no held Claude query in its failure matrix (native command completed before boundary assertions), so no deferred Claude flight is outstanding. claude-code-sessions.test.ts wrapper uses Claude only for interpretation (bin unused-claude); it never calls native spawn/watch, hence interpreter.close is synchronous and fake.close stays synchronous. mod-bridge.test.ts ComponentClaude close travels through Sessions as above. claude-code-accounts.test.ts constructs production Claude but closes only via projectHub, which now awaits its drain. Correction to earlier inventory: session-cwd.test.ts's direct adapter is Codex, not Claude; unchanged synchronous close is valid there.
Indirect native T3 contracts/scenarios use nativeProjectHub -> daemon -> projectSessions -> Sessions; no extra close owner. No persisted readers, startup probe, wire client, Neovim/web caller, shipped skill example or QA brief directly invokes adapter.close. Documentation contract and implementation skill now describe the optional drain.

### rev-32 · 2026-10-24T21:53:50.653Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261024-1261-source
commit: 5997cbb21b4a78b881004d08a6d5633cdae7532c
scope: full
findings: [{"severity":"medium","text":"M1: The new held-query regression releases native.pending only on its success path. If a cancellation/pending-close assertion fails before line85, t.after returns adapter.close's unresolved drain while the only held callback is never released, so cleanup hangs rather than reporting the failure. Register unconditional release plus bounded drain before after hooks/mock restoration, preserving every final assertion.","file":"hub/test/claude-code-schedule.test.ts","line":74}]
finding_counts: {"high":0,"medium":1,"low":0}

# T-1261 full source review

Head5997cbb21b4a78b881004d08a6d5633cdae7532c; treec5d2b8a1c898f2c7f4d7eb6220e53b7204d05538. Parents899921207be1aa0b7b68929c93d7c2f2093b1702 and b90f40d4379a66de4f1e5de2f6ed4589e996ad8c. Pinned diff b90f40d4...5997cbb2,12files108insertions/14deletions. The pre-first-review dev merge changes incoming unrelated tracker/docs/artifact work but not the changed adapter/test production bodies. git diff --check passes. Standards/Spec audited personally, no delegation, source edits, tests or probes by reviewer.

## Standards

M1 (medium), hub/test/claude-code-schedule.test.ts:74–85: the new held-query regression only releases its callback after its cancellation and pending-close assertions pass. A failure at either assertion skips native.pending.shift()(); t.after(() => adapter.close()) returns the same unresolved drain, waiting for that never-released callback. This can hang the file/teardown rather than expose the intended regression. Put unconditional release and bounded drain in failure-safe body cleanup ahead of after hooks/mock restoration. Keep SIGKILL, close-still-pending, exact callback completion and fake-time no-new-command assertions. This is source-established at the pinned committed head; no reviewer reproduction.

Production path otherwise looks sound for this defect: #run rejects new work after close, retains each transient execFile handle until its callback settles, handles failure through a nonrejecting settled promise, and removes ownership after that receipt. close cancels transient commands with SIGKILL and returns their drain while established harness sessions remain alive. It is idempotent through #closed/#closing. #agents checks closed before publishing/saving a completed snapshot, clears its flight and does not reschedule after closure. Existing process-identity poll checks also guard post-await mutation.

Sessions.close retains void compatibility, accumulates adapter promise rejections while settling all drains/lifecycle/credential/archive work, and projectSessions closes its table only after those drains. Unregistered adapter cleanup follows the same path. Both daemon.stop and createHub/server.close await ProjectSessions.close, including createHub's failure path. Direct wrapper that uses only Claude interpretation starts no native work; Codex/OpenCode/fake adapter synchronous closes remain unchanged. Consumer inventory is being expanded with explicit no-flight/await reasons at claimant's initiative; that bookkeeping does not clear M1 or change the pinned source verdict.

New tests are appropriately split: deterministic scripted cancellation/callback state at T2, real native execFile deadline/PID/resource observation in the existing T3 bridge scenario. Native agents-started is written only after the agents-hold gate is entered, so the test obtains the exact held-query PID. Resource census runs immediately after awaited restart stop, before the later bridge grace can hide the deadline; final reaped query PID, bridge exit, live harness parent and no replacement bridge assertions remain. Existing shared native fixtures keep owned roots and teardown ordering; observer setup precedes the held query. No new wall-clock latency assertion or relaxed deadline introduced.

## Spec

A-11502 retains the actual local red diagnostic: projectHub leaked PROCESSWRAP/PIPEWRAP/Timeout and an async_hooks creation stack naming Node execFile delayedKill15000ms at ClaudeCodeAdapter.#run/#agents. This identifies the timer and motivates cancelling/draining its transient command instead of suppressing the resource checker. Without holding the query, twelve ordinary local runs passed, explicitly not evidence of absence. C1 implementation is represented; its new regression needs reliable failure cleanup before source clearance.

Contract/README describe optional promise close, storage ownership and preserved established harness sessions. Both per-file guides/index plus implement SKILL/CHANGES match the change; no CLI/setting/role/wire/persisted-shape change. Existing synchronous fake contract remains exercised. C2 is deliberately pending one same-head configured Linux droplet run at2workers, changed native T3 case plus actual newT2 load repetitions; no ten-cover or broader confidence is inferred here.

## Evidence limits and disposition

A-11502 is local Darwinarm64/Node24.21.0 uncommitted-pre-review red/green summary/excerpts, not raw configured Linux evidence. Claimant reports schedule19/19, hookbridge1/1 and root typecheck; no file walltimes or exact final-head runtime receipts are established. Preserve available original call/output/exit/timing records and creation-stack capture with their actual source limits, without transcription reruns.

Claimant reports an uncommitted correction and deliberate wrong-SIGTERM mutation that now exits1 promptly. Neither is part of5997cbb2 and neither was reviewed as committed source; retain those originals for the next request. Complete source finding set at5997cbb2 is M1 only. Record not clear/C1failed, C2pending. After fixing, commit/push, restore C1done and request fresh source review before verification. No full-suite, Linux, native-provider or QA/landing claim.

Durable review: A-11513.

Criteria: C1 failed (Held-query regression can hang cleanup if cancellation/drain assertions fail before callback release.).

### rev-32 · 2026-10-24T21:54:57.641Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261024-1261-source2
commit: f7aec632b2385c57f5eec7890d8abcc5f1098b72
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1261 corrected source review

Reviewed f7aec632b2385c57f5eec7890d8abcc5f1098b72, tree 5fa1d3750c6e8b1bb83f3f18df47a050d066171a, sole parent 5997cbb21b4a78b881004d08a6d5633cdae7532c. Read-only Standards and Spec review in-session; no delegation, edits or reviewer test executions. Scope full for corrected source, carrying the complete production/consumer audit in A-11513. Diff from the prior reviewed head contains only the regression cleanup and its per-file guide; production is unchanged. git diff --check produced no findings.

## Standards

M1 is resolved. The test body now owns cleanup with try/finally (hub/test/claude-code-schedule.test.ts:75–98). Before any after hook can restore execFile or remove the host root, finally starts or reuses adapter.close, releases every held native callback, then awaits the close drain through the existing bounded receipt helper. The deliberate cancellation assertion, close-still-pending assertion, callback completion and no-later-command assertions are all preserved. The closing operation is idempotent and the finally block also handles failure before the original close call. The guide describes the same ownership order. No additional findings.

The expanded item inventory names synchronous implementations, composition owners and direct Claude close consumers with explicit await/no-flight reasons; its correction that session-cwd uses Codex agrees with the prior audit. Production cancellation/drain, post-close scheduling/publication guards, storage ordering and synchronous close compatibility remain as reviewed in A-11513.

## Spec

C1 is source-established across A-11502/A-11513 and this correction: the captured creation stack identifies execFile's delayedKill timeout in Claude #run/#agents, close cancels and drains the transient command, and the held native bridge regression retains PID/resource assertions. The deterministic cancellation test now fails without stranding its held completion. No assertion or timeout was relaxed.

A-11522 retains original local Darwin arm64/Node24.21.0 outputs with explicit uncommitted-correction attribution: deliberate wrong-SIGTERM assertion exited1, fail1/cancelled0, Node duration381.335ms; restored schedule file19/19 exit0, Node duration1455.87ms, corrected case7.396292ms; root typecheck exit0. These are implementation-tree local evidence, not exact immutable-head Linux task evidence, suite wall times or new reviewer executions. No transcription reruns are inferred.

C2 remains unverified and pending the authorized same-head mode-free Linux droplet verification at2workers, including the real changed-T3 hook-bridge case and the new deterministic T2 load-gate repetitions. No full-T3, ten-cover, QA, native-provider or landing confidence claim.

Disposition: clear source at f7aec632; verify C1 only, findings[]. Standards0; Spec0.
Durable review: A-11523.

Criteria: C1 verified.

### rev-32 · 2026-10-24T22:10:01.767Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261024-1261-final
commit: f7aec632b2385c57f5eec7890d8abcc5f1098b72
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1261 final same-head evidence review

Reviewed head f7aec632b2385c57f5eec7890d8abcc5f1098b72 (tree5fa1d3750c6e8b1bb83f3f18df47a050d066171a), unchanged branch tip and current source-clear verdict rev-20261024-1261-source2/A-11523. task.view confirms run27da367a-4e56-486f-b6af-713c6b43ffbe passed at that exact head. Read-only evidence audit; no reviewer tests or source changes.

## Standards

No new findings. A-11534 is a fresh mode-free configured task receipt, exit0. Parsed native suite progress records independently show3067 ordinary passing tests and435 passing file records, plus five separately scoped load-gate tests/file records; no failed/cancelled/skipped outcomes. Load repetitions are not added to the ordinary total. Explicit worker selection is2 (log9–11); Web internally uses4 workers. Linux x64 6.8.0-142-generic, c-8 lon1 droplet cland-v0-1759841c, Node24.21.0, Neovim0.12.5. Droplet lifetime791s and cost$0.0549 are machine lifetime/cost, not suite wall time.

T0 host npm run check exit0/25.87s is separate host evidence: macOS gate tree d4ea6e94c6f9a17d082554e3185d0d0de3fadef9 was reused, not repeated on Linux (log173). All T1, shared-contract fallback all hub/Neovim T2, changed T3 hook-bridge file once, mapped T4 inbox-verifier-load guard once and Web completed on Linux. Phase receipt envelopes74/402/10/8/178s differ from internal runner walls68.99/397.48/5.57/2.62/174.32s. No remaining T3/T4, all-tier cover or ten-cover claim. T4 load repetitions explicitly skipped by configured policy; base guard did run. Web uses isolated Chrome Headless Shell156.0.8078.4/Playwright1248.

Report-only timing/budget/lint/ratchet warnings remain warnings: lint133 findings/60files, no lint refusals; Web over its40s wall budget; existing would-fail durations/missing baseline retained. Final T3 ratchet2197.138s equals base2197.138s. This is no enforce-mode performance clearance.

## Spec

C1 carries the creation-stack/red-control and corrected source evidence in A-11502/A-11513/A-11522/A-11523. The actual held execFile command is now cancelled and drained at shutdown, with failure-safe fixture ownership.

C2 is established by exact receipts, not suite exit alone. The new T2 held-query regression base pass is0.025743498s (log6027), followed by five distinct scope=load-gate finish/pass records at0.027351258/0.022680994/0.020752184/0.025011958/0.026525088s (log6087–6251); log6254 confirms5/5. These ran under the configured2-worker load gate. The schedule file base record passed,6.030272919s.

The native changed-T3 hook-bridge scenario passed once at4.511131710s (log15405–15409), with the source-reviewed immediate post-stop resource census, held-query PID reaping, bridge exit and retained live harness-parent assertions intact. Changed phase added5.514s excluding machine wait is phase overhead-inclusive wall, distinct from test duration. Mapped T4 guard '100-frame verifier delivery bursts never scan retained message history' also passed once,1.500761058s; not repeated. No Linux native-provider, QA or broader post-landing confidence is inferred.

Disposition: clear evidence at f7aec632; C1/C2 verified across source and same-head configured runtime. Findings[]. Standards0; Spec0.
Durable review: A-11535.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-24T22:15:53.405Z

Merged 90da1923109479c90df0fd634edcfab592ed8c9d onto dev.
