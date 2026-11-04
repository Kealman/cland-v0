---
id: T-1607
kind: task
title: Claude Code sessions on a host
state: open
status: in progress
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by:
  - T-1600
  - T-1601
  - T-1556
topic: topic-1375
branch: t/T-1607-claude-code-sessions-on-a-host
created: 2026-11-02T03:33:57.061Z
updated: 2026-11-04T04:09:59.913Z
---

## Summary

A Claude Code session on a fake host runs `claude --bg` through the agent, with its `mcp.json` and `settings.json` on the host. It finds its worker with one `claude agents --json` (T-1556), adopts the worker into the agent's table, and reports state through hooks and the mod bridge on the host. These reach the hub through the forwarded `hub.sock` with the host's secret and the session's credential.

Hot files: `hub/src/adapters/claude-code.ts`, `hub/src/host/agent/processes.ts` (adopt), `hub/test/claude-code-remote.test.ts` (new)

## Acceptance criteria

- [x] C1. Through the frame protocol a Claude Code session launched on a fake host with the scripted Claude fake receives a delivery and reports its state from its hooks (test).
  - done: impl-1607 · 2026-11-03T23:33:48.830Z
- [x] C2. The worker found by the one `agents --json` is adopted into the host agent's table with its Linux identity, and liveness and stop go through the agent (test).
  - done: impl-1607 · 2026-11-04T03:28:25.610Z
- [ ] C3. The session's hooks and mod bridge connect through the host's `hub.sock` and are dispatched as that session, and their settings carry host paths only (test).
  - failed: rev-36 [reviewer] · 2026-11-04T04:09:59.913Z · note Required mapped Claude launch preservation cases fail close with supervised failed generation; recording observer not migrated to typed non-admission/settlement contract.
- [x] C4. Over several poll intervals no short-lived `claude` command runs on the host for the running row (test).
  - done: impl-1607 · 2026-11-03T23:33:49.321Z
- [x] C5. The claude-code-adapter, claude-code-sessions and claude-code-schedule test files pass with no test edited.
  - done: impl-1607 · 2026-11-03T23:33:49.436Z

## Notes

Shared files: `hub/src/adapters/claude-code.ts`

## Comments

### impl-1607 · 2026-11-03T22:03:54.501Z

T-1607 Claude Code sessions on a host: read A-15100/A-15370/A-15588, spec/decisions, T-1599/1600/1556/1601 and comments. Before-edit consumer inventory published in item topic. Coordinator d658d9eb approves optional Host.adopt + capability gated agent operation, identity/launch proof required and older-agent explicit refusal. Existing credential is CLAND_LAUNCH_TOKEN in private launch files, not a new credential variable. Asked lead to settle safe positive launch proof for detached/reparented workers before implementation.

### coord · 2026-11-03T22:20:59.641Z

Coord decision 2026-11-03 22:21Z on the launch-token scan versus the Claude job record. No source documents real `claude --bg` job-record content, so it is treated as possibly holding settings content. CLAUDE_CONFIG_DIR stays the account's existing config root (account_env); there is no relocation, symlink or credential copy. Precondition: the root is realpath'd, owned by the agent user and mode 0700, otherwise launch is refused by name. The session's jobs/<pinned job id>.json is generation-owned and removed by pinned id after a confirmed stop or rollback; sibling records are untouched. Scan: while running, the token appears only in the generation's private files and that one job record; after stop or rollback, nowhere (host home, fake home, generation folders). The fake's home is the fake account root, 0700.

### impl-1607 · 2026-11-03T23:15:24.458Z

Extended consumer inventory (A-16352): optional adoption receipt now carries release/forget closures and closed/released facts; production consumers remain SSH Host, agent Claude/server/process ledger, and Claude adapter launch/resume/stop. AgentReply's existing optional code transports explicit CLAND_CLAUDE_GENERATION_MISSING; client remains compatible with prior replies without code. MissingClaudeGeneration carries only idempotent forget, never process authority, and is used only with a matching durable hub private-deletion checkpoint. Searched AgentReply/adopt-claude/remove-claude/forget-claude/MissingClaudeGeneration across hub/src, hub/test, shared, web/src, nvim/test, qa, skills/docs. No other consumers found beyond protocol, the new paths and their fixture/tests. Coordinator 4b7813f6/b00e4c85: terminal released receipt + final forget; bound one receipt per active/cleanup-incomplete generation, zero after confirmed cleanup, no time eviction. T-1666 owns revoke/remove settlement before the authority cut; T-1607 does not touch revoke. Host-SSH observer migration includes unshimmed config refusal. C5 files remain unedited.

### rev-35 · 2026-11-03T23:42:22.644Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1607-source-1
commit: fc90db2db73ce368db03c268460693f40519d366
scope: full
findings: [{"severity":"medium","text":"Validate and pin jobs/ before --bg: the current symlink/non-directory check runs only after Claude may copy private settings through it outside the approved account root.","file":"hub/src/host/agent/claude.ts","line":89},{"severity":"medium","text":"Do not infer adopted-tree closure from root absence plus the old target set: a hook born after reconcile's capture can remain live while #capture marks the row closed and prepare-stop returns success.","file":"hub/src/host/agent/processes.ts","line":310},{"severity":"medium","text":"Settle remote generation ownership before publishing a timer-detected exit: the current path un-watches/vacates the session without tree/native-job confirmation, release, private-file removal or forget.","file":"hub/src/adapters/claude-code.ts","line":928},{"severity":"medium","text":"Hand failed remote launches to a durable recovery owner: close after an accepted launch result reaches rollback before adopt with pid:null, and native-incomplete failures keep only an adapter-local map/phase-only fence; Sessions receives no owned process or LaunchRecoveryPending.","file":"hub/src/adapters/claude-code.ts","line":589},{"severity":"low","text":"Bound the concurrent-release setup wait: if remove returns without invoking settled, entered.promise never resolves and this regression hangs instead of reporting the missing receipt.","file":"hub/test/claude-agent-launch.test.ts","line":57}]
finding_counts: {"high":0,"medium":4,"low":1}

Full source review: four medium and one low finding; details and held-boundary regression suggestions in A-16407 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16407-t-1607-full-source-review-lifecycle-and-confinement-findings.md). Medium: preflight jobs/ before native command; preserve incomplete ownership for late unowned hook at adopted capture; settle timer-detected remote exits before retirement; durably hand off failed remote launches including close-before-adopt. Low: bound concurrent-release test setup wait. C2/C3 failed; C1/C4/C5 remain run-dependent/unverified. C5 files unchanged against base. No Reviewer execution, queued Linux run, browser or QA evidence claimed. Fresh source review required before verification.

Criteria: C2 failed (Normal/failure terminal paths lack durable settlement ownership, and adopted capture can acknowledge tree closure while an unowned late hook remains alive.), C3 failed (jobs/ symlink validation happens after Claude can copy the private credential outside the approved account root.).

### impl-1607 · 2026-11-03T23:55:27.799Z

A-16407 correction checkpoint underway: jobs preflight/pinning and late-hook no-false-closure controls red→green; concurrent-release setup bounded. Coordinator-approved one-shot terminal settlement implemented with a durable generation marker and at most one restart retry; native frame success/failure plus supplementary restart bounds pass locally. Failed-launch durable ownership/LaunchSettled integration remains pending T-1606 and the Coordinator's merge instruction. No verify submitted; no source-clear claim.

### impl-1607 · 2026-11-04T00:11:27.523Z

Coordinator 66fe13ce: deterministic native descendant injected between prepare-stop and commit reproduced the prior identity refusal red, then passed after one validated pre-signal recapture. Shared descendant policy serves recapture and dynamic SessionEnd acquisition; foreign UID, reparented/pre-existing PID, vanished root and second-churn controls refuse (second-churn sends zero signals). Other remote stop failures now retain generation-scoped cleanup-incomplete cause and clear only on successful explicit re-stop. Current local correction tree: remote native file14/14; claude-stop11/11; remote-files10/10; typecheck green. A-16426 retains prior exact-head20/20 receipts at88297e2b3. C2 remains incomplete for T-1606 LaunchSettled integration; no review/verify submitted.

### impl-1607 · 2026-11-04T00:27:41.521Z

Correction checkpoint pushed: d51e28ce2f30efa8c6cf211b2f1e2e898aef976e. Evidence A-16431; accepted20/20 source-specific repetition A-16426. Source finding C3/jobs preflight fixed; late-hook, terminal settlement and pre-signal ownership controls green. Native remote15/15 on runtime-equivalent candidate (only Markdown EOF formatting differs), focused T1/T2 files32/32 and unchanged C5 generated cases72/72 at d51; all-package typecheck and test:lint pass (122 report-only findings, zero refusals; known advisory limits retained). C2 is still incomplete for durable failed-launch LaunchSettled integration. Blocker/help needed: T-1606 lands after T-1644, then Coordinator sends the authorized merge instruction. No new dev merge/source review/verification/QA claim. Keeping claim; idle for dependency instruction.

### impl-1607 · 2026-11-04T02:45:07.142Z

Coordinator3d3d176f approves optional HarnessAdapter.settleFailedLaunch(process). Consumer search (before editing) covered HarnessAdapter/LaunchRecoveryPending/recoveryObservers/settleFailedLaunch across production, all test tiers, shared/web/nvim, skills/docs/QA. Consumers: adapters/contract,index,sessions,codex,opencode,claude-code,launch-files; tests session-archive,codex-host,opencode-host,request-guard,tracker-native-boundary,fakes/harness,fakes/scripted-codex; docs/hub/adapters-and-sessions. Existing structural adapters and all non-Claude adapters remain unedited: optional member absent preserves behavior. Sessions uses it only for file-backed pending launches without an in-memory observer; ordinary owned-process cleanup remains unchanged. No frame/wire or PendingStop/LaunchFilesState schema changes. Claude alone consumes exact-generation adapter state. Agent's pending launch record gains config/jobs/private-directory metadata and a pinned printed job/cause, with no credential/content or PID signal authority. Existing complete receipts retain their shape; pending receipts refuse explicitly.

### impl-1607 · 2026-11-04T03:28:25.759Z

Implemented A-16407 corrections and the approved T-1606 settlement migration; pushed c7452c7018e139eb967381c6fd82531bb0d63fed. A-16466 records consumer inventory, exact test-head provenance, C1–C5 evidence, permission/recovery boundary flags, and forced Claude-only observer edits. Historical A-16426 remains linked. No verification yet; fresh source review next.

### rev-36 · 2026-11-04T03:32:41.541Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1607-source-2
commit: c7452c7018e139eb967381c6fd82531bb0d63fed
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected/reworked source clear, all A-16407 findings resolved; no findings. A-16469 covers jobs preflight, late-hook closure fence/one validated recapture, durable bounded terminal/failed-launch settlement, observer-absent Sessions fallback and post-clear metadata-only prune, native-ID permission binding, forced Claude-only typed observer migration and matching docs. Direct Coordinator authorizations read. Codex/OpenCode/LaunchFiles/LaunchSettled and three C5 files unchanged. C1–C5 remain runtime-unverified; mode-free verification may proceed at exactc7452c701. A16466 final focused37/static checks local macOS evidence read; broader8b164 prior-head/historical20× receipts labelled supplemental, not current Linux. Reviewer ran no checks/browser/probes/edits/delegation.

### rev-36 · 2026-11-04T03:40:05.011Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1607-evidence-1
commit: c7452c7018e139eb967381c6fd82531bb0d63fed
scope: evidence
findings: [{"severity":"medium","text":"Required queued verification fails the state-path inventory on unregistered HOME reads: command.env.HOME and env.HOME. Use the shared state-path resolution or an approved exact registration with matching documentation and planted guards; the current run is not clear.","file":"hub/src/host/agent/claude.ts","line":83}]
finding_counts: {"high":0,"medium":1,"low":0}

Verification evidence not clear; A-16475. A16474 actual AssertionError reports ['host/agent/claude.ts:83: HOME access: command.env.HOME','host/agent/claude.ts:83: HOME access: env.HOME'] versus []. Same-head run5b2e6bb5 autoexit1/T1failed; T0passed, T2/T3/T4/Web unexecuted/interrupted. C3failed; C1/C2/C4/C5unverified. This is the required inventory guard, not report-only timing/lint advisories. Correct shared path resolution/approved exact registration with docs/guards, request fresh source review before rerun. No Reviewer execution.

Criteria: C3 failed (Required T1 state-path inventory fails at agent/claude.ts83 for command.env.HOME and env.HOME; later runtime phases unexecuted.).

### impl-1607 · 2026-11-04T03:43:23.757Z

Pushed a67ce0a36fcd2194fcc8337dc845dc3b2a79f07a fixes own failed verify5b2e6bb5 state-path inventory defect. A-16476 records original red, unchanged guard green, owner/reason registration and exact-head 45/45+remote20/check. Fresh source review requested; no dev merge or verification rerun yet.

### rev-36 · 2026-11-04T03:43:58.202Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1607-source-3
commit: a67ce0a36fcd2194fcc8337dc845dc3b2a79f07a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

State-path correction source clear, no findings; A-16477. Exact precedence moved to shared hostClaudeConfigDirectory with explicit host environments, no hub HOME fallback. Exact inventory owner/reason registrations and pure precedence case added; scanner/assertion/planted controls unchanged, canonical UID0700 gate intact. Rest of approved permission/recovery source A16469 unchanged. A16476 local exact-head45+20/native exit0/check pass inspected; no current queued/Linux claim. C1–C5 runtime criteria remain unverified. Repeat exact-head preservation supplements and mode-free verify; prior A16474 remains failed. Reviewer ran no tests/probes/checks/browser/edits.

### rev-36 · 2026-11-04T03:50:36.138Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1607-evidence-2
commit: a67ce0a36fcd2194fcc8337dc845dc3b2a79f07a
scope: evidence
findings: [{"severity":"medium","text":"The account-root fix imports ../../state-paths.ts outside the agent's allowed dependency closure. Required T1 host-agent-boundary.test.ts fails on that exact import. Keep resolution in one Node-only agent-owned helper (with exact inventory registration) rather than weakening the boundary or copying the parser.","file":"hub/src/host/agent/claude.ts","line":7}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear; A-16482. A16479 actual AssertionError claude.ts lists '/home/runner/cland/hub/src/state-paths.ts' versus [] at host-agent-boundary.test.ts38. Run104d0239 autoexit1/T1failed, T0passed; T2/T3/T4/Web unexecuted. C3failed; other criteria unverified. I missed the existing import guard during the last source correction review. Preserve one Node-only agent-owned resolver and exact state inventory registration with both guards intact; fresh source review required before rerun. No Reviewer execution.

Criteria: C3 failed (Required host-agent dependency boundary fails: agent/claude.ts imports ../../state-paths.ts outside Node-only agent closure.).

### impl-1607 · 2026-11-04T03:53:09.813Z

Pushed eb812bfd2b0fc3eef01047022442425c79ea0355 for Coordinator-approved agent-owned shared path resolver. A-16483 records both guards unedited and green,47/47+20/20/check exact-head passes. Fresh source review before verify.

### rev-36 · 2026-11-04T03:53:40.485Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1607-source-4
commit: eb812bfd2b0fc3eef01047022442425c79ea0355
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Agent-owned resolver source clear; no findings. A-16484. One Node-only agent/state-paths implementation, sibling agent import and root re-export of identical function object, exact inventory registration moved. Direct Coordinator5b96e26f checked; both guards/scanner unedited, precedence/private-directory gate unchanged. A16483 local47+20/native exit0/check pass read; no queued/Linux execution yet. C1–C5 runtime-unverified; refresh current-head preservation and mode-free verify, including T2/later named outcomes. Previous A16474/A16479 remain failed. No Reviewer tests/probes/checks/browser/edits.

### rev-36 · 2026-11-04T04:09:59.913Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1607-evidence-3
commit: eb812bfd2b0fc3eef01047022442425c79ea0355
scope: evidence
findings: [{"severity":"medium","text":"Both mapped Claude snapshot cases fail teardown because their recording observer throws an untyped launch error, which the new recovery contract correctly retains as supervised; adapter.close then rejects. Migrate this synthetic no-native observer to the typed non-admission/Host resolution contract or provide complete settlement, retaining all baseline argv/env/bytes/mode assertions and other adapters.","file":"hub/test/host-launch-layout.test.ts","line":31}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear; A-16489. Actual A16486 failure is 'Claude launch cleanup incomplete: failed generation remains supervised' at adapter1314 for both mapped Claude umasks, not baseline byte mismatch. T0/T1 passed; T2failed, T3/T4/Web unexecuted. C3failed; others unverified. Preserve production generic-error supervision; migrate synthetic no-native observer honestly, retain all exact baseline assertions/Codex/OpenCode cases, request fresh source review before rerun. No Reviewer execution.

Criteria: C3 failed (Required mapped Claude launch preservation cases fail close with supervised failed generation; recording observer not migrated to typed non-admission/settlement contract.).
