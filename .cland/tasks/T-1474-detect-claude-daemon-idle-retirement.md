---
id: T-1474
kind: task
title: Detect Claude daemon idle retirement
state: open
status: ready
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1468
blocked_by: []
topic: topic-1225
branch: t/T-1474-detect-claude-daemon-idle-retirement
created: 2026-10-30T07:50:18.630Z
updated: 2026-10-30T08:40:24.561Z
---

## Summary

The daemon retires a background session idle at the prompt for 60 min (`bg retire <id>: idle-prompt, idle 60m`: 10-18, 10-20, 10-21, 10-24, 10-30). With one process, that took coord offline silently on 10-20 and 10-24.

Root cause: A-14159 (deaf-bridge RCA, 2026-10-30). Epic E-1468.

## Acceptance criteria

- [x] C1. When a hub-launched Claude Code job disappears from `claude agents --json`, or its job reports `done`, while the row is running, the hub logs `harness-exited` with reason `retired` within 60 s.
  - done: impl-1474 · 2026-10-30T08:20:02.523Z
  - verified: rev-32 [reviewer] · run rev-20261030-1474-evidence1 · 2026-10-30T08:40:23.156Z · commit 1ed304429a5c0f156cccc7583347ed9571bdd87e
- [x] C2. A retired Coordinator gets one human inbox entry with the relaunch command within 2 min.
  - done: impl-1474 · 2026-10-30T08:02:09.680Z
  - verified: rev-32 [reviewer] · run rev-20261030-1474-evidence1 · 2026-10-30T08:40:23.156Z · commit 1ed304429a5c0f156cccc7583347ed9571bdd87e

## Comments

### impl-1474 · 2026-10-30T07:55:52.290Z

Consumer inventory before contract extension: searched exited callbacks/calls, harness-exited and stateOfAgent throughout hub/src, hub/test (all tiers), web, nvim, shared, .agents/skills, qa and docs. AdapterHost.exited producers are Claude/Codex/OpenCode and fixture hosts; Sessions owns callback/logging. Optional third reason keeps all 2-argument producers compatible. Journal/events/Agents/visibility consume harness-exited generically and retain previous fields; inbox consumes existing role vacancy and coordinator-exited notice, unchanged. Existing native adapter/lifecycle/stop/re-exec tests retain old callback shape. No wire schema or persisted record parser changes.

### impl-1474 · 2026-10-30T07:59:00.392Z

C2 consumer extension: new hub notice kind coordinator-retired is admitted by Store.inboxMessages and classified as a human message by Visibility; InboxBoard and web/nvim/remote inbox renderers consume the unchanged Inbox.messages shape. Raw/frame clients, QA fixtures, startup probes, persisted message readers and tests searched for inboxMessages/inbox.list/coordinator-exited/notice kind/visibility. Existing kinds remain unchanged; old hub/client wire remains valid. Per Coordinator direction notice identity is session+native job, and successful reconnect/resume marks that exact notice read. No role-clause additions or command/default changes.

### impl-1474 · 2026-10-30T08:06:33.870Z

Review fixes M1/M2 in progress: terminal-only native-job lookup independent of conversation-first discovery, explicit no-job legacy controls, per-query hook revision fence. New same-conversation job-order and held-query ownership regressions bring targeted local file to 34/34 passing (macOS, Node24.21, fake-clock/scripted CLI; 1.803 s whole file, not a native timing measurement). Typecheck passed before adding legacy test cases; lint/final typecheck pending. Holding replacement request until reviewer consolidates findings.

### rev-32 · 2026-10-30T08:08:23.135Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261030-1474-source1
commit: be8b75e396f72c7e3b8f6cbdc1b772536e4ae8ce
scope: full
findings: [{"severity":"medium","text":"M1: Decide retirement by the admitted native job identity, independently of conversation-first #find. Two entries may share the same conversation: job B done before live job A causes A to retire, and B can also mask A's disappearance. Capture/recheck harnessId, select its exact entry for terminal status, and explicitly preserve legacy no-job behavior. Add both array orders and live/done/missing own-job controls.","file":"hub/src/adapters/claude-code.ts","line":703},{"severity":"medium","text":"M2: Reject a terminal directory observation superseded by a state hook during the native query. The current conversation comparison permits a same-conversation hook to report live activity after a held missing/done observation was captured; completion then unwatches and exits the live job, bypassing Sessions' push freshness fence. Capture an observation/hook revision for each launch and recheck before terminal publication. Held-query controls must preserve the running row, role, claims and absence of remedy until a later fresh terminal observation.","file":"hub/src/adapters/claude-code.ts","line":705},{"severity":"medium","text":"M3: Separate General retirement notice deduplication from the Agents journal replay checkpoint. Passing claude-retired:... as notice.id invokes core.ts #recordNotice's unconditional AGENTS_JOURNAL_CHECKPOINT update, although that ID is absent from agentsNotice journal entries. Agents projections are deferred microtasks; shutdown/crash before their projection can leave this foreign checkpoint, causing replayAgentsRecord to skip pending lifecycle records on reopen. Add a persisted General notice plus pending journalled lifecycle reopen control and preserve retention replay semantics.","file":"hub/src/adapters/sessions.ts","line":1806}]
finding_counts: {"high":0,"medium":3,"low":0}

Full source review A-14171: three medium findings M1–M3. Terminal job identity and same-conversation hook freshness are not safe, and General notice deduplication violates the Agents replay checkpoint contract. C1 failed; C2 remains runtime-unverified. Local claimant evidence A-14164 is scripted/FakeClock macOS evidence, not a configured or native retirement SLA receipt. No successor fixes are covered.

Criteria: C1 failed (M1/M2: conversation-first lookup and an unfenced held directory observation can retire an active native job or miss its disappearance.).

### impl-1474 · 2026-10-30T08:09:58.895Z

M3 consumer audit: searched AGENTS_JOURNAL_CHECKPOINT, replayAgentsRecord, agentsNotice and deterministic noticeInTopic writers. Checkpoint consumers are replayAgentsRecord and checkpoint/admission-close tests; Agents recorder continues writing exactly its own ids. General deterministic vacancy/retirement notices retain message-id deduplication but no longer move the Agents checkpoint. Added actual SQLite Store reopen regression with an unprojected journal lifecycle tail; red reproduced checkpoint overwritten with claude-retired:session:job, then all 7 checkpoint cases passed after the topic guard. Existing journal wire shape unchanged.

### rev-32 · 2026-10-30T08:17:22.473Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261030-1474-source2
commit: 4b500fc6d69e31bb1e631eaff6c1fae65c59e2fd
scope: full
findings: [{"severity":"medium","text":"M4: Add the owning linked-path/Notes index entry for the new agents-checkpoint guide. docs/agents/tests/index.md has no agents-checkpoint entry at this head, so the unchanged test-docs guard rejects the new unindexed document. Preserve the guard and original red/green output.","file":"docs/agents/tests/hub-test-agents-checkpoint.test.ts.md","line":1},{"severity":"medium","text":"M5: Fence terminal observations against replacement of the watched launch during native I/O. The poll captures only conversation strings, then iterates current watched rows and #job reads their current harnessId. Replacing job A with job B under the same cland session/native conversation while A's query is held leaves the conversation check true and advances no hook revision; watch(B) marks it listed, so A's listing can retire/unwatch B as missing. Capture launch object/job identity before observation, require it to remain current, and add a same-conversation held replacement regression.","file":"hub/src/adapters/claude-code.ts","line":713}]
finding_counts: {"high":0,"medium":2,"low":0}

Full source2 A-14181: prior static job matching, same-conversation hook freshness and General checkpoint issues corrected. Two medium findings remain: M4 new guide has no owning index row; M5 terminal application reads the current job after I/O without requiring the watched launch/job identity captured for that observation. C1 failed; C2 remains runtime-unverified. A-14173 is local scripted/FakeClock evidence only. No configured verification until fresh source clearance.

Criteria: C1 failed (M5: a held native directory observation is not fenced against a replacement job under the same cland session and native conversation.).

### rev-32 · 2026-10-30T08:21:25.413Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261030-1474-source3
commit: 1ed304429a5c0f156cccc7583347ed9571bdd87e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source3 clear, A-14185. M1–M5 corrections inspected: exact native job matching, per-query hook freshness, General/Agents checkpoint isolation, owning guide index row, and native-query captured object/job identity across shared flights. New object/in-place replacement controls require stale observation and later fresh live poll. C1/C2 remain runtime-unverified; local scripted/FakeClock evidence excludes native SLA/configured suite proof. Configured mode-free verification may proceed at this unchanged head, followed by original-record final evidence review.

### rev-32 · 2026-10-30T08:40:23.156Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261030-1474-evidence1
commit: 1ed304429a5c0f156cccc7583347ed9571bdd87e
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final original-record clear A-14206. Same-head A-14204 / 674da889 exit 0: parsed 4242 ordinary test passes, 514 files, 80 explicit load passes/80 files, zero nonpass or unmatched starts. Own 36 scheduling + 7 checkpoint primary cases pass; 16 new identities each have 5/5 load passes. Missing/done retirement, exact reason/inbox/restart assertions, shared conversation/hook/replacement/legacy controls and SQLite checkpoint reopen checked against source. C1/C2 verified at configured scripted CLI/FakeClock seam; actual native Claude/OS SLA latency unmeasured. Host T0 reused separately, all T1/T2 + mapped T4 once + Web pass; T3 deferred, T4 repeats skipped. Report-only warnings retained, no enforce-mode budget claim. Coordinator owns landing sequencing.

Criteria: C1 verified, C2 verified.
