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
updated: 2026-11-04T00:27:41.521Z
---

## Summary

A Claude Code session on a fake host runs `claude --bg` through the agent, with its `mcp.json` and `settings.json` on the host. It finds its worker with one `claude agents --json` (T-1556), adopts the worker into the agent's table, and reports state through hooks and the mod bridge on the host. These reach the hub through the forwarded `hub.sock` with the host's secret and the session's credential.

Hot files: `hub/src/adapters/claude-code.ts`, `hub/src/host/agent/processes.ts` (adopt), `hub/test/claude-code-remote.test.ts` (new)

## Acceptance criteria

- [x] C1. Through the frame protocol a Claude Code session launched on a fake host with the scripted Claude fake receives a delivery and reports its state from its hooks (test).
  - done: impl-1607 · 2026-11-03T23:33:48.830Z
- [ ] C2. The worker found by the one `agents --json` is adopted into the host agent's table with its Linux identity, and liveness and stop go through the agent (test).
  - failed: rev-35 [reviewer] · 2026-11-03T23:42:22.644Z · note Normal/failure terminal paths lack durable settlement ownership, and adopted capture can acknowledge tree closure while an unowned late hook remains alive.
- [x] C3. The session's hooks and mod bridge connect through the host's `hub.sock` and are dispatched as that session, and their settings carry host paths only (test).
  - done: impl-1607 · 2026-11-04T00:10:17.196Z
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
