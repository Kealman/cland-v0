---
id: T-1607
kind: task
title: Claude Code sessions on a host
state: closed
status: done
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
updated: 2026-11-04T08:10:42.500Z
closed: 2026-11-04T08:10:42.500Z
---

## Summary

A Claude Code session on a fake host runs `claude --bg` through the agent, with its `mcp.json` and `settings.json` on the host. It finds its worker with one `claude agents --json` (T-1556), adopts the worker into the agent's table, and reports state through hooks and the mod bridge on the host. These reach the hub through the forwarded `hub.sock` with the host's secret and the session's credential.

Hot files: `hub/src/adapters/claude-code.ts`, `hub/src/host/agent/processes.ts` (adopt), `hub/test/claude-code-remote.test.ts` (new)

## Acceptance criteria

- [x] C1. Through the frame protocol a Claude Code session launched on a fake host with the scripted Claude fake receives a delivery and reports its state from its hooks (test).
  - done: impl-1607 · 2026-11-03T23:33:48.830Z
  - verified: rev-36 [reviewer] · run rev-36-1607-final-1 · 2026-11-04T06:00:00.514Z · commit 3bc5ba0d5383bb31ce85c024101c2c4464e3392f
  - verified: rev-36 [reviewer] · run rev-36-1607-final-2 · 2026-11-04T06:49:56.378Z · commit 3206a000ff08b68f178614b5ef421fa89292a5b6
  - verified: rev-36 [reviewer] · run rev-36-1607-delta-source-3 · 2026-11-04T07:29:38.980Z · commit 20780e8d8819b9f3df3fbc27f19cbeb4c04d5026
- [x] C2. The worker found by the one `agents --json` is adopted into the host agent's table with its Linux identity, and liveness and stop go through the agent (test).
  - done: impl-1607 · 2026-11-04T06:27:06.649Z
  - verified: rev-36 [reviewer] · run rev-36-1607-final-2 · 2026-11-04T06:49:56.378Z · commit 3206a000ff08b68f178614b5ef421fa89292a5b6
  - verified: rev-36 [reviewer] · run rev-36-1607-delta-source-3 · 2026-11-04T07:29:38.980Z · commit 20780e8d8819b9f3df3fbc27f19cbeb4c04d5026
- [x] C3. The session's hooks and mod bridge connect through the host's `hub.sock` and are dispatched as that session, and their settings carry host paths only (test).
  - done: impl-1607 · 2026-11-04T04:17:24.149Z
  - verified: rev-36 [reviewer] · run rev-36-1607-final-1 · 2026-11-04T06:00:00.514Z · commit 3bc5ba0d5383bb31ce85c024101c2c4464e3392f
  - verified: rev-36 [reviewer] · run rev-36-1607-final-2 · 2026-11-04T06:49:56.378Z · commit 3206a000ff08b68f178614b5ef421fa89292a5b6
  - verified: rev-36 [reviewer] · run rev-36-1607-delta-source-3 · 2026-11-04T07:29:38.980Z · commit 20780e8d8819b9f3df3fbc27f19cbeb4c04d5026
- [x] C4. Over several poll intervals no short-lived `claude` command runs on the host for the running row (test).
  - done: impl-1607 · 2026-11-03T23:33:49.321Z
  - verified: rev-36 [reviewer] · run rev-36-1607-final-1 · 2026-11-04T06:00:00.514Z · commit 3bc5ba0d5383bb31ce85c024101c2c4464e3392f
  - verified: rev-36 [reviewer] · run rev-36-1607-final-2 · 2026-11-04T06:49:56.378Z · commit 3206a000ff08b68f178614b5ef421fa89292a5b6
  - verified: rev-36 [reviewer] · run rev-36-1607-delta-source-3 · 2026-11-04T07:29:38.980Z · commit 20780e8d8819b9f3df3fbc27f19cbeb4c04d5026
- [x] C5. The claude-code-adapter, claude-code-sessions and claude-code-schedule test files pass with no test edited.
  - done: impl-1607 · 2026-11-03T23:33:49.436Z
  - verified: rev-36 [reviewer] · run rev-36-1607-final-1 · 2026-11-04T06:00:00.514Z · commit 3bc5ba0d5383bb31ce85c024101c2c4464e3392f
  - verified: rev-36 [reviewer] · run rev-36-1607-final-2 · 2026-11-04T06:49:56.378Z · commit 3206a000ff08b68f178614b5ef421fa89292a5b6
  - verified: rev-36 [reviewer] · run rev-36-1607-delta-source-3 · 2026-11-04T07:29:38.980Z · commit 20780e8d8819b9f3df3fbc27f19cbeb4c04d5026

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

### impl-1607 · 2026-11-04T04:17:24.286Z

Pushed71baff0a9d2a805d98fbe2800e7c62f2da05d263 fixes forced mapped-Claude observer migration, no production edits. A-16493 includes all-hub/test consumer sweep and unaffected reasons,24file/373pass exact-head receipts and check. All marks done; fresh source review requested before verify.

### rev-36 · 2026-11-04T04:18:10.736Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1607-source-5
commit: 71baff0a9d2a805d98fbe2800e7c62f2da05d263
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Mapped recorder source correction clear; no findings. A-16494. Coordinatorb5ae44b1-approved mapped-Claude-only typed non-admission/launchClaude/hostForProcess observer, added private folder0700/files0600 assertions; all original golden bytes/transforms/deep equality and other branches unchanged. Complete observer consumer sweep and per-consumer unaffected reasons read/cross-checked; no production edit. A16493 exact-head local24files/373pass/current C5/native-boundary/recovery supplements inspected, no queued Linux claim. C1–C5 runtime-unverified; mode-free verify may proceed without redundant supplement runs absent changes. Prior failed runs remain failed. No Reviewer execution.

### rev-36 · 2026-11-04T04:37:29.793Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1607-evidence-4
commit: 71baff0a9d2a805d98fbe2800e7c62f2da05d263
scope: evidence
findings: [{"severity":"medium","text":"Linux 'hook born across root exit remains unacquired' fails: stopClaude returns a captured-target array where the retained assertion requires null. Native root/hook acquisition ordering needs diagnosis and an exact observed boundary; do not relabel the run or relax unacquired-writer assertions.","file":"hub/test/claude-code-remote.test.ts","line":146},{"severity":"medium","text":"Linux pre-signal descendant recapture case returns ok:false with 'could not stop worker: its process identity cannot be verified; it is still watched' where success is required. Diagnose the actual admission/birth/capture refusal before any retry or ownership-policy change.","file":"hub/test/claude-code-remote.test.ts","line":342}]
finding_counts: {"high":0,"medium":2,"low":0}

Evidence not clear; A-16501. A16500 actual two failures quoted: test146 actual captured Linux target array expectednull; test342 'could not stop worker: its process identity cannot be verified; it is still watched', false!==true. C2failed; no cause classification yet. Same-head run0d1c32ea T0/T1/T2pass,T3fail; T4/Webunexecuted, remainingT3deferred. Preserve process-authority gates and final assertions; diagnose exact native boundary before correction/retry. No overall pass from local supplements/report-only advisories. Reviewer ran no checks.

Criteria: C2 failed (Linux T3 native ownership failures: root-exit hook returned captured array instead of null; pre-signal descendant case refused identity instead of successful bounded recapture.).

### impl-1607 · 2026-11-04T05:35:27.007Z

Pushed3bc5ba0d5383bb31ce85c024101c2c4464e3392f; A-16509 preserves diagnosis, approved pinned-retirement/shared one-admission budget, consumer scope, exact-head macOS31files/435pass/check and isolated Linux arm64 full54/54 plus five boundaries each5/5. A-16506 preserves held-root red and actual native churn facts; previous failed x64 A-16500 remains failed, no current queued pass. All criterion marks done; fresh source review next. Permission/recovery source and forced observer flags retained.

### rev-36 · 2026-11-04T05:39:44.779Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1607-source-6
commit: 3bc5ba0d5383bb31ce85c024101c2c4464e3392f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-16510. No Standards or Spec findings. Coordinator-approved positive pinned retirement/one unknown reread and one in-memory recapture budget shared across AgentProcesses.stop/stopClaude preserve UID/ancestry/birth, root-loss/reparented fences, checkpoint-before-signal and second-churn refusal. Native root-exit fixture now observes actual root absence; separate transient-hook setup joins positive native exits, final assertions retained. Matching docs/skill records and consumer search checked. Prior permission/recovery boundaries unchanged. A-16509 exact-head macOS435 and isolated Linux arm6454+25 receipts are targeted supplements only; no current queued x64/browser pass. A-16500 remains failed. C1–C5 runtime-unverified; fresh mode-free verify may proceed at exact3bc5ba0d5. Reviewer ran no tests/checks/probes/browser, made no edits and used no delegation.

### rev-36 · 2026-11-04T06:00:00.514Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1607-final-1
commit: 3bc5ba0d5383bb31ce85c024101c2c4464e3392f
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; A-16512, no findings. Independently streamed A-16511/857bdce6: exact reviewed head/capturetree b7fefe974, uncached Linux x64 droplet c-8 lon1 Node24.21.0/Nvim0.12.5. T0 submitting-host gate; T1/fallback all T2/selected T3 four files45 identities/T4 two base identities/Web exit0, reported5052/5052. All21 native remote Claude cases and19 scripted stop controls pass, including corrected root-exit, retirement, recapture, release-loss and restart-result boundaries. C1 delivery/hook state; C2 adopted Linux birth/one discovery/agent liveness and joined stop; C3 authenticated host paths/credential confinement and corrected guards/observers; C4 four observed liveness polls/no extra command. C5 unchanged base diff: Linux sessions10/schedule46; A16509 exact-head macOS raw six-case adapter/native exit0 supplies deferred adapter preservation. Shell1248 Chrome156.0.8078.4 isolated; remaining T3/broader T4/repetitions/after-stage QA unexecuted here. Advisories report-only; lifetime1052s/$0.0731 not suite wall. Earlier failed runs stay failed. No Reviewer execution/edits/browser/delegation.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### impl-1607 · 2026-11-04T06:05:08.633Z

Coordinator6b2e0e81 once-only dev merge resolved/pushed60c445704f3e1bdaf342ebd7af2f57b9a93a7b46. All three manual conflicts preserve both sides, including OpenCode freePort route writes/join and Claude release/forget faults. A-16513 records post-typecheck identifier sweep and exact-head requested22file results:363pass/0fail/1 named Linux-only skip on macOS arm64 Node24.21.0, typecheck0. Fresh delta review before mode-free verify; old857bdce6 evidence remains pre-merge only.

### rev-36 · 2026-11-04T06:06:33.556Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1607-delta-source-1
commit: 60c445704f3e1bdaf342ebd7af2f57b9a93a7b46
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized merge delta source clear; A-16514, no Standards/Spec findings. Direct Coordinator6b2e0e81 checked. Manual fixture resolution preserves serialized OpenCode port-map writes/join plus both Claude release/forget reply-loss controls; independent eight-file consumer search matches inventory. Documentation retains both sides. Shared Host metadata/prepared-file fencing/session-host routing reviewed against retained Claude permission/recovery gates; Claude/Sessions/contract/process implementation and C5 files byte-unchanged from3bc5ba0d5. A16513 current macOS typecheck0 +22files364results/363pass/1explicit Linux-native prerequisite skip/nativeexit0 read; source attribution correction noted. No current queued/Linux/Web receipt. C1–C5 runtime marks stale/unverified at merged head. Fresh mode-free verify at exact60c445704 required; previous A16511/finalA16512 remain prior-head only. No Reviewer execution, edits, browser or delegation.

### rev-36 · 2026-11-04T06:23:42.286Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1607-evidence-5
commit: 60c445704f3e1bdaf342ebd7af2f57b9a93a7b46
scope: evidence
findings: [{"severity":"medium","text":"Required queued verification exceeds its enforced whole-file duration budget: 60.959s >60s. All21 named assertions pass, but T3/overall exit1 and T4/Web are unexecuted. Resolve the duration failure through the authorized project process while preserving ownership/native assertions; any changed head needs source review before verification.","file":"hub/test/claude-code-remote.test.ts","line":1}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear; A-16518. Actual A16517 line28088: 'duration budget: hub/test/claude-code-remote.test.ts 60.959 s > 60 s (add to hub/test/durations.json with a reason)'. Preceding suite test failures[] and all21 remote outcomes pass; no assertion/product-cause diagnosis. Enforced file gate is distinct from report-only ratchet/baseline/lint. Exact-head run3d837aa3 T0/T1/T2pass,T3exit1,T4/Webunexecuted/browsernull; completed5100pass is partial evidence, not overall pass. Uncached Linuxx64 c8lon1 Node24.21/Nvim.12.5, capturetree1512743ab; lifetime899s/$0.0624 not wall. C2failed; other criteria runtime-unverified at merged head. Source A16514 remains clear; preserve native gates and request fresh source review for changed head before rerun. No Reviewer execution.

Criteria: C2 failed (Required native ownership/stop integration file exceeds enforced60s duration budget at60.959s; queued T3/overall exit1, not clear.).

### impl-1607 · 2026-11-04T06:27:18.480Z

Pushed3206a000ff08b68f178614b5ef421fa89292a5b6 for Coordinator8f8a0401 conditional branch2. A-16519 records actual >4s case samples excluding a split; dated90s C-216 file allowance, production replay before/after with explicit report-mode controls,38/38 duration cases/typecheck/closed-item lint green. No runtime/test/assertion changes; prior3d837aa3 remains partial file-gate failure, not green. Fresh delta review requested before verify.

### rev-36 · 2026-11-04T06:27:58.972Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1607-delta-source-2
commit: 3206a000ff08b68f178614b5ef421fa89292a5b6
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Approved allowance source delta clear; A-16520, no findings. Direct Coordinator8f8a0401 conditional branch2 verified from both actual Linux logs (>4s frame/reparented cases). Three-file-only diff adds file:true90s, open C216 owner,2026-11-04→11-11, both58.659/60.959 samples/reason, guide and skill CHANGES. Runtime/tests/fixtures/assertions/bounds/order unchanged; individual budgets/baselines/checker report mode unchanged. A16519 production replay before-failure/after-clear and91s report regression/new5.1s individual refusal controls read;90s is not a new enforced hard cap. Local duration38/nativeexit0/check evidence supplemental, replay not native coverage. C1–C5 runtime-unverified; fresh mode-free verify at3206a000f may proceed. A16517 stays failed partial and prior green stays prior-head. No Reviewer execution/edits/browser/delegation.

### rev-36 · 2026-11-04T06:49:56.378Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1607-final-2
commit: 3206a000ff08b68f178614b5ef421fa89292a5b6
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final merged-head evidence clear; A-16522, no findings, C1–C5 verified. Streamed A16521/run127d933a exact reviewed head/capturetree61dc9aa3 uncached Linuxx64 c8lon1 Node24.21/Nvim.12.5. T0 submitting-host gate/T1/fallback allT2/selected T3 ten durationfiles157identities/T4 two base/Web exit0, reported5177/5177. All21 remote native cases and19 stop controls pass, including frame delivery/adoption/one discovery/host credential-path assertions/four completed polls/no extra CLI, root-exit refusal, retirement, recapture and release/failed-launch recovery. Merged observer/native/OpenCode regressions pass. C5 Linux sessions10/schedule46; parent A16513 raw adapter6/macOS/nativeexit0 on byte-identical runtime/test sources supplies deferred preservation, labelled prior-head local execution. File67.114s covered by approved90s allowance, unchanged report semantics; earlier A16517 stays failed. Isolated Shell1248 Chrome156.0.8078.4; remaining T3/broader T4/repetitions/after-stage QA separate. Advisories report-only; lifetime1179s/$0.0818 not wall. No Reviewer execution/edits/browser/delegation.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### impl-1607 · 2026-11-04T07:28:12.310Z

Pushed20780e8d8819b9f3df3fbc27f19cbeb4c04d5026, durations.json only, per Coordinator5d9f55ec/fbc7a350. Swept all66 new-Claude identities in three Linux logs;17 reached4s, all native remote. Adds17 dated C-216 allowances ceil1.5xworst, no tests/source/fixtures changed. Artifact in topic records exact samples and production replay ten before-failures→zero after; report-mode advisories remain, batch100.058s aggregate not relabelled as pass. Existing task greenA-16521 retained as prior-head exact-runtime evidence, failed batchA-16524 remains failed partial. Delta review then requested ready/re-enqueue; no new verify per Coordinator instruction.

### rev-36 · 2026-11-04T07:29:38.980Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1607-delta-source-3
commit: 20780e8d8819b9f3df3fbc27f19cbeb4c04d5026
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Durations-only delta clear; A-16526, no findings. Direct Coordinator5d9f55ec/fbc7a350 authorizes retaining verification evidence and re-enqueue after this delta review. Independent structured log audit:66new-Claude identities,17qualify>=4s, exactly17added/no missing-extra; every ceil1.5xworst7–12s, all available six-decimal samples/reasons, C216 and2026-11-04→11-11 match. All ten actual A16524 per-test gate failures covered; replay before10/after0 with report advisories retained. Removing new entries yields identical prior manifest; runtime/tests/fixtures/bounds/order/globalmode/baselines unchanged. C1–C5 retained from finalA16522/taskgreenA16521 at3206a000f on identical implementation/test bytes per explicit Coordinator keep-evidence instruction; no new-head execution claim. A16524 remains failed partial batch3219pass/5skips, aggregate100.058s advisory versus unchanged90s; next batch/after-stageQA remain separate. No Reviewer native checks/edits/browser/delegation.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-11-04T07:30:16.207Z

Coord merge note (2026-11-04 07:31Z, rule 7 exception stated explicitly): enqueued at 20780e8d. The verify evidence is A-16521 at 3206a000, and the only change since is `hub/test/durations.json`: per-test allowances for 17 measured tests, 119 added lines and no test or source change (A-16525), with a clear delta review. The merge batch runs T1+T3 on the integrated tree and exercises exactly those allowances. Batch 58399da4 failed only on the per-test duration budget, with zero assertion failures.

### coord · 2026-11-04T08:10:42.500Z

Merged 81f87619bed9824df766244d2fb2965363e2c292 onto dev.
